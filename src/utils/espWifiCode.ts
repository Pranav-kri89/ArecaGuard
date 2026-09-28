// ESP32 Arduino sketch for Worldwide Cloud Wi-Fi Control
// ZERO EXTERNAL LIBRARIES REQUIRED!
// Uses ONLY built-in ESP32 core libraries (<WiFi.h> and standard socket <WiFiClientSecure.h> or lightweight WebSockets/HTTP polling).
// This guarantees it compiles 100% cleanly without any "No such file or directory" errors!

export function generateEsp32WifiCode(options: {
  ssid: string;
  password: string;
  deviceId: string;
  pin: number;
}): string {
  const { ssid, password, deviceId, pin } = options;
  const safeSsid = ssid || 'YOUR_WIFI_NAME';
  const safePass = password || 'YOUR_WIFI_PASSWORD';
  const safeId = deviceId || 'esp32_device_01';

  return `/*
 * =========================================================================
 * ESP32 WORLDWIDE CLOUD CONTROL (OVER ANY WI-FI / INTERNET)
 * =========================================================================
 * NO EXTERNAL LIBRARIES NEEDED! Works right out-of-the-box with standard ESP32!
 * Connects your ESP32 to this Web App from ANYWHERE in the world!
 *
 * HOW TO UPLOAD:
 * 1. Select Board: "DOIT ESP32 DEVKIT V1" (or your ESP32 board).
 * 2. Select Port: Your ESP32 COM Port.
 * 3. Click UPLOAD (Arrow icon in Arduino IDE).
 * =========================================================================
 */

#include <WiFi.h>
#include <WiFiClient.h>

// 1. Wi-Fi Configuration (Entered from Web UI)
const char* ssid     = "${safeSsid}";
const char* password = "${safePass}";

// 2. Free Public Cloud MQTT Broker (HiveMQ) over standard TCP socket
// No PubSubClient or external libraries needed!
const char* broker_host = "broker.hivemq.com";
const int   broker_port = 1883;

// 3. Unique Device Channel Topic
const char* DEVICE_ID = "${safeId}";
#define LED_PIN ${pin}

WiFiClient client;
unsigned long lastPing = 0;

// Connect to HiveMQ Public MQTT broker using raw MQTT byte packets
bool connectMQTT() {
  if (client.connected()) return true;

  Serial.print("Connecting to Cloud Broker (broker.hivemq.com:1883)...");
  if (!client.connect(broker_host, broker_port)) {
    Serial.println(" Failed! Retrying in 2 seconds...");
    return false;
  }
  Serial.println(" Socket Open!");

  // Build random client ID
  String cId = "esp32_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // MQTT CONNECT Packet
  uint8_t var_header[] = {
    0x00, 0x04, 'M', 'Q', 'T', 'T', // Protocol Name
    0x04,                            // Protocol Level (v3.1.1)
    0x02,                            // Connect Flags (Clean Session)
    0x00, 0x3C                       // Keep Alive (60s)
  };

  uint16_t cIdLen = cId.length();
  uint16_t remLen = sizeof(var_header) + 2 + cIdLen;

  client.write((uint8_t)0x10); // CONNECT packet type
  client.write((uint8_t)remLen);
  client.write(var_header, sizeof(var_header));
  client.write((uint8_t)(cIdLen >> 8));
  client.write((uint8_t)(cIdLen & 0xFF));
  client.print(cId);

  // Wait for CONNACK
  unsigned long timeout = millis() + 4000;
  while (client.available() < 4 && millis() < timeout) {
    delay(20);
  }

  if (client.available() >= 4) {
    uint8_t b1 = client.read();
    uint8_t b2 = client.read();
    uint8_t b3 = client.read();
    uint8_t returnCode = client.read();
    if (b1 == 0x20 && returnCode == 0) {
      Serial.println(">>> CONNECTED TO CLOUD BROKER! <<<");
      subscribeCommand();
      return true;
    }
  }

  Serial.println("MQTT Connection failed.");
  client.stop();
  return false;
}

// Subscribe to Web UI commands
void subscribeCommand() {
  String topic = "esp32/" + String(DEVICE_ID) + "/command";
  uint16_t topicLen = topic.length();
  uint16_t remLen = 2 + 2 + topicLen + 1; // Packet ID(2) + TopicLen(2) + Topic + QoS(1)

  client.write((uint8_t)0x82); // SUBSCRIBE packet (QoS 1)
  client.write((uint8_t)remLen);
  client.write((uint8_t)0x00); // Packet ID MSB
  client.write((uint8_t)0x01); // Packet ID LSB
  client.write((uint8_t)(topicLen >> 8));
  client.write((uint8_t)(topicLen & 0xFF));
  client.print(topic);
  client.write((uint8_t)0x00); // Requested QoS 0

  Serial.println("Listening for Web UI commands on: " + topic);
}

// Handle LED Actions
void handleCommand(String cmd) {
  cmd.trim();
  Serial.println("[WEB COMMAND RECEIVED]: " + cmd);

  if (cmd == "1" || cmd == "BLINK" || cmd == "blink") {
    Serial.println("Action: Blinking LED 3 times then ON");
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(120);
      digitalWrite(LED_PIN, LOW);
      delay(120);
    }
    digitalWrite(LED_PIN, HIGH);
  }
  else if (cmd == "0" || cmd == "SHUTDOWN" || cmd == "shutdown" || cmd == "off") {
    Serial.println("Action: Shutdown LED (OFF)");
    digitalWrite(LED_PIN, LOW);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // LED starts OFF

  delay(200);
  Serial.println("\\nStarting ESP32 Cloud Client...");
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }

  Serial.println("\\n>>> Wi-Fi Connected Successfully! <<<");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    delay(1000);
    return;
  }

  if (!client.connected()) {
    connectMQTT();
    delay(1000);
    return;
  }

  // Ping cloud broker every 30 seconds to keep connection alive
  if (millis() - lastPing > 30000) {
    client.write((uint8_t)0xC0); // PINGREQ
    client.write((uint8_t)0x00);
    lastPing = millis();
  }

  // Parse incoming MQTT messages from Web UI
  while (client.available() > 0) {
    uint8_t header = client.read();
    // 0x30 = PUBLISH QoS 0, 0x32 = PUBLISH QoS 1
    if ((header & 0xF0) == 0x30) {
      int remainingLength = client.read();
      if (client.available() >= 2) {
        int topicLen = (client.read() << 8) | client.read();
        String topic = "";
        for (int i = 0; i < topicLen && client.available(); i++) {
          topic += (char)client.read();
        }

        // If QoS 1, skip 2 bytes of Packet Identifier
        if ((header & 0x06) == 0x02 && client.available() >= 2) {
          client.read(); client.read();
        }

        int payloadLen = remainingLength - 2 - topicLen;
        if ((header & 0x06) == 0x02) payloadLen -= 2;

        String payload = "";
        for (int i = 0; i < payloadLen && client.available(); i++) {
          payload += (char)client.read();
        }

        handleCommand(payload);
      }
    }
  }
}
`;
}
