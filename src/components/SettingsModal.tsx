import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  RotateCw,
  Flame,
  Gauge,
  CloudRain,
  Radio,
  Cable,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Square,
  ArrowLeft,
  Thermometer,
  ShieldCheck,
  Zap,
  Info,
  Sun,
  Timer,
  Send,
  ExternalLink,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { FarmSettings, HeaterDryerState, MotorPingStatus, AppLanguage } from '../types';
import { DiagnosticAuditLog } from './DiagnosticAuditLog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FarmSettings;
  onSaveSettings: (newSettings: FarmSettings) => Promise<void>;
  motorPing: MotorPingStatus | null;
  onPingMotor: () => Promise<void>;
  onTriggerMotorTest: (command: 'OPEN' | 'CLOSE' | 'MOTOR2' | 'STOP', customSeconds?: number) => Promise<void>;
  heaterState?: HeaterDryerState | null;
  onControlHeater?: (action: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF' | 'TEST_PULSE', customDurationSec?: number) => Promise<void>;
  currentTemperature?: number | null;
  currentRainAnalog?: number | null;
  currentLightAdc?: number | null;
  language?: AppLanguage;
  initialTab?: TabType;
}

export type TabType = 'HEATER' | 'SENSORS' | 'ONLINE' | 'TELEGRAM' | 'MOTOR' | 'WIRING' | 'DIAGNOSTICS';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  motorPing,
  onPingMotor,
  onTriggerMotorTest,
  heaterState,
  onControlHeater,
  currentTemperature,
  currentRainAnalog,
  currentLightAdc,
  language: _language,
  initialTab = 'HEATER',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const [localSettings, setLocalSettings] = useState<FarmSettings>({
    ...settings,
    heaterAutoEnabled: settings.heaterAutoEnabled ?? true,
    heaterMinTempThreshold: settings.heaterMinTempThreshold ?? 26.0,
    heaterMaxTempTarget: settings.heaterMaxTempTarget ?? 38.0,
    heaterAutoCloseSheet: settings.heaterAutoCloseSheet ?? true,
    heaterMaxContinuousMinutes: settings.heaterMaxContinuousMinutes ?? 15,
    heaterCooldownMinutes: settings.heaterCooldownMinutes ?? 2,
    heaterPwmPower: settings.heaterPwmPower ?? 100,
    heaterPinIn3: settings.heaterPinIn3 ?? 33,
    heaterPinIn4: settings.heaterPinIn4 ?? 32,
    heaterPinEnb: settings.heaterPinEnb ?? 12,
    rainAnalogThreshold: settings.rainAnalogThreshold ?? 2800,
    rainDigitalInvert: settings.rainDigitalInvert ?? false,
    rainDebounceChecks: settings.rainDebounceChecks ?? 3,
    dryDebounceChecks: settings.dryDebounceChecks ?? 4,
    sunlightDayLuxAdc: settings.sunlightDayLuxAdc ?? 2600,
    nightDetectionThreshold: settings.nightDetectionThreshold ?? 3400,
    sunlightMinAdc: settings.sunlightMinAdc ?? 150,
    sunlightMaxAdc: settings.sunlightMaxAdc ?? 4095,
    onlineRainProbabilityThreshold: settings.onlineRainProbabilityThreshold ?? 30,
    onlinePrecipRateThreshold: settings.onlinePrecipRateThreshold ?? 0.5,
    onlineCloudCoverThreshold: settings.onlineCloudCoverThreshold ?? 50,
    onlineSyncIntervalMinutes: settings.onlineSyncIntervalMinutes ?? 5,
    controlMode: settings.controlMode || 'DURATION',
    frontRotations: settings.frontRotations || 10,
    backRotations: settings.backRotations || 10,
    secondsPerRotation: settings.secondsPerRotation || 1.2,
    roofOpenSeconds: settings.roofOpenSeconds || 10,
    roofCloseSeconds: settings.roofCloseSeconds || 14,
    motorSpeedPercent: settings.motorSpeedPercent || 100,
    reverseDirection: settings.reverseDirection || false,
    motor2Enabled: settings.motor2Enabled ?? true,
    motor2RotationSeconds: settings.motor2RotationSeconds || 8,
    motor2Rotations: settings.motor2Rotations || 6,
    motor2Mode: settings.motor2Mode || 'SYNCHRONIZED',
    autoStopSafetyLimit: settings.autoStopSafetyLimit || 30,
    aiMode: settings.aiMode ?? 'AUTONOMOUS',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [testActiveCommand, setTestActiveCommand] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Telegram Bot integration state
  const [telegramStatus, setTelegramStatus] = useState<{
    isLive: boolean;
    registeredUsersCount: number;
    botUsername?: string;
  } | null>(null);
  const [isSendingAlert, setIsSendingAlert] = useState<boolean>(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/telegram/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTelegramStatus({
              isLive: data.isLive,
              registeredUsersCount: data.registeredUsersCount ?? 1,
              botUsername: data.botUsername || 'ArecaFarmDryerbot',
            });
          }
        })
        .catch((err) => console.error('Failed to fetch telegram status:', err));
    }
  }, [isOpen]);

  const handleSendTestAlert = async () => {
    setIsSendingAlert(true);
    setAlertSuccessMsg(null);
    try {
      const res = await fetch('/api/telegram/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Manual test alert dispatched from Settings' }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertSuccessMsg(`Dispatched test notification to ${data.sentToCount || 1} registered phone(s)!`);
        setTimeout(() => setAlertSuccessMsg(null), 4500);
      } else {
        setAlertSuccessMsg(data.message || 'Dispatched alert request to bot.');
        setTimeout(() => setAlertSuccessMsg(null), 4500);
      }
    } catch (err: any) {
      setAlertSuccessMsg('Failed to send test alert');
      setTimeout(() => setAlertSuccessMsg(null), 4000);
    } finally {
      setIsSendingAlert(false);
    }
  };

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setLocalSettings((prev) => ({
        ...prev,
        ...settings,
      }));
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, settings]);

  // Countdown timer for motor test runs
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    } else if (testActiveCommand) {
      setTestActiveCommand(null);
    }
    return () => clearTimeout(timer);
  }, [countdown, testActiveCommand]);

  // Instant feedback banner when settings are reset or synced
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // 1. Reset 12V Dryer & Temperature to factory defaults
  const handleResetHeaterDefaults = async () => {
    const updated: FarmSettings = {
      ...localSettings,
      heaterAutoEnabled: true,
      heaterMinTempThreshold: 26.0,
      heaterMaxTempTarget: 38.0,
      heaterAutoCloseSheet: true,
      heaterMaxContinuousMinutes: 15,
      heaterCooldownMinutes: 2,
      heaterPwmPower: 100,
      heaterPinIn3: 33,
      heaterPinIn4: 32,
      heaterPinEnb: 12,
    };
    setLocalSettings(updated);
    setResetMessage('12V Dryer & Temp parameters reset to factory defaults (26°C - 38°C) and synced to ESP32!');
    setTimeout(() => setResetMessage(null), 4000);
    await onSaveSettings(updated);
  };

  // 2. Reset Sensor Calibrations to factory defaults
  const handleResetSensorDefaults = async () => {
    const updated: FarmSettings = {
      ...localSettings,
      rainAnalogThreshold: 2800,
      rainDigitalInvert: false,
      rainDebounceChecks: 3,
      dryDebounceChecks: 4,
      sunlightDayLuxAdc: 2600,
      nightDetectionThreshold: 3400,
      sunlightMinAdc: 150,
      sunlightMaxAdc: 4095,
    };
    setLocalSettings(updated);
    setResetMessage('Rain Plate & LDR Sunlight calibrations reset to factory defaults and synced to ESP32!');
    setTimeout(() => setResetMessage(null), 4000);
    await onSaveSettings(updated);
  };

  // 3. Reset Online Radar & Weather to factory defaults
  const handleResetOnlineDefaults = async () => {
    const updated: FarmSettings = {
      ...localSettings,
      onlineRainProbabilityThreshold: 30,
      onlinePrecipRateThreshold: 0.5,
      onlineCloudCoverThreshold: 50,
      onlineSyncIntervalMinutes: 5,
    };
    setLocalSettings(updated);
    setResetMessage('Online Radar thresholds reset to factory defaults (30% rain, 0.5mm/h) and synced to ESP32!');
    setTimeout(() => setResetMessage(null), 4000);
    await onSaveSettings(updated);
  };

  // 4. Reset Roof Motor Parameters to factory defaults
  const handleResetMotorDefaults = async () => {
    const updated: FarmSettings = {
      ...localSettings,
      controlMode: 'DURATION',
      roofOpenSeconds: 10,
      roofCloseSeconds: 14,
      frontRotations: 10,
      backRotations: 10,
      secondsPerRotation: 1.2,
      motor2Enabled: true,
      motor2RotationSeconds: 8,
      motor2Rotations: 6,
      motor2Mode: 'SYNCHRONIZED',
      motorSpeedPercent: 100,
      autoStopSafetyLimit: 30,
      reverseDirection: false,
    };
    setLocalSettings(updated);
    setResetMessage('Roof Motor parameters reset to factory defaults (Open 10s, Close 14s) and synced to ESP32!');
    setTimeout(() => setResetMessage(null), 4000);
    await onSaveSettings(updated);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      try {
        localStorage.setItem('areca_farm_settings_v2', JSON.stringify(localSettings));
      } catch {}
      await onSaveSettings(localSettings);
      setSaveSuccess(true);
      setResetMessage('Parameters saved and synchronized to ESP32 successfully!');
      setTimeout(() => {
        setSaveSuccess(false);
        setResetMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to save settings:', err);
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

  const handleMotorTest = async (cmd: 'OPEN' | 'CLOSE' | 'MOTOR2' | 'STOP', durationSec?: number) => {
    setTestActiveCommand(cmd);
    const sec =
      durationSec ||
      (cmd === 'OPEN'
        ? localSettings.controlMode === 'ROTATION'
          ? Math.round(localSettings.frontRotations * localSettings.secondsPerRotation)
          : localSettings.roofOpenSeconds
        : cmd === 'CLOSE'
        ? localSettings.controlMode === 'ROTATION'
          ? Math.round(localSettings.backRotations * localSettings.secondsPerRotation)
          : localSettings.roofCloseSeconds
        : localSettings.motor2RotationSeconds);

    if (cmd === 'STOP') {
      setCountdown(0);
      setTestActiveCommand(null);
    } else {
      setCountdown(sec);
    }
    await onTriggerMotorTest(cmd, durationSec);
  };

  const handleHeaterAction = async (action: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF' | 'TEST_PULSE', durationSec?: number) => {
    if (onControlHeater) {
      await onControlHeater(action, durationSec);
    }
  };

  return (
    <div
      id="farm-settings-screen"
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col min-h-screen overflow-y-auto text-slate-100"
    >
      {/* Mobile-Friendly Sticky Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md px-3 sm:px-6 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="Return to Farm Monitor"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Back</span>
          </button>
          <div className="h-4 w-px bg-slate-800 shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Farm Parameter Control
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {saveSuccess && (
            <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Saved!</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm active:scale-95"
          >
            {isSaving ? 'Saving...' : 'Save All'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Horizontal Scrolling Tab Bar - Compact & Android Friendly */}
      <nav className="border-b border-slate-800 bg-slate-900/80 px-2 sm:px-6 sticky top-[45px] z-20">
        <div className="max-w-4xl mx-auto flex gap-1 overflow-x-auto py-1.5 scrollbar-none">
          <button
            id="tab-heater"
            onClick={() => setActiveTab('HEATER')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'HEATER'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>12V Dryer &amp; Temp</span>
          </button>

          <button
            id="tab-sensors"
            onClick={() => setActiveTab('SENSORS')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'SENSORS'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            <span>Sensor Calibration</span>
          </button>

          <button
            id="tab-online"
            onClick={() => setActiveTab('ONLINE')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'ONLINE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
            <span>Online Radar</span>
          </button>

          <button
            id="tab-telegram"
            onClick={() => setActiveTab('TELEGRAM')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'TELEGRAM'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>Telegram Bot</span>
          </button>

          <button
            id="tab-motor"
            onClick={() => setActiveTab('MOTOR')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'MOTOR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Roof Motor</span>
          </button>

          <button
            id="tab-wiring"
            onClick={() => setActiveTab('WIRING')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'WIRING'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5 text-cyan-400" />
            <span>Wiring &amp; Sensors</span>
          </button>

          <button
            id="tab-diagnostics"
            onClick={() => setActiveTab('DIAGNOSTICS')}
            className={`py-1 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'DIAGNOSTICS'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            <span>Link Test</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area - Optimized Text Sizes & Compact Mobile Layout */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-3 space-y-3 text-xs text-slate-200 pb-16">
        {/* Instant Feedback Alert when Reset to Defaults or Synced */}
        {resetMessage && (
          <div className="p-2.5 bg-emerald-950/90 border border-emerald-500/60 rounded-xl flex items-center justify-between gap-2 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-950/50 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{resetMessage}</span>
            </div>
            <button
              onClick={() => setResetMessage(null)}
              className="text-emerald-400 hover:text-white p-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live OTA Sync Info Banner */}
        <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Live OTA Sync: Parameter adjustments sync instantly to ESP32 without reflashing.</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 font-mono">
            SYNC ACTIVE
          </span>
        </div>

        {/* =========================================================================
            TAB 1: 12V HEATER & TEMPERATURE MAINTENANCE
           ========================================================================= */}
        {activeTab === 'HEATER' && (
          <div className="space-y-2.5">
            {/* Header & Reset Button */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>12V Dryer &amp; Temperature Control</span>
              </div>
              <button
                type="button"
                onClick={handleResetHeaterDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
                title="Reset to 26°C - 38°C defaults"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Live Heater Engine Status Card */}
            <div className="p-2.5 sm:p-3 bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">12V Hot-Air Dryer</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                          heaterState?.status === 'HEATING'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : heaterState?.status === 'COOLING_REST'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : heaterState?.status === 'STANDBY_STABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {heaterState?.status || 'IDLE'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">Driver Channel B (OUT3/OUT4)</span>
                  </div>
                </div>

                {currentTemperature !== undefined && currentTemperature !== null && (
                  <div className="text-right shrink-0 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Sensor Temp</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {currentTemperature.toFixed(1)}°C
                    </span>
                  </div>
                )}
              </div>

              {/* Status details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] pt-1 border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Mode</span>
                  <span className="font-semibold text-white font-mono">{heaterState?.mode || 'AUTO'}</span>
                </div>
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Active Runtime</span>
                  <span className="font-semibold text-white font-mono">{heaterState?.activeSeconds ?? 0}s</span>
                </div>
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Duty Cycles</span>
                  <span className="font-semibold text-white font-mono">{heaterState?.dutyCycleCount ?? 0}</span>
                </div>
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Sheet Status</span>
                  <span className="font-semibold text-emerald-400">
                    {heaterState?.sheetAutoClosed ? 'Sealed' : 'Standby'}
                  </span>
                </div>
              </div>
            </div>

            {/* Main Toggle: Automatic Temperature Maintenance */}
            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-white text-xs block">
                  Automatic Temperature Maintenance
                </span>
                <span className="text-[11px] text-slate-400">
                  Closes roof &amp; powers 12V heater if temperature drops below minimum.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.heaterAutoEnabled}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, heaterAutoEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>

            {/* Temperature Thresholds (Min Trigger & Max Stable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Min Temp Threshold to Turn ON */}
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    Turn ON Below:
                  </label>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {localSettings.heaterMinTempThreshold}°C
                  </span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="35"
                  step="0.5"
                  value={localSettings.heaterMinTempThreshold}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      heaterMinTempThreshold: parseFloat(e.target.value) || 26.0,
                    }))
                  }
                  className="w-full accent-rose-500 cursor-pointer h-1.5"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>18°C (Cold)</span>
                  <span>Default: 26°C</span>
                  <span>35°C</span>
                </div>
              </div>

              {/* Max Temp Target to Turn OFF */}
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Turn OFF At:
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {localSettings.heaterMaxTempTarget}°C
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="48"
                  step="0.5"
                  value={localSettings.heaterMaxTempTarget}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      heaterMaxTempTarget: parseFloat(e.target.value) || 38.0,
                    }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>30°C</span>
                  <span>Default: 38°C</span>
                  <span>48°C</span>
                </div>
              </div>
            </div>

            {/* Auto-Close Roof Sheet when Heating */}
            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-white text-xs block">
                  Auto-Close Roof Sheet during Heating
                </span>
                <span className="text-[10px] text-slate-400">
                  Traps heat inside drying chamber while 12V heater is active.
                </span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.heaterAutoCloseSheet}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, heaterAutoCloseSheet: e.target.checked }))
                }
                className="w-4 h-4 accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Duty-Cycle Safety Settings */}
            <div className="p-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">
                  Duty-Cycle Safety Timing
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Max Continuous Run:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={localSettings.heaterMaxContinuousMinutes}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          heaterMaxContinuousMinutes: Math.max(1, parseInt(e.target.value, 10) || 15),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">min</span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Cooling Rest Time:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={localSettings.heaterCooldownMinutes}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          heaterCooldownMinutes: Math.max(1, parseInt(e.target.value, 10) || 2),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 12V Driver PWM Power & Pin Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white">
                    Heater Power (PWM ENB):
                  </label>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {localSettings.heaterPwmPower}%
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={localSettings.heaterPwmPower}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, heaterPwmPower: parseInt(e.target.value, 10) || 100 }))
                  }
                  className="w-full accent-rose-500 cursor-pointer h-1.5"
                />
              </div>

              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[11px] font-semibold text-white block mb-1">
                  Driver Pins (Channel B)
                </span>
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                  <div className="bg-slate-950 p-1 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">IN3 (+)</span>
                    <span className="text-cyan-400 font-bold">D{localSettings.heaterPinIn3}</span>
                  </div>
                  <div className="bg-slate-950 p-1 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">IN4 (GND)</span>
                    <span className="text-cyan-400 font-bold">D{localSettings.heaterPinIn4}</span>
                  </div>
                  <div className="bg-slate-950 p-1 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">ENB (PWM)</span>
                    <span className="text-amber-400 font-bold">D{localSettings.heaterPinEnb}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Live Manual Test & Override Controls */}
            <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
              <span className="text-xs font-bold text-white block">
                Manual Overrides &amp; Test
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  onClick={() => handleHeaterAction('TEST_PULSE', 15)}
                  className="px-2 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>15s Test</span>
                </button>

                <button
                  onClick={() => handleHeaterAction('FORCE_ON')}
                  className="px-2 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Force ON</span>
                </button>

                <button
                  onClick={() => handleHeaterAction('FORCE_OFF')}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Force OFF</span>
                </button>

                <button
                  onClick={() => handleHeaterAction('AUTO')}
                  className="px-2 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Auto Mode</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PHYSICAL SENSOR PARAMETER CALIBRATION (LDR, RAIN, DHT)
           ========================================================================= */}
        {activeTab === 'SENSORS' && (
          <div className="space-y-2.5">
            {/* Header & Reset Button */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs">
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span>Sensor Calibration &amp; Debounce</span>
              </div>
              <button
                type="button"
                onClick={handleResetSensorDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/40 border border-sky-500/40 hover:bg-sky-900/60 text-sky-300 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
                title="Reset sensor calibrations to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Live Sensors Quick Overview */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Rain ADC (D34)</span>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {currentRainAnalog !== null && currentRainAnalog !== undefined ? currentRainAnalog : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Light ADC (D35)</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {currentLightAdc !== null && currentLightAdc !== undefined ? currentLightAdc : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Temp (D4)</span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {currentTemperature !== null && currentTemperature !== undefined
                    ? `${currentTemperature.toFixed(1)}°C`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Rain Sensor Calibration Group */}
            <div className="p-2.5 bg-sky-950/20 border border-sky-500/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5" />
                  Rain Sensor Plate (D34 AO / D27 DO)
                </span>
              </div>

              {/* Rain Analog Threshold */}
              <div className="space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Rain Trigger Threshold (AO ADC):
                  </label>
                  <span className="text-xs font-mono font-bold text-sky-300">
                    {localSettings.rainAnalogThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="3800"
                  step="50"
                  value={localSettings.rainAnalogThreshold}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      rainAnalogThreshold: parseInt(e.target.value, 10) || 2800,
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer h-1.5"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>500 (Heavy)</span>
                  <span>Default: 2800</span>
                  <span>3800 (Light)</span>
                </div>
              </div>

              {/* Debounce Sample Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Rain Confirmation Samples:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={localSettings.rainDebounceChecks}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          rainDebounceChecks: Math.max(1, parseInt(e.target.value, 10) || 3),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">samples</span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Dry Confirmation Samples:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={localSettings.dryDebounceChecks}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          dryDebounceChecks: Math.max(1, parseInt(e.target.value, 10) || 4),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">samples</span>
                  </div>
                </div>
              </div>

              {/* Digital Invert Polarity */}
              <div className="flex items-center justify-between p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                <span className="text-[11px] font-semibold text-white">Invert Digital DO Polarity</span>
                <input
                  type="checkbox"
                  checked={localSettings.rainDigitalInvert}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, rainDigitalInvert: e.target.checked }))
                  }
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Sunlight / LDR Sensor Calibration Group */}
            <div className="p-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" />
                Sunlight / LDR Sensor (Pin D35 AO)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Day vs Twilight ADC */}
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold">
                    <span className="text-slate-300">Day/Sun Threshold:</span>
                    <span className="text-amber-400 font-mono">{localSettings.sunlightDayLuxAdc}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="3500"
                    step="50"
                    value={localSettings.sunlightDayLuxAdc}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        sunlightDayLuxAdc: parseInt(e.target.value, 10) || 2600,
                      }))
                    }
                    className="w-full accent-amber-500 cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>1000 (Bright)</span>
                    <span>3500 (Dusk)</span>
                  </div>
                </div>

                {/* Night Dew Protection ADC */}
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold">
                    <span className="text-slate-300">Night Close Threshold:</span>
                    <span className="text-indigo-400 font-mono">{localSettings.nightDetectionThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="2800"
                    max="4095"
                    step="50"
                    value={localSettings.nightDetectionThreshold}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        nightDetectionThreshold: parseInt(e.target.value, 10) || 3400,
                      }))
                    }
                    className="w-full accent-indigo-500 cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>2800</span>
                    <span>4095 (Total Dark)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ONLINE DATA & SATELLITE RADAR PARAMETERS
           ========================================================================= */}
        {activeTab === 'ONLINE' && (
          <div className="space-y-2.5">
            {/* Header & Reset Button */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
                <span>Online Radar &amp; Forecast</span>
              </div>
              <button
                type="button"
                onClick={handleResetOnlineDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
                title="Reset online radar parameters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* AI Control Mode: Suggestion vs Autonomous */}
            <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  AI Operation Mode
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  localSettings.aiMode === 'SUGGESTION'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {localSettings.aiMode === 'SUGGESTION' ? 'ADVISORY' : 'AUTONOMOUS'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLocalSettings((prev) => ({ ...prev, aiMode: 'SUGGESTION' }))}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    localSettings.aiMode === 'SUGGESTION'
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-200 shadow-md ring-1 ring-amber-400/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 text-amber-300">
                    <Sun className="w-3.5 h-3.5" />
                    Suggestion Mode
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Advises actions without moving motors automatically.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalSettings((prev) => ({ ...prev, aiMode: 'AUTONOMOUS' }))}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    localSettings.aiMode === 'AUTONOMOUS'
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 shadow-md ring-1 ring-emerald-400/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 text-emerald-300">
                    <Zap className="w-3.5 h-3.5" />
                    Autonomous Mode
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Automatically operates roof based on weather thresholds.
                  </div>
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5" />
                Radar Thresholds
              </span>

              {/* Rain Probability Threshold */}
              <div className="space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Rain Probability Limit:
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {localSettings.onlineRainProbabilityThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={localSettings.onlineRainProbabilityThreshold}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      onlineRainProbabilityThreshold: parseInt(e.target.value, 10) || 30,
                    }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>10% (Sensitive)</span>
                  <span>Default: 30%</span>
                  <span>90% (Strict)</span>
                </div>
              </div>

              {/* Precipitation Rate & Cloud Cover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold">
                    <span className="text-slate-300">Precipitation Rate:</span>
                    <span className="text-emerald-400 font-mono">{localSettings.onlinePrecipRateThreshold} mm/h</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={localSettings.onlinePrecipRateThreshold}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        onlinePrecipRateThreshold: parseFloat(e.target.value) || 0.5,
                      }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer h-1.5"
                  />
                </div>

                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold">
                    <span className="text-slate-300">Cloud Cover Limit:</span>
                    <span className="text-emerald-400 font-mono">{localSettings.onlineCloudCoverThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    step="5"
                    value={localSettings.onlineCloudCoverThreshold}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        onlineCloudCoverThreshold: parseInt(e.target.value, 10) || 50,
                      }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer h-1.5"
                  />
                </div>
              </div>

              {/* Sync Interval */}
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">Radar Refresh Frequency</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={localSettings.onlineSyncIntervalMinutes}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        onlineSyncIntervalMinutes: Math.max(1, parseInt(e.target.value, 10) || 5),
                      }))
                    }
                    className="w-14 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white font-mono font-bold text-xs text-center"
                  />
                  <span className="text-slate-400 text-xs">min</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3.5: TELEGRAM CONTROLLER & SMARTPHONE ALERT PUSH
           ========================================================================= */}
        {activeTab === 'TELEGRAM' && (
          <div className="space-y-3 max-w-lg mx-auto py-1">
            <div
              id="telegram-controller-settings-card"
              className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-lg space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">Telegram Remote Bot</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                  {telegramStatus?.isLive !== false ? 'Connected' : 'Connecting...'}
                </span>
              </div>

              {/* Status Spec Lines */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bot Username:</span>
                  <strong className="text-sky-400 font-mono">
                    @{telegramStatus?.botUsername || 'ArecaFarmDryerbot'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Paired Devices:</span>
                  <span className="font-bold text-white">
                    {telegramStatus?.registeredUsersCount || 1} phone(s)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Push Notifications:</span>
                  <span className="font-bold text-emerald-400">Active</span>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-800/50 text-[11px] text-slate-300 space-y-1">
                <span className="font-bold text-sky-300 block">Phone Control Steps:</span>
                <p>1. Open Telegram &amp; message <strong className="text-white">@{telegramStatus?.botUsername || 'ArecaFarmDryerbot'}</strong></p>
                <p>2. Send <strong className="text-amber-300">/start</strong> to pair</p>
                <p>3. Tap <strong className="text-emerald-400">OPEN</strong> or <strong className="text-rose-400">CLOSE</strong> buttons</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1">
                <a
                  href={`https://t.me/${telegramStatus?.botUsername || 'ArecaFarmDryerbot'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer active:scale-98"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={handleSendTestAlert}
                  disabled={isSendingAlert}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSendingAlert ? 'Sending...' : 'Send Test Alert to Phone'}</span>
                </button>

                {alertSuccessMsg && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center font-semibold">
                    {alertSuccessMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: ROOF MOTOR ROTATION & DURATION CALIBRATION
           ========================================================================= */}
        {activeTab === 'MOTOR' && (
          <div className="space-y-2.5">
            {/* Header & Reset Button */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Roof Motor Calibration</span>
              </div>
              <button
                type="button"
                onClick={handleResetMotorDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/60 text-amber-300 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
                title="Reset motor parameters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Control Mode Toggle */}
            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
              <span className="font-bold text-white text-xs">Actuation Mode</span>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
                <button
                  onClick={() => setLocalSettings((prev) => ({ ...prev, controlMode: 'ROTATION' }))}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    localSettings.controlMode === 'ROTATION'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  By Rotations
                </button>
                <button
                  onClick={() => setLocalSettings((prev) => ({ ...prev, controlMode: 'DURATION' }))}
                  className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    localSettings.controlMode === 'DURATION'
                      ? 'bg-sky-500 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  By Seconds
                </button>
              </div>
            </div>

            {/* Rotation Fields */}
            {localSettings.controlMode === 'ROTATION' ? (
              <div className="p-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Open Turns:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={localSettings.frontRotations}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            frontRotations: Math.max(1, parseInt(e.target.value, 10) || 1),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-xs text-center"
                      />
                      <span className="text-slate-400 text-xs shrink-0">turns</span>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Close Turns:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={localSettings.backRotations}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            backRotations: Math.max(1, parseInt(e.target.value, 10) || 1),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-xs text-center"
                      />
                      <span className="text-slate-400 text-xs shrink-0">turns</span>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Sec Per Turn:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={localSettings.secondsPerRotation}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            secondsPerRotation: Math.max(0.1, parseFloat(e.target.value) || 1.2),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold text-xs text-center"
                      />
                      <span className="text-slate-400 text-xs shrink-0">s/turn</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Duration Fields */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-sky-950/20 border border-sky-500/20 rounded-xl">
                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Opening Duration:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={localSettings.roofOpenSeconds}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          roofOpenSeconds: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">seconds</span>
                  </div>
                </div>

                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Closing Duration:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={localSettings.roofCloseSeconds}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          roofCloseSeconds: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-xs text-center"
                    />
                    <span className="text-slate-400 text-xs shrink-0">seconds</span>
                  </div>
                </div>
              </div>
            )}

            {/* Speed PWM & Polarity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[11px] font-semibold">
                  <span className="text-white">Motor Speed (PWM ENA):</span>
                  <span className="text-amber-400 font-mono font-bold">{localSettings.motorSpeedPercent}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={localSettings.motorSpeedPercent}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, motorSpeedPercent: parseInt(e.target.value, 10) }))
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5"
                />
              </div>

              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white text-[11px] block">Reverse Direction</span>
                  <span className="text-[10px] text-slate-400">Swap Open / Close polarities</span>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.reverseDirection}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, reverseDirection: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Motor Test Buttons */}
            <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-300">Actuator Test:</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={testActiveCommand !== null}
                  onClick={() => handleMotorTest('OPEN')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Test Open
                </button>
                <button
                  disabled={testActiveCommand !== null}
                  onClick={() => handleMotorTest('CLOSE')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Test Close
                </button>
                <button
                  onClick={() => handleMotorTest('STOP')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: WIRING DIAGRAM (DUAL 12V MOTOR DRIVER: ROOF + 12V HEATER)
           ========================================================================= */}
        {activeTab === 'WIRING' && (
          <div className="space-y-2.5">
            {/* Wiring Header Card */}
            <div className="p-2.5 bg-gradient-to-r from-cyan-950/30 via-slate-900 to-indigo-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Cable className="w-3.5 h-3.5 text-cyan-400" />
                Hardware Wiring &amp; Pinout
              </span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                ESP32 + Dual 12V Driver
              </span>
            </div>

            {/* Quick Jumper Tip */}
            <div className="p-2 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-center gap-2 text-xs text-amber-200">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-[11px] leading-tight">
                <strong className="text-amber-300">Driver ENA/ENB:</strong> Keep factory jumper caps ON for 100% full torque. Leave ESP32 D14 &amp; D12 empty.
              </div>
            </div>

            {/* SENSORS & DRIVERS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Rain Plate */}
              <div className="p-2.5 bg-slate-900/80 border border-sky-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    Rain Plate (FC-37/LM393)
                  </span>
                  <span className="text-[9px] text-slate-400">AO + DO</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">AO (Moisture ADC):</span>
                    <span className="text-sky-400 font-bold">Pin D34</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">DO (Interrupt):</span>
                    <span className="text-amber-400 font-bold">Pin D27</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Power:</span>
                    <span className="text-slate-200">3.3V &amp; GND</span>
                  </div>
                </div>
              </div>

              {/* LDR Sunlight */}
              <div className="p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Sunlight / LDR
                  </span>
                  <span className="text-[9px] text-slate-400">ADC1</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">AO (Light ADC):</span>
                    <span className="text-amber-400 font-bold">Pin D35</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Power:</span>
                    <span className="text-slate-200">3.3V &amp; 10kΩ divider to GND</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Range:</span>
                    <span className="text-slate-200">0=Sun, 4095=Dark</span>
                  </div>
                </div>
              </div>

              {/* DHT22 Temp */}
              <div className="p-2.5 bg-slate-900/80 border border-rose-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-rose-300 flex items-center gap-1 text-[11px]">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    DHT22 Temp &amp; Humidity
                  </span>
                  <span className="text-[9px] text-slate-400">Single-Bus</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">DATA:</span>
                    <span className="text-rose-400 font-bold">Pin D4 (10kΩ pullup)</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Power:</span>
                    <span className="text-slate-200">3.3V &amp; GND</span>
                  </div>
                </div>
              </div>

              {/* Limit Switches */}
              <div className="p-2.5 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Limit End-Stops
                  </span>
                  <span className="text-[9px] text-slate-400">Active LOW</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Open Switch:</span>
                    <span className="text-emerald-400 font-bold">Pin D18 &rarr; GND</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Close Switch:</span>
                    <span className="text-emerald-400 font-bold">Pin D19 &rarr; GND</span>
                  </div>
                </div>
              </div>

              {/* Roof Motor (Channel A) */}
              <div className="p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                    <RotateCw className="w-3.5 h-3.5" />
                    Roof Motor (Channel A)
                  </span>
                  <span className="text-[9px] text-slate-400">12V Actuator</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">IN1 (Open):</span>
                    <span className="text-amber-400 font-bold">Pin D26</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">IN2 (Close):</span>
                    <span className="text-amber-400 font-bold">Pin D25</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Output:</span>
                    <span className="text-slate-200">OUT1 &amp; OUT2 to Motor</span>
                  </div>
                </div>
              </div>

              {/* Auxiliary Heater (Channel B) */}
              <div className="p-2.5 bg-slate-900/80 border border-rose-500/30 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-rose-300 flex items-center gap-1 text-[11px]">
                    <Flame className="w-3.5 h-3.5" />
                    12V Heater (Channel B)
                  </span>
                  <span className="text-[9px] text-slate-400">Heater / Fan</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">IN3 (Heater +):</span>
                    <span className="text-rose-400 font-bold">Pin D33</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">IN4 (Heater -):</span>
                    <span className="text-rose-400 font-bold">Pin D32</span>
                  </div>
                  <div className="flex justify-between p-1 bg-slate-950 rounded">
                    <span className="text-slate-400">Output:</span>
                    <span className="text-slate-200">OUT3 &amp; OUT4 to Heater</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MASTER ESP32 GPIO PINOUT MATRIX */}
            <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Master GPIO Pin Reference
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 font-semibold">
                      <th className="p-1">Pin</th>
                      <th className="p-1">Target</th>
                      <th className="p-1">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="p-1 text-cyan-400 font-bold">D2</td>
                      <td className="p-1 text-slate-200">Onboard LED</td>
                      <td className="p-1 text-slate-400">Status blink</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-rose-400 font-bold">D4</td>
                      <td className="p-1 text-slate-200">DHT22</td>
                      <td className="p-1 text-slate-400">Temp / Humidity Data</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-emerald-400 font-bold">D18</td>
                      <td className="p-1 text-slate-200">Limit Switch Open</td>
                      <td className="p-1 text-slate-400">Active LOW</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-emerald-400 font-bold">D19</td>
                      <td className="p-1 text-slate-200">Limit Switch Close</td>
                      <td className="p-1 text-slate-400">Active LOW</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-amber-400 font-bold">D25</td>
                      <td className="p-1 text-slate-200">Driver IN2</td>
                      <td className="p-1 text-slate-400">Roof Close signal</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-amber-400 font-bold">D26</td>
                      <td className="p-1 text-slate-200">Driver IN1</td>
                      <td className="p-1 text-slate-400">Roof Open signal</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-amber-400 font-bold">D27</td>
                      <td className="p-1 text-slate-200">Rain DO</td>
                      <td className="p-1 text-slate-400">Rain interrupt</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-rose-400 font-bold">D32</td>
                      <td className="p-1 text-slate-200">Driver IN4</td>
                      <td className="p-1 text-slate-400">Heater ground return</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-rose-400 font-bold">D33</td>
                      <td className="p-1 text-slate-200">Driver IN3</td>
                      <td className="p-1 text-slate-400">Heater positive enable</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-sky-400 font-bold">D34</td>
                      <td className="p-1 text-slate-200">Rain AO</td>
                      <td className="p-1 text-slate-400">Moisture ADC (0–4095)</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-amber-400 font-bold">D35</td>
                      <td className="p-1 text-slate-200">LDR AO</td>
                      <td className="p-1 text-slate-400">Light ADC (0–4095)</td>
                    </tr>
                    <tr>
                      <td className="p-1 text-slate-400 font-bold">GND</td>
                      <td className="p-1 text-slate-200">Common GND</td>
                      <td className="p-1 text-slate-400">Shared reference</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: DIAGNOSTICS & PING TEST
           ========================================================================= */}
        {activeTab === 'DIAGNOSTICS' && (
          <div className="space-y-2.5">
            <div className="p-2.5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-300 block">Hardware Diagnostics</span>
                <span className="text-[11px] text-slate-400">
                  MQTT handshake, latency &amp; channel telemetry.
                </span>
              </div>
              <button
                onClick={handlePing}
                disabled={isPinging}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Pinging...' : 'Ping ESP32'}</span>
              </button>
            </div>

            {motorPing && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center text-xs">
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Latency</span>
                  <span className="text-emerald-400 font-bold">{motorPing.latencyMs} ms</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Link Status</span>
                  <span className="text-white font-bold">{motorPing.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Channel A (Roof)</span>
                  <span className="text-amber-400 font-bold">{motorPing.openChannelStatus}</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Channel B (Heater)</span>
                  <span className="text-rose-400 font-bold">{heaterState?.status || 'READY'}</span>
                </div>
              </div>
            )}

            {/* Embedded Creator Diagnostic Audit Log */}
            <DiagnosticAuditLog />
          </div>
        )}
      </main>
    </div>
  );
};
