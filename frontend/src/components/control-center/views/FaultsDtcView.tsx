import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Trash2,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

type FilterCategory = 'ALL' | 'ACTIVE' | 'WARNING' | 'CLEARED';

interface DisplayFault {
  id: string;
  timestamp: string;
  subsystem: string;
  code: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'ACTIVE' | 'WARNING' | 'CLEARED';
  triggerValue?: number | null;
  thresholdValue?: number | null;
  isSimulated: boolean;
  diagnosticRemedy: string;
}

// Subsystem resolver based on safety rules
function resolveSubsystem(code: string): string {
  if (code.includes('VOLTAGE') || code.includes('BMS')) return 'Battery Management (BMS)';
  if (code.includes('CURRENT') || code.includes('DISCHARGE') || code.includes('CHARGE')) return 'Power Inverter & Bus';
  if (code.includes('MOTOR')) return 'BLDC Traction Motor';
  if (code.includes('CONTROLLER')) return 'Inverter Motor Controller';
  if (code.includes('COMMUNICATION') || code.includes('STALE')) return 'Serial / CAN Telemetry Bus';
  return 'Vehicle Supervisory (VCU)';
}

function resolveRemedy(code: string): string {
  if (code.includes('OVER_VOLTAGE')) return 'Inspect pack terminal voltage with calibrated DMM. Verify charger voltage cutoff regulator.';
  if (code.includes('UNDER_VOLTAGE')) return 'Low-voltage cutoff engaged. Connect auxiliary constant-current charger to prevent cell reversal.';
  if (code.includes('DISCHARGE')) return 'Motor drawing sustained current exceeding bus rating. Check for mechanical shaft binding or aggressive throttle profile.';
  if (code.includes('CHARGE')) return 'Regen braking current exceeds safe battery acceptance limits. Reduce regen deceleration curve.';
  if (code.includes('MOTOR_OVERTEMP')) return 'Stator core exceeds 85°C. Allow thermal dissipation. Inspect cooling air passages and bearing resistance.';
  if (code.includes('CONTROLLER_OVERTEMP')) return 'Inverter heatsink exceeds 75°C. Verify thermal paste contact and MOSFET heat dissipation mounting.';
  if (code.includes('COMMUNICATION') || code.includes('STALE')) return 'No telemetry frame received for > 5.0s. Check physical USB/UART harness and verify common ground.';
  return 'Perform full functional safety loop check across wiring harness.';
}

