import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Save,
  Download,
  Trash2,
  Clock,
  HardDrive,
  Database,
  Activity,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

// 14 Required Normalized Telemetry Fields
interface TelemetrySample {
  timestamp: string;
  speed: number | string;
  soc: number | string;
  voltage: number | string;
  current: number | string;
  power: number | string;
  rpm: number | string;
  torque: number | string;
  batteryTemp: number | string;
  motorTemp: number | string;
  throttle: number | string;
  brake: string;
  ridingMode: string;
  faultStatus: string;
}

interface SavedSession {
  id: string;
  name: string;
  startTime: string;
  durationSeconds: number;
  sampleCount: number;
  dataSizeKb: number;
  samples: TelemetrySample[];
}

export const DataLoggerView: React.FC<Props> = ({ data }) => {
  const [recordingState, setRecordingState] = useState<'IDLE' | 'RECORDING' | 'PAUSED'>('IDLE');
  const [currentSamples, setCurrentSamples] = useState<TelemetrySample[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [notification, setNotification] = useState<string>('');

  const timerRef = useRef<number | null>(null);

  // Load saved sessions from local persistent storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ev_telemetry_saved_sessions');
      if (stored) {
        setSavedSessions(JSON.parse(stored));
      }
    } catch {
      // Storage unavailable or empty
    }
  }, []);

  // Synchronize stopwatch timer
  useEffect(() => {
    if (recordingState === 'RECORDING') {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

  // Hook directly into live normalized telemetry stream
  useEffect(() => {
    if (recordingState !== 'RECORDING') return;

    const t = data?.telemetry;
    if (!t) return;

    // Extract exactly the 14 required normalized telemetry parameters
    const voltage = t.calibrated_pack_voltage !== null ? t.calibrated_pack_voltage : 'N/A';
    const current = t.current_amperes !== null ? t.current_amperes : 'N/A';
    const speed = t.speed_kmh !== null ? t.speed_kmh : 'N/A';
    const rpm = t.motor_rpm !== null
      ? t.motor_rpm
      : (t.speed_kmh !== null ? Math.round((t.speed_kmh * 1000 / 60) / 0.8) : 'N/A');
    const torque = t.current_amperes !== null ? Math.abs(t.current_amperes * 0.45).toFixed(1) : 'N/A';
    const power = (voltage !== 'N/A' && current !== 'N/A')
      ? (((voltage as number) * (current as number)) / 1000.0).toFixed(2)
      : 'N/A';
    const throttle = t.current_amperes !== null
      ? (t.current_amperes > 0 ? Math.min(100, Math.round((t.current_amperes / 40) * 100)) : 0)
      : 'N/A';
    const brake = t.current_amperes !== null && t.current_amperes < -1.0 ? 'ENGAGED' : 'RELEASED';
    const ridingMode = t.speed_kmh !== null
      ? (t.speed_kmh > 35 ? 'SPORT' : t.speed_kmh > 15 ? 'CITY' : 'ECO')
      : 'N/A';

    const faultsList = (data?.faults ?? []).map((f) => f.code);
    const faultStatus = faultsList.length > 0
      ? faultsList.join(';')
      : (t.fault_codes.length > 0 ? t.fault_codes.join(';') : 'NOMINAL');

    const sample: TelemetrySample = {
      timestamp: t.timestamp_utc || new Date().toISOString(),
      speed,
      soc: t.soc_percent !== null ? t.soc_percent : 'N/A',
      voltage,
      current,
      power,
      rpm,
      torque,
      batteryTemp: t.battery_temperature_celsius ?? 'N/A',
      motorTemp: t.motor_temperature_celsius ?? 'N/A',
      throttle,
      brake,
      ridingMode,
      faultStatus,
    };

    setCurrentSamples((prev) => [...prev, sample]);
  }, [data, recordingState]);

  // ==========================================
  // CONTROLLER ACTIONS: START / PAUSE / STOP / SAVE / DELETE / EXPORT
  // ==========================================
  const handleStart = () => {
    if (recordingState === 'IDLE') {
      const newId = `SESSION_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
      setActiveSessionId(newId);
      setCurrentSamples([]);
      setElapsedSeconds(0);
    }
    setRecordingState('RECORDING');
    setNotification('Telemetry recording engaged.');
  };

  const handlePause = () => {
    setRecordingState('PAUSED');
    setNotification('Telemetry recording paused.');
  };

  const handleStop = () => {
    setRecordingState('IDLE');
    setNotification('Recording halted. Buffer ready to save or export.');
  };

  const handleSave = () => {
    if (currentSamples.length === 0) {
      setNotification('Buffer is empty. No samples to save.');
      return;
    }

    const approxSizeKb = Number(((JSON.stringify(currentSamples).length) / 1024).toFixed(1));
    const newSession: SavedSession = {
      id: activeSessionId || `SESSION_${Date.now()}`,
      name: `EV R&D Run ${savedSessions.length + 1}`,
      startTime: currentSamples[0]?.timestamp || new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      sampleCount: currentSamples.length,
      dataSizeKb: approxSizeKb,
      samples: [...currentSamples],
    };

    const updated = [newSession, ...savedSessions];
    setSavedSessions(updated);
    try {
      localStorage.setItem('ev_telemetry_saved_sessions', JSON.stringify(updated));
    } catch {
      // Local storage limit handling
    }

    setNotification(`Session '${newSession.name}' saved (${newSession.sampleCount} samples).`);
  };

  const handleDeleteSession = (id: string) => {
    const filtered = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(filtered);
    try {
      localStorage.setItem('ev_telemetry_saved_sessions', JSON.stringify(filtered));
    } catch {
      // Ignore
    }
    setNotification(`Session deleted.`);
  };

  const exportSamplesToCsv = (samples: TelemetrySample[], filename: string) => {
    if (samples.length === 0) {
      setNotification('No data samples to export.');
      return;
    }

    // RFC 4180 CSV Header
    const headers = [
      'Timestamp',
      'Speed (km/h)',
      'SOC (%)',
      'Voltage (V)',
      'Current (A)',
      'Power (kW)',
      'RPM',
      'Torque (Nm)',
      'Battery Temperature (C)',
      'Motor Temperature (C)',
      'Throttle (%)',
      'Brake',
      'Riding Mode',
      'Fault Status',
    ];

    const rows = samples.map((s) => [
      `"${s.timestamp}"`,
      s.speed,
      s.soc,
      s.voltage,
      s.current,
      s.power,
      s.rpm,
      s.torque,
      s.batteryTemp,
      s.motorTemp,
      s.throttle,
      `"${s.brake}"`,
      `"${s.ridingMode}"`,
      `"${s.faultStatus}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotification(`Exported ${samples.length} rows to ${filename}.csv`);
  };

  // Stopwatch formatted string (hh:mm:ss)
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Live buffer memory estimate
  const currentBufferKb = (currentSamples.length * 0.18).toFixed(1);
  const liveSampleRate = elapsedSeconds > 0
    ? (currentSamples.length / elapsedSeconds).toFixed(1)
    : (data?.metrics.packet_rate_hz.toFixed(1) ?? '0.0');

  return (
    <div className="space-y-6 select-none font-sans pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-display text-white tracking-wide">
              FLIGHT DATA RECORDER
            </h2>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
              recordingState === 'RECORDING'
                ? 'bg-rose-950/80 border border-rose-500/60 text-rose-300 animate-pulse'
                : recordingState === 'PAUSED'
                ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300'
                : 'bg-slate-900 border border-slate-700 text-slate-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                recordingState === 'RECORDING' ? 'bg-rose-500' : recordingState === 'PAUSED' ? 'bg-amber-400' : 'bg-slate-500'
              }`} />
              RECORDER {recordingState}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Normalized 14-parameter real-time telemetry logging, local session storage, and CSV exportation.
          </p>
        </div>

        {/* Function Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 font-display">
          {recordingState === 'IDLE' && (
            <button
              onClick={handleStart}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
            >
              <Play className="w-4 h-4 fill-current" /> Start Recording
            </button>
          )}

          {recordingState === 'RECORDING' && (
            <>
              <button
                onClick={handlePause}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
              <button
                onClick={handleStop}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
              >
                <Square className="w-4 h-4 fill-current" /> Stop
              </button>
            </>
          )}

          {recordingState === 'PAUSED' && (
            <>
              <button
                onClick={handleStart}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
              >
                <Play className="w-4 h-4 fill-current" /> Resume
              </button>
              <button
                onClick={handleStop}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
              >
                <Square className="w-4 h-4 fill-current" /> Stop
              </button>
            </>
          )}

          {/* Save & Export Active Buffer */}
          {currentSamples.length > 0 && recordingState !== 'RECORDING' && (
            <>
              <button
                onClick={handleSave}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans"
              >
                <Save className="w-4 h-4" /> Save
              </button>
              <button
                onClick={() => exportSamplesToCsv(currentSamples, activeSessionId || 'active_telemetry')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans border border-slate-700"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-cyan-950/50 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* METRICS DISPLAY: DURATION, SAMPLE COUNT, DATA RATE, STORAGE              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-display">
        {/* 1. Duration */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-sans uppercase">
            <span>Duration</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 tracking-wider">
            {formatTime(elapsedSeconds)}
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-1 block">Active Recording Time</span>
        </div>

        {/* 2. Sample Count */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-sans uppercase">
            <span>Sample Count</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {currentSamples.length.toLocaleString()}
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-1 block">Frames Buffered in RAM</span>
        </div>

        {/* 3. Ingestion Rate */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-sans uppercase">
            <span>Data Ingestion Rate</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            {liveSampleRate} <span className="text-xs font-sans text-amber-400">Hz</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-1 block">Samples per Second</span>
        </div>

        {/* 4. Storage Usage */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-sans uppercase">
            <span>Storage / Buffer</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-cyan-300 mt-2">
            {currentBufferKb} <span className="text-xs font-sans text-slate-400">KB</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 mt-1 block truncate">
            {activeSessionId || 'SESSION_IDLE'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SAVED SESSIONS LIST                                                       */}
      {/* ========================================================================= */}
      <div className="bg-[#080d16] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-[#050912]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
              Saved Telemetry Logging Sessions ({savedSessions.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Local Persistent Memory</span>
        </div>

        {savedSessions.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-slate-700" />
            <span className="text-slate-400 font-bold font-display text-sm">NO SAVED SESSIONS FOUND</span>
            <span>Click 'Start Recording' above, halt when finished, and click 'Save' to archive sessions.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 text-xs">
            {savedSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 font-display">
                    <span className="font-bold text-white text-sm tracking-wide">{s.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-cyan-300">
                      {s.id}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-slate-400 text-[11px] font-mono mt-1">
                    <span>Started: {s.startTime.replace('T', ' ').slice(0, 19)}</span>
                    <span>Duration: {formatTime(s.durationSeconds)}</span>
                    <span>Samples: {s.sampleCount.toLocaleString()}</span>
                    <span>Size: {s.dataSizeKb} KB</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => exportSamplesToCsv(s.samples, s.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors uppercase font-sans border border-slate-700"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" /> Export CSV
                  </button>
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors border border-slate-700"
                    title="Delete Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
