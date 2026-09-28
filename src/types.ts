export interface LocationItem {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  isArecaHub?: boolean;
}

export type AppLanguage = "en" | "kn";

export interface SensorTelemetry {
  temperature: number | null;
  humidity: number | null;
  dht_connected: boolean;
  rain_analog: number | null;
  rain_digital: number | null;
  rain: boolean;
  rain_connected: boolean;
  rain_verified?: boolean; // Sustained rain verified across continuous debounce window
  verification_state?: 'CONFIRMED_RAIN' | 'CONFIRMED_DRY' | 'VERIFYING_RAIN' | 'VERIFYING_DRY' | 'DISCONNECTED';
  verification_count?: number; // e.g. 1/3, 2/3, 3/3
  isEmergencyStopped?: boolean;
  isSensorFlapping?: boolean;
  light: number | null;
  light_connected: boolean;
  wifi_rssi: number;
  timestamp: number;
  receivedAt: string;
}

export interface SensorStatusResponse {
  isOnline: boolean;
  lastSeenSeconds: number | null;
  packetCount: number;
  latest: SensorTelemetry | null;
  canopyState: CanopyMode;
  lastActuatorAction: string;
  isEmergencyStopped?: boolean;
  isSensorFlapping?: boolean;
  isRainVerified?: boolean;
  verificationState?: 'CONFIRMED_RAIN' | 'CONFIRMED_DRY' | 'VERIFYING_RAIN' | 'VERIFYING_DRY' | 'DISCONNECTED';
  verificationCount?: number;
}

export interface WeatherCurrent {
  time?: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  cloud_cover: number;
  wind_speed_10m: number;
  surface_pressure: number;
  is_day: number; // 1 = day, 0 = night
}

export interface WeatherHourly {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
}

export interface WeatherDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  sunrise: string[];
  sunset: string[];
}

export interface WeatherForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: WeatherCurrent;
  hourly: WeatherHourly;
  daily: WeatherDaily;
}

export type DecisionMode = "COMBO" | "SENSOR_ONLY" | "INTERNET_ONLY";
export type CanopyMode = "OPEN" | "CLOSED" | "AUTO" | "STOPPED";

export type DiagnosticEventType =
  | 'STOP_LOCK'
  | 'START_RESUME'
  | 'MOTOR_OPEN'
  | 'MOTOR_CLOSE'
  | 'MOTOR_STOP'
  | 'BLOCKED_BY_STOP'
  | 'ANTI_CHATTER_HOLD'
  | 'STATUS_HOLD'
  | 'AI_SUGGESTION_READY'
  | 'SENSOR_FLAP_BLOCKED'
  | 'RAIN_TRIGGER'
  | 'WEATHER_TRIGGER'
  | 'FAILSAFE_TRIGGER'
  | 'HEATER_TRIGGER'
  | 'DEBOUNCE_ABSORBED';

export interface DiagnosticAuditLogEntry {
  id: string;
  timestamp: number;
  timeLabel: string;
  eventType: DiagnosticEventType;
  source: string;
  actionTaken: boolean;
  canopyState: CanopyMode;
  physicalRoofPosition: string;
  creatorLog?: string;
  sensorSummary: {
    dhtTemp: number | null;
    dhtHumidity: number | null;
    dhtConnected: boolean;
    rainAnalog: number | null;
    rainDigital: number | null;
    isRainWet: boolean;
    rainConnected: boolean;
    rainVerified: boolean;
    lightAdc: number | null;
    espOnline: boolean;
    isFlapping?: boolean;
  };
  weatherSummary: {
    rainProbability: number;
    precipitationMm: number;
    cloudCover: number;
    radar10kmRainCount: number;
  };
  reason: string;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  timeLabel: string;
  executedAction: "CLOSED" | "OPEN";
  reason: string;
  decisionMode: DecisionMode;
  sensorWet: boolean;
  sensorHumidity: number;
  googleRainRate: number;
  googlePrecipProb: number;
  googleHumidity: number;
  dayNight: "DAY" | "NIGHT";
}

export interface HourlyProjectionItem {
  hour: string;
  rainRisk: number;
  solarIndex: number;
  temperature: number;
  canopyStatus: "OPEN" | "CLOSED";
  summary: string;
}

