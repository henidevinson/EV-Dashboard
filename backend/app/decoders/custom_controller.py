import struct
from typing import Optional
from app.decoders.base import BaseTelemetryDecoder
from app.decoders.exceptions import (
    ChecksumMismatchError,
    FrameLengthError,
    InvalidHeaderError,
    ValueRangeError,
)
from app.schemas.telemetry import DecodedTelemetry


class CustomControllerDecoder(BaseTelemetryDecoder):
    """
    Decoder for a 10-byte custom controller stream:
    [0x3A][VOLT_2B][CURR_2B][SPEED_2B][CTRL_TEMP_1B][MOT_TEMP_1B][CHECKSUM_1B]
    """
    HEADER_BYTE: int = 0x3A
    FRAME_LENGTH: int = 10

    def decode(self, raw_bytes: bytes, voltage_offset: float = 0.0) -> DecodedTelemetry:
        if len(raw_bytes) != self.FRAME_LENGTH:
            raise FrameLengthError(f"Expected {self.FRAME_LENGTH} bytes, got {len(raw_bytes)}")

        # 1. Header Validation
        if raw_bytes[0] != self.HEADER_BYTE:
            raise InvalidHeaderError(f"Invalid header: 0x{raw_bytes[0]:02X} != 0x{self.HEADER_BYTE:02X}")

        # 2. Checksum Verification (Sum of first 9 bytes modulo 256)
        expected_chk = sum(raw_bytes[:9]) & 0xFF
        received_chk = raw_bytes[9]
        if received_chk != expected_chk:
            raise ChecksumMismatchError(expected=expected_chk, received=received_chk)

        # 3. Unpack Fields (Big-Endian)
        # > H (uint16), h (int16), H (uint16), b (int8), b (int8)
        raw_volts_u16, raw_curr_i16, raw_speed_u16, ctrl_temp_i8, mot_temp_i8 = struct.unpack(
            ">HhHbb", raw_bytes[1:9]
        )

        # 4. Apply Scaling Factors
        raw_voltage = round(raw_volts_u16 * 0.1, 2)
        calibrated_voltage = round(raw_voltage + voltage_offset, 2)
        current_amps = round(raw_curr_i16 * 0.1, 2)
        speed_kmh = round(raw_speed_u16 * 0.1, 1)

        # Rough SOC estimate from voltage curve if pack is 52V (14S Li-ion)
        # 42.0V = 0%, 58.8V = 100%
        soc_estimate = max(0.0, min(100.0, ((calibrated_voltage - 42.0) / (58.8 - 42.0)) * 100.0))

        raw_hex = " ".join(f"{b:02X}" for b in raw_bytes)

        # 5. Return the Normalized Schema
        return DecodedTelemetry(
            raw_pack_voltage=raw_voltage,
            calibrated_pack_voltage=calibrated_voltage,
            current_amperes=current_amps,
            soc_percent=round(soc_estimate, 1),
            speed_kmh=speed_kmh,
            motor_rpm=int((speed_kmh * 1000.0 / 60.0) / 0.8),  # 10" wheel circumference ~0.8m
            motor_temperature_celsius=float(mot_temp_i8),
            controller_temperature_celsius=float(ctrl_temp_i8),
            fault_codes=[],
            raw_frame_hex=raw_hex,
            is_mock=False,
            data_source="REAL",
        )