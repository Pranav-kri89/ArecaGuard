import React from 'react';
import {
  X,
  Cpu,
  Globe,
  Wifi,
  CloudRain,
  Thermometer,
  Droplets,
  Sun,
  Shield,
  Clock,
  Radio,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { SensorTelemetry, WeatherForecastResponse, LocationItem } from '../types';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface SourceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'SENSOR' | 'INTERNET' | null;
  sensorData: SensorTelemetry | null;
  isSensorOnline: boolean;
  weatherData: WeatherForecastResponse | null;
  location: LocationItem;
  lastSeenSeconds: number | null;
  packetCount: number;
}

export const SourceDetailsModal: React.FC<SourceDetailsModalProps> = ({
  isOpen,
  onClose,
  type,
  sensorData,
  isSensorOnline,
  weatherData,
  location,
  lastSeenSeconds,
  packetCount,
}) => {
  if (!isOpen || !type) return null;

  const isSensor = type === 'SENSOR';

  // Sensor calculations
  const ldrRaw = sensorData?.light ?? 4095;
  const sunPct = Math.max(0, Math.min(100, Math.round(((4095 - ldrRaw) / 4095) * 100)));
  const isRainDetected = Boolean(
    sensorData &&
      (sensorData.rain ||
        sensorData.rain_digital === 0 ||
        (sensorData.rain_analog !== null && sensorData.rain_analog < 2800))
  );

  // Internet weather calculations
  const googleAnalysis = getGoogleRainAnalysis(weatherData);
  const precipProb = googleAnalysis.currentPrecipProb;
  const precipRate = googleAnalysis.currentPrecipMm;
  const cloudCover = googleAnalysis.cloudCover;
  const temp = weatherData?.current?.temperature_2m ?? null;
  const humidity = weatherData?.current?.relative_humidity_2m ?? null;
  const windSpeed = weatherData?.current?.wind_speed_10m ?? null;
  const surfacePressure = weatherData?.current?.surface_pressure ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-2xl ${
                isSensor
                  ? isSensorOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              }`}
            >
              {isSensor ? <Cpu className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isSensor ? 'ESP32 Physical Drying Bed Sensors' : 'Internet Satellite Radar (Google/Open-Meteo)'}
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                {isSensor
                  ? 'Real-time telemetry stream directly powering the main AI canopy decision'
                  : `Scraping real-time global weather radar for ${location.name}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar pr-1">
          {isSensor ? (
            /* =================== SENSOR DATABASE DETAILS =================== */
            <div className="space-y-3">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  isSensorOnline
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isSensorOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {isSensorOnline ? 'Active Hardware Link' : 'Hardware Disconnected'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      {isSensorOnline
                        ? `Receiving telemetry packets (${packetCount} packets logged)`
                        : 'No signal received in > 30s. Failsafe activated.'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono block opacity-70">Latency / Last Seen</span>
                  <span className="text-xs font-mono font-bold">
                    {lastSeenSeconds !== null ? `${lastSeenSeconds}s ago` : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Live Metric Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Rain Plate */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                      Rain Plate (Pin D34)
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isRainDetected ? 'bg-rose-500 text-white' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {isRainDetected ? 'WET' : 'DRY'}
                    </span>
                  </div>
                  <div className="text-base font-black text-white">
                    {sensorData?.rain_analog !== null && sensorData?.rain_analog !== undefined
                      ? `ADC ${sensorData.rain_analog}`
                      : isRainDetected
                      ? 'Rain Detected'
                      : 'Plate Clean & Dry'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Digital: {sensorData?.rain_digital ?? '--'} &bull; Analog: {sensorData?.rain_analog ?? '--'}
                  </span>
                </div>

                {/* Bed Temperature */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Bed Temp (DHT22)
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Pin D4</span>
                  </div>
                  <div className="text-base font-black text-white">
                    {sensorData?.temperature !== null && sensorData?.temperature !== undefined
                      ? `${sensorData.temperature.toFixed(1)}°C`
                      : '--'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    DHT Connected: {sensorData?.dht_connected ? 'Yes' : 'No'}
                  </span>
                </div>

                {/* Bed Humidity */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      Bed Humidity
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Microclimate</span>
                  </div>
                  <div className="text-base font-black text-white">
                    {sensorData?.humidity !== null && sensorData?.humidity !== undefined
                      ? `${sensorData.humidity.toFixed(0)}% RH`
                      : '--'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Ideal cure range: 45% - 65% RH
                  </span>
                </div>

                {/* Sunlight LDR */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      Solar Lux (LDR)
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Pin D35</span>
                  </div>
                  <div className="text-base font-black text-amber-300">
                    {sensorData?.light !== null && sensorData?.light !== undefined ? `${sunPct}% Sun` : '--'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Raw ADC: {sensorData?.light ?? '--'} / 4095
                  </span>
                </div>
              </div>

              {/* Hardware Diagnostic Info */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    WiFi RSSI Signal:
                  </span>
                  <span className="font-mono text-slate-200">
                    {sensorData?.wifi_rssi ? `${sensorData.wifi_rssi} dBm` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Last Ingest Timestamp:
                  </span>
                  <span className="font-mono text-slate-200">
                    {sensorData?.receivedAt ? new Date(sensorData.receivedAt).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400" />
                    Ingest Endpoint:
                  </span>
                  <span className="font-mono text-sky-400 text-[11px]">POST /api/sensor-data</span>
                </div>
              </div>
            </div>
          ) : (
            /* =================== GOOGLE/INTERNET WEATHER DATABASE DETAILS =================== */
            <div className="space-y-3">
              {/* Location & Provider Banner */}
              <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/40 text-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    {location.name} Satellite Model
                  </span>
                  <span className="text-[11px] opacity-80">
                    Coordinates: {location.latitude.toFixed(3)}°N, {location.longitude.toFixed(3)}°E &bull; Open-Meteo ECMWF/GFS
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-sky-900/60 border border-sky-500/40 text-sky-300 font-mono text-[10px] font-bold">
                  LIVE
                </span>
              </div>

              {/* Weather Data Matrix */}
              <div className="grid grid-cols-2 gap-2">
                {/* Precipitation Likelihood */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                      Precipitation Risk
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        precipProb >= 70
                          ? 'bg-rose-500 text-white'
                          : precipProb >= 40
                          ? 'bg-amber-500 text-black'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {precipProb}%
                    </span>
                  </div>
                  <div className="text-base font-black text-white">
                    {precipRate > 0 ? `${precipRate} mm/h (Raining)` : precipProb >= 70 ? 'High Rain Threat' : 'No Rain Falling'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Instant Doppler radar &amp; convective probability
                  </span>
                </div>

                {/* Ambient Temperature */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Atmospheric Temp
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">2m AGL</span>
                  </div>
                  <div className="text-base font-black text-white">
                    {temp !== null ? `${temp.toFixed(1)}°C` : '--'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Regional ambient macroclimate
                  </span>
                </div>

                {/* Relative Humidity */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      Air Humidity
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Surface</span>
                  </div>
                  <div className="text-base font-black text-white">
                    {humidity !== null ? `${humidity}% RH` : '--'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    High humidity (&gt;80%) slows natural areca drying
                  </span>
                </div>

                {/* Cloud Cover & Sunlight */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      Cloud Coverage
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Total Sky</span>
                  </div>
                  <div className="text-base font-black text-amber-300">
                    {cloudCover}% Covered
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Direct solar irradiance estimated at {Math.max(0, 100 - cloudCover)}%
                  </span>
                </div>
              </div>

              {/* Atmospheric Details */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Wind Velocity (10m):</span>
                  <span className="font-mono text-slate-200">
                    {windSpeed !== null ? `${windSpeed} km/h` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Surface Atmospheric Pressure:</span>
                  <span className="font-mono text-slate-200">
                    {surfacePressure !== null ? `${surfacePressure} hPa` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Weather Condition Code:</span>
                  <span className="font-mono text-sky-300">
                    WMO {weatherData?.current?.weather_code ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-1 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            Direct stream feeding Decision Engine
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
