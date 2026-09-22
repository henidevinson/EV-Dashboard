import React from 'react';
import { Activity, Bell, ChevronLeft, ChevronRight, Shield, Zap } from 'lucide-react';
import { FaultCondition } from '../types/telemetry';

interface BottomIndicatorsProps {
  faults: FaultCondition[];
}

export const BottomIndicators: React.FC<BottomIndicatorsProps> = ({ faults }) => {
  const hasBmsFault = faults.some((f) => f.code.includes('VOLTAGE') || f.code.includes('CURRENT'));
  const hasOtherFault = faults.length > 0;

  return (
    <footer className="w-full flex justify-center items-center gap-8 py-3 select-none text-slate-500 border-t border-slate-900/60 bg-[#040609]">
      {/* 1. BMS FAULT */}
      <div
        className={`flex flex-col items-center gap-1 ${
          hasBmsFault ? 'text-rose-500 glow-red' : 'text-slate-600'
        }`}
      >
        <Zap className="w-5 h-5" />
        <span className="text-[9px] font-bold tracking-wider uppercase">
          BMS FAULT
        </span>
      </div>

      {/* 2. REVERSE */}
      <div className="flex flex-col items-center gap-1 text-slate-600">
        <div className="flex">
          <ChevronLeft className="w-4 h-4 mr-[-6px]" />
          <ChevronLeft className="w-4 h-4" />
        </div>
        <span className="text-[9px] font-bold tracking-wider uppercase">
          REVERSE OFF
        </span>
      </div>

      {/* 3. CRUISE */}
      <div className="flex flex-col items-center gap-1 text-slate-600">
        <div className="flex">
          <ChevronRight className="w-4 h-4 mr-[-6px]" />
          <ChevronRight className="w-4 h-4" />
        </div>
        <span className="text-[9px] font-bold tracking-wider uppercase">
          CRUISE OFF
        </span>
      </div>

      {/* 4. HORN */}
      <div className="flex flex-col items-center gap-1 text-slate-600">
        <Bell className="w-5 h-5" />
        <span className="text-[9px] font-bold tracking-wider uppercase">
          HORN OFF
        </span>
      </div>

      {/* 5. BRAKE */}
      <div className="flex flex-col items-center gap-1 text-slate-600">
        <Shield className="w-5 h-5" />
        <span className="text-[9px] font-bold tracking-wider uppercase">
          BRAKE OFF
        </span>
      </div>

      {/* 6. FAULT CODE DISPLAY */}
      <div
        className={`flex flex-col items-center gap-1 ${
          hasOtherFault ? 'text-amber-500 glow-amber' : 'text-slate-600'
        }`}
      >
        <Activity className="w-5 h-5" />
        <span className="text-[9px] font-bold tracking-wider uppercase">
          {hasOtherFault ? faults[0].code : 'FAULT NONE'}
        </span>
      </div>
    </footer>
  );
};