import React from 'react';
import { ConnectionStatus } from '../types/normalizedTelemetry';

interface RightPanelProps {
  motorTemp: number | null;
  batteryTemp?: number | null;
  currentAmps: number | null;
  faultsCount: number;
  status: ConnectionStatus;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  motorTemp,
  batteryTemp = null,
  currentAmps,
  faultsCount,
  status,
}) => {
  const isAvailable = status === 'CONNECTED';
  const current = isAvailable && currentAmps !== null ? currentAmps : 0;
  const torqueNm = Math.abs(current * 0.45);
  const flowPercent = isAvailable ? Math.max(-100, Math.min(100, (current / 40) * 100)) : 0;

  // Drive Health calculation
  let healthText = 'SYSTEM OK';
  let healthColor = 'text-emerald-400 glow-green';

  if (status === 'DISCONNECTED') {
    healthText = 'DATA UNAVAILABLE';
    healthColor = 'text-slate-500';
  } else if (status === 'COMMUNICATION_LOST') {
    healthText = 'COMMUNICATION LOST';
    healthColor = 'text-rose-500 glow-red animate-pulse';
  } else if (status === 'CONNECTING') {
    healthText = 'INITIALIZING...';
    healthColor = 'text-cyan-400';
  } else if (faultsCount > 0) {
    healthText = 'FAULT DETECTED';
    healthColor = 'text-rose-500 glow-red animate-pulse';
  }

  return (
    <div className="flex flex-col items-end gap-5 min-w-[200px] select-none pr-4 text-right">
      {/* 1. Battery Pack Thermal (Real 31°C from Battery Sensors) */}
      <div className="flex flex-col items-end">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
          PACK THERMAL
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isAvailable && batteryTemp !== null
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-slate-700'
            }`}
          />
          <span className="text-xl font-bold text-white font-display">
            {isAvailable && batteryTemp !== null ? `${batteryTemp.toFixed(0)} °C` : '-- °C'}
          </span>
        </div>
      </div>

      {/* 2. Motor Stator Thermal */}
      <div className="flex flex-col items-end">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
          MOTOR THERMAL
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="text-sm font-bold text-slate-400 font-display">
            {isAvailable && motorTemp !== null ? `${motorTemp.toFixed(0)} °C` : 'NOT CONNECTED'}
          </span>
        </div>
      </div>

      {/* 3. Live Shaft Torque */}
      <div className="flex flex-col items-end mt-1">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
          LIVE TORQUE
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl font-bold text-white font-display">
            {isAvailable ? torqueNm.toFixed(1) : '0.0'}
          </span>
          <span className="text-xs font-semibold text-slate-400">Nm</span>
        </div>
      </div>

      {/* 4. Energy Flow */}
      <div className="flex flex-col items-end mt-2 w-40">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
          ENERGY FLOW
        </span>
        <div className="relative w-full h-2 rounded-full bg-[#121a28] mt-2 overflow-hidden border border-slate-800">
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-500 z-10" />
          {flowPercent > 0 ? (
            <div
              className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-cyan-500 to-amber-500 rounded-r-full"
              style={{ width: `${flowPercent / 2}%` }}
            />
          ) : flowPercent < 0 ? (
            <div
              className="absolute top-0 bottom-0 right-1/2 bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-l-full"
              style={{ width: `${Math.abs(flowPercent) / 2}%` }}
            />
          ) : null}
        </div>
        <div className="flex justify-between w-full text-[9px] font-semibold text-slate-500 mt-1 uppercase">
          <span>Regen</span>
          <span>Drive</span>
        </div>
      </div>

      {/* 5. Drive Health Indicator */}
      <div className="flex flex-col items-end mt-3">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
          DRIVE HEALTH
        </span>
        <div className="mt-1">
          <span className={`text-base font-extrabold tracking-wider font-display ${healthColor}`}>
            {healthText}
          </span>
        </div>
      </div>
    </div>
  );
};
