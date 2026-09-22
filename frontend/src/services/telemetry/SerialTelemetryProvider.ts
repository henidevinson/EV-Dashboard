import { TelemetryProvider, TelemetryListener } from './TelemetryProvider';
import { ConnectionStatus, ConnectionInfo } from '../../types/normalizedTelemetry';

export class SerialTelemetryProvider implements TelemetryProvider {
  readonly id = 'serial';
  readonly name = 'Direct WebSerial API (Future)';
  readonly description = 'Direct browser-to-ESP32 USB connection via Web Serial.';
  readonly isHardwareReady = false;

  private status: ConnectionStatus = 'DISCONNECTED';

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      status: this.status,
      connected: false,
      lastReceivedTimestamp: null,
      lastUpdateAge: null,
      messageRate: 0.0,
      totalMessages: 0,
      errorCount: 0,
      timeoutSeconds: 5.0,
    };
  }

  connect(): void {
    this.status = 'DISCONNECTED';
  }

  disconnect(): void {
    this.status = 'DISCONNECTED';
  }

  subscribe(_listener: TelemetryListener): () => void {
    return () => {};
  }
}
