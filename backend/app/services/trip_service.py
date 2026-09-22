from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.database.models import Trip
from app.schemas.telemetry import DecodedTelemetry


class TripManager:
    """Manages active trip lifecycle and mathematical accumulation of metrics."""

    def __init__(self):
        self.active_trip_id: Optional[int] = None
        self._speed_accumulator = 0.0
        self._speed_sample_count = 0

    def start_trip(self, db: Session, initial_soc: Optional[float] = None) -> Trip:
        self.end_trip(db)

        trip = Trip(
            start_time_utc=datetime.now(timezone.utc),
            start_soc=initial_soc,
            is_active=True,
            fault_count=0,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        self.active_trip_id = trip.id
        self._speed_accumulator = 0.0
        self._speed_sample_count = 0
        return trip

    def update_metrics(self, db: Session, telemetry: DecodedTelemetry, dt: float) -> Optional[Trip]:
        if self.active_trip_id is None:
            speed = telemetry.speed_kmh or 0.0
            if speed > 2.0:
                self.start_trip(db, initial_soc=telemetry.soc_percent)
            else:
                return None

        trip = db.query(Trip).filter(Trip.id == self.active_trip_id, Trip.is_active == True).first()
        if not trip:
            self.active_trip_id = None
            return None

        # Integrate Duration & Distance
        trip.duration_seconds = round(trip.duration_seconds + dt, 2)
        speed = telemetry.speed_kmh or 0.0
        distance_delta_km = speed * (dt / 3600.0)
        trip.distance_km = round(trip.distance_km + distance_delta_km, 3)

        # Kinematics
        if speed > trip.max_speed_kmh:
            trip.max_speed_kmh = round(speed, 1)

        self._speed_accumulator += speed
        self._speed_sample_count += 1
        trip.avg_speed_kmh = round(self._speed_accumulator / self._speed_sample_count, 1)

        # Electrical Energy
        power_watts = telemetry.calibrated_pack_voltage * telemetry.current_amperes
        energy_delta_wh = power_watts * (dt / 3600.0)
        trip.energy_consumed_wh = round(trip.energy_consumed_wh + energy_delta_wh, 2)

        if trip.distance_km > 0.05:
            trip.efficiency_wh_per_km = round(trip.energy_consumed_wh / trip.distance_km, 1)

        # Thermals (Safely access optional fields)
        m_temp = getattr(telemetry, 'motor_temperature_celsius', None)
        if m_temp is not None:
            trip.max_motor_temp = max(trip.max_motor_temp or 0.0, m_temp)
        
        b_temp = getattr(telemetry, 'battery_temperature_celsius', None)
        if b_temp is not None:
            trip.max_battery_temp = max(trip.max_battery_temp or 0.0, b_temp)

        if telemetry.fault_codes:
            trip.fault_count = (trip.fault_count or 0) + len(telemetry.fault_codes)

        trip.end_soc = telemetry.soc_percent
        db.commit()
        return trip

    def end_trip(self, db: Session) -> Optional[Trip]:
        if self.active_trip_id is None:
            return None

        trip = db.query(Trip).filter(Trip.id == self.active_trip_id).first()
        if trip:
            trip.is_active = False
            trip.end_time_utc = datetime.now(timezone.utc)
            db.commit()
            db.refresh(trip)

        self.active_trip_id = None
        self._speed_accumulator = 0.0
        self._speed_sample_count = 0
        return trip


trip_manager = TripManager()
