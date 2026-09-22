from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logging import logger
from app.websocket.envelope import WebSocketEnvelope
from app.websocket.manager import ws_manager

router = APIRouter()


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Real-time streaming telemetry channel.
    Clients receive continuous 10 Hz state updates and fault alarms.
    Incoming messages are restricted to heartbeat ping responses (strictly read-only).
    """
    await ws_manager.connect(websocket)

    # Transmit immediate initial state snapshot on connection
    state_manager = getattr(websocket.app.state, "telemetry_state", None)
    if state_manager:
        snapshot = state_manager.get_snapshot()
        welcome_envelope = WebSocketEnvelope(
            type="status",
            data={
                "status": snapshot.status,
                "interface": snapshot.active_interface,
                "is_stale": snapshot.is_stale,
            },
        )
        await websocket.send_text(welcome_envelope.to_json())

    try:
        while True:
            # Listen for client ping / heartbeat messages
            message = await websocket.receive_text()
            if message == "ping":
                pong_envelope = WebSocketEnvelope(type="heartbeat", data={"reply": "pong"})
                await websocket.send_text(pong_envelope.to_json())
            else:
                # Disallow arbitrary write or control commands
                error_envelope = WebSocketEnvelope(
                    type="status",
                    data={"warning": "Read-only server. Control commands rejected."},
                )
                await websocket.send_text(error_envelope.to_json())

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as err:
        logger.error("[WS] Connection exception: %s", err)
        await ws_manager.disconnect(websocket)