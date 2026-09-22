# EV Smart Telemetry & Diagnostic Dashboard

A production-grade, real-time EV telemetry pipeline and digital instrument cluster designed for electric scooters.

## Core Rules
- **Zero Fake Data**: Unknown signals render as `NOT AVAILABLE` / `null`. Zero is treated as zero.
- **Read-Only Safety**: The system strictly listens and monitors; it never transmits control commands.
- **Protocol Agnostic**: Modular decoders decouple the telemetry pipeline from specific controller vendors.

## Current Status
- **Current Phase**: Phase 0 Complete (Project Foundation).
- **Next Phase**: Phase 1 (Hardware Identification & Raw Telemetry).