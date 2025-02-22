"""Middleware for license validation."""

from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class LicenseValidationMiddleware(BaseHTTPMiddleware):
    """Noop license middleware"""

    def __init__(self, app: ASGIApp):
        """Initialize middleware."""
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Noop middleware."""
        response = await call_next(request)
        return response
