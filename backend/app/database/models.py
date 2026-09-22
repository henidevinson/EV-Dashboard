from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from app.database.session import Base


class TelemetryRecord(Base):
    """Periodic time-series snapshot of decoded vehicle telemetry."""
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp_utc = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Electrical Pack Data
    raw_pack_voltage = Column(Float, nullable=False)
    calibrated_pack_voltage = Column(Float, nullable=False)
    current_amperes = Column(Float, nullable=False)
    soc_percent = Column(Float, nullable=False)

    # Kinematic & Thermal Data
    speed_kmh = Column(Float, nullable=True)
    motor_rpm = Column(Integer, nullable=True)
    motor_temperature_celsius = Column(Float, nullable=True)
    controller_temperature_celsius = Column(Float, nullable=True)

    # Diagnostics & Audit
    fault_codes = Column(String, default="")
    raw_frame_hex = Column(String, nullable=False)
    is_mock = Column(Boolean, default=False, nullable=False)
    data_source = Column(String, default="REAL", nullable=False)


class Trip(Base):
    """Metadata and cumulative metrics for a vehicle operating session."""
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    start_time_utc = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    end_time_utc = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    
    # Distance & Kinematics
    distance_km = Column(Float, default=0.0)
    max_speed_kmh = Column(Float, default=0.0)
    avg_speed_kmh = Column(Float, default=0.0)

    # Electrical & Energy Metrics
    energy_consumed_wh = Column(Float, default=0.0)
    efficiency_wh_per_km = Column(Float, default=0.0)
    start_soc = Column(Float, nullable=True)
    end_soc = Column(Float, nullable=True)

    # Extended Diagnostics
    max_motor_temp = Column(Float, nullable=True)
    max_battery_temp = Column(Float, nullable=True)
    fault_count = Column(Integer, default=0)

    is_active = Column(Boolean, default=True, index=True)


class FaultRecord(Base):
    """Historical record of triggered safety alarms and trip events."""
    __tablename__ = "fault_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp_utc = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    code = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False)
    message = Column(String, nullable=False)
    trigger_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    resolved_at_utc = Column(DateTime, nullable=True)


class RawFrameAudit(Base):
    """Audit log of raw hexadecimal frames for protocol diagnostics."""
    __tablename__ = "raw_frame_audit"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp_utc = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    raw_hex = Column(String, nullable=False)
    status = Column(String, nullable=False)
