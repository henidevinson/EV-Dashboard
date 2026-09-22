import React, { useState, useRef } from 'react';
import {
  Activity,
  Battery,
  Cpu,
  HeartPulse,
  AlertTriangle,
  Database,
  Navigation,
  Radio,
  Wrench,
  Sliders,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Menu,
} from 'lucide-react';
import { TelemetryPayload } from '../../types/telemetry';

import { LiveTelemetryView } from './views/LiveTelemetryView';
import { BmsDiagnosticsView } from './views/BmsDiagnosticsView';
import { MotorControllerView } from './views/MotorControllerView';
import { VehicleHealthView } from './views/VehicleHealthView';
import { FaultsDtcView } from './views/FaultsDtcView';
import { DataLoggerView } from './views/DataLoggerView';
import { TripLogsView } from './views/TripLogsView';
import { CommunicationView } from './views/CommunicationView';
import { ServiceCalibrationView } from './views/ServiceCalibrationView';
import { SettingsView } from './views/SettingsView';

interface ControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TelemetryPayload | null;
}

type SectionId =
  | 'telemetry'
  | 'bms'
  | 'motor'
  | 'health'
  | 'faults'
  | 'logger'
  | 'trips'
  | 'comm'
  | 'service'
  | 'settings';

export const ControlCenterModal: React.FC<ControlCenterModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [activeSection, setActiveSection] = useState<SectionId>('telemetry');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebarInFullscreen, setShowSidebarInFullscreen] = useState(false);
  const lastTapRef = useRef<number>(0);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) setShowSidebarInFullscreen(false);
      return next;
    });
  };

  const handleTouchEnd = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      toggleFullscreen();
    }
    lastTapRef.current = now;
  };

  const navItems = [
    { id: 'telemetry', label: 'Live Telemetry', icon: Activity, tag: 'REAL-TIME' },
    { id: 'bms', label: 'BMS Diagnostics', icon: Battery, tag: 'PACK' },
    { id: 'motor', label: 'Motor & Inverter', icon: Cpu, tag: 'POWERTRAIN' },
    { id: 'health', label: 'Vehicle Health', icon: HeartPulse, tag: 'INTEGRITY' },
    { id: 'faults', label: 'Faults & DTC', icon: AlertTriangle, tag: 'DIAGNOSTICS' },
    { id: 'logger', label: 'Data Logger', icon: Database, tag: 'RECORDER' },
    { id: 'trips', label: 'Trip Logs', icon: Navigation, tag: 'ARCHIVE' },
    { id: 'comm', label: 'Communication', icon: Radio, tag: 'BUS' },
    { id: 'service', label: 'Calibration', icon: Wrench, tag: 'SERVICE' },
    { id: 'settings', label: 'Settings', icon: Sliders, tag: 'SYSTEM' },
  ];

  const activeItem = navItems.find((n) => n.id === activeSection);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300 ${
        isFullscreen ? 'p-0' : 'p-3 sm:p-5'
      }`}
    >
      <div
        className={`relative bg-[#050811]/95 flex flex-col overflow-hidden transition-all duration-300 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] ${
          isFullscreen
            ? 'w-screen h-screen max-w-none rounded-none border-none'
            : 'w-full max-w-6xl h-[90vh] border border-slate-800/80 rounded-3xl'
        }`}
      >
        {/* Sleek Floating Header */}
        <header
          onDoubleClick={toggleFullscreen}
          onTouchEnd={handleTouchEnd}
          className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#060a14]/90 select-none cursor-pointer"
          title="Double tap anywhere to toggle full screen"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.9)] animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base tracking-wider text-white">
                  EV CONTROL CENTER
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {activeItem?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Show Menu toggle button in fullscreen */}
            {isFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSidebarInFullscreen((prev) => !prev);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700/60"
              >
                <Menu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {showSidebarInFullscreen ? 'Hide Menu' : 'Show Menu'}
                </span>
              </button>
            )}

            {/* Expand / Minimize Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700/60"
              aria-label={isFullscreen ? 'Restore view' : 'Expand full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Back to Cluster */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-cyan-500/40 font-display"
            >
              <ChevronLeft className="w-4 h-4" /> Close
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Navigation Sidebar Rail */}
          {(!isFullscreen || showSidebarInFullscreen) && (
            <nav className="w-60 border-r border-slate-800/80 bg-[#04060d]/80 p-3 space-y-1 overflow-y-auto shrink-0 select-none">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as SectionId);
                      if (isFullscreen) setShowSidebarInFullscreen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-950/80 to-[#0a1525] text-cyan-300 border border-cyan-500/50 font-bold shadow-[0_0_15px_rgba(0,240,255,0.12)]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.9)]" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Active Content Stage */}
          <main
            onDoubleClick={toggleFullscreen}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto bg-[#03050a] p-6 sm:p-8"
          >
            <div className="max-w-6xl mx-auto">
              {activeSection === 'telemetry' && <LiveTelemetryView data={data} />}
              {activeSection === 'bms' && <BmsDiagnosticsView data={data} />}
              {activeSection === 'motor' && <MotorControllerView data={data} />}
              {activeSection === 'health' && <VehicleHealthView data={data} />}
              {activeSection === 'faults' && <FaultsDtcView data={data} />}
              {activeSection === 'logger' && <DataLoggerView data={data} />}
              {activeSection === 'trips' && <TripLogsView data={data} />}
              {activeSection === 'comm' && <CommunicationView data={data} />}
              {activeSection === 'service' && <ServiceCalibrationView data={data} />}
              {activeSection === 'settings' && <SettingsView data={data} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
