import { WeatherForecastResponse } from '../types';

/**
 * Accurately finds the current hour index in the Open-Meteo hourly arrays.
 * Because past_days=1 is requested, index 0..23 corresponds to yesterday,
 * and today's hours begin at index 24.
 */
export function getCurrentHourIndex(weather: WeatherForecastResponse | null): number {
  if (!weather?.hourly?.time || weather.hourly.time.length === 0) {
    return 0;
  }
  const times = weather.hourly.time;

  // 1. Primary: Use weather.current.time directly from the meteorological API (e.g. "2026-09-21T15:45")
  if (weather.current?.time) {
    const curTarget = String(weather.current.time).substring(0, 13);
    const match = times.findIndex((t) => t.startsWith(curTarget));
    if (match !== -1) {
      return match;
    }
  }

  const now = new Date();

  // 2. Try matching local date and hour string: "YYYY-MM-DDTHH"
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const localTarget = `${year}-${month}-${date}T${hour}`;

  let matchIndex = times.findIndex((t) => t.startsWith(localTarget));
  if (matchIndex !== -1) {
    return matchIndex;
  }

  // 3. Fallback to UTC comparison
  const utcTarget = now.toISOString().substring(0, 13);
  matchIndex = times.findIndex((t) => t.startsWith(utcTarget));
  if (matchIndex !== -1) {
    return matchIndex;
  }

  // 4. If past_days=1 was supplied and times.length >= 72, today begins around index 24
  if (times.length >= 72) {
    return Math.min(times.length - 1, Math.max(0, 24 + now.getHours()));
  }

  return Math.min(times.length - 1, Math.max(0, now.getHours()));
}

export interface GoogleRainAnalysis {
  isRainThreat: boolean;
  isSlightRainRisk: boolean;
  currentPrecipProb: number;
  maxPrecipProbNext3h: number;
  calibratedRisk: number;
  currentPrecipMm: number;
  weatherCode: number;
  isRainWeatherCode: boolean;
  cloudCover: number;
  reason: string;
}

// WMO codes that indicate precipitation (drizzle, rain, shower, thunderstorm)
const RAIN_WEATHER_CODES = new Set([
  51, 53, 55, // Drizzle: light, moderate, dense
  56, 57,     // Freezing drizzle
  61, 63, 65, // Rain: slight, moderate, heavy
  66, 67,     // Freezing rain
  80, 81, 82, // Rain showers: slight, moderate, violent
  95, 96, 99, // Thunderstorm
]);

/**
 * Evaluates Google / Open-Meteo meteorological data with strict agricultural protection
 * for arecanut drying beds. Any slight chance of rain (>= 20% POP, rain code, or radar precipitation)
 * triggers a Rain Threat so the canopy is closed before moisture can ruin the crop.
 */
