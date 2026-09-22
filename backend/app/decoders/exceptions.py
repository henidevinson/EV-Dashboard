class TelemetryDecoderError(Exception):
    """Base exception for all decoder errors."""
    pass


class FrameLengthError(TelemetryDecoderError):
    """Raised when frame byte length does not match protocol specification."""
    pass


class InvalidHeaderError(TelemetryDecoderError):
    """Raised when start bytes or address identifiers do not match."""
    pass


class ChecksumMismatchError(TelemetryDecoderError):
    """Raised when computed frame checksum does not match received checksum."""
    def __init__(self, expected: int, received: int):
        super().__init__(f"Checksum mismatch: expected 0x{expected:02X}, received 0x{received:02X}")
        self.expected = expected
        self.received = received


class ValueRangeError(TelemetryDecoderError):
    """Raised when a decoded physical value is outside physical plausibility boundaries."""
    pass