import React, { useState } from 'react';
import {
  Cpu,
  Thermometer,
  Droplets,
  CloudRain,
  Sun,
  Moon,
  Wifi,
  Power,
  Usb,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { SensorTelemetry, AIPredictionResult, CanopyMode, DecisionMode, AppLanguage } from '../types';

interface SensorTelemetryPanelProps {
  telemetry: SensorTelemetry | null;
  isOnline: boolean;
  packetCount: number;
  lastSeenSeconds: number | null;
  language?: AppLanguage;
  prediction?: AIPredictionResult | null;
  canopyMode: CanopyMode;
  decisionMode: DecisionMode;
  lastActuatorAction: string;
  isNightCalculated: boolean;
  isSerialConnected?: boolean;
  serialError?: string | null;
  onConnectUsb?: () => void;
  onDisconnectUsb?: () => void;
  onSetCanopyMode: (mode: CanopyMode) => void;
  onSetDecisionMode: (mode: DecisionMode) => void;
  onSimulateDisconnect: () => void;
  onOpenCodeModal: () => void;
}

export const SensorTelemetryPanel: React.FC<SensorTelemetryPanelProps> = ({
  telemetry,
  isOnline,
  packetCount,
  lastSeenSeconds,
  isNightCalculated,
  isSerialConnected = false,
  serialError = null,
  onConnectUsb,
  onDisconnectUsb,
  onSimulateDisconnect,
}) => {
  // LDR Light Calculation (Accurate for Day/Night and Sensor ADC)
  const ldrRaw = telemetry?.light !== null && telemetry?.light !== undefined ? telemetry.light : null;
  const sunPct = ldrRaw !== null
    ? Math.max(0, Math.min(100, Math.round(((4095 - ldrRaw) / 4095) * 100)))
    : null;
  const isBrightSun = sunPct !== null && sunPct >= 40;

  // Rain Plate Status
  const isRainConnected = Boolean(telemetry && telemetry.rain_connected !== false);
  const isRainDetected = Boolean(
    telemetry && (telemetry.rain || telemetry.rain_digital === 0 || (telemetry.rain_analog !== null && telemetry.rain_analog < 2800))
  );
  const isRainVerified = Boolean(
    telemetry && (telemetry.rain_verified || telemetry.verification_state === 'CONFIRMED_RAIN')
  );

  return (
    <div
      id="sensor-telemetry-panel"
      className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
    >
      {/* Header: Symmetrically matches LocationWeatherPanel */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span>ESP32 Local Sensors</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                Priority #1
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {isOnline
                ? `${packetCount} packets • ${lastSeenSeconds !== null ? `${lastSeenSeconds}s ago` : 'Live stream'}`
                : 'Awaiting hardware connection • Zero dummy data'}
            </p>
          </div>
        </div>

        {/* Live Status Badge & Reset Toggle */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm bg-emerald-950/80 text-emerald-300 border-emerald-600/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isSerialConnected ? 'USB COM4' : 'Wi-Fi Live'}</span>
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm bg-slate-950 text-slate-400 border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Offline</span>
            </span>
          )}

          {isOnline && (
            <button
              onClick={onSimulateDisconnect}
              className="p-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Reset Connection"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Quick Connect Row (1-Click USB COM stream) */}
        <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2.5 px-3.5">
          <div className="flex items-center gap-2">
            <Usb className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">Direct Hardware Link:</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {isSerialConnected ? 'Connected (COM4)' : 'Wi-Fi / USB'}
            </span>
          </div>

          {onConnectUsb && (
            <button
              onClick={isSerialConnected ? onDisconnectUsb : onConnectUsb}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                isSerialConnected
                  ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-300 border border-rose-700/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isSerialConnected ? 'Disconnect USB' : 'Connect USB'}
            </button>
          )}
        </div>

        {/* Main Graphical Sensor Card (Matches the location-graphical-card on the left!) */}
        <div
          id="sensor-graphical-card"
          className={`rounded-2xl p-5 border relative overflow-hidden transition-all ${
            isRainDetected
              ? 'bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-950 border-rose-500/50'
              : isNightCalculated
              ? 'bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 border-indigo-500/40'
              : 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/30'
          }`}
        >
          {/* Ambient Glow */}
          <div
            className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 ${
              isRainDetected ? 'bg-rose-600' : isNightCalculated ? 'bg-indigo-600' : 'bg-emerald-500'
            }`}
          />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-white font-bold">Local Arecanut Drying Bed</span>
              </div>
              <p className="text-[11px] text-slate-400">ESP32 Hardware Telemetry Node</p>
              <span className="text-[10px] text-slate-500 font-mono">
                {isOnline ? 'Hardware Verified • Active Stream' : 'Awaiting Data Packet'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner">
              {isRainDetected ? (
                <CloudRain className="w-7 h-7 text-rose-400 animate-bounce" />
              ) : isBrightSun ? (
                <Sun className="w-7 h-7 text-amber-400 animate-spin-slow" />
              ) : (
                <Cpu className="w-7 h-7 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Temperature & Condition (Symmetrically matches the Left Card) */}
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <div className="text-4xl font-black text-white tracking-tight">
                {isOnline && telemetry && telemetry.temperature !== null && typeof telemetry.temperature === 'number' ? (
                  <>
                    {telemetry.temperature.toFixed(1)}°
                    <span className="text-xl font-normal text-slate-400 ml-0.5">C</span>
                  </>
                ) : (
                  <span className="text-2xl text-slate-500 font-mono font-normal">--°C</span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-1 flex items-center gap-1.5">
                <span>{isOnline ? 'DHT22 Bed Temperature' : 'Connect ESP32 Hardware'}</span>
              </div>
            </div>

            {/* Rain Status Pill (Symmetrically matches Rain Probability Pill on Left) */}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Rain Sensor State
              </span>
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-xl inline-block shadow-sm ${
                  isRainVerified
                    ? 'bg-rose-500 text-white animate-pulse'
                    : isRainDetected
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isRainVerified
                  ? 'Rain Verified (Close)'
                  : isRainDetected
                  ? 'Water Drops (Checking)'
                  : isOnline
                  ? 'Plate Dry (Clear)'
                  : 'Sensor Offline'}
              </span>
            </div>
          </div>

          {/* 4 Graphical Gauges (Symmetrically matches Air Humidity, Rain Rate, Wind, Clouds on Left) */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/60">
            {/* 1. Bed Air Humidity */}
            <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-emerald-500/30">
              <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-300 font-semibold">
                <Droplets className="w-3 h-3 text-emerald-400" />
                <span>Bed RH</span>
              </div>
              <div className="text-xs font-black text-white mt-0.5">
                {isOnline && telemetry && telemetry.humidity !== null && typeof telemetry.humidity === 'number'
                  ? `${telemetry.humidity.toFixed(0)}%`
                  : '--'}
              </div>
            </div>

            {/* 2. Rain Analog ADC */}
            <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <CloudRain className="w-3 h-3 text-sky-400" />
                <span>Rain ADC</span>
              </div>
              <div className="text-xs font-bold text-white mt-0.5 font-mono">
                {isOnline && telemetry && telemetry.rain_analog !== null ? telemetry.rain_analog : '--'}
              </div>
            </div>

            {/* 3. Sunlight LDR Index */}
            <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                {isNightCalculated ? (
                  <Moon className="w-3 h-3 text-indigo-400" />
                ) : (
                  <Sun className="w-3 h-3 text-amber-400" />
                )}
                <span>Sunlight</span>
              </div>
              <div className="text-xs font-bold text-white mt-0.5">
                {isOnline ? (isNightCalculated && sunPct !== null && sunPct < 30 ? `${sunPct}% (Night)` : sunPct !== null ? `${sunPct}%` : '--%') : '--'}
              </div>
            </div>

            {/* 4. Link Quality / RSSI */}
            <div className="bg-slate-950/60 p-2 rounded-xl text-center border border-slate-800/80">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <Wifi className="w-3 h-3 text-indigo-400" />
                <span>Signal</span>
              </div>
              <div className="text-xs font-bold text-white mt-0.5 font-mono">
                {isOnline ? (isSerialConnected ? 'USB' : `${telemetry?.wifi_rssi ?? -60}dB`) : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* 4-Pin Hardware Status Strip (Symmetrically matches 6-Hour Timeline on Left) */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Hardware Pin Integrity</span>
            <span className="text-[10px] text-slate-400">Board Status</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400 block font-mono">Pin D4</span>
              <span className="text-xs font-bold text-emerald-400 block mt-0.5">DHT22</span>
            </div>
            <div className="py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400 block font-mono">Pin D34</span>
              <span className="text-xs font-bold text-sky-400 block mt-0.5">Rain AO</span>
            </div>
            <div className="py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400 block font-mono">Pin D35</span>
              <span className="text-xs font-bold text-amber-400 block mt-0.5">LDR Sun</span>
            </div>
            <div className="py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400 block font-mono">Pin D26</span>
              <span className="text-xs font-bold text-indigo-400 block mt-0.5">12V Driver</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
