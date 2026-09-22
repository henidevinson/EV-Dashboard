import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TelemetryPayload } from '../types/telemetry';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TelemetryPayload | null;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose, data }) => {
  const [multimeterInput, setMultimeterInput] = useState('');
  const [calMsg, setCalMsg] = useState('');

  if (!isOpen) return null;

  const handleCalibrate = async () => {
    const val = parseFloat(multimeterInput);
    if (isNaN(val)) return;
    try {
      const resp = await fetch('/api/calibration/voltage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multimeter_measured_voltage: val }),
      });
      const result = await resp.json();
      if (resp.ok) {
        setCalMsg(`Offset set: ${result.voltage_offset} V`);
      } else {
        setCalMsg(`Error: ${result.detail}`);
      }
    } catch (e) {
      setCalMsg(`Request error: ${e}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-xl max-w-xl w-full p-6 text-slate-200 shadow-2xl">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold font-display text-white">
            VEHICLE DIAGNOSTICS & CALIBRATION
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-4 my-4 text-xs">
          <div className="bg-[#060910] p-3 rounded border border-slate-800">
            <span className="text-slate-500 block mb-1">PACK VOLTAGE (RAW)</span>
            <span className="text-sm font-bold text-cyan-400">
              {data?.telemetry?.raw_pack_voltage ?? '--'} V
            </span>
          </div>
          <div className="bg-[#060910] p-3 rounded border border-slate-800">
            <span className="text-slate-500 block mb-1">CALIBRATED VOLTAGE</span>
            <span className="text-sm font-bold text-cyan-400">
              {data?.telemetry?.calibrated_pack_voltage ?? '--'} V
            </span>
          </div>
          <div className="bg-[#060910] p-3 rounded border border-slate-800">
            <span className="text-slate-500 block mb-1">RAW PROTOCOL FRAME</span>
            <span className="text-xs font-mono text-slate-300 break-all">
              {data?.telemetry?.raw_frame_hex ?? 'No frame captured'}
            </span>
          </div>
          <div className="bg-[#060910] p-3 rounded border border-slate-800">
            <span className="text-slate-500 block mb-1">STREAM THROUGHPUT</span>
            <span className="text-sm font-bold text-white">
              {data?.metrics.packet_rate_hz.toFixed(1) ?? 0} Hz (
              {data?.metrics.byte_rate_bps.toFixed(0) ?? 0} B/s)
            </span>
          </div>
        </div>

        {/* Multimeter Calibration Form */}
        <div className="mt-4 p-4 rounded-lg bg-[#060910] border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Multimeter Battery Calibration
          </h3>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 52.45"
              value={multimeterInput}
              onChange={(e) => setMultimeterInput(e.target.value)}
              className="bg-[#0e1422] border border-slate-700 rounded px-3 py-1.5 text-sm text-white flex-1 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleCalibrate}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded uppercase tracking-wider transition-colors"
            >
              Apply Offset
            </button>
          </div>
          {calMsg && <p className="text-xs text-amber-400 mt-2">{calMsg}</p>}
        </div>
      </div>
    </div>
  );
};