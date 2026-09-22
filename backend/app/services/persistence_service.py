import time
from typing import List, Optional
from app.core.logging import logger
from app.database.models import FaultRecord, RawFrameAudit, TelemetryRecord
from app.database.session import SessionLocal
from app.schemas.telemetry import DecodedTelemetry
from app.services.fault_engine import FaultCondition
from app.services.trip_service import trip_manager


class PersistenceService:
    """Manages telemetry logging rates, trip updates, and fault persistence."""

    def __init__(self, log_interval_seconds: float = 1.0):
        self.log_interval = log_interval_seconds
        self._last_log_time = 0.0
        self._last_trip_update_time = time.monotonic()
        self._persisted_fault_codes = set()

    def process_telemetry(self, telemetry: Optional[DecodedTelemetry], faults: List[FaultCondition]):
        """Processes telemetry updates at 1 Hz and persists new fault transitions."""
        now = time.monotonic()
        dt = max(0.01, now - self._last_trip_update_time)
        self._last_trip_update_time = now

        db = SessionLocal()
        try:
            # 1. Update Trip Integration
            if telemetry:
                trip_manager.update_metrics(db, telemetry, dt)

            # 2. Downsampled Time-Series Persistence (1 Hz)
            if (now - self._last_log_time) >= self.log_interval:
                self._last_log_time = now
                if telemetry:
                    record = TelemetryRecord(
                        raw_pack_voltage=telemetry.raw_pack_voltage,
                        calibrated_pack_voltage=telemetry.calibrated_pack_voltage,
                        current_amperes=telemetry.current_amperes,
                        soc_percent=telemetry.soc_percent,
                        speed_kmh=telemetry.speed_kmh,
                        motor_rpm=telemetry.motor_rpm,
                        motor_temperature_celsius=telemetry.motor_temperature_celsius,
                        controller_temperature_celsius=telemetry.controller_temperature_celsius,
                        fault_codes=",".join(telemetry.fault_codes),
                        raw_frame_hex=telemetry.raw_frame_hex,
                        is_mock=telemetry.is_mock,
                        data_source=telemetry.data_source,
                    )
                    db.add(record)

            # 3. Fault Incident Logging
            current_active_codes = {f.code.value for f in faults}
            for fault in faults:
                if fault.code.value not in self._persisted_fault_codes:
                    # New alarm raised: log to database
                    record = FaultRecord(
                        code=fault.code.value,
                        severity=fault.severity.value,
                        message=fault.message,
                        trigger_value=fault.trigger_value,
                        threshold_value=fault.threshold_value,
                    )
                    db.add(record)

            self._persisted_fault_codes = current_active_codes
            db.commit()
        except Exception as err:
            db.rollback()
            logger.error("[PERSISTENCE] Error storing telemetry records: %s", err)
        finally:
            db.close()

    def log_raw_frame(self, raw_hex: str, status: str = "VALID"):
        """Audit logging of raw incoming frame strings."""
        db = SessionLocal()
        try:
            record = RawFrameAudit(raw_hex=raw_hex, status=status)
            db.add(record)
            db.commit()
        except Exception as err:
            db.rollback()
            logger.error("[PERSISTENCE] Error auditing raw frame: %s", err)
        finally:
            db.close()


persistence_service = PersistenceService()