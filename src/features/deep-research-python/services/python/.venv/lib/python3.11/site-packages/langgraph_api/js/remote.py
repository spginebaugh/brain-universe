from langgraph_api.config import FF_JS_ZEROMQ_ENABLED

if FF_JS_ZEROMQ_ENABLED:
    from langgraph_api.js.remote_new import (  # noqa: I001
        run_js_process,  # noqa: F401
        RemotePregel,  # noqa: F401
        run_remote_checkpointer,  # noqa: F401
        wait_until_js_ready,  # noqa: F401
        js_healthcheck,  # noqa: F401
    )
else:
    from langgraph_api.js.remote_old import (  # noqa: I001
        run_js_process,  # noqa: F401
        RemotePregel,  # noqa: F401
        run_remote_checkpointer,  # noqa: F401
        wait_until_js_ready,  # noqa: F401
        js_healthcheck,  # noqa: F401
    )
