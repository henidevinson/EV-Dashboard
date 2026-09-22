import React, { useState } from 'react';
import { TelemetryContextProvider, useTelemetry } from './context/TelemetryContext';
import { TopBar } from './components/TopBar';
import { SpeedometerGauge } from './components/SpeedometerGauge';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { BottomIndicators } from './components/BottomIndicators';
import { ControlCenterModal } from './components/control-center/ControlCenterModal';
import { TelemetryPayload } from './types/telemetry';
import { FaultCondition } from './types/normalizedTelemetry';

const DashboardCluster: React.FC = () => {
  const { telemetry, status, isMock } = useTelemetry();
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);

  const isConnected = status === 'CONNECTED';
  const faults = isConnected ? telemetry?.faults.activeFaults ?? [] : [];
  const powerKw = isConnected ? telemetry?.battery.sopKw ?? null : null;
  const speed = isConnected ? telemetry?.vehicle.speedKmh ?? null : null;
  const soc = isConnected ? telemetry?.battery.socPercent ?? null : null;
  const voltage = isConnected ? telemetry?.battery.voltage ?? null : null;
  const current = isConnected ? telemetry?.battery.currentAmperes ?? null : null;
  const motorTemp = isConnected ? telemetry?.motor.temperatureCelsius ?? null : null;
  const batteryTemp = isConnected ? telemetry?.battery.temperatureCelsius ?? null : null;
  const ridingMode = isConnected ? (telemetry?.vehicle.ridingMode ?? null) : null;
  const cellDeltaMv = isConnected ? telemetry?.battery.cellDeltaMv ?? null : null;

  // Adapt normalized telemetry to legacy modal prop interface
  const legacyPayload: TelemetryPayload | null = telemetry
    ? {
        status: status === 'COMMUNICATION_LOST' ? 'DATA_STALE' : status === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
        is_stale: status !== 'CONNECTED',
        seconds_since_last_packet: telemetry.connection.lastUpdateAge,
        interface: telemetry.dataSource,
        metrics: {
          bytes_received: 1024,
          frames_received: telemetry.connection.totalMessages,
          frames_valid: telemetry.connection.totalMessages,
          frames_corrupted: telemetry.connection.errorCount,
          frames_dropped: 0,
          packet_rate_hz: telemetry.connection.messageRate,
          byte_rate_bps: telemetry.connection.messageRate * 13,
        },
        telemetry: {
          timestamp_utc: telemetry.timestampUtc,
          raw_pack_voltage: telemetry.battery.rawVoltage ?? 0,
          calibrated_pack_voltage: telemetry.battery.voltage ?? 0,
          current_amperes: telemetry.battery.currentAmperes ?? 0,
          soc_percent: telemetry.battery.socPercent ?? 0,
          speed_kmh: telemetry.vehicle.speedKmh,
          motor_rpm: telemetry.motor.rpm,
          motor_temperature_celsius: telemetry.motor.temperatureCelsius,
          controller_temperature_celsius: telemetry.controller.temperatureCelsius,
          battery_temperature_celsius: telemetry.battery.temperatureCelsius,
          cell_voltages: telemetry.battery.cellVoltages ?? null,
          fault_codes: faults.map((f: FaultCondition) => f.code),
          raw_frame_hex: telemetry.rawHex,
          is_mock: telemetry.isMock,
          data_source: telemetry.dataSource,
        },
        faults,
      }
    : null;

  return (
    <div className="flex flex-col justify-between w-screen h-screen bg-[#040609] overflow-hidden select-none">
      <TopBar
        status={status}
        isMock={isMock}
        onMenuClick={() => setIsControlCenterOpen(true)}
      />

      <main className="flex-1 flex items-center justify-between px-8 py-2">
        <LeftPanel
          soc={soc}
          voltage={voltage}
          powerKw={powerKw}
          cellDeltaMv={cellDeltaMv}
        />

        <SpeedometerGauge
          speed={speed}
          odoKm={isConnected ? telemetry?.vehicle.odometerKm ?? null : null}
          tripKm={isConnected ? telemetry?.vehicle.tripKm ?? null : null}
          ridingMode={ridingMode}
        />

        <RightPanel
          motorTemp={motorTemp}
          batteryTemp={batteryTemp}
          currentAmps={current}
          faultsCount={faults.length}
          status={status}
        />
      </main>

      <BottomIndicators faults={faults} />

      <ControlCenterModal
        isOpen={isControlCenterOpen}
        onClose={() => setIsControlCenterOpen(false)}
        data={legacyPayload}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TelemetryContextProvider>
      <DashboardCluster />
    </TelemetryContextProvider>
  );
};

export default App;
