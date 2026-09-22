# EV Smart Telemetry — Safety Architecture & Directives

## 1. Absolute Read-Only Constraint
This software is an observational diagnostics and instrument-cluster engine.
Under **NO CIRCUMSTANCES** shall this backend or any connected subsystem transmit
vehicle-actuating or controller-reprogramming commands.

### Prohibited Operations
- Throttle percentage injection
- Regenerative or mechanical brake overrides
- Motor direction/reverse switching
- Motor enable/disable signals
- Controller parameter/EEPROM flashes
- Battery Management System (BMS) cell balancing overrides or contactor toggling
- Transmission of arbitrary CAN control IDs or UART command packets

## 2. Hardware Isolation
- The ESP32 telemetry interface must be galvanically isolated from high-voltage DC lines (>12V/48V/72V).
- Serial and CAN hardware drivers must be opened strictly in listen/passive mode (`read-only`).
- The CAN transceiver should physically keep the `silent` pin pulled high or wire `Tx` disconnected if bidirectional communication is not strictly required.

## 3. Telemetry Integrity
- Signal loss must result in `DATA STALE` or `OFFLINE` status.
- Corrupted frames must be rejected by the validation pipeline, not smoothed with fake data.