# Physical Controller Handover & Integration Protocol

Follow this procedure when the physical EV motor controller or BMS unit arrives.

---

## Step 1: Physical Inspection & Electrical Safety Check

1. **Record Nameplate Data**:
   - Inspect the casing label for: Manufacturer (e.g., FarDriver, Kelly, Lingbo, VESC, Sabvoton), Model Number, Nominal Voltage, and Max Current.
   - Note the communication interface labeled on the harness: `UART`, `CAN`, `485`, or `LIN`.

2. **Multimeter Ground & Logic Voltage Verification (MANDATORY)**:
   - Power the vehicle or bench battery supply ON.
   - Set multimeter to **DC Voltage**.
   - Measure between vehicle **GND** and the signal **TX** line.
   - **CRITICAL**:
     - If voltage is **3.3V**: Safe for direct connection to ESP32 RX.
     - If voltage is **5.0V**: Requires a logic level shifter or 5V-tolerant optoisolator.
     - If voltage is **> 12V or Pack Voltage (48V/72V)**: **STOP**. Do NOT connect. This is a high-voltage auxiliary line (e.g. ignition or brake cut). Connecting will destroy the telemetry bridge.

3. **Strict Read-Only Physical Wiring**:
   - Connect **Vehicle GND** $\rightarrow$ **ESP32 GND**.
   - Connect **Vehicle TX** $\rightarrow$ **ESP32 RX (GPIO 16)**.
   - **LEAVE ESP32 TX DISCONNECTED**. Do not wire any transmit lines.

---

## Step 2: Automated Signal & Baud Probing

With the ESP32 connected via USB to your development computer, run the hardware probe tool:

```bash
python3 scripts/ev_tool.py probe