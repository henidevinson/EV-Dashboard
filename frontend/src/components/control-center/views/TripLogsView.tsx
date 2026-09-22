import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Play,
  Square,
  Zap,
  Gauge,
  Thermometer,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  LineChart,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

// 14 Core Parameters Required
interface TripRecordItem {
  tripId: string;
  date: string;
  startTime: string;
  endTime: string;
  distanceKm: number;
  durationFormatted: string;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startSoc: number | string;
  endSoc: number | string;
  energyConsumedWh: number;
  maxMotorTemp: number | string;
  maxBatteryTemp: number | string;
  faultCount: number;
  isActive: boolean;
  samples: Array<{
    time: string;
    speed: number;
    soc: number;
    powerKw: number;
    motorTemp: number | null;
    batteryTemp: number | null;
  }>;
}

export const TripLogsView: React.FC<Props> = () => {
  const [trips, setTrips] = useState<TripRecordItem[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripRecordItem | null>(null);
  const [activeRecording, setActiveRecording] = useState(false);
  const [notice, setNotice] = useState('');

  // Load trips from SQLite Database API & Local Data Logger Sessions
  const refreshTrips = async () => {
    const loadedList: TripRecordItem[] = [];

    // 1. Fetch from backend SQLite database
    try {
      const resp = await fetch('/api/history/trips');
      if (resp.ok) {
        const dbTrips: Array<{
          id: number;
          start_time_utc: string;
          end_time_utc: string | null;
          duration_seconds: number;
          distance_km: number;
          max_speed_kmh: number;
          avg_speed_kmh: number;
          start_soc: number | null;
          end_soc: number | null;
          energy_consumed_wh: number;
          max_motor_temp: number | null;
          max_battery_temp: number | null;
          fault_count: number;
          is_active: boolean;
        }> = await resp.json();

        dbTrips.forEach((t) => {
          const startIso = t.start_time_utc || '';
          const endIso = t.end_time_utc || '';
          const durMins = Math.floor((t.duration_seconds || 0) / 60);
          const durSecs = Math.floor((t.duration_seconds || 0) % 60);

          loadedList.push({
            tripId: `DB-TRIP-#${t.id}`,
            date: startIso.slice(0, 10) || 'N/A',
            startTime: startIso.slice(11, 19) || 'N/A',
            endTime: endIso ? endIso.slice(11, 19) : (t.is_active ? 'ACTIVE' : 'STOPPED'),
            distanceKm: t.distance_km || 0.0,
            durationFormatted: `${durMins}m ${durSecs}s`,
            avgSpeedKmh: t.avg_speed_kmh || 0.0,
            maxSpeedKmh: t.max_speed_kmh || 0.0,
            startSoc: t.start_soc !== null ? `${t.start_soc.toFixed(1)}%` : '--',
            endSoc: t.end_soc !== null ? `${t.end_soc.toFixed(1)}%` : '--',
            energyConsumedWh: t.energy_consumed_wh || 0.0,
            maxMotorTemp: t.max_motor_temp !== null ? `${t.max_motor_temp.toFixed(1)}°C` : '--',
            maxBatteryTemp: t.max_battery_temp !== null ? `${t.max_battery_temp.toFixed(1)}°C` : '--',
            faultCount: t.fault_count || 0,
            isActive: Boolean(t.is_active),
            samples: [],
          });
        });
      }
    } catch {
      // Backend offline
    }

    // 2. Fetch from Data Logger sessions (localStorage)
    try {
      const localData = localStorage.getItem('ev_telemetry_saved_sessions');
      if (localData) {
        const parsed: Array<{
          id: string;
          name: string;
          startTime: string;
          durationSeconds: number;
          sampleCount: number;
          samples: Array<{
            timestamp: string;
            speed: number | string;
            soc: number | string;
            voltage: number | string;
            current: number | string;
            power: number | string;
            motorTemp: number | string;
            batteryTemp: number | string;
            faultStatus: string;
          }>;
        }> = JSON.parse(localData);

        parsed.forEach((s) => {
          const startIso = s.startTime || '';
          const durMins = Math.floor((s.durationSeconds || 0) / 60);
          const durSecs = Math.floor((s.durationSeconds || 0) % 60);

          let maxSpd = 0;
          let sumSpd = 0;
          let maxMotorT = 0;
          let maxBattT = 0;
          let faultsDetected = 0;

          const chartSamples = s.samples.map((pt) => {
            const spd = typeof pt.speed === 'number' ? pt.speed : 0;
            const pwr = typeof pt.power === 'number' ? pt.power : parseFloat(String(pt.power)) || 0;
            const socVal = typeof pt.soc === 'number' ? pt.soc : parseFloat(String(pt.soc)) || 0;
            const mt = typeof pt.motorTemp === 'number' ? pt.motorTemp : parseFloat(String(pt.motorTemp)) || null;
            const bt = typeof pt.batteryTemp === 'number' ? pt.batteryTemp : parseFloat(String(pt.batteryTemp)) || null;

            if (spd > maxSpd) maxSpd = spd;
            sumSpd += spd;
            if (mt && mt > maxMotorT) maxMotorT = mt;
            if (bt && bt > maxBattT) maxBattT = bt;
            if (pt.faultStatus && pt.faultStatus !== 'NOMINAL') faultsDetected++;

            return {
              time: pt.timestamp ? pt.timestamp.slice(11, 19) : '',
              speed: spd,
              soc: socVal,
              powerKw: pwr,
              motorTemp: mt,
              batteryTemp: bt,
            };
          });

          const avgSpd = chartSamples.length > 0 ? sumSpd / chartSamples.length : 0;
          const distKm = avgSpd * (s.durationSeconds / 3600);

          loadedList.push({
            tripId: s.id,
            date: startIso.slice(0, 10) || 'N/A',
            startTime: startIso.slice(11, 19) || 'N/A',
            endTime: 'COMPLETED',
            distanceKm: Number(distKm.toFixed(2)),
            durationFormatted: `${durMins}m ${durSecs}s`,
            avgSpeedKmh: Number(avgSpd.toFixed(1)),
            maxSpeedKmh: Number(maxSpd.toFixed(1)),
            startSoc: s.samples[0]?.soc ? `${s.samples[0].soc}%` : '--',
            endSoc: s.samples[s.samples.length - 1]?.soc ? `${s.samples[s.samples.length - 1].soc}%` : '--',
            energyConsumedWh: Number((distKm * 24.5).toFixed(1)),
            maxMotorTemp: maxMotorT > 0 ? `${maxMotorT.toFixed(1)}°C` : '--',
            maxBatteryTemp: maxBattT > 0 ? `${maxBattT.toFixed(1)}°C` : '--',
            faultCount: faultsDetected,
            isActive: false,
            samples: chartSamples,
          });
        });
      }
    } catch {
      // Local storage empty
    }

    setTrips(loadedList);
  };

  useEffect(() => {
    refreshTrips();
  }, []);

  // Controls for Starting / Stopping a Live Trip
  const handleStartTrip = async () => {
    try {
      const resp = await fetch('/api/history/trips/start', { method: 'POST' });
      const res = await resp.json();
      setActiveRecording(true);
      setNotice(`Trip #${res.trip_id} initialized and recording.`);
      refreshTrips();
    } catch {
      setActiveRecording(true);
      setNotice('Trip started in local mode.');
    }
  };

  const handleStopTrip = async () => {
    try {
      const resp = await fetch('/api/history/trips/stop', { method: 'POST' });
      const res = await resp.json();
      setActiveRecording(false);
      setNotice(`Trip stopped. Recorded ${res.distance_km ?? 0} km.`);
      refreshTrips();
    } catch {
      setActiveRecording(false);
      setNotice('Trip closed.');
    }
  };

  // SVG Chart Renderer
  const renderChart = (
    values: number[],
    min: number,
    max: number,
    strokeColor: string,
    unit: string,
    height = 90
  ) => {
    if (values.length < 2) {
      return (
        <div className="h-24 flex items-center justify-center text-xs font-mono text-slate-600">
          INSUFFICIENT TIME-SERIES TRANSIENTS (MIN 2 POINTS REQUIRED)
        </div>
      );
    }

    const range = max - min || 1;
    const width = 500;
    const coords = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
      <div className="space-y-1">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <line x1="0" y1={8} x2={width} y2={8} stroke="#1e293b" strokeDasharray="4" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#1e293b" strokeDasharray="4" />
          <line x1="0" y1={height - 8} x2={width} y2={height - 8} stroke="#1e293b" strokeDasharray="4" />

          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={coords.join(' ')}
          />
        </svg>
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>{min} {unit}</span>
          <span>Avg: {((values.reduce((a, b) => a + b, 0)) / values.length).toFixed(1)} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 select-none font-sans pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-display text-white tracking-wide">
              SAVED VEHICLE TRIP ARCHIVE
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300 font-mono">
              DATABASE & FLIGHT RECORDER LOGS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Query kinematics, electrical energy integration, thermal peaks, and time-series transient charts.
          </p>
        </div>

        <div className="flex items-center gap-2 font-display">
          {!activeRecording ? (
            <button
              onClick={handleStartTrip}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 uppercase tracking-wider transition-colors font-sans"
            >
              <Play className="w-4 h-4 fill-current" /> Start Trip Session
            </button>
          ) : (
            <button
              onClick={handleStopTrip}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 uppercase tracking-wider transition-colors font-sans"
            >
              <Square className="w-4 h-4 fill-current" /> Close Active Trip
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-cyan-950/50 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      {/* VIEW A: DETAILED TRIP INSPECTOR */}
      {selectedTrip ? (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between bg-[#080d16] border border-cyan-500/40 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTrip(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                title="Back to trips"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Selected Session</span>
                <h3 className="text-lg font-bold font-display text-white">{selectedTrip.tripId}</h3>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">Date: <strong className="text-white">{selectedTrip.date}</strong></span>
              <span className="text-slate-400">Duration: <strong className="text-cyan-400">{selectedTrip.durationFormatted}</strong></span>
            </div>
          </div>

          {/* 14 Parameter Comprehensive Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 font-display">
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">1. Distance</span>
              <span className="text-xl font-bold text-cyan-300 mt-1 block">{selectedTrip.distanceKm} km</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">2. Duration</span>
              <span className="text-xl font-bold text-white mt-1 block">{selectedTrip.durationFormatted}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">3. Avg Speed</span>
              <span className="text-xl font-bold text-white mt-1 block">{selectedTrip.avgSpeedKmh} km/h</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">4. Max Speed</span>
              <span className="text-xl font-bold text-cyan-400 mt-1 block">{selectedTrip.maxSpeedKmh} km/h</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">5. Energy Used</span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">{selectedTrip.energyConsumedWh} Wh</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">6. Start SOC</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">{selectedTrip.startSoc}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">7. End SOC</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">{selectedTrip.endSoc}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">8. Start Time</span>
              <span className="text-sm font-bold text-white mt-1 block font-mono">{selectedTrip.startTime}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">9. End Time</span>
              <span className="text-sm font-bold text-white mt-1 block font-mono">{selectedTrip.endTime}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">10. Max Motor T</span>
              <span className="text-xl font-bold text-rose-400 mt-1 block">{selectedTrip.maxMotorTemp}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">11. Max Batt T</span>
              <span className="text-xl font-bold text-white mt-1 block">{selectedTrip.maxBatteryTemp}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">12. Fault Count</span>
              <span className={`text-xl font-bold mt-1 block ${selectedTrip.faultCount > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                {selectedTrip.faultCount}
              </span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">13. Date</span>
              <span className="text-sm font-bold text-white mt-1 block font-mono">{selectedTrip.date}</span>
            </div>
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] text-slate-500 font-sans uppercase block">14. Status</span>
              <span className="text-xs font-bold text-cyan-400 mt-1.5 block font-sans">
                {selectedTrip.isActive ? 'IN PROGRESS' : 'CLOSED'}
              </span>
            </div>
          </div>

          {/* 4 REAL-TIME TIME-SERIES CHARTS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Trip Transient Time-Series Curves ({selectedTrip.samples.length} Samples)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chart 1: Speed */}
              <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 font-display flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Speed Profile (km/h)
                  </span>
                  <span className="text-cyan-400 font-mono text-[11px]">Peak: {selectedTrip.maxSpeedKmh} km/h</span>
                </div>
                {renderChart(selectedTrip.samples.map((s) => s.speed), 0, Math.max(50, selectedTrip.maxSpeedKmh), '#00f0ff', 'km/h')}
              </div>

              {/* Chart 2: SOC */}
              <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 font-display flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" /> Battery SOC Discharge (%)
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">{selectedTrip.startSoc} ➔ {selectedTrip.endSoc}</span>
                </div>
                {renderChart(selectedTrip.samples.map((s) => s.soc), 0, 100, '#10b981', '%')}
              </div>

              {/* Chart 3: Power */}
              <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 font-display flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Power Output / Regen (kW)
                  </span>
                  <span className="text-amber-400 font-mono text-[11px]">Net: {selectedTrip.energyConsumedWh} Wh</span>
                </div>
                {renderChart(selectedTrip.samples.map((s) => s.powerKw), -1.5, 3.0, '#f59e0b', 'kW')}
              </div>

              {/* Chart 4: Temperature */}
              <div className="bg-[#080d16] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 font-display flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" /> Thermal Trend (°C)
                  </span>
                  <span className="text-rose-400 font-mono text-[11px]">Peak Stator: {selectedTrip.maxMotorTemp}</span>
                </div>
                {renderChart(
                  selectedTrip.samples.map((s) => (s.motorTemp !== null ? s.motorTemp : 25)),
                  20,
                  85,
                  '#f43f5e',
                  '°C'
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW B: ALL SAVED TRIPS LIST */
        <div className="bg-[#080d16] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-[#050912]">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
                Recorded Trip Sessions ({trips.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Persistent SQLite & Local Buffers</span>
          </div>

          {trips.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-slate-700" />
              <span className="text-slate-400 font-bold font-display text-sm tracking-wide">
                NO RECORDED TRIPS FOUND
              </span>
              <p className="max-w-md text-slate-500 font-sans">
                Zero trips exist in the database. Engage the throttle or click 'Start Trip Session' above to begin accumulating live distance, energy, and kinematics.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 text-xs">
              {trips.map((t) => (
                <div
                  key={t.tripId}
                  onClick={() => setSelectedTrip(t)}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2.5 font-display">
                      <span className="font-bold text-white text-sm tracking-wide">{t.tripId}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-cyan-300">
                        {t.date}
                      </span>
                      {t.isActive && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse">
                          ACTIVE LIVE SESSION
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-400 text-[11px] font-mono mt-1.5">
                      <span>Start: {t.startTime}</span>
                      <span>End: {t.endTime}</span>
                      <span>Duration: {t.durationFormatted}</span>
                      <span>SOC: {t.startSoc} ➔ {t.endSoc}</span>
                      <span>Motor Peak: {t.maxMotorTemp}</span>
                      {t.faultCount > 0 && (
                        <span className="text-rose-400 font-bold">Faults: {t.faultCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    <div className="text-right font-display">
                      <div className="text-base font-bold text-cyan-300">{t.distanceKm} km</div>
                      <div className="text-[10px] text-amber-400 font-sans">{t.energyConsumedWh} Wh ({t.avgSpeedKmh} km/h avg)</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
