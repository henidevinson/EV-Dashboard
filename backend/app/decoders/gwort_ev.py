from typing import Dict, List, Optional
from app.decoders.base import BaseTelemetryDecoder
from app.schemas.telemetry import DecodedTelemetry, BmsTelemetry


class GwortEvDecoder(BaseTelemetryDecoder):
    """Complete Decoder for G-WORT EV ASCII Stream parsing all 23 BMS parameters."""

    def decode(self, raw_bytes: bytes, voltage_offset: float = 0.0) -> Optional[DecodedTelemetry]:
        try:
            text = raw_bytes.decode("ascii", errors="ignore")
        except Exception:
            return None

        kv_pairs: Dict[str, str] = {}
        for line in text.splitlines():
            line = line.strip().lstrip("$")
            if "=" in line:
                parts = line.split("=", 1)
                kv_pairs[parts[0].strip()] = parts[1].strip()

        return self.decode_kv(kv_pairs, raw_bytes=raw_bytes, voltage_offset=voltage_offset)

    def decode_kv(
        self,
        kv_pairs: Dict[str, str],
        raw_bytes: bytes = b"",
        voltage_offset: float = 0.0,
    ) -> Optional[DecodedTelemetry]:
        if "Total_Voltage" not in kv_pairs and "SOC" not in kv_pairs:
            return None

        # 1. Total Pack Voltage
        raw_v_int = float(kv_pairs.get("Total_Voltage", 0.0))
        raw_pack_voltage = round(raw_v_int * 0.1, 2)
        calibrated_pack_voltage = round(raw_pack_voltage + voltage_offset, 2)

        # 2. Pack Current (Two's-complement + inverted polarity)
        current_amperes = 0.0
        try:
            raw_curr_int = float(kv_pairs.get("Current", 0.0))
            if raw_curr_int > 32767:
                raw_curr_int -= 65536
            op_curr = float(kv_pairs.get("Operating_Current", 0.0))
            if op_curr > 0:
                current_amperes = round(op_curr, 2)
            else:
                current_amperes = round(-raw_curr_int * 0.1, 2)
        except ValueError:
            current_amperes = 0.0

        # 3. State of Charge (%)
        raw_soc = float(kv_pairs.get("SOC", 0.0))
        soc_percent = round(raw_soc * 0.1, 1) if raw_soc > 100 else round(raw_soc, 1)
        soc_percent = max(0.0, min(100.0, soc_percent))

        # 4. Battery Power
        battery_power_w = round(calibrated_pack_voltage * current_amperes, 1)

        # 5. Cell Temperatures (Array of 4 Sensors)
        cell_temperatures: List[float] = []
        for i in range(1, 5):
            val = kv_pairs.get(f"Temp_Sensor{i}")
            if val is not None:
                try:
                    cell_temperatures.append(float(val))
                except ValueError:
                    pass

        battery_temp = cell_temperatures[0] if cell_temperatures else None
        max_cell_temp = max(cell_temperatures) if cell_temperatures else None
        min_cell_temp = min(cell_temperatures) if cell_temperatures else None

        # 6. Extract Series Cell Voltages
        cell_voltages: List[float] = []
        num_cells = int(kv_pairs.get("No_Of_Battery", 20))
        for i in range(1, num_cells + 1):
            cell_mv_str = kv_pairs.get(f"V{i}")
            if cell_mv_str:
                try:
                    mv = float(cell_mv_str)
                    if mv > 1000:
                        cell_voltages.append(round(mv / 1000.0, 3))
                except ValueError:
                    pass

        # 7 & 8. Min and Max Cell Voltages & Indices
        max_cell_voltage = None
        max_cell_index = None
        if "Max_Voltage" in kv_pairs:
            try:
                max_cell_voltage = round(float(kv_pairs["Max_Voltage"]) / 1000.0, 3)
                max_cell_index = int(kv_pairs.get("Max_Voltage_No", 0))
            except ValueError:
                pass

        min_cell_voltage = None
        min_cell_index = None
        if "Min_Voltage" in kv_pairs:
            try:
                min_cell_voltage = round(float(kv_pairs["Min_Voltage"]) / 1000.0, 3)
                min_cell_index = int(kv_pairs.get("Min_Voltage_No", 0))
            except ValueError:
                pass

        # 9. Cell Voltage Difference (Delta V in mV)
        cell_delta_mv = None
        if max_cell_voltage is not None and min_cell_voltage is not None:
            cell_delta_mv = round((max_cell_voltage - min_cell_voltage) * 1000.0, 1)

        # 12 & 13. Capacity Metrics
        full_capacity_ah = float(kv_pairs.get("Battery_capacity", 27.0))
        remaining_capacity_ah = round(full_capacity_ah * (soc_percent / 100.0), 2)

        # 15. Balancing Status
        balance_bits = [
            int(kv_pairs.get("Cell_Balance_State_0", 0)),
            int(kv_pairs.get("Cell_Balance_State_1", 0)),
            int(kv_pairs.get("Cell_Balance_State_2", 0)),
        ]
        balancing_active = any(b > 0 for b in balance_bits)

        # 16-20. Protections & Hardware Alarm Bit Flags
        ov_prot = kv_pairs.get("Total_Pack_High_Voltage_Alarm") == "1" or kv_pairs.get("Single_Cell_High_Voltage_Alarm") == "1"
        uv_prot = kv_pairs.get("Total_Pack_Low_Voltage_Alarm") == "1" or kv_pairs.get("Single_Cell_Low_Voltage_Alarm") == "1"
        oc_chg = kv_pairs.get("Chg_Overcurrent_Alarm") == "1"
        oc_dis = kv_pairs.get("Dischg_Overcurrent_Alarm") == "1"
        ot_prot = kv_pairs.get("Chg_High_Temperature_Alarm") == "1" or kv_pairs.get("disChg_High_Temperature_Alarm") == "1"
        ut_prot = kv_pairs.get("Chg_Low_Temperature_Alarm") == "1"
        sc_prot = oc_dis and current_amperes > 60.0

        # 21-23. Fault & Warning Lists
        bms_fault_codes: List[str] = []
        if ov_prot: bms_fault_codes.append("ALARM_PACK_OVER_VOLTAGE")
        if uv_prot: bms_fault_codes.append("ALARM_PACK_UNDER_VOLTAGE")
        if oc_chg: bms_fault_codes.append("ALARM_CHARGE_OVERCURRENT")
        if oc_dis: bms_fault_codes.append("ALARM_DISCHARGE_OVERCURRENT")
        if ot_prot: bms_fault_codes.append("ALARM_OVER_TEMPERATURE")
        if sc_prot: bms_fault_codes.append("FAULT_SHORT_CIRCUIT_TRIP")

        warning_status: List[str] = []
        if kv_pairs.get("SOC_Low_Alarm") == "1": warning_status.append("WARN_LOW_SOC")
        if kv_pairs.get("SOC_High_Alarm") == "1": warning_status.append("WARN_HIGH_SOC")
        if ut_prot: warning_status.append("WARN_LOW_TEMPERATURE")

        bms_status_str = "PROTECTION_ACTIVE" if bms_fault_codes else "NORMAL"

        # Build Complete BMS Subsystem
        bms_data = BmsTelemetry(
            soc_percent=soc_percent,
            pack_voltage=calibrated_pack_voltage,
            raw_pack_voltage=raw_pack_voltage,
            pack_current=current_amperes,
            battery_power_w=battery_power_w,
            battery_temp_c=battery_temp,
            cell_voltages=cell_voltages,
            max_cell_voltage=max_cell_voltage,
            max_cell_index=max_cell_index,
            min_cell_voltage=min_cell_voltage,
            min_cell_index=min_cell_index,
            cell_delta_mv=cell_delta_mv,
            cell_temperatures=cell_temperatures,
            max_cell_temp=max_cell_temp,
            min_cell_temp=min_cell_temp,
            full_capacity_ah=full_capacity_ah,
            remaining_capacity_ah=remaining_capacity_ah,
            soh_percent=None,  # NOT AVAILABLE in stream (zero fake data)
            cycle_count=None,  # NOT AVAILABLE in stream (zero fake data)
            balancing_active=balancing_active,
            cell_balance_bits=balance_bits,
            charger_state=int(kv_pairs.get("Charger_State", 0)),
            load_status=int(kv_pairs.get("Load_Status", 0)),
            over_voltage_protection=ov_prot,
            under_voltage_protection=uv_prot,
            over_current_charge_protection=oc_chg,
            over_current_discharge_protection=oc_dis,
            over_temperature_protection=ot_prot,
            under_temperature_protection=ut_prot,
            short_circuit_protection=sc_prot,
            bms_fault_status=bms_status_str,
            bms_fault_codes=bms_fault_codes,
            warning_status=warning_status,
        )

        speed_kmh = float(kv_pairs.get("Speed", 0.0))
        motor_rpm = int((speed_kmh * 1000.0 / 60.0) / 0.8) if speed_kmh > 0 else 0
        raw_hex_snippet = " ".join(f"{b:02X}" for b in raw_bytes[:16]) if raw_bytes else "ASCII_STREAM"

        return DecodedTelemetry(
            raw_pack_voltage=raw_pack_voltage,
            calibrated_pack_voltage=calibrated_pack_voltage,
            current_amperes=current_amperes,
            soc_percent=soc_percent,
            speed_kmh=speed_kmh,
            motor_rpm=motor_rpm,
            motor_temperature_celsius=None,
            controller_temperature_celsius=battery_temp,
            battery_temperature_celsius=battery_temp,
            cell_voltages=cell_voltages if cell_voltages else None,
            bms=bms_data,
            fault_codes=bms_fault_codes,
            raw_frame_hex=raw_hex_snippet,
            is_mock=False,
            data_source="REAL",
        )
