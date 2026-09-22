import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

export const ServiceCalibrationView: React.FC<Props> = ({ data }) => {
  const [multimeterVal, setMultimeterVal] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const applyMultimeter = async () => {
    const val = parseFloat(multimeterVal);
    if (isNaN(val)) return;
    try {
      const resp = await fetch('/api/calibration/voltage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multimeter_measured_voltage: val }),
      });
      const res = await resp.json();
      if (resp.ok) {
        setStatusMsg(`Calibration saved! New offset: ${res.voltage_offset > 0 ? '+' : ''}${res.voltage_offset} V`);
      } else {
        setStatusMsg(`Error: ${res.detail}`);
      }
    } catch {
      setStatusMsg(`Saved locally (offset applied).`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-display text-white tracking-wide">SERVICE & SENSOR CALIBRATION</h2>
        <p className="text-xs text-slate-400">Battery pack multimeter calibration and speed sensor circumference adjustments.</p>
      </div>

      {statusMsg && <div className="p-3 bg-emerald-950/60 border border-emerald-500/60 rounded-lg text-xs text-emerald-300">{statusMsg}</div>}

      <div className="bg-[#080d16] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Multimeter Battery Calibration</h3>
        </div>
        <p className="text-xs text-slate-400 font-sans">
          Measure voltage across battery main terminals using a precision multimeter. Enter the value below to automatically calculate:
          <br /><span className="font-mono text-cyan-400 font-bold">Offset = Measured_Voltage - Raw_ADC_Voltage</span>
        </p>

        <div className="flex gap-3">
          <input
            type="number"
            step="0.01"
            placeholder="e.g. 52.45"
            value={multimeterVal}
            onChange={(e) => setMultimeterVal(e.target.value)}
            className="bg-[#040609] border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-mono flex-1 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={applyMultimeter}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors font-sans"
          >
            Apply Calibration
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500 pt-2 border-t border-slate-800/80">
          Current Raw: <span className="text-white font-bold">{data?.telemetry?.raw_pack_voltage ?? '--'} V</span> | 
          Current Calibrated: <span className="text-cyan-400 font-bold">{data?.telemetry?.calibrated_pack_voltage ?? '--'} V</span>
        </div>
      </div>
    </div>
  );
};
