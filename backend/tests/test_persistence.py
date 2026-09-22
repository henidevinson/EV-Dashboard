import pytest
from fastapi.testclient import TestClient
from app.database.session import Base, SessionLocal, engine
from app.main import app
from app.schemas.telemetry import DecodedTelemetry
from app.services.trip_service import TripManager


@pytest.fixture(autouse=True)
def setup_test_db():
    """Drop and recreate schema cleanly for isolated test runs."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_trip_mathematical_integration():
    """Verify distance and energy integration: delta_d = v*dt, delta_E = V*I*dt."""
    manager = TripManager()
    db = SessionLocal()

    # 1. Start trip
    trip = manager.start_trip(db, initial_soc=90.0)
    assert trip.id is not None
    assert trip.is_active is True

    # 2. Simulate 10 seconds cruising at 36 km/h (10 m/s), 50V, 10A (500W)
    # Expected distance: 36 km/h * (10 / 3600) h = 0.1 km
    # Expected energy: 50V * 10A * (10 / 3600) h = 500W * 0.00277 h = 1.39 Wh
    telemetry = DecodedTelemetry(
        raw_pack_voltage=50.0,
        calibrated_pack_voltage=50.0,
        current_amperes=10.0,
        soc_percent=88.5,
        speed_kmh=36.0,
        motor_temperature_celsius=42.5,
        raw_frame_hex="A5 ...",
    )
    updated = manager.update_metrics(db, telemetry, dt=10.0)

    assert updated.distance_km == 0.1
    assert updated.energy_consumed_wh == 1.39
    assert updated.max_speed_kmh == 36.0
    assert updated.avg_speed_kmh == 36.0
    assert updated.max_motor_temp == 42.5

    # 3. End trip
    closed_trip = manager.end_trip(db)
    assert closed_trip.is_active is False
    assert closed_trip.end_time_utc is not None
    db.close()


def test_history_and_diagnostics_api_endpoints():
    with TestClient(app) as client:
        # Query historical telemetry
        res_hist = client.get("/api/history/telemetry?limit=5")
        assert res_hist.status_code == 200
        assert isinstance(res_hist.json(), list)

        # Query trips
        res_trips = client.get("/api/history/trips")
        assert res_trips.status_code == 200
        assert isinstance(res_trips.json(), list)

        # Query diagnostics
        res_faults = client.get("/api/history/diagnostics/faults")
        assert res_faults.status_code == 200
        assert isinstance(res_faults.json(), list)

        res_raw = client.get("/api/history/diagnostics/raw-frames")
        assert res_raw.status_code == 200
        assert isinstance(res_raw.json(), list)
