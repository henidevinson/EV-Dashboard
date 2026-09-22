import { BmsDataContract } from './telemetry';

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'COMMUNICATION_LOST';

export type VehicleState =
  | 'OFF'
  | 'IDLE'
  | 'ACCELERATING'
  | 'CRUISING'
  | 'DECELERATING'
  | 'BRAKING'
  | 'CHARGING';

export type RidingMode = 'ECO' | 'CITY' | 'SPORT';

export interface ConnectionInfo {
  status: ConnectionStatus;
  connected: boolean;
  lastReceivedTimestamp: string | null;
  lastUpdateAge: number | null;
  messageRate: number;
  totalMessages: number;
  errorCount: number;
  timeoutSeconds: number;
}

export interface VehicleTelemetry {
  speedKmh: number | null;
  odometerKm: number | null;
  tripKm: number | null;
  state: VehicleState;
  ridingMode: RidingMode;
  direction: 'FORWARD' | 'REVERSE' | 'NEUTRAL';
  throttlePercent: number | null;
  brakeActive: boolean;
}

export interface BatteryTelemetry {
  socPercent: number | null;
  sohPercent: number | null;
  sopKw: number | null;
  voltage: number | null;
  rawVoltage: number | null;
  currentAmperes: number | null;
  powerWatts: number | null;
  temperatureCelsius: number | null;
  chargingState: 'DISCHARGING' | 'REGEN_CHARGING' | 'IDLE' | 'UNKNOWN';
  cellVoltages?: number[] | null;
  cellDeltaMv?: number | null;
  bms?: BmsDataContract | null;
}

export interface MotorTelemetry {
  rpm: number | null;
  torqueNm: number | null;
  temperatureCelsius: number | null;
  currentAmperes: number | null;
  voltage: number | null;
  powerKw: number | null;
}

export interface ControllerTelemetry {
  temperatureCelsius: number | null;
  dcBusVoltage: number | null;
  state: string;
  faultState: string;
  communicationState: string;
}

export interface ControlState {
  reverse: boolean;
  cruise: boolean;
  horn: boolean;
  brake: boolean;
  headlight: boolean;
}

export interface FaultCondition {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  trigger_value?: number;
  threshold_value?: number;
  timestamp_utc: string;
}

export interface FaultState {
  hasActiveFaults: boolean;
  bmsFault: boolean;
  motorFault: boolean;
  controllerFault: boolean;
  communicationFault: boolean;
  activeFaults: FaultCondition[];
}

export interface NormalizedTelemetry {
  timestampUtc: string;
  isMock: boolean;
  dataSource: 'MOCK' | 'BACKEND_WS' | 'SERIAL' | 'CAN';
  connection: ConnectionInfo;
  rawHex: string;
  vehicle: VehicleTelemetry;
  battery: BatteryTelemetry;
  motor: MotorTelemetry;
  controller: ControllerTelemetry;
  control: ControlState;
  faults: FaultState;
}
