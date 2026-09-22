import { TelemetryProvider, TelemetryListener } from './TelemetryProvider';
import { ConnectionStatus, ConnectionInfo } from '../../types/normalizedTelemetry';

export class CanTelemetryProvider implements TelemetryProvider {
  readonly id = 'can';
  readonly name = 'Native CAN Controller (ISO 11898 Future)';
  readonly description = 'Physical differential CAN_H / CAN_L bus transceiver tap.';
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
    this.status = 'COMMUNICATION_LOST';
  }

  disconnect(): void {
    this.status = 'DISCONNECTED';
  }

  subscribe(_listener: TelemetryListener): () => void {
    return () => {};
  }
}