export interface AIPredictionResult {
  rainProbabilityNextHour: number;
  rainProbabilityNext6Hours: number;
  canopyRecommendation: "CLOSE_IMMEDIATELY" | "KEEP_OPEN_DRYING" | "PREVENTATIVE_CLOSE";
  urgency: "CRITICAL" | "HIGH" | "MODERATE" | "SAFE";
  solarDryingIndex: number;
  aiSummary: string;
  sensorVersusInternetAnalysis: string;
  dryingAdvice: string;
  localAlertBanner: string;
  dayNightStatus: "DAY_ACTIVE" | "NIGHT_STORAGE" | "TWILIGHT";
  hourlyProjections?: HourlyProjectionItem[];
  // Continuous Cross-Verification & Comparison Matrix:
  comparisonVerdict?: "AGREEMENT_DRY" | "AGREEMENT_RAIN" | "RADAR_EARLY_WARNING" | "LOCAL_CONVECTIVE_SHOWER" | "SENSOR_UNVERIFIED";
  verificationConfidence?: number; // 0-100% confidence
  crossVerificationNotes?: string;
  humidityDiscrepancy?: number; // Sensor RH minus Satellite RH
  radarVsSensorStatus?: string;
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface Telemetry5sRecord {
  id: string;
  timestamp: number;
  timeLabel: string;
  temperature: number | null;
  humidity: number | null;
  dhtConnected: boolean;
  rainAnalog: number | null;
  rainDigital: number | null;
  rainDetected: boolean;
  rainVerified: boolean;
  rainConnected: boolean;
  verificationState: string;
  light: number | null;
  lightPercent: number | null;
  lightConnected: boolean;
  wifiRssi: number | null;
  canopyState: CanopyMode;
  lastAction: string;
  weatherPrecip: number;
  weatherTemp: number | null;
  weatherHumidity: number | null;
  weatherCloudCover?: number | null;
}

export interface HeaterDryerState {
  status: 'OFF' | 'HEATING' | 'COOLING_REST' | 'STANDBY_STABLE';
  mode: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF';
  activeSeconds: number;
  lastTriggerReason: string;
  dutyCycleCount: number;
  targetMinTemp: number;
  targetMaxTemp: number;
  sheetAutoClosed: boolean;
  isOverheatSafety: boolean;
  heaterPwmPower: number;
}

export interface FarmSettings {
  // 1. 12V Heater & Hot-Air Dryer (Motor Driver Channel B)
  heaterAutoEnabled: boolean;        // Turn on 12V heater automatically when temp drops
  heaterMinTempThreshold: number;    // Turn ON heater when temp < this (e.g., 26.0°C)
  heaterMaxTempTarget: number;       // Turn OFF heater when temp >= this (e.g., 38.0°C)
  heaterAutoCloseSheet: boolean;     // Automatically close roof sheet to trap heat when heater fires
  heaterMaxContinuousMinutes: number;// Max continuous run minutes before rest (safety cutoff)
  heaterCooldownMinutes: number;     // Rest cooling period in minutes
  heaterPwmPower: number;            // 12V driver PWM duty percentage (40% - 100%)
  heaterPinIn3: number;              // Driver IN3 Pin (default 33)
  heaterPinIn4: number;              // Driver IN4 Pin (default 32)
  heaterPinEnb: number;              // Driver ENB Pin (default 12)

  // 2. Rain Sensor Parameters (Plate & Debounce Filters)
  rainAnalogThreshold: number;       // ADC wet threshold (e.g. 2800)
  rainDigitalInvert: boolean;        // Invert DO digital logic polarity
  rainDebounceChecks: number;        // Required consecutive rain checks before confirming rain
  dryDebounceChecks: number;         // Required consecutive dry checks before confirming dry

  // 3. Sunlight / LDR Sensor Parameters
  sunlightDayLuxAdc: number;         // Day vs Twilight ADC threshold (e.g. 2600)
  nightDetectionThreshold: number;   // Night dew protection ADC threshold (e.g. 3400)
  sunlightMinAdc: number;            // 100% Bright sun ADC calibration (e.g. 150)
  sunlightMaxAdc: number;            // 0% Pitch darkness ADC calibration (e.g. 4095)
  sunlightCloseThresholdPercent?: number; // Close when sunlight <= this % (default 60%)
  decisionMode?: DecisionMode;       // System decision mode (COMBO | SENSOR_ONLY | INTERNET_ONLY)

