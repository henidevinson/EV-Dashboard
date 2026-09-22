# EV Smart Telemetry — Protocol Framing & Byte Specification

## 1. Frame Architecture Overview

All telemetry frames on the serial line follow a synchronized packet structure:

+---------------+---------------+---------------+---------------+----------------------+---------------+
| Preamble | Address | Frame ID | Payload Len | Data Payload | Checksum |
| (1 Byte) | (1 Byte) | (1 Byte) | (1 Byte) | (8 Bytes) | (1 Byte) |
| Offset 0 | Offset 1 | Offset 2 | Offset 3 | Offset 4 - 11 | Offset 12 |
+---------------+---------------+---------------+---------------+----------------------+---------------+

- **Fixed Frame Length**: Exactly 13 bytes.
- **Preamble (Start Byte)**: `0xA5`
- **Host / Target Address**: `0x40` (BMS / Controller broadcast identifier)
- **Checksum Calculation**: Modulo-256 8-bit sum of bytes 0 through 11:
  $$\text{Checksum} = \left( \sum_{i=0}^{11} \text{byte}[i] \right) \pmod{256}$$

---

## 2. Byte-Level Mapping Table

### Frame Type: `0x90` — Cumulative Pack Metrics & SOC

| Byte Offset | Field Name | Data Type | Endianness | Scale Factor | Base Offset | Unit | Valid Range | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `0` | **Preamble** | `uint8` | N/A | Direct | `0` | Hex | `0xA5` | Fixed packet sync byte |
| `1` | **Target Address** | `uint8` | N/A | Direct | `0` | Hex | `0x40` | Device identifier |
| `2` | **Frame ID** | `uint8` | N/A | Direct | `0` | Hex | `0x90` | Command / Telemetry ID |
| `3` | **Payload Length** | `uint8` | N/A | Direct | `0` | Integer | `0x08` (8 bytes) | Fixed length payload |
| `4 - 5` | **Raw Pack Voltage** | `uint16` | Big-Endian | `0.1` | `0.0` | Volts ($V$) | `0.0` – `120.0` | $V_{\text{raw}} = \text{RAW} \times 0.1$ |
| `6 - 7` | **Acquisition Voltage** | `uint16` | Big-Endian | `0.1` | `0.0` | Volts ($V$) | `0.0` – `120.0` | Uncalibrated sensor tap |
| `8 - 9` | **Current** | `uint16` | Big-Endian | `0.1` | `-3000.0` | Amperes ($A$) | `-300.0` – `+300.0` | $I = (\text{RAW} - 30000) \times 0.1$ |
| `10 - 11` | **State of Charge (SOC)**| `uint16` | Big-Endian | `0.1` | `0.0` | Percent ($\%$) | `0.0` – `100.0` | $\text{SOC} = \text{RAW} \times 0.1$ |
| `12` | **Checksum** | `uint8` | N/A | Direct | `0` | Hex | `0x00` – `0xFF` | $\sum_{i=0}^{11} \text{byte}[i] \pmod{256}$ |

---

## 3. Voltage Calibration Formula

To compensate for resistive harness drops and analog-to-digital converter (ADC) tolerances:

$$V_{\text{calibrated}} = V_{\text{raw}} + V_{\text{offset}}$$

- $V_{\text{raw}}$: Direct physical value decoded from payload bytes 4–5.
- $V_{\text{offset}}$: Configurable calibration constant specified in `backend/.env` via `VOLTAGE_OFFSET`.

---

## 4. Handling Missing or Unsupported Metrics

The physical EV packet may omit certain signals (such as motor temperature, speed, or RPM).
- **CRITICAL ARCHITECTURAL RULE**: Unsupported fields **MUST NOT** be simulated or substituted with default constants (e.g., zero or arbitrary numbers).
- Missing metrics must strictly evaluate to `None` (`null` in JSON output).