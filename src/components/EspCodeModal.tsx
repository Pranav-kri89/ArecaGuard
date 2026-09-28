import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Wifi, Key, Link as LinkIcon, Cpu, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { generateArecaDryerEsp32Code } from '../utils/espArecaCode';

interface EspCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
}

export const EspCodeModal: React.FC<EspCodeModalProps> = ({
  isOpen,
  onClose,
  serverUrl,
}) => {
  const [wifiSsid, setWifiSsid] = useState('realme P3 Ultra 5G');
  const [wifiPassword, setWifiPassword] = useState('00000000');
  const [customServerUrl, setCustomServerUrl] = useState(
    serverUrl.startsWith('http') ? `${serverUrl}/sensor-data` : 'http://YOUR_SERVER_IP:3000/sensor-data'
  );
  const [showConfig, setShowConfig] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const code = generateArecaDryerEsp32Code({
    wifiSsid,
    wifiPassword,
    serverUrl: customServerUrl,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownloadIno = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'areca_dryer_firmware.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="esp-code-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="esp-code-modal-content"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-auto sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-base font-bold text-white tracking-tight">
                ESP32 Farm Dryer Firmware Code
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                Auto-injects your Wi-Fi credentials &amp; pin configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Collapsible / Compact Wi-Fi Configuration Bar */}
        <div className="border-b border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="px-3.5 sm:px-5 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-white">
                SSID: <span className="font-mono text-emerald-300">{wifiSsid}</span>
              </span>
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-[10px] sm:text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>{showConfig ? 'Hide Wi-Fi Settings' : 'Change Wi-Fi / URL'}</span>
              {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showConfig && (
            <div className="p-3 sm:p-4 border-t border-slate-800/60 bg-slate-950/90 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-0.5 text-[10px] font-medium">Wi-Fi SSID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Wi-Fi Name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                  />
                  <Wifi className="w-3 h-3 text-slate-500 absolute right-2.5 top-2" />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-0.5 text-[10px] font-medium">Wi-Fi Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Wi-Fi Password"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                  />
                  <Key className="w-3 h-3 text-slate-500 absolute right-2.5 top-2" />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-0.5 text-[10px] font-medium">Server API URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customServerUrl}
                    onChange={(e) => setCustomServerUrl(e.target.value)}
                    placeholder="http://IP:3000/sensor-data"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-[10.5px] placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                  <LinkIcon className="w-3 h-3 text-slate-500 absolute right-2.5 top-2" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Quick Hint Banner */}
        <div className="px-3.5 sm:px-5 py-1.5 bg-amber-950/40 border-b border-amber-900/40 text-[10px] sm:text-[11px] text-amber-200 flex flex-wrap items-center justify-between gap-1 shrink-0">
          <span>
            Arduino IDE: Press <kbd className="bg-amber-900/80 px-1 py-0.2 rounded font-mono text-[9px] text-white">Ctrl+A</kbd> &amp; <kbd className="bg-amber-900/80 px-1 py-0.2 rounded font-mono text-[9px] text-white">Del</kbd> to clear old sketch first!
          </span>
          <span className="text-emerald-300 font-mono text-[9.5px]">Libs: PubSubClient &amp; DHT</span>
        </div>

        {/* Code Editor Preview: Guaranteed generous scrolling height on mobile */}
        <div className="flex-1 min-h-[180px] overflow-auto p-3 sm:p-4 bg-slate-950 font-mono text-[11px] sm:text-xs text-slate-300 select-all leading-relaxed">
          <pre className="whitespace-pre">{code}</pre>
        </div>

        {/* Responsive Mobile-Friendly Footer */}
        <div className="p-2.5 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Upload to ESP32 board via Arduino IDE.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadIno}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="Download .ino file directly"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>.ino File</span>
            </button>

            <button
              id="modal-copy-firmware-btn"
              onClick={handleCopy}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ESP32 Code</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
