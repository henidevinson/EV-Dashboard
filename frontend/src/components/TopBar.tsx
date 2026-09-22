import React, { useEffect, useState } from 'react';
import { Menu, Zap, AlertTriangle, Radio, ShieldCheck } from 'lucide-react';
import { ConnectionStatus } from '../types/normalizedTelemetry';

interface TopBarProps {
  status: ConnectionStatus;
  isMock: boolean;
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ status, isMock, onMenuClick }) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine pill styling and text based on connection state
  let pillText = 'WAITING FOR VEHICLE TELEMETRY...';
  let pillBorder = 'border-slate-800';
  let pillTextCol = 'text-slate-400';
  let PillIcon = Radio;

  if (status === 'CONNECTED') {
    if (isMock) {
      pillText = 'MOCK VEHICLE STREAM ACTIVE';
      pillBorder = 'border-amber-500/80';
      pillTextCol = 'text-amber-400';
      PillIcon = Zap;
    } else {
      pillText = 'VEHICLE ONLINE • REAL TELEMETRY';
      pillBorder = 'border-emerald-500/60';
      pillTextCol = 'text-emerald-400';
      PillIcon = ShieldCheck;
    }
  } else if (status === 'COMMUNICATION_LOST') {
    pillText = 'COMMUNICATION LOST • SIGNAL TIMEOUT';
    pillBorder = 'border-rose-500/80';
    pillTextCol = 'text-rose-400';
    PillIcon = AlertTriangle;
  } else if (status === 'DISCONNECTED') {
    pillText = 'VEHICLE DISCONNECTED';
    pillBorder = 'border-slate-800';
    pillTextCol = 'text-slate-500';
    PillIcon = Radio;
  } else if (status === 'CONNECTING') {
    pillText = 'CONNECTING TO TELEMETRY LINK...';
    pillBorder = 'border-cyan-500/50';
    pillTextCol = 'text-cyan-400';
    PillIcon = Radio;
  }

  return (
    <header className="flex items-center justify-between px-6 pt-4 pb-2 text-slate-300 select-none">
      {/* Menu Hamburger */}
      <button
        onClick={onMenuClick}
        aria-label="Open Diagnostics"
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0e1420] border border-slate-800 text-slate-300 hover:text-white hover:border-cyan-500/40 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center Status Pill + Provenance Badge */}
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center gap-2 px-5 py-1.5 rounded-full bg-[#0a0f18] border ${pillBorder} shadow-lg shadow-black/60`}
        >
          <PillIcon className={`w-3.5 h-3.5 ${pillTextCol} ${status === 'COMMUNICATION_LOST' ? 'animate-bounce' : 'animate-pulse'}`} />
          <span className={`text-xs font-semibold tracking-wider font-sans ${pillTextCol}`}>
            {pillText}
          </span>
        </div>

        {/* PROVENANCE BADGES: DISTINGUISHING MOCK, REAL, AND OFFLINE */}
        {status === 'CONNECTED' && isMock && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-black border border-amber-300 rounded-full font-display font-extrabold text-[11px] tracking-widest uppercase shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 fill-current" />
            <span>MOCK DATA</span>
          </div>
        )}

        {status === 'CONNECTED' && !isMock && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500 rounded-full font-display font-bold text-[11px] tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>REAL DATA</span>
          </div>
        )}

        {status === 'COMMUNICATION_LOST' && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950 text-rose-300 border border-rose-600 rounded-full font-display font-bold text-[11px] tracking-widest uppercase animate-pulse">
            <span>COMMUNICATION LOST</span>
          </div>
        )}

        {status === 'DISCONNECTED' && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-slate-400 border border-slate-700 rounded-full font-display font-bold text-[11px] tracking-widest uppercase">
            <span>DISCONNECTED</span>
          </div>
        )}
      </div>

      {/* Digital Clock */}
      <div className="text-xl font-bold tracking-wider font-display text-slate-200">
        {timeStr}
      </div>
    </header>
  );
};
