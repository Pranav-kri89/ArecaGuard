import { Radar30kmScanResult, RadarLocationPoint, Spatial30LocationMetrics, SpatialConsistencyState } from "../src/types";
import { getRealNearbyPlacesForLocation, haversineDistanceKm } from "./nearbyPlaces";


// Helper to decode WMO weather code into clear human-readable string
function decodeWeatherCode(code: number): { condition: string; isPrecip: boolean } {
  switch (code) {
    case 0:
      return { condition: "Clear Sky", isPrecip: false };
    case 1:
      return { condition: "Mainly Clear", isPrecip: false };
    case 2:
      return { condition: "Partly Cloudy", isPrecip: false };
    case 3:
      return { condition: "Overcast", isPrecip: false };
    case 45:
    case 48:
      return { condition: "Foggy", isPrecip: false };
    case 51:
      return { condition: "Light Drizzle", isPrecip: true };
    case 53:
      return { condition: "Moderate Drizzle", isPrecip: true };
    case 55:
      return { condition: "Dense Drizzle", isPrecip: true };
    case 61:
      return { condition: "Slight Rain", isPrecip: true };
    case 63:
      return { condition: "Moderate Rain", isPrecip: true };
    case 65:
      return { condition: "Heavy Rain", isPrecip: true };
    case 80:
      return { condition: "Light Showers", isPrecip: true };
    case 81:
      return { condition: "Moderate Showers", isPrecip: true };
    case 82:
      return { condition: "Violent Showers", isPrecip: true };
    case 95:
      return { condition: "Thunderstorm", isPrecip: true };
    case 96:
    case 99:
      return { condition: "Thunderstorm with Hail", isPrecip: true };
    default:
      return { condition: code > 50 ? "Precipitation" : "Fair", isPrecip: code > 50 };
  }
}

/**
 * Calibrates the statistical probability of precipitation (POP) into a realistic
 * agricultural rain risk index for arecanut drying.
 * Prevents false alarms when active precipitation is 0.0mm and clouds are moderate.
 */
function calculateCalibratedRainRisk(
  precipMm: number,
  rawPop: number,
  cloudCover: number,
  isPrecipCode: boolean
): number {
  // 1. If actively precipitating right now
  if (precipMm >= 1.0) return Math.min(95, Math.max(80, rawPop));
  if (precipMm > 0.2) return Math.min(85, Math.max(65, rawPop));
  if (precipMm > 0.02 || isPrecipCode) return Math.min(65, Math.max(45, Math.round(rawPop * 0.75)));

  // 2. Dry on the ground (precip === 0)
  // Agricultural drying beds are only threatened if clouds are actually dense and dark overhead
  if (cloudCover < 30) {
    // Clear / sunny skies: raw POP is often statistical model noise in coastal tropics
    return Math.min(15, Math.max(2, Math.round(rawPop * 0.15)));
  }

  if (cloudCover < 65) {
    // Broken cumulus / scattered clouds
    return Math.min(30, Math.max(8, Math.round(rawPop * 0.35)));
  }

  // Heavy overcast (cloudCover >= 65%)
  if (rawPop >= 70) {
    return Math.min(55, Math.max(30, Math.round(rawPop * 0.55)));
  }

  return Math.min(35, Math.max(12, Math.round(rawPop * 0.40)));
}

