import React, { useState } from 'react';
import { 
  Radio, 
  CloudRain, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Droplets, 
  MapPin, 
  ShieldCheck, 
  X,
  Compass,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DecisionMode, Radar30kmScanResult, WeatherForecastResponse } from '../types';

interface TopControlModeBarProps {
  decisionMode: DecisionMode;
  onSelectMode: (mode: DecisionMode) => void;
  sunlightPercent: number | null;
  isRainWet: boolean;
  isNight: boolean;
  radarSummary: Radar30kmScanResult | null;
  weather: WeatherForecastResponse | null;
  canopyMode: 'AUTO' | 'MANUAL' | 'OPEN' | 'CLOSED' | 'STOPPED';
  isSensorOnline: boolean;
  isModeModalOpen?: boolean;
  setIsModeModalOpen?: (open: boolean) => void;
}

export const TopControlModeBar: React.FC<TopControlModeBarProps> = ({
  decisionMode,
  onSelectMode,
  sunlightPercent,
  isRainWet,
  isNight,
  radarSummary,
  weather,
  canopyMode,
  isSensorOnline,
  isModeModalOpen,
  setIsModeModalOpen,
}) => {
  const [internalShowModal, setInternalShowModal] = useState(false);
  const [isInlineDrawerOpen, setIsInlineDrawerOpen] = useState(false);

  const showModeModal = isModeModalOpen !== undefined ? isModeModalOpen : internalShowModal;
  const setShowModeModal = setIsModeModalOpen || setInternalShowModal;

  // Real-time criteria evaluations
  const currentRainProb = weather?.hourly?.precipitation_probability?.[0] ?? (weather?.current?.precipitation ? 75 : 15);
  const nearestDist = radarSummary?.nearestRainDistanceKm;
  const is10kmClear = radarSummary?.is10kmPerimeterClear ?? true;
  const nearestPlace = radarSummary?.nearestRainPlaceName || 'Regional Area';
  const hasNearestRainThreat = !is10kmClear || (nearestDist !== null && nearestDist !== undefined && nearestDist <= 10.0);
  const hasCurrentRainThreat = currentRainProb >= 50 || (weather?.current?.precipitation && weather.current.precipitation > 0.1);

  // Hypothetical output for Mode 1: SENSOR_ONLY (Sunset/sunrise times do not matter; relies on LDR detecting light)
  const mode1Target = (!isSensorOnline || isRainWet || (sunlightPercent !== null && sunlightPercent <= 60))
    ? 'CLOSED' 
    : 'OPEN';
  const mode1Reason = !isSensorOnline
    ? 'Failsafe: Hardware offline'
    : isRainWet
    ? 'Rain plate wet'
    : sunlightPercent !== null && sunlightPercent <= 60
    ? `Low light: ${sunlightPercent}% (≤60%)`
    : `LDR detects light: ${sunlightPercent ?? 100}% (>60%) & dry`;

  // Hypothetical output for Mode 2: INTERNET_ONLY
  const mode2Target = (isNight || hasCurrentRainThreat || hasNearestRainThreat) ? 'CLOSED' : 'OPEN';
  const mode2Reason = isNight
    ? 'Night ephemeris'
    : hasNearestRainThreat
    ? `Rain at ${nearestPlace} (~${nearestDist}km)`
    : hasCurrentRainThreat
    ? `Current rain risk ${currentRainProb}%`
    : `Clear (<30% risk, nearest 10km dry)`;

  // Hypothetical output for Mode 3: COMBO
  const mode3Target = (isRainWet || isNight || (sunlightPercent !== null && sunlightPercent <= 60) || (hasCurrentRainThreat && hasNearestRainThreat))
    ? 'CLOSED'
    : 'OPEN';
  const mode3Reason = isRainWet
    ? 'Priority #1: Plate wet'
    : isNight
    ? 'Night dew protection'
    : sunlightPercent !== null && sunlightPercent <= 60
    ? `Sunlight ${sunlightPercent}% (≤60%)`
    : hasCurrentRainThreat && hasNearestRainThreat
    ? `Front verified at ${nearestPlace} (~${nearestDist}km)`
    : hasCurrentRainThreat && !hasNearestRainThreat && sunlightPercent !== null && sunlightPercent > 60
    ? `False alarm bypassed (${sunlightPercent}% sun, 10km clear)`
    : `Both sensor & radar clear`;

  const activeTarget = decisionMode === 'SENSOR_ONLY' ? mode1Target : decisionMode === 'INTERNET_ONLY' ? mode2Target : mode3Target;
  const activeReason = decisionMode === 'SENSOR_ONLY' ? mode1Reason : decisionMode === 'INTERNET_ONLY' ? mode2Reason : mode3Reason;

  const modeTitle = decisionMode === 'SENSOR_ONLY' 
    ? '1. Sensors Mode' 
    : decisionMode === 'INTERNET_ONLY' 
    ? '2. Forecasting Data Mode' 
    : '3. Combined Mode';

  return (
    <>
      {/* Top 3-Mode Control Bar */}
      <div 
        id="top-mode-control-bar" 
        className="w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-2 sm:px-4 py-1.5 shadow-md relative z-20"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left (Desktop / Tablet): Mode Title & Rules Link */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <button
              id="top-mode-selector-dropdown-btn"
              onClick={() => setShowModeModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs font-bold text-white transition-all cursor-pointer shadow-xs group"
              title="Click to view all 3 decision modes & live status"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-45 transition-transform" />
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Mode:</span>
              <span className="text-xs font-extrabold text-sky-300">
                {modeTitle}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>

            <button
              id="mode-info-dialog-btn"
              onClick={() => setShowModeModal(true)}
              className="p-1 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800/60 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title="Click to open full modes comparison guide"
            >
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="underline decoration-dotted underline-offset-2">Rules</span>
            </button>
          </div>

          {/* Center (Full Width on Mobile): 3 Dedicated Mode Buttons */}
          <div 
            id="top-mode-buttons-group"
            className="flex-1 max-w-full sm:max-w-xl flex items-center gap-1 p-0.5 bg-slate-950/90 rounded-xl border border-slate-800/90"
          >
            {/* Button 1: Sensors Mode */}
            <button
              id="mode-btn-sensor-only"
              onClick={() => onSelectMode('SENSOR_ONLY')}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1 px-1 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                decisionMode === 'SENSOR_ONLY'
                  ? 'bg-emerald-500/25 border border-emerald-500/60 text-emerald-300 shadow-xs ring-1 ring-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
              title="1. Sensors Mode: Rain Plate + LDR >60% + Day/Night. No forecast used."
            >
              <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${decisionMode === 'SENSOR_ONLY' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span>1. Sensors</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono hidden xl:inline ${
                decisionMode === 'SENSOR_ONLY' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'
              }`}>
                Rain+LDR
              </span>
            </button>

            {/* Button 2: Forecasting Data Mode */}
            <button
              id="mode-btn-internet-only"
              onClick={() => onSelectMode('INTERNET_ONLY')}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1 px-1 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                decisionMode === 'INTERNET_ONLY'
                  ? 'bg-sky-500/25 border border-sky-500/60 text-sky-300 shadow-xs ring-1 ring-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
              title="2. Forecasting Data Mode: Current + 10km radar forecast. No sensors used."
            >
              <CloudRain className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${decisionMode === 'INTERNET_ONLY' ? 'text-sky-400 animate-pulse' : 'text-slate-400'}`} />
              <span>2. Forecast</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono hidden xl:inline ${
                decisionMode === 'INTERNET_ONLY' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-400'
              }`}>
                Online
              </span>
            </button>

            {/* Button 3: Combination of Both */}
            <button
              id="mode-btn-combo"
              onClick={() => onSelectMode('COMBO')}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1 px-1 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                decisionMode === 'COMBO'
                  ? 'bg-amber-500/25 border border-amber-500/60 text-amber-300 shadow-xs ring-1 ring-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
              title="3. Combined Mode: Physical sensor priority + radar cross-validation."
            >
              <Sparkles className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${decisionMode === 'COMBO' ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
              <span>3. Combined</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono hidden xl:inline ${
                decisionMode === 'COMBO' ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
              }`}>
                Auto
              </span>
            </button>
          </div>

          {/* Right: Quick Target Badge, Rules Info, & Inline Drawer Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              id="mobile-rules-info-btn"
              onClick={() => setShowModeModal(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 border border-slate-800 lg:hidden cursor-pointer"
              title="Modes rules & details"
            >
              <Info className="w-3.5 h-3.5 text-sky-400" />
            </button>

            <button
              id="quick-active-target-badge"
              onClick={() => setShowModeModal(true)}
              className={`text-[9px] sm:text-[11px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 ${
                activeTarget === 'CLOSED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
              title={`Live Evaluated Target: ${activeTarget} (${activeReason}) - Click for details`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeTarget === 'CLOSED' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              <span>{activeTarget}</span>
            </button>

            <button
              id="toggle-inline-drawer-btn"
              onClick={() => setIsInlineDrawerOpen(!isInlineDrawerOpen)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 cursor-pointer hidden md:flex items-center gap-1 text-[11px]"
              title="Toggle inline modes preview"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              {isInlineDrawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Quick Inline Comparison Drawer (Expandable on desktop & tablets) */}
        {isInlineDrawerOpen && (
          <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-slate-800/90 grid grid-cols-1 md:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Quick Box 1 */}
            <div 
              onClick={() => onSelectMode('SENSOR_ONLY')}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                decisionMode === 'SENSOR_ONLY' 
                  ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Radio className="w-3.5 h-3.5" /> 1. Sensors Mode
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                  mode1Target === 'CLOSED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {mode1Target}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Plate wet → Close. Low light (≤60%) → Close. LDR detects light (&gt;60%) & dry → Works perfectly & opens (sunset/sunrise times ignored).
              </p>
              <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Rain: {isRainWet ? 'WET' : 'DRY'} | LDR: {sunlightPercent ?? 'N/A'}%</span>
                <span className="text-emerald-400 font-semibold">{decisionMode === 'SENSOR_ONLY' ? 'ACTIVE' : 'Click to activate'}</span>
              </div>
            </div>

            {/* Quick Box 2 */}
            <div 
              onClick={() => onSelectMode('INTERNET_ONLY')}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                decisionMode === 'INTERNET_ONLY' 
                  ? 'bg-sky-950/40 border-sky-500/60 ring-1 ring-sky-500/30' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5 text-sky-300">
                  <CloudRain className="w-3.5 h-3.5" /> 2. Forecast Mode
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                  mode2Target === 'CLOSED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {mode2Target}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Current location forecast + nearest 10km radar. Zero hardware sensors used.
              </p>
              <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Risk: {currentRainProb}% | Nearest: {nearestDist !== null && nearestDist !== undefined ? `${nearestDist}km` : 'Clear'}</span>
                <span className="text-sky-400 font-semibold">{decisionMode === 'INTERNET_ONLY' ? 'ACTIVE' : 'Click to activate'}</span>
              </div>
            </div>

            {/* Quick Box 3 */}
            <div 
              onClick={() => onSelectMode('COMBO')}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                decisionMode === 'COMBO' 
                  ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" /> 3. Combined Mode
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                  mode3Target === 'CLOSED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {mode3Target}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Sensor wet = Close immediately (Priority #1). Nearest radar cross-validation for false alert bypass.
              </p>
              <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Status: {activeReason}</span>
                <span className="text-amber-400 font-semibold">{decisionMode === 'COMBO' ? 'ACTIVE' : 'Click to activate'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Mode Guide & Interactive Comparison Modal */}
      {showModeModal && (
        <div 
          id="mode-guide-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowModeModal(false)}
        >
          <div 
            id="mode-guide-modal-content"
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                  <Compass className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">System Decision Modes &amp; Rules</h3>
                  <p className="text-xs text-slate-400">Click any mode to activate it instantly on the farm</p>
                </div>
              </div>
              <button
                id="close-mode-modal-btn"
                onClick={() => setShowModeModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Real-Time Live Status Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-400" /> Rain Sensor
                </span>
                <span className={`font-bold ${isRainWet ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isRainWet ? 'WET (Raindrops)' : 'DRY (No Rain)'}
                </span>
                <span className="text-[9px] text-slate-500">Priority #1 Close</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" /> LDR Sunlight
                </span>
                <span className={`font-bold ${(sunlightPercent ?? 0) <= 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sunlightPercent !== null ? `${sunlightPercent}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-500">Req: &gt;60% to open</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  {isNight ? <Moon className="w-3 h-3 text-indigo-400" /> : <Sun className="w-3 h-3 text-amber-400" />} Cycle
                </span>
                <span className={`font-bold ${isNight ? 'text-indigo-400' : 'text-amber-400'}`}>
                  {isNight ? 'NIGHT' : 'DAY'}
                </span>
                <span className="text-[9px] text-slate-500">{isNight ? 'Sealed for dew' : 'Drying window'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-sky-400" /> Nearest Rain
                </span>
                <span className={`font-bold ${hasNearestRainThreat ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {nearestDist !== null && nearestDist !== undefined ? `${nearestDist}km (${nearestPlace})` : 'Clear (>10km)'}
                </span>
                <span className="text-[9px] text-slate-500">{hasNearestRainThreat ? 'Radar threat' : 'Safe perimeter'}</span>
              </div>
            </div>

            {/* 3 Detailed Interactive Mode Cards */}
            <div className="space-y-3">
              {/* Card 1: Sensors Mode */}
              <div 
                id="modal-mode-card-sensor-only"
                onClick={() => onSelectMode('SENSOR_ONLY')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  decisionMode === 'SENSOR_ONLY'
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Mode 1: Sensors Mode</h4>
                        {decisionMode === 'SENSOR_ONLY' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/50">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-white">
                            Select <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">Strictly physical sensors. Zero internet forecast consumed.</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      mode1Target === 'CLOSED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {mode1Target}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{mode1Reason}</p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Rain Plate:</strong> If wet → <strong>CLOSE</strong> immediately. If dry → allowed to open.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>LDR Sunlight:</strong> If ≤ 60% intensity → <strong>CLOSE</strong> (even if rain plate is dry). If &gt; 60% and wet → <strong>CLOSE</strong>.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Light Detection:</strong> Sunset and sunrise times do not matter in Sensors Mode. If LDR detects light (&gt; 60%) and plate is dry, it works perfectly and opens!</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Forecasting Data Mode */}
              <div 
                id="modal-mode-card-internet-only"
                onClick={() => onSelectMode('INTERNET_ONLY')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  decisionMode === 'INTERNET_ONLY'
                    ? 'bg-sky-950/40 border-sky-500/70 shadow-sm ring-1 ring-sky-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                      <CloudRain className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Mode 2: Forecasting Data Mode</h4>
                        {decisionMode === 'INTERNET_ONLY' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-300 border border-sky-500/50">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-white">
                            Select <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">Completely based on forecasting data. Zero sensor data consumed.</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      mode2Target === 'CLOSED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {mode2Target}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{mode2Reason}</p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span><strong>Current Location:</strong> Online rain probability ≥ 50% or precipitation &gt; 0.1mm → <strong>CLOSE</strong>.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span><strong>Nearest Locations Radar:</strong> Rain front detected within 10km perimeter → <strong>CLOSE</strong> preemptively.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span><strong>Clear Weather:</strong> When rain risk drops &lt; 30% and 10km perimeter is clear during the day → <strong>OPEN</strong>.</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Combined Mode */}
              <div 
                id="modal-mode-card-combo"
                onClick={() => onSelectMode('COMBO')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  decisionMode === 'COMBO'
                    ? 'bg-amber-950/40 border-amber-500/70 shadow-sm ring-1 ring-amber-500/40'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Mode 3: Combination of Both (Recommended)</h4>
                        {decisionMode === 'COMBO' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/50">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-white">
                            Select <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">Physical rain sensor is priority #1. Cross-validates online forecast with nearest locations radar.</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      mode3Target === 'CLOSED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {mode3Target}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{mode3Reason}</p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><strong>Priority #1 Rain Plate:</strong> If sensor detects wet, don't ask questions → <strong>CLOSE</strong> immediately!</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><strong>LDR Sunlight:</strong> If ≤ 60% intensity → <strong>CLOSE</strong> (even if rain plate is dry).</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><strong>Online Forecast vs Dry Sensor:</strong> If current location forecast shows rain, but sensor is dry with &gt;60% sun, check nearest locations! If nearest 10km has rain → <strong>CLOSE</strong>. If nearest 10km is clear → bypasses false alarm and stays <strong>OPEN</strong>. When probability drops → <strong>OPEN</strong>.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Currently running in: <strong className="text-white">{modeTitle}</strong>
              </span>
              <button
                id="done-mode-modal-btn"
                onClick={() => setShowModeModal(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
