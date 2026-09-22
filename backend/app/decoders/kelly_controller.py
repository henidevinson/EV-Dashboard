from app.decoders.base import BaseTelemetryDecoder
from app.schemas.telemetry import DecodedTelemetry

class CustomControllerDecoder(BaseTelemetryDecoder):
    def decode(self, raw_bytes: bytes, voltage_offset: float = 0.0) -> DecodedTelemetry:
        # 1. Unpack controller-specific byte offsets
        # 2. Apply scaling factors
        # 3. Return normalized DecodedTelemetry
        ...