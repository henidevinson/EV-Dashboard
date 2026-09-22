import { TelemetryProvider, TelemetryListener } from './TelemetryProvider';
import {
  ConnectionStatus,
  ConnectionInfo,
  NormalizedTelemetry,
  VehicleState,
  RidingMode,
} from '../../types/normalizedTelemetry';
import { TelemetryPayload, WebSocketEnvelope } from '../../types/telemetry';

export class BackendWebSocketProvider implements TelemetryProvider {
  readonly id = 'backend_ws';
  readonly name = 'Live Backend WebSocket (FastAPI)';
  readonly description = 'Streams real vehicle or backend-injected serial telemetry via ws://.';
  readonly isHardwareReady = true;

  private listeners: Set<TelemetryListener> = new Set();
  private status: ConnectionStatus = 'DISCONNECTED';
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private pingTimer: number | null = null;

  private lastReceivedTimestamp: string | null = null;
  private lastReceivedEpoch: number | null = null;
  private totalMessages = 0;
  private errorCount = 0;
  private currentHz = 0.0;
  private lastRateCalcEpoch = Date.now();
  private recentFrames = 0;
  private readonly TIMEOUT_SECONDS = 5.0;

  private cachedTelemetry: NormalizedTelemetry | null = null;

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectionInfo(): ConnectionInfo {
    const age = this.lastReceivedEpoch ? (Date.now() - this.lastReceivedEpoch) / 1000 : null;
    return {
      status: this.status,
      connected: this.status === 'CONNECTED',
      lastReceivedTimestamp: this.lastReceivedTimestamp,
      lastUpdateAge: age !== null ? Number(age.toFixed(1)) : null,
      messageRate: this.currentHz,
      totalMessages: this.totalMessages,
      errorCount: this.errorCount,
      timeoutSeconds: this.TIMEOUT_SECONDS,
    };
  }

  connect(): void {
    if (this.ws) return;
    this.status = 'CONNECTING';

    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/telemetry';
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.watchdogTimer = window.setInterval(() => {
      this.evaluateWatchdog();
    }, 500);

    ws.onopen = () => {
      this.status = 'CONNECTING';
      this.pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const envelope: WebSocketEnvelope = JSON.parse(event.data);
        if (envelope.type === 'telemetry') {
          const payload = envelope.data as TelemetryPayload;

          this.totalMessages += 1;
          this.recentFrames += 1;
          this.lastReceivedEpoch = Date.now();
          this.lastReceivedTimestamp = payload.telemetry?.timestamp_utc ?? new Date().toISOString();

          const elapsed = (Date.now() - this.lastRateCalcEpoch) / 1000;
          if (elapsed >= 1.0) {
            this.currentHz = Number((this.recentFrames / elapsed).toFixed(1));
            this.recentFrames = 0;
            this.lastRateCalcEpoch = Date.now();
          }

          if (payload.status === 'OFFLINE' || payload.status === 'ERROR' || payload.is_stale) {
            this.status = 'COMMUNICATION_LOST';
          } else {
            this.status = 'CONNECTED';
          }

          const normalized = this.normalize(payload);
          this.cachedTelemetry = normalized;
          this.notify(normalized);
        }
      } catch {
        this.errorCount += 1;
      }
    };

    ws.onclose = () => {
      this.cleanup();
      this.status = this.lastReceivedEpoch ? 'COMMUNICATION_LOST' : 'DISCONNECTED';
      this.errorCount += 1;
      this.purgeStaleTelemetry();
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    };

    ws.onerror = () => {
      this.errorCount += 1;
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }

