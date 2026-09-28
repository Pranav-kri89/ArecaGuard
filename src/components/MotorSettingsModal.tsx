import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Settings,
  RotateCw,
  Clock,
  Zap,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Cpu,
  ChevronRight,
  RefreshCw,
  Layers,
  Activity
} from 'lucide-react';
import { MotorSettings, MotorPingStatus, AppLanguage } from '../types';

interface MotorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MotorSettings;
  onSaveSettings: (newSettings: MotorSettings) => Promise<void>;
  motorPing: MotorPingStatus | null;
  onPingMotor: () => Promise<void>;
  onTriggerMotorTest: (command: 'OPEN' | 'CLOSE' | 'MOTOR2' | 'STOP', customSeconds?: number) => Promise<void>;
  language: AppLanguage;
}

export const MotorSettingsModal: React.FC<MotorSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  motorPing,
  onPingMotor,
  onTriggerMotorTest,
  language: _language,
}) => {
  const [localSettings, setLocalSettings] = useState<MotorSettings>({
    ...settings,
    controlMode: settings.controlMode || 'DURATION',
    frontRotations: settings.frontRotations || 10,
    backRotations: settings.backRotations || 10,
    secondsPerRotation: settings.secondsPerRotation || 1.2,
    motor2Rotations: settings.motor2Rotations || 6,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [testActiveCommand, setTestActiveCommand] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [activeRotationCount, setActiveRotationCount] = useState<number>(0);

  useEffect(() => {
    setLocalSettings({
      ...settings,
      controlMode: settings.controlMode || 'DURATION',
      frontRotations: settings.frontRotations || 10,
      backRotations: settings.backRotations || 10,
      secondsPerRotation: settings.secondsPerRotation || 1.2,
      motor2Rotations: settings.motor2Rotations || 6,
    });
  }, [settings]);

  // Countdown timer for motor test runs and rotation check tracking
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => {
          const next = c - 1;
          if (localSettings.secondsPerRotation > 0) {
            const rotLeft = Math.ceil(next / localSettings.secondsPerRotation);
            setActiveRotationCount(Math.max(0, rotLeft));
          }
          return next;
        });
      }, 1000);
    } else if (testActiveCommand) {
      setTestActiveCommand(null);
      setActiveRotationCount(0);
    }
    return () => clearTimeout(timer);
  }, [countdown, testActiveCommand, localSettings.secondsPerRotation]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save motor settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    try {
      await onPingMotor();
    } finally {
      setIsPinging(false);
    }
  };

  const handleRunTest = async (cmd: 'OPEN' | 'CLOSE' | 'MOTOR2') => {
    let secs = 10;
    if (localSettings.controlMode === 'ROTATION') {
      const spRot = localSettings.secondsPerRotation || 1.2;
      if (cmd === 'OPEN') {
        const rots = localSettings.frontRotations || 10;
        secs = Math.max(1, Math.round(rots * spRot));
        setActiveRotationCount(rots);
      } else if (cmd === 'CLOSE') {
        const rots = localSettings.backRotations || 10;
        secs = Math.max(1, Math.round(rots * spRot));
        setActiveRotationCount(rots);
      } else if (cmd === 'MOTOR2') {
        const rots = localSettings.motor2Rotations || 6;
        secs = Math.max(1, Math.round(rots * spRot));
        setActiveRotationCount(rots);
      }
    } else {
      if (cmd === 'OPEN') secs = localSettings.roofOpenSeconds;
      else if (cmd === 'CLOSE') secs = localSettings.roofCloseSeconds;
      else if (cmd === 'MOTOR2') secs = localSettings.motor2RotationSeconds;
    }

    setTestActiveCommand(cmd);
    setCountdown(secs);
    await onTriggerMotorTest(cmd, secs);
  };

  // Rotation Chuck / Single Revolution Check Tool
  const handleRunSingleRotationCheck = async (direction: 'FRONT' | 'BACK') => {
    const checkSeconds = Math.max(1, Math.round(localSettings.secondsPerRotation || 1.2));
    setTestActiveCommand(`CHECK_1_ROT_${direction}`);
    setCountdown(checkSeconds);
    setActiveRotationCount(1);
    await onTriggerMotorTest(direction === 'FRONT' ? 'OPEN' : 'CLOSE', checkSeconds);
  };

  const handleStopTest = async () => {
    setCountdown(0);
    setActiveRotationCount(0);
    setTestActiveCommand(null);
    await onTriggerMotorTest('STOP');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Motor Rotation & Timing Settings</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ESP32 Actuator
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure separate opening, closing & 2nd motor rotation durations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Live Ping & Driver Connection Card */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Motor Driver Link & Ping Status
                </span>
              </div>

              <button
                onClick={handlePing}
                disabled={isPinging}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                <span>{isPinging ? 'Pinging Motor...' : 'Ping Motor Driver'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Ping Latency</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {motorPing?.latencyMs ?? 18} ms
                </span>
              </div>

              <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Roof Open (D26)</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {motorPing?.openChannelStatus || 'READY'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Roof Close (D25)</span>
                <span className="text-xs font-bold text-rose-400 font-mono">
                  {motorPing?.closeChannelStatus || 'READY'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">2nd Motor (D33)</span>
                <span className="text-xs font-bold text-indigo-400 font-mono">
                  {localSettings.motor2Enabled ? (motorPing?.motor2ChannelStatus || 'READY') : 'DISABLED'}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selector Toggle: Duration vs Rotation */}
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-bold text-white block">Motor Control Mode:</span>
                <span className="text-[10px] text-slate-400">
                  {localSettings.controlMode === 'ROTATION'
                    ? 'Gear revolutions & chuck alignment'
                    : 'Time duration in seconds'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, controlMode: 'DURATION' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  localSettings.controlMode === 'DURATION'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Duration (Sec)</span>
              </button>

              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, controlMode: 'ROTATION' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  localSettings.controlMode === 'ROTATION'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotation (Turns)</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ROTATION-BASED MODE CONTROLS & ROTATION CHUCK CHECK TOOL */}
          {/* ========================================================= */}
          {localSettings.controlMode === 'ROTATION' ? (
            <div className="space-y-4">
              {/* Rotation Calibration & Speed */}
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Gear Motor Rotation Calibration (Chuck Speed)</span>
                    </span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Time required for 1 full 360° rotation of your 12V gear motor shaft
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-xl font-black text-indigo-300">
                      {localSettings.secondsPerRotation.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">sec/turn</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0.3"
                    max="5.0"
                    step="0.1"
                    value={localSettings.secondsPerRotation}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        secondsPerRotation: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Fast (0.3s = 200 RPM)</span>
                    <span>Standard (1.2s = 50 RPM)</span>
                    <span>High Torque (3.0s = 20 RPM)</span>
                  </div>
                </div>

                {/* Single Rotation Check Tool (Rotation Chuck) */}
                <div className="pt-2 border-t border-indigo-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-200">
                      Rotation Chuck Check (Test 1 Revolution):
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Observe motor shaft to verify 360° turn
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunSingleRotationCheck('FRONT')}
                      disabled={testActiveCommand !== null}
                      className="py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Check 1 Turn (Front)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunSingleRotationCheck('BACK')}
                      disabled={testActiveCommand !== null}
                      className="py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-indigo-400 -scale-x-100" />
                      <span>Check 1 Turn (Back)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Front Rotations Setting (Open) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Roof OPEN Rotations (Front / Forward Turns)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      How many gear rotations to open the roof canopy completely
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-2xl font-black text-amber-400">
                      {localSettings.frontRotations}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">turns ({Math.round(localSettings.frontRotations * localSettings.secondsPerRotation)}s)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={localSettings.frontRotations}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, frontRotations: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                    <span>Quick presets:</span>
                    <div className="flex items-center gap-1.5">
                      {[4, 8, 10, 15, 20, 30].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setLocalSettings({ ...localSettings, frontRotations: r })}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition-all ${
                            localSettings.frontRotations === r
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          {r} turns
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Back Rotations Setting (Close) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>Roof CLOSE Rotations (Back / Reverse Turns)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      How many reverse gear rotations to seal the canopy tight against rain
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-2xl font-black text-rose-400">
                      {localSettings.backRotations}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">turns ({Math.round(localSettings.backRotations * localSettings.secondsPerRotation)}s)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={localSettings.backRotations}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, backRotations: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                    <span>Quick presets:</span>
                    <div className="flex items-center gap-1.5">
                      {[4, 8, 10, 15, 20, 30].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setLocalSettings({ ...localSettings, backRotations: r })}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition-all ${
                            localSettings.backRotations === r
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          {r} turns
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* DURATION-BASED MODE CONTROLS (SECONDS)                    */
            /* ========================================================= */
            <div className="space-y-4">
              {/* Setting 1: Roof OPEN Motor Rotation Duration */}
              <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Roof OPEN Rotation Duration (In/Open Seconds)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      How many seconds the primary motor rotates when opening the solar roof canopy
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {localSettings.roofOpenSeconds}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">sec</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={localSettings.roofOpenSeconds}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, roofOpenSeconds: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                    <span>Quick presets:</span>
                    <div className="flex items-center gap-1.5">
                      {[5, 10, 14, 20, 30].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setLocalSettings({ ...localSettings, roofOpenSeconds: sec })}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition-all ${
                            localSettings.roofOpenSeconds === sec
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Setting 2: Roof CLOSE Motor Rotation Duration */}
              <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>Roof CLOSE Rotation Duration (Out/Close Seconds)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Separate rotation duration for sealing the canopy against rain storms
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-rose-400 font-mono">
                      {localSettings.roofCloseSeconds}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">sec</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={localSettings.roofCloseSeconds}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, roofCloseSeconds: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                    <span>Quick presets:</span>
                    <div className="flex items-center gap-1.5">
                      {[5, 10, 14, 20, 30].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setLocalSettings({ ...localSettings, roofCloseSeconds: sec })}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition-all ${
                            localSettings.roofCloseSeconds === sec
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Setting 3: 2nd Motor Rotation Duration & Settings */}
          <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>2nd Motor Rotation Options (Secondary Roller / Shade)</span>
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure how many seconds the 2nd motor should rotate in one cycle
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.motor2Enabled}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, motor2Enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {localSettings.motor2Enabled && (
              <div className="space-y-4 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    2nd Motor Run Time per Cycle:
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-400 font-mono">
                      {localSettings.motor2RotationSeconds}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">sec</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={localSettings.motor2RotationSeconds}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, motor2RotationSeconds: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'SYNCHRONIZED', label: 'Sync with Roof', desc: 'Runs along with primary roof' },
                    { id: 'INDEPENDENT', label: 'Independent', desc: 'Triggered on separate command' },
                    { id: 'OPPOSITE', label: 'Inverted Polarity', desc: 'Opposite direction rotation' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setLocalSettings({ ...localSettings, motor2Mode: mode.id as any })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        localSettings.motor2Mode === mode.id
                          ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <span className="text-xs font-bold block">{mode.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Test Motor Rotation Buttons */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {localSettings.controlMode === 'ROTATION'
                    ? 'Execute Configured Gear Rotations'
                    : 'Test Motor Rotation (Timed Pulse)'}
                </span>
              </span>

              {testActiveCommand && (
                <span className="text-xs font-mono font-bold text-amber-400 animate-pulse flex items-center gap-1.5">
                  <span>Executing:</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded border border-amber-500/30 text-amber-300">
                    {countdown}s remaining {activeRotationCount > 0 ? `(~${activeRotationCount} turns left)` : ''}
                  </span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleRunTest('OPEN')}
                disabled={testActiveCommand !== null}
                className="p-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>
                  {localSettings.controlMode === 'ROTATION'
                    ? `Execute Open (${localSettings.frontRotations} turns)`
                    : `Test Open (${localSettings.roofOpenSeconds}s)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRunTest('CLOSE')}
                disabled={testActiveCommand !== null}
                className="p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-4 h-4 -scale-x-100" />
                <span>
                  {localSettings.controlMode === 'ROTATION'
                    ? `Execute Close (${localSettings.backRotations} turns)`
                    : `Test Close (${localSettings.roofCloseSeconds}s)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRunTest('MOTOR2')}
                disabled={testActiveCommand !== null || !localSettings.motor2Enabled}
                className="p-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>
                  {localSettings.controlMode === 'ROTATION'
                    ? `2nd Motor (${localSettings.motor2Rotations} turns)`
                    : `2nd Motor (${localSettings.motor2RotationSeconds}s)`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleStopTest}
                className="p-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <Square className="w-4 h-4 text-rose-400 fill-rose-400" />
                <span>Stop Motors</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Save Action */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
          <div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings saved to controller!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
