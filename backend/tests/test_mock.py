import pytest
from app.decoders.standard_bms import StandardBmsDecoder
from app.telemetry.mock_generator import DynamicEVPhysics, MockScenario, MockTelemetryGenerator


def test_mock_physics_state_transitions():
    physics = DynamicEVPhysics(nominal_voltage=52.0)
    
    # 1. Resting state initial check
    physics.update(dt=1.0, scenario=MockScenario.NORMAL)
    assert physics.speed_kmh == 0.0
    assert physics.current_a == 0.2
    assert physics.pack_voltage > 45.0

    # 2. Simulate forward into Acceleration phase (at t = 6s)
    for _ in range(6):
        physics.update(dt=1.0, scenario=MockScenario.NORMAL)
    assert physics.speed_kmh > 0.0
    assert physics.current_a > 10.0  # High motor discharge current
    assert physics.voltage_sag < 0.0  # Demonstrates pack voltage sag


def test_mock_fault_scenarios():
    physics = DynamicEVPhysics()
    
    # Overvoltage fault test
    physics.update(dt=1.0, scenario=MockScenario.FAULT_OVERVOLT)
    assert "ERR_OVER_VOLTAGE" in physics.faults

    # Undervoltage fault test
    physics.update(dt=1.0, scenario=MockScenario.FAULT_UNDERVOLT)
    assert "ERR_UNDER_VOLTAGE" in physics.faults
    assert physics.soc <= 5.0

    # Overtemperature test
    physics.update(dt=1.0, scenario=MockScenario.FAULT_OVERTEMP)
    assert "ERR_MOTOR_OVERTEMP" in physics.faults
    assert physics.motor_temp > 80.0


def test_mock_raw_frame_decodable_by_standard_bms():
    generator = MockTelemetryGenerator(scenario=MockScenario.NORMAL)
    decoder = StandardBmsDecoder()

    # Generate synthetic raw protocol bytes
    raw_frame = generator.generate_raw_frame()

    # Verify byte constraints
    assert len(raw_frame) == 13
    assert raw_frame[0] == 0xA5
    assert raw_frame[1] == 0x40
    assert raw_frame[2] == 0x90
    assert raw_frame[3] == 0x08

    # Pass through production decoder
    decoded = decoder.decode(raw_frame)
    assert decoded is not None
    assert decoded.raw_pack_voltage > 40.0
    assert 0.0 <= decoded.soc_percent <= 100.0


def test_mock_provenance_flags_enforced():
    generator = MockTelemetryGenerator()
    telemetry = generator.generate_telemetry_model()

    # Strict provenance assertion: mock data must always be tagged
    assert telemetry.is_mock is True
    assert telemetry.data_source == "MOCK"