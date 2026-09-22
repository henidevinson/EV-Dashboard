import React, { useState } from 'react';
import { Maximize2, Radio, CheckCircle2, Play, AlertTriangle } from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';
import { useTelemetry } from '../../../hooks/useTelemetry';
import { TelemetryProvider } from '../../../services/telemetry/TelemetryProvider';
import { MockTelemetryProvider } from '../../../services/telemetry/MockTelemetryProvider';
import { VehicleState } from '../../../types/normalizedTelemetry';

interface Props {
  data: TelemetryPayload | null;
}

export const SettingsView: React.FC<Props> = () => {
  const { providerId, setProviderId, availableProviders, isMock } = useTelemetry();
  const [selectedSimState, setSelectedSimState] = useState<string>('AUTO');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSimStateChange = (state: 'AUTO' | VehicleState) => {
    setSelectedSimState(state);
    const mockProvider = availableProviders.find((p) => p.id === 'mock') as MockTelemetryProvider | undefined;
    if (mockProvider && typeof mockProvider.setSimulationState === 'function') {
      mockProvider.setSimulationState(state);
    }
  };

  const simStates: Array<{ id: 'AUTO' | VehicleState; label: string; desc: string }> = [
    { id: 'AUTO', label: 'AUTO DRIVE CYCLE', desc: 'Cycles automatically: Idle ➔ Accel ➔ Cruise ➔ Brake ➔ Charge' },
    { id: 'OFF', label: '1. OFF', desc: 'Contactor open, 0A draw, system unpowered' },
    { id: 'IDLE', label: '2. IDLE', desc: 'At rest, 0 km/h, 0.25A quiescent electronics draw' },
    { id: 'ACCELERATING', label: '3. ACCELERATING', desc: 'Throttle 80%, high motor draw (+32A), voltage sag' },
    { id: 'CRUISING', label: '4. CRUISING', desc: 'Steady 45 km/h, aerodynamic balance (+10A)' },
    { id: 'DECELERATING', label: '5. DECELERATING', desc: 'Coast-down, throttle 0%, decaying speed' },
    { id: 'BRAKING', label: '6. BRAKING', desc: 'Regenerative braking (-15A charge back to pack)' },
    { id: 'CHARGING', label: '7. CHARGING', desc: 'Plugged in at rest (-8.5A charge current, SOC rising)' },
  ];

  return (
    <div className="space-y-6 select-none font-sans pb-6">
      <div>
        <h2 className="text-xl font-bold font-display text-white tracking-wide">SYSTEM SETTINGS & TELEMETRY SOURCE</h2>
        <p className="text-xs text-slate-400">Configure real-time telemetry providers, vehicle simulation states, and display mode.</p>
      </div>

      {/* Prominent MOCK Active Banner if running Mock */}
      {isMock && (
        <div className="p-3.5 bg-amber-950/70 border-2 border-amber-500 rounded-xl flex items-center justify-between text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="font-display font-bold text-sm tracking-wider uppercase block text-amber-300">
                SIMULATION MODE ACTIVE (MOCK DATA)
              </span>
              <span className="text-xs text-amber-200/80 font-sans block">
                The instrument cluster is driven by synthetic EV physics. Zero physical vehicle signals are present.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-500 text-black font-display font-extrabold text-xs tracking-widest rounded-lg uppercase">
            MOCK DATA
          </span>
        </div>
      )}

      {/* 1. Provider Switcher */}
      <div className="bg-[#080d16] border border-cyan-500/40 rounded-xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Telemetry Ingestion Provider
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
            ACTIVE: {providerId.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {availableProviders.map((p: TelemetryProvider) => {
            const isSelected = providerId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setProviderId(p.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                    : 'bg-[#040609] border-slate-800 hover:border-slate-700 opacity-80'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-white font-display block">{p.name}</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">{p.description}</span>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[10px] font-mono">
                  {p.isHardwareReady ? (
                    <span className="text-emerald-400 font-bold">READY / FUNCTIONAL</span>
                  ) : (
                    <span className="text-slate-500 font-bold">FUTURE HARDWARE STAGED</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 7-State Simulation Controller (When Mock Provider is Active) */}
      {isMock && (
        <div className="bg-[#080d16] border border-amber-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                EV Physical State Controller (7 Vehicle States)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-amber-400">
              CURRENT STATE: {selectedSimState}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Select any simulated state to immediately observe coupled parameters (Speed, RPM, Torque, Voltage Sag, and Thermals):
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {simStates.map((s) => {
              const isActive = selectedSimState === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSimStateChange(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                      : 'bg-[#040609] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="font-display font-bold text-xs block">{s.label}</span>
                  <span className="text-[10px] text-slate-400 font-sans mt-0.5 block line-clamp-1">{s.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Fullscreen HUD */}
      <div className="bg-[#080d16] border border-slate-800 p-5 rounded-xl flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">Vehicle Touchscreen Fullscreen</h3>
          <p className="text-xs text-slate-400 mt-0.5">Locks the cluster to true fullscreen for in-vehicle touchscreen mounting.</p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-2 transition-colors font-sans"
        >
          <Maximize2 className="w-4 h-4" /> Toggle Fullscreen
        </button>
      </div>
    </div>
  );
};
