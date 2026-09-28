import React from 'react';
import { CloudRain, Sun, Zap } from 'lucide-react';
import { SensorTelemetry, WeatherForecastResponse, CanopyMode, FarmSettings } from '../types';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface AiSuggestionStripProps {
  sensorData: SensorTelemetry | null;
  weatherData: WeatherForecastResponse | null;
  canopyMode: CanopyMode;
  motorSettings?: FarmSettings;
}

export const AiSuggestionStrip: React.FC<AiSuggestionStripProps> = ({
  sensorData,
  weatherData,
  canopyMode,
  motorSettings,
}) => {
  const isSensorRain = Boolean(
    sensorData &&
      sensorData.rain_connected &&
      (sensorData.rain || sensorData.rain_digital === 0 || (sensorData.rain_analog !== null && sensorData.rain_analog < 2800))
  );

  const googleAnalysis = getGoogleRainAnalysis(weatherData);

  // Ground truth sunlight priority:
  const isGroundSunlight = Boolean(
    !isSensorRain &&
    sensorData &&
    sensorData.rain_analog !== null &&
    sensorData.rain_analog >= 2800 &&
    sensorData.light !== null &&
    sensorData.light < (motorSettings?.sunlightDayLuxAdc || 2600)
  );

  const isThreat = isSensorRain || (!isGroundSunlight && googleAnalysis.isRainThreat);

  return (
    <div className="w-full">
      <div
        className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 shadow-sm text-xs ${
          isThreat
            ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
            : isGroundSunlight
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
            : 'bg-slate-900/70 border-slate-800 text-slate-300'
        }`}
      >
        <div
          className={`p-1.5 rounded-lg shrink-0 ${
            isThreat
              ? 'bg-rose-500/20 text-rose-400'
              : isGroundSunlight
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {isThreat ? (
            <CloudRain className="w-4 h-4 animate-bounce" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </div>

        <div className="text-[11px] sm:text-xs font-medium truncate flex-1">
          {isSensorRain ? (
            <span>
              <strong className="text-rose-400 font-bold">Rain on bed:</strong> Rain sensor activated — Protect crop immediately.
            </span>
          ) : isGroundSunlight ? (
            <span>
              <strong className="text-amber-300 font-bold">Bright Sunshine Verified:</strong> Ground LDR ({sensorData?.light} ADC), 0mm rain — Optimal solar drying.
            </span>
          ) : googleAnalysis.isRainThreat ? (
            <span>
              <strong className="text-amber-300 font-bold">Rain threat:</strong> {googleAnalysis.reason}
            </span>
          ) : (
            <span>
              <strong className="text-emerald-400 font-bold">Clear sky:</strong> Solar drying conditions favorable.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
