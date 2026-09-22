# EV Telemetry Hardware Identification & Interfacing Guide

> **CRITICAL DIRECTIVE**: Never invent or assume specifications.
> Values remain marked `UNKNOWN` until physically inspected, measured with an oscilloscope/multimeter, or verified via manufacturer datasheets.

---

## 1. Physical Component Registry

| Component | Make / Model | Identified Status | Interface / Protocol | Operating Voltage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EV Platform** | UNKNOWN | UNKNOWN | N/A | UNKNOWN | E-Scooter / Light EV chassis |
| **Motor Controller** | UNKNOWN | UNKNOWN | UART / CAN / RS485 | UNKNOWN | Common types: FarDriver, Kelly, Lingbo, VESC, Sabvoton |
| **BMS** | UNKNOWN | UNKNOWN | UART / CAN / RS485 / BLE | UNKNOWN | Common types: Daly, Ant, JBD, JK, Smart BMS |
| **Microcontroller** | ESP32-WROOM-32 | Identified | USB Serial / TWAI / UART | 3.3V Logic (5V USB) | Telemetry bridge node |
| **CAN Transceiver** | UNKNOWN (or none) | UNKNOWN | SPI / TWAI Direct | 3.3V / 5V | SN65HVD230 (3.3V) or MCP2515 (SPI) |

---

## 2. Telemetry Physical Layer Checklist

Before connecting any data lines to your laptop or ESP32, verify each item:

- [ ] **Common Ground Verified**: Multimeter continuity check confirms controller/BMS ground is connected to ESP32 ground.
- [ ] **Voltage Level Verification**:
  - Controller/BMS TX pin measured with multimeter with vehicle powered ON.
  - **WARNING**: If measured voltage is > 3.3V (e.g., 5V, 12V, or full battery pack voltage 48V/72V), **DO NOT CONNECT TO ESP32 DIRECTLY**. A logic level shifter, optoisolator, or voltage divider is mandatory.
- [ ] **Bus Identification**:
  - Two differential lines (~2.5V quiescent) $\rightarrow$ CAN Bus (`CAN_H`, `CAN_L`).
  - Single logic line sitting HIGH at 3.3V or 5V $\rightarrow$ UART TX line.
  - Differential lines sitting around -7V to +12V $\rightarrow$ RS-485 (`A`, `B`).
- [ ] **Strict Read-Only Physical Isolation**:
  - Connect **ONLY** `GND` and `TX` (from EV) to ESP32 `RX`.
  - Leave ESP32 `TX` pin completely disconnected.
  - If CAN is used: The CAN transceiver must have its `RS` or `SILENT` pin pulled HIGH, or the ESP32 TWAI driver must be initialized in `TWAI_MODE_LISTEN_ONLY`.

---

## 3. Communication Channel Parameters

### Serial / UART Interface
- **Port Identifier**: `/dev/ttyUSB0` (Linux) / `/dev/tty.usbserial-*` (macOS) / `COMx` (Windows)
- **Target Baud Rate Options**:
  - `9600` (Typical for basic BMS / legacy controllers)
  - `19200` / `38400` / `57600`
  - `115200` (Modern high-speed UART telemetry)
  - `921600` (ESP32 high-throughput bridge mode)
- **Frame Framing**: 8 Data Bits, No Parity, 1 Stop Bit (8-N-1) — *Pending verification*

### CAN Bus Interface (If Applicable)
- **Transceiver Type**: UNKNOWN
- **Standard Bitrate Candidates**: 250 kbps, 500 kbps, 1 Mbps
- **Identifier Type**: Standard (11-bit) vs Extended (29-bit)