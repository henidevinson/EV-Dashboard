import struct
from app.decoders.base import BaseTelemetryDecoder
from app.decoders.exceptions import (
    ChecksumMismatchError,
    FrameLengthError,
    InvalidHeaderError,
    ValueRangeError,
)
from app.schemas.telemetry import DecodedTelemetry


class StandardBmsDecoder(BaseTelemetryDecoder):
    """
    Decoder for Standard 13-Byte Light EV Broadcast Telemetry.
    Frame Structure: [PREAMBLE(1)][ADDR(1)][CMD(1)][LEN(1)][DATA(8)][CHECKSUM(1)]
    """

    PREAMBLE: int = 0xA5
    EXPECTED_ADDRESS: int = 0x40
    FRAME_ID_PACK_METRICS: int = 0x90
    TOTAL_FRAME_LENGTH: int = 13
    PAYLOAD_LENGTH: int = 8

    def calculate_checksum(self, frame: bytes) -> int:
        """Calculates modulo-256 sum over the first 12 bytes."""
        return sum(frame[:12]) & 0xFF

    def decode(self, raw_bytes: bytes, voltage_offset: float = 0.0) -> DecodedTelemetry:
        """
        Pure function parsing raw frame bytes into validated DecodedTelemetry.
        Raises specific TelemetryDecoderError subclasses on malformed inputs.
        """
        if len(raw_bytes) != self.TOTAL_FRAME_LENGTH:
            raise FrameLengthError(
                f"Invalid frame length: expected {self.TOTAL_FRAME_LENGTH} bytes, got {len(raw_bytes)}"
            )

        # Header Validation
        preamble = raw_bytes[0]
        address = raw_bytes[1]
        cmd_id = raw_bytes[2]
        payload_len = raw_bytes[3]

        if preamble != self.PREAMBLE:
            raise InvalidHeaderError(f"Invalid preamble byte: 0x{preamble:02X} != 0x{self.PREAMBLE:02X}")

        if address != self.EXPECTED_ADDRESS:
            raise InvalidHeaderError(f"Unexpected source address: 0x{address:02X} != 0x{self.EXPECTED_ADDRESS:02X}")

        if cmd_id != self.FRAME_ID_PACK_METRICS:
            raise InvalidHeaderError(f"Unsupported Frame ID: 0x{cmd_id:02X}")

        if payload_len != self.PAYLOAD_LENGTH:
            raise FrameLengthError(f"Invalid payload length declaration: {payload_len} != {self.PAYLOAD_LENGTH}")

        # Checksum Verification
        expected_checksum = self.calculate_checksum(raw_bytes)
        received_checksum = raw_bytes[12]
        if received_checksum != expected_checksum:
            raise ChecksumMismatchError(expected=expected_checksum, received=received_checksum)

        # Payload Decoding (Big-Endian unpack)
        payload = raw_bytes[4:12]
        raw_volts_u16, _, raw_current_u16, raw_soc_u16 = struct.unpack(">HHHH", payload)

        # Engineering Unit Conversions
        raw_pack_voltage = round(raw_volts_u16 * 0.1, 2)
        calibrated_pack_voltage = round(raw_pack_voltage + voltage_offset, 2)
        
        # Current: 30000 offset, 0.1 A/LSB (positive = discharge, negative = charge)
        current_amperes = round((raw_current_u16 - 30000) * 0.1, 2)
        
        # SOC: 0.1 %/LSB
        soc_percent = round(raw_soc_u16 * 0.1, 1)

        # Physical Plausibility Sanity Checks
        if not (0.0 <= soc_percent <= 100.0):
            raise ValueRangeError(f"State of Charge out of bounds (0-100%): {soc_percent}%")

        if raw_pack_voltage < 0.0 or raw_pack_voltage > 150.0:
            raise ValueRangeError(f"Pack voltage out of plausible range (0-150V): {raw_pack_voltage}V")

        raw_hex_representation = " ".join(f"{b:02X}" for b in raw_bytes)

        return DecodedTelemetry(
            raw_pack_voltage=raw_pack_voltage,
            calibrated_pack_voltage=calibrated_pack_voltage,
            current_amperes=current_amperes,
            soc_percent=soc_percent,
            speed_kmh=None,                       # Explicitly None: not available in Frame 0x90
            motor_rpm=None,                       # Explicitly None: not available in Frame 0x90
            motor_temperature_celsius=None,       # Explicitly None: not available in Frame 0x90
            controller_temperature_celsius=None,  # Explicitly None: not available in Frame 0x90
            fault_codes=[],
            raw_frame_hex=raw_hex_representation,
        )