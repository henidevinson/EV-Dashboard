import math
import random
import time
from enum import Enum
from typing import List, Tuple
from app.schemas.telemetry import DecodedTelemetry


class MockScenario(str, Enum):
    NORMAL = "normal"          # Dynamic cycle: Rest -> Accel -> Cruise -> Regen -> Rest
    DRAIN = "drain"            # High discharge draining battery quickly
    REGEN = "regen"            # Continuous downhill regenerative charging
    FAULT_OVERVOLT = "fault_overvolt"
    FAULT_UNDERVOLT = "fault_undervolt"
    FAULT_OVERTEMP = "fault_overtemp"


class DynamicEVPhysics:
    """Simulates realistic EV scooter kinematics, battery sag, and thermals."""

    def __init__(self, nominal_voltage: float = 52.0, battery_capacity_ah: float = 20.0):
        self.nominal_voltage = nominal_voltage
        self.capacity_ah = battery_capacity_ah
        self.soc = 85.0
        self.speed_kmh = 0.0
        self.current_a = 0.0
        self.voltage_sag = 0.0
        self.motor_temp = 32.0
        self.controller_temp = 30.0
        self.faults: List[str] = []
        
        # Internal cycle timer
        self._state_timer = 0.0
        self._current_phase = "REST"  # REST, ACCEL, CRUISE, REGEN

    def update(self, dt: float, scenario: MockScenario = MockScenario.NORMAL):
        self._state_timer += dt

        if scenario == MockScenario.NORMAL:
            self._update_normal_cycle(dt)
        elif scenario == MockScenario.DRAIN:
            self._update_drain_cycle(dt)
        elif scenario == MockScenario.REGEN:
            self._update_regen_cycle(dt)
        elif scenario == MockScenario.FAULT_OVERVOLT:
            self.soc = 100.0
            self.voltage_sag = 8.5  # Artificial surge
            self.faults = ["ERR_OVER_VOLTAGE"]
        elif scenario == MockScenario.FAULT_UNDERVOLT:
            self.soc = 4.0
            self.voltage_sag = -14.0  # Artificial deep cut
            self.faults = ["ERR_UNDER_VOLTAGE", "WARN_LOW_SOC"]
        elif scenario == MockScenario.FAULT_OVERTEMP:
            self.motor_temp = 92.5
            self.controller_temp = 85.0
            self.faults = ["ERR_MOTOR_OVERTEMP", "WARN_THERMAL_THROTTLE"]

        # Apply battery drain: Ah consumed = (Amperes * hours)
        ah_consumed = (self.current_a * (dt / 3600.0))
        delta_soc = (ah_consumed / self.capacity_ah) * 100.0
        self.soc = max(0.0, min(100.0, self.soc - delta_soc))

        # Thermal dissipation towards ambient (25C)
        ambient = 25.0
        self.motor_temp += (ambient - self.motor_temp) * 0.005 * dt
        self.controller_temp += (ambient - self.controller_temp) * 0.005 * dt

    def _update_normal_cycle(self, dt: float):
        self.faults.clear()
        # 30-second driving cycle: 5s Rest -> 8s Accel -> 10s Cruise -> 7s Regen
        cycle_time = self._state_timer % 30.0

        if cycle_time < 5.0:
            self._current_phase = "REST"
            self.speed_kmh = max(0.0, self.speed_kmh - 5.0 * dt)
            self.current_a = 0.2  # Parasitic quiescent draw
            self.voltage_sag = 0.0

        elif cycle_time < 13.0:
            self._current_phase = "ACCEL"
            self.speed_kmh = min(48.0, self.speed_kmh + 6.0 * dt)
            self.current_a = min(35.0, 15.0 + (self.speed_kmh * 0.45) + random.uniform(-1.0, 1.0))
            self.voltage_sag = -(self.current_a * 0.06)  # Internal resistance sag
            self.motor_temp += 0.25 * dt
            self.controller_temp += 0.15 * dt

        elif cycle_time < 23.0:
            self._current_phase = "CRUISE"
            self.speed_kmh = 45.0 + math.sin(self._state_timer * 1.5) * 2.0
            self.current_a = 11.0 + random.uniform(-0.5, 0.5)
            self.voltage_sag = -(self.current_a * 0.05)

        else:
            self._current_phase = "REGEN"
            self.speed_kmh = max(0.0, self.speed_kmh - 7.5 * dt)
            self.current_a = -12.0 if self.speed_kmh > 5.0 else 0.0
            self.voltage_sag = -(self.current_a * 0.04)  # Voltage rise during charging
            self.motor_temp += 0.05 * dt

    def _update_drain_cycle(self, dt: float):
        self.speed_kmh = 52.0
        self.current_a = 42.0 + random.uniform(-1.0, 1.0)
        self.voltage_sag = -(self.current_a * 0.07)
        self.motor_temp += 0.4 * dt

    def _update_regen_cycle(self, dt: float):
        self.speed_kmh = 30.0
        self.current_a = -18.5  # Sustained charging
        self.voltage_sag = 1.2
        self.faults.clear()

    @property
    def pack_voltage(self) -> float:
        # Base OCV curve based on SOC
        ocv = 44.0 + (self.nominal_voltage - 44.0) * (self.soc / 100.0)
        return max(38.0, round(ocv + self.voltage_sag, 2))

    @property
    def motor_rpm(self) -> int:
        # Assuming 10-inch wheel (circumference ~ 0.8m)
        # RPM = (speed in km/h * 1000 / 60) / 0.8
        return int((self.speed_kmh * 1000.0 / 60.0) / 0.8)


