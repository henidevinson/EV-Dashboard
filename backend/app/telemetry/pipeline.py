import asyncio
from typing import Optional, Dict
import serial
from app.core.config import settings
from app.core.logging import logger
from app.decoders.base import BaseTelemetryDecoder
from app.decoders.registry import get_decoder
from app.decoders.gwort_ev import GwortEvDecoder
from app.telemetry.mock_generator import MockScenario, MockTelemetryGenerator
from app.telemetry.state import ConnectionStatus, TelemetryStateManager


class TelemetryPipeline:
    def __init__(self, state_manager: TelemetryStateManager):
        self.state = state_manager
        self.decoder: BaseTelemetryDecoder = get_decoder(settings.CONTROLLER_PROTOCOL)
        self.gwort_decoder = GwortEvDecoder()
        self.mock_generator = MockTelemetryGenerator(scenario=MockScenario.NORMAL)
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._watchdog_task: Optional[asyncio.Task] = None

    async def start(self):
        if self._running:
            return
        self._running = True
        logger.info("[PIPELINE] Initializing Telemetry Pipeline in mode '%s'", settings.TELEMETRY_MODE)
        self._worker_task = asyncio.create_task(self._run_loop(), name="telemetry_worker")
        self._watchdog_task = asyncio.create_task(self._watchdog_loop(), name="telemetry_watchdog")

    async def stop(self):
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        if self._watchdog_task:
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass
        self.state.set_status(ConnectionStatus.DISCONNECTED, interface="none")
        logger.info("[PIPELINE] Telemetry pipeline stopped.")

    async def _watchdog_loop(self):
        while self._running:
            try:
                await asyncio.sleep(1.0)
                if self.state.status == ConnectionStatus.CONNECTED:
                    if self.state.check_staleness():
                        logger.warning(
                            "[WATCHDOG] No frame received for > %.1fs. Status: DATA_STALE",
                            self.state.freshness_timeout,
                        )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[WATCHDOG] Error in watchdog monitor: %s", e)

    async def _run_loop(self):
        mode = settings.TELEMETRY_MODE.lower()
        if mode == "disconnected":
            self.state.set_status(ConnectionStatus.DISCONNECTED, interface="none")
            return
        if mode == "serial":
            await self._run_serial_reader()
        elif mode == "mock":
            await self._run_mock_generator()
        else:
            self.state.set_status(ConnectionStatus.ERROR, interface=mode)

    async def _run_mock_generator(self):
        self.state.set_status(ConnectionStatus.CONNECTED, interface="synthetic://mock_bus")
        while self._running:
            try:
                model = self.mock_generator.generate_telemetry_model()
                self.state.record_valid_frame(model, raw_bytes=b"\x00" * 13)
                await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[MOCK] Error: %s", e)
                await asyncio.sleep(1.0)

    async def _run_serial_reader(self):
        port = settings.SERIAL_PORT
        baud = settings.SERIAL_BAUDRATE

        while self._running:
            ser: Optional[serial.Serial] = None
            try:
                self.state.set_status(ConnectionStatus.CONNECTING, interface=port)
                logger.info("[SERIAL] Connecting to %s at %d baud (READ-ONLY)", port, baud)

                ser = await asyncio.to_thread(
                    serial.Serial,
                    port=port,
                    baudrate=baud,
                    timeout=0.5,
                    write_timeout=0.0,
                )

                self.state.set_status(ConnectionStatus.WAITING_FOR_DATA, interface=port)
                logger.info("[SERIAL] Port %s opened. Streaming ASCII frames...", port)

                buffer = bytearray()
                kv_accumulator: Dict[str, str] = {}

                while self._running:
                    chunk: bytes = await asyncio.to_thread(ser.read, 128)
                    if chunk:
                        self.state.record_bytes(len(chunk))
                        buffer.extend(chunk)

                        while b"\n" in buffer:
                            newline_idx = buffer.index(b"\n")
                            line_raw = bytes(buffer[:newline_idx + 1])
                            del buffer[:newline_idx + 1]

                            line_str = line_raw.decode("ascii", errors="ignore").strip()
                            if not line_str:
                                continue

                            # Packet terminator in G-WORT protocol
                            if line_str.startswith("*"):
                                if "Total_Voltage" in kv_accumulator or "SOC" in kv_accumulator:
                                    telemetry = self.gwort_decoder.decode_kv(
                                        kv_accumulator,
                                        raw_bytes=line_raw,
                                        voltage_offset=settings.VOLTAGE_OFFSET,
                                    )

                                    if telemetry:
                                        self.state.record_valid_frame(telemetry, line_raw)
                                        cells_count = len(getattr(telemetry, 'cell_voltages', None) or [])
                                        logger.info(
                                            "[GWORT] Live Frame Decoded: %.1fV | %.1f%% SOC | %d cells",
                                            telemetry.calibrated_pack_voltage,
                                            telemetry.soc_percent,
                                            cells_count,
                                        )
                            else:
                                if "=" in line_str:
                                    parts = line_str.lstrip("$").split("=", 1)
                                    if len(parts) == 2:
                                        kv_accumulator[parts[0].strip()] = parts[1].strip()
                    else:
                        await asyncio.sleep(0.01)

            except serial.SerialException as err:
                self.state.set_status(ConnectionStatus.OFFLINE, interface=port)
                logger.warning("[SERIAL] Disconnected: %s", err)
                await asyncio.sleep(3.0)
            except asyncio.CancelledError:
                break
            except Exception as err:
                self.state.set_status(ConnectionStatus.ERROR, interface=port)
                logger.error("[SERIAL] Unexpected error: %s", err)
                await asyncio.sleep(3.0)
            finally:
                if ser and ser.is_open:
                    await asyncio.to_thread(ser.close)