  // 4. Online / Google Weather Radar Parameters
  onlineRainProbabilityThreshold: number; // % rain probability to trigger early canopy warning/close
  onlinePrecipRateThreshold: number;      // mm/h rain rate to trigger rain warning
  onlineCloudCoverThreshold: number;      // % cloud cover threshold for overcast vs sunny
  onlineSyncIntervalMinutes: number;      // Satellite forecast refresh rate in minutes
  closeRainThreshold?: number;            // Rain risk % to close canopy (default 60%)
  openRainThreshold?: number;             // Rain risk % below which safe to open (default 30%)
  weatherStaleMinutes?: number;           // Minutes before weather API is considered stale (default 15)
  sensorStaleSeconds?: number;            // Seconds before sensor data is considered stale (default 20)

  // 5. Motor Actuation & Sheet Physical Parameters
  controlMode: 'DURATION' | 'ROTATION';
  roofOpenSeconds: number;
  roofCloseSeconds: number;
  frontRotations: number;
  backRotations: number;
  secondsPerRotation: number;
  motor2RotationSeconds: number;
  motor2Rotations: number;
  motor2Enabled: boolean;
  motor2Mode: 'SYNCHRONIZED' | 'INDEPENDENT' | 'OPPOSITE';
  motorSpeedPercent: number;
  autoStopSafetyLimit: number;
  reverseDirection: boolean;
  aiMode?: 'SUGGESTION' | 'AUTONOMOUS';
}

export interface RadarLocationPoint {
  direction: string;      // "Center", "N", "NE", "E", "SE", "S", "SW", "W", "NW"
  label: string;          // e.g. "Surathkal (14.2 km NW)"
  placeName: string;      // Real town/place name, e.g. "Surathkal"
  region: string;         // e.g. "Dakshina Kannada"
  distanceKm: number;     // Real distance from farm in km, e.g. 14.2
  bearingDeg: number;     // Compass bearing degrees
  latitude: number;
  longitude: number;
  temperature: number;
  precipitation: number;  // mm/h
  rainProbability: number;// Calibrated realistic agricultural rain risk %
  rawProbability?: number;// Raw model POP %
  cloudCover: number;     // %
  weatherCode: number;
  isRaining: boolean;
  condition: string;      // Human-readable condition description
  isCenter?: boolean;
}

export interface Radar30kmScanResult {
  timestamp: number;
  centerLatitude: number;
  centerLongitude: number;
  radarRadiusKm: number;          // Radar coverage radius (e.g. 100km for regional reference)
  criticalRadiusKm?: number;      // Critical canopy-close perimeter (10km)
  points: RadarLocationPoint[];
  aggregateRainProbability: number;
  maxPrecipitationMm: number;
  rainCellsDetected: number;
  totalScanPoints: number;
  nearestRainDistanceKm: number | null;
  nearestRainDirection: string | null;
  nearestRainPlaceName?: string | null;
  rainIn10kmCount?: number;
  is10kmPerimeterClear?: boolean;
  stormMovingTowardsFarm: boolean;
  estimatedArrivalMinutes: number | null;
  conflictState: 'CONSENSUS_DRY' | 'CONSENSUS_RAIN' | 'RADAR_CONFLICT_APPROACHING' | 'LOCAL_ISOLATED_SHOWER';
  aiDecision: 'OPEN_CANOPY' | 'CLOSE_CANOPY' | 'ALERT_OPERATOR' | 'HEAT_DRY';
  aiRecommendationText: string;
  spatialMetrics?: Spatial30LocationMetrics;
}


export interface TelegramBotUser {
  id: number;
  username?: string;
  firstName?: string;
  registeredAt: number;
  lastSeenAt?: number;
}

export interface TelegramBotStatus {
  botUsername: string;
  isLive: boolean;
  registeredUsersCount: number;
  registeredUsers: TelegramBotUser[];
  lastConflictAlertSentAt: number | null;
  lastCommandReceived: string | null;
  lastCommandTimestamp: number | null;
}

export type MotorSettings = FarmSettings;

export interface MotorPingStatus {
  isOnline: boolean;
  latencyMs: number;
  openChannelStatus: 'READY' | 'ROTATING' | 'DISCONNECTED';
  closeChannelStatus: 'READY' | 'ROTATING' | 'DISCONNECTED';
  motor2ChannelStatus: 'READY' | 'ROTATING' | 'DISABLED';
  heaterStatus?: 'OFF' | 'HEATING' | 'COOLING_REST' | 'STANDBY_STABLE';
  activeRotation: 'IDLE' | 'OPENING' | 'CLOSING' | 'MOTOR2_RUNNING';
  activeRemainingSeconds?: number;
  activeRotationsLeft?: number;
  lastPingTimestamp: number | null;
  pingCount: number;
  driverType: '12V_L298N_HBRIDGE' | '12V_BTS7960' | 'DUAL_RELAY';
  pins: {
    in1Pin: number;         // D26 (Driver IN1 - Roof Open / Forward)
    in2Pin: number;         // D25 (Driver IN2 - Roof Close / Reverse)
    in3Pin: number;         // D33 (Driver IN3 - 12V Heater / Dryer Element)
    in4Pin: number;         // D32 (Driver IN4 - 12V Heater Ground / Reverse)
    pwmSpeedPin?: number;   // D14 (Driver ENA / PWM Speed)
    pwmHeaterPin?: number;  // D12 (Driver ENB / PWM Heater)
    openRelayPin?: number;  // Alias for backward compat
    closeRelayPin?: number; // Alias for backward compat
    motor2Pin?: number;     // Alias for backward compat
  };
}

export type RoofActionType = 'OPEN' | 'CLOSED' | 'STOP' | 'MOMENTARY_OPEN' | 'MOMENTARY_CLOSE';

export interface RoofEvent {
  id: string;
  action: RoofActionType;
  duration: number;
  timestamp: number;
  timeLabel: string;
  source: 'WEB_UI' | 'AUTO_WEATHER' | 'AI_GUARDIAN' | 'TEST_INCHING' | 'EMERGENCY_STOP';
  details?: string;
}

export interface RoofPersistentState {
  physicalRoofPosition: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'STOPPED';
  canopyState: CanopyMode;
  lastCompletedAction: 'OPEN' | 'CLOSED' | 'NONE';
  activeMotorRotation: 'IDLE' | 'OPENING' | 'CLOSING' | 'MOTOR2_RUNNING';
  activeRemainingSeconds: number;
  totalDurationSeconds: number;
  lastActionTimestamp: number;
  roofOpenSeconds: number;
  roofCloseSeconds: number;
  isEmergencyStopped?: boolean;
  isSensorFlapping?: boolean;
  recentEvents: RoofEvent[];
}

// -------------------------------------------------------------
// COMPREHENSIVE WEATHER PREDICTION & SENSOR FUSION SYSTEM TYPES
// -------------------------------------------------------------

export type SensorHealthStatus = 'VALID' | 'OUT_OF_RANGE' | 'DISCONNECTED' | 'STALE' | 'MISSING';

export interface SensorValidationSummary {
  dhtTempStatus: SensorHealthStatus;
  dhtHumidityStatus: SensorHealthStatus;
  rainSensorStatus: SensorHealthStatus;
  lightSensorStatus: SensorHealthStatus;
  esp32ConnectionStatus: 'ONLINE' | 'OFFLINE' | 'STALE';
  lastSeenSeconds: number | null;
  allCriticalSensorsValid: boolean;
  validationWarnings: string[];
}

export type RainRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type PredictionDataStatus = 'VALID' | 'DEGRADED' | 'FALLBACK' | 'STALE';
export type SpatialConsistencyState = 'CLEAR_DRY_CONSENSUS' | 'STRONG_AGREEMENT_RAIN' | 'ISOLATED_DISTANT_WARNING' | 'MODERATE_DISPERSED' | 'NO_SPATIAL_DATA';

export interface Spatial30LocationMetrics {
  currentLocationRisk: number;              // Risk % at current farm
  nearbyLocationsCount: number;             // Total scanned nearby locations
  nearbyAverageRisk: number;                // Simple average risk across nearby places
  distanceWeightedNearbyRisk: number;       // Distance-decay weighted average risk %
  highRiskLocationsCount: number;           // Count of nearby locations showing rain risk >= 50% or active precip
  highRiskPercentage: number;               // % of nearby locations showing high rain risk
  maxNearbyRisk: number;                    // Peak risk among all nearby locations
  nearestRainDistanceKm: number | null;     // Distance to nearest active rain cell
  nearestRainPlaceName: string | null;      // Name of nearest raining town
  spatialConsistency: SpatialConsistencyState;
  isIsolatedSpike: boolean;                 // True if only 1 distant location shows rain while farm & rest are dry
  critical10kmPointsCount?: number;         // Points within 10km critical closing boundary
  rainIn10kmCount?: number;                 // Rain cells detected within 10km
  is10kmPerimeterClear?: boolean;           // True if 10km perimeter is free of rain
}

export interface UnifiedRainPrediction {
  rain_probability: number;                 // 0 to 100%
  rain_risk: RainRiskLevel;                 // LOW (<30), MEDIUM (30-59), HIGH (>=60)
  actual_rain: boolean;                     // Ground water plate wet status
  prediction_horizon: string;               // e.g. "Next 60 minutes"
  prediction_reason: string;                // Detailed explanation of decision
  prediction_confidence: number;            // 0 to 100% confidence
  data_status: PredictionDataStatus;        // VALID, DEGRADED, FALLBACK, STALE
  derived_features: {
    tempTrend5m: number;                   // °C change in 5 min
    humidityTrend5m: number;               // % RH change in 5 min
    lightTrend5m: number;                  // Lux / ADC change in 5 min
    rainAnalogTrend5m: number;
    hourlyPrecipTrend: number;
    isNightOrTwilight: boolean;
    rawLightAdc?: number | null;
    isLocalPlateBoneDry?: boolean;
    sunriseTime?: string | null;
    sunsetTime?: string | null;
    isAfterSunset?: boolean;
    isBeforeSunrise?: boolean;
    isSolarDaylight?: boolean;
    solarDataAvailable?: boolean;
  };
}

export type SystemOperatingMode = 
  | 'NORMAL' 
  | 'LOCAL_FALLBACK' 
  | 'SAFE_CLOSED' 
  | 'SENSOR_FAULT' 
  | 'WEATHER_API_FAULT' 
  | 'MOTOR_FAULT';

export interface SingleSourceSystemState {
  timestamp: number;
  system_mode: SystemOperatingMode;
  system_mode_reason: string;
  sensor_status: SensorValidationSummary;
  latest_sensor: SensorTelemetry | null;
  weather_status: {
    apiOnline: boolean;
    isStale: boolean;
    lastFetchedAt: number;
    currentTemp: number;
    currentHumidity: number;
    currentPrecipitation: number;
    currentCloudCover: number;
    weatherCode: number;
    weatherCondition: string;
    sunrise?: string | null;
    sunset?: string | null;
    sunriseIso?: string | null;
    sunsetIso?: string | null;
    isDaylight?: boolean;
    isSunsetted?: boolean;
    minutesUntilSunset?: number | null;
  };
  nearby_weather: Spatial30LocationMetrics;
  prediction: UnifiedRainPrediction;
  tarpaulin: {
    state: CanopyMode;                     // AUTO, OPEN, CLOSED
    physicalPosition: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'STOPPED';
    isSafeDryingPermitted: boolean;
    lastDecision: 'OPEN' | 'CLOSED';
    lastDecisionReason: string;
    lastActionTimestamp: number;
    hysteresis: {
      closeThreshold: number;              // default 60%
      openThreshold: number;               // default 30%
    };
  };
  motor: {
    activeRotation: 'IDLE' | 'OPENING' | 'CLOSING' | 'MOTOR2_RUNNING';
    activeRemainingSeconds: number;
    hasFault: boolean;
    faultMessage?: string;
  };
  connectivity: {
    esp32MqttOnline: boolean;
    internetWeatherOnline: boolean;
    telegramBotOnline: boolean;
  };
  heater: HeaterDryerState;
  last_event: {
    type: string;
    description: string;
    timestamp: number;
  };
}




