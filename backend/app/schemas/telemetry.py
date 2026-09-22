from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BmsTelemetry(BaseModel):
    """Full 23-parameter physical BMS telemetry model."""
    soc_percent: float = Field(..., description="Battery State of Charge %")
    pack_voltage: float = Field(..., description="Calibrated pack potential in Volts")
    raw_pack_voltage: float = Field(..., description="Raw ADC tap potential in Volts")
    pack_current: float = Field(..., description="Pack current: positive=discharge, negative=charge")
    battery_power_w: float = Field(..., description="Pack electrical power in Watts")
    battery_temp_c: Optional[float] = Field(None, description="Core pack temperature in Celsius")

    # Cell Voltages & Spread
    cell_voltages: List[float] = Field(default_factory=list, description="Series cell voltages in Volts")
    max_cell_voltage: Optional[float] = Field(None, description="Highest cell voltage in Volts")
    max_cell_index: Optional[int] = Field(None, description="Highest cell series index (1-based)")
    min_cell_voltage: Optional[float] = Field(None, description="Lowest cell voltage in Volts")
    min_cell_index: Optional[int] = Field(None, description="Lowest cell series index (1-based)")
    cell_delta_mv: Optional[float] = Field(None, description="Cell balance delta in mV")

    # Temperatures
    cell_temperatures: List[float] = Field(default_factory=list, description="Thermal sensor array in °C")
    max_cell_temp: Optional[float] = Field(None, description="Highest measured temperature in °C")
    min_cell_temp: Optional[float] = Field(None, description="Lowest measured temperature in °C")

    # Capacity & Health
    full_capacity_ah: float = Field(27.0, description="Nameplate full pack capacity in Ah")
    remaining_capacity_ah: float = Field(..., description="Coulomb-counted remaining capacity in Ah")
    soh_percent: Optional[float] = Field(None, description="State of Health % (null if not in stream)")
    cycle_count: Optional[int] = Field(None, description="Full cycles (null if not in stream)")

    # Balancing & Hardware Status
    balancing_active: bool = Field(False, description="True if cell balancing circuits are active")
    cell_balance_bits: List[int] = Field(default_factory=list, description="Balancing status flags")
    charger_state: int = Field(0, description="Charger status flag")
    load_status: int = Field(0, description="Load/discharge contactor status")

    # Protection & Safety Interlocks (True = Tripped/Alarm)
    over_voltage_protection: bool = Field(False)
    under_voltage_protection: bool = Field(False)
    over_current_charge_protection: bool = Field(False)
    over_current_discharge_protection: bool = Field(False)
    over_temperature_protection: bool = Field(False)
    under_temperature_protection: bool = Field(False)
    short_circuit_protection: bool = Field(False)

    # Fault & Warning Summaries
    bms_fault_status: str = Field("NORMAL", description="NORMAL | PROTECTION_ACTIVE")
    bms_fault_codes: List[str] = Field(default_factory=list)
    warning_status: List[str] = Field(default_factory=list)

    model_config = ConfigDict(frozen=True)


class DecodedTelemetry(BaseModel):
    """Normalized vehicle telemetry envelope."""
    timestamp_utc: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    raw_pack_voltage: float
    calibrated_pack_voltage: float
    current_amperes: float
    soc_percent: float

    speed_kmh: Optional[float] = None
    motor_rpm: Optional[int] = None
    motor_temperature_celsius: Optional[float] = None
    controller_temperature_celsius: Optional[float] = None
    battery_temperature_celsius: Optional[float] = None

    cell_voltages: Optional[List[float]] = None

    # Full Embedded BMS Subsystem
    bms: Optional[BmsTelemetry] = None

    fault_codes: List[str] = Field(default_factory=list)
    raw_frame_hex: str
    is_mock: bool = False
    data_source: str = "REAL"

    model_config = ConfigDict(frozen=True)
