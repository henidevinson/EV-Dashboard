import pytest
from app.decoders.exceptions import (
    ChecksumMismatchError,
    FrameLengthError,
    InvalidHeaderError,
    ValueRangeError,
)
from app.decoders.standard_bms import StandardBmsDecoder


@pytest.fixture
def decoder() -> StandardBmsDecoder:
    return StandardBmsDecoder()


def build_test_frame(raw_volts: int, raw_curr: int, raw_soc: int) -> bytes:
    """Helper to build a valid 13-byte standard packet with a dynamically calculated checksum."""
    header = bytes([0xA5, 0x40, 0x90, 0x08])
    payload = (
        raw_volts.to_bytes(2, byteorder="big")
        + raw_volts.to_bytes(2, byteorder="big")  # acquisition tap voltage
        + raw_curr.to_bytes(2, byteorder="big")
        + raw_soc.to_bytes(2, byteorder="big")
    )
    first_12 = header + payload
    checksum = sum(first_12) & 0xFF
    return first_12 + bytes([checksum])


def test_valid_frame_decoding_nominal(decoder: StandardBmsDecoder):
    # 520 = 52.0V, 30000 = 0.0A (idle), 850 = 85.0% SOC
    frame = build_test_frame(raw_volts=520, raw_curr=30000, raw_soc=850)
    result = decoder.decode(frame, voltage_offset=0.0)

    assert result.raw_pack_voltage == 52.0
    assert result.calibrated_pack_voltage == 52.0
    assert result.current_amperes == 0.0
    assert result.soc_percent == 85.0
    assert result.speed_kmh is None
    assert result.motor_rpm is None
    assert result.motor_temperature_celsius is None
    assert result.controller_temperature_celsius is None
    assert result.fault_codes == []


def test_voltage_calibration_offset(decoder: StandardBmsDecoder):
    # 480 = 48.0V. Calibration offset = +0.75V -> Calibrated = 48.75V
    frame = build_test_frame(raw_volts=480, raw_curr=30000, raw_soc=500)
    result = decoder.decode(frame, voltage_offset=0.75)

    assert result.raw_pack_voltage == 48.0
    assert result.calibrated_pack_voltage == 48.75


def test_current_discharge_and_charge(decoder: StandardBmsDecoder):
    # Discharge: 30150 -> (30150 - 30000) * 0.1 = +15.0 A
    discharge_frame = build_test_frame(raw_volts=500, raw_curr=30150, raw_soc=900)
    discharge_result = decoder.decode(discharge_frame)
    assert discharge_result.current_amperes == 15.0

    # Charge/Regen: 29800 -> (29800 - 30000) * 0.1 = -20.0 A
    charge_frame = build_test_frame(raw_volts=500, raw_curr=29800, raw_soc=900)
    charge_result = decoder.decode(charge_frame)
    assert charge_result.current_amperes == -20.0


def test_corrupted_checksum_rejection(decoder: StandardBmsDecoder):
    valid_frame = build_test_frame(raw_volts=520, raw_curr=30000, raw_soc=850)
    # Tamper with the checksum byte at index 12
    corrupted_frame = valid_frame[:12] + bytes([(valid_frame[12] ^ 0xFF)])

    with pytest.raises(ChecksumMismatchError) as exc_info:
        decoder.decode(corrupted_frame)
    assert "Checksum mismatch" in str(exc_info.value)


def test_truncated_frame_rejection(decoder: StandardBmsDecoder):
    valid_frame = build_test_frame(raw_volts=520, raw_curr=30000, raw_soc=850)
    truncated = valid_frame[:10]  # Only 10 bytes instead of 13

    with pytest.raises(FrameLengthError):
        decoder.decode(truncated)


def test_invalid_preamble_rejection(decoder: StandardBmsDecoder):
    valid_frame = build_test_frame(raw_volts=520, raw_curr=30000, raw_soc=850)
    # Invalidate start byte
    invalid_header = bytes([0x00]) + valid_frame[1:]

    with pytest.raises(InvalidHeaderError):
        decoder.decode(invalid_header)


def test_out_of_range_soc_rejection(decoder: StandardBmsDecoder):
    # SOC: 1050 = 105.0% (> 100% threshold)
    invalid_soc_frame = build_test_frame(raw_volts=520, raw_curr=30000, raw_soc=1050)

    with pytest.raises(ValueRangeError) as exc_info:
        decoder.decode(invalid_soc_frame)
    assert "State of Charge out of bounds" in str(exc_info.value)