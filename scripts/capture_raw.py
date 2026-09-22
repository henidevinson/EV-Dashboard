#!/usr/bin/env python3
"""
EV Smart Telemetry - Raw Telemetry Capture & Analyzer
Strictly Read-Only Tool for Reverse Engineering Serial & Bridge Data.
"""

import os
import sys
import time
import argparse
from datetime import datetime, timezone
import serial
import serial.tools.list_ports


def list_available_ports():
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("[INFO] No serial ports detected on host system.")
        return
    print("\n--- Available Serial Ports ---")
    for p in ports:
        print(f"  • {p.device:<18} | {p.description}")
    print("------------------------------\n")


def format_hex_ascii(data: bytes) -> str:
    """Formats bytes into side-by-side HEX and ASCII output."""
    hex_str = " ".join(f"{b:02X}" for b in data)
    ascii_str = "".join(chr(b) if 32 <= b <= 126 else "." for b in data)
    return f"{hex_str:<48} | {ascii_str}"


def run_capture(port: str, baudrate: int, output_dir: str, duration: int | None):
    # Ensure capture output directory exists
    os.makedirs(output_dir, exist_ok=True)
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    raw_log_path = os.path.join(output_dir, f"raw_capture_{timestamp_str}.bin")
    text_log_path = os.path.join(output_dir, f"raw_capture_{timestamp_str}.log")

    print("=" * 70)
    print("        EV SMART TELEMETRY - READ-ONLY CAPTURE UTILITY         ")
    print("=" * 70)
    print(f" Target Port        : {port}")
    print(f" Baud Rate          : {baudrate}")
    print(f" Binary Output File : {raw_log_path}")
    print(f" Text Log File      : {text_log_path}")
    print(" Mode               : STRICT READ-ONLY (No outbound TX)")
    print("=" * 70)

    try:
        ser = serial.Serial(
            port=port,
            baudrate=baudrate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=0.5,
            write_timeout=0.0,  # Zero timeout: writes are strictly prohibited
        )
    except serial.SerialException as err:
        print(f"\n[ERROR] Failed to open serial interface '{port}': {err}")
        print("\nSuggestions:")
        print("  1. Verify the cable is securely plugged in.")
        print("  2. Ensure your user belongs to dialout group (Linux): sudo usermod -a -G dialout $USER")
        print("  3. Check if another process (e.g. minicom or another terminal) is holding the port.")
        list_available_ports()
        sys.exit(1)

    total_bytes = 0
    start_time = time.time()
    last_stats_time = start_time
    recent_bytes = 0

    print("[STATUS] Connection opened. Listening for incoming bytes... (Ctrl+C to stop)\n")

    with open(raw_log_path, "wb") as raw_file, open(text_log_path, "w", encoding="utf-8") as text_file:
        text_file.write(f"# EV Raw Capture Session Started: {timestamp_str}\n")
        text_file.write(f"# Port: {port} | Baud: {baudrate}\n\n")

        try:
            while True:
                # Check optional duration limit
                now = time.time()
                if duration and (now - start_time) >= duration:
                    print(f"\n[INFO] Configured capture duration ({duration}s) reached.")
                    break

                # Read available chunk without blocking
                chunk = ser.read(32)

                if chunk:
                    total_bytes += len(chunk)
                    recent_bytes += len(chunk)

                    # Persist raw binary
                    raw_file.write(chunk)
                    raw_file.flush()

                    # Format formatted hex/ascii text
                    formatted_line = format_hex_ascii(chunk)
                    text_file.write(formatted_line + "\n")
                    text_file.flush()

                    print(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}]  {formatted_line}")

                # Calculate and display rolling data rate every 2 seconds
                if (now - last_stats_time) >= 2.0:
                    elapsed = now - last_stats_time
                    rate_bps = recent_bytes / elapsed
                    overall_rate = total_bytes / (now - start_time)
                    print(
                        f"  >>> STATS: Instantaneous: {rate_bps:.1f} B/s | "
                        f"Average: {overall_rate:.1f} B/s | "
                        f"Total Received: {total_bytes} bytes"
                    )
                    recent_bytes = 0
                    last_stats_time = now

        except KeyboardInterrupt:
            print("\n[INFO] Capture interrupted by user (Ctrl+C).")
        finally:
            ser.close()

    total_duration = time.time() - start_time
    print("\n" + "=" * 70)
    print("CAPTURE COMPLETE")
    print(f" Total Duration      : {total_duration:.2f} seconds")
    print(f" Total Bytes Read    : {total_bytes} bytes")
    if total_duration > 0:
        print(f" Overall Throughput  : {(total_bytes / total_duration):.2f} B/s")
    print(f" Raw binary saved to : {raw_log_path}")
    print(f" Log text saved to   : {text_log_path}")
    print("=" * 70)

    if total_bytes == 0:
        print("\n[WARNING] Zero bytes were received.")
        print("Diagnostic Steps:")
        print("  1. Multimeter check: Is the controller/BMS actively powered ON?")
        print("  2. Polarity check: Is Vehicle TX wired to ESP32/Adapter RX?")
        print("  3. Baud rate mismatch: Try scanning other baud rates (e.g. 19200, 38400, 115200).")
        print("  4. Idle bus: Some controllers only broadcast when throttle is turned or key switch is set to ON.")


def main():
    parser = argparse.ArgumentParser(
        description="EV Telemetry - Passive Read-Only Serial Capture Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--port",
        type=str,
        default="/dev/ttyUSB0",
        help="Target serial port device (e.g. /dev/ttyUSB0, COM3). Default: /dev/ttyUSB0",
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=9600,
        help="Baud rate (e.g. 9600, 19200, 38400, 115200). Default: 9600",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="hardware/raw_captures",
        help="Directory to save raw dumps. Default: hardware/raw_captures",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=None,
        help="Optional capture timeout in seconds. Runs indefinitely if omitted.",
    )
    parser.add_argument(
        "--list-ports",
        action="store_true",
        help="Display all available serial ports and exit.",
    )

    args = parser.parse_args()

    if args.list_ports:
        list_available_ports()
        sys.exit(0)

    run_capture(
        port=args.port,
        baudrate=args.baud,
        output_dir=args.output_dir,
        duration=args.duration,
    )


if __name__ == "__main__":
    main()