from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert "health" in data


def test_health_endpoint_contract():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["read_only_safety"] is True
    # Test dynamically against active configuration
    assert data["telemetry_mode"] == settings.TELEMETRY_MODE
    assert data["stale_timeout_seconds"] == settings.TELEMETRY_FRESHNESS_TIMEOUT
    assert "timestamp_utc" in data
