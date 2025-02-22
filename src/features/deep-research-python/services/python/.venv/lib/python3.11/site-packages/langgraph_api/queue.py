import asyncio
from collections.abc import AsyncGenerator
from contextlib import AsyncExitStack, asynccontextmanager
from datetime import UTC, datetime
from typing import TypedDict, cast

import structlog
from langgraph.pregel.debug import CheckpointPayload, TaskResultPayload

from langgraph_api.auth.custom import SimpleUser, normalize_user
from langgraph_api.config import BG_JOB_HEARTBEAT, STATS_INTERVAL_SECS
from langgraph_api.errors import (
    UserInterrupt,
    UserRollback,
)
from langgraph_api.http import get_http_client
from langgraph_api.js.errors import RemoteException
from langgraph_api.metadata import incr_runs
from langgraph_api.schema import Run
from langgraph_api.stream import (
    astream_state,
    consume,
)
from langgraph_api.utils import set_auth_ctx, with_user
from langgraph_storage.database import connect
from langgraph_storage.ops import Runs, Threads
from langgraph_storage.retry import RETRIABLE_EXCEPTIONS

try:
    from psycopg.errors import InFailedSqlTransaction
except ImportError:
    InFailedSqlTransaction = ()

logger = structlog.stdlib.get_logger(__name__)

WORKERS: set[asyncio.Task] = set()
WEBHOOKS: set[asyncio.Task] = set()
MAX_RETRY_ATTEMPTS = 3
SHUTDOWN_GRACE_PERIOD_SECS = 5


def ms(after: datetime, before: datetime) -> int:
    return int((after - before).total_seconds() * 1000)


async def queue(concurrency: int, timeout: float):
    loop = asyncio.get_running_loop()
    last_stats_secs: int | None = None
    last_sweep_secs: int | None = None
    semaphore = asyncio.Semaphore(concurrency)

    def cleanup(task: asyncio.Task):
        WORKERS.remove(task)
        semaphore.release()
        try:
            result: WorkerResult | None = task.result()
            exc = task.exception()
            if exc:
                logger.exception("Background worker failed", exc_info=exc)
            if result and result["webhook"]:
                checkpoint = result["checkpoint"]
                payload = {
                    **result["run"],
                    "status": result["status"],
                    "run_started_at": result["run_started_at"],
                    "run_ended_at": result["run_ended_at"],
                    "webhook_sent_at": datetime.now(UTC).isoformat(),
                    "values": checkpoint["values"] if checkpoint else None,
                }
                if exception := result["exception"]:
                    payload["error"] = str(exception)

                async def _call_webhook() -> None:
                    try:
                        await get_http_client().post(
                            result["webhook"], json=payload, total_timeout=20
                        )
                    except Exception as exc:
                        logger.exception(
                            f"Background worker failed to call webhook {result['webhook']}",
                            exc_info=exc,
                            webhook=result["webhook"],
                        )

                hook_task = asyncio.create_task(
                    _call_webhook(),
                    name=f"webhook-{result['run']['run_id']}",
                )
                WEBHOOKS.add(hook_task)
                hook_task.add_done_callback(WEBHOOKS.remove)

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.exception("Background worker cleanup failed", exc_info=exc)

    await logger.ainfo(f"Starting {concurrency} background workers")
    try:
        tup: tuple[Run, int] | None = None
        while True:
            try:
                # check if we need to sweep runs
                do_sweep = (
                    last_sweep_secs is None
                    or loop.time() - last_sweep_secs > BG_JOB_HEARTBEAT * 2
                )
                # check if we need to update stats
                if calc_stats := (
                    last_stats_secs is None
                    or loop.time() - last_stats_secs > STATS_INTERVAL_SECS
                ):
                    last_stats_secs = loop.time()
                    active = len(WORKERS)
                    await logger.ainfo(
                        "Worker stats",
                        max=concurrency,
                        available=concurrency - active,
                        active=active,
                    )
                # wait for semaphore to respect concurrency
                await semaphore.acquire()
                exit = AsyncExitStack()
                # skip the wait, if 1st time, or got a run last time
                wait = tup is None and last_stats_secs is not None
                # try to get a run, handle it
                if tup := await exit.enter_async_context(Runs.next(wait=wait)):
                    run_, attempt_ = tup
                    task = asyncio.create_task(
                        worker(timeout, exit, run_, attempt_),
                        name=f"run-{run_['run_id']}-attempt-{attempt_}",
                    )
                    task.add_done_callback(cleanup)
                    WORKERS.add(task)
                else:
                    semaphore.release()
                    await exit.aclose()
                # run stats and sweep if needed
                if calc_stats or do_sweep:
                    async with connect() as conn:
                        # update stats if needed
                        if calc_stats:
                            stats = await Runs.stats(conn)
                            await logger.ainfo("Queue stats", **stats)
                        # sweep runs if needed
                        if do_sweep:
                            last_sweep_secs = loop.time()
                            run_ids = await Runs.sweep(conn)
                            logger.info("Sweeped runs", run_ids=run_ids)
            except Exception as exc:
                # keep trying to run the scheduler indefinitely
                logger.exception("Background worker scheduler failed", exc_info=exc)
                semaphore.release()
                await exit.aclose()
    finally:
        logger.info("Shutting down background workers")
        for task in WORKERS:
            task.cancel()
        for task in WEBHOOKS:
            task.cancel()
        await asyncio.wait_for(
            asyncio.gather(*WORKERS, *WEBHOOKS, return_exceptions=True),
            SHUTDOWN_GRACE_PERIOD_SECS,
        )


