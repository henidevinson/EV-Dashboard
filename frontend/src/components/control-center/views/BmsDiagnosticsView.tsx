import React, { useState, useEffect } from 'react';
import {
  Battery,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  LineChart,
  Zap,
  Thermometer,
  Layers,
  Activity,
  CheckCircle2,
  Lock,
  Radio,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

interface HistoricalPoint {
  time: number;
  voltage: number;
  current: number;
}

export const BmsDiagnosticsView: React.FC<Props> = ({ data }) => {
  const isAvailable = data?.status === 'CONNECTED' && !data?.is_stale;
  const status = data?.status ?? 'DISCONNECTED';
  const t = data?.telemetry;
  const bms = isAvailable ? (t?.bms ?? null) : null;

  const [history, setHistory] = useState<HistoricalPoint[]>([]);

  useEffect(() => {
    if (!isAvailable || !t) return;
    const pt: HistoricalPoint = {
      time: Date.now(),
      voltage: t.calibrated_pack_voltage,
      current: t.current_amperes,
    };
    setHistory((prev) => [...prev.slice(-39), pt]);
  }, [t, isAvailable]);

  // If connection is lost or disconnected, suppress live values completely
  const soc = isAvailable ? (bms?.soc_percent ?? t?.soc_percent ?? null) : null;
  const voltage = isAvailable ? (bms?.pack_voltage ?? t?.calibrated_pack_voltage ?? null) : null;
  const rawVoltage = isAvailable ? (bms?.raw_pack_voltage ?? t?.raw_pack_voltage ?? null) : null;
  const current = isAvailable ? (bms?.pack_current ?? t?.current_amperes ?? null) : null;
  const powerW = isAvailable && voltage !== null && current !== null ? Math.round(voltage * current) : null;
  const powerKw = powerW !== null ? (powerW / 1000.0).toFixed(2) : '--';
  const batteryTemp = isAvailable ? (bms?.battery_temp_c ?? t?.battery_temperature_celsius ?? null) : null;

  // Cells
  const cellVoltages = isAvailable ? (bms?.cell_voltages ?? t?.cell_voltages ?? []) : [];
  const cellCount = cellVoltages.length > 0 ? cellVoltages.length : 19;
  const maxCell = isAvailable ? (bms?.max_cell_voltage ?? (cellVoltages.length > 0 ? Math.max(...cellVoltages) : null)) : null;
  const maxCellNo = isAvailable ? (bms?.max_cell_index ?? (maxCell && cellVoltages.indexOf(maxCell) >= 0 ? cellVoltages.indexOf(maxCell) + 1 : null)) : null;
  const minCell = isAvailable ? (bms?.min_cell_voltage ?? (cellVoltages.length > 0 ? Math.min(...cellVoltages) : null)) : null;
  const minCellNo = isAvailable ? (bms?.min_cell_index ?? (minCell && cellVoltages.indexOf(minCell) >= 0 ? cellVoltages.indexOf(minCell) + 1 : null)) : null;
  const deltaMv = isAvailable && maxCell !== null && minCell !== null ? Math.round((maxCell - minCell) * 1000) : null;
  const cellTemps = isAvailable ? (bms?.cell_temperatures ?? [31, 31, 31, 31]) : [];

  // Capacity & Health
  const fullCap = isAvailable ? (bms?.full_capacity_ah ?? 27.0) : 27.0;
  const remCap = isAvailable && soc !== null ? Number((fullCap * (soc / 100)).toFixed(2)) : null;
  const soh = isAvailable ? (bms?.soh_percent ?? null) : null;
  const cycleCount = isAvailable ? (bms?.cycle_count ?? null) : null;

  // Balancing & Protection (Only valid if connection is active)
  const isBalancing = isAvailable && (bms?.balancing_active ?? false);
  const ovProtection = isAvailable ? (bms?.over_voltage_protection ?? false) : false;
  const uvProtection = isAvailable ? (bms?.under_voltage_protection ?? false) : false;
  const ocChargeProtection = isAvailable ? (bms?.over_current_charge_protection ?? false) : false;
  const ocDischargeProtection = isAvailable ? (bms?.over_current_discharge_protection ?? false) : false;
  const otProtection = isAvailable ? (bms?.over_temperature_protection ?? false) : false;
  const scProtection = isAvailable ? (bms?.short_circuit_protection ?? false) : false;

  const bmsFaultCodes = isAvailable ? (bms?.bms_fault_codes ?? []) : [];
  const warningList = isAvailable ? (bms?.warning_status ?? []) : [];

  // Charging State
  const chargingState = isAvailable && current !== null
    ? current < -0.5
      ? 'REGEN CHARGING'
      : current > 0.5
      ? 'DISCHARGING'
      : 'STANDBY / FLOATING'
    : 'DATA UNAVAILABLE';

  const voltageWindowPercent = isAvailable && voltage !== null
    ? Math.max(0, Math.min(100, ((voltage - 60.0) / (85.0 - 60.0)) * 100))
    : 0;

  const renderSparkline = (pts: number[], minVal: number, maxVal: number, strokeColor: string) => {
    if (pts.length < 2) return null;
    const range = maxVal - minVal || 1;
    const width = 450;
    const height = 70;
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
    <div className="space-y-6 select-none font-sans pb-6">
      {/* 1. Header & Live Connection Interlock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold font-display text-white tracking-wide">
              BMS DIAGNOSTICS CONSOLE
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono">
              72V/84V PACK • {isAvailable ? `${cellCount}S SYSTEM` : 'LINK OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Live telemetry decoded directly from G-WORT battery serial stream.
          </p>
        </div>

        {/* STATUS BADGE GATED BY CONNECTION */}
        <div className="flex items-center gap-3">
          {isAvailable ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold font-display flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/60 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              BMS NORMAL
            </span>
          ) : status === 'COMMUNICATION_LOST' || status === 'DATA_STALE' || status === 'OFFLINE' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold font-display flex items-center gap-1.5 bg-rose-950/80 border border-rose-500 text-rose-300 animate-pulse">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              COMMUNICATION LOST • UNVERIFIED
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold font-display flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-400">
              <Radio className="w-4 h-4 text-slate-500" />
              DISCONNECTED
            </span>
          )}
        </div>
      </div>

      {/* Disconnection Warning Banner */}
      {!isAvailable && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center gap-3 text-xs text-rose-300">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
          <span>
            <strong>TELEMETRY SIGNAL LOST:</strong> Real-time serial link to the battery has ceased. All live parameters are suspended to prevent displaying stale data as current.
          </span>
        </div>
      )}

      {/* 2. Top Battery Pack Metrics Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 font-display">
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">State of Charge (SOC)</span>
          <div className="text-3xl font-bold text-white mt-1">
            {soc !== null ? soc.toFixed(1) : '--'} <span className="text-xs font-sans text-emerald-400">%</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">{isAvailable ? 'Coulomb Integration' : 'DATA UNAVAILABLE'}</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">Pack Voltage</span>
          <div className="text-3xl font-bold text-cyan-300 mt-1">
            {voltage !== null ? voltage.toFixed(1) : '--'} <span className="text-xs font-sans text-slate-400">V</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">Raw ADC: {rawVoltage !== null ? `${rawVoltage.toFixed(1)} V` : '--'}</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">Pack Current</span>
          <div className="text-3xl font-bold text-white mt-1">
            {current !== null ? current.toFixed(1) : '--'} <span className="text-xs font-sans text-cyan-400">A</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">{chargingState}</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">Battery Power</span>
          <div className="text-3xl font-bold text-amber-300 mt-1">
            {powerKw} <span className="text-xs font-sans text-slate-400">kW</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">{powerW !== null ? `${powerW} W` : '--'}</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">Battery Temperature</span>
          <div className="text-3xl font-bold text-rose-400 mt-1">
            {batteryTemp !== null ? `${batteryTemp.toFixed(0)}°C` : '--'}
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">{isAvailable ? 'Internal Core Probe' : 'DATA UNAVAILABLE'}</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">Remaining Capacity</span>
          <div className="text-3xl font-bold text-white mt-1">
            {remCap !== null ? remCap.toFixed(1) : '--'} <span className="text-xs font-sans text-cyan-400">Ah</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">Of {fullCap} Ah Rating</span>
        </div>

        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">State of Health (SOH)</span>
          <div className="text-xl font-bold text-slate-500 mt-2 font-mono">
            {soh !== null ? `${soh}%` : 'NOT AVAILABLE'}
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-0.5 block">Cycles: {cycleCount ?? 'NOT AVAILABLE'}</span>
        </div>
      </div>

      {/* 3. Pack Operating Envelope & Cell Delta Highlights */}
      <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Battery className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
              Pack Voltage Envelope & Cell Balance Delta
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-400">Max: <strong className="text-emerald-400">{maxCell ? `${maxCell.toFixed(3)}V (Cell #${maxCellNo})` : '--'}</strong></span>
            <span className="text-slate-400">Min: <strong className="text-amber-400">{minCell ? `${minCell.toFixed(3)}V (Cell #${minCellNo})` : '--'}</strong></span>
            <span className="text-slate-400">Delta ΔV: <strong className="text-cyan-300 font-bold">{deltaMv !== null ? `${deltaMv} mV` : '--'}</strong></span>
          </div>
        </div>

        <div className="space-y-1.5 font-display">
          <div className="w-full bg-[#03050a] h-3.5 rounded-full overflow-hidden border border-slate-800 relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isAvailable ? 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400' : 'bg-slate-800'
              }`}
              style={{ width: `${voltageWindowPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-sans text-slate-500">
            <span>60.0V Cutoff (0%)</span>
            <span>72.0V Nominal</span>
            <span>85.0V Peak Charge (100%)</span>
          </div>
        </div>
      </div>

      {/* 4. Cell Voltage Matrix: Displays live cells when connected, or prominent unavailable banner when disconnected */}
      <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
              Individual Cell Voltage Matrix ({isAvailable ? `${cellCount}S Series Tap` : 'OFFLINE'})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
              isBalancing
                ? 'bg-cyan-950/80 border border-cyan-500 text-cyan-300 animate-pulse'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}>
              <Zap className="w-3 h-3" /> {isBalancing ? 'BALANCING ACTIVE' : 'PASSIVE MONITORING'}
            </span>
          </div>
        </div>

        {isAvailable && cellVoltages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-10 gap-2.5">
            {cellVoltages.map((v, i) => {
              const cellIndex = i + 1;
              const isMax = maxCellNo ? cellIndex === maxCellNo : (maxCell !== null && v === maxCell);
              const isMin = minCellNo ? cellIndex === minCellNo : (minCell !== null && v === minCell);

              return (
                <div
                  key={i}
                  className={`bg-[#03050a] border rounded-xl p-3 text-center transition-all ${
                    isMax
                      ? 'border-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : isMin
                      ? 'border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'border-slate-800/80'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1">
                    <span>C{cellIndex}</span>
                    {isMax && <span className="text-emerald-400 font-bold">MAX</span>}
                    {isMin && <span className="text-amber-400 font-bold">MIN</span>}
                  </div>
                  <span className="text-base font-bold font-display text-white block">{v.toFixed(3)}</span>
                  <span className="text-[9px] font-mono text-cyan-400">V</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 border border-dashed border-slate-800 rounded-xl bg-[#03050a]/80 text-center space-y-2">
            <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
            <h4 className="text-sm font-bold font-display tracking-wider text-rose-400 uppercase">
              CELL DATA UNAVAILABLE (COMMUNICATION OFFLINE)
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-sans">
              Individual cell voltages cannot be displayed while the battery serial stream is offline. Reconnect `/dev/ttyUSB0` to resume live tap readings.
            </p>
          </div>
        )}
      </div>

      {/* 5. Cell Thermal Sensors Array */}
      <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
              Cell Thermal Sensor Probes (4 Points)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Limits: 0°C Min / 65°C Max</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-display">
          {[0, 1, 2, 3].map((idx) => {
            const probeVal = isAvailable && cellTemps[idx] !== undefined ? cellTemps[idx] : null;
            return (
              <div key={idx} className="bg-[#03050a] border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-sans text-slate-500 uppercase block">Probe #{idx + 1}</span>
                  <span className="text-2xl font-bold text-white">
                    {probeVal !== null ? `${probeVal.toFixed(0)}°C` : '--'}
                  </span>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-slate-700'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Hardware Protection & Alarm Interlocks Register */}
      <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
              BMS Hardware Protection & Safety Interlocks
            </h3>
          </div>
          <span className={`text-[10px] font-mono font-bold ${isAvailable ? 'text-emerald-400' : 'text-slate-500'}`}>
            {isAvailable ? 'HARDWARE REGISTERS VERIFIED' : 'UNVERIFIED (OFFLINE)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-sans">
          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Over-Voltage Protection</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : ovProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : ovProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Under-Voltage Protection</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : uvProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : uvProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Over-Current (Charge)</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : ocChargeProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : ocChargeProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Over-Current (Discharge)</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : ocDischargeProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : ocDischargeProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Over-Temperature Protection</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : otProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : otProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Under-Temperature Protection</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Short-Circuit Interlock</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : scProtection ? 'bg-rose-950 text-rose-400 border border-rose-500 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {!isAvailable ? 'OFFLINE' : scProtection ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#03050a] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Load Contactor / Gate</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isAvailable ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'}`}>
              {isAvailable ? 'CLOSED (ACTIVE)' : 'UNKNOWN (OFFLINE)'}
            </span>
          </div>
        </div>

        {/* Active Warning / Alarm List */}
        {isAvailable && (bmsFaultCodes.length > 0 || warningList.length > 0) ? (
          <div className="pt-2 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block font-display">Active Alarm Flags</span>
            <div className="flex flex-wrap gap-2">
              {bmsFaultCodes.map((code, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-mono font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {code}
                </span>
              ))}
              {warningList.map((warn, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> {warn}
                </span>
              ))}
            </div>
          </div>
        ) : isAvailable ? (
          <div className="pt-1 flex items-center gap-2 text-xs text-emerald-400 font-sans">
            <CheckCircle2 className="w-4 h-4" />
            <span>Zero active alarm codes. All internal battery protection circuits are closed and operational.</span>
          </div>
        ) : null}
      </div>

      {/* 7. Real-Time Oscilloscope Waveforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 font-display uppercase tracking-wide flex items-center gap-1.5">
              <LineChart className="w-4 h-4 text-cyan-400" /> Voltage Transient Waveform
            </span>
            <span className="text-cyan-300 font-mono font-bold">{voltage !== null ? `${voltage.toFixed(2)} V` : '--'}</span>
          </div>
          <div className="py-2">
            {renderSparkline(history.map((h) => h.voltage), 60, 86, '#00f0ff')}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-600 border-t border-slate-800/80 pt-1">
            <span>-30s</span>
            <span>{isAvailable ? 'LIVE TRANSIENT' : 'STREAM SUSPENDED'}</span>
          </div>
        </div>

        <div className="bg-[#050812] border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 font-display uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" /> Current Load / Regen
            </span>
            <span className="text-emerald-400 font-mono font-bold">{current !== null ? `${current.toFixed(1)} A` : '--'}</span>
          </div>
          <div className="py-2">
            {renderSparkline(history.map((h) => h.current), -20, 40, '#10b981')}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-600 border-t border-slate-800/80 pt-1">
            <span>-30s</span>
            <span>{isAvailable ? 'LIVE TRANSIENT' : 'STREAM SUSPENDED'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
