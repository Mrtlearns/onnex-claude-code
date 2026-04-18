"""Central structlog configuration for CMMC Compliance OS."""
from __future__ import annotations

import logging
import logging.config
import os

import structlog
from structlog.contextvars import merge_contextvars

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    level = os.getenv("LOG_LEVEL", "INFO").upper()
    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"

    shared_processors = [
        merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if dev_mode:
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "asyncpg"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


def bind_correlation_id(cid: str) -> None:
    structlog.contextvars.bind_contextvars(correlation_id=cid)
