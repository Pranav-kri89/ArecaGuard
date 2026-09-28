import React, { useState } from 'react';
import {
  X,
  Presentation,
  ShieldCheck,
  Zap,
  CloudRain,
  Sun,
  Moon,
  Cpu,
  Globe,
  Sliders,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { DecisionLogEntry, DecisionMode } from '../types';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  decisionLogs: DecisionLogEntry[];
  currentMode: DecisionMode;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
  decisionLogs,
  currentMode,
}) => {
  const [activeTab, setActiveTab] = useState<'flow' | 'matrix' | 'logs' | 'slides'>('slides');

  if (!isOpen) return null;

  return (
    <div
      id="documentation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="documentation-modal-content"
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Hyper-Advanced Technical Documentation &amp; Presentation (PPT)
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                  System Architecture
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Complete breakdown of how the Dual-Source Rain Prediction &amp; Actuator Engine works
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('slides')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'slides'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Interactive Slides (PPT)</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Truth &amp; Decision Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('flow')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'flow'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Execution Modes</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Live Decision Audit Trail ({decisionLogs.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300">
          {/* TAB 1: SLIDES / PPT VIEW */}
          {activeTab === 'slides' && (
            <div className="space-y-6">
              {/* Slide 1 */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/30">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  Slide 1: Executive Overview &amp; Objective
                </span>
                <h3 className="text-base font-bold text-white mb-2">
                  Solar Arecanut Drying Protection with Dual-Failsafe IoT
                </h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Arecanut (Supari) requires 7-10 consecutive days of full sunlight to cure safely. If raindrops touch drying nuts, fungal black-rot (Koleroga) destroys the crop within hours. This system combines <strong>Local Physical Hardware</strong> (ESP32) and <strong>Accurate Internet Satellite Radar</strong> to actuate the motorized protective canopy with 100% reliability.
                </p>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold text-lg block">&lt; 150 ms</span>
                    <span className="text-[10px] text-slate-400">Instant Drop Reaction</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-sky-400 font-bold text-lg block">60 Mins</span>
                    <span className="text-[10px] text-slate-400">Satellite Advance Warning</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold text-lg block">0% Rot</span>
                    <span className="text-[10px] text-slate-400">Crop Protection Target</span>
                  </div>
                </div>
              </div>

              {/* Slide 2 */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                  Slide 2: The Two Sensory Brains
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-bold">
                      <Globe className="w-4 h-4" />
                      <span>Brain A: Internet Satellite Radar</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Continuously polls high-resolution micro-location models (Open-Meteo &amp; Doppler precipitation grids). Foresees storm clouds and rain fronts up to 6 hours before they arrive over the farm.
                    </p>
                    <div className="text-[10px] text-sky-300 font-mono">
                      Metrics: Precipitation rate (mm/h), Cloud cover (%), Rain probability (%)
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Cpu className="w-4 h-4" />
                      <span>Brain B: Micro-Farm Hardware Sensors</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Microcontroller (ESP32) on the roof running rain sensor plate, DHT22 ambient probe, and LDR sun tracker. If a sudden unpredicted microburst strikes, the hardware plate triggers an immediate instant closure.
                    </p>
                    <div className="text-[10px] text-emerald-300 font-mono">
                      Metrics: Rain Plate (AO/DO), Chamber Temp &amp; Humidity (DHT22), Light Lux (LDR)
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 3 */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Slide 3: Automatic Day / Night Cycle
                </span>
                <p className="text-slate-300 leading-relaxed">
                  During <strong>Nighttime</strong>, ambient temperature drops and relative humidity rises above 90%, causing heavy condensation and cold dew that can spoil areca nuts. The system utilizes both solar ephemeris and the LDR sensor (ADC &lt; 800) to automatically secure the canopy at night, reopening at dawn.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TRUTH & DECISION MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-bold text-white text-xs block mb-1">
                  How The System Decides (When to Execute / When Not to Execute)
                </span>
                <p className="text-slate-400 text-[11px]">
                  Under <strong>Combo Mode</strong>, safety takes priority: if <em>either</em> the physical sensor detects wet drops OR the internet predicts rain (probability &ge; 40% or precip &gt; 0 mm), the canopy immediately closes!
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Scenario</th>
                      <th className="p-3">ESP32 Sensor</th>
                      <th className="p-3">Satellite Forecast</th>
                      <th className="p-3">Day / Night</th>
                      <th className="p-3">Canopy Decision</th>
                      <th className="p-3">Execution Speed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    <tr className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">Sudden Flash Rain (Sensor First)</td>
                      <td className="p-3 text-rose-400 font-bold">WET (DO: LOW)</td>
                      <td className="p-3 text-emerald-400">Clear (Wrong/Lag)</td>
                      <td className="p-3 text-amber-400">Day</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded">
                          CLOSED INSTANTLY
                        </span>
                      </td>
                      <td className="p-3 text-emerald-400 font-mono">&lt; 100 ms</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">Approaching Storm Front (Forecast First)</td>
                      <td className="p-3 text-emerald-400">DRY</td>
                      <td className="p-3 text-rose-400 font-bold">Rain Expected (&ge; 40%)</td>
                      <td className="p-3 text-amber-400">Day</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded">
                          CLOSED PREVENTATIVE
                        </span>
                      </td>
                      <td className="p-3 text-sky-400 font-mono">Ahead of storm</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">Double Rain Consensus (Both Agree)</td>
                      <td className="p-3 text-rose-400 font-bold">WET</td>
                      <td className="p-3 text-rose-400 font-bold">RAIN</td>
                      <td className="p-3 text-slate-400">Any</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded">
                          CRITICAL CLOSED
                        </span>
                      </td>
                      <td className="p-3 text-emerald-400 font-mono">Immediate</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">Optimal Sunny Daytime</td>
                      <td className="p-3 text-emerald-400">DRY (LDR &gt; 1500)</td>
                      <td className="p-3 text-emerald-400">Sunny (0 mm)</td>
                      <td className="p-3 text-amber-400">Day</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded">
                          KEEP OPEN (DRYING)
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">Stable open</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">Night Storage &amp; Dew Protection</td>
                      <td className="p-3 text-slate-400">DRY (LDR &lt; 800)</td>
                      <td className="p-3 text-slate-400">Night Clear</td>
                      <td className="p-3 text-indigo-400 font-bold">Night</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded">
                          CLOSED (DEW SHIELD)
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">Automated dusk</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EXECUTION MODES */}
          {activeTab === 'flow' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">1. Combo Mode (Default)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Evaluates both Google/Internet satellite forecasting AND local ESP32 hardware sensors simultaneously. If either detects rain, canopy seals immediately.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">2. Sensor Only Mode</span>
                    <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-400 font-bold rounded">
                      Isolated Hardware
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ignores Internet weather models entirely. Relies solely on physical Rain Plate, DHT22 sensor, and LDR light values from your ESP32 board.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">3. Internet Only Mode</span>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 font-bold rounded">
                      Radar Driven
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ignores local hardware sensors. Controls canopy based purely on Google &amp; Open-Meteo satellite cloud and rain radar for the chosen micro-location.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">
                  Real-Time Chronological Decision History
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Mode: {currentMode}
                </span>
              </div>

              {decisionLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-500">
                  No decision events logged yet. Change sensor values or switch modes to record audit entries.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {decisionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500 text-[10px]">
                          {log.timeLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.executedAction === 'CLOSED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {log.executedAction}
                        </span>
                        <span className="text-slate-300 font-medium">{log.reason}</span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.5 bg-slate-900 rounded">
                          {log.decisionMode}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-900 rounded">
                          {log.dayNight}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Current Operating Mode: <strong className="text-indigo-400">{currentMode}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
