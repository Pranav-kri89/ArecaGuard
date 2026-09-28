import React, { useState, useRef } from 'react';
import {
  MapPin,
  Search,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudRain,
  Droplets,
  Thermometer,
  Cpu,
  Satellite,
  ShieldCheck,
  ShieldAlert,
  Code,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { LocationItem, WeatherForecastResponse, SensorTelemetry, CanopyMode, DecisionMode } from '../types';
import { POPULAR_LOCATIONS, getWeatherCondition } from '../utils/locations';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface FarmComparisonBoardProps {
  selectedLocation: LocationItem;
  onSelectLocation: (loc: LocationItem) => void;
  weather: WeatherForecastResponse | null;
  isLoadingWeather: boolean;
  isNightCalculated: boolean;
  telemetry: SensorTelemetry | null;
  isSensorOnline: boolean;
  packetCount: number;
  lastSeenSeconds: number | null;
  canopyMode: CanopyMode;
  decisionMode: DecisionMode;
  onOpenCodeModal: () => void;
}

export const FarmComparisonBoard: React.FC<FarmComparisonBoardProps> = ({
  selectedLocation,
  onSelectLocation,
  weather,
  isLoadingWeather,
  isNightCalculated,
  telemetry,
  isSensorOnline,
  packetCount,
  canopyMode,
  decisionMode,
  onOpenCodeModal,
}) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const quickPillsRef = useRef<HTMLDivElement>(null);

  // Satellite metrics
  const googleAnalysis = getGoogleRainAnalysis(weather);
  const isRainy = googleAnalysis.isRainThreat;
  const precipProb = googleAnalysis.currentPrecipProb;
  const precipRate = googleAnalysis.currentPrecipMm;
  const cloudCover = googleAnalysis.cloudCover;
  const tempSatellite = weather?.current?.temperature_2m ?? null;
  const humiditySatellite = weather?.current?.relative_humidity_2m ?? null;

  // Sensor metrics
  const isSensorConnected = Boolean(
    isSensorOnline && telemetry && (telemetry.temperature !== null || telemetry.humidity !== null)
  );
  const ldrRaw = telemetry?.light !== null && telemetry?.light !== undefined ? telemetry.light : null;
  const sunPct = ldrRaw !== null
    ? Math.max(0, Math.min(100, Math.round(((4095 - ldrRaw) / 4095) * 100)))
    : null;
  const isRainDetected = Boolean(
    telemetry && (telemetry.rain || telemetry.rain_digital === 0 || (telemetry.rain_analog !== null && telemetry.rain_analog < 2800))
  );

  const scrollPills = (dir: 'left' | 'right') => {
    if (quickPillsRef.current) {
      quickPillsRef.current.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
    }
  };

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search-location?q=${encodeURIComponent(val.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3 max-w-2xl mx-auto w-full">
      {/* 1. Location Bar & Quick Villages */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-bold text-white truncate">{selectedLocation.name}</span>
            <span className="text-[10px] text-slate-500 font-mono">({selectedLocation.region})</span>
          </div>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Search className="w-3 h-3" />
            <span>{isSearchOpen ? 'Close' : 'Search'}</span>
          </button>
        </div>

        {/* Optional Search Input */}
        {isSearchOpen && (
          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search taluk or village..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-30 max-h-40 overflow-y-auto">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id || `${loc.latitude}-${loc.longitude}`}
                    onClick={() => {
                      onSelectLocation(loc);
                      setIsSearchOpen(false);
                      setSearch('');
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 text-white flex items-center justify-between border-b border-slate-800"
                  >
                    <span>{loc.name}, {loc.region}</span>
                    <MapPin className="w-3 h-3 text-sky-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scrollable Quick Taluk Pills */}
        <div className="relative flex items-center">
          <button
            onClick={() => scrollPills('left')}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white mr-1 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <div
            ref={quickPillsRef}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 scroll-smooth"
          >
            {POPULAR_LOCATIONS.map((loc) => {
              const isSelected = selectedLocation.name === loc.name;
              return (
                <button
                  key={loc.name}
                  onClick={() => onSelectLocation(loc)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {loc.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollPills('right')}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white ml-1 cursor-pointer shrink-0"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Side-by-Side Comparison Matrix */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-md space-y-2.5">
        {/* Dual Stream Header Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Left Column: Satellite */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-sky-500/20 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <Satellite className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Radar</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Open-Meteo</span>
              <span className="text-sky-300 bg-sky-950/80 border border-sky-500/30 px-1.5 py-0.2 rounded font-semibold">
                Synced
              </span>
            </div>
          </div>

          {/* Right Column: Physical Sensor */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              !isSensorConnected
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">ESP32</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Bed Sensors</span>
              <span
                className={`px-1.5 py-0.2 rounded font-bold ${
                  !isSensorConnected
                    ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                }`}
              >
                {!isSensorConnected ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Rows */}
        <div className="space-y-1.5">
          {/* Row 1: Rain Detection */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="pr-2 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 block">Rain Likelihood</span>
              <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                <CloudRain className="w-3 h-3 text-sky-400 shrink-0" />
                <span>{precipProb}%</span>
                {precipRate > 0 && <span className="text-[10px] text-slate-400">({precipRate}mm)</span>}
              </div>
            </div>

            <div className="pl-1">
              <span className="text-[10px] text-slate-400 block">Moisture Plate</span>
              <div className="mt-0.5">
                {!isSensorConnected ? (
                  <span className="text-rose-400 font-bold text-[11px]">No signal (Offline)</span>
                ) : isRainDetected ? (
                  <span className="text-rose-400 font-bold text-[11px]">Water detected</span>
                ) : (
                  <span className="text-emerald-400 font-bold text-[11px]">Dry surface</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Temperature */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="pr-2 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 block">Ambient Temp</span>
              <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{tempSatellite !== null ? `${tempSatellite.toFixed(1)}°C` : '--'}</span>
              </div>
            </div>

            <div className="pl-1">
              <span className="text-[10px] text-slate-400 block">Bed Temp</span>
              <div className="mt-0.5">
                {!isSensorConnected ? (
                  <span className="text-rose-400 font-bold text-[11px]">--°C</span>
                ) : (
                  <span className="text-white font-bold text-[11px]">{telemetry?.temperature?.toFixed(1) ?? '--'}°C</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Humidity */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="pr-2 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 block">Air Humidity</span>
              <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
                <span>{humiditySatellite !== null ? `${humiditySatellite}% RH` : '--'}</span>
              </div>
            </div>

            <div className="pl-1">
              <span className="text-[10px] text-slate-400 block">Bed Humidity</span>
              <div className="mt-0.5">
                {!isSensorConnected ? (
                  <span className="text-rose-400 font-bold text-[11px]">--%</span>
                ) : (
                  <span className="text-white font-bold text-[11px]">{telemetry?.humidity?.toFixed(0) ?? '--'}% RH</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Sunlight */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="pr-2 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 block">Satellite Sky Condition</span>
              <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                {isNightCalculated ? (
                  <>
                    <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>Night ({cloudCover}% clouds)</span>
                  </>
                ) : cloudCover >= 50 ? (
                  <>
                    <Cloud className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>{cloudCover}% Cloudy Sky</span>
                  </>
                ) : cloudCover >= 20 ? (
                  <>
                    <CloudSun className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Partly Sunny ({cloudCover}% clouds)</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Full Sun ({100 - cloudCover}%)</span>
                  </>
                )}
              </div>
            </div>

            <div className="pl-1">
              <span className="text-[10px] text-slate-400 block">Solar Lux (LDR)</span>
              <div className="mt-0.5">
                {!isSensorConnected ? (
                  <span className="text-rose-400 font-bold text-[11px]">--%</span>
                ) : isNightCalculated && sunPct !== null && sunPct < 30 ? (
                  <span className="text-indigo-300 font-bold text-[11px]">{sunPct}% (Night)</span>
                ) : (
                  <span className="text-white font-bold text-[11px]">{sunPct !== null ? `${sunPct}% sun` : '--%'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Action Consensus Pill */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            {canopyMode === 'CLOSED' ? (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="text-slate-300 font-medium">
              Decision: <strong className={canopyMode === 'CLOSED' ? 'text-rose-400' : 'text-emerald-400'}>ROOF {canopyMode}</strong>
            </span>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">Mode: {decisionMode}</span>
        </div>

        {/* Failsafe Notice if Sensor Disconnected */}
        {!isSensorConnected && (
          <div className="mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-rose-200 text-[11px]">Sensors offline. Failsafe protection active.</span>
            </div>
            <button
              onClick={onOpenCodeModal}
              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Code className="w-3 h-3" />
              <span>ESP Code</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
