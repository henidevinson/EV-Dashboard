import asyncio
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect
from app.core.logging import logger
from app.websocket.envelope import WebSocketEnvelope


class WebSocketManager:
    """Thread-safe connection manager for streaming dashboard clients."""

    def __init__(self):
        self._active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def client_count(self) -> int:
        return len(self._active_connections)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._active_connections.add(websocket)
        logger.info("[WS] Client connected. Total active sessions: %d", self.client_count)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self._active_connections.discard(websocket)
        logger.info("[WS] Client disconnected. Total active sessions: %d", self.client_count)

    async def broadcast(self, envelope: WebSocketEnvelope):
        """Dispatches an event envelope to all connected clients."""
        if not self._active_connections:
            return

        payload = envelope.to_json()
        dead_connections: Set[WebSocket] = set()

        async with self._lock:
            for ws in self._active_connections:
                try:
                    await ws.send_text(payload)
                except (WebSocketDisconnect, RuntimeError):
                    dead_connections.add(ws)
                except Exception as err:
                    logger.warning("[WS] Error sending packet to client: %s", err)
                    dead_connections.add(ws)

            # Purge dead sessions
            if dead_connections:
                self._active_connections.difference_update(dead_connections)


ws_manager = WebSocketManager()