import React, { useState, useEffect } from 'react';
import {
  Sun,
  CloudRain,
  Cloud,
  Cpu,
  Globe,
  Sparkles,
  Moon,
  CloudSun,
  Droplets,
  Thermometer,
  Wind,
  Zap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import {
  SensorTelemetry,
  WeatherForecastResponse,
  DecisionMode,
  CanopyMode,
  AIPredictionResult,
  RoofPersistentState,
  SingleSourceSystemState,
} from '../types';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface AiCenterScenarioOrbProps {
  sensorData: SensorTelemetry | null;
  weatherData: WeatherForecastResponse | null;
  decisionMode: DecisionMode;
  canopyMode: CanopyMode;
  isSensorOnline: boolean;
  onRefresh?: () => void;
  onOpenSensorDetails: () => void;
  onOpenInternetDetails: () => void;
  lastSeenSeconds?: number | null;
  locationName?: string;
  language?: 'en' | 'kn';
  onExecuteCanopyCommand?: (cmd: 'OPEN' | 'CLOSED' | 'AUTO') => void;
  prediction?: AIPredictionResult | null;
  roofState?: RoofPersistentState | null;
  systemState?: SingleSourceSystemState | null;
}

export const AiCenterScenarioOrb: React.FC<AiCenterScenarioOrbProps> = ({
  sensorData,
  weatherData,
  decisionMode,
  canopyMode,
  isSensorOnline,
  onRefresh,
  onOpenSensorDetails,
  onOpenInternetDetails,
  lastSeenSeconds,
  locationName: _locationName,
  language = 'en',
  prediction,
  roofState,
  systemState,
}) => {

  const [sensorSecondsAgo, setSensorSecondsAgo] = useState<number>(lastSeenSeconds ?? 0);
  const [internetSecondsAgo, setInternetSecondsAgo] = useState<number>(0);

  // Rain indicators from sensor
  const isRainSensor = Boolean(
    sensorData &&
      sensorData.rain_connected &&
      (sensorData.rain ||
        sensorData.rain_digital === 0 ||
        (sensorData.rain_analog !== null && sensorData.rain_analog < 2800))
  );

  // Internet weather indicators via strict agricultural weather analyzer with ground truth
  const googleAnalysis = getGoogleRainAnalysis(weatherData, sensorData);

  // Rain scenario determination
  const isRainScenario = isRainSensor || googleAnalysis.isRainThreat;

  // Night scenario: Respect active decisionMode and hardware LDR
  const rawLdr = sensorData?.light !== null && sensorData?.light !== undefined ? sensorData.light : null;
  const isSensorNight = rawLdr !== null ? rawLdr > 3000 : false;
  const isInternetNight = weatherData?.current ? weatherData.current.is_day === 0 : false;
  const isNight = decisionMode === 'SENSOR_ONLY'
    ? isSensorNight
    : decisionMode === 'INTERNET_ONLY'
    ? isInternetNight
    : (rawLdr !== null && rawLdr < 2000 ? false : (isSensorNight || isInternetNight));

  // Cloud scenario: Daytime, no rain threat, and cloud cover >= 50%
  const isCloudScenario = !isRainScenario && !isNight && googleAnalysis.cloudCover >= 50;

  // Partly cloudy: Daytime, no rain threat, and cloud cover between 20% and 49%
  const isPartlyCloudScenario = !isRainScenario && !isNight && googleAnalysis.cloudCover >= 20 && googleAnalysis.cloudCover < 50;

  // Second tickers
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorSecondsAgo((prev) => prev + 1);
      setInternetSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sensorData?.timestamp) {
      setSensorSecondsAgo(0);
    }
  }, [sensorData?.timestamp]);

  useEffect(() => {
    if (weatherData?.current?.temperature_2m !== undefined) {
      setInternetSecondsAgo(0);
    }
  }, [weatherData?.current?.temperature_2m, weatherData?.current?.precipitation]);

  // Weather scenario theme configuration
  let activeTheme;

  if (canopyMode === 'OPEN') {
    activeTheme = {
      border: 'border-emerald-500',
      ringColor: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
      bg: 'from-emerald-950/80 via-slate-900 to-slate-950',
      textColor: 'text-emerald-400',
      title: 'Solar Drying (Manual)',
      sub: isRainScenario ? 'Rain threat overridden • Held open' : 'Operator open • Drying active',
      icon: <Sun className="w-6 h-6 sm:w-10 sm:h-10 text-amber-400 animate-spin-slow" />,
    };
  } else if (canopyMode === 'CLOSED') {
    activeTheme = {
      border: 'border-rose-500',
      ringColor: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.4)',
      bg: 'from-rose-950 via-slate-900 to-slate-950',
      textColor: 'text-rose-400',
      title: 'Canopy Closed',
      sub: 'Operator forced close • Crop sealed',
      icon: <CloudRain className="w-6 h-6 sm:w-10 sm:h-10 text-rose-400" />,
    };
  } else if (isRainScenario) {
    activeTheme = {
      border: 'border-rose-500',
      ringColor: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.45)',
      bg: 'from-rose-950 via-slate-900 to-slate-950',
      textColor: 'text-rose-400',
      title: isRainSensor ? 'Rain on Bed' : 'Rain Threat',
      sub: isRainSensor
        ? 'Sensor wet • Canopy closed'
        : `${googleAnalysis.calibratedRisk}% risk • Canopy closed`,
      icon: <CloudRain className="w-6 h-6 sm:w-10 sm:h-10 text-rose-400 animate-bounce" />,
    };
  } else if (isNight) {
    activeTheme = {
      border: 'border-indigo-500/80',
      ringColor: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.35)',
      bg: 'from-indigo-950/80 via-slate-900 to-slate-950',
      textColor: 'text-indigo-300',
      title: 'Night Shield',
      sub: 'Night dew protection • Closed',
      icon: <Moon className="w-6 h-6 sm:w-10 sm:h-10 text-indigo-300" />,
    };
  } else if (isCloudScenario) {
    activeTheme = {
      border: 'border-amber-500/80',
      ringColor: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.35)',
      bg: 'from-amber-950/80 via-slate-900 to-slate-950',
      textColor: 'text-amber-400',
      title: 'Cloudy Sky',
      sub: `${googleAnalysis.cloudCover}% clouds • Safe dry`,
      icon: <Cloud className="w-6 h-6 sm:w-10 sm:h-10 text-amber-300 animate-pulse" />,
    };
  } else if (isPartlyCloudScenario) {
    activeTheme = {
      border: 'border-amber-400/80',
      ringColor: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.35)',
      bg: 'from-amber-950/60 via-slate-900 to-slate-950',
      textColor: 'text-amber-300',
      title: 'Solar Drying',
      sub: 'Partly sunny • Drying active',
      icon: <CloudSun className="w-6 h-6 sm:w-10 sm:h-10 text-amber-300 animate-pulse" />,
    };
  } else {
    // Optimal Daytime Sun
    activeTheme = {
      border: 'border-amber-500',
      ringColor: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
      bg: 'from-amber-950/70 via-slate-900 to-slate-950',
      textColor: 'text-amber-400',
      title: 'Optimal Sun',
      sub: 'Clear sky • Solar drying open',
      icon: <Sun className="w-6 h-6 sm:w-10 sm:h-10 text-amber-400 animate-spin-slow" />,
    };
  }

  // Physical Position & Motion
  const physicalPos = roofState?.physicalRoofPosition ?? (canopyMode === 'CLOSED' ? 'CLOSED' : 'OPEN');
  const isMoving = Boolean(roofState?.activeMotorRotation && roofState.activeMotorRotation !== 'IDLE');
  const isRoofOpen = physicalPos === 'OPEN' || (!roofState && canopyMode === 'OPEN');

  // Rain & Weather Chances
  const isRainOnSensor = Boolean(
    sensorData &&
      sensorData.rain_connected &&
      (sensorData.rain ||
        sensorData.rain_digital === 0 ||
        (sensorData.rain_analog !== null && sensorData.rain_analog < 2800))
  );
  const isRainThreatInternet = googleAnalysis.isRainThreat;
  const rainChancePercent = Math.max(
    prediction?.rainProbabilityNextHour ?? 0,
    googleAnalysis.calibratedRisk,
    googleAnalysis.currentPrecipProb
  );

  // Solar Drying Condition
  let dryingConditionText = 'Optimal Drying';
  let dryingConditionColor = 'text-emerald-400';
  if (isRainScenario) {
    dryingConditionText = 'Suspended (Rain)';
    dryingConditionColor = 'text-rose-400';
  } else if (isNight) {
    dryingConditionText = 'Night Dew Protection';
    dryingConditionColor = 'text-indigo-400';
  } else if (googleAnalysis.cloudCover >= 70) {
    dryingConditionText = 'Slow (Heavy Clouds)';
    dryingConditionColor = 'text-amber-400';
  } else if (googleAnalysis.cloudCover >= 40) {
    dryingConditionText = 'Moderate (Partly Sunny)';
    dryingConditionColor = 'text-sky-300';
  }

  // Detailed "Why Tarpal is Closed or Open" explanation
  let reasonTitle = '';
  let reasonExplanation = '';
  let reasonTheme = {
    bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
    tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  if (isMoving) {
    const direction = roofState?.activeMotorRotation === 'CLOSING' ? 'closing' : 'opening';
    reasonTitle = language === 'kn' ? 'ಟರ್ಪಾಲ್ ಚಲನೆಯಲ್ಲಿದೆ' : `Tarpal is ${direction === 'closing' ? 'Closing' : 'Opening'}`;
    reasonExplanation =
      language === 'kn'
        ? `ಮೋಟಾರು ಪ್ರಸ್ತುತ ಟರ್ಪಾಲ್ ಅನ್ನು ${direction === 'closing' ? 'ಮುಚ್ಚುತ್ತಿದೆ' : 'ತೆರೆಯುತ್ತಿದೆ'} (${roofState?.activeRemainingSeconds ?? 0} ಸೆಕೆಂಡುಗಳು ಬಾಕಿ ಉಳಿದಿವೆ).`
        : `Motor is actively ${direction} the tarpal (${roofState?.activeRemainingSeconds ?? 0}s remaining).`;
    reasonTheme = {
      bg: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
      iconBg: 'bg-amber-500/20 text-amber-400',
      tag: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
  } else if (isRoofOpen) {
    reasonTitle = language === 'kn' ? 'ಟರ್ಪಾಲ್ ಏಕೆ ತೆರೆದಿದೆ:' : 'Why the tarpal is OPEN:';
    if (canopyMode === 'OPEN' && (isRainOnSensor || isRainThreatInternet)) {
      reasonExplanation =
        language === 'kn'
          ? `ಮಳೆಯ ಸಾಧ್ಯತೆ (${rainChancePercent}%) ಇದ್ದರೂ ಆಪರೇಟರ್ ಮ್ಯಾನ್ಯುವಲ್ ಕಮಾಂಡ್ ಮೂಲಕ ಟರ್ಪಾಲ್ ತೆರೆಯಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಗಮನಿಸಿ.`
          : `Tarpal is held OPEN under manual operator override despite a ${rainChancePercent}% rain threat. Monitor weather closely.`;
      reasonTheme = {
        bg: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
        iconBg: 'bg-amber-500/20 text-amber-400',
        tag: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      };
    } else {
      reasonExplanation =
        language === 'kn'
          ? `ಹಾಸಿನ ಸಂವೇದಕದಲ್ಲಿ ತೇವಾಂಶವಿಲ್ಲ (0% ಮಳೆ) ಮತ್ತು ಸ್ಪಷ್ಟ ಆಕಾಶವಿದೆ (ಕೇವಲ ${rainChancePercent}% ಮಳೆ ಸಾಧ್ಯತೆ). ಅಡಿಕೆ ಬೇಗ ಒಣಗಲು ಟರ್ಪಾಲ್ ತೆರೆಯಲಾಗಿದೆ.`
          : `Bed sensors confirm 0% moisture and weather radar indicates clear skies with low rain chance (${rainChancePercent}%). Tarpal is open for maximum solar radiation and rapid arecanut moisture loss.`;
      reasonTheme = {
        bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200',
        iconBg: 'bg-emerald-500/20 text-emerald-400',
        tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      };
    }
  } else {
    // Roof is Closed
    reasonTitle = language === 'kn' ? 'ಟರ್ಪಾಲ್ ಏಕೆ ಮುಚ್ಚಿದೆ:' : 'Why the tarpal is CLOSED:';
    if (isRainOnSensor) {
      reasonExplanation =
        language === 'kn'
          ? `ಹಾಸಿನ ರೈನ್ ಸೆನ್ಸಾರ್‌ನಲ್ಲಿ ತೇವಾಂಶ ಪತ್ತೆಯಾಗಿದೆ. ಅಡಿಕೆ ನೆನೆಯದಂತೆ ಮತ್ತು ಶಿಲೀಂಧ್ರ ಬರದಂತೆ ತಕ್ಷಣ ಟರ್ಪಾಲ್ ಮುಚ್ಚಲಾಗಿದೆ.`
          : `Physical raindrops detected directly on the drying bed sensor. Tarpal was immediately sealed to protect the harvested arecanuts from moisture damage and mold.`;
      reasonTheme = {
        bg: 'bg-rose-950/50 border-rose-500/60 text-rose-200',
        iconBg: 'bg-rose-500/20 text-rose-400',
        tag: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      };
    } else if (isRainThreatInternet) {
      reasonExplanation =
        language === 'kn'
          ? `30ಕಿಮೀ ವ್ಯಾಪ್ತಿಯ ರೇಡಾರ್ ಮತ್ತು ಉಪಗ್ರಹದಲ್ಲಿ ಮಳೆ ಮೋಡಗಳು (${rainChancePercent}% ಅಪಾಯ) ಪತ್ತೆಯಾಗಿವೆ. ಮುನ್ನೆಚ್ಚರಿಕೆಯಾಗಿ ಟರ್ಪಾಲ್ ಮುಚ್ಚಲಾಗಿದೆ.`
          : `Weather radar detected an approaching rain front (${rainChancePercent}% probability). Tarpal is closed preemptively to keep the drying crop completely dry before precipitation begins.`;
      reasonTheme = {
        bg: 'bg-rose-950/50 border-rose-500/60 text-rose-200',
        iconBg: 'bg-rose-500/20 text-rose-400',
        tag: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      };
    } else if (isNight) {
      reasonExplanation =
        language === 'kn'
          ? `ಸೂರ್ಯ ಮುಳುಗಿದೆ. ರಾತ್ರಿಯ ಶೀತ, ಮಂಜು ಮತ್ತು ತೇವಾಂಶವು ಒಣಗಿದ ಅಡಿಕೆಗೆ ಸೇರದಂತೆ ಟರ್ಪಾಲ್ ಮುಚ್ಚಿ ರಕ್ಷಿಸಲಾಗಿದೆ.`
          : `Night storage active: Tarpal is closed to shield crops from nocturnal dewfall, fog condensation, and night temperature drop.`;
      reasonTheme = {
        bg: 'bg-indigo-950/50 border-indigo-500/60 text-indigo-200',
        iconBg: 'bg-indigo-500/20 text-indigo-400',
        tag: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      };
    } else if (canopyMode === 'CLOSED') {
      reasonExplanation =
        language === 'kn'
          ? `ಆಪರೇಟರ್ ಮ್ಯಾನ್ಯುವಲ್ ಕಮಾಂಡ್ ಮೂಲಕ ಟರ್ಪಾಲ್ ಮುಚ್ಚಲಾಗಿದೆ. ಸಿಸ್ಟಮ್ ಮುಚ್ಚಿದ ಸ್ಥಿತಿಯಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿದೆ.`
          : `Tarpal was closed by manual operator command. The drying yard is securely protected.`;
      reasonTheme = {
        bg: 'bg-slate-900/90 border-slate-700/80 text-slate-200',
        iconBg: 'bg-slate-800 text-slate-300',
        tag: 'bg-slate-800 text-slate-300 border-slate-700',
      };
    } else {
      reasonExplanation =
        language === 'kn'
          ? `ಹೆಚ್ಚಿದ ತೇವಾಂಶ ಮತ್ತು ಮೋಡ ಕವಿದ ವಾತಾವರಣದಿಂದ ಅಡಿಕೆಯನ್ನು ರಕ್ಷಿಸಲು ಟರ್ಪಾಲ್ ಮುಚ್ಚಲಾಗಿದೆ.`
          : `Tarpal is closed to shield the harvest against high humidity and low solar intensity.`;
      reasonTheme = {
        bg: 'bg-slate-900/90 border-slate-700/80 text-slate-200',
        iconBg: 'bg-slate-800 text-slate-300',
        tag: 'bg-slate-800 text-slate-300 border-slate-700',
      };
    }
  }

  // Unified single source of truth override from server predictionEngine
  if (systemState && canopyMode === 'AUTO') {
    if (systemState.motor.hasFault) {
      reasonTitle = language === 'kn' ? 'ಮೋಟಾರ್ ದೋಷ:' : 'Motor Safety Fault:';
      reasonExplanation = systemState.motor.faultMessage || 'Motor safety cutoff triggered.';
      reasonTheme = {
        bg: 'bg-rose-950/60 border-rose-500/80 text-rose-200',
        iconBg: 'bg-rose-500/30 text-rose-300',
        tag: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    } else if (
      systemState.system_mode === 'SAFE_CLOSED' ||
      systemState.system_mode === 'SENSOR_FAULT' ||
      systemState.system_mode === 'WEATHER_API_FAULT' ||
      systemState.system_mode === 'MOTOR_FAULT'
    ) {
      reasonTitle = language === 'kn' ? 'ಫೇಲ್‌ಸೇಫ್ ರಕ್ಷಣೆ:' : 'Failsafe Protection:';

      reasonExplanation = systemState.system_mode_reason || 'Sensor offline or weather missing. Tarpal secured CLOSED.';
      reasonTheme = {
        bg: 'bg-amber-950/60 border-amber-500/80 text-amber-200',
        iconBg: 'bg-amber-500/30 text-amber-300',
        tag: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    } else if (systemState.tarpaulin.lastDecisionReason) {
      reasonExplanation = systemState.tarpaulin.lastDecisionReason;
    }
  }

  return (

    <div className="w-full flex flex-col items-center justify-center select-none py-1 overflow-hidden">
      {/* Trio Formation: Responsive layout, strict zero overflow on all mobile screens */}
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg flex items-center justify-between px-1 sm:px-2 gap-1 sm:gap-2">
        {/* ================= LEFT SATELLITE BUBBLE: HARDWARE SENSORS ================= */}
        <div className="flex flex-col items-center shrink-0 z-10 min-w-0">
          <button
            id="diagram-sensor-bubble-btn"
            onClick={onOpenSensorDetails}
            className={`group relative w-12 h-12 xs:w-13 xs:h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center p-0.5 sm:p-1 transition-all transform active:scale-95 cursor-pointer border-2 shadow-md ${
              isSensorOnline
                ? 'bg-gradient-to-b from-emerald-950/90 to-slate-900 border-emerald-500 shadow-emerald-900/40'
                : 'bg-gradient-to-b from-rose-950/90 to-slate-900 border-rose-500 shadow-rose-900/40'
            }`}
            title="Inspect Hardware Sensors"
          >
            {/* Live Indicator Dot */}
            <span
              className={`absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-2 h-2 rounded-full border border-slate-900 ${
                isSensorOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />

            <Cpu className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5 ${isSensorOnline ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-[8px] sm:text-[11px] font-bold text-white leading-tight truncate">
              Sensor
            </span>
            <span
              className={`text-[6.5px] sm:text-[7.5px] font-extrabold uppercase leading-none ${
                isSensorOnline ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {isSensorOnline ? 'Online' : 'Offline'}
            </span>
          </button>

          {/* Timestamp Beneath Sensor Bubble */}
          <div className="mt-1 flex flex-col items-center text-center">
            <span
              className={`text-[7px] sm:text-[8px] font-mono font-semibold px-1 py-0.2 rounded border ${
                isSensorOnline
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800/50'
                  : 'text-rose-300 bg-rose-950/80 border-rose-800/50'
              }`}
            >
              {isSensorOnline ? `${sensorSecondsAgo}s ago` : 'offline'}
            </span>
          </div>
        </div>

        {/* Animated Connector Wave: Left to Center */}
        <div className="flex-1 min-w-[6px] max-w-[28px] sm:max-w-[48px] flex items-center justify-center relative pointer-events-none shrink">
          <div className="w-full h-0.5 bg-gradient-to-r from-emerald-500 to-indigo-500" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        </div>

        {/* ================= CENTER AI ARBITER ORB ================= */}
        <div className="flex flex-col items-center shrink-0 z-20 min-w-0">
          <div className="relative flex items-center justify-center w-26 h-26 xs:w-28 xs:h-28 sm:w-36 sm:h-36">
            {/* Outer Orbit Ring */}
            <svg className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={activeTheme.ringColor}
                strokeWidth="3.5"
                strokeDasharray="70 160"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 8px ${activeTheme.glow})`,
                }}
              />
            </svg>

            {/* Ambient Scenario Glow */}
            <div
              className="absolute inset-2 rounded-full blur-xl sm:blur-2xl pointer-events-none"
              style={{ backgroundColor: activeTheme.glow }}
            />

            {/* Main Central Orb: tap to refresh */}
            <div
              onClick={() => onRefresh?.()}
              className={`absolute w-22 h-22 xs:w-25 xs:h-25 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b ${activeTheme.bg} border-2 sm:border-3 ${activeTheme.border} flex flex-col items-center justify-center p-1 sm:p-2 shadow-2xl transition-all active:scale-95 cursor-pointer group`}
              title="Tap to refresh forecast & sensor analysis"
            >
              <div className="mb-0.5 transform group-hover:scale-105 transition-transform">
                {activeTheme.icon}
              </div>
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-black text-white leading-tight tracking-tight text-center px-1 truncate max-w-full">
                {activeTheme.title}
              </span>
              <span className="text-[7px] xs:text-[8px] sm:text-[9px] text-slate-300 leading-tight mt-0.5 font-medium text-center px-1 max-w-[85px] xs:max-w-[105px] sm:max-w-[130px] truncate">
                {activeTheme.sub}
              </span>

              {/* Canopy Status Pill inside orb */}
              <div className="mt-0.5 sm:mt-1 px-1.5 py-0.2 rounded-full bg-slate-950/90 border border-slate-700/80 text-[6.5px] xs:text-[7.5px] sm:text-[8px] font-bold text-slate-300 flex items-center gap-1">
                <span>Roof:</span>
                <strong className={canopyMode === 'CLOSED' ? 'text-rose-400' : 'text-emerald-400'}>
                  {canopyMode}
                </strong>
              </div>
            </div>
          </div>

          {/* Sub-label under orb */}
          <div className="mt-1 flex items-center gap-1 text-[8px] sm:text-[9px] text-slate-400 truncate max-w-full">
            <span className="flex items-center gap-0.5 font-mono font-semibold text-slate-300">
              <Cpu className="w-2.5 h-2.5 text-sky-400" />
              <span>Dual Arbiter</span>
            </span>
            <span>&bull;</span>
            <span className="font-bold text-slate-300 uppercase">
              {decisionMode === 'SENSOR_ONLY' ? 'Sensors' : decisionMode === 'INTERNET_ONLY' ? 'Forecast' : 'Combined'}
            </span>
          </div>
        </div>

        {/* Animated Connector Wave: Center to Right */}
        <div className="flex-1 min-w-[6px] max-w-[28px] sm:max-w-[48px] flex items-center justify-center relative pointer-events-none shrink">
          <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-sky-500" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
        </div>

        {/* ================= RIGHT SATELLITE BUBBLE: GOOGLE / INTERNET ================= */}
        <div className="flex flex-col items-center shrink-0 z-10 min-w-0">
          <button
            id="diagram-google-bubble-btn"
            onClick={onOpenInternetDetails}
            className="group relative w-12 h-12 xs:w-13 xs:h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center p-0.5 sm:p-1 transition-all transform active:scale-95 cursor-pointer border-2 bg-gradient-to-b from-sky-950/90 to-slate-900 border-sky-400 shadow-md shadow-sky-950/50"
            title="Inspect Google Radar & Weather"
          >
            {/* Live Indicator Dot */}
            <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-2 h-2 rounded-full bg-sky-400 animate-pulse border border-slate-900" />

            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 mb-0.5" />
            <span className="text-[8px] sm:text-[11px] font-bold text-white leading-tight truncate">
              Google
            </span>
            <span className="text-[6.5px] sm:text-[7.5px] font-extrabold text-sky-300 uppercase leading-none">
              Internet
            </span>
          </button>

          {/* Timestamp Beneath Google Bubble */}
          <div className="mt-1 flex flex-col items-center text-center">
            <span className="text-[7px] sm:text-[8px] font-mono font-semibold px-1 py-0.2 rounded border text-sky-300 bg-sky-950/80 border-sky-800/50">
              {internetSecondsAgo === 0 ? 'live' : `${internetSecondsAgo}s ago`}
            </span>
          </div>
        </div>
      </div>

      {/* ================= FORECAST & SENSOR REASONING ================= */}
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mt-3 pt-2.5 border-t border-slate-800/80 px-1">
        <div className={`p-3 rounded-2xl border shadow-md flex flex-col gap-2.5 transition-all ${reasonTheme.bg}`}>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Activity className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                {language === 'kn' ? 'ಹವಾಮಾನ & ಸಂವೇದಕ ವಿಶ್ಲೇಷಣೆ' : 'Forecast & Sensor Reasoning'}
              </span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider border shrink-0 ${reasonTheme.tag}`}>
              {canopyMode === 'AUTO' ? 'Auto (Forecast & Sensor)' : 'Manual Mode'}
            </span>
          </div>

          {/* Dual Prediction Chances Pills */}
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            {/* Rain Chance */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <CloudRain className={`w-4 h-4 shrink-0 ${rainChancePercent > 40 ? 'text-rose-400 animate-bounce' : 'text-sky-400'}`} />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  {language === 'kn' ? 'ಮಳೆಯ ಸಾಧ್ಯತೆ' : 'Rain Chance'}
                </div>
                <div className="text-xs font-extrabold text-white">
                  {rainChancePercent}% {rainChancePercent >= 50 ? '• High' : rainChancePercent >= 25 ? '• Moderate' : '• Low'}
                </div>
              </div>
            </div>

            {/* Drying Potential */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  {language === 'kn' ? 'ಒಣಗಿಸುವಿಕೆ ಸ್ಥಿತಿ' : 'Drying Status'}
                </div>
                <div className={`text-xs font-extrabold truncate ${dryingConditionColor}`}>
                  {dryingConditionText}
                </div>
              </div>
            </div>
          </div>

          {/* Why Tarpal is Closed or Open Explanation Box */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2.5">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${reasonTheme.iconBg}`}>
              {isRoofOpen ? (
                <Sun className="w-4 h-4" />
              ) : isRainScenario ? (
                <CloudRain className="w-4 h-4" />
              ) : isNight ? (
                <Moon className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>{reasonTitle}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${isRoofOpen ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'}`}>
                  {isRoofOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {reasonExplanation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
