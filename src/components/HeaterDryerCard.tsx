import React from 'react';
import {
  Flame,
  Thermometer,
  Zap,
  RotateCw,
  Play,
  Square,
  Sliders,
  ShieldCheck,
  Timer,
  Info,
} from 'lucide-react';
import { HeaterDryerState, FarmSettings } from '../types';

interface HeaterDryerCardProps {
  heaterState: HeaterDryerState | null;
  currentTemperature: number | null;
  settings: FarmSettings;
  onControlHeater: (
    action: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF' | 'TEST_PULSE',
    customDurationSec?: number
  ) => Promise<void>;
  onOpenSettings: () => void;
}

export const HeaterDryerCard: React.FC<HeaterDryerCardProps> = ({
  heaterState,
  currentTemperature,
  settings,
  onControlHeater,
  onOpenSettings,
}) => {
  const isHeating = heaterState?.status === 'HEATING';
  const isResting = heaterState?.status === 'COOLING_REST';
  const isStandby = heaterState?.status === 'STANDBY_STABLE';

  const minThresh = settings.heaterMinTempThreshold ?? 26.0;
  const maxTarget = settings.heaterMaxTempTarget ?? 38.0;

  return (
    <div
      id="heater-dryer-status-card"
      className={`rounded-2xl p-3 sm:p-3.5 border transition-all ${
        isHeating
          ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-amber-950/30 border-rose-500/50 shadow-lg shadow-rose-950/30'
          : isResting
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/40'
          : isStandby
          ? 'bg-gradient-to-br from-emerald-950/25 via-slate-900 to-slate-950 border-emerald-500/30'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              isHeating
                ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                : isResting
                ? 'bg-amber-500/20 text-amber-400'
                : isStandby
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                12V Auxiliary Heater &amp; Dryer
              </h3>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isHeating
                    ? 'bg-rose-500 text-white'
                    : isResting
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : isStandby
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {heaterState?.status || 'IDLE / OFF'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Dual 12V Driver Channel B &bull; Auto Temp Maintenance
            </p>
          </div>
        </div>

        {/* Temperature Badge */}
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <Thermometer className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block leading-none">Sensor</span>
            <span className="text-xs font-mono font-bold text-white">
              {currentTemperature !== null && currentTemperature !== undefined
                ? `${currentTemperature.toFixed(1)}°C`
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Target Logic & Rule Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2.5 text-[10px] font-mono">
        <div className="p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
          <span className="text-slate-500 block text-[9px]">HEATER TRIGGER</span>
          <span className="text-rose-400 font-bold">&lt; {minThresh.toFixed(1)}°C (ON)</span>
        </div>
        <div className="p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
          <span className="text-slate-500 block text-[9px]">OPTIMAL TARGET</span>
          <span className="text-emerald-400 font-bold">&ge; {maxTarget.toFixed(1)}°C (OFF)</span>
        </div>
        <div className="p-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80 col-span-2 sm:col-span-1">
          <span className="text-slate-500 block text-[9px]">CANOPY SEAL</span>
          <span className={settings.heaterAutoCloseSheet ? 'text-amber-300 font-bold' : 'text-slate-400'}>
            {settings.heaterAutoCloseSheet ? 'HEAT TRAPPED' : 'VENT OPEN'}
          </span>
        </div>
      </div>

      {/* Live State Note */}
      {heaterState?.lastTriggerReason && (
        <div className="text-[10px] text-slate-300 bg-slate-950/60 p-1.5 rounded-md flex items-center gap-1.5 mb-2.5 border border-slate-800/60">
          <Info className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="truncate">{heaterState.lastTriggerReason}</span>
        </div>
      )}

      {/* Quick Action Controls */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onControlHeater('TEST_PULSE', 15)}
            className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Fire 12V heater for 15 seconds to verify wiring"
          >
            <Play className="w-3 h-3" />
            <span>15s Test</span>
          </button>

          {heaterState?.mode !== 'AUTO' ? (
            <button
              onClick={() => onControlHeater('AUTO')}
              className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Resume automatic sensor temperature maintenance"
            >
              <RotateCw className="w-3 h-3" />
              <span>Resume Auto</span>
            </button>
          ) : (
            <button
              onClick={() => onControlHeater('FORCE_ON')}
              className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Manually force 12V heater ON"
            >
              <Zap className="w-3 h-3" />
              <span>Force ON</span>
            </button>
          )}

          {isHeating && (
            <button
              onClick={() => onControlHeater('FORCE_OFF')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Stop heater immediately"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          title="Tune temperature thresholds and duty cycles"
        >
          <Sliders className="w-3 h-3 text-amber-400" />
          <span>Tune Thresholds</span>
        </button>
      </div>
    </div>
  );
};
