import React, { useState, useEffect } from 'react';
import {
  Activity,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Play,
  Square,
  Clock,
  CloudRain,
  Sun,
  Radio,
  Sliders,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { DiagnosticAuditLogEntry } from '../types';

interface DiagnosticAuditLogProps {
  isEmergencyStopped?: boolean;
  canopyMode?: string;
  isSensorFlapping?: boolean;
}

export const DiagnosticAuditLog: React.FC<DiagnosticAuditLogProps> = ({
  isEmergencyStopped,
  canopyMode,
  isSensorFlapping,
}) => {
  const [logs, setLogs] = useState<DiagnosticAuditLogEntry[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'MOTOR' | 'SAFETY' | 'WEATHER' | 'HOLDS'>('ALL');
  const [viewMode, setViewMode] = useState<'CREATOR_NORMAL' | 'DETAILED'>('CREATOR_NORMAL');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/diagnostic-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch diagnostic logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    try {
      const res = await fetch('/api/diagnostic-logs/clear', { method: 'POST' });
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleCopy = () => {
    if (!logs.length) return;
    const formatted = logs
      .map((log, idx) => {
        const sensors = log.sensorSummary
          ? `[SENSORS] DHT: ${log.sensorSummary.dhtConnected ? `${log.sensorSummary.dhtTemp}°C, ${log.sensorSummary.dhtHumidity}%` : 'OFFLINE'} | Rain: ${log.sensorSummary.rainConnected ? `Analog=${log.sensorSummary.rainAnalog}, Wet=${log.sensorSummary.isRainWet}, Verified=${log.sensorSummary.rainVerified}` : 'OFFLINE'} | Light=${log.sensorSummary.lightAdc ?? 'N/A'}`
          : '';
        const weather = log.weatherSummary
          ? `[WEATHER] Precip=${log.weatherSummary.precipitationMm}mm, RainProb=${log.weatherSummary.rainProbability}%, Cloud=${log.weatherSummary.cloudCover}%, 10kmRadarCells=${log.weatherSummary.radar10kmRainCount}`
          : '';
        return `[#${logs.length - idx}] ${log.timeLabel} (${new Date(log.timestamp).toISOString()})
EVENT: ${log.eventType} | SOURCE: ${log.source} | ACTION TAKEN: ${log.actionTaken ? 'YES' : 'NO'}
MODE: ${log.canopyState} | POSITION: ${log.physicalRoofPosition}
${sensors}
${weather}
REASON / DIAGNOSIS:
${log.reason}
--------------------------------------------------------------------------------`;
      })
      .join('\n\n');

    const fullHeader = `================================================================================
SMART AGRI CANOPY - SYSTEM DIAGNOSTIC & DECISION AUDIT LOG
Export Timestamp: ${new Date().toISOString()}
System Status: ${isEmergencyStopped ? 'EMERGENCY STOPPED (LATCHED)' : canopyMode || 'AUTO'}
Sensor Flapping Alert: ${isSensorFlapping ? 'ACTIVE (JITTER DETECTED)' : 'NORMAL (STABLE)'}
Total Events Recorded: ${logs.length}
================================================================================\n\n${formatted}`;

    navigator.clipboard.writeText(fullHeader);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    if (filter === 'MOTOR') {
      return log.eventType === 'MOTOR_OPEN' || log.eventType === 'MOTOR_CLOSE' || log.eventType === 'MOTOR_STOP';
    }
    if (filter === 'SAFETY') {
      return log.eventType === 'STOP_LOCK' || log.eventType === 'BLOCKED_BY_STOP' || log.eventType === 'START_RESUME' || log.eventType === 'FAILSAFE_TRIGGER';
    }
    if (filter === 'WEATHER') {
      return log.eventType === 'RAIN_TRIGGER' || log.eventType === 'WEATHER_TRIGGER';
    }
    if (filter === 'HOLDS') {
      return log.eventType === 'ANTI_CHATTER_HOLD' || log.eventType === 'SENSOR_FLAP_BLOCKED' || log.eventType === 'DEBOUNCE_ABSORBED';
    }
    return true;
  });

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
      case 'STOP_LOCK':
      case 'BLOCKED_BY_STOP':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/80';
      case 'START_RESUME':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
      case 'MOTOR_OPEN':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      case 'MOTOR_CLOSE':
        return 'bg-sky-950/80 text-sky-300 border-sky-800/80';
      case 'RAIN_TRIGGER':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      case 'ANTI_CHATTER_HOLD':
        return 'bg-violet-950/80 text-violet-300 border-violet-800/80';
      case 'SENSOR_FLAP_BLOCKED':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/80 animate-pulse';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg w-full flex flex-col gap-4">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Diagnostic & AI Decision Audit Log
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Full forensic breakdown of sensor triggers, debounce holds, and motor commands.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="copy-diagnostic-log-btn"
            onClick={handleCopy}
            disabled={!logs.length}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed'
            }`}
            title="Copy entire formatted diagnostic report for troubleshooting"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Log!' : 'Copy Full Log'}</span>
          </button>

          <button
            id="refresh-diagnostic-log-btn"
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Refresh Diagnostic Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="clear-diagnostic-log-btn"
            onClick={handleClear}
            disabled={!logs.length}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
            title="Clear Diagnostic Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Critical System Status Alerts */}
      {isEmergencyStopped && (
        <div className="bg-rose-950/70 border border-rose-600/80 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs sm:text-sm font-bold text-rose-200 uppercase tracking-wider">
              Emergency Stop Latched — Motor Completely Terminated
            </div>
            <p className="text-xs text-rose-300/90 mt-0.5">
              The system is held in a safe locked state. All automatic weather evaluations and motor movements are strictly suppressed until you click the green <strong>START</strong> button.
            </p>
          </div>
        </div>
      )}

      {isSensorFlapping && (
        <div className="bg-purple-950/70 border border-purple-600/80 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs sm:text-sm font-bold text-purple-200 uppercase tracking-wider">
              Sensor Wire Flapping Detected
            </div>
            <p className="text-xs text-purple-300/90 mt-0.5">
              Intermittent disconnects detected on the ESP32 hardware pins (&ge;4 state changes in 60s). The safety watchdog has temporarily frozen auto reversals to prevent relay chatter and motor wear.
            </p>
          </div>
        </div>
      )}

      {/* View Switcher & Category Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('CREATOR_NORMAL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'CREATOR_NORMAL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Creator Normal Log
          </button>
          <button
            type="button"
            onClick={() => setViewMode('DETAILED')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'DETAILED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Detailed Breakdown
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `All (${logs.length})` },
              { id: 'MOTOR', label: 'Motor Runs' },
              { id: 'SAFETY', label: 'Safety & Stops' },
              { id: 'HOLDS', label: 'Holds & Cooldowns' },
              { id: 'WEATHER', label: 'Weather Triggers' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-slate-700 text-white font-bold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Creator Normal Log Stream View */}
      {viewMode === 'CREATOR_NORMAL' ? (
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 font-mono text-[11px] sm:text-xs max-h-[460px] overflow-y-auto space-y-2 pr-1 shadow-inner">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-600 font-sans">
              No log entries recorded yet. Real-time creator evaluations will appear here.
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isMotorOpen = entry.eventType === 'MOTOR_OPEN';
              const isMotorClose = entry.eventType === 'MOTOR_CLOSE';
              const isHold = entry.eventType === 'ANTI_CHATTER_HOLD' || entry.eventType === 'STATUS_HOLD';
              const isStop = entry.eventType === 'STOP_LOCK' || entry.eventType === 'BLOCKED_BY_STOP';

              return (
                <div
                  key={entry.id}
                  className={`p-2 rounded-lg border leading-relaxed transition-all ${
                    isMotorOpen
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : isMotorClose
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : isStop
                      ? 'bg-rose-950/50 border-rose-600/60 text-rose-300 font-semibold'
                      : isHold
                      ? 'bg-violet-950/20 border-violet-500/30 text-violet-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap text-[10px] sm:text-[11px] font-bold pb-1 border-b border-white/5">
                    <span className="text-slate-400">[{entry.timeLabel}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isMotorOpen
                          ? 'bg-amber-500/20 text-amber-300'
                          : isMotorClose
                          ? 'bg-rose-500/20 text-rose-300'
                          : isStop
                          ? 'bg-rose-600/30 text-rose-200'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {entry.eventType}
                    </span>
                    <span className="text-slate-400 font-normal">
                      Pos: <strong className="text-white">{entry.physicalRoofPosition}</strong> | Mode: <strong className="text-white">{entry.canopyState}</strong>
                    </span>
                    <span className="text-slate-400 font-normal ml-auto">
                      Source: {entry.source}
                    </span>
                  </div>

                  <div className="pt-1.5 font-sans text-xs">
                    <span className="font-semibold text-white">Diagnostic Rationale: </span>
                    <span>{entry.reason}</span>
                  </div>

                  {/* Creator Telemetry Line */}
                  <div className="pt-1 text-[10px] text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      ☀️ Sun: {entry.sensorSummary.lightAdc !== null ? `${entry.sensorSummary.lightAdc} ADC (${entry.sensorSummary.lightAdc < 2600 ? 'Sunny' : 'Shade/Night'})` : 'N/A'}
                    </span>
                    <span>
                      💧 Rain Plate: {entry.sensorSummary.rainConnected ? `${entry.sensorSummary.rainAnalog ?? 'N/A'} ADC (${entry.sensorSummary.isRainWet ? 'WET' : 'DRY'})` : 'OFFLINE'}
                    </span>
                    <span>
                      🌡️ Temp: {entry.sensorSummary.dhtConnected ? `${entry.sensorSummary.dhtTemp}°C, ${entry.sensorSummary.dhtHumidity}%` : 'OFFLINE'}
                    </span>
                    <span>
                      📡 Weather: {entry.weatherSummary.precipitationMm}mm rain, {entry.weatherSummary.rainProbability}% POP
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Detailed Breakdown Cards List */
        <div className="max-h-[440px] overflow-y-auto space-y-2.5 pr-1 font-sans text-xs">
          {filteredLogs.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-6 text-center text-slate-500">
              <Info className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
              <p className="font-semibold">No diagnostic events in this category yet</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Actions, safety blocks, and anti-chatter decisions will be logged here in real-time.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 hover:border-slate-700 transition-colors"
              >
                {/* Event Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] border uppercase ${getBadgeStyle(
                        entry.eventType
                      )}`}
                    >
                      {entry.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {entry.timeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Source: {entry.source}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        entry.actionTaken
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950/70 text-amber-300 border border-amber-800/70'
                      }`}
                    >
                      {entry.actionTaken ? 'ACTION FIRED' : 'HELD / BLOCKED'}
                    </span>
                  </div>
                </div>

                {/* Rationale / Explanation */}
                <p className="text-slate-200 text-xs leading-relaxed font-medium">
                  {entry.reason}
                </p>

                {/* Hardware & Telemetry Snapshot at Decision Time */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Rain Plate</span>
                    <span className={entry.sensorSummary.rainConnected ? (entry.sensorSummary.isRainWet ? 'text-blue-400 font-bold' : 'text-slate-300') : 'text-rose-400 font-bold'}>
                      {entry.sensorSummary.rainConnected
                        ? `ADC ${entry.sensorSummary.rainAnalog ?? 'N/A'} (${entry.sensorSummary.isRainWet ? 'WET' : 'DRY'})`
                        : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Sunlight (LDR)</span>
                    <span className={entry.sensorSummary.lightAdc !== null && entry.sensorSummary.lightAdc < 2600 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                      {entry.sensorSummary.lightAdc !== null
                        ? `ADC ${entry.sensorSummary.lightAdc} (${entry.sensorSummary.lightAdc < 2600 ? 'SUNNY' : 'SHADE'})`
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">DHT22 Temp</span>
                    <span className={entry.sensorSummary.dhtConnected ? 'text-slate-300' : 'text-rose-400 font-bold'}>
                      {entry.sensorSummary.dhtConnected
                        ? `${entry.sensorSummary.dhtTemp ?? 'N/A'}°C / ${entry.sensorSummary.dhtHumidity ?? 'N/A'}%`
                        : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Roof & State</span>
                    <span className="text-slate-300">
                      Pos: <strong className="text-amber-300">{entry.physicalRoofPosition}</strong> | Mode: <strong className="text-indigo-300">{entry.canopyState}</strong>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Perimeter Radar</span>
                    <span className="text-slate-300">
                      {entry.weatherSummary.radar10kmRainCount > 0 ? (
                        <span className="text-amber-400 font-bold">{entry.weatherSummary.radar10kmRainCount} Rain Cells</span>
                      ) : (
                        '0 Rain Cells (Clear)'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
