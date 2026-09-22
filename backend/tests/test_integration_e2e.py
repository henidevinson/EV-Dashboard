import json
import pytest
from fastapi.testclient import TestClient
from app.database.models import TelemetryRecord, Trip
from app.database.session import SessionLocal, init_db
from app.decoders.standard_bms import StandardBmsDecoder
from app.main import app
from app.services.fault_engine import FaultCode, FaultEngine
from app.services.persistence_service import persistence_service
from app.services.trip_service import trip_manager
from app.telemetry.framing import StreamSynchronizer
from app.telemetry.state import ConnectionStatus, TelemetryStateManager
from app.websocket.envelope import WebSocketEnvelope


def test_full_stack_telemetry_pipeline_e2e():
    init_db()
    db = SessionLocal()

    # 1. Initialize Pipeline Subsystems
    synchronizer = StreamSynchronizer(frame_length=13, preamble=bytes([0xA5, 0x40]))
    decoder = StandardBmsDecoder()
    state_mgr = TelemetryStateManager(freshness_timeout_seconds=2.0)
    fault_engine = FaultEngine()

    # 2. Simulate raw frame arriving from serial port
    # 520 -> 52.0V, 30150 -> 15.0A discharge, 800 -> 80.0% SOC
    raw_volts = 520
    raw_curr = 30150
    raw_soc = 800
    first_12 = (
        bytes([0xA5, 0x40, 0x90, 0x08])
        + raw_volts.to_bytes(2, "big")
        + raw_volts.to_bytes(2, "big")
        + raw_curr.to_bytes(2, "big")
        + raw_soc.to_bytes(2, "big")
    )
    chk = sum(first_12) & 0xFF
    raw_packet = first_12 + bytes([chk])

    # 3. Framing Slicer
    synchronizer.append(raw_packet)
    extracted_frames, dropped = synchronizer.extract_frames()
    assert len(extracted_frames) == 1
    assert dropped == 0

    # 4. Decoder Execution
    telemetry = decoder.decode(extracted_frames[0], voltage_offset=0.5)
    assert telemetry.raw_pack_voltage == 52.0
    assert telemetry.calibrated_pack_voltage == 52.5
    assert telemetry.current_amperes == 15.0
    assert telemetry.soc_percent == 80.0

    # Attach speed for trip kinematics
    telemetry_with_speed = telemetry.model_copy(update={"speed_kmh": 45.0})

    # 5. State Store Update
    state_mgr.record_valid_frame(telemetry_with_speed, raw_packet)
    assert state_mgr.status == ConnectionStatus.CONNECTED
    snapshot = state_mgr.get_snapshot()
    assert snapshot.is_stale is False

    # 6. Fault Rules Evaluation
    faults = fault_engine.evaluate(telemetry_with_speed, snapshot.status, snapshot.is_stale)
    assert len(faults) == 0  # Nominal operation, no fault

    # 7. Persistence & Trip Engine Integration
    persistence_service.process_telemetry(telemetry_with_speed, faults)
    # Give trip manager a 2-second time delta at 45 km/h
    trip = trip_manager.update_metrics(db, telemetry_with_speed, dt=2.0)
    assert trip is not None
    assert trip.distance_km > 0.0
    assert trip.energy_consumed_wh > 0.0

    # 8. Database Query Verification
    saved_record = db.query(TelemetryRecord).order_by(TelemetryRecord.id.desc()).first()
    assert saved_record is not None
    assert saved_record.calibrated_pack_voltage == 52.5

    # 9. WebSocket Serialization Verification
    envelope = WebSocketEnvelope(
        type="telemetry",
        data={
            "status": snapshot.status,
            "telemetry": snapshot.telemetry.model_dump(),
            "faults": [f.model_dump() for f in faults],
        },
    )
    json_str = envelope.to_json()
    parsed_json = json.loads(json_str)
    assert parsed_json["type"] == "telemetry"
    assert parsed_json["data"]["telemetry"]["calibrated_pack_voltage"] == 52.5

    db.close()


def test_full_system_api_readiness():
    """Verify all REST and WebSocket contracts respond under TestClient."""
    with TestClient(app) as client:
        # System Health
        res_health = client.get("/api/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "ONLINE"
        assert res_health.json()["read_only_safety"] is True

        # Telemetry Status
        res_status = client.get("/api/telemetry/status")
        assert res_status.status_code == 200

        # Calibration
        res_cal = client.get("/api/calibration/voltage")
        assert res_cal.status_code == 200

        # Diagnostics & Trips
        res_trips = client.get("/api/history/trips")
        assert res_trips.status_code == 200