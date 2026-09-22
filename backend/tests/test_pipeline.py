import time
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.telemetry import DecodedTelemetry
from app.telemetry.state import ConnectionStatus, TelemetryStateManager


def test_routes_registered():
    """Verify that required API routes are registered on the FastAPI instance."""
    registered_routes = [route.path for route in app.routes]
    assert "/api/telemetry/status" in registered_routes, f"Route missing. Registered: {registered_routes}"
    assert "/api/telemetry/latest" in registered_routes
    assert "/api/telemetry/raw" in registered_routes


def test_state_manager_transitions_and_staleness():
    state = TelemetryStateManager(freshness_timeout_seconds=0.2)
    assert state.status == ConnectionStatus.DISCONNECTED

    state.set_status(ConnectionStatus.WAITING_FOR_DATA, interface="/dev/ttyUSB0")
    assert state.status == ConnectionStatus.WAITING_FOR_DATA

    # Ingest a valid frame
    telemetry = DecodedTelemetry(
        raw_pack_voltage=52.0,
        calibrated_pack_voltage=52.0,
        current_amperes=0.0,
        soc_percent=80.0,
        fault_codes=[],
        raw_frame_hex="A5 40 90 08 01 F4 01 F4 75 30 03 E8 77",
    )
    state.record_valid_frame(telemetry, raw_bytes=b"\x00" * 13)

    assert state.status == ConnectionStatus.CONNECTED
    snapshot = state.get_snapshot()
    assert snapshot.status == ConnectionStatus.CONNECTED
    assert snapshot.is_stale is False
    assert snapshot.telemetry.soc_percent == 80.0

    # Wait for freshness timeout to expire
    time.sleep(0.25)
    snapshot_stale = state.get_snapshot()
    assert snapshot_stale.status == ConnectionStatus.DATA_STALE
    assert snapshot_stale.is_stale is True


def test_api_endpoints():
    with TestClient(app) as client:
        # 1. /api/telemetry/status
        res_status = client.get("/api/telemetry/status")
        assert res_status.status_code == 200, f"Failed with {res_status.status_code}: {res_status.text}"
        data_status = res_status.json()
        assert "status" in data_status
        assert "is_stale" in data_status
        assert "packet_rate_hz" in data_status

        # 2. /api/telemetry/latest
        res_latest = client.get("/api/telemetry/latest")
        assert res_latest.status_code == 200, f"Failed with {res_latest.status_code}: {res_latest.text}"
        data_latest = res_latest.json()
        assert "metrics" in data_latest
        assert "telemetry" in data_latest

        # 3. /api/telemetry/raw
        res_raw = client.get("/api/telemetry/raw")
        assert res_raw.status_code == 200, f"Failed with {res_raw.status_code}: {res_raw.text}"
        data_raw = res_raw.json()
        assert "frames_received" in data_raw
        assert "frames_valid" in data_raw