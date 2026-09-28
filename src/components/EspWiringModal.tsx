import React from 'react';
import { X, Cable, CheckCircle2, ShieldCheck, Zap, Cpu, AlertCircle } from 'lucide-react';

interface EspWiringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EspWiringModal: React.FC<EspWiringModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="esp-wiring-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="esp-wiring-modal-content"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cable className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                ESP32 Board Pin Connections
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full">
                  Exact Board Names
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Exact silkscreen markings printed on your ESP32 board (D4, D34, D27, D35, D26, 3V3, GND)
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Quick Notice */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white text-xs block">
                Direct Board Labels — Easy to Connect
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Look directly at the labels printed next to each metal pin on your ESP32 board.
                Plug each sensor into the exact pin name listed below.
              </p>
            </div>
          </div>

          {/* Interactive Connection Table */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              1. Sensors-to-ESP32 Board Pin Mapping
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: DHT22 */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">DHT22 Temp &amp; RH</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md">
                      Pin D4
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-400">
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>VCC (Power):</span>
                      <strong className="text-emerald-400">Board Pin 3V3</strong>
                    </li>
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>Data (Signal):</span>
                      <strong className="text-amber-400">Board Pin D4</strong>
                    </li>
                    <li className="flex justify-between">
                      <span>GND (Ground):</span>
                      <strong className="text-slate-200">Board Pin GND</strong>
                    </li>
                  </ul>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                  Tip: Connect 10kΩ resistor between 3V3 and Pin D4 if using bare DHT22.
                </div>
              </div>

              {/* Card 2: Rain Sensor Plate & Module */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">Rain Drop Sensor</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded-md">
                      Pins D34 &amp; D27
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-400">
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>VCC (Power):</span>
                      <strong className="text-emerald-400">Board Pin 3V3</strong>
                    </li>
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>GND (Ground):</span>
                      <strong className="text-slate-200">Board Pin GND</strong>
                    </li>
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>AO (Analog):</span>
                      <strong className="text-sky-400">Board Pin D34</strong>
                    </li>
                    <li className="flex justify-between">
                      <span>DO (Digital):</span>
                      <strong className="text-cyan-400">Board Pin D27</strong>
                    </li>
                  </ul>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                  Potentiometer adjusts sensitivity. Pin D27 goes LOW instantly when water drops hit the plate.
                </div>
              </div>

              {/* Card 3: LDR Light Sensor */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">Sunlight LDR</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md">
                      Pin D35
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-400">
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>VCC (Power):</span>
                      <strong className="text-emerald-400">Board Pin 3V3</strong>
                    </li>
                    <li className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>GND (Ground):</span>
                      <strong className="text-slate-200">Board Pin GND</strong>
                    </li>
                    <li className="flex justify-between">
                      <span>AO (Analog):</span>
                      <strong className="text-amber-400">Board Pin D35</strong>
                    </li>
                  </ul>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                  Measures ambient sunshine intensity to automate day/night canopy retraction.
                </div>
              </div>
            </div>
          </div>

          {/* 2. 12V MOTOR DRIVER & GEARED MOTOR WIRING (L298N / H-BRIDGE) */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              2. 12V Gear Motor &amp; Motor Driver Connection (L298N / Dual H-Bridge)
            </h3>

            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>12V DC Gear Motor + Driver (Intermediate Interface)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      12V High-Torque Power
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Because the roof motor requires 12V, it is powered by an external 12V source through the motor driver with common ground to the ESP32.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-lg shrink-0">
                  Bi-Directional + Speed Control
                </span>
              </div>

              {/* Pin Table for Motor Driver */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* ESP32 to Motor Driver Logic */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-indigo-300 text-xs block">
                    A. ESP32 Logic Pins &rarr; Motor Driver Inputs
                  </span>
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D26</td>
                        <td className="py-1.5 font-mono font-bold text-amber-300">&rarr; IN1 (Motor 1 Open / Front)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D25</td>
                        <td className="py-1.5 font-mono font-bold text-amber-300">&rarr; IN2 (Motor 1 Close / Back)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D14</td>
                        <td className="py-1.5 font-mono font-bold text-cyan-300">&rarr; ENA (PWM Speed Control)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D33</td>
                        <td className="py-1.5 font-mono font-bold text-rose-300">&rarr; IN3 (12V Heater / Ch-B ON)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D32</td>
                        <td className="py-1.5 font-mono font-bold text-rose-300">&rarr; IN4 (12V Heater / Ch-B Direction)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">ESP32 Pin D12</td>
                        <td className="py-1.5 font-mono font-bold text-amber-300">&rarr; ENB (Heater PWM Power / Intensity)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 12V Power & Motor Outputs */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-300 text-xs block">
                    B. 12V Power Supply &amp; Load Outputs
                  </span>
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="py-1.5 text-slate-400">External 12V (+)</td>
                        <td className="py-1.5 font-mono font-bold text-rose-400">&rarr; Driver 12V Power Terminal (VMS)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">External 12V (-) GND</td>
                        <td className="py-1.5 font-mono font-bold text-emerald-400">&rarr; Driver GND &amp; ESP32 GND (Shared!)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">Driver OUT1 &amp; OUT2</td>
                        <td className="py-1.5 font-mono font-bold text-white">&rarr; Channel A: 12V Gear Motor (Canopy Roof)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">Driver OUT3 &amp; OUT4</td>
                        <td className="py-1.5 font-mono font-bold text-rose-300">&rarr; Channel B: 12V Heater / Hot-Air Blower</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Critical Common Ground Warning */}
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/50 rounded-xl text-[11px] text-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>CRITICAL COMMON GROUND:</strong> Always connect the External 12V Power Supply negative (-) to the Motor Driver GND <em>AND</em> the ESP32 GND. Without this shared ground, the motor driver logic signals will float and trigger randomly.
                </span>
              </div>
            </div>
          </div>

          {/* Graphical Visual Board Connection Schematic */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-white text-xs block">
              Complete Hardware Wiring &amp; Motor Driver Diagram
            </span>
            <div className="p-3 bg-black/80 rounded-xl font-mono text-[11px] text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
{`+-------------------------------------------------------------------------+
|                  COMPLETE ESP32 & 12V MOTOR DRIVER SCHEMATIC             |
|                                                                         |
|  [SENSORS]                                                              |
|   3V3        -----> Connect to VCC of DHT22, Rain Board, Sunlight LDR   |
|   GND        -----> Connect to GND of all sensors & Motor Driver GND     |
|   Pin D4     <----- DHT22 Sensor (Data pin)                             |
|   Pin D34    <----- Rain Sensor AO (Analog water level)                 |
|   Pin D27    <----- Rain Sensor DO (Digital immediate rain trip)         |
|   Pin D35    <----- LDR Sunlight Sensor AO                              |
|   Pin D2     -----> Internal Blue LED (Wi-Fi status heartbeat)          |
|                                                                         |
|  [12V MOTOR DRIVER INTERFACE (L298N / BTS7960 / H-BRIDGE)]              |
|   Pin D26    -----> Driver IN1 (Roof Motor OPEN / Forward)              |
|   Pin D25    -----> Driver IN2 (Roof Motor CLOSE / Reverse)             |
|   Pin D14    -----> Driver ENA (PWM Motor Speed Modulation)             |
|   Pin D33    -----> Driver IN3 (Motor 2 Roller Forward)                 |
|   Pin D32    -----> Driver IN4 (Motor 2 Roller Reverse)                 |
|                                                                         |
|  [12V POWER & HIGH-TORQUE MOTOR CONNECTIONS]                            |
|   12V DC (+) -----> Driver 12V Terminal                                 |
|   12V DC (-) -----> Driver GND + ESP32 GND (Common Ground)              |
|   Driver OUT1 & OUT2 -----> 12V Gear Motor #1 (Roof Canopy Lead Screw)  |
|   Driver OUT3 & OUT4 -----> 12V Gear Motor #2 (Auxiliary Roller/Shade)  |
+-------------------------------------------------------------------------+`}
            </div>
          </div>

          {/* Quick Confirmation */}
          <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl text-[11px] text-slate-400 border border-slate-700/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Ready to Upload:</strong> Just flash the code and plug wires into the matching pin names on your ESP board.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Diagram
          </button>
        </div>
      </div>
    </div>
  );
};
