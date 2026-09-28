import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Compass,
  CloudRain,
  Sun,
  Cloud,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Send,
  ExternalLink,
  RefreshCw,
  Info,
  Layers,
  Wind,
  Droplets,
  Thermometer,
  Maximize2,
  Minimize2,
  X,
  Search,
  CheckCircle2,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import L from 'leaflet';
import {
  Radar30kmScanResult,
  RadarLocationPoint,
  TelegramBotStatus,
  LocationItem,
  SensorTelemetry,
  CanopyMode,
  RoofPersistentState,
} from '../types';

interface RadarMapTabProps {
  selectedLocation: LocationItem;
  telemetry: SensorTelemetry | null;
  language?: 'en' | 'kn';
  canopyMode?: CanopyMode;
  roofState?: RoofPersistentState | null;
  onExecuteRoofCommand?: (cmd: 'OPEN' | 'CLOSED' | 'AUTO') => void;
  onOpenSettings?: () => void;
}

export const RadarMapTab: React.FC<RadarMapTabProps> = ({
  selectedLocation,
  telemetry,
  language = 'en',
  canopyMode = 'AUTO',
  roofState,
  onExecuteRoofCommand,
  onOpenSettings,
}) => {
  const [radarData, setRadarData] = useState<Radar30kmScanResult | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramBotStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [isSendingAlert, setIsSendingAlert] = useState<boolean>(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState<string | null>(null);

  // Real-time backend motor motion detection & locking
  const isMoving = roofState?.activeMotorRotation === 'OPENING' || roofState?.activeMotorRotation === 'CLOSING';
  const activeRemaining = roofState?.activeRemainingSeconds ?? 0;

  // Roof state & directional button visibility (strictly show ONLY opposite action)
  const physicalPos = roofState?.physicalRoofPosition ?? (canopyMode === 'CLOSED' ? 'CLOSED' : 'OPEN');
  const isStoppedRecovery = physicalPos === 'STOPPED';
  const isRoofOpen = physicalPos === 'OPEN' || roofState?.activeMotorRotation === 'OPENING' || (!roofState && canopyMode === 'OPEN');

  // Single opposite button: If open -> show only Close. If closed -> show only Open. If stopped recovery -> show both.
  const showCloseButton = isStoppedRecovery || isRoofOpen;
  const showOpenButton = isStoppedRecovery || !isRoofOpen;

  // Full Screen Mode state & filters
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [mobileFullscreenTab, setMobileFullscreenTab] = useState<'MAP' | 'TOWNS'>('MAP');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | '10KM' | 'RAIN' | 'THREAT' | 'CLEAR'>('ALL');

  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<number, L.Marker>>(new Map());
  const centerMarkerRef = useRef<L.Marker | null>(null);

  // Enter full screen with native browser support & mobile optimizations
  const [radarScope, setRadarScope] = useState<'10km' | '30km' | '60km' | '100km'>('30km');
  const handleEnterFullScreen = async () => {
    setIsFullScreen(true);
    setMobileFullscreenTab('MAP');
    try {
      const el = fullScreenContainerRef.current || document.documentElement;
      if (el && !document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      }
    } catch {
      // CSS fullscreen will take effect
    }
  };

  const handleExitFullScreen = async () => {
    setIsFullScreen(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  // Keyboard shortcut for Full Screen: ESC to exit, F to enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        handleExitFullScreen();
      }
      if (
        (e.key === 'f' || e.key === 'F') &&
        !isFullScreen &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        handleEnterFullScreen();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullScreen]);

  // Leaflet resize invalidate when entering/exiting full screen or switching mobile tabs
  useEffect(() => {
    const t1 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 60);
    const t2 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
    const t3 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullScreen, mobileFullscreenTab]);

  // Fetch Radar data and Telegram bot status for selected location
  const fetchRadar = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/radar-30km?lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.radar) {
          setRadarData(json.radar);
        }
      }
    } catch (err) {
      console.error('Error fetching 30km radar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTelegram = async () => {
    try {
      const res = await fetch('/api/telegram-status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.status) {
          setTelegramStatus(json.status);
        }
      }
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    }
  };

  useEffect(() => {
    fetchRadar();
    fetchTelegram();
    const interval = setInterval(() => {
      fetchRadar();
      fetchTelegram();
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedLocation.latitude, selectedLocation.longitude]);

  // Send Manual Test Conflict Push Alert to Telegram
  const handleSendTestAlert = async () => {
    setIsSendingAlert(true);
    setAlertSuccessMsg(null);
    try {
      const res = await fetch('/api/telegram-test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: selectedLocation.name,
          reason: 'MANUAL TEST: Operator requested 30km regional radar perimeter threat verification',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertSuccessMsg(data.message || 'Telegram test alert dispatched successfully!');
        setTimeout(() => setAlertSuccessMsg(null), 5000);
      } else {
        setAlertSuccessMsg(data.error || 'Failed to dispatch alert.');
      }
    } catch (err) {
      setAlertSuccessMsg('Network error sending Telegram push.');
    } finally {
      setIsSendingAlert(false);
    }
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const lat = selectedLocation.latitude;
    const lon = selectedLocation.longitude;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 10, // Default 30km scope
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // High-clarity CartoDB Positron / OSM style tiles for high contrast map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    } else {
      const zoomMap: Record<string, number> = {
        '10km': 11.5,
        '30km': 10,
        '60km': 9,
        '100km': 8.5,
      };
      mapInstanceRef.current.setView([lat, lon], zoomMap[radarScope] || 10);
    }

    const map = mapInstanceRef.current;
    const markers = markersRef.current;
    if (!markers) return;

    markers.clearLayers();
    markerMapRef.current.clear();

    const is10kmClear = radarData ? (radarData.is10kmPerimeterClear ?? (radarData.rainIn10kmCount === 0)) : true;

    // 1. 10 km Critical Action Zone Ring (Shield)
    L.circle([lat, lon], {
      radius: 10000,
      color: is10kmClear ? '#10b981' : '#ef4444',
      weight: radarScope === '10km' ? 3.5 : (is10kmClear ? 2.5 : 3),
      dashArray: is10kmClear ? '4, 4' : '6, 4',
      fillColor: is10kmClear ? '#10b981' : '#ef4444',
      fillOpacity: is10kmClear ? 0.08 : 0.16,
    }).addTo(markers).bindTooltip(
      is10kmClear
        ? '🛡️ 10 km Critical Shield (All Clear - Canopy Open for Drying)'
        : '🚨 10 km Critical Shield (BREACHED - Canopy Closed for Protection)',
      { permanent: false, direction: 'top' }
    );

    // 2. 30 km Primary Default Radar Scope Ring
    L.circle([lat, lon], {
      radius: 30000,
      color: '#0284c7',
      weight: radarScope === '30km' ? 3.5 : 2,
      dashArray: radarScope === '30km' ? 'none' : '5, 8',
      fillColor: '#0284c7',
      fillOpacity: radarScope === '30km' ? 0.08 : 0.02,
    }).addTo(markers).bindTooltip('30 km Regional Scope (Default Active Area)', { permanent: false, direction: 'top' });

    // 3. 60 km Regional Reference Ring
    L.circle([lat, lon], {
      radius: 60000,
      color: '#f59e0b',
      weight: radarScope === '60km' ? 3 : 1.5,
      dashArray: '5, 8',
      fillColor: '#f59e0b',
      fillOpacity: radarScope === '60km' ? 0.06 : 0.02,
    }).addTo(markers).bindTooltip('60 km Regional Reference Band', { permanent: false, direction: 'top' });

    // 4. 100 km Extended Doppler Radar Boundary
    L.circle([lat, lon], {
      radius: 100000,
      color: '#8b5cf6',
      weight: radarScope === '100km' ? 3 : 2,
      dashArray: '6, 8',
      fillColor: '#8b5cf6',
      fillOpacity: radarScope === '100km' ? 0.06 : 0.02,
    }).addTo(markers).bindTooltip('100 km Max Doppler Radar Scope (Reference Context)', { permanent: false, direction: 'top' });

    // 2. Custom Center Farm Marker
    const farmIconHtml = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: ${is10kmClear ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: ${is10kmClear ? '#059669' : '#dc2626'}; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">
          🏠
        </div>
      </div>
    `;

    const farmIcon = L.divIcon({
      html: farmIconHtml,
      className: 'custom-farm-marker',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const centerM = L.marker([lat, lon], { icon: farmIcon })
      .addTo(markers)
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; color: #0f172a; padding: 2px;">
          <strong style="color: #059669; font-size: 14px;">🏠 Your Selected Farm Location</strong><br/>
          <strong>${selectedLocation.name}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</span><br/>
          <div style="margin-top: 6px; padding: 4px 8px; background: ${is10kmClear ? '#ecfdf5' : '#fef2f2'}; border-radius: 6px; font-size: 11px; color: ${is10kmClear ? '#065f46' : '#991b1b'}; font-weight: 600;">
            ${is10kmClear ? '🛡️ 10km Shield: ALL CLEAR (Canopy Open)' : '🚨 10km Shield: RAIN CELL INSIDE PERIMETER (Canopy Closed)'}
          </div>
        </div>`
      );
    centerMarkerRef.current = centerM;

    // 3. Add Markers for All Real Surrounding Towns / Places (Filtered by active radarScope)
    if (radarData?.points && radarData.points.length > 0) {
      // Determine max distance cutoff based on active radarScope (prevents marker clutter in 30km default)
      const scopeMaxDist =
        radarScope === '10km' ? 12 :
        radarScope === '30km' ? 36 :
        radarScope === '60km' ? 68 : 105;

      radarData.points.forEach((pt, idx) => {
        if (pt.isCenter) {
          markerMapRef.current.set(idx, centerM);
          return;
        }

        // Filter out markers beyond the selected scope
        if (pt.distanceKm > scopeMaxDist) {
          return;
        }

        const isWithin10km = pt.distanceKm <= 10.0;
        const isRain = pt.isRaining || pt.precipitation > 0.1;
        const isThreat = pt.rainProbability >= 35 && !isRain;

        const markerColor = isRain ? '#ef4444' : isThreat ? '#f59e0b' : '#10b981';
        const weatherEmoji = isRain ? '🌧️' : pt.cloudCover > 65 ? '☁️' : pt.cloudCover > 30 ? '⛅' : '☀️';
        const shieldBadge = isWithin10km ? '🛡️ ' : '';

        const placeIconHtml = `
          <div style="cursor: pointer; display: flex; flex-direction: column; align-items: center;">
            <div style="background: ${markerColor}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: 800; border: 2px solid ${isWithin10km ? '#fbbf24' : '#ffffff'}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; display: flex; align-items: center; gap: 3px;">
              <span>${weatherEmoji}</span>
              <span>${shieldBadge}${pt.placeName || pt.direction}</span>
              <span style="opacity: 0.9; font-weight: normal;">(${pt.distanceKm}km)</span>
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${markerColor};"></div>
          </div>
        `;

        const placeIcon = L.divIcon({
          html: placeIconHtml,
          className: 'custom-place-marker',
          iconSize: [84, 28],
          iconAnchor: [42, 28],
        });

        const m = L.marker([pt.latitude, pt.longitude], { icon: placeIcon })
          .addTo(markers)
          .bindPopup(
            `<div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; min-width: 180px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
                <strong style="font-size: 14px; color: #1e293b;">${pt.placeName}</strong>
                <span style="font-size: 11px; background: ${isWithin10km ? '#fef3c7' : '#f1f5f9'}; color: ${isWithin10km ? '#92400e' : '#334155'}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                  ${pt.distanceKm} km ${pt.direction}
                </span>
              </div>
              <div style="margin-bottom: 6px; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${isWithin10km ? '#ecfdf5' : '#f8fafc'}; color: ${isWithin10km ? '#065f46' : '#475569'}; border: 1px solid ${isWithin10km ? '#a7f3d0' : '#e2e8f0'};">
                ${isWithin10km ? '🛡️ Critical 10km Shield Zone (Triggers Canopy Closure if Rain)' : '📍 10-100km Reference Zone (Monitored - Canopy Stays Open)'}
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Weather:</strong> ${pt.condition}
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Precipitation:</strong> <span style="font-weight: bold; color: ${pt.precipitation > 0 ? '#dc2626' : '#059669'};">${pt.precipitation.toFixed(1)} mm/h</span>
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Rain Risk:</strong> <span style="font-weight: bold; color: ${pt.rainProbability >= 40 ? '#dc2626' : '#059669'};">${pt.rainProbability}%</span>
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Cloud Cover:</strong> ${pt.cloudCover}%
              </div>
              <div>
                <strong>Temperature:</strong> ${pt.temperature.toFixed(1)}°C
              </div>
              <div style="margin-top: 6px; font-size: 10px; color: #64748b;">
                GPS: ${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}
              </div>
            </div>`
          );

        m.on('click', () => {
          setSelectedPointIndex(idx);
        });

        markerMapRef.current.set(idx, m);
      });
    }
  }, [selectedLocation, radarData, radarScope]);

  const points = radarData?.points || [];
  const selectedPoint = points[selectedPointIndex] || points[0] || null;

  // Active scope filtering
  const activeScopeMaxDist =
    radarScope === '10km' ? 12 :
    radarScope === '30km' ? 36 :
    radarScope === '60km' ? 68 : 105;

  const pointsInActiveScope = points.filter(p => p.distanceKm <= activeScopeMaxDist || p.isCenter);
  const rainInActiveScope = pointsInActiveScope.filter(p => p.isRaining || p.precipitation > 0.1).length;

  // Counts for filters and 10km perimeter analytics
  const pointsIn10km = points.filter(p => p.distanceKm <= 10.0 || p.isCenter);
  const rainIn10km = pointsIn10km.filter(p => p.isRaining || p.precipitation > 0.1).length;
  const is10kmPerimeterClear = radarData ? (radarData.is10kmPerimeterClear ?? (rainIn10km === 0)) : true;

  const rainCount = points.filter(p => p.isRaining || p.precipitation > 0.1).length;
  const threatCount = points.filter(p => p.rainProbability >= 35 && !p.isRaining && p.precipitation <= 0.1).length;
  const clearCount = points.filter(p => !p.isRaining && p.precipitation <= 0.1 && p.rainProbability < 35).length;

  // Filtered list of points for the sidebar and grid
  const filteredPoints = points.filter((pt) => {
    const matchesSearch =
      pt.placeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.direction.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const isRain = pt.isRaining || pt.precipitation > 0.1;
    const isThreat = pt.rainProbability >= 35 && !isRain;

    if (filterMode === '10KM') return pt.distanceKm <= 10.0 || pt.isCenter;
    if (filterMode === 'RAIN') return isRain;
    if (filterMode === 'THREAT') return isThreat || isRain;
    if (filterMode === 'CLEAR') return !isRain && !isThreat;
    return true;
  });

  const handleSelectPoint = (idx: number) => {
    setSelectedPointIndex(idx);
    const pt = points[idx];
    if (pt && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([pt.latitude, pt.longitude], 12, { duration: 0.6 });
      const m = markerMapRef.current.get(idx);
      if (m) {
        setTimeout(() => m.openPopup(), 350);
      }
    }
  };

  const handleSelectFarm = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedLocation.latitude, selectedLocation.longitude], 11, { duration: 0.6 });
      if (centerMarkerRef.current) {
        setTimeout(() => centerMarkerRef.current?.openPopup(), 350);
      }
    }
  };

  const handleSelectScope = (scope: '10km' | '30km' | '60km' | '100km') => {
    setRadarScope(scope);
    if (mapInstanceRef.current) {
      const zoomMap: Record<string, number> = {
        '10km': 11.5,
        '30km': 10,
        '60km': 9,
        '100km': 8.5,
      };
      mapInstanceRef.current.flyTo(
        [selectedLocation.latitude, selectedLocation.longitude],
        zoomMap[scope] || 10,
        { duration: 0.6 }
      );
    }
  };

  return (
    <div
      ref={fullScreenContainerRef}
      className={isFullScreen ? "fixed inset-0 z-[9999] bg-slate-950 flex flex-col text-slate-100 overflow-hidden font-sans" : "space-y-3.5"}
    >
      {/* -------------------------------------------------------------------------
          FULL SCREEN PRESENTATION HEADER BAR
         ------------------------------------------------------------------------- */}
      {isFullScreen ? (
        <header className="h-12 sm:h-14 bg-slate-900/95 border-b border-slate-800 px-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-lg z-30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
                Geographic Radar &bull; {radarScope} Scope &bull; {selectedLocation.name}
              </h2>
            </div>
          </div>

          {/* Mobile Screen Tab Switcher: Map vs Towns */}
          <div className="flex md:hidden items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setMobileFullscreenTab('MAP')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                mobileFullscreenTab === 'MAP' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setMobileFullscreenTab('TOWNS')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                mobileFullscreenTab === 'TOWNS' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Towns ({points.length})
            </button>
          </div>

          {/* Regional Consensus Status Badge (Desktop only) */}
          {radarData && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  is10kmPerimeterClear
                    ? 'bg-emerald-400'
                    : 'bg-rose-500 animate-ping'
                }`}
              />
              <span className="font-bold text-slate-200">
                {is10kmPerimeterClear
                  ? '10km Shield: ALL CLEAR'
                  : '10km Shield: BREACHED'}
              </span>
              <span className="text-[10px] text-slate-300 px-1.5 py-0.5 rounded bg-slate-800 font-mono font-bold">
                100km Scope: {rainCount} rain cell(s)
              </span>
            </div>
          )}

          {/* Controls: Refresh, Roof Actions & Exit Full Screen */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchRadar}
              disabled={isLoading}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Refresh radar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onExecuteRoofCommand && (
              <div className="hidden sm:flex items-center gap-1.5">
                {showCloseButton && (
                  <button
                    disabled={isMoving}
                    onClick={() => onExecuteRoofCommand('CLOSED')}
                    className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      isMoving
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40 cursor-wait'
                        : 'bg-rose-600 hover:bg-rose-500 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isMoving && roofState?.activeMotorRotation === 'CLOSING' ? (
                      <>
                        <RotateCw className="w-3 h-3 animate-spin" />
                        <span>Closing {activeRemaining}s</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-3 h-3" />
                        <span>Close</span>
                      </>
                    )}
                  </button>
                )}
                {showOpenButton && (
                  <button
                    disabled={isMoving}
                    onClick={() => onExecuteRoofCommand('OPEN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      isMoving
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 cursor-wait'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    {isMoving && roofState?.activeMotorRotation === 'OPENING' ? (
                      <>
                        <RotateCw className="w-3 h-3 animate-spin" />
                        <span>Opening {activeRemaining}s</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3 h-3" />
                        <span>Open</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleExitFullScreen}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Exit Full Screen (ESC)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </header>
      ) : (
        /* -------------------------------------------------------------------------
            STANDARD NORMAL TOP HEADER CARD
           ------------------------------------------------------------------------- */
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-extrabold text-white tracking-tight break-words">
                  Geographic Radar &bull; {radarScope} Scope{radarScope === '30km' ? ' (Default)' : ''}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 break-words">
                  Surrounding <strong className="text-amber-300">{selectedLocation.name}</strong> &bull; {is10kmPerimeterClear ? (
                    <span className="text-emerald-400 font-semibold">10km Shield Safe</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">10km Shield Breached</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start sm:self-auto">
              <button
                onClick={fetchRadar}
                disabled={isLoading}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleEnterFullScreen}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md"
                title="Full Screen Map"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Screen</span>
              </button>
            </div>
          </div>

          {/* Threat Level Arbiter Banner with Calibrated Risk - Clean & Readable */}
          {radarData && (
            <div
              className={`mt-2.5 p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                !is10kmPerimeterClear
                  ? 'bg-rose-950/50 border-rose-500/70 text-rose-200'
                  : radarData.conflictState === 'LOCAL_ISOLATED_SHOWER'
                  ? 'bg-blue-950/50 border-blue-500/70 text-blue-200'
                  : radarData.conflictState === 'RADAR_CONFLICT_APPROACHING'
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-black/30 shrink-0 mt-0.5">
                  {!is10kmPerimeterClear ? (
                    <CloudRain className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 animate-bounce" />
                  ) : is10kmPerimeterClear ? (
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5 flex-wrap">
                    <span>
                      {!is10kmPerimeterClear
                        ? '10km Shield Breached: Rain Nearby'
                        : '10km Shield: ALL CLEAR (Drying Safe)'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 border border-white/20 font-bold whitespace-nowrap">
                      10km: {is10kmPerimeterClear ? 'CLEAR' : 'BREACHED'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 border border-white/20 font-bold whitespace-nowrap">
                      {radarScope}: {rainInActiveScope} rain cell(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug break-words">
                    {is10kmPerimeterClear
                      ? radarData.nearestRainDistanceKm && radarData.nearestRainDistanceKm > 10
                        ? `Therpal OPEN. Distant rain at ${radarData.nearestRainPlaceName} (~${radarData.nearestRainDistanceKm}km) monitored for reference only.`
                        : 'Therpal OPEN. No rain clouds detected within 10km perimeter.'
                      : `Therpal CLOSED for crop protection. Rain cell detected at ${radarData.nearestRainPlaceName || 'nearby sector'} (~${radarData.nearestRainDistanceKm}km).`}
                  </p>
                </div>
              </div>

              {/* Quick Action button inside banner */}
              {onExecuteRoofCommand && (
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  {showCloseButton && (
                    <button
                      disabled={isMoving}
                      onClick={() => onExecuteRoofCommand('CLOSED')}
                      className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        isMoving
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40 cursor-wait'
                          : 'bg-rose-600 hover:bg-rose-500 cursor-pointer active:scale-95'
                      }`}
                    >
                      {isMoving && roofState?.activeMotorRotation === 'CLOSING' ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Closing {activeRemaining}s</span>
                        </>
                      ) : (
                        <>
                          <Shield className="w-3.5 h-3.5" />
                          <span>Close</span>
                        </>
                      )}
                    </button>
                  )}
                  {showOpenButton && (
                    <button
                      disabled={isMoving}
                      onClick={() => onExecuteRoofCommand('OPEN')}
                      className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        isMoving
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 cursor-wait'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                      }`}
                    >
                      {isMoving && roofState?.activeMotorRotation === 'OPENING' ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Opening {activeRemaining}s</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------------
          MAP AREA (Full Screen Split View OR Normal View)
         ------------------------------------------------------------------------- */}
      <div
        className={
          isFullScreen
            ? 'flex-1 flex flex-col md:flex-row overflow-hidden relative'
            : 'w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col'
        }
      >
        {/* Normal Mode Map Header (Hidden in Full Screen Mode) */}
        {!isFullScreen && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Live Geographic Radar Map
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-300 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Clear
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Overcast
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Rain
              </span>
              <button
                onClick={handleEnterFullScreen}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 text-xs font-bold cursor-pointer transition-all active:scale-95"
                title="Full Screen Map"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Full Screen</span>
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="Configure Telegram Bot in Settings"
                >
                  <Send className="w-3 h-3" />
                  <span>Telegram</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Map Canvas: Full height in fullscreen on mobile (or desktop split) */}
        <div
          className={
            isFullScreen
              ? `${mobileFullscreenTab === 'MAP' ? 'flex-1 relative h-full w-full' : 'hidden md:flex md:flex-1 md:relative md:h-full md:w-full'}`
              : 'relative w-full h-[340px] sm:h-[420px] rounded-xl overflow-hidden border border-slate-700 z-0 shadow-inner'
          }
        >
          {/* THE LEAFLET MAP ELEMENT */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Map Top Controls Bar - Non-overlapping Responsive Overlay */}
          <div className="absolute top-2 left-2 right-2 z-[400] flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
            {/* Map Center Farm Badge */}
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 text-[11px] text-white shadow-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Farm: <strong>{selectedLocation.name}</strong></span>
              <button
                onClick={handleSelectFarm}
                className="ml-1 px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/40 text-[10px] font-semibold cursor-pointer transition-all"
                title="Center farm"
              >
                Center
              </button>
            </div>

            {/* Interactive Geographic Scope Selector (30km Default, 10km, 60km, 100km) */}
            <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md p-1 rounded-xl border border-slate-700/90 shadow-xl flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-bold px-1.5 hidden xs:inline">Scope:</span>
              {(['10km', '30km', '60km', '100km'] as const).map((scope) => {
                const isActive = radarScope === scope;
                return (
                  <button
                    key={scope}
                    onClick={() => handleSelectScope(scope)}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-950 ring-1 ring-sky-300'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                    title={`Switch to ${scope} radar scope${scope === '30km' ? ' (Default)' : ''}`}
                  >
                    <span>{scope}</span>
                    {scope === '30km' && (
                      <span className={`text-[8px] font-mono px-1 rounded ${isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Def
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Floating Shield Status Badge on Canvas */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] pointer-events-none flex flex-wrap items-center justify-between gap-1.5">
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 shadow-lg flex items-center gap-2 flex-wrap">
              <span
                className={
                  is10kmPerimeterClear
                    ? "flex items-center gap-1 font-bold text-emerald-400"
                    : "flex items-center gap-1 font-bold text-rose-400"
                }
              >
                <span className={`w-2 h-2 rounded-full ${is10kmPerimeterClear ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
                10km Shield: {is10kmPerimeterClear ? 'CLEAR (Open)' : 'BREACHED (Closed)'}
              </span>
              <span className="text-slate-600 hidden xs:inline">|</span>
              <span className="text-slate-400">
                {radarScope} Scope: {pointsInActiveScope.length} stations &bull; {rainInActiveScope} rain cell(s)
              </span>
            </div>
          </div>
        </div>

        {/* Normal Mode Footer Note */}
        {!isFullScreen && (
          <div className="mt-2 text-[11px] text-slate-400 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>Tap town markers on the map to see temperature and rain rate.</span>
            <span className="text-sky-300 font-mono">Zoom &amp; Pan enabled</span>
          </div>
        )}

        {/* -------------------------------------------------------------------------
            FULL SCREEN SIDEBAR: ALL LOCATIONS & CONDITIONS
           ------------------------------------------------------------------------- */}
        {isFullScreen && (
          <aside
            className={`w-full md:w-88 lg:w-96 xl:w-[400px] bg-slate-900/98 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 z-20 shadow-2xl backdrop-blur-md overflow-hidden ${
              mobileFullscreenTab === 'TOWNS' ? 'flex-1 h-full' : 'hidden md:flex md:h-full'
            }`}
          >
            {/* Sidebar Header */}
            <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-950/70 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Nearby Locations
                  </h3>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {points.length} Towns
                </span>
              </div>

              {/* Quick Summary Pill Bar */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">Raining</span>
                  <span className={`text-xs font-bold ${rainCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {rainCount}
                  </span>
                </div>
                <div className="p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">Threat</span>
                  <span className={`text-xs font-bold ${threatCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {threatCount}
                  </span>
                </div>
                <div className="p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">Clear</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {clearCount}
                  </span>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="space-y-1 pt-0.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search town..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-700/90 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 text-[10px] flex-wrap">
                  <button
                    onClick={() => setFilterMode('10KM')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === '10KM'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-amber-300 hover:text-white'
                    }`}
                  >
                    🛡️ 10km Shield ({pointsIn10km.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('ALL')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === 'ALL'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    All 100km ({points.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('RAIN')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === 'RAIN'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🌧️ Rain ({rainCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('THREAT')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === 'THREAT'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚠️ Threat ({threatCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('CLEAR')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === 'CLEAR'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ☀️ Clear ({clearCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable List of All Locations with Detailed Conditions */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredPoints.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No locations match your filter.
                </div>
              ) : (
                filteredPoints.map((pt) => {
                  const originalIdx = points.indexOf(pt);
                  const isSelected = selectedPointIndex === originalIdx;
                  const isWithin10km = pt.distanceKm <= 10.0;
                  const isRain = pt.isRaining || pt.precipitation > 0.1;
                  const isThreat = pt.rainProbability >= 35 && !isRain;
                  const weatherEmoji = isRain ? '🌧️' : pt.cloudCover > 65 ? '☁️' : pt.cloudCover > 30 ? '⛅' : '☀️';

                  return (
                    <div
                      key={pt.placeName + originalIdx}
                      onClick={() => handleSelectPoint(originalIdx)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-sky-950/80 border-sky-400 ring-1 ring-sky-400/40'
                          : isWithin10km
                          ? 'bg-slate-950/80 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Top Row: Place Name, Weather Icon & Distance */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{weatherEmoji}</span>
                          <strong className="text-xs font-bold text-white truncate">
                            {pt.placeName}
                          </strong>
                          {pt.isCenter && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold">
                              ORIGIN
                            </span>
                          )}
                          {isWithin10km && !pt.isCenter && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-bold">
                              10km Shield
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] bg-slate-800/90 text-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                          {pt.isCenter ? '0 km' : `${pt.distanceKm} km ${pt.direction}`}
                        </span>
                      </div>

                      {/* Middle Row: Condition string & Temperature */}
                      <div className="flex items-center justify-between text-[11px] mb-2 text-slate-300">
                        <span className="truncate font-medium">
                          {pt.condition}
                        </span>
                        <span className="font-bold text-white shrink-0">
                          {pt.temperature.toFixed(1)}°C
                        </span>
                      </div>

                      {/* Bottom Metric Bar: Rain Risk, Precipitation, Cloud */}
                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800/80 text-[10px]">
                        <div className="bg-slate-900/80 p-1 rounded text-center">
                          <span className="text-slate-500 block text-[9px]">Precipitation</span>
                          <span
                            className={`font-bold ${
                              pt.precipitation > 0 ? 'text-rose-400' : 'text-slate-300'
                            }`}
                          >
                            {pt.precipitation.toFixed(1)} mm/h
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1 rounded text-center">
                          <span className="text-slate-500 block text-[9px]">Rain Risk</span>
                          <span
                            className={`font-bold ${
                              pt.rainProbability >= 40
                                ? 'text-rose-400'
                                : pt.rainProbability >= 25
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {pt.rainProbability}%
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1 rounded text-center">
                          <span className="text-slate-500 block text-[9px]">Cloud Cover</span>
                          <span className="font-bold text-slate-300">
                            {pt.cloudCover}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Location Diagnostic Sticky Footer */}
            {selectedPoint && (
              <div className="p-2.5 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span>Focused:</span>
                    <strong className="text-white truncate">{selectedPoint.placeName}</strong>
                    <span>({selectedPoint.distanceKm}km)</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-200 truncate">
                    {selectedPoint.condition} &bull; {selectedPoint.temperature.toFixed(1)}°C
                  </div>
                </div>
                <button
                  onClick={() => handleSelectPoint(selectedPointIndex)}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                >
                  Focus Map
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* -------------------------------------------------------------------------
          NORMAL MODE SURROUNDING PLACES GRID (Shown only when not in Full Screen)
         ------------------------------------------------------------------------- */}
      {!isFullScreen && (
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                Surrounding Places ({selectedLocation.name}) &bull; Up to 100km
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[10px] bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setFilterMode('10KM')}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                    filterMode === '10KM'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-amber-400 hover:text-white'
                  }`}
                >
                  🛡️ 10km Shield ({pointsIn10km.length})
                </button>
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                    filterMode === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({points.length})
                </button>
                <button
                  onClick={() => setFilterMode('RAIN')}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                    filterMode === 'RAIN'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🌧️ Rain ({rainCount})
                </button>
              </div>

              <button
                onClick={() => setIsFullScreen(true)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Screen</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {filteredPoints.map((pt) => {
              const originalIdx = points.indexOf(pt);
              const isSelected = selectedPointIndex === originalIdx;
              const isWithin10km = pt.distanceKm <= 10.0;
              const isRain = pt.isRaining || pt.precipitation > 0.1;
              const isThreat = pt.rainProbability >= 35 && !isRain;

              return (
                <button
                  key={pt.placeName + originalIdx}
                  onClick={() => handleSelectPoint(originalIdx)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2 shadow-xs ${
                    isSelected
                      ? 'bg-sky-950 border-2 border-sky-400 ring-2 ring-sky-400/30'
                      : isWithin10km
                      ? 'bg-slate-950/90 border-amber-500/50 hover:border-amber-400 text-slate-200'
                      : 'bg-slate-950/80 border-slate-700/80 hover:border-slate-500 text-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span 
                        title={pt.placeName}
                        className="font-extrabold text-xs text-white leading-tight min-w-0 pr-1 line-clamp-1"
                      >
                        {pt.placeName}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isRain
                            ? 'bg-rose-500 animate-pulse'
                            : isThreat
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      />
                    </div>
                    <div className="text-[10.5px] font-semibold text-slate-300 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {pt.isCenter ? 'Origin 0 km' : `${pt.distanceKm} km ${pt.direction}`}
                        </span>
                      </span>
                      {isWithin10km && !pt.isCenter && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1 rounded">
                          10km
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">
                      {pt.temperature.toFixed(0)}°C
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        isRain
                          ? 'bg-rose-500/80 text-white'
                          : isThreat
                          ? 'bg-amber-500/30 text-amber-200'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {pt.precipitation > 0 ? `${pt.precipitation.toFixed(1)}mm` : `${pt.rainProbability}% risk`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Inspected Place Diagnostic Card */}
          {selectedPoint && (
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-700/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-sky-400 uppercase tracking-wider">
                    Inspected Sector:
                  </span>
                  <strong className="text-sm font-extrabold text-white">
                    {selectedPoint.placeName}
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    {selectedPoint.isCenter ? 'Origin Farm Bed' : `${selectedPoint.distanceKm} km ${selectedPoint.direction}`}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Condition: <strong className="text-white">{selectedPoint.condition}</strong> &bull; GPS: Lat {selectedPoint.latitude.toFixed(4)}, Lon {selectedPoint.longitude.toFixed(4)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 shrink-0 w-full sm:w-auto">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Precipitation</div>
                  <div className="text-xs font-extrabold text-white">
                    {selectedPoint.precipitation.toFixed(1)} mm/h
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Rain Risk</div>
                  <div className={`text-xs font-extrabold ${selectedPoint.rainProbability >= 40 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedPoint.rainProbability}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Cloud Cover</div>
                  <div className="text-xs font-extrabold text-white">
                    {selectedPoint.cloudCover}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
