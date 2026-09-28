export function generateArecaDryerEsp32Code(options: {
  wifiSsid?: string;
  wifiPassword?: string;
  serverUrl?: string;
  roofOpenSeconds?: number;
  roofCloseSeconds?: number;
}): string {
  const ssid = options.wifiSsid || 'realme P3 Ultra 5G';
  const pass = options.wifiPassword || '00000000';
  const url = options.serverUrl || 'https://ais-pre-xiau7jzs77ozinfu2pjde6-449164489489.asia-east1.run.app/sensor-data';
  const defaultOpenSec = options.roofOpenSeconds ?? 5.56;
  const defaultCloseSec = options.roofCloseSeconds ?? 4.88;

  return `/*
 * =========================================================================
 * ARECANUT SOLAR FARM DRYER - ESP32 WI-FI IOT CONTROLLER
 * WITH DUAL-CHANNEL 12V MOTOR DRIVER & AUXILIARY 12V HEATER/DRYER
 * =========================================================================
 * 
 * [CALIBRATED PARAMETERS]:
 * - Roof Open Duration:  ${defaultOpenSec} Seconds
 * - Roof Close Duration: ${defaultCloseSec} Seconds
 * 
 * [BOARD PIN LABELS - Exact labels printed on your ESP32 board]:
 * - DHT22 Data:   Pin D4 (Power to 3V3, Ground to GND)
 * - Rain Sensor:  Analog AO to Pin D34 | Digital DO to Pin D27
 * - LDR Sunlight: Analog AO to Pin D35 (Power to 3V3, Ground to GND)
 * 
 * [DUAL 12V MOTOR DRIVER WIRING (L298N / BTS7960 / H-BRIDGE)]:
 * - Power: 12V (+) to 12V terminal, GND to ESP32 GND & Power supply (-)
 * 
 * --- CHANNEL A: ROOF CANOPY ACTUATOR ---
 * - Driver IN1:   Pin D26 (Roof Open / Forward)
 * - Driver IN2:   Pin D25 (Roof Close / Reverse)
 * - Driver ENA:   Pin D14 (PWM Speed Control)
 * 
 * --- CHANNEL B: 12V HEATER & HOT-AIR DRYER SYSTEM ---
 * - Driver IN3:   Pin D33 (12V Heater Element / Fan Driver Positive)
 * - Driver IN4:   Pin D32 (Ground Return / Low)
 * - Driver ENB:   Pin D12 (PWM Heater Intensity)
 * 
 * [STATUS INDICATOR]:
 * - Blue LED:     Onboard status LED on Pin D2
 * 
 * [BLUE LED BEHAVIOR SPECIFICATION]:
 * 1. Wi-Fi Disconnected: Blue LED is OFF.
 * 2. Wi-Fi Connected (Waiting for Web UI Handshake): Blue LED is SOLID ON.
 * 3. Connected to Web UI (Streaming active data): Blue LED BLINKS CONTINUOUSLY!
 * 
 * [REQUIRED ARDUINO LIBRARIES - Available in Arduino Library Manager]:
 * 1. "PubSubClient" by Nick O'Leary
 * 2. "DHT sensor library" by Adafruit
 * =========================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include "DHT.h"

#if __has_include(<esp_arduino_version.h>)
  #include <esp_arduino_version.h>
#endif

// ==========================================
// 1. WI-FI & DUAL-CHANNEL TELEMETRY CONFIG
// ==========================================
const char* WIFI_SSID     = "${ssid}";
const char* WIFI_PASSWORD = "${pass}";

// Public Cloud MQTT Broker (Bypasses all HTTP 302 redirects, works 100% over Wi-Fi)
const char* MQTT_BROKER   = "test.mosquitto.org";
const int   MQTT_PORT     = 1883;
const char* TOPIC_DATA    = "areca-farm-dryer/telemetry";
const char* TOPIC_ACK     = "areca-farm-dryer/ack";
const char* TOPIC_COMMAND = "areca-farm-dryer/command";

// Fallback HTTP Ingestion URL
const char* SERVER_URL    = "${url}";

// ==========================================
// 2. HARDWARE PINS (EXACT BOARD LABELS)
// ==========================================
#define LED_PIN 2           // Built-in Blue LED -> Board Pin: D2
#define DHT_PIN 4           // DHT22 Data Wire  -> Board Pin: D4
#define DHT_TYPE DHT22
#define RAIN_AO_PIN 34      // Rain Plate Analog AO -> Board Pin: D34
#define RAIN_DO_PIN 27      // Rain Plate Digital DO -> Board Pin: D27
#define LDR_AO_PIN 35       // LDR Sunlight Sensor -> Board Pin: D35

// 12V Motor Driver Interface (Channel A: Roof Canopy Actuator)
// NOTE: If you leave the factory black jumper cap ON ENA, it runs at 100% full torque.
#define MOTOR1_IN1_PIN 26   // Driver IN1 -> Board Pin: D26 (Roof Open / Forward)
#define MOTOR1_IN2_PIN 25   // Driver IN2 -> Board Pin: D25 (Roof Close / Reverse)
#define MOTOR1_ENA_PIN 14   // Driver ENA -> Board Pin: D14 (PWM Speed Control)

// 12V Motor Driver Interface (Channel B: 12V Heater & Hot-Air Dryer for Arecanut)
// NOTE: If you leave the factory black jumper cap ON ENB, heater runs at 100% full power.
#define HEATER_IN3_PIN 33   // Driver IN3 -> Board Pin: D33 (Heater Output)
#define HEATER_IN4_PIN 32   // Driver IN4 -> Board Pin: D32 (Ground Return)
#define HEATER_ENB_PIN 12   // Driver ENB -> Board Pin: D12 (PWM Heater Intensity)

// ==========================================
// ESP32 CORE 2.x vs 3.x PWM COMPATIBILITY
// Fixes "ledcSetup was not declared in this scope" on ESP32 Core v3+
// ==========================================
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  // ESP32 Arduino Core 3.0+ API
  #define SETUP_MOTOR_PWM()  ledcAttach(MOTOR1_ENA_PIN, 5000, 8)
  #define SETUP_HEATER_PWM() ledcAttach(HEATER_ENB_PIN, 5000, 8)
  #define SET_MOTOR_PWM(val)  ledcWrite(MOTOR1_ENA_PIN, (val))
  #define SET_HEATER_PWM(val) ledcWrite(HEATER_ENB_PIN, (val))
#else
  // ESP32 Arduino Core 2.x Legacy API
  #define SETUP_MOTOR_PWM()  do { ledcSetup(0, 5000, 8); ledcAttachPin(MOTOR1_ENA_PIN, 0); } while(0)
  #define SETUP_HEATER_PWM() do { ledcSetup(1, 5000, 8); ledcAttachPin(HEATER_ENB_PIN, 1); } while(0)
  #define SET_MOTOR_PWM(val)  ledcWrite(0, (val))
  #define SET_HEATER_PWM(val) ledcWrite(1, (val))
#endif

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient espWifiClient;
PubSubClient mqttClient(espWifiClient);

// Dynamic Farm Parameters (Synced live over Wi-Fi without modifying or reflashing code!)
float paramHeaterMinTemp = 26.0;
float paramHeaterMaxTemp = 38.0;
int   paramHeaterPwm = 100;
int   paramRainAnalogThresh = 2800;
int   paramRainDebounceChecks = 3;
int   paramDryDebounceChecks = 4;
int   paramSunlightDayThresh = 2600;
int   paramNightThresh = 3400;
int   paramRoofOpenSec = 10;
int   paramRoofCloseSec = 14;
int   paramMotorSpeed = 100;
bool  paramReverseDirection = false;

// Motor State
unsigned long motor1StopMillis = 0;
bool isMotor1Running = false;

// 12V Heater State
bool isHeaterActive = false;
unsigned long heaterStartMillis = 0;
int heaterPwmDuty = 255; // 100% power default

void stopAllMotors() {
  digitalWrite(MOTOR1_IN1_PIN, LOW);
  digitalWrite(MOTOR1_IN2_PIN, LOW);
  SET_MOTOR_PWM(0); // Disable Channel A PWM
  isMotor1Running = false;
  Serial.println("[12V MOTOR] Roof motor stopped / IDLE");
}

void set12vHeater(bool enable, int powerPct = 100) {
  if (enable) {
    int pwm = map(constrain(powerPct, 30, 100), 0, 100, 0, 255);
    SET_HEATER_PWM(pwm); // PWM on Channel B (ENB)
    digitalWrite(HEATER_IN3_PIN, HIGH);
    digitalWrite(HEATER_IN4_PIN, LOW);
    isHeaterActive = true;
    heaterStartMillis = millis();
    Serial.print("[12V HEATER/DRYER] ON via Driver Channel B at ");
    Serial.print(powerPct);
    Serial.println("% power (IN3:HIGH, IN4:LOW)");
  } else {
    digitalWrite(HEATER_IN3_PIN, LOW);
    digitalWrite(HEATER_IN4_PIN, LOW);
    SET_HEATER_PWM(0);
    isHeaterActive = false;
    Serial.println("[12V HEATER/DRYER] OFF (IN3:LOW, IN4:LOW, ENB:0)");
  }
}

void runRoofMotor(bool openDirection, int durationSeconds, int speedPercent = 100) {
  int pwmDuty = map(constrain(speedPercent, 30, 100), 0, 100, 0, 255);
  SET_MOTOR_PWM(pwmDuty);

  bool actualOpen = paramReverseDirection ? !openDirection : openDirection;

  if (actualOpen) {
    // OPEN / FRONT rotation
    digitalWrite(MOTOR1_IN1_PIN, HIGH);
    digitalWrite(MOTOR1_IN2_PIN, LOW);
    Serial.print("[12V MOTOR] Rotating OPEN / FRONT for ");
    Serial.print(durationSeconds);
    Serial.print(" seconds at ");
    Serial.print(speedPercent);
    Serial.println("% speed");
  } else {
    // CLOSE / BACK rotation
    digitalWrite(MOTOR1_IN1_PIN, LOW);
    digitalWrite(MOTOR1_IN2_PIN, HIGH);
    Serial.print("[12V MOTOR] Rotating CLOSE / BACK for ");
    Serial.print(durationSeconds);
    Serial.print(" seconds at ");
    Serial.print(speedPercent);
    Serial.println("% speed");
  }

  motor1StopMillis = millis() + (unsigned long)durationSeconds * 1000UL;
  isMotor1Running = true;
}

// Status flags for the Blue LED
bool isWifiConnected = false;
bool isWebUiConnected = false;
unsigned long lastWebUiSuccess = 0;
unsigned long lastLedBlinkTime = 0;
bool ledBlinkState = false;

// Forward declarations
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length);
void applySettingsJson(String payload);
void fetchStartupConfig();

// ==========================================
// DYNAMIC OTA SETTINGS PARSER (NO CODE REFLASH)
// ==========================================
void applySettingsJson(String payload) {
  int tMinIdx = payload.indexOf("heaterMinTempThreshold");
  if (tMinIdx >= 0) {
    int colon = payload.indexOf(':', tMinIdx);
    if (colon >= 0) paramHeaterMinTemp = payload.substring(colon + 1).toFloat();
  }

  int tMaxIdx = payload.indexOf("heaterMaxTempTarget");
  if (tMaxIdx >= 0) {
    int colon = payload.indexOf(':', tMaxIdx);
    if (colon >= 0) paramHeaterMaxTemp = payload.substring(colon + 1).toFloat();
  }

  int pwmIdx = payload.indexOf("heaterPwmPower");
  if (pwmIdx >= 0) {
    int colon = payload.indexOf(':', pwmIdx);
    if (colon >= 0) paramHeaterPwm = payload.substring(colon + 1).toInt();
  }

  int rThreshIdx = payload.indexOf("rainAnalogThreshold");
  if (rThreshIdx >= 0) {
    int colon = payload.indexOf(':', rThreshIdx);
    if (colon >= 0) paramRainAnalogThresh = payload.substring(colon + 1).toInt();
  }

  int rDebIdx = payload.indexOf("rainDebounceChecks");
  if (rDebIdx >= 0) {
    int colon = payload.indexOf(':', rDebIdx);
    if (colon >= 0) paramRainDebounceChecks = payload.substring(colon + 1).toInt();
  }

  int dDebIdx = payload.indexOf("dryDebounceChecks");
  if (dDebIdx >= 0) {
    int colon = payload.indexOf(':', dDebIdx);
    if (colon >= 0) paramDryDebounceChecks = payload.substring(colon + 1).toInt();
  }

  int sunIdx = payload.indexOf("sunlightDayLuxAdc");
  if (sunIdx >= 0) {
    int colon = payload.indexOf(':', sunIdx);
    if (colon >= 0) paramSunlightDayThresh = payload.substring(colon + 1).toInt();
  }

  int nightIdx = payload.indexOf("nightDetectionThreshold");
  if (nightIdx >= 0) {
    int colon = payload.indexOf(':', nightIdx);
    if (colon >= 0) paramNightThresh = payload.substring(colon + 1).toInt();
  }

  int openSecIdx = payload.indexOf("roofOpenSeconds");
  if (openSecIdx >= 0) {
    int colon = payload.indexOf(':', openSecIdx);
    if (colon >= 0) paramRoofOpenSec = payload.substring(colon + 1).toInt();
  }

  int closeSecIdx = payload.indexOf("roofCloseSeconds");
  if (closeSecIdx >= 0) {
    int colon = payload.indexOf(':', closeSecIdx);
    if (colon >= 0) paramRoofCloseSec = payload.substring(colon + 1).toInt();
  }

  int spdIdx = payload.indexOf("motorSpeedPercent");
  if (spdIdx >= 0) {
    int colon = payload.indexOf(':', spdIdx);
    if (colon >= 0) paramMotorSpeed = payload.substring(colon + 1).toInt();
  }

  int revIdx = payload.indexOf("reverseDirection");
  if (revIdx >= 0) {
    int colon = payload.indexOf(':', revIdx);
    if (colon >= 0) {
      int truePos = payload.indexOf("true", colon);
      paramReverseDirection = (truePos >= 0 && truePos < colon + 10);
    }
  }

  Serial.println("[LIVE OTA DYNAMIC SYNC] Settings successfully applied in RAM from Web UI!");
  Serial.print(" > 12V Dryer Temp: Min ");
  Serial.print(paramHeaterMinTemp, 1);
  Serial.print("C | Target ");
  Serial.print(paramHeaterMaxTemp, 1);
  Serial.print("C | PWM: ");
  Serial.print(paramHeaterPwm);
  Serial.println("%");

  Serial.print(" > Sensor Thresh: Rain ADC ");
  Serial.print(paramRainAnalogThresh);
  Serial.print(" (Debounce: ");
  Serial.print(paramRainDebounceChecks);
  Serial.print(") | Sun ADC: ");
  Serial.println(paramSunlightDayThresh);

  Serial.print(" > Motor Actuator: Open ");
  Serial.print(paramRoofOpenSec);
  Serial.print("s | Close ");
  Serial.print(paramRoofCloseSec);
  Serial.print("s | Speed: ");
  Serial.print(paramMotorSpeed);
  Serial.print("% | Rev: ");
  Serial.println(paramReverseDirection ? "YES" : "NO");
}

void fetchStartupConfig() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String configUrl = "${url}";
    int lastSlash = configUrl.lastIndexOf('/');
    if (lastSlash > 0) {
      configUrl = configUrl.substring(0, lastSlash) + "/api/esp-config";
    }
    http.begin(configUrl);
    int code = http.GET();
    if (code == 200) {
      String payload = http.getString();
      applySettingsJson(payload);
    }
    http.end();
  }
}

// ==========================================
// CENTRAL COMMAND EXECUTION (Processes MQTT, Serial & HTTP Commands)
// ==========================================
void executeCommandString(String message) {
  // 1. Emergency Motor Stop & Inching Release Stop
  // Strict matching to prevent matching 'autoStopSafetyLimit' or 'isEmergencyStopped'
  if (message.indexOf("MOTOR_STOP") >= 0 || 
      (message.indexOf("STOP") >= 0 && message.indexOf("settings") < 0 && message.indexOf("autoStop") < 0) ||
      message == "STOP") {
    stopAllMotors();
    return;
  }

  // 2. Momentary Test Inching / Long-Press Calibration
  if (message.indexOf("MOMENTARY_OPEN") >= 0) {
    int pwmDuty = map(constrain(paramMotorSpeed, 30, 100), 0, 100, 0, 255);
    SET_MOTOR_PWM(pwmDuty);
    bool actualOpen = paramReverseDirection ? false : true;
    if (actualOpen) {
      digitalWrite(MOTOR1_IN1_PIN, HIGH);
      digitalWrite(MOTOR1_IN2_PIN, LOW);
    } else {
      digitalWrite(MOTOR1_IN1_PIN, LOW);
      digitalWrite(MOTOR1_IN2_PIN, HIGH);
    }
    motor1StopMillis = millis() + 120000UL; // 2 min failsafe timeout while held
    isMotor1Running = true;
    Serial.println("[TEST INCHING] Running OPEN continuously while button held");
    return;
  }

  if (message.indexOf("MOMENTARY_CLOSE") >= 0) {
    int pwmDuty = map(constrain(paramMotorSpeed, 30, 100), 0, 100, 0, 255);
    SET_MOTOR_PWM(pwmDuty);
    bool actualOpen = paramReverseDirection ? true : false;
    if (actualOpen) {
      digitalWrite(MOTOR1_IN1_PIN, HIGH);
      digitalWrite(MOTOR1_IN2_PIN, LOW);
    } else {
      digitalWrite(MOTOR1_IN1_PIN, LOW);
      digitalWrite(MOTOR1_IN2_PIN, HIGH);
    }
    motor1StopMillis = millis() + 120000UL; // 2 min failsafe timeout while held
    isMotor1Running = true;
    Serial.println("[TEST INCHING] Running CLOSE continuously while button held");
    return;
  }

  // 3. Canopy Roof Movements (Standard and Test Cycles)
  if (message.indexOf("MOTOR_CLOSE") >= 0 || message.indexOf("CLOSE_IMMEDIATELY") >= 0 || message.indexOf("CLOSE") >= 0) {
    float durationFloat = (float)paramRoofCloseSec;
    int durIdx = message.indexOf("durationSec");
    if (durIdx >= 0) {
      int colon = message.indexOf(':', durIdx);
      if (colon >= 0) {
        durationFloat = message.substring(colon + 1).toFloat();
        if (durationFloat <= 0.1) durationFloat = (float)paramRoofCloseSec;
      }
    }
    int speedPct = paramMotorSpeed;
    int speedIdx = message.indexOf("speed");
    if (speedIdx >= 0) {
      int colon = message.indexOf(':', speedIdx);
      if (colon >= 0) {
        int parsedSpd = message.substring(colon + 1).toInt();
        if (parsedSpd >= 30 && parsedSpd <= 100) speedPct = parsedSpd;
      }
    }
    runRoofMotor(false, (int)ceil(durationFloat), speedPct);
    motor1StopMillis = millis() + (unsigned long)(durationFloat * 1000.0);
    isMotor1Running = true;
    Serial.print("[CANOPY 12V] Actuator set to CLOSE for ");
    Serial.print(durationFloat);
    Serial.println("s");
    return;
  }

  if (message.indexOf("MOTOR_OPEN") >= 0 || message.indexOf("KEEP_OPEN") >= 0 || message.indexOf("OPEN") >= 0) {
    float durationFloat = (float)paramRoofOpenSec;
    int durIdx = message.indexOf("durationSec");
    if (durIdx >= 0) {
      int colon = message.indexOf(':', durIdx);
      if (colon >= 0) {
        durationFloat = message.substring(colon + 1).toFloat();
        if (durationFloat <= 0.1) durationFloat = (float)paramRoofOpenSec;
      }
    }
    int speedPct = paramMotorSpeed;
    int speedIdx = message.indexOf("speed");
    if (speedIdx >= 0) {
      int colon = message.indexOf(':', speedIdx);
      if (colon >= 0) {
        int parsedSpd = message.substring(colon + 1).toInt();
        if (parsedSpd >= 30 && parsedSpd <= 100) speedPct = parsedSpd;
      }
    }
    runRoofMotor(true, (int)ceil(durationFloat), speedPct);
    motor1StopMillis = millis() + (unsigned long)(durationFloat * 1000.0);
    isMotor1Running = true;
    Serial.print("[CANOPY 12V] Actuator set to OPEN for ");
    Serial.print(durationFloat);
    Serial.println("s");
    return;
  }

  // 4. 12V Heater & Hot-Air Dryer Control
  if (message.indexOf("HEATER_ON") >= 0) {
    int pwm = 100;
    int pwmIdx = message.indexOf("pwm");
    if (pwmIdx >= 0) {
      int colon = message.indexOf(':', pwmIdx);
      if (colon >= 0) {
        pwm = message.substring(colon + 1).toInt();
        if (pwm <= 0) pwm = 100;
      }
    }
    set12vHeater(true, pwm);
    return;
  }

  if (message.indexOf("HEATER_OFF") >= 0) {
    set12vHeater(false);
    return;
  }

  // 5. Update Parameter Changing System (Zero Code Modification live OTA sync)
  if (message.indexOf("UPDATE_FARM_SETTINGS") >= 0 || 
      message.indexOf("UPDATE_MOTOR_SETTINGS") >= 0 || 
      message.indexOf("heaterMinTempThreshold") >= 0 || 
      message.indexOf("rainAnalogThreshold") >= 0) {
    applySettingsJson(message);
    return;
  }
}

// ==========================================
// MQTT CALLBACK (Receives Web UI Commands & Settings)
// ==========================================
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  // 0. Isolate Heartbeat / Telemetry ACK
  // TOPIC_ACK is solely for connection heartbeat verification.
  // We NEVER execute motor actions or stops from heartbeat ACK messages!
  if (strcmp(topic, TOPIC_ACK) == 0) {
    isWebUiConnected = true;
    lastWebUiSuccess = millis();
    return;
  }

  Serial.print("[WI-FI MQTT COMMAND] Message Received: ");
  Serial.println(message);

  // Web UI is verified online!
  isWebUiConnected = true;
  lastWebUiSuccess = millis();

  executeCommandString(message);
}

// Connect or reconnect to MQTT Broker over Wi-Fi
void ensureMqttConnected() {
  if (mqttClient.connected()) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String clientId = "ESP32-ArecaDryer-" + String(random(0xffff), HEX);
  Serial.print("Connecting to Wi-Fi MQTT Broker (");
  Serial.print(MQTT_BROKER);
  Serial.print(")... ");

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("CONNECTED!");
    mqttClient.subscribe(TOPIC_ACK);
    mqttClient.subscribe(TOPIC_COMMAND);
    Serial.print("Subscribed to command & ACK topic: ");
    Serial.println(TOPIC_ACK);
  } else {
    Serial.print("Failed, rc=");
    Serial.println(mqttClient.state());
  }
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize LED indicator (Start OFF)
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize 12V Motor Driver Pins (Default LOW / Safe Stopped)
  // Channel A: Roof Canopy Actuator
  pinMode(MOTOR1_IN1_PIN, OUTPUT);
  pinMode(MOTOR1_IN2_PIN, OUTPUT);
  digitalWrite(MOTOR1_IN1_PIN, LOW);
  digitalWrite(MOTOR1_IN2_PIN, LOW);

  // Channel B: 12V Auxiliary Heater & Hot-Air Dryer
  pinMode(HEATER_IN3_PIN, OUTPUT);
  pinMode(HEATER_IN4_PIN, OUTPUT);
  digitalWrite(HEATER_IN3_PIN, LOW);
  digitalWrite(HEATER_IN4_PIN, LOW);

  // Setup PWM Channels (Fully compatible with ESP32 Core v2.x and Core v3.x)
  SETUP_MOTOR_PWM();
  SET_MOTOR_PWM(0);

  SETUP_HEATER_PWM();
  SET_HEATER_PWM(0);

  // Initialize DHT22
  dht.begin();

  // Initialize ADC for Rain Plate & LDR Sunlight sensor
  pinMode(RAIN_AO_PIN, INPUT);
  pinMode(RAIN_DO_PIN, INPUT_PULLDOWN); // Internal pulldown firmly identifies disconnected DO pin
  pinMode(LDR_AO_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(RAIN_AO_PIN, ADC_11db);
  analogSetPinAttenuation(LDR_AO_PIN, ADC_11db);

  Serial.println();
  Serial.println("========================================");
  Serial.println("    ARECANUT FARM DRYER WI-FI CONTROLLER");
  Serial.println("========================================");
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // While Wi-Fi is connecting, LED stays OFF
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    isWifiConnected = true;
    // Wi-Fi is now connected! Turn Blue LED SOLID ON
    digitalWrite(LED_PIN, HIGH);
    Serial.println();
    Serial.println(">>> WI-FI CONNECTED SUCCESSFULLY! <<<");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("Blue LED is SOLID ON (Waiting for Web UI Handshake)");

    // Auto-fetch latest calibrated parameters from Web UI (Zero Code Reflash!)
    fetchStartupConfig();
  } else {
    isWifiConnected = false;
    digitalWrite(LED_PIN, LOW);
    Serial.println();
    Serial.println("Wi-Fi connection timed out. Telemetry available via USB Serial.");
  }

  // Configure MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessageReceived);
  mqttClient.setBufferSize(512);

  if (isWifiConnected) {
    ensureMqttConnected();
  }
}

// ==========================================
// LOOP
// ==========================================
void loop() {
  // 0. Auto-stop motor after configured duration expires
  if (isMotor1Running && millis() >= motor1StopMillis) {
    stopAllMotors();
  }

  isWifiConnected = (WiFi.status() == WL_CONNECTED);

  // Maintain Wi-Fi MQTT loop
  if (isWifiConnected) {
    if (!mqttClient.connected()) {
      ensureMqttConnected();
    }
    mqttClient.loop();
  }

  // If connection was lost for > 15 seconds, mark Web UI as disconnected
  if (millis() - lastWebUiSuccess > 15000) {
    isWebUiConnected = false;
  }

  // 1. Read Genuine Sensors with Strict Hardware Connection Checks
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();
  bool dhtConnected = !isnan(temperature) && !isnan(humidity) && temperature > -25.0 && temperature < 85.0 && humidity >= 0.0 && humidity <= 100.0;

  // Rain Plate Hardware Validation:
  // Pin 27 uses internal pulldown. A connected LM393 module's 10k pullup holds Pin 27 HIGH (1) when dry.
  // When real raindrops fall, LM393 comparator pulls Pin 27 LOW (0) AND AO drops < 2800.
  // When disconnected: Pin 27 is pulled down (0) while AO floats/is dry (>2800) -> accurately detected as DISCONNECTED.
  int rainAnalog    = analogRead(RAIN_AO_PIN);
  int rainDigital   = digitalRead(RAIN_DO_PIN);
  bool rainConnected = false;
  bool rainDetected  = false;

  if (rainDigital == HIGH && rainAnalog >= 1200) {
    // Physical module connected and dry
    rainConnected = true;
    rainDetected = false;
  } else if (rainDigital == LOW && rainAnalog < paramRainAnalogThresh && rainAnalog > 30) {
    // Physical module connected and real rain drops actively detected
    rainConnected = true;
    rainDetected = true;
  } else if (rainDigital == HIGH && rainAnalog < 1200 && rainAnalog > 30) {
    // Early rain drop detected on analog track
    rainConnected = true;
    rainDetected = true;
  } else {
    // Module unplugged, wires loose, or floating pin
    // Strictly report NOT CONNECTED (zero random data!)
    rainConnected = false;
    rainDetected = false;
  }

  // CONTINUOUS MULTI-SAMPLE VERIFICATION FILTER (Anti-Glitch / Anti-False-Trigger)
  // Continuous verification prevents false triggers from brief dew drops or transient spikes.
  // Uses dynamically synchronized debounce parameters from Web UI!
  static int consecutiveRainChecks = 0;
  static int consecutiveDryChecks = 0;
  static bool rainVerifiedSustained = false;
  const int REQUIRED_RAIN_CHECKS = paramRainDebounceChecks; // Dynamically tuned from Web UI
  const int REQUIRED_DRY_CHECKS = paramDryDebounceChecks;   // Dynamically tuned from Web UI

  if (!rainConnected) {
    consecutiveRainChecks = 0;
    consecutiveDryChecks = 0;
    rainVerifiedSustained = false;
  } else if (rainDetected) {
    consecutiveRainChecks++;
    consecutiveDryChecks = 0;
    if (consecutiveRainChecks >= REQUIRED_RAIN_CHECKS) {
      rainVerifiedSustained = true;
    }
  } else {
    // Sensor is dry
    consecutiveDryChecks++;
    consecutiveRainChecks = 0;
    if (consecutiveDryChecks >= REQUIRED_DRY_CHECKS) {
      rainVerifiedSustained = false;
    }
  }

  // LDR Sunlight Sensor Multi-sample Jitter & Range Check
  int ldrSum = 0;
  int ldrMin = 4095;
  int ldrMax = 0;
  for (int i = 0; i < 6; i++) {
    int v = analogRead(LDR_AO_PIN);
    ldrSum += v;
    if (v < ldrMin) ldrMin = v;
    if (v > ldrMax) ldrMax = v;
    delayMicroseconds(150);
  }
  int lightValue = ldrSum / 6;
  int ldrJitter = ldrMax - ldrMin;

  // Connected LDR module or divider gives stable analog signal between 35 and 4050
  bool lightConnected = (lightValue >= 35 && lightValue <= 4050 && ldrJitter < 350);
  int wifiRSSI = isWifiConnected ? WiFi.RSSI() : -99;

  // Diagnostic Human-Readable Serial Logging (Accurately names disconnected sensor!)
  Serial.println("----------------------------------------");
  if (dhtConnected) {
    Serial.print("DHT22: CONNECTED | Temp: ");
    Serial.print(temperature, 1);
    Serial.print(" C | Humidity: ");
    Serial.print(humidity, 1);
    Serial.println(" %");
  } else {
    Serial.println("DHT22: NOT CONNECTED (Check Pin D4 wire)");
  }

  if (rainConnected) {
    Serial.print("Rain Plate: OK | AO: ");
    Serial.print(rainAnalog);
    Serial.print(" | DO: ");
    Serial.print(rainDigital);
    Serial.print(" | ");
    if (rainVerifiedSustained) {
      Serial.println("STATUS: CONFIRMED RAIN (Sustained water detected)");
    } else if (rainDetected) {
      Serial.print("STATUS: VERIFYING RAIN (Check ");
      Serial.print(consecutiveRainChecks);
      Serial.print("/");
      Serial.print(REQUIRED_RAIN_CHECKS);
      Serial.println("... Filtering noise)");
    } else {
      Serial.println("STATUS: CONFIRMED DRY (Stable plate)");
    }
  } else {
    Serial.println("Rain Plate: NOT CONNECTED (Check Pin D34 AO & Pin D27 DO wires)");
  }

  if (lightConnected) {
    Serial.print("LDR Light: OK | ADC: ");
    Serial.print(lightValue);
    Serial.print(" | Wi-Fi RSSI: ");
    Serial.print(wifiRSSI);
    Serial.println(" dBm");
  } else {
    Serial.println("LDR Light: NOT CONNECTED (Check Pin D35 AO wire)");
  }

  // 2. Prepare JSON Payload (Sends null for disconnected sensors - ZERO fake data!)
  char q = '"';
  String json = "{";
  json += q; json += "dht_connected"; json += q; json += ":";
  json += (dhtConnected ? "true" : "false");
  json += ",";
  if (dhtConnected) {
    json += q; json += "temperature"; json += q; json += ":";
    json += String(temperature, 2);
    json += ",";
    json += q; json += "humidity"; json += q; json += ":";
    json += String(humidity, 2);
    json += ",";
  } else {
    json += q; json += "temperature"; json += q; json += ":null,";
    json += q; json += "humidity"; json += q; json += ":null,";
  }
  json += q; json += "rain_connected"; json += q; json += ":";
  json += (rainConnected ? "true" : "false");
  json += ",";
  if (rainConnected) {
    json += q; json += "rain_analog"; json += q; json += ":";
    json += String(rainAnalog);
    json += ",";
    json += q; json += "rain_digital"; json += q; json += ":";
    json += String(rainDigital);
    json += ",";
    json += q; json += "rain"; json += q; json += ":";
    json += (rainDetected ? "true" : "false");
    json += ",";
    json += q; json += "rain_verified"; json += q; json += ":";
    json += (rainVerifiedSustained ? "true" : "false");
    json += ",";
    json += q; json += "verification_state"; json += q; json += ":";
    json += q;
    json += (rainVerifiedSustained ? "CONFIRMED_RAIN" : rainDetected ? "VERIFYING_RAIN" : "CONFIRMED_DRY");
    json += q;
    json += ",";
  } else {
    json += q; json += "rain_analog"; json += q; json += ":null,";
    json += q; json += "rain_digital"; json += q; json += ":null,";
    json += q; json += "rain"; json += q; json += ":false,";
    json += q; json += "rain_verified"; json += q; json += ":false,";
    json += q; json += "verification_state"; json += q; json += ":";
    json += q; json += "DISCONNECTED"; json += q;
    json += ",";
  }
  json += q; json += "light_connected"; json += q; json += ":";
  json += (lightConnected ? "true" : "false");
  json += ",";
  if (lightConnected) {
    json += q; json += "light"; json += q; json += ":";
    json += String(lightValue);
    json += ",";
  } else {
    json += q; json += "light"; json += q; json += ":null,";
  }
  json += q; json += "wifi_rssi"; json += q; json += ":";
  json += String(wifiRSSI);
  json += ",";
  json += q; json += "heater_active"; json += q; json += ":";
  json += (isHeaterActive ? "true" : "false");
  json += ",";
  json += q; json += "timestamp"; json += q; json += ":";
  json += String(millis());
  json += "}";

  // Standalone Failsafe: If Wi-Fi is lost or in autonomous mode, manage temperature locally
  if (!isWebUiConnected && dhtConnected) {
    if (temperature < paramHeaterMinTemp && !isHeaterActive) {
      Serial.print("[AUTONOMOUS LOCAL] Temp low (< ");
      Serial.print(paramHeaterMinTemp, 1);
      Serial.print("C). Closing sheet & activating 12V heater at ");
      Serial.print(paramHeaterPwm);
      Serial.println("% PWM");
      runRoofMotor(false, paramRoofCloseSec, paramMotorSpeed);
      set12vHeater(true, paramHeaterPwm);
    } else if (temperature >= paramHeaterMaxTemp && isHeaterActive) {
      Serial.print("[AUTONOMOUS LOCAL] Temp stabilized (>= ");
      Serial.print(paramHeaterMaxTemp, 1);
      Serial.println("C). 12V heater turned OFF");
      set12vHeater(false);
    }
  }

  // Output structured JSON over Serial for diagnostic monitoring
  Serial.print("[TELEMETRY_JSON] ");
  Serial.println(json);

  // 3. Transmit to Web Dashboard over Wi-Fi MQTT (Bypasses HTTP 302 redirects)
  if (isWifiConnected && mqttClient.connected()) {
    bool published = mqttClient.publish(TOPIC_DATA, json.c_str());
    if (published) {
      Serial.println("[WI-FI MQTT] Telemetry packet streamed live to Web UI!");
    } else {
      Serial.println("[WI-FI MQTT] Failed to publish packet.");
    }
  }

  // Fallback: Also attempt HTTP POST
  if (isWifiConnected && (!mqttClient.connected() || !isWebUiConnected)) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(json);
    if (httpCode == 200 || httpCode == 201) {
      String response = http.getString();
      isWebUiConnected = true;
      lastWebUiSuccess = millis();
      // Dynamically apply any updated settings in the response immediately
      if (response.indexOf("settings") >= 0) {
        applySettingsJson(response);
      }
      if (response.indexOf("MOTOR_CLOSE") >= 0 || response.indexOf("CLOSE") >= 0) {
        if (!isMotor1Running) runRoofMotor(false, paramRoofCloseSec, paramMotorSpeed);
      } else if (response.indexOf("MOTOR_OPEN") >= 0 || response.indexOf("OPEN") >= 0) {
        if (!isMotor1Running) runRoofMotor(true, paramRoofOpenSec, paramMotorSpeed);
      }
    }
    http.end();
  }

  // 4. Handle continuous Blue LED blinking, Serial processing & Wi-Fi listener loop
  // Stream data every 2.5 seconds, while keeping Blue LED blinking continuously if Web UI is connected
  unsigned long cycleStart = millis();
  while (millis() - cycleStart < 2500) {
    if (isMotor1Running && millis() >= motor1StopMillis) {
      stopAllMotors();
    }
    if (isWifiConnected) {
      mqttClient.loop();
    }

    // Process any USB WebSerial or Serial Monitor commands immediately
    if (Serial.available() > 0) {
      String serialMsg = Serial.readStringUntil('\\n');
      serialMsg.trim();
      if (serialMsg.length() > 0) {
        if (serialMsg == "WEB_UI_CONNECTED") {
          isWebUiConnected = true;
          lastWebUiSuccess = millis();
        } else {
          executeCommandString(serialMsg);
        }
      }
    }

    // Refresh Wi-Fi state
    isWifiConnected = (WiFi.status() == WL_CONNECTED);

    // ==============================================================
    // BLUE LED STATUS STATE MACHINE:
    // 1. Wi-Fi Disconnected: LED is OFF
    // 2. Wi-Fi Connected, but Web UI not connected: LED is SOLID ON
    // 3. Connected to Web UI: LED BLINKS CONTINUOUSLY!
    // ==============================================================
    if (!isWifiConnected) {
      digitalWrite(LED_PIN, LOW); // OFF
    } else if (!isWebUiConnected) {
      digitalWrite(LED_PIN, HIGH); // SOLID ON: Wi-Fi connected, waiting for Web UI
    } else {
      // Connected to Web UI: Blink continuously (every 250ms)
      if (millis() - lastLedBlinkTime >= 250) {
        lastLedBlinkTime = millis();
        ledBlinkState = !ledBlinkState;
        digitalWrite(LED_PIN, ledBlinkState ? HIGH : LOW);
      }
    }

    delay(20);
  }
}
`;
}
