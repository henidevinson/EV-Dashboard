import { TelemetryProvider, TelemetryListener } from './TelemetryProvider';
import { MockTelemetryProvider } from './MockTelemetryProvider';
import { BackendWebSocketProvider } from './BackendWebSocketProvider';
import { SerialTelemetryProvider } from './SerialTelemetryProvider';
import { CanTelemetryProvider } from './CanTelemetryProvider';
import { NormalizedTelemetry, ConnectionStatus, ConnectionInfo } from '../../types/normalizedTelemetry';

class TelemetryServiceImpl {
  private providers: Map<string, TelemetryProvider> = new Map();
  private activeProvider: TelemetryProvider;
  private listeners: Set<TelemetryListener> = new Set();
  private unsubscribeCurrent: (() => void) | null = null;
  private latestTelemetry: NormalizedTelemetry | null = null;
  private autoDetectEnabled = true;

  constructor() {
    const mock = new MockTelemetryProvider();
    const ws = new BackendWebSocketProvider();
    const serial = new SerialTelemetryProvider();
    const can = new CanTelemetryProvider();

    this.providers.set(mock.id, mock);
    this.providers.set(ws.id, ws);
    this.providers.set(serial.id, serial);
    this.providers.set(can.id, can);

    // Default to live backend WebSocket by default
    this.activeProvider = ws;
    this.bindActiveProvider();

    // Background auto-monitor: If real hardware is transmitting on backend, automatically switch to it!
    ws.subscribe((telemetry) => {
      if (this.autoDetectEnabled && telemetry.connection.connected && !telemetry.isMock) {
        if (this.activeProvider.id !== 'backend_ws') {
          console.log('[AUTO-ARBITRATION] Physical battery detected on serial port. Automatically shifting to REAL DATA mode.');
          this.setProvider('backend_ws', false);
        }
      }
    });
  }

  getProviders(): TelemetryProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProviderId(): string {
    return this.activeProvider.id;
  }

  getStatus(): ConnectionStatus {
    return this.activeProvider.getStatus();
  }

  getConnectionInfo(): ConnectionInfo {
    return this.activeProvider.getConnectionInfo();
  }

  getLatest(): NormalizedTelemetry | null {
    return this.latestTelemetry;
  }

  setProvider(id: string, manualUserOverride = true): void {
    if (manualUserOverride) {
      // If user manually forces mock, pause auto-arbitration until they choose backend again
      this.autoDetectEnabled = id === 'backend_ws';
    }

    if (this.activeProvider.id === id) return;
    const next = this.providers.get(id);
    if (!next) return;

    if (this.unsubscribeCurrent) {
      this.unsubscribeCurrent();
      this.unsubscribeCurrent = null;
    }
    this.activeProvider.disconnect();

    this.activeProvider = next;
    localStorage.setItem('ev_telemetry_provider_mode', id);
    this.bindActiveProvider();
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    if (this.latestTelemetry) listener(this.latestTelemetry);
    return () => this.listeners.delete(listener);
  }

  private bindActiveProvider(): void {
    this.activeProvider.connect();
    this.unsubscribeCurrent = this.activeProvider.subscribe((telemetry) => {
      this.latestTelemetry = telemetry;
      this.listeners.forEach((fn) => fn(telemetry));
    });
  }
}

export const telemetryService = new TelemetryServiceImpl();
