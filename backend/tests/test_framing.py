import pytest
from app.telemetry.framing import StreamSynchronizer


def build_raw_frame(marker: int = 0x90) -> bytes:
    """Constructs a 13-byte frame matching the [0xA5 0x40 marker ...] signature."""
    first_12 = bytes([0xA5, 0x40, marker, 0x08, 0x01, 0xF4, 0x01, 0xF4, 0x75, 0x30, 0x03, 0xE8])
    checksum = sum(first_12) & 0xFF
    return first_12 + bytes([checksum])


def test_clean_single_frame_extraction():
    sync = StreamSynchronizer(frame_length=13, preamble=bytes([0xA5, 0x40]))
    frame = build_raw_frame()
    sync.append(frame)

    extracted, dropped = sync.extract_frames()
    assert len(extracted) == 1
    assert extracted[0] == frame
    assert dropped == 0
    assert sync.buffer_size == 0


def test_split_chunk_assembly():
    sync = StreamSynchronizer(frame_length=13, preamble=bytes([0xA5, 0x40]))
    frame = build_raw_frame()

    # Split frame into two separate arrivals
    chunk1 = frame[:7]
    chunk2 = frame[7:]

    sync.append(chunk1)
    extracted, dropped = sync.extract_frames()
    assert len(extracted) == 0  # Not enough bytes yet
    assert sync.buffer_size == 7

    sync.append(chunk2)
    extracted, dropped = sync.extract_frames()
    assert len(extracted) == 1
    assert extracted[0] == frame
    assert dropped == 0
    assert sync.buffer_size == 0


def test_preamble_alignment_with_leading_noise():
    sync = StreamSynchronizer(frame_length=13, preamble=bytes([0xA5, 0x40]))
    frame = build_raw_frame()
    noise = bytes([0xFF, 0x00, 0xAA, 0x12, 0x34])  # 5 bytes of garbage

    sync.append(noise + frame)
    extracted, dropped = sync.extract_frames()

    assert len(extracted) == 1
    assert extracted[0] == frame
    assert dropped == 5  # Exactly 5 noise bytes discarded


def test_multiple_concatenated_frames():
    sync = StreamSynchronizer(frame_length=13, preamble=bytes([0xA5, 0x40]))
    f1 = build_raw_frame(marker=0x90)
    f2 = build_raw_frame(marker=0x90)

    sync.append(f1 + f2)
    extracted, dropped = sync.extract_frames()

    assert len(extracted) == 2
    assert extracted[0] == f1
    assert extracted[1] == f2
    assert dropped == 0