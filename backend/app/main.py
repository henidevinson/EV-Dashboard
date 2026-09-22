import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.calibration import router as calibration_router
from app.api.health import router as health_router
from app.api.history import router as history_router
from app.api.telemetry import router as telemetry_router
from app.api.websocket import router as websocket_router
from app.core.config import settings
from app.core.logging import logger
from app.database.session import init_db
from app.services.fault_engine import FaultEngine
from app.services.persistence_service import persistence_service
from app.telemetry.pipeline import TelemetryPipeline
from app.telemetry.state import TelemetryStateManager
from app.websocket.envelope import WebSocketEnvelope
from app.websocket.manager import ws_manager


async def telemetry_broadcaster_task(app: FastAPI):
    """Broadcasts updates at 10 Hz and invokes persistence engine."""
    fault_engine = FaultEngine()
    logger.info("[BROADCASTER] Real-time 10 Hz broadcast task started.")

    while True:
        try:
            await asyncio.sleep(0.1)  # 100ms interval -> 10 Hz

            state: TelemetryStateManager = getattr(app.state, "telemetry_state", None)
            if not state:
                continue

            snapshot = state.get_snapshot()

            # Evaluate physical & logical safety faults
            faults = fault_engine.evaluate(
                telemetry=snapshot.telemetry,
                connection_status=snapshot.status,
                is_stale=snapshot.is_stale,
            )

            # Persist downsampled telemetry (1 Hz) and fault incidents
            persistence_service.process_telemetry(snapshot.telemetry, faults)

            # Broadcast over WebSocket if clients are active
            if ws_manager.client_count > 0:
                envelope = WebSocketEnvelope(
                    type="telemetry",
                    data={
                        "status": snapshot.status,
                        "is_stale": snapshot.is_stale,
                        "seconds_since_last_packet": snapshot.seconds_since_last_packet,
                        "interface": snapshot.active_interface,
                        "metrics": snapshot.metrics.model_dump(),
                        "telemetry": snapshot.telemetry.model_dump() if snapshot.telemetry else None,
                        "faults": [f.model_dump() for f in faults],
                    },
                )
                await ws_manager.broadcast(envelope)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("[BROADCASTER] Exception in broadcast loop: %s", e)
            await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages background telemetry pipeline, database setup, and broadcaster."""
    logger.info("Starting %s", settings.PROJECT_NAME)
    logger.info("Telemetry Mode: %s", settings.TELEMETRY_MODE)
    logger.info("Read-Only Enforcement: %s", settings.READ_ONLY_MODE)

    if not settings.READ_ONLY_MODE:
        logger.critical("SAFETY VIOLATION: READ_ONLY_MODE IS DISABLED! ABORTING.")
        raise RuntimeError("System must run strictly in READ_ONLY_MODE.")

    # Initialize Database Tables
    init_db()

    # Initialize state manager and background pipeline
    state_manager = TelemetryStateManager(freshness_timeout_seconds=settings.TELEMETRY_FRESHNESS_TIMEOUT)
    pipeline = TelemetryPipeline(state_manager=state_manager)

    app.state.telemetry_state = state_manager
    app.state.telemetry_pipeline = pipeline

    # Start ingestion pipeline and broadcaster tasks
    await pipeline.start()
    broadcaster = asyncio.create_task(telemetry_broadcaster_task(app), name="ws_broadcaster")

    yield

    # Graceful shutdown
    logger.info("Stopping telemetry background tasks...")
    broadcaster.cancel()
    try:
        await broadcaster
    except asyncio.CancelledError:
        pass

    await pipeline.stop()
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Attach API endpoints
app.include_router(health_router, prefix="/api", tags=["System Health"])
app.include_router(telemetry_router, prefix="/api/telemetry", tags=["Telemetry Pipeline"])
app.include_router(calibration_router, prefix="/api/calibration", tags=["Calibration"])
app.include_router(history_router, prefix="/api/history", tags=["History & Diagnostics"])
app.include_router(websocket_router, tags=["Real-time Streaming"])


@app.get("/")
async def root():
    return {
        "system": settings.PROJECT_NAME,
        "status": "OPERATIONAL",
        "docs": "/docs",
        "health": "/api/health",
        "telemetry": "/api/telemetry/latest",
        "calibration": "/api/calibration/voltage",
        "history": "/api/history/telemetry",
        "trips": "/api/history/trips",
        "websocket": "/ws/telemetry",
    }