class MockTelemetryGenerator:
    """Synthesizes valid EV protocol frames and normalized telemetry objects."""

    def __init__(self, scenario: MockScenario = MockScenario.NORMAL):
        self.scenario = scenario
        self.physics = DynamicEVPhysics()
        self._last_time = time.monotonic()

    def set_scenario(self, scenario: MockScenario):
        self.scenario = scenario

    def generate_raw_frame(self) -> bytes:
        """
        Synthesizes a strictly valid 13-byte Frame 0x90 packet matching the physical protocol:
        [0xA5][0x40][0x90][0x08][Volts_U16][Acq_U16][Curr_U16][SOC_U16][Checksum]
        """
        now = time.monotonic()
        dt = max(0.01, now - self._last_time)
        self._last_time = now
        self.physics.update(dt, scenario=self.scenario)

        # Scale into protocol raw integers
        raw_volts = int(self.physics.pack_voltage * 10.0)
        raw_curr = int(self.physics.current_a * 10.0 + 30000.0)
        raw_soc = int(self.physics.soc * 10.0)

        header = bytes([0xA5, 0x40, 0x90, 0x08])
        payload = (
            raw_volts.to_bytes(2, byteorder="big")
            + raw_volts.to_bytes(2, byteorder="big")
            + raw_curr.to_bytes(2, byteorder="big")
            + raw_soc.to_bytes(2, byteorder="big")
        )
        first_12 = header + payload
        checksum = sum(first_12) & 0xFF
        return first_12 + bytes([checksum])

    def generate_telemetry_model(self) -> DecodedTelemetry:
        """Directly produces a typed DecodedTelemetry model flagged as synthetic."""
        raw_frame = self.generate_raw_frame()
        raw_hex = " ".join(f"{b:02X}" for b in raw_frame)

        return DecodedTelemetry(
            raw_pack_voltage=self.physics.pack_voltage,
            calibrated_pack_voltage=self.physics.pack_voltage,
            current_amperes=round(self.physics.current_a, 2),
            soc_percent=round(self.physics.soc, 1),
            speed_kmh=round(self.physics.speed_kmh, 1),
            motor_rpm=self.physics.motor_rpm,
            motor_temperature_celsius=round(self.physics.motor_temp, 1),
            controller_temperature_celsius=round(self.physics.controller_temp, 1),
            fault_codes=list(self.physics.faults),
            raw_frame_hex=raw_hex,
            is_mock=True,
            data_source="MOCK",
        )