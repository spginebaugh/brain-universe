from os import environ, getenv
from typing import TypedDict

import orjson
from starlette.config import Config, undefined
from starlette.datastructures import CommaSeparatedStrings

# types


class CorsConfig(TypedDict, total=False):
    allow_origins: list[str]
    allow_methods: list[str]
    allow_headers: list[str]
    allow_credentials: bool
    allow_origin_regex: str
    expose_headers: list[str]
    max_age: int


class HttpConfig(TypedDict, total=False):
    app: str
    """Import path for a custom Starlette/FastAPI app to mount"""
    disable_assistants: bool
    """Disable /assistants routes"""
    disable_threads: bool
    """Disable /threads routes"""
    disable_runs: bool
    """Disable /runs routes"""
    disable_store: bool
    """Disable /store routes"""
    disable_meta: bool
    """Disable /ok, /info, /metrics, and /docs routes"""
    cors: CorsConfig | None


# env

env = Config()


def _parse_json(json: str | None) -> dict | None:
    if not json:
        return None
    parsed = orjson.loads(json)
    if not parsed:
        return None
    return parsed


STATS_INTERVAL_SECS = env("STATS_INTERVAL_SECS", cast=int, default=60)

# storage

DATABASE_URI = env("DATABASE_URI", cast=str, default=getenv("POSTGRES_URI", undefined))
MIGRATIONS_PATH = env("MIGRATIONS_PATH", cast=str, default="/storage/migrations")

# redis
REDIS_URI = env("REDIS_URI", cast=str)
REDIS_CLUSTER = env("REDIS_CLUSTER", cast=bool, default=False)
REDIS_MAX_CONNECTIONS = env("REDIS_MAX_CONNECTIONS", cast=int, default=500)

# server
ALLOW_PRIVATE_NETWORK = env("ALLOW_PRIVATE_NETWORK", cast=bool, default=False)
"""Only enable for langgraph dev when server is running on loopback address.

See https://developer.chrome.com/blog/private-network-access-update-2024-03
"""

HTTP_CONFIG: HttpConfig | None = env("LANGGRAPH_HTTP", cast=_parse_json, default=None)
CORS_ALLOW_ORIGINS = env("CORS_ALLOW_ORIGINS", cast=CommaSeparatedStrings, default="*")
if HTTP_CONFIG and HTTP_CONFIG.get("cors"):
    CORS_CONFIG = HTTP_CONFIG["cors"]
else:
    CORS_CONFIG: CorsConfig | None = env("CORS_CONFIG", cast=_parse_json, default=None)
"""
{
    "type": "object",
    "properties": {
        "allow_origins": {
            "type": "array",
            "items": {"type": "string"},
            "default": []
        },
        "allow_methods": {
            "type": "array", 
            "items": {"type": "string"},
            "default": ["GET"]
        },
        "allow_headers": {
            "type": "array",
            "items": {"type": "string"},
            "default": []
        },
        "allow_credentials": {
            "type": "boolean",
            "default": false
        },
        "allow_origin_regex": {
            "type": ["string", "null"],
            "default": null
        },
        "expose_headers": {
            "type": "array",
            "items": {"type": "string"},
            "default": []
        },
        "max_age": {
            "type": "integer",
            "default": 600
        }
    }
}
"""
if CORS_CONFIG is not None and CORS_ALLOW_ORIGINS != "*":
    raise ValueError("CORS_CONFIG and CORS_ALLOW_ORIGINS cannot be set together")

# queue

BG_JOB_HEARTBEAT = 120  # seconds
BG_JOB_INTERVAL = 30  # seconds

N_JOBS_PER_WORKER = env("N_JOBS_PER_WORKER", cast=int, default=10)
BG_JOB_TIMEOUT_SECS = env("BG_JOB_TIMEOUT_SECS", cast=float, default=3600)
FF_CRONS_ENABLED = env("FF_CRONS_ENABLED", cast=bool, default=True)
FF_JS_ZEROMQ_ENABLED = env("FF_JS_ZEROMQ_ENABLED", cast=bool, default=False)

# auth

LANGGRAPH_AUTH_TYPE = env("LANGGRAPH_AUTH_TYPE", cast=str, default="noop")
LANGGRAPH_AUTH = env("LANGGRAPH_AUTH", cast=_parse_json, default=None)
LANGSMITH_TENANT_ID = env("LANGSMITH_TENANT_ID", cast=str, default=None)
LANGSMITH_AUTH_VERIFY_TENANT_ID = env(
    "LANGSMITH_AUTH_VERIFY_TENANT_ID",
    cast=bool,
    default=LANGSMITH_TENANT_ID is not None,
)

if LANGGRAPH_AUTH_TYPE == "langsmith":
    LANGSMITH_AUTH_ENDPOINT = env("LANGSMITH_AUTH_ENDPOINT", cast=str)
    LANGSMITH_TENANT_ID = env("LANGSMITH_TENANT_ID", cast=str)
    LANGSMITH_AUTH_VERIFY_TENANT_ID = env(
        "LANGSMITH_AUTH_VERIFY_TENANT_ID", cast=bool, default=True
    )

else:
    LANGSMITH_AUTH_ENDPOINT = env(
        "LANGSMITH_AUTH_ENDPOINT",
        cast=str,
        default=getenv(
            "LANGCHAIN_ENDPOINT",
            getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"),
        ),
    )

# license

LANGGRAPH_CLOUD_LICENSE_KEY = env("LANGGRAPH_CLOUD_LICENSE_KEY", cast=str, default="")
LANGSMITH_API_KEY = env(
    "LANGSMITH_API_KEY", cast=str, default=getenv("LANGCHAIN_API_KEY", "")
)

# if langsmith api key is set, enable tracing unless explicitly disabled

if (
    LANGSMITH_API_KEY
    and not getenv("LANGCHAIN_TRACING_V2")
    and not getenv("LANGCHAIN_TRACING")
):
    environ["LANGCHAIN_TRACING_V2"] = "true"

# if variant is "licensed", update to "local" if using LANGSMITH_API_KEY instead

if getenv("LANGSMITH_LANGGRAPH_API_VARIANT") == "licensed" and LANGSMITH_API_KEY:
    environ["LANGSMITH_LANGGRAPH_API_VARIANT"] = "local"