export const FaultsDtcView: React.FC<Props> = ({ data }) => {
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [selectedFault, setSelectedFault] = useState<DisplayFault | null>(null);
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [historicalList, setHistoricalList] = useState<DisplayFault[]>([]);

  const isMock = Boolean(data?.telemetry?.is_mock || data?.telemetry?.data_source === 'MOCK');

  // Fetch logged historical faults from SQLite persistence API
  useEffect(() => {
    fetch('/api/history/diagnostics/faults?limit=30')
      .then((res) => (res.ok ? res.json() : []))
      .then((records: Array<{ id: number; timestamp_utc: string; code: string; severity: string; message: string; trigger_value?: number; threshold_value?: number }>) => {
        if (Array.isArray(records)) {
          const mapped: DisplayFault[] = records.map((r) => ({
            id: `hist-${r.id}`,
            timestamp: r.timestamp_utc ? r.timestamp_utc.replace('T', ' ').slice(0, 19) : 'N/A',
            subsystem: resolveSubsystem(r.code),
            code: r.code,
            description: r.message,
            severity: (r.severity as 'CRITICAL' | 'WARNING' | 'INFO') || 'WARNING',
            status: 'CLEARED',
            triggerValue: r.trigger_value,
            thresholdValue: r.threshold_value,
            isSimulated: isMock,
            diagnosticRemedy: resolveRemedy(r.code),
          }));
          setHistoricalList(mapped);
        }
      })
      .catch(() => {
        // Fallback for isolated frontend mode
      });
  }, [isMock]);

  // Transform live incoming faults from WebSocket
  const liveActiveFaults: DisplayFault[] = (data?.faults ?? []).map((f, i) => {
    const isCritical = f.severity === 'CRITICAL';
    const id = `live-${f.code}-${i}`;
    const isCleared = clearedIds.has(id);
    return {
      id,
      timestamp: f.timestamp_utc ? f.timestamp_utc.replace('T', ' ').slice(0, 19) : new Date().toISOString().slice(0, 19).replace('T', ' '),
      subsystem: resolveSubsystem(f.code),
      code: f.code,
      description: f.message,
      severity: f.severity,
      status: isCleared ? 'CLEARED' : isCritical ? 'ACTIVE' : 'WARNING',
      triggerValue: f.trigger_value,
      thresholdValue: f.threshold_value,
      isSimulated: isMock,
      diagnosticRemedy: resolveRemedy(f.code),
    };
  });

  // Combine live faults and historical logs
  const allFaults: DisplayFault[] = [...liveActiveFaults, ...historicalList];

  // Filtering
  const filteredFaults = allFaults.filter((f) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return f.status === 'ACTIVE';
    if (filter === 'WARNING') return f.status === 'WARNING';
    if (filter === 'CLEARED') return f.status === 'CLEARED';
    return true;
  });

  const activeCount = allFaults.filter((f) => f.status === 'ACTIVE').length;
  const warningCount = allFaults.filter((f) => f.status === 'WARNING').length;
  const clearedCount = allFaults.filter((f) => f.status === 'CLEARED').length;

  const handleClearFault = (id: string) => {
    setClearedIds((prev) => new Set(prev).add(id));
    if (selectedFault?.id === id) {
      setSelectedFault((prev) => (prev ? { ...prev, status: 'CLEARED' } : null));
    }
  };

  const handleClearAllActive = () => {
    const newSet = new Set(clearedIds);
    liveActiveFaults.forEach((f) => newSet.add(f.id));
    setClearedIds(newSet);
    if (selectedFault) {
      setSelectedFault((prev) => (prev ? { ...prev, status: 'CLEARED' } : null));
    }
  };

  return (
    <div className="space-y-6 select-none font-sans pb-6">
      {/* Header & Category Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-display text-white tracking-wide">
              DIAGNOSTIC TROUBLE CODES (DTC)
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300 font-mono">
              SAE & ISO SAFETY LOGS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time threshold trips, electrical interlocks, and historical fault audit records.
          </p>
        </div>

        {activeCount > 0 && (
          <button
            onClick={handleClearAllActive}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg flex items-center gap-2 transition-colors self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Acknowledge All ({activeCount})
          </button>
        )}
      </div>

      {/* R&D Notice on Vendor DTC Codes */}
      <div className="bg-[#080d16] border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-cyan-300 uppercase tracking-wider block">
            R&D Engineering Telemetry Standard:
          </span>
          Fault codes displayed below originate from physical safety threshold evaluators (overvoltage, undervoltage, thermal trip points).
          Proprietary vendor hex DTC tables (e.g. FarDriver / Kelly / Lingbo CAN registers) will be mapped upon delivery of physical controller documentation.
        </div>
      </div>

      {/* Filter Tabs & Quick Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 font-display">
        <div className="flex bg-[#080d16] border border-slate-800 rounded-lg p-1 text-xs">
          {(['ALL', 'ACTIVE', 'WARNING', 'CLEARED'] as FilterCategory[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-md font-bold transition-colors ${
                filter === tab
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Counter Pills */}
        <div className="flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-[#080d16] border border-slate-800 text-slate-300 flex items-center gap-1.5">
            Total: <strong className="text-white">{allFaults.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-1.5">
            Active: <strong>{activeCount}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-950/50 border border-amber-500/40 text-amber-300 flex items-center gap-1.5">
            Warning: <strong>{warningCount}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
            Cleared: <strong>{clearedCount}</strong>
          </span>
        </div>
      </div>

      {/* Main Grid: Fault Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left / Main Table Column */}
        <div className={`space-y-2.5 ${selectedFault ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {filteredFaults.length === 0 ? (
            <div className="bg-[#080d16] border border-dashed border-slate-800 rounded-xl p-10 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="text-emerald-400 font-bold font-display text-sm tracking-wide">
                ZERO FAULTS RECORDED IN THIS CATEGORY
              </span>
              <span>All monitored powertrain interlocks are operating within safe bounds.</span>
            </div>
          ) : (
            filteredFaults.map((f) => {
              const isSelected = selectedFault?.id === f.id;
              const isCritical = f.severity === 'CRITICAL';
              const isCleared = f.status === 'CLEARED';

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFault(f)}
                  className={`bg-[#080d16] border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                      : isCritical && !isCleared
                      ? 'border-rose-500/50 hover:border-rose-400'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isCleared ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isCritical ? (
                        <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-sm text-white tracking-wide">
                          {f.code}
                        </span>

                        {/* MOCK TAG GUARANTEE */}
                        {f.isSimulated && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-500/60 text-amber-300 font-mono tracking-wider">
                            SIMULATED FAULT
                          </span>
                        )}

                        <span className="text-[10px] text-slate-500 font-mono">• {f.subsystem}</span>
                      </div>

                      <p className="text-xs text-slate-300 mt-1">{f.description}</p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {f.timestamp}
                        </span>
                        {f.triggerValue !== undefined && f.triggerValue !== null && (
                          <span>Trigger: {f.triggerValue}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-display tracking-wider ${
                        isCleared
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                          : isCritical
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {f.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right / Fault Detail Drawer Panel */}
        {selectedFault && (
          <div className="lg:col-span-5 bg-[#080d16] border border-cyan-500/40 rounded-xl p-5 space-y-4 shadow-xl sticky top-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                  Diagnostic Fault Inspector
                </span>
                <h3 className="text-base font-bold font-display text-white mt-0.5 flex items-center gap-2">
                  {selectedFault.code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFault(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MOCK TAG ON DETAIL PANEL */}
            {selectedFault.isSimulated && (
              <div className="p-2 rounded bg-amber-950/60 border border-amber-500/60 text-amber-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>SIMULATED FAULT:</strong> Emitted by synthetic test generator. Not a physical vehicle defect.
                </span>
              </div>
            )}

            {/* Subsystem & Severity Info */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Subsystem:</span>
                <span className="font-bold text-white text-right">{selectedFault.subsystem}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Severity Tier:</span>
                <span className={`font-bold ${selectedFault.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {selectedFault.severity}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-cyan-300 font-mono">{selectedFault.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">First Logged:</span>
                <span className="text-slate-300 font-mono">{selectedFault.timestamp}</span>
              </div>
            </div>

            {/* Measurements */}
            <div className="bg-[#040609] border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-bold">
                Telemetry Threshold Trip Data
              </span>
              <div className="flex justify-between text-slate-300">
                <span>Measured Value:</span>
                <span className="text-rose-400 font-bold">
                  {selectedFault.triggerValue !== undefined && selectedFault.triggerValue !== null ? selectedFault.triggerValue : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Safe Threshold:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedFault.thresholdValue !== undefined && selectedFault.thresholdValue !== null ? selectedFault.thresholdValue : 'Pre-configured'}
                </span>
              </div>
            </div>

            {/* Engineering Action / Remedy */}
            <div className="space-y-1.5 text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider block font-sans">
                Bench Diagnostic Recommendation
              </span>
              <p className="text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-800 leading-relaxed font-sans">
                {selectedFault.diagnosticRemedy}
              </p>
            </div>

            {/* Clear Button */}
            {selectedFault.status !== 'CLEARED' && (
              <button
                onClick={() => handleClearFault(selectedFault.id)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 uppercase tracking-wider transition-colors font-sans"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Acknowledge & Mark Cleared
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
