from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.telemetry import DecodedTelemetry


class BaseTelemetryDecoder(ABC):
    """Abstract pure interface for protocol decoders."""

    @abstractmethod
    def decode(self, raw_bytes: bytes, voltage_offset: float = 0.0) -> Optional[DecodedTelemetry]:
        """
        Decodes raw bytes into a validated, normalized DecodedTelemetry model.
        Must be implemented as a pure function with no side effects.
        """
        pass