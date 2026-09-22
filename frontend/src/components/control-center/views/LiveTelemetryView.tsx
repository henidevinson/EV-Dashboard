import React from 'react';
import {
  Gauge,
  Zap,
  Activity,
  RotateCw,
  Compass,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

export const LiveTelemetryView: React.FC<Props> = ({ data }) => {
  const t = data?.telemetry;
  const isMock = Boolean(t?.is_mock || t?.data_source === 'MOCK');

  const voltage = t?.calibrated_pack_voltage ?? null;
  const current = t?.current_amperes ?? null;
  const powerKw = voltage !== null && current !== null ? (voltage * current) / 1000.0 : null;
  const speed = t?.speed_kmh ?? null;
  const soc = t?.soc_percent ?? null;
  const rpm = t?.motor_rpm ?? (speed !== null ? Math.round((speed * 1000 / 60) / 0.8) : null);
  const motorTemp = t?.motor_temperature_celsius ?? null;
  const controllerTemp = t?.controller_temperature_celsius ?? null;

  const ridingMode = speed !== null ? (speed > 35 ? 'SPORT' : speed > 15 ? 'CITY' : 'ECO') : 'NOT AVAILABLE';
  const direction = speed !== null ? (speed < -0.2 ? 'REVERSE' : speed > 0.2 ? 'FORWARD' : 'NEUTRAL') : 'NEUTRAL';
  const throttle = current !== null && current > 0 ? Math.min(100, Math.round((current / 35) * 100)) : 0;
  const brakeActive = current !== null && current < -1.0;

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Top Breadcrumb & Active Stream State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-2xl font-bold font-display text-white tracking-wide">
            LIVE TELEMETRY MONITOR
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Normalized real-time stream sampled at 10.0 Hz.
          </p>
        </div>

        {isMock ? (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-display bg-amber-950/70 border border-amber-500/80 text-amber-300 flex items-center gap-2 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-pulse self-start sm:self-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> MOCK DATA STREAM
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-display bg-emerald-950/70 border border-emerald-500/70 text-emerald-300 flex items-center gap-2 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> REAL VEHICLE STREAM
          </span>
        )}
      </div>

      {/* ZONE 1: PRIMARY HERO METRICS (Clean 3-Card Deck) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-display">
        {/* Speed & Mode Hero */}
        <div className="bg-gradient-to-b from-[#080f1e] to-[#040812] border border-cyan-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start text-xs font-sans text-slate-400 uppercase font-bold">
            <span>Vehicle Velocity</span>
            <Gauge className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-white tracking-tight">
              {speed !== null ? speed.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-sans font-semibold text-cyan-400 uppercase">km/h</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-sans">
            <span className="text-slate-400">Riding Mode: <strong className="text-cyan-300 font-display">{ridingMode}</strong></span>
            <span className="text-slate-400">RPM: <strong className="text-white font-display">{rpm ?? '--'}</strong></span>
          </div>
        </div>

        {/* High-Voltage Battery Hero */}
        <div className="bg-gradient-to-b from-[#061413] to-[#030c0c] border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start text-xs font-sans text-slate-400 uppercase font-bold">
            <span>Battery State</span>
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-emerald-400 tracking-tight">
              {soc !== null ? soc.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-sans font-semibold text-emerald-500">%</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-sans">
            <span className="text-slate-400">Voltage: <strong className="text-white font-display">{voltage !== null ? `${voltage.toFixed(2)} V` : '--'}</strong></span>
            <span className="text-slate-400">Current: <strong className="text-white font-display">{current !== null ? `${current.toFixed(1)} A` : '--'}</strong></span>
          </div>
        </div>

        {/* Inverter Power & Thermals Hero */}
        <div className="bg-gradient-to-b from-[#140e06] to-[#0d0903] border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start text-xs font-sans text-slate-400 uppercase font-bold">
            <span>Active Power Demand</span>
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-amber-300 tracking-tight">
              {powerKw !== null ? powerKw.toFixed(2) : '0.00'}
            </span>
            <span className="text-sm font-sans font-semibold text-amber-500">kW</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-sans">
            <span className="text-slate-400">Motor: <strong className="text-rose-400 font-display">{motorTemp !== null ? `${motorTemp}°C` : '--'}</strong></span>
            <span className="text-slate-400">Inverter: <strong className="text-amber-400 font-display">{controllerTemp !== null ? `${controllerTemp}°C` : '--'}</strong></span>
          </div>
        </div>
      </div>

      {/* ZONE 2: DETAILED SECONDARY PARAMETERS (Clean Key-Value Decks) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
        {/* Powertrain Dynamics Card */}
        <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-xs font-display">
            <RotateCw className="w-4 h-4 text-cyan-400" /> Powertrain Kinematics
          </div>
          <div className="divide-y divide-slate-800/60 pt-1">
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Inverter Rotation Direction</span>
              <span className="font-bold text-white font-display">{direction}</span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Throttle Hall Sensor Demand</span>
              <span className="font-bold text-cyan-300 font-display">{throttle}%</span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Brake Interlock Cutoff</span>
              <span className={`font-bold font-display ${brakeActive ? 'text-rose-400' : 'text-emerald-400'}`}>
                {brakeActive ? 'ENGAGED (REGEN)' : 'RELEASED'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Estimated Shaft Torque</span>
              <span className="font-bold text-emerald-400 font-display">
                {current !== null ? `${Math.abs(current * 0.45).toFixed(1)} Nm` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* High Voltage Bus Deck */}
        <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-xs font-display">
            <Compass className="w-4 h-4 text-emerald-400" /> Electrical High-Voltage Bus
          </div>
          <div className="divide-y divide-slate-800/60 pt-1">
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Raw Pack Voltage (Pre-Calibration)</span>
              <span className="font-bold text-slate-300 font-display">{t?.raw_pack_voltage ?? '--'} V</span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Calibrated DC Bus Potential</span>
              <span className="font-bold text-cyan-300 font-display">{voltage !== null ? `${voltage.toFixed(2)} V` : '--'}</span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Current Direction Mode</span>
              <span className="font-bold text-emerald-400 font-display">
                {current !== null ? (current < 0 ? 'REGENERATIVE CHARGING' : 'TRACTION DISCHARGE') : 'IDLE'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Raw Telemetry Frame (Audit)</span>
              <span className="font-mono text-[10px] text-slate-400 max-w-[200px] truncate">{t?.raw_frame_hex ?? 'NONE'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
