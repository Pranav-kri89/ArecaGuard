import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Search, 
  Sun, 
  Moon,
  CloudRain, 
  CloudSun, 
  Droplets, 
  Wind, 
  Compass, 
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Calendar
} from 'lucide-react';
import { LocationItem, WeatherForecastResponse, AppLanguage } from '../types';
import { POPULAR_LOCATIONS, getWeatherCondition } from '../utils/locations';
import { translations } from '../utils/translations';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface LocationWeatherPanelProps {
  selectedLocation: LocationItem;
  onSelectLocation: (loc: LocationItem) => void;
  weather: WeatherForecastResponse | null;
  isLoading: boolean;
  isNightCalculated: boolean;
  language?: AppLanguage;
}

export const LocationWeatherPanel: React.FC<LocationWeatherPanelProps> = ({
  selectedLocation,
  onSelectLocation,
  weather,
  isLoading,
  isNightCalculated,
  language = 'en',
}) => {
  const t = translations[language] || translations.en;
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const quickPillsRef = useRef<HTMLDivElement>(null);

  // Auto-debounced micro-location search against server geocoding API
  useEffect(() => {
    if (!search || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-location?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.warn('Geocoding search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Smooth scroll pills left/right without ugly scrollbars
  const scrollPills = (direction: 'left' | 'right') => {
    if (quickPillsRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      quickPillsRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const condition = weather?.current ? getWeatherCondition(weather.current.weather_code) : null;
  const googleAnalysis = getGoogleRainAnalysis(weather);
  const isRainy = googleAnalysis.isRainThreat;
  const precipProb = googleAnalysis.currentPrecipProb;

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              {t.locationTitle}
            </h2>
            <p className="text-[11px] text-slate-400">{t.locationSubtitle}</p>
          </div>
        </div>

        {/* Day / Night Automatic Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm ${
              isNightCalculated
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60 shadow-indigo-950/40'
                : 'bg-amber-950/80 text-amber-300 border-amber-600/60 shadow-amber-950/40'
            }`}
          >
            {isNightCalculated ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.nightTime}</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                <span>{t.dayTime}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Search Field for Any Micro-Location Worldwide / Village */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            id="micro-location-search-field"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin absolute right-3 top-3" />
          )}

          {/* Autocomplete Dropdown for Micro-Locations */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-30 overflow-hidden max-h-56 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectLocation(item);
                    setSearch('');
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center justify-between text-xs border-b border-slate-800/60 transition-colors cursor-pointer"
                >
                  <div>
                    <span className="text-white font-bold block">{item.name}</span>
                    <span className="text-[10px] text-slate-400">{item.region}</span>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono">
                    {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Micro-Location Hub Carousel with Left/Right arrows (No white scrollbar!) */}
        <div className="relative flex items-center">
          <button
            onClick={() => scrollPills('left')}
            className="p-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer mr-1 shrink-0"
            title="Scroll Left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div
            ref={quickPillsRef}
            className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5"
          >
            {POPULAR_LOCATIONS.map((loc) => {
              const isSelected = loc.id === selectedLocation.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => onSelectLocation(loc)}
                  className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap font-medium transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25 ring-1 ring-sky-300'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {loc.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollPills('right')}
            className="p-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer ml-1 shrink-0"
            title="Scroll Right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Graphical Sky Card for Selected Location */}
        <div
          id="location-graphical-card"
          className={`rounded-2xl p-5 border relative overflow-hidden transition-all ${
            isNightCalculated
              ? 'bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 border-indigo-500/40'
              : isRainy
              ? 'bg-gradient-to-br from-slate-900 via-sky-950/60 to-slate-950 border-sky-500/40'
              : 'bg-gradient-to-br from-sky-950/40 via-slate-900 to-slate-950 border-sky-500/30'
          }`}
        >
          {/* Background Ambient Glow */}
          <div
            className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 ${
              isNightCalculated
                ? 'bg-indigo-600'
                : isRainy
                ? 'bg-sky-500'
                : 'bg-amber-400'
            }`}
          />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-white font-bold">{selectedLocation.name}</span>
              </div>
              <p className="text-[11px] text-slate-400">{selectedLocation.region}</p>
              <span className="text-[10px] text-slate-500 font-mono">
                Lat: {selectedLocation.latitude.toFixed(4)}° | Lon: {selectedLocation.longitude.toFixed(4)}°
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner">
              {isRainy ? (
                <CloudRain className="w-7 h-7 text-sky-400 animate-bounce" />
              ) : isNightCalculated ? (
                <Moon className="w-7 h-7 text-indigo-300" />
              ) : (
                <Sun className="w-7 h-7 text-amber-400 animate-spin-slow" />
              )}
            </div>
          </div>

          {/* Temperature & Condition */}
          {weather?.current ? (
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <div className="text-4xl font-black text-white tracking-tight">
                  {weather.current.temperature_2m.toFixed(1)}°
                  <span className="text-xl font-normal text-slate-400 ml-0.5">C</span>
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-1 flex items-center gap-1.5">
                  <span>{condition?.label || 'Clear Sky'}</span>
                </div>
              </div>

              {/* Rain Probability Pill */}
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  {t.rainProbability}
                </span>
                <span
                  className={`text-sm font-extrabold px-3 py-1 rounded-xl inline-block shadow-sm ${
                    precipProb >= 40
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {precipProb}% ({weather.current.precipitation} mm)
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>{t.fetchingSky}</span>
            </div>
          )}

          {/* 4 Graphical Gauges: Humidity, Rain mm, Wind, Cloud */}
          {weather?.current && (
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/60">
              {/* Humidity - Highlighted as requested! */}
              <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-sky-500/30">
                <div className="flex items-center justify-center gap-1 text-[10px] text-sky-300 font-semibold">
                  <Droplets className="w-3 h-3 text-sky-400" />
                  <span>{t.airHumidity}</span>
                </div>
                <div className="text-xs font-black text-white mt-0.5">
                  {weather.current.relative_humidity_2m}%
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <CloudRain className="w-3 h-3 text-indigo-400" />
                  <span>{t.rainRate}</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {weather.current.precipitation} mm
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <Wind className="w-3 h-3 text-emerald-400" />
                  <span>{t.wind}</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {weather.current.wind_speed_10m} km/h
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <CloudSun className="w-3 h-3 text-amber-400" />
                  <span>{t.clouds}</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {weather.current.cloud_cover}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6-Hour Rain Risk Timeline */}
        {weather?.hourly && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{t.sixHourRadar}</span>
              <span className="text-[10px] text-slate-400">{t.hourlyRisk}</span>
            </div>

            <div className="grid grid-cols-6 gap-1 text-center">
              {weather.hourly.time.slice(0, 6).map((t, i) => {
                const hour = new Date(t).toLocaleTimeString([], { hour: 'numeric' });
                const pop = weather.hourly.precipitation_probability[i] || 0;
                const willRain = pop >= 40;

                return (
                  <div
                    key={t}
                    className={`py-1.5 px-1 rounded-xl text-center border transition-all ${
                      willRain
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 block">{hour}</span>
                    <span className="text-xs font-bold block mt-0.5">{pop}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
