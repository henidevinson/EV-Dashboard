from typing import List, Tuple


class StreamSynchronizer:
    """
    Stream buffer synchronizer for fixed-length EV serial frames.
    Extracts complete, aligned frames from fragmented byte chunks.
    """

    def __init__(
        self,
        frame_length: int = 13,
        preamble: bytes = bytes([0xA5, 0x40]),
        max_buffer_size: int = 2048,
    ):
        self.frame_length = frame_length
        self.preamble = preamble
        self.max_buffer_size = max_buffer_size
        self._buffer = bytearray()

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    def append(self, chunk: bytes):
        """Appends newly arrived bytes into the synchronizer buffer."""
        self._buffer.extend(chunk)
        if len(self._buffer) > self.max_buffer_size:
            # Prevent memory overflow on continuous unaligned garbage
            excess = len(self._buffer) - self.max_buffer_size
            del self._buffer[:excess]

    def extract_frames(self) -> Tuple[List[bytes], int]:
        """
        Scans buffer, aligns to preamble, and extracts candidate frames.
        Returns:
            frames: List of byte slices, each of length `self.frame_length`.
            dropped_bytes: Count of noise/misaligned bytes discarded.
        """
        frames: List[bytes] = []
        dropped_bytes = 0

        while True:
            # Need at least frame_length bytes to inspect a complete frame
            if len(self._buffer) < self.frame_length:
                break

            # Search for preamble sequence
            preamble_index = self._buffer.find(self.preamble)

            if preamble_index == -1:
                # No preamble found anywhere in buffer
                # Preserve the last byte in case it is the first byte of the preamble
                discard_len = max(0, len(self._buffer) - 1)
                dropped_bytes += discard_len
                del self._buffer[:discard_len]
                break

            if preamble_index > 0:
                # Discard preceding garbage noise before preamble
                dropped_bytes += preamble_index
                del self._buffer[:preamble_index]

            # Re-check length after discarding prefix noise
            if len(self._buffer) < self.frame_length:
                break

            # Slices candidate frame
            candidate_frame = bytes(self._buffer[:self.frame_length])
            frames.append(candidate_frame)
            
            # Advance past candidate frame
            del self._buffer[:self.frame_length]

        return frames, dropped_bytes

    def reset(self):
        """Clears the synchronizer buffer."""
        self._buffer.clear()