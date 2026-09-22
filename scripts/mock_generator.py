#!/usr/bin/env python3
"""
EV Smart Telemetry - Standalone Mock Stream CLI
Emits simulated EV protocol packets to STDOUT or UDP for UI and integration testing.
"""

import argparse
import os
import socket
import sys
import time

# Ensure backend package is on Python module search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.telemetry.mock_generator import MockScenario, MockTelemetryGenerator


def main():
    parser = argparse.ArgumentParser(description="EV Telemetry - Standalone Mock Frame Generator")
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["normal", "drain", "regen", "fault_overvolt", "fault_undervolt", "fault_overtemp"],
        default="normal",
        help="Simulation scenario (default: normal)",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=10.0,
        help="Emission rate in Hz (default: 10.0)",
    )
    parser.add_argument(
        "--output",
        type=str,
        choices=["stdout", "udp"],
        default="stdout",
        help="Target output interface (default: stdout)",
    )
    parser.add_argument(
        "--udp-port",
        type=int,
        default=9870,
        help="UDP destination port if --output=udp (default: 9870)",
    )

    args = parser.parse_args()

    scenario_enum = MockScenario(args.scenario)
    generator = MockTelemetryGenerator(scenario=scenario_enum)
    delay = 1.0 / max(0.1, args.rate)

    udp_sock = None
    if args.output == "udp":
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    print("=" * 72)
    print("       EV SMART TELEMETRY - MOCK GENERATOR (SIMULATION ONLY)       ")
    print("=" * 72)
    print(f" Scenario  : {scenario_enum.value.upper()}")
    print(f" Rate      : {args.rate} Hz ({delay*1000:.1f}ms interval)")
    print(f" Output    : {args.output.upper()}")
    print(" Data Tag  : is_mock = TRUE | data_source = 'MOCK'")
    print("=" * 72)

    try:
        while True:
            raw_frame = generator.generate_raw_frame()
            hex_str = " ".join(f"{b:02X}" for b in raw_frame)
            phys = generator.physics

            if args.output == "stdout":
                print(
                    f"[{phys._current_phase:<6}] "
                    f"V={phys.pack_voltage:5.1f}V | "
                    f"I={phys.current_a:5.1f}A | "
                    f"SOC={phys.soc:4.1f}% | "
                    f"Speed={phys.speed_kmh:4.1f}km/h | "
                    f"RAW: {hex_str} | "
                    f"Faults: {phys.faults}"
                )
            elif args.output == "udp" and udp_sock:
                udp_sock.sendto(raw_frame, ("127.0.0.1", args.udp_port))

            time.sleep(delay)

    except KeyboardInterrupt:
        print("\n[INFO] Simulation halted by user.")
    finally:
        if udp_sock:
            udp_sock.close()


if __name__ == "__main__":
    main()
