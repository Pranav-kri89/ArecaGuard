import React, { useState } from 'react';
import {
  Radio,
  RotateCw,
  Settings,
  RefreshCw,
  Layers,
  Square,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react';
import { MotorPingStatus, MotorSettings, CanopyMode, AppLanguage } from '../types';

interface MotorPingStatusCardProps {
  motorPing: MotorPingStatus | null;
  motorSettings: MotorSettings;
  canopyMode: CanopyMode;
  onPingMotor: () => Promise<void>;
  onTriggerMotorTest: (command: 'OPEN' | 'CLOSE' | 'MOTOR2' | 'STOP', customSeconds?: number) => Promise<void>;
  onOpenSettings: () => void;
  language: AppLanguage;
}

export const MotorPingStatusCard: React.FC<MotorPingStatusCardProps> = ({
  motorPing,
  motorSettings,
  canopyMode,
  onPingMotor,
  onTriggerMotorTest,
  onOpenSettings,
  language,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [recentLatency, setRecentLatency] = useState<number | null>(motorPing?.latencyMs ?? 18);

  const handlePing = async () => {
    setIsPinging(true);
    try {
      await onPingMotor();
      setRecentLatency(motorPing?.latencyMs ?? 18);
    } finally {
      setIsPinging(false);
    }
  };

  const isRotating = motorPing?.activeRotation && motorPing.activeRotation !== 'IDLE';

  return (
    <div className="p-4 sm:p-5 bg-slate-900/95 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <span>Roof Motor Connection & Ping</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Bi-directional motor relay telemetry & timing control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePing}
            disabled={isPinging}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Ping Motor Driver to verify link latency"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">{isPinging ? 'Pinging...' : 'Ping Link'}</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer shadow-sm"
            title="Open Motor Rotation Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ping Telemetry Status Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Ping Latency */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Ping Latency
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-emerald-400 font-mono">
              {recentLatency ?? 18}
            </span>
            <span className="text-[11px] text-slate-400">ms</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-medium block mt-0.5">
            Driver Responding
          </span>
        </div>

        {/* Roof Open Channel */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Roof Open (D26)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-amber-400 font-mono">
              {motorSettings.roofOpenSeconds}
            </span>
            <span className="text-[11px] text-slate-400">sec</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Relay 1 Ready
          </span>
        </div>

        {/* Roof Close Channel */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Roof Close (D25)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-rose-400 font-mono">
              {motorSettings.roofCloseSeconds}
            </span>
            <span className="text-[11px] text-slate-400">sec</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Relay 2 Ready
          </span>
        </div>

        {/* 2nd Motor Channel */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            2nd Motor (D33)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-indigo-400 font-mono">
              {motorSettings.motor2Enabled ? motorSettings.motor2RotationSeconds : 'OFF'}
            </span>
            <span className="text-[11px] text-slate-400">
              {motorSettings.motor2Enabled ? 'sec' : ''}
            </span>
          </div>
          <span className="text-[10px] text-indigo-300/80 font-medium block mt-0.5">
            {motorSettings.motor2Enabled ? motorSettings.motor2Mode : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Active Rotation Indicator Banner (Shows when motor is moving) */}
      {isRotating && (
        <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-3 text-amber-200 animate-pulse">
          <div className="flex items-center gap-2.5">
            <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
            <span className="text-xs font-bold">
              Motor Active: {motorPing?.activeRotation} in progress
            </span>
          </div>
          <button
            onClick={() => onTriggerMotorTest('STOP')}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Halt</span>
          </button>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">
            Rotate Motors:
          </span>
          <button
            onClick={() => onTriggerMotorTest('OPEN', motorSettings.roofOpenSeconds)}
            className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Open ({motorSettings.roofOpenSeconds}s)</span>
          </button>

          <button
            onClick={() => onTriggerMotorTest('CLOSE', motorSettings.roofCloseSeconds)}
            className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5 -scale-x-100" />
            <span>Close ({motorSettings.roofCloseSeconds}s)</span>
          </button>

          {motorSettings.motor2Enabled && (
            <button
              onClick={() => onTriggerMotorTest('MOTOR2', motorSettings.motor2RotationSeconds)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2nd Motor ({motorSettings.motor2RotationSeconds}s)</span>
            </button>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer py-1"
        >
          <span>Configure Rotation Seconds</span>
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
