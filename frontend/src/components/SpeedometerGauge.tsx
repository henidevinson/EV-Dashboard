import React, { useEffect, useState, useRef } from 'react';

interface SpeedometerGaugeProps {
  speed: number | null;
  odoKm: number | null;
  tripKm: number | null;
  ridingMode?: 'ECO' | 'CITY' | 'SPORT' | null;
}

// 6-Stop Continuous Color Interpolation: Blue -> Cyan -> Green -> Yellow -> Orange -> Red
function getInterpolatedSpeedColor(spd: number): { hex: string; rgb: string } {
  const stops = [
    { s: 0, r: 0, g: 102, b: 255 },     // Blue (0 km/h)
    { s: 24, r: 0, g: 240, b: 255 },   // Cyan (24 km/h)
    { s: 48, r: 16, g: 185, b: 129 },  // Green (48 km/h)
    { s: 72, r: 234, g: 179, b: 8 },   // Yellow (72 km/h)
    { s: 96, r: 249, g: 115, b: 22 },  // Orange (96 km/h)
    { s: 120, r: 255, g: 45, b: 85 },  // Red (120 km/h)
  ];

  const clamped = Math.max(0, Math.min(120, spd));

  for (let i = 0; i < stops.length - 1; i++) {
    const curr = stops[i];
    const next = stops[i + 1];

    if (clamped >= curr.s && clamped <= next.s) {
      const ratio = (clamped - curr.s) / (next.s - curr.s);
      const r = Math.round(curr.r + (next.r - curr.r) * ratio);
      const g = Math.round(curr.g + (next.g - curr.g) * ratio);
      const b = Math.round(curr.b + (next.b - curr.b) * ratio);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return { hex, rgb: `rgb(${r}, ${g}, ${b})` };
    }
  }

  return { hex: '#ff2d55', rgb: 'rgb(255, 45, 85)' };
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  speed,
  odoKm,
  tripKm,
  ridingMode,
}) => {
  const targetSpeed = speed !== null ? Math.max(0, Math.min(120, speed)) : 0;

  // 60 FPS Damped Physics Inertia
  const [animatedSpeed, setAnimatedSpeed] = useState(targetSpeed);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const damping = 0.14;

    const animate = () => {
      setAnimatedSpeed((prev) => {
        const diff = targetSpeed - prev;
        if (Math.abs(diff) < 0.05) return targetSpeed;
        return prev + diff * damping;
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetSpeed]);

  const currentColor = getInterpolatedSpeedColor(animatedSpeed);

  // Exact Physical Arc Geometry:
  // Center: (175, 175) | Radius: 135 | Sweep: 220 degrees from -200 deg (0 km/h) to +20 deg (120 km/h)
  const minAngle = -200;
  const maxAngle = 20;
  const angleRange = maxAngle - minAngle;
  const currentAngle = minAngle + (animatedSpeed / 120) * angleRange;

  const arcLength = (220 / 360) * (2 * Math.PI * 135); // 518.36px
  const strokeOffset = arcLength - (animatedSpeed / 120) * arcLength;

  const needleRad = (currentAngle * Math.PI) / 180;
  const needleX = 175 + 135 * Math.cos(needleRad);
  const needleY = 175 + 135 * Math.sin(needleRad);

  const innerBeamX = 175 + 50 * Math.cos(needleRad);
  const innerBeamY = 175 + 50 * Math.sin(needleRad);

  const numericalTicks = [
    { val: 0, x: 80, y: 216 },
    { val: 20, x: 74, y: 148 },
    { val: 40, x: 110, y: 96 },
    { val: 60, x: 175, y: 74 },
    { val: 80, x: 240, y: 96 },
    { val: 100, x: 276, y: 148 },
    { val: 120, x: 270, y: 216 },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Top Futuristic Geometric HUD Brackets */}
      <div className="w-[340px] h-6 flex justify-between items-center opacity-80 mb-[-10px] z-10">
        <svg width="60" height="16" viewBox="0 0 60 16" fill="none">
          <path d="M60 2H16L2 14" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="h-[1px] flex-1 mx-2 bg-gradient-to-r from-cyan-500/30 via-cyan-500/10 to-transparent" />
        <svg width="60" height="16" viewBox="0 0 60 16" fill="none">
          <path d="M0 2H44L58 14" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Speedometer Circular SVG Stage */}
      <div className="relative w-[350px] h-[350px]">
        <svg className="w-full h-full" viewBox="0 0 350 350">
          <defs>
            {/* 6-Color Progressive Gradient: Blue -> Cyan -> Green -> Yellow -> Orange -> Red */}
            <linearGradient id="spectrumGradient" x1="0%" y1="100%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0066ff" />
              <stop offset="20%" stopColor="#00f0ff" />
              <stop offset="42%" stopColor="#10b981" />
              <stop offset="65%" stopColor="#eab308" />
              <stop offset="85%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ff2d55" />
            </linearGradient>

            <radialGradient id="dialBacklight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={currentColor.hex} stopOpacity={animatedSpeed > 2 ? 0.15 : 0.02} />
              <stop offset="100%" stopColor="#040609" stopOpacity="0" />
            </radialGradient>

            <filter id="speedGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <circle cx="175" cy="175" r="140" fill="url(#dialBacklight)" />

          {/* Background Outer Guide Track */}
          <path
            d="M 48.15 221.17 A 135 135 0 1 1 301.85 221.17"
            fill="none"
            stroke="#121a28"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Active Rising Arc */}
          <path
            d="M 48.15 221.17 A 135 135 0 1 1 301.85 221.17"
            fill="none"
            stroke="url(#spectrumGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeOffset}
          />

          {/* Major & Minor Ticks */}
          {Array.from({ length: 25 }).map((_, i) => {
            const angle = minAngle + i * (angleRange / 24);
            const rad = (angle * Math.PI) / 180;
            const isMajor = i % 4 === 0;
            const innerR = isMajor ? 120 : 124;
            const outerR = 129;
            const x1 = 175 + innerR * Math.cos(rad);
            const y1 = 175 + innerR * Math.sin(rad);
            const x2 = 175 + outerR * Math.cos(rad);
            const y2 = 175 + outerR * Math.sin(rad);

            const isReached = angle <= currentAngle;
            const tickSpeed = (i / 24) * 120;
            const tickColor = getInterpolatedSpeedColor(tickSpeed).hex;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isReached ? tickColor : isMajor ? '#64748b' : '#334155'}
                strokeWidth={isMajor ? 2 : 1}
                opacity={isReached ? 0.95 : 0.4}
              />
            );
          })}

          {/* Numerical Speed Ticks */}
          {numericalTicks.map((tick) => {
            const isReached = animatedSpeed >= tick.val;
            return (
              <text
                key={tick.val}
                x={tick.x}
                y={tick.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[13px] font-bold font-display select-none transition-colors duration-150"
                style={{
                  fill: isReached ? '#ffffff' : '#64748b',
                  filter: isReached && tick.val === Math.round(animatedSpeed / 20) * 20
                    ? `drop-shadow(0 0 6px ${currentColor.hex})`
                    : 'none',
                }}
              >
                {tick.val}
              </text>
            );
          })}

          {/* Laser Radial Needle Ray */}
          {animatedSpeed > 0.5 && (
            <line
              x1={innerBeamX}
              y1={innerBeamY}
              x2={needleX}
              y2={needleY}
              stroke={currentColor.hex}
              strokeWidth="2.5"
              strokeOpacity={Math.min(0.8, 0.3 + (animatedSpeed / 120) * 0.5)}
              strokeLinecap="round"
            />
          )}

          {/* Glowing Needle Tip Head */}
          <circle
            cx={needleX}
            cy={needleY}
            r="7"
            fill={currentColor.hex}
            filter="url(#speedGlow)"
          />
          <circle
            cx={needleX}
            cy={needleY}
            r="3"
            fill="#ffffff"
          />
        </svg>

        {/* Center Digital Speed Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
          <span
            className="text-[86px] leading-none font-bold font-display tracking-tight transition-all duration-100"
            style={{
              color: '#ffffff',
              filter: `drop-shadow(0 0 14px ${currentColor.rgb})`,
              transform: animatedSpeed > 40 ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {speed !== null ? Math.round(animatedSpeed) : '--'}
          </span>
          <span
            className="text-sm font-semibold tracking-widest mt-1 uppercase font-sans transition-colors duration-150"
            style={{ color: currentColor.hex }}
          >
            km/h
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: ODO | SINGLE ACTIVE MODE SQUIRCLE | TRIP A                */}
      {/* ========================================================================= */}
      <div className="w-[340px] flex justify-between items-center text-xs mt-[-14px] z-10 px-1">
        {/* 1. Odometer Counter */}
        <div className="flex flex-col items-center w-24 text-center">
          <span className="text-[10px] font-semibold tracking-wider text-cyan-400 uppercase font-sans">
            ODO
          </span>
          <span className="text-sm font-bold text-slate-200 font-display tracking-wider">
            {odoKm !== null ? `${odoKm.toFixed(1)} km` : '------ km'}
          </span>
        </div>

        {/* 2. Single Active Mode Glowing Squircle Badge (ECO / CITY / SPORT) */}
        <div className="flex flex-col items-center justify-center">
          {ridingMode === 'ECO' && (
            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#05090f] border-2 border-[#10b981] shadow-[0_0_18px_rgba(16,185,129,0.45)] flex flex-col items-center justify-center gap-0.5 transition-all duration-300">
              {/* Eco Leaf Icon */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#10b981] drop-shadow-[0_0_6px_rgba(16,185,129,0.8)] fill-current">
                <path d="M2 22C2 22 10 20 15 15C20 10 22 2 22 2C22 2 14 4 9 9C4 14 2 22 2 22Z" />
                <path d="M8 16L16 8" stroke="#05090f" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wider text-[#10b981] font-display leading-none">
                ECO
              </span>
            </div>
          )}

          {ridingMode === 'CITY' && (
            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#05090f] border-2 border-[#00d2ff] shadow-[0_0_18px_rgba(0,210,255,0.45)] flex flex-col items-center justify-center gap-0.5 transition-all duration-300">
              {/* City Skyline Icon */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#00d2ff] drop-shadow-[0_0_6px_rgba(0,210,255,0.8)] fill-current">
                {/* Left Building */}
                <path d="M3 10h5v12H3z" />
                <circle cx="5.5" cy="13" r="0.8" fill="#05090f" />
                <circle cx="5.5" cy="16" r="0.8" fill="#05090f" />
                <circle cx="5.5" cy="19" r="0.8" fill="#05090f" />
                {/* Center Building */}
                <path d="M9 3h6v19H9z" />
                <circle cx="11" cy="6" r="0.8" fill="#05090f" />
                <circle cx="13" cy="6" r="0.8" fill="#05090f" />
                <circle cx="11" cy="10" r="0.8" fill="#05090f" />
                <circle cx="13" cy="10" r="0.8" fill="#05090f" />
                <circle cx="11" cy="14" r="0.8" fill="#05090f" />
                <circle cx="13" cy="14" r="0.8" fill="#05090f" />
                <circle cx="11" cy="18" r="0.8" fill="#05090f" />
                <circle cx="13" cy="18" r="0.8" fill="#05090f" />
                {/* Right Building */}
                <path d="M16 10h5v12h-5z" />
                <circle cx="18.5" cy="13" r="0.8" fill="#05090f" />
                <circle cx="18.5" cy="16" r="0.8" fill="#05090f" />
                <circle cx="18.5" cy="19" r="0.8" fill="#05090f" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wider text-[#00d2ff] font-display leading-none">
                CITY
              </span>
            </div>
          )}

          {ridingMode === 'SPORT' && (
            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#05090f] border-2 border-[#ff2d55] shadow-[0_0_18px_rgba(255,45,85,0.5)] flex flex-col items-center justify-center gap-0.5 transition-all duration-300 animate-pulse">
              {/* Sport Lightning Bolt Icon */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#ff2d55] drop-shadow-[0_0_8px_rgba(255,45,85,0.9)] fill-current">
                <path d="M13 2L3.5 13.5h6l-2 8.5 11.5-12h-6.5l2.5-8z" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wider text-[#ff2d55] font-display leading-none">
                SPORT
              </span>
            </div>
          )}

          {/* Subdued Placeholder when Mode is null / unpopulated (No Fake Data) */}
          {!ridingMode && (
            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#05080f] border border-slate-800 flex flex-col items-center justify-center gap-0.5 opacity-50">
              <span className="text-xs font-bold text-slate-600 font-display">--</span>
              <span className="text-[8px] font-mono text-slate-600 uppercase">MODE</span>
            </div>
          )}
        </div>

        {/* 3. Trip A Counter */}
        <div className="flex flex-col items-center w-24 text-center">
          <span className="text-[10px] font-semibold tracking-wider text-cyan-400 uppercase font-sans">
            TRIP A
          </span>
          <span className="text-sm font-bold text-slate-200 font-display tracking-wider">
            {tripKm !== null ? `${tripKm.toFixed(1)} km` : '--.- km'}
          </span>
        </div>
      </div>

      {/* Bottom HUD Framing Lines */}
      <div className="w-[340px] h-4 flex justify-between items-center opacity-70 mt-1">
        <svg width="110" height="14" viewBox="0 0 110 14" fill="none">
          <path d="M0 12L30 12L44 2L110 2" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <svg width="110" height="14" viewBox="0 0 110 14" fill="none">
          <path d="M0 2L66 2L80 12L110 12" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
