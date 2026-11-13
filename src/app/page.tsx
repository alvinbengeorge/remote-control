'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Touchpad from '@/components/Touchpad';
import Keypad from '@/components/Keypad';
import MediaBar from '@/components/MediaBar';
import InteractiveTerminal from '@/components/InteractiveTerminal';
import AppsAndWindows from '@/components/AppsAndWindows';
import ScreenMirror from '@/components/ScreenMirror';
import MagicClipboardModal from '@/components/MagicClipboardModal';
import BiometricUnlockModal from '@/components/BiometricUnlockModal';
import PowerModal from '@/components/PowerModal';
import { AppItem } from '@/components/AppLauncher';
import {
  MousePointer,
  Keyboard,
  Sliders,
  Terminal,
  Lock,
  Unlock,
  Palette,
  Clipboard,
  Fingerprint,
  Moon,
  Sun,
  RefreshCw,
  X,
  Check,
  Download,
  Share,
  PlusSquare,
  LayoutGrid,
  AppWindow,
  Monitor,
} from 'lucide-react';

export default function RemotePage() {
  const [activeTab, setActiveTab] = useState<'touchpad' | 'keyboard' | 'apps' | 'screen' | 'terminal' | 'media'>('touchpad');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [deviceMac, setDeviceMac] = useState<string>('');
  const [cmdResult, setCmdResult] = useState<any>(null);

  // PWA states
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>('android');

  // Workstation Theme Sync states
  const [theme, setTheme] = useState<any>({
    id: 'arythmatic',
    name: 'Arythmatic',
    bgBase: '#080B10',
    bgSurface: '#0E131C',
    bgCard: '#171F2E',
    borderActive: '#FFAA00',
    borderDim: '#1C2536',
    accentSky: '#FFAA00',
    accentViolet: '#FFAA00',
    accentCyan: '#FFC533',
    accentEmerald: '#00C758',
  });
  const [allThemes, setAllThemes] = useState<any[]>([]);
  const [media, setMedia] = useState<any>({ status: 'Stopped', title: '', artist: '' });
  const [activeWorkspace, setActiveWorkspace] = useState<number>(1);
  const [volume, setVolume] = useState<{ volume: number; muted: boolean }>({ volume: 50, muted: false });
  const [showThemeStudio, setShowThemeStudio] = useState(false);
  const [showClipboardModal, setShowClipboardModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showPowerModal, setShowPowerModal] = useState(false);
  const [powerState, setPowerState] = useState<any>(null);
  const [workstationClipboard, setWorkstationClipboard] = useState<any>({ type: 'empty', text: '' });
  const [oledMode, setOledMode] = useState(false);
  const oledModeRef = useRef(false);
  oledModeRef.current = oledMode;
  const [themeFilter, setThemeFilter] = useState<'all' | 'builtin' | 'wallpaper'>('all');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Apply CSS variables and browser meta theme-color dynamically
  const applyThemeVariables = useCallback((t: any, oled: boolean) => {
    if (!t || typeof document === 'undefined') return;
    const root = document.documentElement;

    const bgBase = oled ? '#000000' : (t.bgBase || '#080B11');
    const bgSurface = oled ? '#070A0F' : (t.bgSurface || '#0E1522');
    const bgCard = oled ? '#0E141E' : (t.bgCard || '#131D2E');

    root.style.setProperty('--bg-base', bgBase);
    root.style.setProperty('--bg-surface', bgSurface);
    root.style.setProperty('--bg-card', bgCard);
    root.style.setProperty('--bg-pill', t.bgPill || '#172338');
    root.style.setProperty('--bg-hover', t.bgHover || '#223352');
    root.style.setProperty('--border-dim', t.borderDim || '#1C2B42');
    root.style.setProperty('--border-active', t.borderActive || '#2962FF');
    root.style.setProperty('--border-glow', t.borderGlow || 'rgba(41, 98, 255, 0.25)');
    root.style.setProperty('--accent-primary', t.borderActive || t.accentSky || '#2962FF');
    root.style.setProperty('--accent-sky', t.accentSky || '#38BDF8');
    root.style.setProperty('--accent-cyan', t.accentCyan || '#00F0FF');
    root.style.setProperty('--accent-violet', t.accentViolet || '#60B01C');
    root.style.setProperty('--accent-emerald', t.accentEmerald || '#60B01C');
    root.style.setProperty('--text-primary', t.textPrimary || '#F8FAFC');
    root.style.setProperty('--text-secondary', t.textSecondary || '#CBD5E1');
    root.style.setProperty('--text-muted', t.textMuted || '#8295AD');

    // Dynamically tint system browser status bar
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', bgBase);
  }, []);

  const connectWs = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Dispatch to global custom event for subcomponents
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ag_remote_event', { detail: data }));
          }

          if (data.type === 'connected') {
            setDeviceMac(data.deviceMac || '');
            if (data.theme) {
              setTheme(data.theme);
              applyThemeVariables(data.theme, oledModeRef.current);
            }
            if (data.allThemes) setAllThemes(data.allThemes);
            if (data.media) setMedia(data.media);
            if (data.activeWorkspace) setActiveWorkspace(data.activeWorkspace);
            if (data.volume) setVolume(data.volume);
            if (data.clipboard) {
              setWorkstationClipboard(typeof data.clipboard === 'string' ? { type: 'text', text: data.clipboard } : data.clipboard);
            }
            if (data.power) setPowerState(data.power);
            if (Array.isArray(data.apps)) setApps(data.apps);
          } else if (data.type === 'power_sync') {
            if (data.power) setPowerState(data.power);
          } else if (data.type === 'apps_sync') {
            if (Array.isArray(data.apps)) setApps(data.apps);
          } else if (data.type === 'theme_sync') {
            if (data.theme) {
              setTheme(data.theme);
              applyThemeVariables(data.theme, oledModeRef.current);
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                try { navigator.vibrate([20, 35, 20]); } catch (_) {}
              }
            }
            if (data.allThemes) setAllThemes(data.allThemes);
          } else if (data.type === 'media_sync') {
            if (data.media) setMedia(data.media);
          } else if (data.type === 'workspace_sync') {
            if (data.activeWorkspace) setActiveWorkspace(data.activeWorkspace);
          } else if (data.type === 'volume_sync') {
            if (data.volume) setVolume(data.volume);
          } else if (data.type === 'clipboard_sync') {
            if (data.clipboard && typeof data.clipboard === 'object') {
              setWorkstationClipboard(data.clipboard);
            } else if (data.contentType === 'image') {
              setWorkstationClipboard({
                type: 'image',
                mimeType: data.mimeType || 'image/png',
                imageUrl: data.imageUrl,
                dataUrl: data.dataUrl,
                size: data.size,
                dimensions: data.dimensions,
                text: data.text || '',
              });
            } else {
              setWorkstationClipboard({
                type: 'text',
                text: typeof data.text === 'string' ? data.text : (typeof data.clipboard === 'string' ? data.clipboard : ''),
              });
            }
          } else if (data.type === 'cmd_result') {
            setCmdResult(data);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    } catch (e) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    }
  }, [applyThemeVariables]);

  useEffect(() => {
    // Load saved OLED mode preference
    try {
      const savedOled = localStorage.getItem('ag_oled_mode') === 'true';
      setOledMode(savedOled);
      oledModeRef.current = savedOled;
      if (theme) applyThemeVariables(theme, savedOled);
    } catch (_) {}

    connectWs();

    // Check standalone mode
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(isRunningStandalone);

    // Detect mobile platform
    const ua = navigator.userAgent || '';
    const isApple = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    if (isApple) setPlatformTab('ios');

    // Capture beforeinstallprompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setShowInstallGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWs();
        }
      }
    };

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10000);

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pingInterval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs, applyThemeVariables]);

  const sendWs = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          setShowInstallBanner(false);
        }
      } catch (err) {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const handleSelectTheme = (themeKey: string) => {
    sendWs({ type: 'set_theme', themeKey });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch (_) {}
    }
  };

  const handleToggleAutoCycle = () => {
    sendWs({ type: 'cycle_theme' });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch (_) {}
    }
  };

  const toggleOledMode = () => {
    const nextVal = !oledMode;
    setOledMode(nextVal);
    oledModeRef.current = nextVal;
    try { localStorage.setItem('ag_oled_mode', String(nextVal)); } catch (_) {}
    applyThemeVariables(theme, nextVal);
  };

  const filteredThemes = allThemes.filter((t) => {
    if (themeFilter === 'builtin') return !t.isCustom;
    if (themeFilter === 'wallpaper') return t.isWallpaperTheme;
    return true;
  });

  return (
    <main
      className="flex flex-col h-dvh w-screen max-w-md mx-auto p-2.5 sm:p-3 gap-2.5 text-[#F8FAFC] overflow-hidden select-none transition-colors duration-500"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── HEADER (Clean, Uncluttered & Compact) ───────────────────────── */}
      <header
        className="flex items-center justify-between border rounded-2xl px-3.5 py-2 shrink-0 shadow-sm transition-colors duration-300"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-dim)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Brand Shield Dot */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-active)',
            }}
          >
            <span className="font-bold text-xs" style={{ color: 'var(--accent-sky)' }}>AG</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">Remote</span>
              {/* Status Indicator */}
              <button
                type="button"
                onClick={() => connectWs()}
                className="flex items-center gap-1 active:scale-95 transition-transform"
                title="Tap to Reconnect"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-[#60B01C] shadow-[0_0_8px_#60B01C]' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-400">
                  {connected ? 'ONLINE' : 'OFFLINE'}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span>Hyprland</span>
              <span>•</span>
              <span className="truncate max-w-[120px]" style={{ color: 'var(--accent-sky)' }}>
                {theme?.name || 'Theme'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions: Battery & Power, Theme Studio, Magic Clipboard, Lock PC */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Workstation Battery & Power Health Pill */}
          {powerState?.battery && (
            <button
              type="button"
              onClick={() => setShowPowerModal(true)}
              className="h-8 px-2 rounded-xl border flex items-center gap-1 active:scale-95 transition-all shadow-sm font-mono text-[11px]"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: powerState.battery.isCharging
                  ? 'rgba(16, 185, 129, 0.4)'
                  : (powerState.battery.capacity <= 20 ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-dim)'),
              }}
              title="Workstation Battery & Power Health"
            >
              <span
                className={
                  powerState.battery.isCharging
                    ? 'text-emerald-400'
                    : powerState.battery.capacity <= 20
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }
              >
                {powerState.battery.isCharging ? '⚡' : '🔋'}
              </span>
              <span className="font-bold text-white">
                {powerState.battery.capacity}%
              </span>
            </button>
          )}

          {/* Workstation Theme Studio Button */}
          <button
            type="button"
            onClick={() => setShowThemeStudio(true)}
            className="w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all shadow-sm"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-dim)',
            }}
            title="Desktop Theme Studio"
          >
            <Palette className="w-4 h-4" style={{ color: 'var(--accent-sky)' }} />
          </button>

          {/* Magic Clipboard & Drop Button */}
          <button
            type="button"
            onClick={() => setShowClipboardModal(true)}
            className="w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all shadow-sm relative"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-dim)',
            }}
            title="Magic Clipboard & Drop"
          >
            <Clipboard className="w-4 h-4 text-emerald-400" />
            {((workstationClipboard?.type === 'text' && workstationClipboard?.text) ||
              workstationClipboard?.type === 'image' ||
              (typeof workstationClipboard === 'string' && workstationClipboard)) && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Biometric Workstation Unlock Button */}
          <button
            type="button"
            onClick={() => setShowBiometricModal(true)}
            className="w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all shadow-sm"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              borderColor: 'rgba(6, 182, 212, 0.45)',
            }}
            title="Biometric Unlock (Fingerprint / FaceID)"
          >
            <Fingerprint className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Quick Lock PC Button */}
          <button
            onClick={() => {
              if (window.confirm('Lock workstation screen now?')) {
                sendWs({ type: 'lock' });
              }
            }}
            disabled={!connected}
            title="Lock Workstation (Requires confirmation)"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: 'rgba(239, 68, 68, 0.25)',
            }}
            className="w-8 h-8 rounded-xl border active:bg-rose-900/40 active:border-rose-500 flex items-center justify-center text-rose-400 active:scale-95 transition-colors shrink-0"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── ULTRA-SLIM PWA TOAST (Dismissible & Compact) ────────────────── */}
      {!isStandalone && showInstallBanner && (
        <div
          className="rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 border text-[11px]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-dim)',
          }}
        >
          <span className="text-slate-300 truncate">
            📲 Install as standalone home app
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="font-semibold text-xs active:scale-95"
              style={{ color: 'var(--accent-sky)' }}
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'touchpad' && (
          <Touchpad sendWs={sendWs} connected={connected} theme={theme} media={media} />
        )}
        {activeTab === 'keyboard' && (
          <Keypad
            sendWs={sendWs}
            connected={connected}
            onOpenClipboard={() => setShowClipboardModal(true)}
            onOpenBiometric={() => setShowBiometricModal(true)}
          />
        )}
        {activeTab === 'apps' && (
          <AppsAndWindows
            apps={apps}
            sendWs={sendWs}
            connected={connected}
            theme={theme}
            activeWorkspace={activeWorkspace}
            setActiveWorkspace={setActiveWorkspace}
          />
        )}
        {activeTab === 'screen' && (
          <ScreenMirror sendWs={sendWs} connected={connected} theme={theme} />
        )}
        {activeTab === 'media' && (
          <MediaBar
            sendWs={sendWs}
            connected={connected}
            theme={theme}
            allThemes={allThemes}
            media={media}
            volume={volume}
            onOpenThemeStudio={() => setShowThemeStudio(true)}
          />
        )}
        {activeTab === 'terminal' && (
          <InteractiveTerminal sendWs={sendWs} connected={connected} theme={theme} />
        )}
      </div>

      {/* ── BOTTOM NAVIGATION TABS ──────────────────────────────────────── */}
      <nav
        className="flex items-center gap-1 border rounded-2xl p-1.5 shrink-0 shadow-lg overflow-x-auto no-scrollbar"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-dim)',
        }}
      >
        <button
          onClick={() => setActiveTab('touchpad')}
          style={{
            backgroundColor: activeTab === 'touchpad' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'touchpad' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <MousePointer className="w-4 h-4 mb-0.5" />
          <span>Mouse</span>
        </button>

        <button
          onClick={() => setActiveTab('keyboard')}
          style={{
            backgroundColor: activeTab === 'keyboard' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'keyboard' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <Keyboard className="w-4 h-4 mb-0.5" />
          <span>Keys</span>
        </button>

        <button
          onClick={() => setActiveTab('apps')}
          style={{
            backgroundColor: activeTab === 'apps' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'apps' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <LayoutGrid className="w-4 h-4 mb-0.5" />
          <span>Apps & Win</span>
        </button>

        <button
          onClick={() => setActiveTab('screen')}
          style={{
            backgroundColor: activeTab === 'screen' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'screen' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <Monitor className="w-4 h-4 mb-0.5" />
          <span>Screen</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            backgroundColor: activeTab === 'terminal' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'terminal' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <Terminal className="w-4 h-4 mb-0.5" />
          <span>Shell (~)</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          style={{
            backgroundColor: activeTab === 'media' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'media' ? '#FFFFFF' : 'var(--text-muted)',
          }}
          className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-medium transition-all shrink-0"
        >
          <Sliders className="w-4 h-4 mb-0.5" />
          <span>Media</span>
        </button>
      </nav>

      {/* ── WORKSTATION THEME STUDIO MODAL ──────────────────────────────── */}
      {showThemeStudio && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="w-full max-w-md max-h-[85dvh] rounded-t-3xl sm:rounded-2xl border flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-200 overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-dim)',
            }}
          >
            {/* Modal Header */}
            <div
              className="p-3.5 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: 'var(--border-dim)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-active)',
                  }}
                >
                  <Palette className="w-4 h-4" style={{ color: 'var(--accent-sky)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Workstation Themes</h3>
                  <p className="text-[10px] text-slate-400">Desktop Sync ({allThemes.length} Available)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowThemeStudio(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 active:text-white"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Modifiers Row */}
            <div
              className="p-3 border-b grid grid-cols-2 gap-2 shrink-0"
              style={{ borderColor: 'var(--border-dim)' }}
            >
              {/* OLED Pure Black Toggle */}
              <button
                type="button"
                onClick={toggleOledMode}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  oledMode
                    ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {oledMode ? <Moon className="w-3.5 h-3.5 fill-current" /> : <Sun className="w-3.5 h-3.5" />}
                <span>OLED Black: {oledMode ? 'ON' : 'OFF'}</span>
              </button>

              {/* 5m Auto-Cycle */}
              <button
                type="button"
                onClick={handleToggleAutoCycle}
                className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>5m Cycle</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div
              className="grid grid-cols-3 gap-1 p-2 shrink-0 text-[11px] font-medium border-b"
              style={{ borderColor: 'var(--border-dim)' }}
            >
              <button
                onClick={() => setThemeFilter('all')}
                style={{
                  backgroundColor: themeFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                  color: themeFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
                }}
                className="py-1.5 rounded-lg transition-all"
              >
                All ({allThemes.length})
              </button>
              <button
                onClick={() => setThemeFilter('builtin')}
                style={{
                  backgroundColor: themeFilter === 'builtin' ? 'var(--accent-primary)' : 'transparent',
                  color: themeFilter === 'builtin' ? '#FFFFFF' : 'var(--text-muted)',
                }}
                className="py-1.5 rounded-lg transition-all"
              >
                Built-In (7)
              </button>
              <button
                onClick={() => setThemeFilter('wallpaper')}
                style={{
                  backgroundColor: themeFilter === 'wallpaper' ? 'var(--accent-primary)' : 'transparent',
                  color: themeFilter === 'wallpaper' ? '#FFFFFF' : 'var(--text-muted)',
                }}
                className="py-1.5 rounded-lg transition-all"
              >
                Wallpaper (8)
              </button>
            </div>

            {/* Themes Grid */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
              {filteredThemes.map((t) => {
                const isActive = theme?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t.id)}
                    className="p-3 rounded-xl border flex flex-col gap-1.5 text-left transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: isActive ? 'var(--bg-card)' : 'rgba(255,255,255,0.03)',
                      borderColor: isActive ? t.borderActive || 'var(--border-active)' : 'var(--border-dim)',
                      boxShadow: isActive ? '0 0 10px var(--border-glow)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-black/40 shadow-sm"
                          style={{ backgroundColor: t.accentSky }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-black/40 shadow-sm"
                          style={{ backgroundColor: t.accentViolet }}
                        />
                      </div>
                      {isActive && (
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: t.borderActive }}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-white truncate w-full mt-0.5 block leading-tight">
                      {t.name}
                    </span>

                    <span className="text-[9px] font-mono text-slate-400 block truncate">
                      {t.isWallpaperTheme ? 'Wallpaper Palette' : 'Core System'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div
              className="p-3 border-t shrink-0 flex items-center justify-end"
              style={{ borderColor: 'var(--border-dim)' }}
            >
              <button
                type="button"
                onClick={() => setShowThemeStudio(false)}
                style={{ backgroundColor: 'var(--bg-card)' }}
                className="w-full py-2.5 rounded-xl border border-slate-700 text-white font-medium text-xs transition-all active:scale-98"
              >
                Close Studio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INSTALL GUIDE MODAL ─────────────────────────────────────────── */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="rounded-2xl max-w-sm w-full p-4 flex flex-col gap-3 shadow-2xl animate-in zoom-in-95 border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-dim)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-active)',
                  }}
                >
                  <Download className="w-4 h-4" style={{ color: 'var(--accent-sky)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install Antigravity Remote</h3>
                  <p className="text-[10px] text-slate-400">Add to your Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 active:text-white"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-[#080B11] p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPlatformTab('android')}
                style={{
                  backgroundColor: platformTab === 'android' ? 'var(--accent-primary)' : 'transparent',
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                  platformTab === 'android' ? 'text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('ios')}
                style={{
                  backgroundColor: platformTab === 'ios' ? 'var(--accent-primary)' : 'transparent',
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                  platformTab === 'ios' ? 'text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                iPhone (Safari)
              </button>
            </div>

            {platformTab === 'android' ? (
              <div
                className="flex flex-col gap-2.5 rounded-xl p-3 text-xs text-slate-300 border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-dim)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    1
                  </span>
                  <div>Tap the three dots (⋮) in Chrome&apos;s top-right corner.</div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    2
                  </span>
                  <div>Select &quot;Install app&quot; or &quot;Add to Home screen&quot;.</div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    3
                  </span>
                  <div>Confirm &quot;Install&quot; to place the standalone remote icon on your home screen.</div>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col gap-2.5 rounded-xl p-3 text-xs text-slate-300 border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-dim)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    1
                  </span>
                  <div>Tap the Share button <Share className="inline w-3.5 h-3.5 mx-0.5" style={{ color: 'var(--accent-sky)' }} /> at the bottom of Safari.</div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    2
                  </span>
                  <div>Scroll down and tap &quot;Add to Home Screen&quot; <PlusSquare className="inline w-3.5 h-3.5 mx-0.5" style={{ color: 'var(--accent-sky)' }} />.</div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--border-glow)', color: 'var(--accent-sky)' }}
                  >
                    3
                  </span>
                  <div>Tap &quot;Add&quot; in the top-right corner to finish.</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              style={{ backgroundColor: 'var(--bg-card)' }}
              className="w-full py-2 rounded-xl border border-slate-700 text-slate-300 font-medium text-xs transition-all active:scale-95"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* ── POWER & VIRTUAL DISPLAY MODAL ─────────────────────────────── */}
      <PowerModal
        isOpen={showPowerModal}
        onClose={() => setShowPowerModal(false)}
        power={powerState}
        sendWs={sendWs}
        connected={connected}
        theme={theme}
      />

      {/* ── MAGIC CLIPBOARD & DROP MODAL ─────────────────────────────────── */}
      <MagicClipboardModal
        isOpen={showClipboardModal}
        onClose={() => setShowClipboardModal(false)}
        sendWs={sendWs}
        connected={connected}
        workstationClipboard={workstationClipboard}
        onRefreshClipboard={() => sendWs({ type: 'get_clipboard' })}
      />

      {/* ── BIOMETRIC UNLOCK MODAL ───────────────────────────────────────── */}
      <BiometricUnlockModal
        isOpen={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        sendWs={sendWs}
        connected={connected}
      />
    </main>
  );
}