export function getGoogleRainAnalysis(
  weather: WeatherForecastResponse | null,
  localSensor?: { rain?: boolean; rain_analog?: number | null; rain_connected?: boolean; light?: number | null } | null
): GoogleRainAnalysis {
  if (!weather) {
    return {
      isRainThreat: false,
      isSlightRainRisk: false,
      currentPrecipProb: 0,
      maxPrecipProbNext3h: 0,
      calibratedRisk: 0,
      currentPrecipMm: 0,
      weatherCode: 0,
      isRainWeatherCode: false,
      cloudCover: 0,
      reason: 'No Google weather data available',
    };
  }

  const curIdx = getCurrentHourIndex(weather);
  const probs = weather.hourly?.precipitation_probability || [];
  const precips = weather.hourly?.precipitation || [];

  // Accurate current hour precipitation probability
  const currentPrecipProb = typeof probs[curIdx] === 'number' ? probs[curIdx] : 0;

  // Next 3 hours window (e.g. current + next 2 hours)
  const windowProbs = probs.slice(curIdx, curIdx + 3);
  const windowPrecips = precips.slice(curIdx, curIdx + 3);

  const maxPrecipProbNext3h = windowProbs.length > 0 ? Math.max(...windowProbs, 0) : currentPrecipProb;
  const maxPrecipRateNext3h = windowPrecips.length > 0 ? Math.max(...windowPrecips, 0) : 0;

  const currentPrecipMm = weather.current?.precipitation ?? 0;
  const weatherCode = weather.current?.weather_code ?? 0;
  const isRainWeatherCode = RAIN_WEATHER_CODES.has(weatherCode);
  const cloudCover = weather.current?.cloud_cover ?? 0;

  // Local Physical Hardware Ground-Truth Verification
  const isLocalPlateVerifiedDry = Boolean(
    localSensor &&
    !localSensor.rain &&
    (localSensor.rain_analog === null || localSensor.rain_analog === undefined || localSensor.rain_analog >= 2800)
  );
  const isLocalSunlightVerified = Boolean(
    localSensor &&
    typeof localSensor.light === 'number' &&
    localSensor.light < 2600
  );

  // Compute realistic calibrated agricultural rain risk
  let calibratedRisk = 5;
  if (currentPrecipMm >= 1.0) {
    calibratedRisk = Math.min(95, Math.max(80, currentPrecipProb));
  } else if (currentPrecipMm >= 0.5) {
    calibratedRisk = Math.min(85, Math.max(60, currentPrecipProb));
  } else if (currentPrecipMm >= 0.25 && currentPrecipProb >= 40) {
    calibratedRisk = Math.min(65, Math.max(35, currentPrecipProb));
  } else if (maxPrecipRateNext3h >= 0.5 && maxPrecipProbNext3h >= 50) {
    calibratedRisk = Math.min(75, Math.max(45, Math.round(maxPrecipProbNext3h * 0.75)));
  } else if (currentPrecipProb >= 60) {
    calibratedRisk = Math.min(60, Math.max(35, Math.round(currentPrecipProb * 0.60)));
  } else if (currentPrecipProb >= 35) {
    calibratedRisk = Math.min(30, Math.max(15, Math.round(currentPrecipProb * 0.35)));
  } else if (cloudCover >= 75) {
    calibratedRisk = Math.min(20, Math.max(10, Math.round(currentPrecipProb * 0.20)));
  } else {
    // Clear / sunny / slight clouds
    calibratedRisk = Math.min(10, Math.max(2, Math.round(currentPrecipProb * 0.10)));
  }

  // If local sensors actively confirm bone-dry plate and bright sunshine:
  if (isLocalPlateVerifiedDry && isLocalSunlightVerified) {
    calibratedRisk = Math.min(calibratedRisk, 8);
  }

  // Strict agricultural rain condition:
  // Arecanut cannot tolerate rain moisture. Canopy closes on actual significant rain on ground (>=0.5mm)
  // or high imminent threat (calibrated risk >= 50% or next 3h rain > 0.5mm with high probability).
  // Note: Open-Meteo numerical grid artifacts (0.1 - 0.2mm) with low probability do not represent true rain!
  const isDirectRain = (currentPrecipMm >= 0.5 || (currentPrecipMm >= 0.3 && currentPrecipProb >= 50)) && !isLocalPlateVerifiedDry;
  const isSlightRainRisk = (calibratedRisk >= 50 || (maxPrecipRateNext3h >= 0.5 && maxPrecipProbNext3h >= 50)) && !(isLocalPlateVerifiedDry && isLocalSunlightVerified);
  const isRainThreat = isDirectRain || isSlightRainRisk;

  let reason = `Clear sky (${calibratedRisk}% risk)`;
  if (isLocalPlateVerifiedDry && isLocalSunlightVerified) {
    reason = `Bright sunshine & dry drying bed confirmed (${calibratedRisk}% risk)`;
  } else if (isDirectRain) {
    reason = `Rain detected (${currentPrecipMm.toFixed(1)}mm)`;
  } else if (isRainThreat && isRainWeatherCode && maxPrecipRateNext3h >= 0.5) {
    reason = `Rain incoming (~${maxPrecipRateNext3h.toFixed(1)}mm)`;
  } else if (isRainThreat && calibratedRisk >= 50) {
    reason = `Rain threat (${calibratedRisk}% risk)`;
  } else if (cloudCover >= 60) {
    reason = `${cloudCover}% clouds (${calibratedRisk}% risk)`;
  } else {
    reason = `Clear sky (${calibratedRisk}% risk)`;
  }

  return {
    isRainThreat,
    isSlightRainRisk,
    currentPrecipProb,
    maxPrecipProbNext3h,
    calibratedRisk,
    currentPrecipMm,
    weatherCode,
    isRainWeatherCode,
    cloudCover,
    reason,
  };
}
