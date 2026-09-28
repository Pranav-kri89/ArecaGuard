import fs from "fs";
import path from "path";
import {
  SensorTelemetry,
  SensorValidationSummary,
  SensorHealthStatus,
  Spatial30LocationMetrics,
  UnifiedRainPrediction,
  RainRiskLevel,
  PredictionDataStatus,
  SystemOperatingMode,
  SingleSourceSystemState,
  FarmSettings,
  CanopyMode,
  HeaterDryerState,
  DecisionMode,
} from "../src/types";

// Rolling window for sensor telemetry to calculate 5-minute and 15-minute trends
interface TelemetryPoint {
  timestamp: number;
  temp: number | null;
  humidity: number | null;
  light: number | null;
  rainAnalog: number | null;
  rainProb: number;
}

export interface SolarEphemerisResult {
  sunriseTime: string | null;      // Formatted "6:19 AM"
  sunsetTime: string | null;       // Formatted "6:26 PM"
  sunriseIso: string | null;       // "2026-09-22T06:19"
  sunsetIso: string | null;        // "2026-09-22T18:26"
  currentLocalTimeIso: string | null;
  isSunsetted: boolean;           // true if currentLocalTime >= sunset
  isBeforeSunrise: boolean;       // true if currentLocalTime < sunrise
  isSolarDaylight: boolean;       // true if between sunrise and sunset
  minutesUntilSunset: number | null;
  minutesSinceSunrise: number | null;
  dataAvailable: boolean;         // valid forecast sunrise/sunset strings found
}

function formatToAmPm(isoOrTimeStr: string | null | undefined): string | null {
  if (!isoOrTimeStr) return null;
  try {
    const timePart = isoOrTimeStr.includes('T') ? isoOrTimeStr.split('T')[1] : isoOrTimeStr;
    const [hStr, mStr] = timePart.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return null;
  }
}

