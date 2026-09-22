from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.config import settings
from app.schemas.telemetry import DecodedTelemetry
from app.telemetry.state import ConnectionStatus


class FaultSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class FaultCode(str, Enum):
    OVER_VOLTAGE = "OVER_VOLTAGE"
    UNDER_VOLTAGE = "UNDER_VOLTAGE"
    HIGH_DISCHARGE_CURRENT = "HIGH_DISCHARGE_CURRENT"
    HIGH_CHARGE_CURRENT = "HIGH_CHARGE_CURRENT"
    MOTOR_OVERTEMP = "MOTOR_OVERTEMP"
    CONTROLLER_OVERTEMP = "CONTROLLER_OVERTEMP"
    DATA_STALE = "DATA_STALE"
    COMMUNICATION_LOST = "COMMUNICATION_LOST"


class FaultCondition(BaseModel):
    code: FaultCode
    severity: FaultSeverity
    message: str
    trigger_value: Optional[float] = None
    threshold_value: Optional[float] = None
    timestamp_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class FaultEngine:
    """Evaluates physical measurements and connection state against safety rules."""

    def evaluate(
        self,
        telemetry: Optional[DecodedTelemetry],
        connection_status: ConnectionStatus,
        is_stale: bool,
    ) -> List[FaultCondition]:
        active_faults: List[FaultCondition] = []

        # 1. Connection & Freshness Rules
        if connection_status in (ConnectionStatus.OFFLINE, ConnectionStatus.ERROR):
            active_faults.append(
                FaultCondition(
                    code=FaultCode.COMMUNICATION_LOST,
                    severity=FaultSeverity.CRITICAL,
                    message=f"Telemetry physical interface is {connection_status.value}",
                )
            )

        if is_stale and connection_status != ConnectionStatus.DISCONNECTED:
            active_faults.append(
                FaultCondition(
                    code=FaultCode.DATA_STALE,
                    severity=FaultSeverity.WARNING,
                    message=f"No telemetry frame received for > {settings.TELEMETRY_FRESHNESS_TIMEOUT}s",
                )
            )

        # 2. Measurement Rules (Only evaluated when valid telemetry is present)
        if telemetry is not None:
            voltage = telemetry.calibrated_pack_voltage

            # Overvoltage condition
            if voltage > settings.FAULT_MAX_VOLTAGE:
                active_faults.append(
                    FaultCondition(
                        code=FaultCode.OVER_VOLTAGE,
                        severity=FaultSeverity.CRITICAL,
                        message=f"Pack voltage ({voltage}V) exceeds trip point ({settings.FAULT_MAX_VOLTAGE}V)",
                        trigger_value=voltage,
                        threshold_value=settings.FAULT_MAX_VOLTAGE,
                    )
                )

            # Undervoltage condition
            if voltage < settings.FAULT_MIN_VOLTAGE:
                active_faults.append(
                    FaultCondition(
                        code=FaultCode.UNDER_VOLTAGE,
                        severity=FaultSeverity.CRITICAL,
                        message=f"Pack voltage ({voltage}V) is below low-voltage cutoff ({settings.FAULT_MIN_VOLTAGE}V)",
                        trigger_value=voltage,
                        threshold_value=settings.FAULT_MIN_VOLTAGE,
                    )
                )

            # High discharge current (positive = discharging)
            if telemetry.current_amperes > settings.FAULT_MAX_DISCHARGE_AMPS:
                active_faults.append(
                    FaultCondition(
                        code=FaultCode.HIGH_DISCHARGE_CURRENT,
                        severity=FaultSeverity.WARNING,
                        message=f"Discharge current ({telemetry.current_amperes}A) exceeds sustained limit ({settings.FAULT_MAX_DISCHARGE_AMPS}A)",
                        trigger_value=telemetry.current_amperes,
                        threshold_value=settings.FAULT_MAX_DISCHARGE_AMPS,
                    )
                )

            # High regen charge current (negative = charging)
            if telemetry.current_amperes < -settings.FAULT_MAX_CHARGE_AMPS:
                active_faults.append(
                    FaultCondition(
                        code=FaultCode.HIGH_CHARGE_CURRENT,
                        severity=FaultSeverity.WARNING,
                        message=f"Regenerative charge current ({abs(telemetry.current_amperes)}A) exceeds maximum charge limit ({settings.FAULT_MAX_CHARGE_AMPS}A)",
                        trigger_value=abs(telemetry.current_amperes),
                        threshold_value=settings.FAULT_MAX_CHARGE_AMPS,
                    )
                )

            # Motor temperature check (only if reported by hardware)
            if telemetry.motor_temperature_celsius is not None:
                if telemetry.motor_temperature_celsius > settings.FAULT_MAX_MOTOR_TEMP:
                    active_faults.append(
                        FaultCondition(
                            code=FaultCode.MOTOR_OVERTEMP,
                            severity=FaultSeverity.CRITICAL,
                            message=f"Motor core temp ({telemetry.motor_temperature_celsius}°C) exceeds safety limit ({settings.FAULT_MAX_MOTOR_TEMP}°C)",
                            trigger_value=telemetry.motor_temperature_celsius,
                            threshold_value=settings.FAULT_MAX_MOTOR_TEMP,
                        )
                    )

            # Controller temperature check (only if reported by hardware)
            if telemetry.controller_temperature_celsius is not None:
                if telemetry.controller_temperature_celsius > settings.FAULT_MAX_CONTROLLER_TEMP:
                    active_faults.append(
                        FaultCondition(
                            code=FaultCode.CONTROLLER_OVERTEMP,
                            severity=FaultSeverity.CRITICAL,
                            message=f"Controller heatsink temp ({telemetry.controller_temperature_celsius}°C) exceeds thermal limit ({settings.FAULT_MAX_CONTROLLER_TEMP}°C)",
                            trigger_value=telemetry.controller_temperature_celsius,
                            threshold_value=settings.FAULT_MAX_CONTROLLER_TEMP,
                        )
                    )

        return active_faults