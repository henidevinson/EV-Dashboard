/*
 * EV Smart Telemetry - Read-Only Hardware Bridge
 * Target Microcontroller: ESP32 / ESP32-S3
 *
 * SAFETY GUARANTEE:
 * - Operates in STRICT READ-ONLY mode.
 * - In UART mode: Transmit (TX) line is not initialized (GPIO_NUM_NC).
 * - In CAN mode: TWAI peripheral is initialized in LISTEN-ONLY mode (zero ACK / zero frame transmission).
 */

#include <Arduino.h>

// ==========================================
// CONFIGURATION: Select Operational Mode
// ==========================================
#define MODE_UART_SNIFFER  1
#define MODE_CAN_SNIFFER   0

// ------------------------------------------
// Configuration: Mode A (UART Sniffer)
// ------------------------------------------
#if MODE_UART_SNIFFER
  #define EV_RX_PIN          16      // Connect to Vehicle TX line (Check voltage first!)
  #define EV_BAUDRATE        9600    // Adjust to controller/BMS baud rate
  #define USB_BAUDRATE       115200  // High-speed bridge link to host PC
  HardwareSerial EVSerial(2);
#endif

// ------------------------------------------
// Configuration: Mode B (CAN/TWAI Sniffer)
// ------------------------------------------
#if MODE_CAN_SNIFFER
  #include "driver/twai.h"
  #define CAN_TX_PIN         GPIO_NUM_5   // Connected to Transceiver TXD
  #define CAN_RX_PIN         GPIO_NUM_4   // Connected to Transceiver RXD
  #define USB_BAUDRATE       115200
#endif

void setup() {
    Serial.begin(USB_BAUDRATE);
    while (!Serial && millis() < 2000) {
        // Allow serial console to enumerate
    }

    Serial.println();
    Serial.println(F("============================================="));
    Serial.println(F("   EV TELEMETRY BRIDGE: STRICT READ-ONLY     "));
    Serial.println(F("============================================="));

#if MODE_UART_SNIFFER
    Serial.printf("[INIT] UART Sniffer initialized on GPIO %d at %d baud.\n", EV_RX_PIN, EV_BAUDRATE);
    Serial.println(F("[SAFETY] TX disabled. No data can be written to vehicle."));
    // Initializing RX only; TX pin is unassigned (-1)
    EVSerial.begin(EV_BAUDRATE, SERIAL_8N1, EV_RX_PIN, -1);
#endif

#if MODE_CAN_SNIFFER
    Serial.println(F("[INIT] Initializing ESP32 TWAI (CAN) Controller..."));
    
    // Listen-only mode prevents ACK transmission and bus alteration
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_LISTEN_ONLY);
    // Standard 250 kbps timing (adjust if vehicle runs at 500k: TWAI_TIMING_CONFIG_500KBITS())
    twai_timing_config_t t_config = TWAI_TIMING_CONFIG_250KBITS();
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

    if (twai_driver_install(&g_config, &t_config, &f_config) == ESP_OK) {
        Serial.println(F("[OK] TWAI driver installed in TWAI_MODE_LISTEN_ONLY."));
    } else {
        Serial.println(F("[FATAL] Failed to install TWAI driver. Halting."));
        while (1) { delay(1000); }
    }

    if (twai_start() == ESP_OK) {
        Serial.println(F("[OK] TWAI controller started. Passively monitoring CAN traffic."));
    } else {
        Serial.println(F("[FATAL] Failed to start TWAI driver. Halting."));
        while (1) { delay(1000); }
    }
#endif
}

void loop() {
#if MODE_UART_SNIFFER
    // Forward raw bytes directly from EV to host PC
    if (EVSerial.available()) {
        uint8_t buffer[64];
        size_t bytesRead = EVSerial.readBytes(buffer, sizeof(buffer));
        if (bytesRead > 0) {
            Serial.write(buffer, bytesRead);
        }
    }
#endif

#if MODE_CAN_SNIFFER
    twai_message_t message;
    esp_err_t result = twai_receive(&message, pdMS_TO_TICKS(10));
    
    if (result == ESP_OK) {
        // Output format: CAN,[ID_HEX],[EXTENDED_FLAG],[DLC],[DATA_BYTES_HEX]
        Serial.printf("CAN,0x%03X,%d,%d,", message.identifier, message.extd, message.data_length_code);
        for (int i = 0; i < message.data_length_code; i++) {
            Serial.printf("%02X", message.data[i]);
            if (i < message.data_length_code - 1) Serial.print(" ");
        }
        Serial.println();
    }
#endif
}