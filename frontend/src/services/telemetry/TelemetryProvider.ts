import { ConnectionStatus, ConnectionInfo, NormalizedTelemetry } from '../../types/normalizedTelemetry';

export type TelemetryListener = (telemetry: NormalizedTelemetry) => void;

export interface TelemetryProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isHardwareReady: boolean;
  getStatus(): ConnectionStatus;
  getConnectionInfo(): ConnectionInfo;
  connect(): void;
  disconnect(): void;
  subscribe(listener: TelemetryListener): () => void;
}
