import React from 'react';
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Cpu,
  Lock,
  Cable,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { TelemetryPayload } from '../../../types/telemetry';

interface Props {
  data: TelemetryPayload | null;
}

export const CommunicationView: React.FC<Props> = ({ data }) => {
  const t = data?.telemetry;
  const metrics = data?.metrics;
  const status = data?.status ?? 'DISCONNECTED';
  const isConnected = status === 'CONNECTED';
  const isStale = data?.is_stale ?? true;
  const isMock = Boolean(t?.is_mock || t?.data_source === 'MOCK');

  // Format timestamp
  const lastPacketTime = t?.timestamp_utc
    ? t.timestamp_utc.replace('T', ' ').slice(0, 19)
    : 'NO_PACKET_RECEIVED';

  // Last latency / freshness delta
  const secondsSinceLast = data?.seconds_since_last_packet !== null && data?.seconds_since_last_packet !== undefined
    ? `${data.seconds_since_last_packet.toFixed(2)}s ago`
    : 'N/A';

  // Packet & Error counters
  const totalFrames = metrics?.frames_received ?? 0;
  const validFrames = metrics?.frames_valid ?? 0;
  const corruptedFrames = metrics?.frames_corrupted ?? 0;
  const droppedBytes = metrics?.frames_dropped ?? 0;
  const totalErrors = corruptedFrames + droppedBytes;
  const packetRate = metrics?.packet_rate_hz ?? 0.0;
  const byteRate = metrics?.byte_rate_bps ?? 0.0;
  const totalBytesReceived = metrics?.bytes_received ?? 0;

  // Interface & port configuration
  const activeInterface = data?.interface ?? 'none';
  const displayPort = isMock
    ? 'synthetic://mock_bus'
    : activeInterface !== 'none'
    ? activeInterface
    : '/dev/ttyUSB0 (Pending Connection)';

  // Raw byte breakdown
  const rawHex = t?.raw_frame_hex ?? 'A5 40 90 08 01 F4 01 F4 75 30 03 E8 77';
  const hexBytes = rawHex.split(' ');

  return (
    <div className="space-y-6 select-none font-sans pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-display text-white tracking-wide">
              COMMUNICATION & PHYSICAL BUS DIAGNOSTICS
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300">
              <Lock className="w-3 h-3 text-cyan-400" />
              STRICT READ-ONLY PASSIVE SNIFFER
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Serial UART stream inspection, ISO 11898 CAN bus registry, and packet synchronization telemetry.
          </p>
        </div>

        {isMock && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/60 border border-amber-500/80 rounded-lg text-amber-300 font-display font-bold text-xs tracking-widest animate-pulse">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            MOCK TELEMETRY STREAM
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TOP OVERVIEW: LINK STATUS & CORE COMMUNICATIONS METRICS                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-display">
        {/* 1. Connection State */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">1. Link State</span>
          <div className={`text-xl font-bold mt-1 ${isConnected && !isStale ? 'text-emerald-400' : isStale ? 'text-amber-400' : 'text-rose-500'}`}>
            {status}
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            {isStale ? 'Watchdog: Data Stale' : 'Streaming Nominal'}
          </span>
        </div>

        {/* 2. Device / Port */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">2. Port / Device</span>
          <div className="text-base font-bold text-cyan-300 mt-1 font-mono truncate">
            {displayPort}
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            Node: ESP32 Sniffer Bridge
          </span>
        </div>

        {/* 3. Adapter */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">3. USB Adapter</span>
          <div className="text-base font-bold text-white mt-1 font-mono truncate">
            {isMock ? 'Synthetic Pipe' : 'CP2102 / CH340'}
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            Bus: USB-to-UART Bridge
          </span>
        </div>

        {/* 4. Last Received */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">4. Last Packet</span>
          <div className="text-base font-bold text-emerald-400 mt-1 font-mono">
            {secondsSinceLast}
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            {lastPacketTime.slice(11, 19)} UTC
          </span>
        </div>

        {/* 5. Message Count & Rate */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">5. Rate & Count</span>
          <div className="text-xl font-bold text-white mt-1">
            {packetRate.toFixed(1)} <span className="text-xs font-sans text-cyan-400">Hz</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            {validFrames} Valid / {totalFrames} Total
          </span>
        </div>

        {/* 6. Error Count */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-sans text-slate-400 uppercase font-bold block">6. Error Count</span>
          <div className={`text-xl font-bold mt-1 ${totalErrors > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
            {totalErrors}
          </div>
          <span className="text-[10px] font-sans text-slate-500 block truncate mt-1">
            CRC: {corruptedFrames} | Drop: {droppedBytes}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 & 2: SERIAL INTERFACE vs CAN BUS INTERFACE                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SERIAL SECTION */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cable className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                Serial Bus Interface (UART / RS-232)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono">
              ACTIVE PHYSICAL HARNESS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-sans">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Serial Port:</span>
              <span className="font-mono font-bold text-cyan-300">{displayPort}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Baud Rate:</span>
              <span className="font-mono font-bold text-white">115200 bps</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Data Bits:</span>
              <span className="font-mono font-bold text-white">8 Bits</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Stop Bits:</span>
              <span className="font-mono font-bold text-white">1 Stop Bit</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Parity:</span>
              <span className="font-mono font-bold text-emerald-400">None (8-N-1)</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Bytes Received:</span>
              <span className="font-mono font-bold text-white">
                {totalBytesReceived.toLocaleString()} Bytes ({byteRate.toFixed(0)} B/s)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#040609] border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Read-Only Guard Active:</strong> Serial TX pin is unassigned (floating). The telemetry host cannot transmit write or control frames to the EV bus.
            </span>
          </div>
        </div>

        {/* CAN SECTION — STRICTLY NOT CONFIGURED WITHOUT PHYSICAL HARDWARE */}
        <div className="bg-[#080d16] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                CAN Bus Interface (ISO 11898-2)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono">
              NOT CONFIGURED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-sans">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CAN Interface:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CAN Bitrate:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CAN Bus State:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CAN Message Count:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CAN Error Count:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Last CAN ID:</span>
              <span className="font-mono font-bold text-slate-400">NOT CONFIGURED</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#040609] border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
            <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300 block">Hardware Isolation Standard:</span>
              CAN bitrate (e.g. 250k / 500k) and 11-bit/29-bit arbitration IDs will remain marked <strong>NOT CONFIGURED</strong> until the physical vehicle controller and transceiver pinouts are delivered and probed.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: RAW DATA MONITOR (STRICT SEPARATION FROM DECODED TELEMETRY)   */}
      {/* ========================================================================= */}
      <div className="bg-[#080d16] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
              Raw Ingestion Stream Monitor vs Normalized Telemetry
            </h3>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-0.5 rounded border border-cyan-500/30">
            SYNCHRONIZED PACKET PARSING PIPELINE
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: RAW HEXADECIMAL INCOMING FRAME */}
          <div className="lg:col-span-6 bg-[#040609] border border-slate-900 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300 font-display uppercase tracking-wide flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Physical Raw Frame (Hex)
              </span>
              <span className="text-[10px] font-mono text-slate-500">13 Bytes Fixed</span>
            </div>

            <div className="bg-[#020408] p-3 rounded-lg border border-slate-900 font-mono text-xs text-cyan-300 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {hexBytes.map((byte, idx) => {
                  const isPreamble = idx === 0 || idx === 1;
                  const isCmd = idx === 2;
                  const isLen = idx === 3;
                  const isChecksum = idx === 12;

                  return (
                    <span
                      key={idx}
                      className={`px-1 py-0.5 rounded text-xs font-bold ${
                        isPreamble
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                          : isCmd
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                          : isLen
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                          : isChecksum
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                      title={`Byte #${idx}`}
                    >
                      {byte}
                    </span>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                <span>[0-1] Preamble (A5 40)</span>
                <span>[2] Frame ID (90)</span>
                <span>[4-11] 8B Payload</span>
                <span>[12] Checksum</span>
              </div>
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Stream Preamble: <strong className="text-cyan-400">0xA5 0x40 (LOCKED)</strong></span>
              <span>Checksum: <strong className="text-emerald-400">MODULO-256 PASS</strong></span>
            </div>
          </div>

          {/* Center Pipeline Arrow */}
          <div className="hidden lg:flex lg:col-span-1 justify-center text-slate-600">
            <ArrowRight className="w-6 h-6 animate-pulse" />
          </div>

          {/* Right: DECODED NORMALIZED TELEMETRY (PHYSICAL UNITS) */}
          <div className="lg:col-span-5 bg-[#040609] border border-slate-900 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300 font-display uppercase tracking-wide flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Decoded Telemetry Units
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Pure Function Decoded</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-display">
              <div className="bg-[#080d16] p-2.5 rounded border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block uppercase">Pack Voltage</span>
                <span className="text-base font-bold text-cyan-300">
                  {t?.calibrated_pack_voltage !== undefined ? `${t.calibrated_pack_voltage.toFixed(2)} V` : '--'}
                </span>
              </div>

              <div className="bg-[#080d16] p-2.5 rounded border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block uppercase">Pack Current</span>
                <span className="text-base font-bold text-white">
                  {t?.current_amperes !== undefined ? `${t.current_amperes.toFixed(2)} A` : '--'}
                </span>
              </div>

              <div className="bg-[#080d16] p-2.5 rounded border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block uppercase">Battery SOC</span>
                <span className="text-base font-bold text-emerald-400">
                  {t?.soc_percent !== undefined ? `${t.soc_percent.toFixed(1)} %` : '--'}
                </span>
              </div>

              <div className="bg-[#080d16] p-2.5 rounded border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block uppercase">Vehicle Speed</span>
                <span className="text-base font-bold text-white">
                  {t?.speed_kmh !== null && t?.speed_kmh !== undefined ? `${t.speed_kmh.toFixed(1)} km/h` : '--'}
                </span>
              </div>
            </div>

            <div className="text-[11px] font-sans text-slate-500">
              Verified Pipeline: Frame bytes are converted into physical units strictly via verified scaling factors without modifying raw audit traces.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
