import React from 'react';
import { Zap } from 'lucide-react';

interface LeftPanelProps {
  soc: number | null;
  voltage: number | null;
  powerKw: number | null;
  cellDeltaMv?: number | null;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ soc, voltage, powerKw, cellDeltaMv }) => {
  const socVal = soc !== null ? Math.round(soc) : 0;
  const segmentsFilled = Math.ceil((socVal / 100) * 4);
  const isLow = soc !== null && socVal <= 15;
  const batteryOutlineColor = isLow ? 'stroke-[#ff2d55]' : 'stroke-cyan-400';
  const batteryGlow = isLow ? 'glow-red' : 'glow-cyan';

  return (
    <div className="flex flex-col items-start gap-4 min-w-[190px] select-none pl-4 font-sans">
      {/* 1. Remaining Range */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          REMAINING RANGE
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl font-bold text-white font-display">
            {soc !== null ? Math.round((socVal / 100) * 80) : '--'}
          </span>
          <span className="text-xs font-semibold text-slate-400">km</span>
        </div>
      </div>

      {/* 2. State of Charge */}
      <div className="flex flex-col mt-1">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          STATE OF CHARGE (SOC)
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
          <span className="text-xl font-bold text-cyan-300 font-display">
            {soc !== null ? `${socVal} %` : '-- %'}
          </span>
        </div>
      </div>

      {/* 3. 4-Segment Vertical Battery Graphic */}
      <div className="relative my-1 pl-4">
        <div className="absolute top-[-20px] left-6 text-sm font-bold text-white font-display">
          {soc !== null ? `${socVal}%` : '--%'}
        </div>

        <svg width="84" height="150" viewBox="0 0 84 150" className={batteryGlow}>
          <path
            d="M28 6 C28 3, 56 3, 56 6 L56 12 L28 12 Z"
            fill="#161e2e"
            className={batteryOutlineColor}
            strokeWidth="2.5"
          />

          <rect
            x="4"
            y="12"
            width="76"
            height="132"
            rx="16"
            fill="#0b0f19"
            className={batteryOutlineColor}
            strokeWidth="3"
          />

          {[3, 2, 1, 0].map((idx) => {
            const isFilled = idx < segmentsFilled;
            const segY = 22 + (3 - idx) * 28;
            const fillColor = isLow
              ? isFilled ? '#ef4444' : '#1e131d'
              : isFilled ? '#10b981' : '#101726';

            return (
              <rect
                key={idx}
                x="12"
                y={segY}
                width="60"
                height="22"
                rx="4"
                fill={fillColor}
                opacity={isFilled ? 0.95 : 0.3}
                className="transition-all duration-300"
              />
            );
          })}

          <g transform="translate(34, 114)">
            <Zap className="w-4 h-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
          </g>
        </svg>
      </div>

      {/* 4. Pack Potential & Cell Delta */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          PACK POTENTIAL
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl font-bold text-emerald-400 font-display">
            {voltage !== null ? voltage.toFixed(1) : '--'}
          </span>
          <span className="text-xs font-semibold text-slate-400">V</span>
        </div>
        {cellDeltaMv !== undefined && cellDeltaMv !== null && (
          <span className="text-[10px] font-mono font-bold text-cyan-400 mt-0.5">
            ΔV: {cellDeltaMv} mV (20S Balanced)
          </span>
        )}
      </div>

      {/* 5. State of Power */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          STATE OF POWER (SOP)
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold text-white font-display">
            {powerKw !== null ? powerKw.toFixed(2) : '0.00'}
          </span>
          <span className="text-xs font-semibold text-slate-400">kW</span>
        </div>
      </div>
    </div>
  );
};
