import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  X, 
  Share2, 
  PlusSquare, 
  ExternalLink,
  Copy,
  Check,
  Zap,
  AlertCircle
} from 'lucide-react';
import { ArecaDryerLogo } from './ArecaDryerLogo';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallSuccess?: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
}) => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('android');
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'installed'>('idle');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    // Detect if running as installed PWA
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect iframe
    try {
      setIsInsideIframe(window.self !== window.top);
    } catch {
      setIsInsideIframe(true);
    }

    // App direct URL
    const url = window.location.origin || window.location.href;
    setAppUrl(url);

    // Platform detection
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (e) {
      console.error('Failed to copy URL:', e);
    }
  };

  const handleOpenDirectTab = () => {
    if (appUrl) {
      window.open(appUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstallStatus('installing');
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallStatus('installed');
          if (onInstallSuccess) onInstallSuccess();
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setInstallStatus('idle');
        }
      } catch (err) {
        console.error('Install prompt error:', err);
        setInstallStatus('idle');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with App Logo & Title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-xl bg-slate-950 border border-amber-500/30 shadow-md">
              <ArecaDryerLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white">ArecaGuard</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                  App Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">Areca Nut Farm Dryer & Weather AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current App State */}
        {isStandalone ? (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span><strong>ArecaGuard</strong> is already running in standalone app mode on your device!</span>
          </div>
        ) : (
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sky-300 font-bold">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Full Screen & Standalone App Experience</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Install <strong>ArecaGuard</strong> to your mobile home screen or computer. It opens instantly with the official logo, operates in full screen without browser toolbars, and controls your dryer canopy directly.
            </p>
          </div>
        )}

        {/* Direct App URL Section with Open Button & Copy Button */}
        <div className="p-3.5 bg-gradient-to-br from-indigo-950/70 via-slate-950/90 to-sky-950/70 border border-indigo-500/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Your Direct App URL:</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-600/40">
              Live Cloud URL
            </span>
          </div>

          {/* URL Bar with Copy Button */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1.5">
            <input
              type="text"
              readOnly
              value={appUrl}
              className="bg-transparent text-slate-200 text-xs font-mono flex-1 outline-hidden select-all px-1 truncate"
            />
            <button
              onClick={handleCopyUrl}
              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-xs"
              title="Copy link to open on phone"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
            </button>
          </div>

          {/* Big Open Direct App Button */}
          <button
            onClick={handleOpenDirectTab}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-950/60"
            title="Open ArecaGuard in a standalone new browser window"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open ArecaGuard in New Tab</span>
          </button>

          {/* AI Studio Warning Explainer */}
          {isInsideIframe && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-500/50 rounded-lg text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-bold block mb-0.5">Important: Avoid downloading AI Studio itself</strong>
                You are currently inside the AI Studio preview. If you use the browser's install menu here, your browser will download the AI Studio tool.
                Click <strong>"Open ArecaGuard in New Tab"</strong> above first. In that new tab, installing will install <strong>ArecaGuard</strong> directly with its custom logo!
              </div>
            </div>
          )}
        </div>

        {/* Action Button: Direct 1-Click Install if prompt available in standalone browser */}
        {deferredPrompt && !isStandalone && (
          <button
            onClick={handleInstallClick}
            disabled={installStatus === 'installing'}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {installStatus === 'installing' ? 'Installing ArecaGuard...' : installStatus === 'installed' ? 'Installed Successfully!' : 'Install ArecaGuard App Now'}
            </span>
          </button>
        )}

        {/* Step-by-Step Instructions by OS */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            How to Install from Direct App Tab:
          </span>

          {/* Android Chrome Instructions */}
          {platform === 'android' && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <Smartphone className="w-4 h-4" />
                <span>Android (Chrome / Samsung Internet)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                <li className="leading-tight">
                  Open the direct app link in Chrome on your phone.
                </li>
                <li className="leading-tight">
                  Tap the <strong className="text-white">three dots menu (⋮)</strong> at the top-right corner.
                </li>
                <li className="leading-tight">
                  Tap <strong className="text-emerald-300">"Install app"</strong> (or <strong className="text-emerald-300">"Add to Home screen"</strong>).
                </li>
                <li className="leading-tight">
                  Tap <strong className="text-white">"Install"</strong> or <strong className="text-white">"Create shortcut"</strong>. The <strong className="text-amber-300">ArecaGuard</strong> icon and name will be placed on your home screen!
                </li>
              </ol>
              <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-400">
                <span className="font-semibold text-emerald-400">PWA Ready:</span> High-resolution 192px/512px PNG icons, standalone display mode, and offline Service Worker are configured so ArecaGuard installs with its custom logo and name.
              </div>
            </div>
          )}

          {/* iOS Safari Instructions */}
          {platform === 'ios' && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <Share2 className="w-4 h-4" />
                <span>iPhone / iPad (Safari)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                <li className="leading-tight">
                  Open the direct app link in Safari.
                </li>
                <li className="leading-tight">
                  Tap the <strong className="text-white">Share button</strong> (<Share2 className="w-3 h-3 inline mx-0.5 text-sky-400" /> icon at bottom bar).
                </li>
                <li className="leading-tight">
                  Scroll down and tap <strong className="text-sky-300">"Add to Home Screen"</strong> (<PlusSquare className="w-3 h-3 inline mx-0.5" />).
                </li>
                <li className="leading-tight">
                  Tap <strong className="text-white">"Add"</strong> in top right. Launch <strong className="text-amber-300">ArecaGuard</strong> directly from your home screen.
                </li>
              </ol>
            </div>
          )}

          {/* Desktop Laptop Instructions */}
          {platform === 'desktop' && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Monitor className="w-4 h-4" />
                <span>Laptop & Desktop (Chrome / Edge / Brave)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                <li className="leading-tight">
                  Open the app in its own browser tab.
                </li>
                <li className="leading-tight">
                  Look at the right side of the address bar for the <strong className="text-white">Install icon (⊕ or 💻)</strong>.
                </li>
                <li className="leading-tight">
                  Click <strong className="text-amber-300">"Install ArecaGuard"</strong>.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Standalone zero-clutter window</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Instant launch with official logo</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Fast offline caching</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Works on mobile & laptop</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
