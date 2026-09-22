import pytest
from app.schemas.telemetry import DecodedTelemetry
from app.services.fault_engine import FaultCode, FaultEngine, FaultSeverity
from app.telemetry.state import ConnectionStatus


@pytest.fixture
def fault_engine():
    return FaultEngine()


def make_telemetry(
    voltage: float = 52.0,
    current: float = 5.0,
    motor_temp: float = 40.0,
    controller_temp: float = 35.0,
) -> DecodedTelemetry:
    return DecodedTelemetry(
        raw_pack_voltage=voltage,
        calibrated_pack_voltage=voltage,
        current_amperes=current,
        soc_percent=80.0,
        motor_temperature_celsius=motor_temp,
        controller_temperature_celsius=controller_temp,
        fault_codes=[],
        raw_frame_hex="A5 40 ...",
    )


def test_nominal_telemetry_has_no_faults(fault_engine: FaultEngine):
    telemetry = make_telemetry()
    faults = fault_engine.evaluate(telemetry, ConnectionStatus.CONNECTED, is_stale=False)
    assert len(faults) == 0


def test_over_voltage_fault(fault_engine: FaultEngine):
    # Over 58.8V trip point
    telemetry = make_telemetry(voltage=60.2)
    faults = fault_engine.evaluate(telemetry, ConnectionStatus.CONNECTED, is_stale=False)
    
    codes = [f.code for f in faults]
    assert FaultCode.OVER_VOLTAGE in codes
    ov_fault = next(f for f in faults if f.code == FaultCode.OVER_VOLTAGE)
    assert ov_fault.severity == FaultSeverity.CRITICAL


def test_under_voltage_fault(fault_engine: FaultEngine):
    # Under 42.0V trip point
    telemetry = make_telemetry(voltage=40.5)
    faults = fault_engine.evaluate(telemetry, ConnectionStatus.CONNECTED, is_stale=False)
    
    codes = [f.code for f in faults]
    assert FaultCode.UNDER_VOLTAGE in codes


def test_high_discharge_and_regen_limits(fault_engine: FaultEngine):
    # Discharge > 45A
    discharge_telemetry = make_telemetry(current=52.0)
    faults_d = fault_engine.evaluate(discharge_telemetry, ConnectionStatus.CONNECTED, is_stale=False)
    assert FaultCode.HIGH_DISCHARGE_CURRENT in [f.code for f in faults_d]

    # Regen charging > 20A (represented as current < -20.0A)
    regen_telemetry = make_telemetry(current=-25.0)
    faults_r = fault_engine.evaluate(regen_telemetry, ConnectionStatus.CONNECTED, is_stale=False)
    assert FaultCode.HIGH_CHARGE_CURRENT in [f.code for f in faults_r]


def test_thermal_limits(fault_engine: FaultEngine):
    # Motor > 85C, Controller > 75C
    hot_telemetry = make_telemetry(motor_temp=91.0, controller_temp=82.0)
    faults = fault_engine.evaluate(hot_telemetry, ConnectionStatus.CONNECTED, is_stale=False)

    codes = [f.code for f in faults]
    assert FaultCode.MOTOR_OVERTEMP in codes
    assert FaultCode.CONTROLLER_OVERTEMP in codes


def test_communication_loss_and_staleness(fault_engine: FaultEngine):
    # Communication offline
    offline_faults = fault_engine.evaluate(None, ConnectionStatus.OFFLINE, is_stale=True)
    codes = [f.code for f in offline_faults]
    assert FaultCode.COMMUNICATION_LOST in codes

    # Stale signal during active connection
    telemetry = make_telemetry()
    stale_faults = fault_engine.evaluate(telemetry, ConnectionStatus.CONNECTED, is_stale=True)
    assert FaultCode.DATA_STALE in [f.code for f in stale_faults]