export function calculateSolarEphemeris(weatherData: any, nowTimestamp: number = Date.now()): SolarEphemerisResult {
  const sunriseRaw = weatherData?.daily?.sunrise?.[0];
  const sunsetRaw = weatherData?.daily?.sunset?.[0];

  if (!sunriseRaw || !sunsetRaw || typeof sunriseRaw !== 'string' || typeof sunsetRaw !== 'string') {
    return {
      sunriseTime: null,
      sunsetTime: null,
      sunriseIso: null,
      sunsetIso: null,
      currentLocalTimeIso: null,
      isSunsetted: false,
      isBeforeSunrise: false,
      isSolarDaylight: false,
      minutesUntilSunset: null,
      minutesSinceSunrise: null,
      dataAvailable: false,
    };
  }

  // Calculate local time at farm using utc_offset_seconds (defaults to 19800 = IST +5:30 for Karnataka/India)
  const offsetSeconds = typeof weatherData?.utc_offset_seconds === 'number' ? weatherData.utc_offset_seconds : 19800;
  const farmLocalDate = new Date(nowTimestamp + (offsetSeconds * 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const currentLocalIso = `${farmLocalDate.getUTCFullYear()}-${pad(farmLocalDate.getUTCMonth() + 1)}-${pad(farmLocalDate.getUTCDate())}T${pad(farmLocalDate.getUTCHours())}:${pad(farmLocalDate.getUTCMinutes())}`;

  // Time comparison using ISO format string (YYYY-MM-DDTHH:MM)
  const isSunsetted = currentLocalIso >= sunsetRaw;
  const isBeforeSunrise = currentLocalIso < sunriseRaw;
  const isSolarDaylight = !isSunsetted && !isBeforeSunrise && (weatherData?.current?.is_day !== 0);

  let minutesUntilSunset: number | null = null;
  let minutesSinceSunrise: number | null = null;
  try {
    const [curH, curM] = currentLocalIso.split('T')[1].split(':').map(Number);
    const [setH, setM] = sunsetRaw.includes('T') ? sunsetRaw.split('T')[1].split(':').map(Number) : [18, 25];
    const [riseH, riseM] = sunriseRaw.includes('T') ? sunriseRaw.split('T')[1].split(':').map(Number) : [6, 15];

    const curTotalM = curH * 60 + curM;
    const setTotalM = setH * 60 + setM;
    const riseTotalM = riseH * 60 + riseM;

    minutesUntilSunset = setTotalM - curTotalM;
    minutesSinceSunrise = curTotalM - riseTotalM;
  } catch {}

  return {
    sunriseTime: formatToAmPm(sunriseRaw),
    sunsetTime: formatToAmPm(sunsetRaw),
    sunriseIso: sunriseRaw,
    sunsetIso: sunsetRaw,
    currentLocalTimeIso: currentLocalIso,
    isSunsetted,
    isBeforeSunrise,
    isSolarDaylight,
    minutesUntilSunset,
    minutesSinceSunrise,
    dataAvailable: true,
  };
}

const rollingBuffer: TelemetryPoint[] = [];
const DATASET_DIR = path.join(process.cwd(), "data");
const DATASET_FILE = path.join(DATASET_DIR, "ml_dataset.json");

// Ensure dataset directory exists
try {
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("[PredictionEngine] Could not initialize data directory:", e);
}

/**
 * 1. LOCAL SENSOR VALIDATION
 * Validates every sensor reading before allowing decision logic to consume it.
 * Strictly enforces: Missing or failed sensor data is NEVER interpreted as dry/safe!
 */
export function validateSensorTelemetry(
  sensor: SensorTelemetry | null,
  lastPacketTime: number,
  farmSettings: FarmSettings
): SensorValidationSummary {
  const now = Date.now();
  const staleTimeoutMs = (farmSettings.sensorStaleSeconds || 20) * 1000;
  const warnings: string[] = [];

  // Check connection status
  let esp32ConnectionStatus: 'ONLINE' | 'OFFLINE' | 'STALE' = 'OFFLINE';
  let lastSeenSeconds: number | null = null;

  if (lastPacketTime > 0) {
    const elapsed = now - lastPacketTime;
    lastSeenSeconds = Math.max(0, Math.round(elapsed / 1000));
    if (elapsed <= staleTimeoutMs) {
      esp32ConnectionStatus = 'ONLINE';
    } else {
      esp32ConnectionStatus = 'STALE';
      warnings.push(`Sensor telemetry stale (${lastSeenSeconds}s since last packet)`);
    }
  } else {
    warnings.push("No telemetry received from ESP32 drying bed controller");
  }

  if (!sensor) {
    return {
      dhtTempStatus: 'MISSING',
      dhtHumidityStatus: 'MISSING',
      rainSensorStatus: 'MISSING',
      lightSensorStatus: 'MISSING',
      esp32ConnectionStatus,
      lastSeenSeconds,
      allCriticalSensorsValid: false,
      validationWarnings: ["Hardware sensors offline or disconnected"],
    };
  }

  // 1. DHT22 Temperature Validation (-5°C to 65°C realistic drying range)
  let dhtTempStatus: SensorHealthStatus = 'VALID';
  if (!sensor.dht_connected || sensor.temperature === null || isNaN(sensor.temperature)) {
    dhtTempStatus = sensor.dht_connected ? 'MISSING' : 'DISCONNECTED';
    warnings.push("DHT22 temperature sensor disconnected or unreadable");
  } else if (sensor.temperature < -5 || sensor.temperature > 70) {
    dhtTempStatus = 'OUT_OF_RANGE';
    warnings.push(`DHT22 temp out of physical bounds (${sensor.temperature}°C)`);
  }

  // 2. DHT22 Humidity Validation (5% to 100%)
  let dhtHumidityStatus: SensorHealthStatus = 'VALID';
  if (!sensor.dht_connected || sensor.humidity === null || isNaN(sensor.humidity)) {
    dhtHumidityStatus = sensor.dht_connected ? 'MISSING' : 'DISCONNECTED';
    warnings.push("DHT22 humidity sensor disconnected or unreadable");
  } else if (sensor.humidity < 5 || sensor.humidity > 100) {
    dhtHumidityStatus = 'OUT_OF_RANGE';
    warnings.push(`DHT22 humidity out of bounds (${sensor.humidity}%)`);
  }

  // 3. Rain Sensor Plate Validation (Analog 0-4095, Digital 0 or 1)
  let rainSensorStatus: SensorHealthStatus = 'VALID';
  if (!sensor.rain_connected) {
    rainSensorStatus = 'DISCONNECTED';
    warnings.push("Rain detector plate disconnected from ESP32");
  } else if (sensor.rain_analog !== null && (sensor.rain_analog < 0 || sensor.rain_analog > 4095)) {
    rainSensorStatus = 'OUT_OF_RANGE';
    warnings.push(`Rain plate analog ADC out of range (${sensor.rain_analog})`);
  }

  // 4. LDR Light Sensor Validation (0-4095)
  let lightSensorStatus: SensorHealthStatus = 'VALID';
  if (!sensor.light_connected || sensor.light === null) {
    lightSensorStatus = 'DISCONNECTED';
    warnings.push("LDR sunlight sensor disconnected");
  } else if (sensor.light < 0 || sensor.light > 4095) {
    lightSensorStatus = 'OUT_OF_RANGE';
    warnings.push(`LDR light ADC out of range (${sensor.light})`);
  }

  // Critical sensors for tarpaulin safety: Rain plate & ESP32 connection
  const allCriticalSensorsValid =
    esp32ConnectionStatus === 'ONLINE' &&
    rainSensorStatus === 'VALID' &&
    dhtTempStatus !== 'OUT_OF_RANGE' &&
    dhtHumidityStatus !== 'OUT_OF_RANGE';

  return {
    dhtTempStatus,
    dhtHumidityStatus,
    rainSensorStatus,
    lightSensorStatus,
    esp32ConnectionStatus,
    lastSeenSeconds,
    allCriticalSensorsValid,
    validationWarnings: warnings,
  };
}

/**
 * 2. TREND & ROLLING BUFFER CALCULATIONS
 * Tracks continuous changes in local climate (humidity spikes, temperature drops, light fading)
 */
export function recordTelemetrySnapshot(
  sensor: SensorTelemetry | null,
  rainProb: number = 0
) {

  const now = Date.now();
  rollingBuffer.push({
    timestamp: now,
    temp: sensor?.dht_connected && sensor.temperature !== null ? sensor.temperature : null,
    humidity: sensor?.dht_connected && sensor.humidity !== null ? sensor.humidity : null,
    light: sensor?.light_connected && sensor.light !== null ? sensor.light : null,
    rainAnalog: sensor?.rain_connected && sensor.rain_analog !== null ? sensor.rain_analog : null,
    rainProb,
  });

  // Keep last 30 minutes of 5-second snapshots (~360 records)
  while (rollingBuffer.length > 360) {
    rollingBuffer.shift();
  }
}

export function compute5mTrends(): {
  tempTrend5m: number;
  humidityTrend5m: number;
  lightTrend5m: number;
  rainAnalogTrend5m: number;
  rainProbTrend5m: number;
} {
  if (rollingBuffer.length < 2) {
    return { tempTrend5m: 0, humidityTrend5m: 0, lightTrend5m: 0, rainAnalogTrend5m: 0, rainProbTrend5m: 0 };
  }

  const current = rollingBuffer[rollingBuffer.length - 1];
  const fiveMinAgoTime = current.timestamp - 300000; // 5 min ago

  // Find closest record ~5 min ago
  let past = rollingBuffer[0];
  for (let i = rollingBuffer.length - 1; i >= 0; i--) {
    if (rollingBuffer[i].timestamp <= fiveMinAgoTime) {
      past = rollingBuffer[i];
      break;
    }
  }

  const tempTrend5m = current.temp !== null && past.temp !== null ? Number((current.temp - past.temp).toFixed(2)) : 0;
  const humidityTrend5m = current.humidity !== null && past.humidity !== null ? Number((current.humidity - past.humidity).toFixed(2)) : 0;
  const lightTrend5m = current.light !== null && past.light !== null ? Number((current.light - past.light).toFixed(0)) : 0;
  const rainAnalogTrend5m = current.rainAnalog !== null && past.rainAnalog !== null ? Number((current.rainAnalog - past.rainAnalog).toFixed(0)) : 0;
  const rainProbTrend5m = Number((current.rainProb - past.rainProb).toFixed(1));

  return { tempTrend5m, humidityTrend5m, lightTrend5m, rainAnalogTrend5m, rainProbTrend5m };
}

/**
 * 3. RAIN PREDICTION ENGINE (SENSOR + WEATHER + 30 NEARBY LOCATIONS FUSION)
 */
export function calculateUnifiedRainPrediction(
  sensor: SensorTelemetry | null,
  validation: SensorValidationSummary,
  weatherData: any,
  spatial30: Spatial30LocationMetrics,
  farmSettings: FarmSettings
): UnifiedRainPrediction {
  const trends = compute5mTrends();
  const now = Date.now();

  // 1. Direct hardware rain plate check (HIGHEST PRIORITY EVIDENCE)
  // Configurable thresholds applied, including momentary verification
  const isPlateWet = Boolean(
    sensor &&
      sensor.rain_connected &&
      (sensor.rain ||
        sensor.rain_digital === 0 ||
        (sensor.rain_analog !== null && sensor.rain_analog < (farmSettings.rainAnalogThreshold || 2800)) ||
        sensor.verification_state === 'CONFIRMED_RAIN' ||
        sensor.verification_state === 'VERIFYING_RAIN')
  );

  // In INTERNET_ONLY mode, physical sensor data is completely bypassed
  const isForecastOnlyMode = farmSettings.decisionMode === 'INTERNET_ONLY';
  const isSensorOnlyMode = farmSettings.decisionMode === 'SENSOR_ONLY';
  const actual_rain = isForecastOnlyMode ? false : isPlateWet;
  const isLocalPlateBoneDry = Boolean(
    sensor &&
      sensor.rain_connected &&
      !sensor.rain &&
      (sensor.rain_analog === null || sensor.rain_analog >= 3000) &&
      (sensor.rain_digital === null || sensor.rain_digital === 1)
  );

  // Day/night status calculated:
  // In SENSOR_ONLY mode: night is strictly determined by physical LDR darkness (never by internet weather ephemeris)
  // In INTERNET_ONLY mode: solar ephemeris / forecast
  // In COMBO mode: solar ephemeris with LDR failover
  const solar = calculateSolarEphemeris(weatherData, now);
  const isDay = solar.dataAvailable 
    ? solar.isSolarDaylight 
    : (weatherData?.current?.is_day !== undefined ? weatherData.current.is_day === 1 : true);
  const rawLight = sensor?.light !== null && sensor?.light !== undefined ? parseInt(String(sensor.light), 10) : null;
  const isNightByLdr = rawLight !== null && rawLight > (farmSettings.nightDetectionThreshold || 3400);
  const isNightOrTwilight = isSensorOnlyMode
    ? isNightByLdr
    : (!isDay || (!isForecastOnlyMode && isNightByLdr));

  // If rain is physically hitting the plate right now -> 100% rain risk immediately (COMBO and SENSOR_ONLY modes)
  if (actual_rain && !isForecastOnlyMode) {
    return {
      rain_probability: 100,
      rain_risk: 'HIGH',
      actual_rain: true,
      prediction_horizon: "Immediate (Active)",
      prediction_reason: "Rain detected directly on drying bed sensor plate — overrides all forecasts (Priority #1)",
      prediction_confidence: 99,
      data_status: validation.allCriticalSensorsValid ? 'VALID' : 'DEGRADED',
      derived_features: {
        tempTrend5m: trends.tempTrend5m,
        humidityTrend5m: trends.humidityTrend5m,
        lightTrend5m: trends.lightTrend5m,
        rainAnalogTrend5m: trends.rainAnalogTrend5m,
        hourlyPrecipTrend: weatherData?.current?.precipitation ?? 0,
        isNightOrTwilight,
        rawLightAdc: rawLight,
        isLocalPlateBoneDry,
        sunriseTime: solar.sunriseTime,
        sunsetTime: solar.sunsetTime,
        isAfterSunset: solar.isSunsetted,
        isBeforeSunrise: solar.isBeforeSunrise,
        isSolarDaylight: solar.isSolarDaylight,
        solarDataAvailable: solar.dataAvailable,
      },
    };
  }

  // 2. Multi-feature fusion when sensor plate is currently dry
  let rainProb = 0;
  let reason = "";
  let confidence = 85;
  let dataStatus: PredictionDataStatus = 'VALID';

  // Weather API staleness check
  const weatherStaleMs = (farmSettings.weatherStaleMinutes || 15) * 60 * 1000;
  const weatherAgeMs = weatherData?.timestamp ? (now - weatherData.timestamp) : 0;
  const isWeatherStale = weatherAgeMs > weatherStaleMs || !weatherData?.current;

  if (isWeatherStale) {
    dataStatus = 'FALLBACK';
    confidence = 65;
  }

  // Baseline 1: Current location satellite & radar model
  const currentPrecip = weatherData?.current?.precipitation ?? 0;
  const currentPop = weatherData?.hourly?.precipitation_probability?.[0] ?? (currentPrecip > 0 ? 70 : 15);
  const cloudCover = weatherData?.current?.cloud_cover ?? 30;

  // Baseline 2: 100km Regional Locations Evidence & 10km Critical Perimeter
  const nearbyWeightedRisk = spatial30.distanceWeightedNearbyRisk;
  const isIsolatedSpike = spatial30.isIsolatedSpike;
  const spatialConsistency = spatial30.spatialConsistency;
  const is10kmClear = spatial30.is10kmPerimeterClear ?? (spatial30.nearestRainDistanceKm === null || spatial30.nearestRainDistanceKm > 10.0);

  // Fusion weighting:
  // - Current location weight: ~50%
  // - Distance-weighted regional locations: ~35%
  // - Local microclimate atmospheric trend: ~15%
  let fusedProb = (currentPop * 0.5) + (nearbyWeightedRisk * 0.35);

  const onlineProbThresh = farmSettings.onlineRainProbabilityThreshold || 30;
  const onlinePrecipThresh = farmSettings.onlinePrecipRateThreshold || 0.4;
  // Local active precipitation on ground or rain within 10km with high model probability
  const isOnlineRainAlert = (currentPrecip >= onlinePrecipThresh) || (!is10kmClear && currentPop >= onlineProbThresh);

  // Direct active rain on ground or 10km rain threat takes precedence
  if (isOnlineRainAlert) {
    fusedProb = Math.max(fusedProb, currentPop);
  }

  // Apply spatial consistency logic:
  // Mandate: "in 10km range no rain places are there then ok... show up to 100km for ref... instead of 30km, 10 is perfect... for previous logic..."
  if (spatialConsistency === 'STRONG_AGREEMENT_RAIN' && !is10kmClear) {
    fusedProb = Math.max(fusedProb, 65);
    reason = `Rain detected within 10km critical zone (${spatial30.nearestRainPlaceName || 'local area'} ~${spatial30.nearestRainDistanceKm}km); sealing canopy`;
  } else if (is10kmClear && (currentPrecip < 0.4 || isLocalPlateBoneDry)) {
    // 10km perimeter is clear and local plate is bone-dry! Safe for sun drying!
    fusedProb = Math.min(fusedProb, 20);
    if (spatial30.nearestRainPlaceName && spatial30.nearestRainDistanceKm !== null) {
      reason = `10km perimeter is clear of rain. Distant rain at ${spatial30.nearestRainPlaceName} (~${spatial30.nearestRainDistanceKm}km) monitored for reference; drying safe`;
    } else {
      reason = `10km perimeter and 100km regional radar are clear (regional avg risk ${spatial30.nearbyAverageRisk}%); optimal drying`;
    }
  } else if (isIsolatedSpike) {
    fusedProb = Math.min(fusedProb, 25);
    reason = `Isolated rain at distant location (${spatial30.nearestRainPlaceName || 'perimeter'}); local farm area remains dry`;
  } else if (spatialConsistency === 'CLEAR_DRY_CONSENSUS') {
    fusedProb = Math.min(fusedProb, 18);
    reason = `100km regional radar and current farm are clear (regional avg risk ${spatial30.nearbyAverageRisk}%)`;
  } else {
    reason = `10km perimeter clear. Extended 100km regional risk is ${nearbyWeightedRisk}% with ${spatial30.currentLocationRisk}% local radar risk`;
  }

  // Convective storm front trend modifier from local sensors (Only active in COMBO / SENSOR modes)
  if (!isForecastOnlyMode) {
    // Signature of sudden coastal rain: humidity jumps > 4% and temp drops > 1°C in 5 min
    if (trends.humidityTrend5m > 4 && trends.tempTrend5m < -1.0) {
      fusedProb += 15;
      reason += ` (Local convective signature: humidity rising +${trends.humidityTrend5m}%, temp dropping ${trends.tempTrend5m}°C)`;
    }

    // Pre-thunderstorm sudden darkness (light ADC increasing = darker)
    if (trends.lightTrend5m > 300 && isDay) {
      fusedProb += 10;
      reason += " (Sudden cloud darkening detected by LDR)";
    }
  }

  rainProb = Math.min(100, Math.max(2, Math.round(fusedProb)));

  // Risk categorization
  const closeThresh = farmSettings.closeRainThreshold || 60;
  const openThresh = farmSettings.openRainThreshold || 30;

  let rainRisk: RainRiskLevel = 'LOW';
  if (rainProb >= closeThresh) {
    rainRisk = 'HIGH';
  } else if (rainProb >= openThresh) {
    rainRisk = 'MEDIUM';
  } else {
    rainRisk = 'LOW';
  }

  // If local sensors are degraded/missing, mark status
  if (!validation.allCriticalSensorsValid) {
    dataStatus = dataStatus === 'FALLBACK' ? 'FALLBACK' : 'DEGRADED';
    confidence = Math.min(confidence, 60);
  }

  return {
    rain_probability: rainProb,
    rain_risk: rainRisk,
    actual_rain: false,
    prediction_horizon: "Next 60 minutes",
    prediction_reason: reason,
    prediction_confidence: confidence,
    data_status: dataStatus,
    derived_features: {
      tempTrend5m: trends.tempTrend5m,
      humidityTrend5m: trends.humidityTrend5m,
      lightTrend5m: trends.lightTrend5m,
      rainAnalogTrend5m: trends.rainAnalogTrend5m,
      hourlyPrecipTrend: weatherData?.current?.precipitation ?? 0,
      isNightOrTwilight,
      rawLightAdc: rawLight,
      isLocalPlateBoneDry,
      sunriseTime: solar.sunriseTime,
      sunsetTime: solar.sunsetTime,
      isAfterSunset: solar.isSunsetted,
      isBeforeSunrise: solar.isBeforeSunrise,
      isSolarDaylight: solar.isSolarDaylight,
      solarDataAvailable: solar.dataAvailable,
    },
  };
}

/**
 * 4. CONTROL DECISION ENGINE WITH HYSTERESIS & STRICT PRIORITY
 * Evaluates whether tarpaulin must be OPEN or CLOSED.
 * Priority:
 *   1. Night / Condensation Protection -> CLOSED
 *   2. 12V Heater Active Sealing -> CLOSED
 *   3. Actual Local Rain On Plate -> CLOSED
 *   4. Near-Term High Rain Risk (>= closeThreshold) -> CLOSED
 *   5. Safe Daytime Drying (Daytime + dry + risk < openThreshold + valid sensors) -> OPEN
 *   6. Hysteresis Deadband -> KEEP CURRENT SAFE POSITION
 *   7. Sensor Fault / Safety Unverifiable -> SAFE_CLOSED
 */
export function evaluateControlDecision(
  currentCanopyState: CanopyMode,
  currentPhysicalPosition: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'STOPPED',
  prediction: UnifiedRainPrediction,
  validation: SensorValidationSummary,
  heaterState: HeaterDryerState,
  farmSettings: FarmSettings,
  spatial30km?: Spatial30LocationMetrics,
  currentWeather?: any,
  weatherForecast?: any
): {
  target: 'OPEN' | 'CLOSED';
  actionTaken: boolean;
  reason: string;
  isSafeDryingPermitted: boolean;
  systemMode: SystemOperatingMode;
  systemModeReason: string;
} {
  // PRIORITY 0A: Emergency Stop Lockout (Absolute Highest Priority)
  // When STOP is active, motor is completely terminated and CANNOT move under any circumstances.
  if (currentCanopyState === 'STOPPED') {
    return {
      target: currentPhysicalPosition === 'OPEN' ? 'OPEN' : 'CLOSED',
      actionTaken: false,
      reason: "EMERGENCY STOPPED by operator — motor is completely terminated until START is pressed",
      isSafeDryingPermitted: false,
      systemMode: 'SAFE_CLOSED',
      systemModeReason: "Emergency Stop active: Motor completely terminated",
    };
  }

  // PRIORITY 0B: Manual Operator Overrides
  if (currentCanopyState === 'OPEN') {
    return {
      target: 'OPEN',
      actionTaken: currentPhysicalPosition !== 'OPEN' && currentPhysicalPosition !== 'OPENING',
      reason: "Manual Override: OPEN commanded by operator",
      isSafeDryingPermitted: true,
      systemMode: 'NORMAL',
      systemModeReason: "Manual OPEN override active",
    };
  }

  if (currentCanopyState === 'CLOSED') {
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason: "Manual Override: CLOSED commanded by operator",
      isSafeDryingPermitted: false,
      systemMode: 'NORMAL',
      systemModeReason: "Manual CLOSED override active",
    };
  }

  const closeThresh = farmSettings.closeRainThreshold || 60;
  const openThresh = farmSettings.openRainThreshold || 30;
  const decMode: DecisionMode = farmSettings.decisionMode || 'COMBO';

  // Extract or calculate solar ephemeris (Sunrise / Sunset times and state)
  const solar = weatherForecast
    ? calculateSolarEphemeris(weatherForecast, Date.now())
    : {
        sunriseTime: prediction.derived_features.sunriseTime ?? null,
        sunsetTime: prediction.derived_features.sunsetTime ?? null,
        sunriseIso: null,
        sunsetIso: null,
        currentLocalTimeIso: null,
        isSunsetted: Boolean(prediction.derived_features.isAfterSunset),
        isBeforeSunrise: Boolean(prediction.derived_features.isBeforeSunrise),
        isSolarDaylight: Boolean(prediction.derived_features.isSolarDaylight),
        minutesUntilSunset: null,
        minutesSinceSunrise: null,
        dataAvailable: Boolean(prediction.derived_features.solarDataAvailable),
      };

  // LDR Sensor light and night detection
  const rawLight = typeof prediction.derived_features.rawLightAdc === 'number' 
    ? prediction.derived_features.rawLightAdc 
    : null;
  const isNightByLdr = rawLight !== null && rawLight > (farmSettings.nightDetectionThreshold || 3400);

  // Sunlight intensity from LDR (0-100%): ALWAYS calculated directly from physical LDR ADC
  // Low ADC (0-1600) = Bright direct sun, High ADC (3400-4095) = Dark night
  const sunPct = rawLight !== null 
    ? Math.max(0, Math.min(100, Math.round(((4095 - rawLight) / 4095) * 100))) 
    : null;
  const sunlightCloseThresh = farmSettings.sunlightCloseThresholdPercent ?? 60;
  const isLowSunlight = sunPct !== null && sunPct <= sunlightCloseThresh;

  // Night detection per decision mode:
  // In SENSOR_ONLY mode: night is purely determined by physical LDR darkness (zero internet forecast influence)
  // In INTERNET_ONLY mode: night is determined by solar ephemeris
  // In COMBO mode: solar ephemeris OR physical LDR darkness
  const isNight = decMode === 'SENSOR_ONLY'
    ? isNightByLdr
    : decMode === 'INTERNET_ONLY'
    ? Boolean(prediction.derived_features.isNightOrTwilight)
    : (isNightByLdr || Boolean(prediction.derived_features.isNightOrTwilight));

  // PRIORITY: 12V Heater & Hot-Air Dryer Insulation Sealing
  // Chamber must be closed while heating to retain thermal energy
  if (heaterState.status === 'HEATING' && farmSettings.heaterAutoCloseSheet) {
    const reason = `12V Dryer Active: Chamber sealed at ${heaterState.activeSeconds}s to insulate drying bed`;
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason,
      isSafeDryingPermitted: false,
      systemMode: 'NORMAL',
      systemModeReason: "12V hot-air chamber insulated",
    };
  }

  // =========================================================================
  // MODE 1: SENSORS ONLY (Strict Physical Hardware Control)
  // Operates strictly and solely within physical sensor parameters.
  // In SENSOR_ONLY mode, sunset and sunrise times DO NOT MATTER.
  // If the LDR detects light (> 60%), it works perfectly and opens!
  // No online forecast, no weather API, and no radar data are consumed.
  // 1. Hardware offline fail-safe -> SAFE_CLOSED
  // 2. Drying bed rain sensor plate wet -> CLOSE immediately
  // 3. LDR detects low light (<= 60% intensity) -> CLOSE
  // 4. LDR detects light (> 60%) + Dry plate -> OPEN & WORK PERFECTLY
  // =========================================================================
  if (decMode === 'SENSOR_ONLY') {
    // 1. Hardware offline fail-safe
    if (!validation.allCriticalSensorsValid) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Sensors Mode: Critical sensor offline/faulty (${validation.validationWarnings.join('; ')}) — failsafe CLOSED to protect arecanuts`,
        isSafeDryingPermitted: false,
        systemMode: 'SAFE_CLOSED',
        systemModeReason: 'Sensor hardware fault — failsafe engaged',
      };
    }

    // 2. Local Rain Sensor Plate
    if (prediction.actual_rain) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: 'Sensors Mode Priority #1: Rain detected on drying bed sensor plate — sealing canopy immediately',
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Hardware rain sensor active',
      };
    }

    // 3. LDR Light Detection:
    // If LDR detects low light (<= sunlightCloseThresh, default 60%), close canopy
    if (isLowSunlight) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Sensors Mode: LDR detects low light (${sunPct}% <= ${sunlightCloseThresh}% threshold) — sealing canopy`,
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Sub-threshold light intensity on LDR',
      };
    }

    // 4. LDR detects light (> 60%) & sensor plate is dry -> OPEN!
    // Sunset and sunrise times do NOT matter in SENSOR_ONLY mode.
    if (!prediction.actual_rain && sunPct !== null && sunPct > sunlightCloseThresh) {
      return {
        target: 'OPEN',
        actionTaken: currentPhysicalPosition !== 'OPEN' && currentPhysicalPosition !== 'OPENING',
        reason: `Sensors Mode: LDR confirms ${sunPct}% light detected (> ${sunlightCloseThresh}%) & sensor plate is dry — working perfectly (astronomical sunset/sunrise ignored)`,
        isSafeDryingPermitted: true,
        systemMode: 'NORMAL',
        systemModeReason: 'LDR detects light & sensor plate dry',
      };
    }

    // Fallback: Default closed
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason: `Sensors Mode: Holding closed until sensor plate is dry and LDR detects light (> ${sunlightCloseThresh}%)`,
      isSafeDryingPermitted: false,
      systemMode: 'NORMAL',
      systemModeReason: 'Holding closed for safe parameters',
    };
  }

  // =========================================================================
  // MODE 2: FORECAST ONLY (Strict Online Forecasting & Solar Ephemeris Mode)
  // Consumes sunset & sunrise forecast data + 10km regional perimeter radar.
  // No local sensor telemetry is used.
  // 1. Sunset / Night Protection: If sunset occurred -> CLOSE immediately!
  //    Pre-dawn darkness (before sunrise) -> CLOSE.
  // 2. Rain in current location or nearest 10km perimeter -> CLOSE.
  // 3. Daytime & "Other parameters are good" (rain prob < 30%, 10km clear, no rain) -> OPEN!
  // =========================================================================
  if (decMode === 'INTERNET_ONLY') {
    // 1. Solar Ephemeris Sunset / Night Protection
    if (solar.dataAvailable) {
      if (solar.isSunsetted) {
        return {
          target: 'CLOSED',
          actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
          reason: `Forecast Mode: Sunset has occurred (${solar.sunsetTime || 'sunset'}) — canopy closed for night dew protection`,
          isSafeDryingPermitted: false,
          systemMode: 'NORMAL',
          systemModeReason: 'Sunset passed — night dew protection active',
        };
      }
      if (solar.isBeforeSunrise) {
        return {
          target: 'CLOSED',
          actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
          reason: `Forecast Mode: Pre-dawn darkness (Sunrise at ${solar.sunriseTime || 'dawn'}) — canopy closed for dawn dew protection`,
          isSafeDryingPermitted: false,
          systemMode: 'NORMAL',
          systemModeReason: 'Pre-dawn dew protection active',
        };
      }
    } else if (currentWeather?.is_day === 0 || prediction.derived_features.isNightOrTwilight) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: 'Forecast Mode: Nighttime solar ephemeris — canopy sealed for night dew protection',
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Night condensation protection active',
      };
    }

    // 2. Rain in Current Location or Nearest Locations (<10km perimeter)
    const isPerimeterClear = spatial30km?.is10kmPerimeterClear ?? true;
    const nearestRainDist = spatial30km?.nearestRainDistanceKm ?? null;
    const threatLocation = spatial30km?.nearestRainPlaceName || 'nearby sector';
    const threatDist = nearestRainDist !== null ? ` (~${nearestRainDist}km)` : '';

    const isCurrentRainThreat = prediction.rain_probability >= closeThresh ||
      (currentWeather && currentWeather.precipitation > 0.1);

    const isNearestRainThreat = !isPerimeterClear ||
      (nearestRainDist !== null && nearestRainDist <= 10.0);

    if (isCurrentRainThreat || isNearestRainThreat) {
      const reason = isNearestRainThreat
        ? `Forecast Mode: Approaching rain front at nearest location ${threatLocation}${threatDist} — closing preemptively`
        : `Forecast Mode: Rain threat detected at farm (${prediction.rain_probability}% risk >= ${closeThresh}%) — closing canopy`;

      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason,
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Online forecast rain threat',
      };
    }

    // 3. Daytime & "Other parameters are good" -> OPEN for solar drying
    const isDaytimeActive = solar.dataAvailable ? solar.isSolarDaylight : (currentWeather?.is_day !== 0);
    const isOtherParamsGood = prediction.rain_probability < openThresh &&
      isPerimeterClear &&
      (currentWeather ? currentWeather.precipitation <= 0.1 : true);

    if (isDaytimeActive && isOtherParamsGood) {
      const timeWindow = (solar.sunriseTime && solar.sunsetTime) ? ` (${solar.sunriseTime} to ${solar.sunsetTime})` : '';
      return {
        target: 'OPEN',
        actionTaken: currentPhysicalPosition !== 'OPEN' && currentPhysicalPosition !== 'OPENING',
        reason: `Forecast Mode: Daylight active${timeWindow} & all forecast parameters clear (<${openThresh}% rain risk, 10km perimeter dry) — opening for solar drying`,
        isSafeDryingPermitted: true,
        systemMode: 'NORMAL',
        systemModeReason: 'Online forecast parameters verified safe',
      };
    }

    // 4. Hysteresis band for forecast mode
    const currentPos = currentPhysicalPosition === 'OPEN' || currentPhysicalPosition === 'OPENING' ? 'OPEN' : 'CLOSED';
    return {
      target: currentPos,
      actionTaken: false,
      reason: `Forecast Mode: Intermediate rain risk (${prediction.rain_probability}%) — holding ${currentPos} state`,
      isSafeDryingPermitted: currentPos === 'OPEN',
      systemMode: 'NORMAL',
      systemModeReason: 'Forecast hysteresis stabilization',
    };
  }

  // =========================================================================
  // MODE 3: COMBINED MODE (Dual-Source Cross-Validation with Ephemeris & LDR Failover)
  // Sunset & sunrise added to existing parameters.
  // If forecast ephemeris fails -> relay on physical LDR sensor data!
  // Before opening -> cross-check ALL parameters before executing!
  // =========================================================================

  // PRIORITY 1: Physical Rain Sensor Plate (Highest Priority)
  // If actual rain is on the bed, seal immediately to prevent crop damage!
  if (prediction.actual_rain) {
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason: 'Combined Mode Priority #1: Rain detected on drying bed sensor plate — sealing canopy immediately to protect arecanuts',
      isSafeDryingPermitted: false,
      systemMode: 'NORMAL',
      systemModeReason: 'Hardware rain sensor active',
    };
  }

  // PRIORITY 2: Solar Sunset / Sunrise & Night Dew Protection with LDR Failover
  const hasStrongPhysicalSun = rawLight !== null && rawLight < 2000; // ADC < 2000 is >51% direct sunlight
  if (solar.dataAvailable) {
    if (solar.isSunsetted && !hasStrongPhysicalSun) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Combined Mode: Sunset has occurred (${solar.sunsetTime}) — canopy closed for night dew protection`,
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Sunset passed — night dew protection active',
      };
    }
    if (solar.isBeforeSunrise && !hasStrongPhysicalSun) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Combined Mode: Pre-dawn darkness (Sunrise at ${solar.sunriseTime}) — canopy closed for dawn condensation protection`,
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Pre-dawn dew protection active',
      };
    }
  } else {
    // If forecast solar data fails or is unavailable -> RELAY ON LDR SENSORS DATA!
    if (isNightByLdr || (rawLight !== null && rawLight > (farmSettings.nightDetectionThreshold || 3400))) {
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Combined Mode (Solar forecast unavailable, relaying on LDR sensor): LDR detects night darkness (ADC ${rawLight}) — canopy sealed against condensation`,
        isSafeDryingPermitted: false,
        systemMode: 'LOCAL_FALLBACK',
        systemModeReason: 'Night dew protection active via LDR sensor failover',
      };
    }
  }

  // PRIORITY 3: LDR Sunlight Intensity <= 60%
  // Even during daytime between sunrise and sunset, low sunlight triggers closure
  if (isLowSunlight) {
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason: `Combined Mode: LDR sensor detects ${sunPct}% sunlight (<= ${sunlightCloseThresh}% threshold) — sealing canopy against low drying radiation`,
      isSafeDryingPermitted: false,
      systemMode: 'NORMAL',
      systemModeReason: 'Sub-60% sunlight intensity',
    };
  }

  // PRIORITY 4: Sensor Fail-Safe Check
  if (!validation.allCriticalSensorsValid) {
    return {
      target: 'CLOSED',
      actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
      reason: `Combined Mode: Critical sensor fault (${validation.validationWarnings.join('; ')}) — failsafe CLOSED to protect arecanuts`,
      isSafeDryingPermitted: false,
      systemMode: 'SAFE_CLOSED',
      systemModeReason: 'Sensor telemetry unavailable or invalid; fail-safe engaged',
    };
  }

  // PRIORITY 5: Online Forecast & 10km Perimeter Cross-Validation
  const isOnlineRainThreat = prediction.rain_probability >= closeThresh ||
    prediction.rain_probability >= (farmSettings.onlineRainProbabilityThreshold || 30);

  const isPerimeterClear = spatial30km?.is10kmPerimeterClear ?? true;
  const nearestRainDist = spatial30km?.nearestRainDistanceKm ?? null;
  const isNearestLocationsRaining = !isPerimeterClear ||
    (nearestRainDist !== null && nearestRainDist <= 10.0);

  if (isOnlineRainThreat) {
    const isSensorConfirmsDryAndSunny = !prediction.actual_rain &&
      Boolean(prediction.derived_features.isLocalPlateBoneDry) &&
      sunPct !== null &&
      sunPct > sunlightCloseThresh;

    if (isSensorConfirmsDryAndSunny) {
      // Sensor is dry and sunny, but online forecast predicts rain -> validate with nearest 10km radar!
      if (isNearestLocationsRaining) {
        const nearestPlace = spatial30km?.nearestRainPlaceName || 'nearby location';
        const dist = nearestRainDist !== null ? ` (~${nearestRainDist}km)` : '';
        return {
          target: 'CLOSED',
          actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
          reason: `Combined Mode: Rain front confirmed at nearest station ${nearestPlace}${dist} — closing canopy preemptively before arrival`,
          isSafeDryingPermitted: false,
          systemMode: 'NORMAL',
          systemModeReason: 'Nearest location radar validated incoming front',
        };
      } else {
        // Nearest 10km perimeter is clear and local sensor is bone dry with >60% sun -> false alarm bypass keeps OPEN
        return {
          target: 'OPEN',
          actionTaken: currentPhysicalPosition !== 'OPEN' && currentPhysicalPosition !== 'OPENING',
          reason: `Combined Mode: Local bed dry with ${sunPct}% sunlight (>60%) & nearest 10km perimeter is clear — maintaining solar drying despite online alert`,
          isSafeDryingPermitted: true,
          systemMode: 'NORMAL',
          systemModeReason: 'Sensor & nearest radar validated safe drying',
        };
      }
    } else {
      // Both online threat and sensor indicates wet/cloudy -> CLOSE
      return {
        target: 'CLOSED',
        actionTaken: currentPhysicalPosition !== 'CLOSED' && currentPhysicalPosition !== 'CLOSING',
        reason: `Combined Mode: Online rain threat (${prediction.rain_probability}%) active — closing canopy`,
        isSafeDryingPermitted: false,
        systemMode: 'NORMAL',
        systemModeReason: 'Preemptive rain protection',
      };
    }
  }

  // PRIORITY 6: Safe Solar Drying (OPEN)
  // "before opening check other parameters and then execute in comboned mode...."
  // Strict pre-opening checklist:
  //   1. Drying bed rain plate verified bone dry
  //   2. Solar daylight verified (or LDR daylight failover if solar data offline)
  //   3. LDR sunlight intensity > 60%
  //   4. Rain risk < open threshold (<30%)
  //   5. 10km regional perimeter is clear
  //   6. All critical sensors valid
  const isDaylightSafe = solar.dataAvailable ? solar.isSolarDaylight : (!isNightByLdr && rawLight !== null && rawLight <= (farmSettings.nightDetectionThreshold || 3400));
  const isPlateDry = !prediction.actual_rain && Boolean(prediction.derived_features.isLocalPlateBoneDry);
  const isSunlightHigh = sunPct !== null && sunPct > sunlightCloseThresh;
  const isRainRiskLow = prediction.rain_probability < openThresh;
  const isPerimeterDry = isPerimeterClear;
  const isSensorsOk = validation.allCriticalSensorsValid;

  if (isPlateDry && isDaylightSafe && isSunlightHigh && isRainRiskLow && isPerimeterDry && isSensorsOk) {
    const solarStr = solar.dataAvailable ? ` (Sunrise: ${solar.sunriseTime}, Sunset: ${solar.sunsetTime})` : ' (LDR Daylight)';
    return {
      target: 'OPEN',
      actionTaken: currentPhysicalPosition !== 'OPEN' && currentPhysicalPosition !== 'OPENING',
      reason: `Combined Mode: All parameters verified safe${solarStr} — LDR ${sunPct}% sun (>60%), dry sensor plate, <${openThresh}% rain risk, 10km perimeter clear — opening for optimal solar drying`,
      isSafeDryingPermitted: true,
      systemMode: prediction.data_status === 'FALLBACK' ? 'LOCAL_FALLBACK' : 'NORMAL',
      systemModeReason: 'All parameters verified safe for solar drying',
    };
  }

  // PRIORITY 7: Hysteresis Deadband (Between openThresh and closeThresh)
  const currentPos = currentPhysicalPosition === 'OPEN' || currentPhysicalPosition === 'OPENING' ? 'OPEN' : 'CLOSED';
  return {
    target: currentPos,
    actionTaken: false,
    reason: `Combined Mode: Holding ${currentPos} — verifying all opening parameters (sunlight: ${sunPct ?? 0}%, rain risk: ${prediction.rain_probability}%, 10km perimeter: ${isPerimeterClear ? 'clear' : 'active'})`,
    isSafeDryingPermitted: currentPos === 'OPEN',
    systemMode: 'NORMAL',
    systemModeReason: 'Combined parameter stabilization',
  };
}

/**
 * 5. ML DATASET & EVENT RECORDER
 * Automatically captures real-world features and decisions into a persistent dataset
 */
export function logMlEvent(
  state: SingleSourceSystemState,
  groundOutcome?: string
) {
  try {
    const record = {
      timestamp: state.timestamp,
      isoDate: new Date(state.timestamp).toISOString(),
      temperature: state.latest_sensor?.temperature ?? null,
      humidity: state.latest_sensor?.humidity ?? null,
      lightAdc: state.latest_sensor?.light ?? null,
      rainAnalog: state.latest_sensor?.rain_analog ?? null,
      actualRain: state.prediction.actual_rain,
      currentRainProb: state.weather_status.currentPrecipitation > 0 ? 80 : 15,
      currentPrecipitation: state.weather_status.currentPrecipitation,
      currentCloudCover: state.weather_status.currentCloudCover,
      nearbyWeightedRainProb: state.nearby_weather.distanceWeightedNearbyRisk,
      nearbySpatialConsistency: state.nearby_weather.spatialConsistency,
      humidityTrend5m: state.prediction.derived_features.humidityTrend5m,
      tempTrend5m: state.prediction.derived_features.tempTrend5m,
      lightTrend5m: state.prediction.derived_features.lightTrend5m,
      rainRiskPrediction: state.prediction.rain_risk,
      rainProbability: state.prediction.rain_probability,
      decisionAction: state.tarpaulin.lastDecision,
      decisionReason: state.tarpaulin.lastDecisionReason,
      systemMode: state.system_mode,
      groundTruthOutcome: groundOutcome || (state.prediction.actual_rain ? "RAIN" : "DRY"),
    };

    let dataset: any[] = [];
    if (fs.existsSync(DATASET_FILE)) {
      try {
        const raw = fs.readFileSync(DATASET_FILE, "utf-8");
        dataset = JSON.parse(raw);
      } catch {
        dataset = [];
      }
    }

    dataset.push(record);
    // Keep last 1000 events
    if (dataset.length > 1000) {
      dataset = dataset.slice(-1000);
    }

    fs.writeFileSync(DATASET_FILE, JSON.stringify(dataset, null, 2));
  } catch (err) {
    // Non-blocking logger
    console.warn("[PredictionEngine] ML event logging failed:", err);
  }
}