  disconnect(): void {
    this.cleanup();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.status = 'DISCONNECTED';
    this.currentHz = 0.0;
    this.purgeStaleTelemetry();
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private evaluateWatchdog(): void {
    if (this.status === 'CONNECTED' && this.lastReceivedEpoch) {
      const ageSeconds = (Date.now() - this.lastReceivedEpoch) / 1000;
      if (ageSeconds > this.TIMEOUT_SECONDS) {
        this.status = 'COMMUNICATION_LOST';
        this.currentHz = 0.0;
        this.purgeStaleTelemetry();
      }
    }
  }

  private purgeStaleTelemetry(): void {
    if (this.cachedTelemetry) {
      const purged: NormalizedTelemetry = {
        ...this.cachedTelemetry,
        connection: this.getConnectionInfo(),
        vehicle: { ...this.cachedTelemetry.vehicle, speedKmh: null, throttlePercent: null },
        battery: {
          ...this.cachedTelemetry.battery,
          voltage: null,
          rawVoltage: null,
          socPercent: null,
          currentAmperes: null,
          sopKw: null,
          powerWatts: null,
          cellVoltages: null,
          cellDeltaMv: null,
          bms: null, // Purge full BMS structure so frozen cells/temps/protections do not linger
        },
        motor: { ...this.cachedTelemetry.motor, rpm: null, torqueNm: null, powerKw: null },
      };
      this.cachedTelemetry = purged;
      this.notify(purged);
    }
  }

  private cleanup(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private notify(data: NormalizedTelemetry): void {
    this.listeners.forEach((listener) => listener(data));
  }

  private normalize(p: TelemetryPayload): NormalizedTelemetry {
    const isAvailable = this.status === 'CONNECTED';
    const t = p.telemetry;
    const bms = isAvailable ? (t?.bms ?? null) : null;

    const voltage = isAvailable ? t?.calibrated_pack_voltage ?? null : null;
    const current = isAvailable ? t?.current_amperes ?? null : null;
    const powerKw = isAvailable && voltage !== null && current !== null ? (voltage * current) / 1000.0 : null;
    const speed = isAvailable ? t?.speed_kmh ?? null : null;
    const rpm = isAvailable && t?.motor_rpm !== null && t?.motor_rpm !== undefined
      ? t.motor_rpm
      : (speed !== null ? Math.round((speed * 1000 / 60) / 0.8) : null);
    const torqueNm = isAvailable && current !== null ? Math.abs(current * 0.45) : null;
    const brakeActive = isAvailable && current !== null && current < -1.0;

    const cellVoltages = isAvailable ? (bms?.cell_voltages ?? t?.cell_voltages ?? null) : null;
    let cellDeltaMv: number | null = isAvailable ? (bms?.cell_delta_mv ?? null) : null;
    if (cellDeltaMv === null && cellVoltages && cellVoltages.length > 0) {
      const maxC = Math.max(...cellVoltages);
      const minC = Math.min(...cellVoltages);
      cellDeltaMv = Math.round((maxC - minC) * 1000);
    }

    let vehicleState: VehicleState = 'IDLE';
    if (!isAvailable) {
      vehicleState = 'OFF';
    } else if (current !== null && current < -1.0) {
      vehicleState = 'BRAKING';
    } else if (speed !== null && speed > 2.0) {
      vehicleState = current !== null && current > 12.0 ? 'ACCELERATING' : 'CRUISING';
    } else {
      vehicleState = 'IDLE';
    }

    const ridingMode: RidingMode = speed !== null && speed > 35 ? 'SPORT' : speed !== null && speed > 15 ? 'CITY' : 'ECO';

    return {
      timestampUtc: t?.timestamp_utc ?? new Date().toISOString(),
      isMock: Boolean(t?.is_mock || t?.data_source === 'MOCK'),
      dataSource: 'BACKEND_WS',
      connection: this.getConnectionInfo(),
      rawHex: t?.raw_frame_hex ?? '',
      vehicle: {
        speedKmh: speed,
        odometerKm: null,
        tripKm: null,
        state: vehicleState,
        ridingMode,
        direction: speed !== null && speed < -0.2 ? 'REVERSE' : 'FORWARD',
        throttlePercent: isAvailable && current !== null && current > 0 ? Math.min(100, Math.round((current / 35) * 100)) : 0,
        brakeActive,
      },
      battery: {
        socPercent: isAvailable ? t?.soc_percent ?? null : null,
        sohPercent: isAvailable ? bms?.soh_percent ?? null : null,
        sopKw: powerKw !== null ? Number(powerKw.toFixed(2)) : null,
        voltage,
        rawVoltage: isAvailable ? t?.raw_pack_voltage ?? null : null,
        currentAmperes: current,
        powerWatts: powerKw !== null ? Math.round(powerKw * 1000) : null,
        temperatureCelsius: isAvailable ? (bms?.battery_temp_c ?? t?.battery_temperature_celsius ?? null) : null,
        chargingState: isAvailable && current !== null
          ? (current < -0.5 ? 'REGEN_CHARGING' : current > 0.5 ? 'DISCHARGING' : 'IDLE')
          : 'UNKNOWN',
        cellVoltages,
        cellDeltaMv,
        bms,
      },
      motor: {
        rpm,
        torqueNm: torqueNm !== null ? Number(torqueNm.toFixed(1)) : null,
        temperatureCelsius: isAvailable ? t?.motor_temperature_celsius ?? null : null,
        currentAmperes: current !== null ? Math.abs(current) : null,
        voltage,
        powerKw: powerKw !== null ? Number(Math.abs(powerKw).toFixed(2)) : null,
      },
      controller: {
        temperatureCelsius: isAvailable ? t?.controller_temperature_celsius ?? null : null,
        dcBusVoltage: voltage,
        state: isAvailable ? 'NORMAL OPERATION' : this.status,
        faultState: p.faults.length > 0 ? `${p.faults.length} ACTIVE FAULT(S)` : 'NOMINAL (NO FAULTS)',
        communicationState: `${this.status} (${this.currentHz.toFixed(1)} Hz)`,
      },
      control: {
        reverse: false,
        cruise: false,
        horn: false,
        brake: brakeActive,
        headlight: isAvailable,
      },
      faults: {
        hasActiveFaults: p.faults.length > 0,
        bmsFault: p.faults.some((f) => f.code.includes('VOLTAGE') || f.code.includes('BMS')),
        motorFault: p.faults.some((f) => f.code.includes('MOTOR')),
        controllerFault: p.faults.some((f) => f.code.includes('CONTROLLER')),
        communicationFault: this.status === 'COMMUNICATION_LOST',
        activeFaults: p.faults,
      },
    };
  }
}
