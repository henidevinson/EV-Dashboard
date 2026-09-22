import { TelemetryProvider, TelemetryListener } from './TelemetryProvider';
import {
  ConnectionStatus,
  ConnectionInfo,
  NormalizedTelemetry,
  VehicleState,
  RidingMode,
} from '../../types/normalizedTelemetry';

export class MockTelemetryProvider implements TelemetryProvider {
  readonly id = 'mock';
  readonly name = 'Realistic Mock Simulator (Physics Engine)';
  readonly description = 'Coupled Newtonian kinematics, voltage sag, thermal curves, and state transitions.';
  readonly isHardwareReady = true;

  private listeners: Set<TelemetryListener> = new Set();
  private status: ConnectionStatus = 'DISCONNECTED';
  private timer: number | null = null;

  private simMode: 'AUTO' | VehicleState = 'AUTO';
  private stateTimer = 0;
  private currentState: VehicleState = 'IDLE';

  // Metrics
  private totalMessages = 0;
  private lastPacketTimestamp: string | null = null;
  private readonly TIMEOUT_SECONDS = 5.0;

  // Physical State Variables
  private speed = 0.0;
  private odoKm = 124.5;
  private tripKm = 0.0;
  private soc = 88.0;
  private current = 0.2;
  private motorTemp = 28.0;
  private controllerTemp = 27.0;
  private batteryTemp = 26.0;
  private throttle = 0;
  private brake = false;

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      status: this.status,
      connected: this.status === 'CONNECTED',
      lastReceivedTimestamp: this.lastPacketTimestamp,
      lastUpdateAge: this.status === 'CONNECTED' ? 0.1 : null,
      messageRate: this.status === 'CONNECTED' ? 10.0 : 0.0,
      totalMessages: this.totalMessages,
      errorCount: 0,
      timeoutSeconds: this.TIMEOUT_SECONDS,
    };
  }

  connect(): void {
    if (this.timer) return;
    this.status = 'CONNECTED';
    this.timer = window.setInterval(() => this.stepPhysics(0.1), 100);
  }

  disconnect(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'DISCONNECTED';
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSimulationState(targetState: 'AUTO' | VehicleState): void {
    this.simMode = targetState;
    if (targetState !== 'AUTO') {
      this.currentState = targetState;
      this.stateTimer = 0;
    }
  }

  private stepPhysics(dt: number = 0.1): void {
    this.stateTimer += dt;
    this.totalMessages += 1;
    this.lastPacketTimestamp = new Date().toISOString();

    if (this.simMode === 'AUTO') {
      const cycle = this.stateTimer % 45.0;
      if (cycle < 4.0) {
        this.currentState = 'IDLE';
      } else if (cycle < 16.0) {
        this.currentState = 'ACCELERATING';
      } else if (cycle < 28.0) {
        this.currentState = 'CRUISING';
      } else if (cycle < 34.0) {
        this.currentState = 'DECELERATING';
      } else if (cycle < 39.0) {
        this.currentState = 'BRAKING';
      } else if (cycle < 43.0) {
        this.currentState = 'CHARGING';
      } else {
        this.currentState = 'OFF';
      }
    }

    switch (this.currentState) {
      case 'OFF':
        this.throttle = 0;
        this.brake = false;
        this.speed = Math.max(0, this.speed - 8.0 * dt);
        this.current = 0.0;
        break;

      case 'IDLE':
        this.throttle = 0;
        this.brake = false;
        this.speed = Math.max(0, this.speed - 6.0 * dt);
        this.current = 0.25;
        break;

      case 'ACCELERATING':
        this.brake = false;
        this.throttle = Math.min(100, Math.round(35 + (this.speed / 48) * 60));
        this.current = Math.min(36.0, 12.0 + (this.throttle * 0.24));
        this.speed = Math.min(48.5, this.speed + 5.2 * dt);
        break;

      case 'CRUISING':
        this.brake = false;
        this.throttle = 40;
        this.current = 9.5 + Math.sin(this.stateTimer * 2.0) * 1.2;
        this.speed = 45.0 + Math.sin(this.stateTimer * 1.5) * 0.8;
        break;

      case 'DECELERATING':
        this.throttle = 0;
        this.brake = false;
        this.current = 0.4;
        this.speed = Math.max(0, this.speed - 3.2 * dt);
        break;

      case 'BRAKING':
        this.throttle = 0;
        this.brake = true;
        if (this.speed > 2.0) {
          this.current = -14.5;
          this.speed = Math.max(0, this.speed - 9.5 * dt);
        } else {
          this.current = 0.2;
          this.speed = 0.0;
        }
        break;

      case 'CHARGING':
        this.throttle = 0;
        this.brake = false;
        this.speed = 0.0;
        this.current = -8.5;
        break;
    }

    const rpm = this.speed > 0.1 ? Math.round((this.speed * 1000.0 / 60.0) / 0.80) : 0;
    const torqueNm = this.current > 0 ? Number((this.current * 0.45).toFixed(1)) : 0.0;
    const distanceDelta = (this.speed * (dt / 3600.0));
    this.odoKm += distanceDelta;
    this.tripKm += distanceDelta;

    const deltaSocPercent = (this.current * (dt / 3600.0) / 20.0) * 100.0;
    if (this.currentState === 'CHARGING') {
      this.soc = Math.min(100.0, this.soc + 0.05 * dt * 10);
    } else {
      this.soc = Math.max(0.0, Math.min(100.0, this.soc - deltaSocPercent));
    }

    const ocv = 42.0 + (58.8 - 42.0) * (this.soc / 100.0);
    const voltageSag = this.current * 0.055;
    const terminalVoltage = Math.max(38.0, Math.min(59.5, ocv - voltageSag));
    const powerKw = (terminalVoltage * this.current) / 1000.0;

    const ambientTemp = 25.0;
    const motorHeatGain = (Math.max(0, this.current) ** 2) * 0.00015;
    const motorCooling = (this.motorTemp - ambientTemp) * 0.008;
    this.motorTemp += (motorHeatGain - motorCooling) * dt;

    const ctrlHeatGain = Math.abs(this.current) * 0.012;
    const ctrlCooling = (this.controllerTemp - ambientTemp) * 0.010;
    this.controllerTemp += (ctrlHeatGain - ctrlCooling) * dt;

    const battHeatGain = (this.current ** 2) * 0.00008;
    const battCooling = (this.batteryTemp - ambientTemp) * 0.005;
    this.batteryTemp += (battHeatGain - battCooling) * dt;

    const ridingMode: RidingMode = this.speed > 35 ? 'SPORT' : this.speed > 15 ? 'CITY' : 'ECO';

    const normalized: NormalizedTelemetry = {
      timestampUtc: this.lastPacketTimestamp,
      isMock: true,
      dataSource: 'MOCK',
      connection: this.getConnectionInfo(),
      rawHex: 'A5 40 90 08 01 F4 01 F4 75 30 03 E8 77',
      vehicle: {
        speedKmh: Number(this.speed.toFixed(1)),
        odometerKm: Number(this.odoKm.toFixed(1)),
        tripKm: Number(this.tripKm.toFixed(2)),
        state: this.currentState,
        ridingMode,
        direction: 'FORWARD',
        throttlePercent: this.throttle,
        brakeActive: this.brake,
      },
      battery: {
        socPercent: Number(this.soc.toFixed(1)),
        sohPercent: 98.4,
        sopKw: Number(powerKw.toFixed(2)),
        voltage: Number(terminalVoltage.toFixed(2)),
        rawVoltage: Number(ocv.toFixed(2)),
        currentAmperes: Number(this.current.toFixed(2)),
        powerWatts: Math.round(powerKw * 1000),
        temperatureCelsius: Number(this.batteryTemp.toFixed(1)),
        chargingState: this.current < -0.5 ? 'REGEN_CHARGING' : this.current > 0.5 ? 'DISCHARGING' : 'IDLE',
      },
      motor: {
        rpm,
        torqueNm,
        temperatureCelsius: Number(this.motorTemp.toFixed(1)),
        currentAmperes: Number(Math.abs(this.current).toFixed(1)),
        voltage: Number(terminalVoltage.toFixed(1)),
        powerKw: Number(Math.abs(powerKw).toFixed(2)),
      },
      controller: {
        temperatureCelsius: Number(this.controllerTemp.toFixed(1)),
        dcBusVoltage: Number(terminalVoltage.toFixed(2)),
        state: this.currentState === 'OFF' ? 'OFFLINE' : `${this.currentState} (NOMINAL)`,
        faultState: 'NOMINAL (NO FAULTS)',
        communicationState: 'MOCK SIMULATOR LINK (10 Hz)',
      },
      control: {
        reverse: false,
        cruise: this.currentState === 'CRUISING',
        horn: false,
        brake: this.brake,
        headlight: this.currentState !== 'OFF',
      },
      faults: {
        hasActiveFaults: false,
        bmsFault: false,
        motorFault: false,
        controllerFault: false,
        communicationFault: false,
        activeFaults: [],
      },
    };

    this.notify(normalized);
  }

  private notify(data: NormalizedTelemetry) {
    this.listeners.forEach((listener) => listener(data));
  }
}
