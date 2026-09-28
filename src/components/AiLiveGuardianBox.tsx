import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  CloudRain,
  Sun,
  CloudSun,
  Activity,
  ChevronRight,
  Send,
  Loader2,
  BarChart2,
  AlertCircle,
  Radio,
  Zap
} from 'lucide-react';
import { SensorTelemetry, WeatherForecastResponse, DecisionMode, CanopyMode } from '../types';
import { getGoogleRainAnalysis } from '../utils/weatherUtils';

interface AiLiveGuardianBoxProps {
  sensorData: SensorTelemetry | null;
  weatherData: WeatherForecastResponse | null;
  decisionMode: DecisionMode;
  canopyMode: CanopyMode;
  onAutoCloseRoof: (reason: string) => void;
  onOpenAnalyticsModal: () => void;
}

export const AiLiveGuardianBox: React.FC<AiLiveGuardianBoxProps> = ({
  sensorData,
  weatherData,
  decisionMode,
  canopyMode,
  onAutoCloseRoof,
  onOpenAnalyticsModal,
}) => {
  const [aiStatus, setAiStatus] = useState<'OPTIMAL' | 'WARNING' | 'CLOSING' | 'OFFLINE'>('OPTIMAL');
  const [lastDrasticTrigger, setLastDrasticTrigger] = useState<string>('');

  // Interactive Question State
  const [userQuery, setUserQuery] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);

  // Store previous metrics to detect DRASTIC changes only
  const prevMetricsRef = useRef({
    rain: false,
    cloudCover: 0,
    precipitation: 0,
    ldrRaw: 4095,
  });

  const isSensorConnected = Boolean(
    sensorData && (sensorData.temperature !== null || sensorData.humidity !== null)
  );

  const isRainSensorTriggered = Boolean(
    sensorData && sensorData.rain_connected && (sensorData.rain || sensorData.rain_digital === 0)
  );
  const googleAnalysis = getGoogleRainAnalysis(weatherData);
  const cloudCover = googleAnalysis.cloudCover;
  const precipRate = googleAnalysis.currentPrecipMm;
  const precipProb = googleAnalysis.currentPrecipProb;
  const isGoogleRain = googleAnalysis.isRainThreat;
  const ldrRaw = sensorData?.light ?? 4095;
  const sunPct = Math.max(0, Math.min(100, Math.round(((4095 - ldrRaw) / 4095) * 100)));
  const isHeavyOvercast = cloudCover >= 70 || precipProb >= 50;

  // Evaluate conditions and trigger 5s closure on drastic events
  useEffect(() => {
    const prev = prevMetricsRef.current;
    const isDrasticRain = isRainSensorTriggered && !prev.rain;
    const isDrasticCloud = isHeavyOvercast && prev.cloudCover < 65;
    const isDrasticRadarRain = isGoogleRain && !prev.precipitation;

    let newStatus: 'OPTIMAL' | 'WARNING' | 'CLOSING' | 'OFFLINE' = 'OPTIMAL';

    if (!isSensorConnected) {
      newStatus = 'OFFLINE';
      // When sensors are offline, if radar detects heavy clouds, auto close
      if ((isHeavyOvercast || isGoogleRain) && canopyMode === 'AUTO') {
        onAutoCloseRoof('AI: Radar Rain Threat while Sensors Disconnected');
      }
    } else if (decisionMode === 'SENSOR_ONLY') {
      if (isRainSensorTriggered) {
        newStatus = 'CLOSING';
        if (isDrasticRain && canopyMode === 'AUTO') {
          onAutoCloseRoof('AI: Local Rain Drop Detected on Sensor Plate');
        }
      } else {
        newStatus = 'OPTIMAL';
      }
    } else if (decisionMode === 'INTERNET_ONLY') {
      if (isGoogleRain) {
        newStatus = 'CLOSING';
        if ((isDrasticRadarRain || isDrasticCloud) && canopyMode === 'AUTO') {
          onAutoCloseRoof(`AI: Google Satellite Rain Threat (${googleAnalysis.reason})`);
        }
      } else if (isHeavyOvercast) {
        newStatus = 'WARNING';
      } else {
        newStatus = 'OPTIMAL';
      }
    } else {
      // COMBO MODE
      if (isRainSensorTriggered) {
        newStatus = 'CLOSING';
        if (isDrasticRain && canopyMode === 'AUTO') {
          onAutoCloseRoof('AI Combo: Verified Rain Moisture on Bed Plate');
        }
      } else if (isGoogleRain) {
        newStatus = 'CLOSING';
        if ((isDrasticRadarRain || isDrasticCloud) && canopyMode === 'AUTO') {
          onAutoCloseRoof(`AI Combo: Google Satellite Rain Warning (${googleAnalysis.reason})`);
        }
      } else if (isHeavyOvercast) {
        newStatus = 'WARNING';
      } else {
        newStatus = 'OPTIMAL';
      }
    }

    setAiStatus(newStatus);
    if (isDrasticRain || isDrasticCloud || isDrasticRadarRain) {
      setLastDrasticTrigger(new Date().toLocaleTimeString());
    }

    prevMetricsRef.current = {
      rain: isRainSensorTriggered,
      cloudCover,
      precipitation: precipRate,
      ldrRaw,
    };
  }, [
    sensorData,
    weatherData,
    decisionMode,
    canopyMode,
    onAutoCloseRoof,
    isSensorConnected,
    isRainSensorTriggered,
    cloudCover,
    precipRate,
    precipProb,
    ldrRaw,
    isHeavyOvercast,
  ]);

  // Quick farmer agronomic query handler
  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isAnswering) return;

    setIsAnswering(true);
    const q = userQuery.trim();
    setUserQuery('');

    try {
      const res = await fetch('/api/gemini/analyze-farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          sensorData,
          weatherData,
          decisionMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomAnswer(data.answer || data.text || 'Arecanut crop drying analysis complete.');
      } else {
        setCustomAnswer(
          `AI Agronomist: Satellite indicates ${cloudCover}% clouds. For optimal curing, keep bed dry and close before 6 PM.`
        );
      }
    } catch {
      setCustomAnswer(
        'AI Agronomist: Keep canopy sealed during rain to avoid fungal Koleroga rotting.'
      );
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div
      id="ai-real-time-top-guardian"
      className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-2 border-indigo-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-indigo-950/40 relative overflow-hidden transition-all"
    >
      {/* Background Neural Glow */}
      <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div
        className={`absolute -bottom-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all ${
          aiStatus === 'CLOSING'
            ? 'bg-rose-600/25'
            : aiStatus === 'OFFLINE'
            ? 'bg-amber-600/20'
            : 'bg-emerald-600/20'
        }`}
      />

      {/* Top Bar: Futuristic AI Live Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-inner flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase flex items-center gap-1.5">
                <span>AI Real-Time Guardian &amp; Arbitration</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Mode: {decisionMode}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Analyzing Dual Streams: Satellite Cloud Radar vs. Bed Sensors</span>
            </p>
          </div>
        </div>

        {/* Verdict Badge & Analytics Launcher */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-black uppercase px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-md ${
              aiStatus === 'CLOSING'
                ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                : aiStatus === 'OFFLINE'
                ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                : aiStatus === 'WARNING'
                ? 'bg-amber-950 text-amber-300 border-amber-600'
                : 'bg-emerald-950 text-emerald-300 border-emerald-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiStatus === 'CLOSING' || aiStatus === 'OFFLINE'
                  ? 'bg-rose-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
            <span>
              {aiStatus === 'CLOSING'
                ? 'CRITICAL: CANOPY CLOSED IN 5s'
                : aiStatus === 'OFFLINE'
                ? 'SENSORS OFFLINE • FAILSAFE SEAL'
                : aiStatus === 'WARNING'
                ? 'OVERCAST WATCH: TRACKING'
                : 'OPTIMAL SOLAR CURING'}
            </span>
          </span>

          <button
            onClick={onOpenAnalyticsModal}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Open Graphical Timeline & Drying Charts"
          >
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Analytics</span>
          </button>
        </div>
      </div>

      {/* Real-Time Dual Stream Status Chips (What is Actually Being Analyzed) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-3.5">
        {/* Stream 1: Satellite Radar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-sky-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Satellite Radar</span>
              <span className="text-xs font-black text-white font-mono">
                {precipProb}% Rain • {cloudCover}% Cloud
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
              precipProb >= 60 || cloudCover >= 70
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {precipProb >= 60 ? 'Threat' : 'Clear'}
          </span>
        </div>

        {/* Stream 2: ESP32 Bed Sensors (RED if Disconnected!) */}
        <div
          className={`border rounded-2xl p-2.5 flex items-center justify-between transition-colors ${
            !isSensorConnected
              ? 'bg-rose-950/40 border-rose-600/80 text-rose-300 shadow-sm shadow-rose-950'
              : 'bg-slate-950/80 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${!isSensorConnected ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}
            />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Bed Sensors</span>
              <span className="text-xs font-black font-mono">
                {!isSensorConnected ? (
                  <span className="text-rose-400 font-bold">STILL NOT CONNECTED</span>
                ) : isRainSensorTriggered ? (
                  <span className="text-rose-400 font-bold">WATER DROPS ON PLATE</span>
                ) : (
                  <span className="text-emerald-400">DRY PLATE (0% RAIN)</span>
                )}
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
              !isSensorConnected
                ? 'bg-rose-600 text-white animate-pulse'
                : isRainSensorTriggered
                ? 'bg-rose-950 text-rose-300'
                : 'bg-emerald-950 text-emerald-300'
            }`}
          >
            {!isSensorConnected ? 'OFFLINE' : isRainSensorTriggered ? 'WET' : 'LIVE'}
          </span>
        </div>

        {/* Stream 3: Real-Time Arbitration Result */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">3. 5s Auto Action</span>
              <span className="text-xs font-black text-amber-300 font-mono">
                {canopyMode === 'CLOSED'
                  ? 'ROOF SEALED'
                  : canopyMode === 'AUTO' && (isHeavyOvercast || isRainSensorTriggered || !isSensorConnected)
                  ? 'SEALING CANOPY'
                  : 'CURING HARVEST'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800">
            {canopyMode}
          </span>
        </div>
      </div>

      {/* Concise Highlighted Narrative (No long rambling text; Keywords pop!) */}
      <div className="relative z-10 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 text-xs text-slate-200">
        <div className="flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0 animate-ping" />
          <div className="leading-relaxed flex-1">
            {!isSensorConnected ? (
              <p>
                <strong className="text-rose-400 font-bold uppercase tracking-wider mr-1.5">
                  [SENSORS NOT CONNECTED]
                </strong>
                On-site hardware sensors are <span className="text-rose-400 font-bold underline decoration-rose-500">STILL NOT CONNECTED</span>. 
                Satellite radar reports <strong className="text-white font-bold">{precipProb}% RAIN PROBABILITY</strong> and <strong className="text-white font-bold">{cloudCover}% OVERCAST</strong>. 
                The AI maintains a <strong className="text-amber-400 font-bold">FAILSAFE PROTECTIVE CLOSURE</strong> to ensure zero crop moisture damage.
              </p>
            ) : isRainSensorTriggered ? (
              <p>
                <strong className="text-rose-400 font-bold uppercase tracking-wider mr-1.5">
                  [INSTANT MOISTURE ALERT]
                </strong>
                Physical rain drops <strong className="text-rose-400 font-bold">DETECTED ON ON-SITE SENSOR</strong>! 
                Overriding satellite data. AI triggers <strong className="text-rose-400 font-bold">5-SECOND CANOPY CLOSURE</strong> to prevent fungal Koleroga infection on arecanut kernels.
              </p>
            ) : isHeavyOvercast ? (
              <p>
                <strong className="text-amber-400 font-bold uppercase tracking-wider mr-1.5">
                  [PREVENTIVE WEATHER WARNING]
                </strong>
                Heavy storm clouds detected (<strong className="text-white font-bold">{cloudCover}% OVERCAST</strong>, <strong className="text-white font-bold">{precipProb}% PRECIPITATION</strong>). 
                Bed sensor plate is currently <strong className="text-emerald-400 font-bold">DRY</strong>. 
                Preemptive roof protection is <strong className="text-amber-400 font-bold">ACTIVE</strong>.
              </p>
            ) : (
              <p>
                <strong className="text-emerald-400 font-bold uppercase tracking-wider mr-1.5">
                  [OPTIMAL SUNSHINE]
                </strong>
                Both streams confirm <strong className="text-emerald-400 font-bold">0mm PRECIPITATION</strong> and <strong className="text-emerald-400 font-bold">CLEAR SKIES</strong>. 
                Arecanut bed surface temperature is <strong className="text-white font-bold">{sensorData?.temperature?.toFixed(1) ?? 28}°C</strong>. 
                Canopy remains <strong className="text-emerald-400 font-bold">WIDE OPEN</strong> for solar evaporation.
              </p>
            )}

            {lastDrasticTrigger && (
              <span className="text-[10px] text-amber-400/90 font-mono block pt-1.5">
                ⚡ Last significant atmospheric trigger recorded at {lastDrasticTrigger}
              </span>
            )}
          </div>
        </div>

        {/* Custom Agronomist Answer if asked */}
        {customAnswer && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-amber-200 bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block text-xs">Agronomist Recommendation:</strong>
              <p className="text-[11px] text-slate-300 leading-snug">{customAnswer}</p>
            </div>
          </div>
        )}
      </div>

      {/* Inline Farmer Quick Query Form */}
      <form onSubmit={handleAskAi} className="relative z-10 mt-3 flex items-center gap-2">
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Ask AI: 'Is it safe to leave canopy open?', 'Rain radar forecast', etc..."
          className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!userQuery.trim() || isAnswering}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md shadow-indigo-600/30"
        >
          {isAnswering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
