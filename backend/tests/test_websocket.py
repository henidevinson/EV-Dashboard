import json
from fastapi.testclient import TestClient
from app.main import app


def test_websocket_connection_and_heartbeat():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/telemetry") as websocket:
            # 1. Verify initial status envelope on connect
            initial_msg = websocket.receive_text()
            data = json.loads(initial_msg)
            assert data["type"] == "status"
            assert "status" in data["data"]

            # 2. Test ping-pong heartbeat
            websocket.send_text("ping")
            pong_msg = websocket.receive_text()
            pong_data = json.loads(pong_msg)
            assert pong_data["type"] == "heartbeat"
            assert pong_data["data"]["reply"] == "pong"


def test_websocket_rejects_control_commands():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/telemetry") as websocket:
            # Discard initial status envelope
            websocket.receive_text()

            # Attempt prohibited control message
            websocket.send_text("SET_THROTTLE:50")
            response = json.loads(websocket.receive_text())
            assert response["type"] == "status"
            assert "warning" in response["data"]
            assert "Read-only" in response["data"]["warning"]