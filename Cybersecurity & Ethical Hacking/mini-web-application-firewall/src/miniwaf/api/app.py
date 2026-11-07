"""FastAPI application factory and middleware setup for MiniWAF API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from miniwaf.api.routes import router
from miniwaf.config.settings import get_settings


def create_app() -> FastAPI:
    """Create and configure MiniWAF administration and inspection FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Mini Web Application Firewall (MiniWAF) API",
        description=(
            "REST API control plane and diagnostic interface for MiniWAF, providing "
            "transaction inspection, OWASP CRS rule querying, real-time telemetry, "
            "and IP reputation/jail administration."
        ),
        version=settings.version,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()
