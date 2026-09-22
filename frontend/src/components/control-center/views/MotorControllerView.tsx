import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Cpu,
  Lock,
  LineChart,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

interface MotorHistoryPoint {
  rpm: number;
  torque: number;
  motorTemp: number;
  powerKw: number;
}

export const MotorControllerView: React.FC<Props> = ({ data }) => {
  const t = data?.telemetry;

  const voltage = t?.calibrated_pack_voltage ?? null;
  const current = t?.current_amperes ?? null;
  const speed = t?.speed_kmh ?? null;
  
  const rpm = t?.motor_rpm ?? (speed !== null ? Math.round((speed * 1000 / 60) / 0.8) : null);
  const torqueNm = current !== null ? Math.abs(current * 0.45) : null;
  const motorTemp = t?.motor_temperature_celsius ?? null;
  const controllerTemp = t?.controller_temperature_celsius ?? null;
  const motorPowerKw = voltage !== null && current !== null ? Math.abs(voltage * current) / 1000.0 : null;

  const [history, setHistory] = useState<MotorHistoryPoint[]>([]);

  useEffect(() => {
    if (!t) return;
    const pt: MotorHistoryPoint = {
      rpm: rpm ?? 0,
      torque: torqueNm ?? 0,
      motorTemp: motorTemp ?? 25.0,
      powerKw: motorPowerKw ?? 0,
    };
    setHistory((prev) => [...prev.slice(-29), pt]);
  }, [t, rpm, torqueNm, motorTemp, motorPowerKw]);

  const renderSparkline = (pts: number[], minVal: number, maxVal: number, strokeColor: string) => {
    if (pts.length < 2) return null;
    const range = maxVal - minVal || 1;
    const width = 240;
    const height = 60;
    const coords = pts.map((p, idx) => {
      const x = (idx / (pts.length - 1)) * width;
      const y = height - ((p - minVal) / range) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(' ')}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h2 className="text-2xl font-bold font-display text-white tracking-wide">
            MOTOR & INVERTER CONTROLLER
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            BLDC traction motor diagnostics and inverter switching telemetry.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5 self-start sm:self-auto">
          <Lock className="w-3 h-3 text-cyan-400" /> READ-ONLY INTERLOCK
        </span>
      </div>

      {/* DUAL DECK: Motor (Left) vs Controller (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-display">
        {/* Motor Card */}
        <div className="bg-[#050812] border border-cyan-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center text-xs font-sans text-slate-400 font-bold uppercase">
            <span>Traction Motor Dynamics</span>
            <RotateCw className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-sans text-slate-500 uppercase block">Motor Speed</span>
              <span className="text-4xl font-bold text-white mt-1 block">{rpm ?? '--'} <span className="text-sm font-sans text-cyan-400">RPM</span></span>
            </div>
            <div>
              <span className="text-[10px] font-sans text-slate-500 uppercase block">Shaft Torque</span>
              <span className="text-4xl font-bold text-emerald-400 mt-1 block">{torqueNm !== null ? `${torqueNm.toFixed(1)}` : '--'} <span className="text-sm font-sans text-emerald-500">Nm</span></span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-800/80 text-xs font-sans text-slate-400">
            <span>Stator Temp: <strong className="text-rose-400 font-display">{motorTemp !== null ? `${motorTemp.toFixed(1)}°C` : '--'}</strong></span>
            <span>Output: <strong className="text-white font-display">{motorPowerKw !== null ? `${motorPowerKw.toFixed(2)} kW` : '--'}</strong></span>
          </div>
        </div>

        {/* Controller Card */}
        <div className="bg-[#050812] border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center text-xs font-sans text-slate-400 font-bold uppercase">
            <span>Inverter Power Stage</span>
            <Cpu className="w-5 h-5 text-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-sans text-slate-500 uppercase block">MOSFET Heatsink</span>
              <span className="text-4xl font-bold text-white mt-1 block">{controllerTemp !== null ? `${controllerTemp.toFixed(1)}` : '--'} <span className="text-sm font-sans text-amber-400">°C</span></span>
            </div>
            <div>
              <span className="text-[10px] font-sans text-slate-500 uppercase block">DC Rail Potential</span>
              <span className="text-4xl font-bold text-cyan-300 mt-1 block">{voltage !== null ? `${voltage.toFixed(1)}` : '--'} <span className="text-sm font-sans text-cyan-400">V</span></span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-800/80 text-xs font-sans text-slate-400">
            <span>Phase Draw: <strong className="text-white font-display">{current !== null ? `${Math.abs(current).toFixed(1)} A` : '--'}</strong></span>
            <span>Commutation: <strong className="text-emerald-400 font-display">120° TRAPEZOIDAL</strong></span>
          </div>
        </div>
      </div>

      {/* SYNCHRONIZED 4-TRACK OSCILLOSCOPE */}
      <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-200 font-display uppercase tracking-wider flex items-center gap-2">
            <LineChart className="w-4 h-4 text-cyan-400" /> Synchronized Powertrain Oscilloscope
          </span>
          <span className="text-[10px] font-mono text-slate-500">10 Hz REALTIME RECORDING</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#03050a] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>RPM WAVE</span>
              <span className="text-cyan-400 font-bold">{rpm ?? '--'}</span>
            </div>
            <div className="py-2">{renderSparkline(history.map((h) => h.rpm), 0, 1000, '#00f0ff')}</div>
          </div>

          <div className="bg-[#03050a] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>TORQUE (Nm)</span>
              <span className="text-emerald-400 font-bold">{torqueNm !== null ? torqueNm.toFixed(1) : '--'}</span>
            </div>
            <div className="py-2">{renderSparkline(history.map((h) => h.torque), 0, 20, '#10b981')}</div>
          </div>

          <div className="bg-[#03050a] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>MOTOR TEMP</span>
              <span className="text-rose-400 font-bold">{motorTemp !== null ? `${motorTemp}°` : '--'}</span>
            </div>
            <div className="py-2">{renderSparkline(history.map((h) => h.motorTemp), 20, 85, '#f43f5e')}</div>
          </div>

          <div className="bg-[#03050a] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>POWER (kW)</span>
              <span className="text-amber-300 font-bold">{motorPowerKw !== null ? motorPowerKw.toFixed(2) : '--'}</span>
            </div>
            <div className="py-2">{renderSparkline(history.map((h) => h.powerKw), 0, 2.5, '#f59e0b')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
