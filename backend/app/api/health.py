from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp_utc: str
    telemetry_mode: str
    read_only_safety: bool
    stale_timeout_seconds: float


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Health check endpoint exposing system readiness and safety enforcement."""
    return HealthResponse(
        status="ONLINE",
        service=settings.PROJECT_NAME,
        version="0.1.0",
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        telemetry_mode=settings.TELEMETRY_MODE,
        read_only_safety=settings.READ_ONLY_MODE,
        stale_timeout_seconds=settings.TELEMETRY_FRESHNESS_TIMEOUT,
    )