from fastapi import APIRouter, Depends, Request
from app.core.config import settings
from app.telemetry.state import ConnectionStatus, PipelineMetrics, TelemetryStateManager, TelemetryStateSnapshot
from app.schemas.telemetry import DecodedTelemetry

router = APIRouter()


def get_telemetry_state(request: Request) -> TelemetryStateManager:
    """Dependency provider returning global state manager from app state with test fallback."""
    if not hasattr(request.app.state, "telemetry_state") or request.app.state.telemetry_state is None:
        request.app.state.telemetry_state = TelemetryStateManager(
            freshness_timeout_seconds=settings.TELEMETRY_FRESHNESS_TIMEOUT
        )
    return request.app.state.telemetry_state


@router.get("/latest", response_model=TelemetryStateSnapshot)
async def get_latest_telemetry(state: TelemetryStateManager = Depends(get_telemetry_state)):
    """Returns the latest decoded telemetry model, state machine status, and metrics."""
    return state.get_snapshot()


@router.get("/status")
async def get_connection_status(state: TelemetryStateManager = Depends(get_telemetry_state)):
    """Returns the current connection state machine status and rates."""
    snapshot = state.get_snapshot()
    return {
        "status": snapshot.status,
        "interface": snapshot.active_interface,
        "is_stale": snapshot.is_stale,
        "seconds_since_last_packet": snapshot.seconds_since_last_packet,
        "packet_rate_hz": snapshot.metrics.packet_rate_hz,
        "byte_rate_bps": snapshot.metrics.byte_rate_bps,
    }


@router.get("/raw")
async def get_raw_telemetry(state: TelemetryStateManager = Depends(get_telemetry_state)):
    """Returns the latest raw byte sequence received and packet counters."""
    snapshot = state.get_snapshot()
    return {
        "latest_raw_hex": snapshot.latest_raw_hex,
        "frames_received": snapshot.metrics.frames_received,
        "frames_valid": snapshot.metrics.frames_valid,
        "frames_corrupted": snapshot.metrics.frames_corrupted,
        "frames_dropped": snapshot.metrics.frames_dropped,
    }