import React, { createContext, useContext, useEffect, useState } from 'react';
import { NormalizedTelemetry, ConnectionStatus, ConnectionInfo } from '../types/normalizedTelemetry';
import { telemetryService } from '../services/telemetry/TelemetryService';
import { TelemetryProvider } from '../services/telemetry/TelemetryProvider';

interface TelemetryContextValue {
  telemetry: NormalizedTelemetry | null;
  status: ConnectionStatus;
  connection: ConnectionInfo;
  isMock: boolean;
  providerId: string;
  availableProviders: TelemetryProvider[];
  setProviderId: (id: string) => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export const TelemetryContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<NormalizedTelemetry | null>(telemetryService.getLatest());
  const [providerId, setProviderIdState] = useState<string>(telemetryService.getActiveProviderId());

  useEffect(() => {
    return telemetryService.subscribe((data: NormalizedTelemetry) => {
      setTelemetry(data);
    });
  }, [providerId]);

  const setProviderId = (id: string) => {
    telemetryService.setProvider(id);
    setProviderIdState(id);
  };

  const connection = telemetry?.connection ?? telemetryService.getConnectionInfo();

  const value: TelemetryContextValue = {
    telemetry,
    status: connection.status,
    connection,
    isMock: Boolean(telemetry?.isMock || providerId === 'mock'),
    providerId,
    availableProviders: telemetryService.getProviders(),
    setProviderId,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = (): TelemetryContextValue => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within TelemetryContextProvider');
  }
  return context;
};
