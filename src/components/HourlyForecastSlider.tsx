import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  CloudRain,
  Sun,
  CloudSun,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
} from 'lucide-react';
import { WeatherForecastResponse, SensorTelemetry } from '../types';

interface HourlyForecastSliderProps {
  weatherData: WeatherForecastResponse | null;
  telemetry?: SensorTelemetry | null;
}

export const HourlyForecastSlider: React.FC<HourlyForecastSliderProps> = ({
  weatherData,
  telemetry,
}) => {
  const [selectedDayTab, setSelectedDayTab] = useState<'YESTERDAY' | '24H' | 'TOMORROW' | 'DAY_AFTER'>('24H');
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);

  const times = weatherData?.hourly?.time || [];
  const temps = weatherData?.hourly?.temperature_2m || [];
  const rainProbs = weatherData?.hourly?.precipitation_probability || [];
  const codes = weatherData?.hourly?.weather_code || [];

  const precips = weatherData?.hourly?.precipitation || [];

  // Determine current hour index based on weatherData.current.time first, then fallback
  const currentHourIndex = useMemo(() => {
    if (times.length === 0) return -1;
    if (weatherData?.current?.time) {
      const curTarget = String(weatherData.current.time).substring(0, 13);
      const mIdx = times.findIndex((t) => t.startsWith(curTarget));
      if (mIdx !== -1) return mIdx;
    }
    const nowIso = new Date().toISOString().substring(0, 13); // 'YYYY-MM-DDTHH'
    const matchIdx = times.findIndex((t) => t.startsWith(nowIso));
    if (matchIdx !== -1) return matchIdx;

    // If past_days=1 was supplied, current day usually starts around index 24
    if (times.length >= 72) {
      const currentHour = new Date().getHours();
      return Math.min(times.length - 1, 24 + currentHour);
    }
    return new Date().getHours();
  }, [times, weatherData?.current?.time]);

  // Auto-center the highlighted current hour card in viewport
  useEffect(() => {
    if (times.length === 0) return;
    if (selectedDayTab === '24H' && currentCardRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = currentCardRef.current;
      const containerCenter = container.clientWidth / 2;
      const elementCenter = element.offsetLeft + element.clientWidth / 2;
      container.scrollTo({
        left: elementCenter - containerCenter,
        behavior: 'smooth',
      });
    }
  }, [selectedDayTab, currentHourIndex, times.length]);

  if (times.length === 0) {
    return null;
  }

  // Calculate slice range according to selected tab
  let startIndex = 0;
  let endIndex = 24;

  const hasPastDays = times.length > 72; // with past_days=1, total hours is 96 (24 yesterday + 72 forecast)

  if (hasPastDays) {
    if (selectedDayTab === 'YESTERDAY') {
      startIndex = 0;
      endIndex = 24;
    } else if (selectedDayTab === '24H') {
      // Center the current hour in the 24-hour viewport (12h before, 12h after)
      const targetCenter = currentHourIndex >= 0 ? currentHourIndex : 24;
      startIndex = Math.max(0, Math.min(times.length - 24, targetCenter - 12));
      endIndex = Math.min(times.length, startIndex + 24);
    } else if (selectedDayTab === 'TOMORROW') {
      startIndex = 48;
      endIndex = 72;
    } else if (selectedDayTab === 'DAY_AFTER') {
      startIndex = 72;
      endIndex = 96;
    }
  } else {
    // Normal 72h forecast without past_days
    if (selectedDayTab === 'YESTERDAY') {
      startIndex = 0;
      endIndex = Math.min(24, times.length);
    } else if (selectedDayTab === '24H') {
      // Center current hour in viewport
      const targetCenter = currentHourIndex >= 0 ? currentHourIndex : 0;
      startIndex = Math.max(0, Math.min(times.length - 24, targetCenter - 12));
      endIndex = Math.min(times.length, startIndex + 24);
    } else if (selectedDayTab === 'TOMORROW') {
      startIndex = 24;
      endIndex = Math.min(48, times.length);
    } else if (selectedDayTab === 'DAY_AFTER') {
      startIndex = 48;
      endIndex = Math.min(72, times.length);
    }
  }

  const slicedHours = times.slice(startIndex, Math.min(endIndex, times.length));

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const isGroundSunDry = Boolean(
    telemetry &&
    !telemetry.rain &&
    (telemetry.rain_analog === null || telemetry.rain_analog >= 2800) &&
    typeof telemetry.light === 'number' &&
    telemetry.light < 2600
  );

  const getWeatherIcon = (code: number, rainProb: number, precipMm: number, isCurrent: boolean) => {
    const iconClass = isCurrent ? 'w-5 h-5' : 'w-4 h-4';

    // Ground truth overrides for current hour:
    if (isCurrent && isGroundSunDry) {
      return <Sun className={`${iconClass} text-amber-400`} />;
    }

    // Heavy / Real Rain: requires actual rain mm >= 0.4 OR rain probability >= 60% with measurable precip
    if (precipMm >= 0.4 || (rainProb >= 60 && precipMm >= 0.1) || rainProb >= 75) {
      return <CloudRain className={`${iconClass} text-rose-400 animate-bounce`} />;
    }

    // Light drizzle / showers: requires probability >= 40% with measurable precip
    if ((code >= 51 && code <= 82) && (rainProb >= 40 || precipMm >= 0.2)) {
      return <CloudRain className={`${iconClass} text-sky-400`} />;
    }

    // Mostly Sunny / Clear
    if (code <= 1 && rainProb <= 25) {
      return <Sun className={`${iconClass} text-amber-400`} />;
    }

    // Partly Cloudy
    if (code <= 3 || rainProb <= 35) {
      return <CloudSun className={`${iconClass} text-amber-300`} />;
    }

    // Overcast
    return <Cloud className={`${iconClass} text-slate-300`} />;
  };

  const formatHour = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 shadow-md w-full">
      {/* Header with Title & Day Tabs (NO location name repeated here!) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white shrink-0">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>Hourly Forecast</span>
        </div>

        {/* Compact Day Tabs with Yesterday Added */}
        <div className="flex items-center bg-slate-950/90 p-0.5 rounded-lg border border-slate-800 text-[10px] shrink-0">
          <button
            onClick={() => setSelectedDayTab('YESTERDAY')}
            className={`px-1.5 sm:px-2 py-0.5 font-bold rounded transition-colors flex items-center gap-0.5 cursor-pointer ${
              selectedDayTab === 'YESTERDAY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Check yesterday's hourly weather history"
          >
            <History className="w-2.5 h-2.5" />
            <span>Yday</span>
          </button>
          <button
            onClick={() => setSelectedDayTab('24H')}
            className={`px-1.5 sm:px-2 py-0.5 font-bold rounded transition-colors cursor-pointer ${
              selectedDayTab === '24H'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setSelectedDayTab('TOMORROW')}
            className={`px-1.5 sm:px-2 py-0.5 font-bold rounded transition-colors cursor-pointer ${
              selectedDayTab === 'TOMORROW'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tmrw
          </button>
          <button
            onClick={() => setSelectedDayTab('DAY_AFTER')}
            className={`px-1.5 sm:px-2 py-0.5 font-bold rounded transition-colors cursor-pointer ${
              selectedDayTab === 'DAY_AFTER'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Day+2
          </button>
        </div>
      </div>

      {/* Horizontal Swipeable Timeline */}
      <div className="relative flex items-center">
        <button
          onClick={() => scroll('left')}
          className="hidden sm:flex absolute -left-2.5 z-10 p-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer shadow-md"
          title="Scroll Left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 w-full scroll-smooth"
        >
          {slicedHours.map((isoTime, idx) => {
            const actualIndex = startIndex + idx;
            const isCurrent = actualIndex === currentHourIndex;
            const rainP = rainProbs[actualIndex] ?? 0;
            const precipMm = precips[actualIndex] ?? 0;
            const temp = temps[actualIndex] ?? 0;
            const code = codes[actualIndex] ?? 0;
            const isHighRain = precipMm >= 0.5 || (rainP >= 65 && precipMm > 0.1);

            return (
              <div
                key={isoTime}
                ref={isCurrent ? currentCardRef : null}
                className={`shrink-0 w-[62px] sm:w-[70px] p-2 rounded-xl border text-center flex flex-col items-center justify-between gap-1 select-none transition-all shadow-xs ${
                  isCurrent
                    ? 'bg-sky-950/90 border-2 border-sky-400 text-white shadow-md shadow-sky-950/60 scale-105 z-10 ring-1 ring-sky-400/40'
                    : 'bg-slate-900/90 border-slate-700/90 hover:border-slate-500 text-slate-100'
                }`}
              >
                {/* Time Label & Current Highlight Tag */}
                <div className="flex flex-col items-center">
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold tracking-tight ${
                      isCurrent ? 'text-sky-300 uppercase font-black' : 'text-slate-200'
                    }`}
                  >
                    {isCurrent ? 'NOW' : formatHour(isoTime)}
                  </span>
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping mt-0.5" />
                  )}
                </div>

                {/* Weather Icon */}
                <div className="my-0.5">{getWeatherIcon(code, rainP, precipMm, isCurrent)}</div>

                {/* Temperature */}
                <span
                  className={`text-xs sm:text-sm font-black ${
                    isCurrent ? 'text-white' : 'text-slate-100'
                  }`}
                >
                  {isCurrent && typeof telemetry?.temperature === 'number'
                    ? `${telemetry.temperature.toFixed(0)}°`
                    : `${temp.toFixed(0)}°`}
                </span>

                {/* Rain Probability & Precip Depth Pill */}
                <div className="w-full">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md block w-full truncate border ${
                      isCurrent && isGroundSunDry
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : isHighRain
                        ? 'bg-rose-500/90 border-rose-400 text-white font-extrabold shadow-xs'
                        : precipMm >= 0.3 && rainP >= 35
                        ? 'bg-amber-500/30 border-amber-500/50 text-amber-200'
                        : rainP > 30
                        ? 'bg-sky-500/20 border-sky-500/40 text-sky-200'
                        : 'bg-slate-800/90 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isCurrent && isGroundSunDry
                      ? '0.0mm'
                      : precipMm >= 0.3 && rainP >= 35
                      ? `${precipMm.toFixed(1)}mm`
                      : `${rainP}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => scroll('right')}
          className="hidden sm:flex absolute -right-2.5 z-10 p-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer shadow-md"
          title="Scroll Right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