export async function scan30kmRadarPerimeter(
  centerLat: number = 12.9141,
  centerLon: number = 74.8560,
  localSensor?: any
): Promise<Radar30kmScanResult> {
  const radarRadiusKm = 100; // Expanded to 100km for regional weather reference
  const criticalRadiusKm = 10; // Critical 10km action perimeter: only rain <=10km triggers canopy closure

  // Resolve REAL actual towns and locations surrounding the farm coordinates with real distances up to 100km!
  // Requests up to 42 surrounding locations covering both the 10km critical zone and up to 100km regional reference.
  const realPlaces = getRealNearbyPlacesForLocation(centerLat, centerLon, 100, 42);

  const latsStr = realPlaces.map((p) => p.latitude.toFixed(4)).join(",");
  const lonsStr = realPlaces.map((p) => p.longitude.toFixed(4)).join(",");

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latsStr}&longitude=${lonsStr}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability,precipitation&timezone=auto`;

  let apiResults: any[] = [];
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      apiResults = Array.isArray(data) ? data : [data];
    } else {
      console.warn(`[Radar Scanner] Open-Meteo multi-point returned status ${res.status}. Falling back gracefully.`);
    }
  } catch (err: any) {
    console.warn("[Radar Scanner] Unable to reach radar multi-point (fallback active):", err?.message || err);
  }

  const points: RadarLocationPoint[] = realPlaces.map((place, idx) => {
    const met = apiResults[idx]?.current || {};
    const hourly = apiResults[idx]?.hourly || {};

    // Find current hour index from current.time string (e.g. "2026-09-21T15:45")
    let hourIdx = 0;
    if (met.time && Array.isArray(hourly.time)) {
      const curHourStr = String(met.time).substring(0, 13);
      const found = hourly.time.findIndex((t: string) => t.startsWith(curHourStr));
      if (found !== -1) hourIdx = found;
    }

    const rawPop = Array.isArray(hourly.precipitation_probability) && typeof hourly.precipitation_probability[hourIdx] === "number"
      ? hourly.precipitation_probability[hourIdx]
      : (met.precipitation > 0 ? 80 : 15);

    const precip = typeof met.precipitation === "number" ? met.precipitation : 0;
    const weatherCode = typeof met.weather_code === "number" ? met.weather_code : 0;
    const { condition, isPrecip } = decodeWeatherCode(weatherCode);
    const cloudCover = typeof met.cloud_cover === "number" ? met.cloud_cover : 35;

    // Realistic calibrated agricultural rain risk
    const calibratedRisk = calculateCalibratedRainRisk(precip, rawPop, cloudCover, isPrecip);
    const isRaining = precip > 0.1 || (isPrecip && precip > 0.02) || (calibratedRisk >= 60 && cloudCover >= 80);

    const distanceLabel = place.isCenter
      ? `${place.name} (0 km)`
      : `${place.name} (${place.distanceKm} km ${place.compassDirection})`;

    return {
      direction: place.compassDirection,
      label: distanceLabel,
      placeName: place.name,
      region: place.region,
      distanceKm: place.distanceKm,
      bearingDeg: place.bearingDeg,
      latitude: Number(place.latitude.toFixed(4)),
      longitude: Number(place.longitude.toFixed(4)),
      temperature: typeof met.temperature_2m === "number" ? met.temperature_2m : 29.0,
      precipitation: precip,
      rainProbability: calibratedRisk,
      rawProbability: rawPop,
      cloudCover,
      weatherCode,
      isRaining,
      condition,
      isCenter: Boolean(place.isCenter),
    };
  });

  // Center is point 0, nearby points are 1..N
  const centerPoint = points[0];
  const nearbyPoints = points.slice(1);

  // 10km Critical Zone: Center + all stations within 10.0km
  const critical10kmPoints = points.filter((p) => p.distanceKm <= 10.0 || p.isCenter);
  const rainIn10kmPoints = critical10kmPoints.filter((p) => p.isRaining || p.precipitation > 0.1);
  const rainIn10kmCount = rainIn10kmPoints.length;
  const is10kmPerimeterClear = rainIn10kmCount === 0;

  // Extended Reference Points (10km - 100km)
  const extendedRefPoints = points.filter((p) => p.distanceKm > 10.0);
  const rainInExtendedPoints = extendedRefPoints.filter((p) => p.isRaining || p.precipitation > 0.1);

  const currentLocationRisk = centerPoint ? centerPoint.rainProbability : 10;
  const nearbyAverageRisk = nearbyPoints.length > 0
    ? Math.round(nearbyPoints.reduce((acc, p) => acc + p.rainProbability, 0) / nearbyPoints.length)
    : currentLocationRisk;

  // Distance-decay weighted average: w_i = 1 / (1 + distanceKm / 10)
  let weightedSum = 0;
  let weightSum = 0;
  for (const p of nearbyPoints) {
    const w = 1 / (1 + Math.max(0.1, p.distanceKm) / 10);
    weightedSum += p.rainProbability * w;
    weightSum += w;
  }
  const distanceWeightedNearbyRisk = weightSum > 0 ? Math.round(weightedSum / weightSum) : nearbyAverageRisk;

  const highRiskPoints = nearbyPoints.filter((p) => p.rainProbability >= 50 || p.precipitation >= 0.1);
  const highRiskLocationsCount = highRiskPoints.length;
  const highRiskPercentage = Math.round((highRiskLocationsCount / Math.max(1, nearbyPoints.length)) * 100);
  const maxNearbyRisk = nearbyPoints.length > 0 ? Math.max(...nearbyPoints.map((p) => p.rainProbability)) : 0;

  // Nearest rain cell search across all points (0 - 100km)
  const rainPoints = points.filter((p) => p.isRaining || p.precipitation > 0.1);
  const rainCellsDetected = rainPoints.length;
  const maxPrecipitationMm = Math.max(...points.map((p) => p.precipitation), 0);

  let nearestRainDistanceKm: number | null = null;
  let nearestRainDirection: string | null = null;
  let nearestRainPlaceName: string | null = null;

  if (rainPoints.length > 0) {
    const sorted = [...rainPoints].sort((a, b) => a.distanceKm - b.distanceKm);
    nearestRainDistanceKm = sorted[0].distanceKm;
    nearestRainDirection = sorted[0].placeName || sorted[0].direction;
    nearestRainPlaceName = sorted[0].placeName;
  }

  // Spatial Consistency Evaluation:
  // Decisive rule: Only rain <=10km triggers strong rain consensus.
  // Rain in 10-100km is tracked as regional reference without closing the canopy if 10km is clear.
  let spatialConsistency: SpatialConsistencyState = 'CLEAR_DRY_CONSENSUS';
  let isIsolatedSpike = false;

  if (!is10kmPerimeterClear) {
    spatialConsistency = 'STRONG_AGREEMENT_RAIN';
  } else if (highRiskLocationsCount <= 2 && maxNearbyRisk >= 60 && currentLocationRisk < 30 && nearbyAverageRisk < 25) {
    spatialConsistency = 'ISOLATED_DISTANT_WARNING';
    isIsolatedSpike = true;
  } else if (rainPoints.length > 0 && is10kmPerimeterClear) {
    // Distant rain between 10km and 100km, but 10km perimeter is safe
    spatialConsistency = 'MODERATE_DISPERSED';
  } else if (nearbyAverageRisk <= 18 && currentLocationRisk <= 20 && highRiskLocationsCount === 0) {
    spatialConsistency = 'CLEAR_DRY_CONSENSUS';
  } else {
    spatialConsistency = 'MODERATE_DISPERSED';
  }

  const spatialMetrics: Spatial30LocationMetrics = {
    currentLocationRisk,
    nearbyLocationsCount: nearbyPoints.length,
    nearbyAverageRisk,
    distanceWeightedNearbyRisk,
    highRiskLocationsCount,
    highRiskPercentage,
    maxNearbyRisk,
    nearestRainDistanceKm,
    nearestRainPlaceName,
    spatialConsistency,
    isIsolatedSpike,
    critical10kmPointsCount: critical10kmPoints.length,
    rainIn10kmCount,
    is10kmPerimeterClear,
  };

  // Cross-compare with physical local sensor
  const isSensorWet = Boolean(
    localSensor?.rain ||
    localSensor?.rain_digital === 0 ||
    (localSensor?.rain_analog !== null && localSensor?.rain_analog < 2800)
  );
  const isSensorDht = Boolean(localSensor?.dht_connected);
  const sensorTemp = isSensorDht && localSensor?.temperature !== null ? localSensor.temperature : null;

  // Calibrated aggregate risk
  let aggregateRainProbability: number;
  if (!is10kmPerimeterClear) {
    aggregateRainProbability = Math.max(70, Math.round(distanceWeightedNearbyRisk * 0.6 + currentLocationRisk * 0.4));
  } else if (isIsolatedSpike) {
    aggregateRainProbability = Math.min(25, Math.round(currentLocationRisk * 0.7 + distanceWeightedNearbyRisk * 0.3));
  } else if (rainInExtendedPoints.length > 0 && is10kmPerimeterClear) {
    // Distant rain (10km-100km) only moderately influences aggregate risk, never exceeding 28% if 10km is dry
    aggregateRainProbability = Math.min(28, Math.round(currentLocationRisk * 0.75 + (distanceWeightedNearbyRisk * 0.25)));
  } else {
    aggregateRainProbability = Math.round(currentLocationRisk * 0.7 + distanceWeightedNearbyRisk * 0.3);
  }

  let conflictState: 'CONSENSUS_DRY' | 'CONSENSUS_RAIN' | 'RADAR_CONFLICT_APPROACHING' | 'LOCAL_ISOLATED_SHOWER' = 'CONSENSUS_DRY';
  let aiDecision: 'OPEN_CANOPY' | 'CLOSE_CANOPY' | 'ALERT_OPERATOR' | 'HEAT_DRY' = 'OPEN_CANOPY';
  let aiRecommendationText = "10km perimeter and 100km region are dry. Good solar drying.";

  const hasStrong10kmSignal = !is10kmPerimeterClear || (currentLocationRisk >= 50 && (centerPoint?.precipitation ?? 0) > 0.1);

  if (isSensorWet) {
    if (hasStrong10kmSignal) {
      conflictState = 'CONSENSUS_RAIN';
      aiDecision = 'CLOSE_CANOPY';
      aiRecommendationText = `Rain verified on bed sensor & within 10km critical zone (${rainIn10kmPoints[0]?.placeName || 'nearby'}). Canopy sealed.`;
    } else {
      conflictState = 'LOCAL_ISOLATED_SHOWER';
      aiDecision = 'CLOSE_CANOPY';
      aiRecommendationText = `Rain detected on drying bed sensor plate. Canopy sealed immediately.`;
    }
  } else {
    if (hasStrong10kmSignal) {
      conflictState = 'RADAR_CONFLICT_APPROACHING';
      aiDecision = 'ALERT_OPERATOR';
      aiRecommendationText = `Rain approaching within 10km critical zone at ${rainIn10kmPoints[0]?.placeName || 'nearby'} (~${rainIn10kmPoints[0]?.distanceKm} km). Sealing canopy.`;
    } else if (rainPoints.length > 0 && is10kmPerimeterClear) {
      // 10km range has NO rain places: Keep canopy OPEN for solar drying!
      conflictState = 'CONSENSUS_DRY';
      aiDecision = 'OPEN_CANOPY';
      aiRecommendationText = `10km perimeter is clear of rain. Distant rain at ${nearestRainPlaceName} (~${nearestRainDistanceKm} km) is monitored for reference. Canopy remains OPEN for drying.`;
    } else if (isIsolatedSpike) {
      conflictState = 'CONSENSUS_DRY';
      aiDecision = 'OPEN_CANOPY';
      aiRecommendationText = `Isolated rain at distant point ${nearestRainPlaceName} (${maxNearbyRisk}%), but 10km perimeter and farm are dry. Solar drying maintained.`;
    } else {
      conflictState = 'CONSENSUS_DRY';
      if (sensorTemp !== null && sensorTemp < 26.0) {
        aiDecision = 'HEAT_DRY';
        aiRecommendationText = `Clear skies (${aggregateRainProbability}% risk). Bed temp is ${sensorTemp}°C.`;
      } else {
        aiDecision = 'OPEN_CANOPY';
        aiRecommendationText = `All clear across 10km perimeter and extended 100km radar (${aggregateRainProbability}% risk). Optimal solar drying.`;
      }
    }
  }

  return {
    timestamp: Date.now(),
    centerLatitude: centerLat,
    centerLongitude: centerLon,
    radarRadiusKm,
    criticalRadiusKm,
    points,
    aggregateRainProbability,
    maxPrecipitationMm,
    rainCellsDetected,
    totalScanPoints: points.length,
    nearestRainDistanceKm,
    nearestRainDirection,
    nearestRainPlaceName,
    rainIn10kmCount,
    is10kmPerimeterClear,
    stormMovingTowardsFarm: rainIn10kmCount > 0,
    estimatedArrivalMinutes: nearestRainDistanceKm !== null ? Math.max(10, Math.round((nearestRainDistanceKm / 35) * 60)) : null,
    conflictState,
    aiDecision,
    aiRecommendationText,
    spatialMetrics,
  };
}

