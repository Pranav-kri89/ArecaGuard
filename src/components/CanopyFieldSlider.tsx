import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Sun,
  RotateCw,
  Zap,
  Square,
  Play,
  Lock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { CanopyMode, MotorSettings, RoofPersistentState } from '../types';

interface CanopyFieldSliderProps {
  canopyMode: CanopyMode;
  onSetCanopyMode: (mode: CanopyMode) => void;
  isRainThreat: boolean;
  motorSettings?: MotorSettings;
  roofState?: RoofPersistentState | null;
  onEmergencyStop?: () => Promise<void>;
  onResumeStart?: () => Promise<void>;
  onDirectMotorTest?: (cmd: 'OPEN' | 'CLOSE' | 'STOP' | 'MOMENTARY_OPEN' | 'MOMENTARY_CLOSE') => Promise<void>;
  onOpenTestModal?: () => void;
  onViewLogs?: () => void;
}

export const CanopyFieldSlider: React.FC<CanopyFieldSliderProps> = ({
  canopyMode,
  onSetCanopyMode,
  isRainThreat,
  motorSettings,
  roofState,
  onEmergencyStop,
  onResumeStart,
  onDirectMotorTest,
  onOpenTestModal,
  onViewLogs,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(canopyMode === 'CLOSED' ? 0 : 100);
  const [isDragging, setIsDragging] = useState(false);
  const [localMoving, setLocalMoving] = useState(false);
  const [localRemaining, setLocalRemaining] = useState<number>(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const motorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calibrated cycle durations
  const roofOpenSec = motorSettings?.roofOpenSeconds || 10;
  const roofCloseSec = motorSettings?.roofCloseSeconds || 14;

  // Real-time backend motor motion detection
  const isServerMoving =
    roofState?.activeMotorRotation === 'OPENING' || roofState?.activeMotorRotation === 'CLOSING';
  const isMoving = isServerMoving || localMoving;

  const activeRemaining =
    isServerMoving && typeof roofState?.activeRemainingSeconds === 'number'
      ? roofState.activeRemainingSeconds
      : localRemaining;

  // Alternating state: 'OPEN' | 'CLOSED' | 'NONE'
  const lastAction = roofState?.lastCompletedAction ?? (canopyMode === 'CLOSED' ? 'CLOSED' : 'OPEN');
  const physicalPos = roofState?.physicalRoofPosition ?? (canopyMode === 'CLOSED' ? 'CLOSED' : 'OPEN');

  // Emergency Stopped and Latching State Detection
  const isEmergencyStopped = canopyMode === 'STOPPED' || Boolean(roofState?.isEmergencyStopped) || physicalPos === 'STOPPED';
  const isStoppedRecovery = isEmergencyStopped;

  // Strict physical state evaluation:
  // When opened: isRoofStrictlyOpen = true.
  // When closed: isRoofStrictlyClosed = true.
  const isRoofStrictlyOpen =
    !isStoppedRecovery &&
    (physicalPos === 'OPEN' ||
      (isMoving && roofState?.activeMotorRotation === 'OPENING') ||
      (!roofState && canopyMode === 'OPEN') ||
      sliderPos >= 90);

  const isRoofStrictlyClosed =
    !isStoppedRecovery &&
    (physicalPos === 'CLOSED' ||
      (isMoving && roofState?.activeMotorRotation === 'CLOSING') ||
      (!roofState && canopyMode === 'CLOSED') ||
      sliderPos <= 10);

  // User Requirement:
  // 1. Once opened (or status is OPEN): do NOT show the open button again!
  //    ONLY show Close, Stop/Start, Auto AI.
  // 2. Next, after clicking Close (or status is CLOSED): the Open button appears,
  //    and the Close button disappears!
  // 3. In emergency stopped or halted/midway recovery: show BOTH so operator can jog either way.
  const showCloseButton = isStoppedRecovery || !isRoofStrictlyClosed;
  const showOpenButton = isStoppedRecovery || !isRoofStrictlyOpen;

  const isCloseDisabled = isMoving && roofState?.activeMotorRotation === 'CLOSING';
  const isOpenDisabled = isMoving && roofState?.activeMotorRotation === 'OPENING';

  // Sync position from roofState or mode
  useEffect(() => {
    if (!isDragging && !isMoving) {
      if (canopyMode === 'CLOSED') {
        setSliderPos(0);
      } else if (canopyMode === 'OPEN') {
        setSliderPos(100);
      } else if (physicalPos === 'CLOSED') {
        setSliderPos(0);
      } else if (physicalPos === 'OPEN') {
        setSliderPos(100);
      } else if (canopyMode === 'AUTO') {
        setSliderPos(isRainThreat ? 0 : 100);
      }
    }
  }, [physicalPos, canopyMode, isRainThreat, isDragging, isMoving]);

  const triggerLocalCountdown = (seconds: number) => {
    setLocalMoving(true);
    setLocalRemaining(seconds);

    if (motorTimerRef.current) clearInterval(motorTimerRef.current);
    const step = 0.5;
    motorTimerRef.current = setInterval(() => {
      setLocalRemaining((prev) => {
        if (prev <= step) {
          if (motorTimerRef.current) clearInterval(motorTimerRef.current);
          setLocalMoving(false);
          return 0;
        }
        return Number((prev - step).toFixed(1));
      });
    }, step * 1000);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMoving) return; // Locked while motor is running
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isMoving) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // safe fallback
    }

    if (isMoving) return;

    // Snap cleanly: <= 50% snaps to 0 (CLOSED), > 50% snaps to 100 (OPEN)
    if (sliderPos <= 50) {
      if (isCloseDisabled) {
        // Can't close if already closed, snap back
        setSliderPos(100);
        return;
      }
      setSliderPos(0);
      triggerLocalCountdown(roofCloseSec);
      onSetCanopyMode('CLOSED');
    } else {
      if (isOpenDisabled) {
        // Can't open if already open, snap back
        setSliderPos(0);
        return;
      }
      setSliderPos(100);
      triggerLocalCountdown(roofOpenSec);
      onSetCanopyMode('OPEN');
    }
  };

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = Math.round((clampedX / rect.width) * 100);
    setSliderPos(pct);
  };

  const handleCloseClick = () => {
    if (isCloseDisabled) return;
    setSliderPos(0);
    triggerLocalCountdown(roofCloseSec);
    onSetCanopyMode('CLOSED');
  };

  const handleOpenClick = () => {
    if (isOpenDisabled) return;
    setSliderPos(100);
    triggerLocalCountdown(roofOpenSec);
    onSetCanopyMode('OPEN');
  };

  const handleStopClick = async () => {
    if (motorTimerRef.current) {
      clearInterval(motorTimerRef.current);
      motorTimerRef.current = null;
    }
    setLocalMoving(false);
    setLocalRemaining(0);
    if (onEmergencyStop) {
      await onEmergencyStop();
    }
  };

  const handleStartClick = async () => {
    if (motorTimerRef.current) {
      clearInterval(motorTimerRef.current);
      motorTimerRef.current = null;
    }
    setLocalMoving(false);
    setLocalRemaining(0);
    if (onResumeStart) {
      await onResumeStart();
    } else {
      onSetCanopyMode('AUTO');
    }
  };

  const isClosed = sliderPos <= 50;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-md w-full">
      {/* Header with status & Inching shortcut */}
      <div className="flex items-center justify-between mb-2 sm:mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Shield className={`w-4 h-4 ${isClosed ? 'text-rose-400' : 'text-amber-400'}`} />
          <span>Roof Canopy:</span>
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg ${
              isMoving
                ? 'text-sky-300 bg-sky-950/80 border border-sky-800/60 animate-pulse'
                : isStoppedRecovery
                ? 'text-amber-300 bg-amber-950/80 border border-amber-800/60'
                : isClosed
                ? 'text-rose-300 bg-rose-950/80 border border-rose-800/60'
                : 'text-emerald-300 bg-emerald-950/80 border border-emerald-800/60'
            }`}
          >
            {isMoving
              ? roofState?.activeMotorRotation === 'OPENING'
                ? `Opening (${activeRemaining}s left)`
                : `Closing (${activeRemaining}s left)`
              : isStoppedRecovery
              ? 'Halted / Mismatch'
              : isClosed
              ? '100% Fully Closed'
              : '100% Fully Open'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onViewLogs && (
            <button
              onClick={onViewLogs}
              className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/40 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
              title="Open Creator Diagnostic Log Stream to see why motor is ON/OFF or holding"
            >
              <Activity className="w-3 h-3 text-indigo-400" />
              <span>Creator Log</span>
            </button>
          )}

          {/* Test Sheet Inching Link */}
          {onOpenTestModal && (
            <button
              onClick={onOpenTestModal}
              className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/40 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
              title="Open Inching & Sheet Alignment Test Mode (No Lockout)"
            >
              <Wrench className="w-3 h-3 text-sky-400" />
              <span>Sheet Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Streamlined Sequence & Status Bar */}
      <div
        className={`mb-2.5 px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between transition-colors ${
          isMoving
            ? 'bg-sky-950/40 border-sky-500/40 text-sky-300'
            : isStoppedRecovery
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            : 'bg-slate-950/90 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {isMoving ? (
            <>
              <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
              <span className="font-bold text-sky-300 truncate">
                Motor active &bull; {activeRemaining}s remaining
              </span>
            </>
          ) : isStoppedRecovery ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-amber-300 truncate">
                Motor halted &bull; Re-align sheet
              </span>
            </>
          ) : lastAction === 'OPEN' || physicalPos === 'OPEN' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                Roof Open &bull; <strong className="text-rose-400 font-bold">Close</strong> available
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">
                Roof Closed &bull; <strong className="text-amber-400 font-bold">Open</strong> available
              </span>
            </>
          )}
        </div>

        {/* Small badge showing calibrated seconds */}
        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          {roofOpenSec}s / {roofCloseSec}s
        </span>
      </div>

      {/* Interactive Track: Left is CLOSED, Right is OPEN */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative h-11 sm:h-12 bg-slate-950 rounded-xl border border-slate-700/80 overflow-hidden touch-none select-none flex items-center mb-3 shadow-inner ${
          isMoving ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
        }`}
      >
        {/* Left Side: Closed (Shield) | Right Side: Open (Sun) */}
        <div className="absolute inset-0 flex items-center justify-between px-3.5 sm:px-4 text-[11px] sm:text-xs font-bold pointer-events-none z-10">
          <span className="flex items-center gap-1.5 text-rose-400">
            <Shield className="w-3.5 h-3.5" />
            <span>CLOSED</span>
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <Sun className="w-3.5 h-3.5" />
            <span>OPEN</span>
          </span>
        </div>

        {/* Solar exposure fill layer */}
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r from-rose-950/30 via-amber-950/40 to-amber-500/25 pointer-events-none transition-opacity ${
            sliderPos > 2 ? 'border-r border-amber-400/80 opacity-90' : 'border-none opacity-0'
          }`}
          style={{
            width: `${sliderPos}%`,
            transition: isDragging ? 'none' : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Sleek circular knob */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900 border border-slate-300/80 shadow-md shadow-black/80 flex items-center justify-center pointer-events-none z-20 ring-1 ring-slate-900/60"
          style={{
            left: `calc(4px + (100% - 36px) * (${sliderPos} / 100))`,
            transition: isDragging ? 'none' : 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {isClosed ? (
            <Shield className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          )}
        </div>
      </div>

      {/* AUTO MODE LOCKED INDICATOR */}
      {canopyMode === 'AUTO' && (
        <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-emerald-200">Locked in Auto:</span>
            <span className="text-[11px] text-emerald-300/90 truncate">Autonomous open & close active on sensor variations</span>
          </div>
          <span className="flex h-2 w-2 relative shrink-0 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      )}

      {/* QUICK MODE & MOTOR BUTTONS ROW:
          - When OPEN: Show [CLOSE] --- [STOP / START] --- [AUTO] (3 cols)
          - When CLOSED: Show [OPEN] --- [STOP / START] --- [AUTO] (3 cols)
          - When STOPPED / RECOVERY: Show [CLOSE] --- [OPEN] --- [START] --- [AUTO] (4 cols)
      */}
      <div className={`grid ${showCloseButton && showOpenButton ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 sm:gap-2`}>
        {/* CLOSE BUTTON (Shown only when open or in stopped recovery) */}
        {showCloseButton && (
          <button
            id="roof-action-close-btn"
            disabled={isCloseDisabled}
            onClick={handleCloseClick}
            className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
              isCloseDisabled
                ? 'bg-rose-950/40 text-rose-300/80 border border-rose-800/40 cursor-wait'
                : isMoving && roofState?.activeMotorRotation === 'CLOSING'
                ? 'bg-rose-600 text-white font-extrabold cursor-wait'
                : 'bg-rose-600 hover:bg-rose-500 text-white font-extrabold cursor-pointer active:scale-98 shadow-md'
            }`}
            title={isMoving ? 'Motor in motion' : `Run Close motor for ${roofCloseSec}s`}
          >
            {isMoving && roofState?.activeMotorRotation === 'CLOSING' ? (
              <RotateCw className="w-4 h-4 text-white animate-spin shrink-0" />
            ) : (
              <Shield className="w-4 h-4 text-white shrink-0" />
            )}
            <span className="truncate">
              {isMoving && roofState?.activeMotorRotation === 'CLOSING'
                ? `${activeRemaining}s`
                : 'Close'}
            </span>
          </button>
        )}

        {/* OPEN BUTTON (Shown only when closed or in stopped recovery) */}
        {showOpenButton && (
          <button
            id="roof-action-open-btn"
            disabled={isOpenDisabled}
            onClick={handleOpenClick}
            className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
              isOpenDisabled
                ? 'bg-amber-950/40 text-amber-300/80 border border-amber-800/40 cursor-wait'
                : isMoving && roofState?.activeMotorRotation === 'OPENING'
                ? 'bg-amber-500 text-slate-950 font-extrabold cursor-wait'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer active:scale-98 shadow-md'
            }`}
            title={isMoving ? 'Motor in motion' : `Run Open motor for ${roofOpenSec}s`}
          >
            {isMoving && roofState?.activeMotorRotation === 'OPENING' ? (
              <RotateCw className="w-4 h-4 text-slate-950 animate-spin shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-slate-950 shrink-0" />
            )}
            <span className="truncate">
              {isMoving && roofState?.activeMotorRotation === 'OPENING'
                ? `${activeRemaining}s`
                : 'Open'}
            </span>
          </button>
        )}

        {/* EMERGENCY STOP / START LATCHING BUTTON */}
        {isEmergencyStopped ? (
          <button
            id="roof-emergency-start-btn"
            onClick={handleStartClick}
            className="py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 font-extrabold animate-pulse"
            title="System Stopped / Motor Terminated: Click START to resume auto-pilot & motor"
          >
            <Play className="w-3.5 h-3.5 fill-current text-white shrink-0" />
            <span className="font-extrabold uppercase tracking-wider text-xs">START</span>
          </button>
        ) : (
          <button
            id="roof-emergency-stop-btn"
            onClick={handleStopClick}
            className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
              isMoving
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400'
                : 'bg-rose-950/70 hover:bg-rose-900 border border-rose-600/70 text-rose-200'
            }`}
            title="Emergency Stop: Halt & terminate motor immediately"
          >
            <Square className="w-3.5 h-3.5 fill-current text-white shrink-0" />
            <span className="font-extrabold uppercase tracking-wider text-xs">STOP</span>
          </button>
        )}

        {/* AUTO BUTTON (Forecast & Sensor Driven - Locks into Auto Mode) */}
        <button
          id="roof-auto-mode-btn"
          disabled={isMoving}
          onClick={() => onSetCanopyMode('AUTO')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            isMoving
              ? 'bg-slate-950/50 text-slate-600 border border-slate-800/40 cursor-not-allowed'
              : canopyMode === 'AUTO'
              ? 'bg-emerald-600 ring-2 ring-emerald-400/80 text-white shadow-lg shadow-emerald-950/60 font-black cursor-pointer'
              : 'bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 cursor-pointer active:scale-98'
          }`}
          title={
            isMoving
              ? 'Motor in motion'
              : canopyMode === 'AUTO'
              ? 'Locked in Auto Mode: Running autonomously on sensor & forecast variations'
              : 'Switch to Auto Mode: Autonomous operation on forecast & sensor data'
          }
        >
          {canopyMode === 'AUTO' ? (
            <Lock className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
          ) : (
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{canopyMode === 'AUTO' ? 'Auto Locked' : 'Auto'}</span>
        </button>
      </div>
    </div>
  );
};
