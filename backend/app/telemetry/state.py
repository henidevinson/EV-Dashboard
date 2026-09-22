import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from app.schemas.telemetry import DecodedTelemetry


class ConnectionStatus(str, Enum):
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    WAITING_FOR_DATA = "WAITING_FOR_DATA"
    CONNECTED = "CONNECTED"
    DATA_STALE = "DATA_STALE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"


class PipelineMetrics(BaseModel):
    bytes_received: int = 0
    frames_received: int = 0
    frames_valid: int = 0
    frames_corrupted: int = 0
    frames_dropped: int = 0
    packet_rate_hz: float = 0.0
    byte_rate_bps: float = 0.0


class TelemetryStateSnapshot(BaseModel):
    status: ConnectionStatus
    last_packet_time_utc: Optional[str] = None
    seconds_since_last_packet: Optional[float] = None
    is_stale: bool = True
    telemetry: Optional[DecodedTelemetry] = None
    latest_raw_hex: Optional[str] = None
    metrics: PipelineMetrics
    active_interface: str


class TelemetryStateManager:
    """Thread-safe state store for live vehicle telemetry and pipeline health."""

    def __init__(self, freshness_timeout_seconds: float = 5.0):
        self.freshness_timeout = freshness_timeout_seconds
        self.status = ConnectionStatus.DISCONNECTED
        self.active_interface: str = "none"
        self.latest_telemetry: Optional[DecodedTelemetry] = None
        self.latest_raw_hex: Optional[str] = None
        self.last_packet_timestamp: Optional[float] = None
        self.last_packet_datetime: Optional[datetime] = None
        
        # Pipeline Counters
        self.bytes_received: int = 0
        self.frames_received: int = 0
        self.frames_valid: int = 0
        self.frames_corrupted: int = 0
        self.frames_dropped: int = 0

        # Rate Calculation Windows
        self._last_rate_calc_time = time.monotonic()
        self._recent_bytes = 0
        self._recent_frames = 0
        self.current_hz: float = 0.0
        self.current_bps: float = 0.0

    def set_status(self, status: ConnectionStatus, interface: Optional[str] = None):
        self.status = status
        if interface is not None:
            self.active_interface = interface

    def record_bytes(self, count: int):
        self.bytes_received += count
        self._recent_bytes += count
        self._evaluate_rates()

    def record_valid_frame(self, telemetry: DecodedTelemetry, raw_bytes: bytes):
        now_mono = time.monotonic()
        self.last_packet_timestamp = now_mono
        self.last_packet_datetime = datetime.now(timezone.utc)
        self.latest_telemetry = telemetry
        self.latest_raw_hex = " ".join(f"{b:02X}" for b in raw_bytes)
        self.frames_received += 1
        self.frames_valid += 1
        self._recent_frames += 1
        self.status = ConnectionStatus.CONNECTED
        self._evaluate_rates()

    def record_corrupted_frame(self, raw_bytes: bytes):
        self.frames_received += 1
        self.frames_corrupted += 1
        self.latest_raw_hex = " ".join(f"{b:02X}" for b in raw_bytes)

    def record_dropped_bytes(self, count: int):
        self.frames_dropped += count

    def check_staleness(self) -> bool:
        """Evaluates whether the connection has transitioned to DATA_STALE."""
        if self.status != ConnectionStatus.CONNECTED:
            return self.status == ConnectionStatus.DATA_STALE

        if self.last_packet_timestamp is None:
            self.status = ConnectionStatus.WAITING_FOR_DATA
            return False

        elapsed = time.monotonic() - self.last_packet_timestamp
        if elapsed > self.freshness_timeout:
            self.status = ConnectionStatus.DATA_STALE
            return True
        return False

    def _evaluate_rates(self):
        now = time.monotonic()
        elapsed = now - self._last_rate_calc_time
        if elapsed >= 1.0:
            self.current_hz = round(self._recent_frames / elapsed, 2)
            self.current_bps = round(self._recent_bytes / elapsed, 2)
            self._recent_frames = 0
            self._recent_bytes = 0
            self._last_rate_calc_time = now

    def get_snapshot(self) -> TelemetryStateSnapshot:
        self.check_staleness()
        now_mono = time.monotonic()
        
        seconds_since_last = (
            round(now_mono - self.last_packet_timestamp, 3)
            if self.last_packet_timestamp is not None
            else None
        )
        is_stale = (
            seconds_since_last is None or seconds_since_last > self.freshness_timeout
        )

        metrics = PipelineMetrics(
            bytes_received=self.bytes_received,
            frames_received=self.frames_received,
            frames_valid=self.frames_valid,
            frames_corrupted=self.frames_corrupted,
            frames_dropped=self.frames_dropped,
            packet_rate_hz=self.current_hz,
            byte_rate_bps=self.current_bps,
        )

        return TelemetryStateSnapshot(
            status=self.status,
            last_packet_time_utc=(
                self.last_packet_datetime.isoformat()
                if self.last_packet_datetime
                else None
            ),
            seconds_since_last_packet=seconds_since_last,
            is_stale=is_stale,
            telemetry=self.latest_telemetry,
            latest_raw_hex=self.latest_raw_hex,
            metrics=metrics,
            active_interface=self.active_interface,
        )