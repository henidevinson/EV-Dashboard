#!/usr/bin/env python3
"""
EV Smart Telemetry - Unified Diagnostic & Calibration CLI
Modes: monitor | calibrate | probe | sniff | trips | diagnostics
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import serial
import serial.tools.list_ports

DEFAULT_API = "http://127.0.0.1:8000"

# ANSI Terminal Styling
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[31m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_BLUE = "\033[34m"
C_CYAN = "\033[36m"
C_CLEAR = "\033[2J\033[H"


def http_get(endpoint: str, base_url: str = DEFAULT_API):
    url = f"{base_url}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "EV-Tool-CLI"})
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as err:
        return {"error": str(err)}


def http_post(endpoint: str, payload: dict, base_url: str = DEFAULT_API):
    url = f"{base_url}{endpoint}"
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json", "User-Agent": "EV-Tool-CLI"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        return {"error": err.read().decode("utf-8")}
    except Exception as err:
        return {"error": str(err)}


def render_progress_bar(percent: float, width: int = 24) -> str:
    filled = int(round(width * (max(0.0, min(100.0, percent)) / 100.0)))
    bar = "█" * filled + "░" * (width - filled)
    color = C_GREEN if percent > 40 else (C_YELLOW if percent > 20 else C_RED)
    return f"{color}[{bar}] {percent:5.1f}%{C_RESET}"


# ==============================================================================
# SUBCOMMAND 1: Live Monitor
# ==============================================================================
def cmd_monitor(args):
    print(C_CLEAR, end="")
    try:
        while True:
            data = http_get("/api/telemetry/latest", base_url=args.api)
            if "error" in data:
                print(f"{C_CLEAR}{C_RED}Failed to connect to backend at {args.api}: {data['error']}{C_RESET}")
                time.sleep(1.0)
                continue

            status = data.get("status", "UNKNOWN")
            is_stale = data.get("is_stale", True)
            metrics = data.get("metrics", {})
            t = data.get("telemetry") or {}

            # Status pill
            status_color = C_GREEN if status == "CONNECTED" and not is_stale else (C_YELLOW if is_stale else C_RED)
            status_badge = f"{status_color}{C_BOLD}[ {status} ]{C_RESET}"
            if is_stale and status == "CONNECTED":
                status_badge += f" {C_YELLOW}(DATA STALE){C_RESET}"

            # Math calculations
            voltage = t.get("calibrated_pack_voltage", 0.0) or 0.0
            raw_v = t.get("raw_pack_voltage", 0.0) or 0.0
            current = t.get("current_amperes", 0.0) or 0.0
            power_kw = (voltage * current) / 1000.0
            soc = t.get("soc_percent", 0.0) or 0.0
            speed = t.get("speed_kmh")
            rpm = t.get("motor_rpm")
            m_temp = t.get("motor_temperature_celsius")
            c_temp = t.get("controller_temperature_celsius")
            faults = t.get("fault_codes", [])

            out = []
            out.append(f"{C_CLEAR}{C_CYAN}{C_BOLD}======================================================================{C_RESET}")
            out.append(f"   {C_BOLD}EV SMART TELEMETRY — DIGITAL INSTRUMENT CLUSTER (CLI){C_RESET}")
            out.append(f"   Link Status: {status_badge}  | Interface: {data.get('active_interface')}")
            out.append(f"{C_CYAN}======================================================================{C_RESET}")

            # Battery Section
            out.append(f"\n {C_BOLD}BATTERY SYSTEM{C_RESET}")
            out.append(f"   State of Charge : {render_progress_bar(soc)}")
            out.append(f"   Pack Voltage    : {C_BOLD}{voltage:5.2f} V{C_RESET} (Raw: {raw_v:5.2f} V)")
            curr_color = C_GREEN if current < 0 else (C_YELLOW if current > 25 else C_RESET)
            out.append(f"   Pack Current    : {curr_color}{current:5.2f} A{C_RESET} ({'REGEN CHARGE' if current < 0 else 'DISCHARGE'})")
            out.append(f"   Net Power       : {power_kw:6.3f} kW")

            # Kinematics Section
            out.append(f"\n {C_BOLD}KINEMATICS & MOTOR{C_RESET}")
            speed_str = f"{speed:5.1f} km/h" if speed is not None else "NOT AVAILABLE"
            rpm_str = f"{rpm} RPM" if rpm is not None else "NOT AVAILABLE"
            out.append(f"   Vehicle Speed   : {C_BOLD}{speed_str}{C_RESET}")
            out.append(f"   Motor RPM       : {rpm_str}")

            # Thermals Section
            out.append(f"\n {C_BOLD}TEMPERATURES{C_RESET}")
            m_temp_str = f"{m_temp:4.1f} °C" if m_temp is not None else "NOT AVAILABLE"
            c_temp_str = f"{c_temp:4.1f} °C" if c_temp is not None else "NOT AVAILABLE"
            out.append(f"   Motor Temp      : {m_temp_str}")
            out.append(f"   Controller Temp : {c_temp_str}")

            # Pipeline Metrics
            out.append(f"\n {C_BOLD}THROUGHPUT & DIAGNOSTICS{C_RESET}")
            out.append(f"   Rate: {metrics.get('packet_rate_hz', 0.0):4.1f} Hz | {metrics.get('byte_rate_bps', 0.0):5.1f} B/s")
            out.append(f"   Frames: Valid={metrics.get('frames_valid', 0)} | Corrupted={metrics.get('frames_corrupted', 0)}")
            out.append(f"   Active Alarms   : {C_RED}{faults if faults else 'NONE (SYSTEM OK)'}{C_RESET}")
            out.append(f"   Raw Frame       : {C_BLUE}{data.get('latest_raw_hex', 'N/A')}{C_RESET}")
            out.append(f"\n{C_CYAN}----------------------------------------------------------------------{C_RESET}")
            out.append(" Press Ctrl+C to exit monitor.")

            print("\n".join(out))
            time.sleep(0.2)

    except KeyboardInterrupt:
        print(f"\n{C_RESET}Monitor closed.")


# ==============================================================================
# SUBCOMMAND 2: Calibration
# ==============================================================================
def cmd_calibrate(args):
    print(f"\n{C_BOLD}--- EV Battery Voltage Calibration Tool ---{C_RESET}")

    if args.set_offset is not None:
        payload = {"voltage_offset": args.set_offset}
        res = http_post("/api/calibration/voltage", payload, base_url=args.api)
        print(f"Update Result: {res}")
        return

    if args.multimeter is not None:
        payload = {"multimeter_measured_voltage": args.multimeter}
        res = http_post("/api/calibration/voltage", payload, base_url=args.api)
        if "error" in res:
            print(f"{C_RED}Error: {res['error']}{C_RESET}")
        else:
            print(f"{C_GREEN}Calibration updated!{C_RESET}")
            print(f"  New Offset        : {res.get('voltage_offset'):+.2f} V")
            print(f"  Raw Measured      : {res.get('raw_pack_voltage')} V")
            print(f"  Calibrated Result : {res.get('calibrated_pack_voltage')} V")
        return

    # Interactive Query
    curr = http_get("/api/calibration/voltage", base_url=args.api)
    print(f"Current Configured Offset : {curr.get('voltage_offset'):+.2f} V")
    print(f"Current Raw Pack Voltage  : {curr.get('raw_pack_voltage')} V")
    print(f"Current Calibrated Voltage: {curr.get('calibrated_pack_voltage')} V")
    print(f"Formula: {curr.get('calibration_formula')}\n")

    val = input("Enter physical multimeter voltage reading (or press Enter to skip): ").strip()
    if val:
        try:
            m_val = float(val)
            res = http_post("/api/calibration/voltage", {"multimeter_measured_voltage": m_val}, base_url=args.api)
            print(f"{C_GREEN}Offset saved: {res.get('voltage_offset'):+.2f} V{C_RESET}")
        except ValueError:
            print(f"{C_RED}Invalid numeric input.{C_RESET}")


# ==============================================================================
# SUBCOMMAND 3: Hardware Port Probe
# ==============================================================================
def cmd_probe(args):
    print(f"\n{C_BOLD}--- EV Hardware Interface Probe ---{C_RESET}")
    ports = [p for p in serial.tools.list_ports.comports() if "ttyUSB" in p.device or "ttyACM" in p.device]
    if not ports:
        print(f"{C_RED}No serial devices found on system.{C_RESET}")
        return

    baud_candidates = [9600, 19200, 38400, 57600, 115200]
    preamble = bytes([0xA5, 0x40])

    for p in ports:
        print(f"\nFound Port: {C_CYAN}{p.device}{C_RESET} ({p.description})")
        for baud in baud_candidates:
            sys.stdout.write(f"  Testing {baud:6d} baud ... ")
            sys.stdout.flush()
            try:
                ser = serial.Serial(p.device, baud, timeout=0.8, write_timeout=0.0)
                sample = ser.read(64)
                ser.close()

                if preamble in sample:
                    print(f"{C_GREEN}MATCH! Found sync preamble [0xA5 0x40]! ({len(sample)} bytes read){C_RESET}")
                elif len(sample) > 0:
                    print(f"{C_YELLOW}Traffic detected ({len(sample)} bytes), but sync preamble not matched.{C_RESET}")
                else:
                    print(f"No response (0 bytes).")
            except Exception as e:
                print(f"{C_RED}Access error: {e}{C_RESET}")


# ==============================================================================
# SUBCOMMAND 4: Sniffer & Packet Inspector
# ==============================================================================
def cmd_sniff(args):
    print(f"\n{C_BOLD}--- EV Protocol Packet Inspector ---{C_RESET}")
    recent = http_get("/api/history/diagnostics/raw-frames?limit=15", base_url=args.api)
    if not isinstance(recent, list) or not recent:
        print("No raw frame history logged yet.")
        return

    print(f"  {'TIMESTAMP':<24} | {'STATUS':<9} | {'DECODED PACKET BYTES':<40}")
    print("  " + "-" * 78)

    for item in reversed(recent):
        hex_str = item.get("raw_hex", "")
        parts = hex_str.split()
        if len(parts) >= 13:
            # Colorize: PREAMBLE(A5 40) | CMD(90) | LEN(08) | PAYLOAD(8B) | CHK(1B)
            formatted = (
                f"{C_GREEN}{' '.join(parts[0:2])}{C_RESET} "
                f"{C_CYAN}{parts[2]}{C_RESET} "
                f"{C_YELLOW}{parts[3]}{C_RESET} "
                f"{' '.join(parts[4:12])} "
                f"{C_RED}{parts[12]}{C_RESET}"
            )
        else:
            formatted = hex_str

        print(f"  {item.get('timestamp_utc')[:19]:<24} | {item.get('status'):<9} | {formatted}")

    print(f"\nLegend: {C_GREEN}Sync Preamble{C_RESET} | {C_CYAN}Cmd ID{C_RESET} | {C_YELLOW}Length{C_RESET} | Payload | {C_RED}Checksum{C_RESET}")


# ==============================================================================
# SUBCOMMAND 5: Trip Manager
# ==============================================================================
def cmd_trips(args):
    print(f"\n{C_BOLD}--- EV Trip Sessions ---{C_RESET}")
    if args.action == "start":
        res = http_post("/api/history/trips/start", {}, base_url=args.api)
        print(f"Start trip: {res}")
    elif args.action == "stop":
        res = http_post("/api/history/trips/stop", {}, base_url=args.api)
        print(f"Stop trip: {res}")
    else:
        trips = http_get("/api/history/trips?limit=10", base_url=args.api)
        if not isinstance(trips, list) or not trips:
            print("No trips logged yet.")
            return

        print(f" {'ID':<4} | {'START TIME':<19} | {'DIST (km)':<9} | {'ENERGY (Wh)':<11} | {'EFF (Wh/km)':<11} | {'ACTIVE':<6}")
        print(" " + "-" * 72)
        for t in trips:
            print(
                f" {t.get('id'):<4} | "
                f"{t.get('start_time_utc')[:19]:<19} | "
                f"{t.get('distance_km', 0.0):9.2f} | "
                f"{t.get('energy_consumed_wh', 0.0):11.1f} | "
                f"{t.get('efficiency_wh_per_km', 0.0):11.1f} | "
                f"{str(t.get('is_active')):<6}"
            )


# ==============================================================================
# SUBCOMMAND 6: Diagnostics & Faults
# ==============================================================================
def cmd_diagnostics(args):
    print(f"\n{C_BOLD}--- EV Alarm & Diagnostic Logs ---{C_RESET}")
    faults = http_get("/api/history/diagnostics/faults?limit=15", base_url=args.api)
    if not isinstance(faults, list) or not faults:
        print(f"{C_GREEN}No faults recorded. System healthy.{C_RESET}")
        return

    print(f" {'TIMESTAMP':<19} | {'SEVERITY':<8} | {'FAULT CODE':<22} | {'MESSAGE'}")
    print(" " + "-" * 78)
    for f in faults:
        sev = f.get("severity")
        col = C_RED if sev == "CRITICAL" else C_YELLOW
        print(f" {f.get('timestamp_utc')[:19]:<19} | {col}{sev:<8}{C_RESET} | {f.get('code'):<22} | {f.get('message')}")


# ==============================================================================
# Main CLI Dispatcher
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="EV Smart Telemetry — Interactive Diagnostic & Calibration Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--api", type=str, default=DEFAULT_API, help=f"Backend base URL (default: {DEFAULT_API})")
    subparsers = parser.add_subparsers(dest="command", help="Operational mode")

    # Monitor
    subparsers.add_parser("monitor", help="Stream live digital instrument cluster")

    # Calibrate
    p_cal = subparsers.add_parser("calibrate", help="Adjust battery voltage calibration offset")
    p_cal.add_argument("--set-offset", type=float, default=None, help="Set offset value directly in Volts")
    p_cal.add_argument("--multimeter", type=float, default=None, help="Compute offset from multimeter reading in Volts")

    # Probe
    subparsers.add_parser("probe", help="Probe serial ports and scan baud rates")

    # Sniff
    subparsers.add_parser("sniff", help="Inspect and colorize recent raw protocol frames")

    # Trips
    p_trips = subparsers.add_parser("trips", help="Query and manage trip sessions")
    p_trips.add_argument("action", choices=["list", "start", "stop"], default="list", nargs="?")

    # Diagnostics
    subparsers.add_parser("diagnostics", help="View fault and alarm history")

    args = parser.parse_args()

    if args.command == "monitor":
        cmd_monitor(args)
    elif args.command == "calibrate":
        cmd_calibrate(args)
    elif args.command == "probe":
        cmd_probe(args)
    elif args.command == "sniff":
        cmd_sniff(args)
    elif args.command == "trips":
        cmd_trips(args)
    elif args.command == "diagnostics":
        cmd_diagnostics(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()