class WorkerResult(TypedDict):
    checkpoint: CheckpointPayload | None
    status: str | None
    exception: Exception | None
    run: Run
    webhook: str | None
    run_started_at: str
    run_ended_at: str | None


@asynccontextmanager
async def set_auth_ctx_for_run(
    run_kwargs: dict, user_id: str | None = None
) -> AsyncGenerator[None, None]:
    # user_id is a fallback.
    try:
        user = run_kwargs["config"]["configurable"]["langgraph_auth_user"]
        permissions = run_kwargs["config"]["configurable"]["langgraph_auth_permissions"]
        if user is not None:
            user = normalize_user(user)
            async with with_user(user, permissions):
                yield None
        else:
            yield None

    except KeyError:
        if user_id is not None:
            await logger.ainfo(
                "Setting auth to backup user_id",
                user_id=user_id,
            )
            async with with_user(SimpleUser(user_id)):
                yield None
        else:
            yield None
    except Exception:
        pass


async def worker(
    timeout: float,
    exit: AsyncExitStack,
    run: Run,
    attempt: int,
) -> WorkerResult:
    run_id = run["run_id"]
    if attempt == 1:
        incr_runs()
    checkpoint: CheckpointPayload | None = None
    exception: Exception | None = None
    status: str | None = None
    webhook = run["kwargs"].pop("webhook", None)
    run_started_at = datetime.now(UTC)
    run_ended_at: str | None = None

    async with (
        connect() as conn,
        set_auth_ctx_for_run(run["kwargs"]),
        Runs.enter(run_id) as done,
        exit,
    ):
        temporary = run["kwargs"].get("temporary", False)
        run_created_at = run["created_at"].isoformat()
        await logger.ainfo(
            "Starting background run",
            run_id=str(run_id),
            run_attempt=attempt,
            run_created_at=run_created_at,
            run_started_at=run_started_at.isoformat(),
            run_queue_ms=ms(run_started_at, run["created_at"]),
        )

        def on_checkpoint(checkpoint_arg: CheckpointPayload):
            nonlocal checkpoint
            checkpoint = checkpoint_arg

        def on_task_result(task_result: TaskResultPayload):
            if checkpoint is not None:
                for task in checkpoint["tasks"]:
                    if task["id"] == task_result["id"]:
                        task.update(task_result)
                        break

        try:
            if attempt > MAX_RETRY_ATTEMPTS:
                raise RuntimeError(f"Run {run['run_id']} exceeded max attempts")
            if temporary:
                stream = astream_state(
                    AsyncExitStack(), conn, cast(Run, run), attempt, done
                )
            else:
                stream = astream_state(
                    AsyncExitStack(),
                    conn,
                    cast(Run, run),
                    attempt,
                    done,
                    on_checkpoint=on_checkpoint,
                    on_task_result=on_task_result,
                )
            await asyncio.wait_for(consume(stream, run_id), timeout)
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.ainfo(
                "Background run succeeded",
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            status = "success"
            await Runs.set_status(conn, run_id, "success")
        except TimeoutError as e:
            exception = e
            status = "timeout"
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.awarning(
                "Background run timed out",
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            await Runs.set_status(conn, run_id, "timeout")
        except UserRollback as e:
            exception = e
            status = "rollback"
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.ainfo(
                "Background run rolled back",
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            try:
                await Runs.delete(conn, run_id, thread_id=run["thread_id"])
            except InFailedSqlTransaction as e:
                await logger.ainfo(
                    "Ignoring rollback error",
                    run_id=str(run_id),
                    run_attempt=attempt,
                    run_created_at=run_created_at,
                    exc=str(e),
                )
                # We need to clean up the transaction early if we want to
                # update the thread status with the same connection
                await exit.aclose()
            checkpoint = None  # reset the checkpoint
        except UserInterrupt as e:
            exception = e
            status = "interrupted"
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.ainfo(
                "Background run interrupted",
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            await Runs.set_status(conn, run_id, "interrupted")
        except RETRIABLE_EXCEPTIONS as e:
            exception = e
            status = "retry"
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.awarning(
                "Background run failed, will retry",
                exc_info=True,
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            await Runs.set_status(conn, run_id, "pending")
            raise
        except Exception as exc:
            exception = exc
            status = "error"
            run_ended_at = datetime.now(UTC).isoformat()
            await logger.aexception(
                "Background run failed",
                exc_info=not isinstance(exc, RemoteException),
                run_id=str(run_id),
                run_attempt=attempt,
                run_created_at=run_created_at,
                run_started_at=run_started_at.isoformat(),
                run_ended_at=run_ended_at,
                run_exec_ms=ms(datetime.now(UTC), run_started_at),
            )
            await Runs.set_status(conn, run_id, "error")
        set_auth_ctx(None, None)
        # delete or set status of thread
        if temporary:
            await Threads.delete(conn, run["thread_id"])
        else:
            await Threads.set_status(conn, run["thread_id"], checkpoint, exception)
        # Note we don't handle asyncio.CancelledError here, as we want to
        # let it bubble up and rollback db transaction, thus marking the run
        # as available to be picked up by another worker
    return {
        "checkpoint": checkpoint,
        "status": status,
        "run_started_at": run_started_at.isoformat(),
        "run_ended_at": run_ended_at,
        "run": run,
        "exception": exception,
        "webhook": webhook,
    }
