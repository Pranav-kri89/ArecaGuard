export const ESP32_ARDUINO_CODE = `/*
 * =========================================================
 * ESP32 LED Controller Code
 * =========================================================
 * Connects directly to the Web UI via USB Serial (115200 baud).
 * Works with any ESP32 board (ESP-WROOM-32, NodeMCU-32S, DOIT DevKit V1).
 *
 * HOW TO USE:
 * 1. Open Arduino IDE (or PlatformIO / Wokwi).
 * 2. Select Board: "DOIT ESP32 DEVKIT V1" (or your ESP32 model).
 * 3. Select Port: Your ESP32 COM port (e.g. COM3 / /dev/ttyUSB0).
 * 4. Paste this code and click Upload!
 * 5. In this web app, click "Connect ESP32 (Select Port)" and control the LED!
 */

// Most ESP32 boards have the onboard blue LED connected to GPIO 2.
// (If your board uses an external LED or different pin, change 2 here).
#define LED_PIN 2

void setup() {
  // Initialize Serial communication at 115200 baud
  Serial.begin(115200);
  
  // Configure LED pin as OUTPUT
  pinMode(LED_PIN, OUTPUT);
  
  // Initial state: LED OFF (Shutdown)
  digitalWrite(LED_PIN, LOW);
  
  delay(400);
  Serial.println("ESP32_READY: Port connected @ 115200 baud");
  Serial.println("Commands: '1'=Blink/ON, '0'=Shutdown/OFF, 'T'=Toggle");
}

void loop() {
  // Check if command received from Web UI
  if (Serial.available() > 0) {
    char cmd = Serial.read();

    if (cmd == '1' || cmd == 'B' || cmd == 'b') {
      // Blink LED 3 times quickly, then keep it ON
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(120);
        digitalWrite(LED_PIN, LOW);
        delay(120);
      }
      digitalWrite(LED_PIN, HIGH);
      Serial.println("LED_STATUS:ON");
    } 
    else if (cmd == '0' || cmd == 'S' || cmd == 's') {
      // Shutdown the LED (Turn OFF)
      digitalWrite(LED_PIN, LOW);
      Serial.println("LED_STATUS:OFF");
    } 
    else if (cmd == 'T' || cmd == 't') {
      // Toggle LED state
      int current = digitalRead(LED_PIN);
      digitalWrite(LED_PIN, !current);
      if (!current) {
        Serial.println("LED_STATUS:ON");
      } else {
        Serial.println("LED_STATUS:OFF");
      }
    }
  }
}
`;
