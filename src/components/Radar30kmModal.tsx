import React, { useState, useEffect } from 'react';
import {
  X,
  Radar,
  Send,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Radio,
  Compass,
  CheckCircle2,
  ExternalLink,
  Sliders,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Bell,
  Smartphone,
  Info,
} from 'lucide-react';
import { Radar30kmScanResult, TelegramBotStatus, SensorTelemetry } from '../types';

interface Radar30kmModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: SensorTelemetry | null;
  farmCoordinates: { lat: number; lon: number };
}

export const Radar30kmModal: React.FC<Radar30kmModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  farmCoordinates,
}) => {
  const [radarData, setRadarData] = useState<Radar30kmScanResult | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramBotStatus | null>(null);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);

  const fetchRadar = async (force = false) => {
    setIsLoadingRadar(true);
    try {
      if (force) {
        const res = await fetch('/api/radar-30km/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(farmCoordinates),
        });
        const data = await res.json();
        if (data.radar) setRadarData(data.radar);
      } else {
        const res = await fetch(`/api/radar-30km?lat=${farmCoordinates.lat}&lon=${farmCoordinates.lon}`);
        const data = await res.json();
        if (data.radar) setRadarData(data.radar);
      }
    } catch (err) {
      console.error('Failed to load 30km radar:', err);
    } finally {
      setIsLoadingRadar(false);
    }
  };

  const fetchTelegramStatus = async () => {
    try {
      const res = await fetch('/api/telegram-status');
      const data = await res.json();
      if (data.status) setTelegramStatus(data.status);
    } catch (err) {
      console.error('Failed to load telegram status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRadar(false);
      fetchTelegramStatus();
    }
  }, [isOpen, farmCoordinates.lat, farmCoordinates.lon]);

  const handleSendTestAlert = async () => {
    setIsSendingAlert(true);
    setAlertFeedback(null);
    try {
      const res = await fetch('/api/telegram-test-alert', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAlertFeedback(`✅ ${data.message}`);
        fetchTelegramStatus();
      } else {
        setAlertFeedback(`⚠️ ${data.message}`);
      }
    } catch (err: any) {
      setAlertFeedback(`❌ Error sending alert: ${err.message}`);
    } finally {
      setIsSendingAlert(false);
      setTimeout(() => setAlertFeedback(null), 5000);
    }
  };

  if (!isOpen) return null;

  const points = radarData?.points || [];
  const selectedPoint = points[selectedPointIndex] || points[0];

  return (
    <div
      id="radar-30km-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="radar-30km-modal-card"
        className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  100km Radar & 10km Shield Controller
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">
                10km Critical Shield (Canopy Closure Boundary) &bull; 100km Reference Radar Scope
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-30km-radar-btn"
              onClick={() => fetchRadar(true)}
              disabled={isLoadingRadar}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRadar ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Scan 100km Scope Now</span>
            </button>
            <button
              id="close-radar-modal-btn"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Conflict Banner */}
          {radarData && (
            <div
              id="radar-conflict-banner"
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                !radarData.is10kmPerimeterClear
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : radarData.conflictState === 'LOCAL_ISOLATED_SHOWER'
                  ? 'bg-blue-50/90 border-blue-300 text-blue-950'
                  : radarData.conflictState === 'RADAR_CONFLICT_APPROACHING'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {!radarData.is10kmPerimeterClear ? (
                    <CloudRain className="w-6 h-6 text-rose-600 animate-bounce" />
                  ) : radarData.is10kmPerimeterClear ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      {!radarData.is10kmPerimeterClear
                        ? '🚨 10KM CRITICAL SHIELD BREACHED: Rain Nearby (Therpal Closed)'
                        : radarData.conflictState === 'LOCAL_ISOLATED_SHOWER'
                        ? 'LOCAL ISOLATED SHOWER: Moisture on Bed Sensor'
                        : '🛡️ 10KM SHIELD ALL CLEAR: Therpal OPEN (Drying Active)'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 border border-current font-medium">
                      10km Status: {radarData.is10kmPerimeterClear ? 'CLEAR (Open)' : 'BREACHED (Closed)'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 border border-current font-medium">
                      100km Threat Cells: {radarData.rainCellsDetected}
                    </span>
                  </div>
                  <p className="text-xs mt-1 opacity-90">
                    {radarData.is10kmPerimeterClear
                      ? radarData.nearestRainDistanceKm && radarData.nearestRainDistanceKm > 10
                        ? `Therpal stays OPEN. Distant rain at ${radarData.nearestRainPlaceName} (~${radarData.nearestRainDistanceKm}km) monitored for reference only.`
                        : 'Therpal stays OPEN. No rain clouds detected within 10km perimeter.'
                      : `Therpal CLOSED for crop protection. Rain cell detected at ${radarData.nearestRainPlaceName || 'nearby sector'} (~${radarData.nearestRainDistanceKm}km).`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 font-semibold shadow-xs">
                  {radarData.rainIn10kmCount ?? (radarData.is10kmPerimeterClear ? 0 : 1)} in 10km Shield
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 font-semibold shadow-xs">
                  Max: {radarData.maxPrecipitationMm.toFixed(1)} mm/h
                </span>
              </div>
            </div>
          )}

          {/* Grid Layout: Left Radar Compass + Right Telegram Integration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: 10km Critical & 100km Radial Points (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  10km Critical Shield & Regional Reference Points
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Tap any point to inspect
                </span>
              </div>

              {/* Interactive Compass Matrix */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {points.map((pt, idx) => {
                  const isSelected = selectedPointIndex === idx;
                  const isWithin10km = pt.distanceKm <= 10.0;
                  const isRain = pt.precipitation > 0.1 || pt.rainProbability >= 40;
                  const isThreat = pt.rainProbability >= 20 && !isRain;

                  return (
                    <button
                      key={pt.direction + idx}
                      id={`radar-point-${pt.direction.toLowerCase()}`}
                      onClick={() => setSelectedPointIndex(idx)}
                      className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 bg-white shadow-md border-indigo-300'
                          : isWithin10km
                          ? 'bg-amber-50/50 hover:bg-amber-50 border-amber-300'
                          : 'bg-white hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900">{pt.direction}</span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isRain
                              ? 'bg-rose-500 animate-ping'
                              : isThreat
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="text-[11px] text-slate-600 truncate font-medium">{pt.label}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span
                          className={`font-bold ${
                            isRain
                              ? 'text-rose-600'
                              : isThreat
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {pt.rainProbability}%
                        </span>
                        <span className="text-[10px] px-1 rounded font-semibold text-slate-600 bg-slate-100">
                          {pt.distanceKm === 0 ? 'Origin' : isWithin10km ? '🛡️ 10km' : `${pt.distanceKm}km`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Point Inspector Detail Card */}
              {selectedPoint && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        Inspected Bearing: {selectedPoint.direction} ({selectedPoint.label})
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {selectedPoint.isRaining
                          ? 'Precipitation / Rain Detected'
                          : selectedPoint.cloudCover > 60
                          ? 'Overcast Cloud Cover'
                          : 'Clear Sky'}
                      </h4>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Lat: {selectedPoint.latitude.toFixed(4)}, Lon: {selectedPoint.longitude.toFixed(4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500">Rain Risk</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedPoint.rainProbability}%
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500">Precipitation</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedPoint.precipitation.toFixed(2)} mm/h
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500">Temperature</div>
                      <div className="text-sm font-bold text-slate-800">
                        {selectedPoint.temperature}°C
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Telegram Bot Integration (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  Telegram Bot Controller
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-semibold">
                  {telegramStatus?.isLive ? 'Active Polling' : 'Connecting...'}
                </span>
              </div>

              {/* Bot Info Card */}
              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      @{telegramStatus?.botUsername || 'ArecaFarmDryerbot'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your 24/7 Farm Guardian & Remote Actuator
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-sky-100 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Registered Farmers:</span>
                    <span className="font-bold text-slate-900">
                      {telegramStatus?.registeredUsersCount || 0} phone(s)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Persistent Keyboard:</span>
                    <span className="font-semibold text-emerald-600">
                      [ Force OPEN ] / [ Force CLOSE ]
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Auto-Conflict Alerts:</span>
                    <span className="font-semibold text-indigo-600">10km Critical Shield Only</span>
                  </div>
                </div>

                {/* Steps to Connect */}
                <div className="space-y-2 text-xs text-slate-700 bg-white/70 p-3 rounded-lg border border-slate-200/60">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-600" />
                    How to activate on your Android phone:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                    <li>Open Telegram and search for <b>@ArecaFarmDryerbot</b></li>
                    <li>Press <b>START</b> to register your phone permanently in its brain.</li>
                    <li>You will instantly see two big buttons <b>[ 🟢 Force OPEN Roof ]</b> and <b>[ 🔴 Force CLOSE Roof ]</b> below the typing bar.</li>
                    <li>Receive instant push alerts with buttons if rain enters your <b>10km critical perimeter</b> (no false alarms from distant rain)!</li>
                  </ol>
                </div>

                {/* Direct Telegram Open Link & Test Alert */}
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    id="open-telegram-bot-link"
                    href="https://t.me/ArecaFarmDryerbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all"
                  >
                    <span>Open @ArecaFarmDryerbot in Telegram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    id="test-telegram-alert-btn"
                    onClick={handleSendTestAlert}
                    disabled={isSendingAlert}
                    className="w-full py-2 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isSendingAlert ? 'Sending Alert...' : 'Send Test Push Alert to Telegram'}</span>
                  </button>

                  {alertFeedback && (
                    <div className="text-xs p-2 rounded-lg bg-white border border-slate-200 text-center font-medium animate-fadeIn">
                      {alertFeedback}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${radarData?.is10kmPerimeterClear ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`}></span>
            <span>10km Critical Shield Active (Closing Trigger) &bull; 100km Regional Scope (Reference)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
