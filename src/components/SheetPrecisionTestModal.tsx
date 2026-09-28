import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Wrench,
  Sun,
  Shield,
  Square,
  CheckCircle2,
  Clock,
  Sliders,
  RotateCcw,
  Zap,
  Info,
  Timer,
  ChevronDown,
  History,
} from 'lucide-react';
import { RoofPersistentState, FarmSettings, MotorSettings } from '../types';

interface SheetPrecisionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  roofState: RoofPersistentState | null;
  onMomentaryCommand: (command: 'MOMENTARY_OPEN' | 'MOMENTARY_CLOSE' | 'STOP') => Promise<void>;
  onCalibratePosition: (position: 'OPEN' | 'CLOSED') => Promise<void>;
  motorSettings: MotorSettings;
  onSaveSettings: (settings: FarmSettings) => Promise<void>;
}

export const SheetPrecisionTestModal: React.FC<SheetPrecisionTestModalProps> = ({
  isOpen,
  onClose,
  roofState,
  onMomentaryCommand,
  onCalibratePosition,
  motorSettings,
  onSaveSettings,
}) => {
  const [holdingAction, setHoldingAction] = useState<'OPEN' | 'CLOSE' | null>(null);
  const [elapsedHoldMs, setElapsedHoldMs] = useState<number>(0);
  const [lastHoldSummary, setLastHoldSummary] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationFeedback, setCalibrationFeedback] = useState<string | null>(null);

  // Quick Parameter Tuning
  const [openSecInput, setOpenSecInput] = useState<number>(motorSettings.roofOpenSeconds || 10);
  const [closeSecInput, setCloseSecInput] = useState<number>(motorSettings.roofCloseSeconds || 14);
  const [isSavingTimers, setIsSavingTimers] = useState(false);
  const [timerSaveMessage, setTimerSaveMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const isHeldRef = useRef<boolean>(false);

  useEffect(() => {
    setOpenSecInput(motorSettings.roofOpenSeconds || 10);
    setCloseSecInput(motorSettings.roofCloseSeconds || 14);
  }, [motorSettings.roofOpenSeconds, motorSettings.roofCloseSeconds]);

  // Clean up interval if modal closes or component unmounts
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      if (isHeldRef.current) {
        onMomentaryCommand('STOP');
      }
    };
  }, [onMomentaryCommand]);

  if (!isOpen) return null;

  const handleStartHold = (direction: 'OPEN' | 'CLOSE') => {
    if (isHeldRef.current) return;
    isHeldRef.current = true;
    setHoldingAction(direction);
    setElapsedHoldMs(0);
    setLastHoldSummary(null);
    holdStartTimeRef.current = Date.now();

    // Trigger motor start on backend/ESP32
    const cmd = direction === 'OPEN' ? 'MOMENTARY_OPEN' : 'MOMENTARY_CLOSE';
    onMomentaryCommand(cmd);

    // Dynamic timer ticker
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = setInterval(() => {
      setElapsedHoldMs(Date.now() - holdStartTimeRef.current);
    }, 50);

    // Global release fallback so releasing mouse or touch anywhere guarantees motor halts
    const globalRelease = () => {
      window.removeEventListener('pointerup', globalRelease);
      window.removeEventListener('mouseup', globalRelease);
      window.removeEventListener('touchend', globalRelease);
      handleEndHold();
    };
    window.addEventListener('pointerup', globalRelease, { once: true });
    window.addEventListener('mouseup', globalRelease, { once: true });
    window.addEventListener('touchend', globalRelease, { once: true });
  };

  const handleEndHold = () => {
    if (!isHeldRef.current) return;
    isHeldRef.current = false;

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    const durationSeconds = Number(((Date.now() - holdStartTimeRef.current) / 1000).toFixed(2));
    const actionLabel = holdingAction === 'OPEN' ? 'Opened' : 'Closed';
    setLastHoldSummary(`Sheet ${actionLabel} for ${durationSeconds}s — Motor Stopped immediately.`);
    setHoldingAction(null);

    // Immediately halt motor
    onMomentaryCommand('STOP');
  };

  const handleManualCalibrate = async (pos: 'OPEN' | 'CLOSED') => {
    setIsCalibrating(true);
    setCalibrationFeedback(null);
    try {
      await onCalibratePosition(pos);
      setCalibrationFeedback(`Position synced: System calibrated to 100% ${pos}`);
    } catch {
      setCalibrationFeedback('Failed to calibrate position.');
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleSaveTimers = async () => {
    setIsSavingTimers(true);
    setTimerSaveMessage(null);
    try {
      await onSaveSettings({
        ...motorSettings,
        roofOpenSeconds: Math.max(1, Math.min(180, Number(openSecInput))),
        roofCloseSeconds: Math.max(1, Math.min(180, Number(closeSecInput))),
      });
      setTimerSaveMessage('Open & Close cycle durations saved successfully!');
    } catch {
      setTimerSaveMessage('Failed to save parameters.');
    } finally {
      setIsSavingTimers(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Sheet Precision Test &amp; Inching</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700/60 uppercase">
                  Long-Press Mode
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Hold button to run motor &bull; Release to stop instantly (No cycle restrictions)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isHeldRef.current) handleEndHold();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs">
          {/* Instructions Box */}
          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sky-300">
                Precision Inching: Motor runs strictly while held
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Use long-press to nudge the sheet millimeter by millimeter to test mechanical alignment.
                There are <strong>no alternating lockouts</strong> in this test mode. Once aligned, tap
                the calibration button below to save the physical state.
              </p>
            </div>
          </div>

          {/* Active Hold Status Visualizer */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Current Inching Actuation Status
            </div>

            {holdingAction ? (
              <div className="flex flex-col items-center gap-1.5 animate-pulse">
                <div className={`text-sm sm:text-base font-extrabold flex items-center gap-2 ${
                  holdingAction === 'OPEN' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {holdingAction === 'OPEN' ? <Sun className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  <span>HOLDING: INCHING {holdingAction === 'OPEN' ? 'OPEN' : 'CLOSE'}</span>
                </div>
                <div className="font-mono text-2xl font-black text-white">
                  {(elapsedHoldMs / 1000).toFixed(2)}s
                </div>
                <span className="text-[10px] text-slate-400">
                  Release your finger or mouse to stop motor instantly
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                  <span>Motor IDLE (Awaiting Hold Press)</span>
                </div>
                {lastHoldSummary && (
                  <p className="text-[11px] text-emerald-400 font-mono mt-1">
                    {lastHoldSummary}
                  </p>
                )}
              </div>
            )}

            {/* Current Virtual State Display */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-400">
              <span>Tracked Position:</span>
              <span className="font-bold text-white font-mono">
                {roofState?.physicalRoofPosition || 'UNKNOWN'} (Last: {roofState?.lastCompletedAction || 'NONE'})
              </span>
            </div>
          </div>

          {/* TWO PRIMARY MOMENTARY HOLD BUTTONS */}
          <div className="grid grid-cols-2 gap-3">
            {/* HOLD TO OPEN BUTTON */}
            <button
              id="test-hold-open-btn"
              type="button"
              style={{ touchAction: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                handleStartHold('OPEN');
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                handleEndHold();
              }}
              onPointerCancel={(e) => {
                e.preventDefault();
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                handleEndHold();
              }}
              className={`p-4 sm:p-5 rounded-2xl font-extrabold flex flex-col items-center justify-center gap-2 select-none touch-none cursor-pointer transition-all border shadow-lg ${
                holdingAction === 'OPEN'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 ring-4 ring-amber-500/40 scale-98 shadow-amber-500/30'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-amber-300 border-amber-500/40 hover:border-amber-400'
              }`}
            >
              <Sun className={`w-8 h-8 ${holdingAction === 'OPEN' ? 'animate-spin' : ''}`} />
              <div className="text-center">
                <div className="text-sm sm:text-base tracking-wide">HOLD TO OPEN</div>
                <div className={`text-[10px] font-normal ${holdingAction === 'OPEN' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                  {holdingAction === 'OPEN' ? 'Running Forward...' : 'Press & Hold to Jog'}
                </div>
              </div>
            </button>

            {/* HOLD TO CLOSE BUTTON */}
            <button
              id="test-hold-close-btn"
              type="button"
              style={{ touchAction: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                handleStartHold('CLOSE');
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                handleEndHold();
              }}
              onPointerCancel={(e) => {
                e.preventDefault();
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                handleEndHold();
              }}
              className={`p-4 sm:p-5 rounded-2xl font-extrabold flex flex-col items-center justify-center gap-2 select-none touch-none cursor-pointer transition-all border shadow-lg ${
                holdingAction === 'CLOSE'
                  ? 'bg-rose-500 text-white border-rose-300 ring-4 ring-rose-500/40 scale-98 shadow-rose-500/30'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-rose-300 border-rose-500/40 hover:border-rose-400'
              }`}
            >
              <Shield className={`w-8 h-8 ${holdingAction === 'CLOSE' ? 'animate-pulse' : ''}`} />
              <div className="text-center">
                <div className="text-sm sm:text-base tracking-wide">HOLD TO CLOSE</div>
                <div className={`text-[10px] font-normal ${holdingAction === 'CLOSE' ? 'text-rose-100 font-bold' : 'text-slate-400'}`}>
                  {holdingAction === 'CLOSE' ? 'Running Reverse...' : 'Press & Hold to Jog'}
                </div>
              </div>
            </button>
          </div>

          {/* Emergency Safety Stop (Immediate One-Click Halt) */}
          <button
            id="test-emergency-stop-btn"
            onClick={() => {
              handleEndHold();
              onMomentaryCommand('STOP');
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
            <span>Emergency STOP (Immediate Motor Cutoff)</span>
          </button>

          {/* Synchronize & Calibrate Position */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs">Sheet Position Alignment Sync</span>
              <span className="text-[10px] text-slate-400">Save current physical edge</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Once you have nudged the sheet to the exact physical limit, calibrate the backend state so normal automatic cycles stay in sync:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isCalibrating}
                onClick={() => handleManualCalibrate('OPEN')}
                className="py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Mark as 100% Fully Open</span>
              </button>

              <button
                disabled={isCalibrating}
                onClick={() => handleManualCalibrate('CLOSED')}
                className="py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Mark as 100% Fully Closed</span>
              </button>
            </div>
            {calibrationFeedback && (
              <p className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{calibrationFeedback}</span>
              </p>
            )}
          </div>

          {/* Quick Cycle Parameter Adjustment */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span>Roof Open &amp; Close Duration Parameters</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Synced to ESP32</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Open Duration (Seconds):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={openSecInput}
                    onChange={(e) => setOpenSecInput(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-amber-400 outline-none"
                  />
                  <span className="text-slate-400 font-mono">s</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Close Duration (Seconds):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={closeSecInput}
                    onChange={(e) => setCloseSecInput(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-rose-400 outline-none"
                  />
                  <span className="text-slate-400 font-mono">s</span>
                </div>
              </div>
            </div>

            <button
              disabled={isSavingTimers}
              onClick={handleSaveTimers}
              className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isSavingTimers ? 'Saving...' : 'Save & Update Timers'}</span>
            </button>

            {timerSaveMessage && (
              <p className="text-[11px] font-mono text-emerald-400 text-center">
                {timerSaveMessage}
              </p>
            )}
          </div>

          {/* Collapsible Backend Movement History */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full p-2.5 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>Backend Tracked Recent Actions ({roofState?.recentEvents?.length || 0})</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="p-2.5 border-t border-slate-800 space-y-1.5 max-h-40 overflow-y-auto">
                {roofState?.recentEvents && roofState.recentEvents.length > 0 ? (
                  roofState.recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            ev.action === 'OPEN'
                              ? 'text-amber-300 bg-amber-950'
                              : ev.action === 'CLOSED'
                              ? 'text-rose-300 bg-rose-950'
                              : ev.action === 'STOP'
                              ? 'text-red-300 bg-red-950'
                              : 'text-sky-300 bg-sky-950'
                          }`}
                        >
                          {ev.action}
                        </span>
                        <span className="text-slate-300">{ev.source}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        {ev.duration > 0 ? `${ev.duration}s &bull; ` : ''}
                        {ev.timeLabel}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500 italic text-center py-2">
                    No movement events recorded yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
