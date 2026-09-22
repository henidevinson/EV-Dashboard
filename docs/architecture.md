# EV Smart Telemetry System Architecture

[ Physical EV Scooter ]
│ (Physical signals / Isolated Bus)
▼
[ ESP32 Telemetry Module ]
│ (USB Serial /dev/ttyUSB0)
▼
[ Python Telemetry Engine ]
├── PySerial Reader (Read-Only)
├── Protocol Decoder Pipeline
├── Validation & Fault Detection Engine
└── State Machine (Freshness & Connectivity)
│
▼
[ FastAPI & WebSocket Manager ]
│ (ws://localhost:8000/ws/telemetry)
▼
[ React EV Instrument Cluster ]

### Connectivity State Machine
1. `DISCONNECTED`: Backend has no active interface handle.
2. `CONNECTING`: Backend is attempting to open the communication interface.
3. `WAITING_FOR_DATA`: Interface opened, zero bytes/frames received yet.
4. `CONNECTED`: Valid, verified telemetry frames are continuously streaming.
5. `DATA_STALE`: More than 5.0 seconds have elapsed since the last valid frame.
6. `OFFLINE`: Interface connection lost or interrupted.
7. `ERROR`: Hardware faults, permission denial, or driver errors.
