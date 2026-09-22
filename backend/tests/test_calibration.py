from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app
from app.schemas.telemetry import DecodedTelemetry


def test_get_calibration():
    with TestClient(app) as client:
        res = client.get("/api/calibration/voltage")
        assert res.status_code == 200
        data = res.json()
        assert "voltage_offset" in data
        assert "calibration_formula" in data


def test_set_direct_voltage_offset():
    with TestClient(app) as client:
        # Set offset to +1.25V
        res = client.post("/api/calibration/voltage", json={"voltage_offset": 1.25})
        assert res.status_code == 200
        data = res.json()
        assert data["voltage_offset"] == 1.25
        assert settings.VOLTAGE_OFFSET == 1.25


def test_multimeter_offset_calculation():
    with TestClient(app) as client:
        state_mgr = app.state.telemetry_state
        
        # Inject live telemetry with raw voltage = 50.0V
        telemetry = DecodedTelemetry(
            raw_pack_voltage=50.0,
            calibrated_pack_voltage=50.0,
            current_amperes=0.0,
            soc_percent=80.0,
            raw_frame_hex="A5 ...",
        )
        state_mgr.record_valid_frame(telemetry, raw_bytes=b"\x00" * 13)

        # Multimeter measures 50.85V -> Expected offset = 50.85 - 50.0 = +0.85V
        res = client.post("/api/calibration/voltage", json={"multimeter_measured_voltage": 50.85})
        assert res.status_code == 200
        data = res.json()
        assert data["voltage_offset"] == 0.85
        assert data["raw_pack_voltage"] == 50.0
        assert data["calibrated_pack_voltage"] == 50.85
        assert settings.VOLTAGE_OFFSET == 0.85


def test_multimeter_calculation_fails_without_telemetry():
    with TestClient(app) as client:
        state_mgr = app.state.telemetry_state
        state_mgr.latest_telemetry = None  # Clear live telemetry

        res = client.post("/api/calibration/voltage", json={"multimeter_measured_voltage": 52.0})
        assert res.status_code == 400
        assert "no live raw telemetry" in res.json()["detail"]