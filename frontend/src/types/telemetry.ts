export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'WAITING_FOR_DATA'
  | 'CONNECTED'
  | 'DATA_STALE'
  | 'OFFLINE'
  | 'COMMUNICATION_LOST'
  | 'ERROR';

export interface BmsDataContract {
  soc_percent: number;
  pack_voltage: number;
  raw_pack_voltage: number;
  pack_current: number;
  battery_power_w: number;
  battery_temp_c: number | null;
  cell_voltages: number[];
  max_cell_voltage: number | null;
  max_cell_index: number | null;
  min_cell_voltage: number | null;
  min_cell_index: number | null;
  cell_delta_mv: number | null;
  cell_temperatures: number[];
  max_cell_temp: number | null;
  min_cell_temp: number | null;
  full_capacity_ah: number;
  remaining_capacity_ah: number;
  soh_percent: number | null;
  cycle_count: number | null;
  balancing_active: boolean;
  cell_balance_bits: number[];
  charger_state: number;
  load_status: number;
  over_voltage_protection: boolean;
  under_voltage_protection: boolean;
  over_current_charge_protection: boolean;
  over_current_discharge_protection: boolean;
  over_temperature_protection: boolean;
  under_temperature_protection: boolean;
  short_circuit_protection: boolean;
  bms_fault_status: string;
  bms_fault_codes: string[];
  warning_status: string[];
}

export interface DecodedTelemetry {
  timestamp_utc: string;
  raw_pack_voltage: number;
  calibrated_pack_voltage: number;
  current_amperes: number;
  soc_percent: number;
  speed_kmh: number | null;
  motor_rpm: number | null;
  motor_temperature_celsius: number | null;
  controller_temperature_celsius: number | null;
  battery_temperature_celsius: number | null;
  cell_voltages?: number[] | null;
  bms?: BmsDataContract | null;
  fault_codes: string[];
  raw_frame_hex: string;
  is_mock?: boolean;
  data_source?: string;
}

export interface FaultCondition {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  trigger_value?: number;
  threshold_value?: number;
  timestamp_utc: string;
}

export interface PipelineMetrics {
  bytes_received: number;
  frames_received: number;
  frames_valid: number;
  frames_corrupted: number;
  frames_dropped: number;
  packet_rate_hz: number;
  byte_rate_bps: number;
}

export interface TelemetryPayload {
  status: ConnectionStatus;
  is_stale: boolean;
  seconds_since_last_packet: number | null;
  interface: string;
  metrics: PipelineMetrics;
  telemetry: DecodedTelemetry | null;
  faults: FaultCondition[];
}

export interface WebSocketEnvelope {
  type: 'telemetry' | 'status' | 'fault' | 'heartbeat';
  timestamp_utc: string;
  data: TelemetryPayload | Record<string, unknown>;
}
