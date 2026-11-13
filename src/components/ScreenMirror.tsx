'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Monitor,
  Camera,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  VolumeX,
  Sliders,
  MousePointerClick,
  Zap,
  AlertCircle,
} from 'lucide-react';

interface ScreenMirrorProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
}

export default function ScreenMirror({ sendWs, connected, theme }: ScreenMirrorProps) {
  const [monitors, setMonitors] = useState<any[]>([
    { name: 'eDP-1', model: 'Laptop Screen', desc: '1920×1080 (Built-in)', isVirtual: false },
    { name: 'HDMI-A-1', model: 'Samsung 27"', desc: '1920×1080 @ 100Hz', isVirtual: false },
  ]);
  const [selectedMonitor, setSelectedMonitor] = useState<string>('eDP-1');
  const [streamActive, setStreamActive] = useState(true);
  const [mode, setMode] = useState<'stream' | 'snapshots'>('stream');
  const [audioActive, setAudioActive] = useState(false);
  const [fps, setFps] = useState<number>(5);
  const [snapshotKey, setSnapshotKey] = useState<number>(Date.now());
  const [audioVolume, setAudioVolume] = useState<number>(0.8);
  const [clickNotice, setClickNotice] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }, []);

  // In 'snapshots' mode, continuously poll frames at the chosen FPS
  useEffect(() => {
    if (!streamActive || mode !== 'snapshots') return;

    const interval = Math.max(150, Math.round(1000 / fps));
    const timer = setInterval(() => {
      setSnapshotKey(Date.now());
    }, interval);

    return () => clearInterval(timer);
  }, [streamActive, mode, fps]);

  // Dynamically sync active monitors from Hyprland
  useEffect(() => {
    sendWs({ type: 'get_windows' });
    const handleEvent = (e: any) => {
      const data = e.detail;
      if (data && data.type === 'windows_state' && Array.isArray(data.monitors) && data.monitors.length > 0) {
        setMonitors(
          data.monitors.map((m: any) => ({
            name: m.name,
            model: m.name.startsWith('HEADLESS') ? 'Virtual Screen' : (m.model || m.name),
            desc: `${m.width}×${m.height}${m.name.startsWith('HEADLESS') ? ' (Windows Sink)' : ''}`,
            isVirtual: m.name.startsWith('HEADLESS'),
          }))
        );
      }
    };
    window.addEventListener('ag_remote_event', handleEvent);
    return () => window.removeEventListener('ag_remote_event', handleEvent);
  }, [sendWs]);

  const streamUrl = `/api/stream/screen?monitor=${selectedMonitor}&fps=${fps}&t=${snapshotKey}`;
  const snapshotUrl = `/api/stream/screen?monitor=${selectedMonitor}&snapshot=true&t=${snapshotKey}`;
  const activeUrl = mode === 'stream' && streamActive ? streamUrl : snapshotUrl;

  // Interactive Tap-to-Click on Screen Preview
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    vibrate(20);
    sendWs({
      type: 'screen_tap',
      monitor: selectedMonitor,
      normX,
      normY,
    });

    setClickNotice(`Tapped ${selectedMonitor} (${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%)`);
    setTimeout(() => setClickNotice(null), 2000);
  };

  // Toggle Audio Stream
  const toggleAudio = () => {
    vibrate(15);
    const next = !audioActive;
    setAudioActive(next);
    if (audioRef.current) {
      if (next) {
        audioRef.current.play().catch((err) => console.log('Audio play error:', err));
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleRefresh = () => {
    setHasError(false);
    setSnapshotKey(Date.now());
    vibrate(10);
  };

  return (
    <div className="flex flex-col flex-1 w-full gap-3 overflow-y-auto no-scrollbar pt-1 pb-6 select-none">
      {/* ── TOP HEADER / CONTROLS ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[var(--accent-primary)]" />
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">
            Live Screen Mirror
          </h2>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
              hasError
                ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                : streamActive
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasError
                  ? 'bg-rose-400'
                  : streamActive
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            {hasError ? 'RECONNECTING' : streamActive ? `${fps} FPS ${mode.toUpperCase()}` : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* ── 1. MONITOR SELECTOR BAR (Dynamic Multi-Monitor & Virtual Display) ── */}
      <div className={`grid gap-2 shrink-0 ${monitors.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {monitors.map((m) => {
          const isSelected = selectedMonitor === m.name;
          return (
            <button
              key={m.name}
              onClick={() => {
                setSelectedMonitor(m.name);
                setHasError(false);
                setSnapshotKey(Date.now());
                vibrate(10);
              }}
              style={{
                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                borderColor: isSelected ? 'var(--accent-sky)' : 'var(--border-dim)',
              }}
              className={`p-2.5 rounded-2xl border flex flex-col gap-1 text-left transition-all active:scale-[0.98] ${
                isSelected ? 'ring-1 ring-[var(--accent-sky)]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 truncate max-w-[85px]">{m.model}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    m.isVirtual ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50' : 'bg-slate-800 text-[var(--accent-sky)]'
                  }`}
                >
                  {m.name}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-mono truncate">{m.desc}</span>
            </button>
          );
        })}
      </div>

      {/* ── 2. SCREEN VIEWPORT & TAP-TO-CLICK ────────────────────────── */}
      <div
        style={{
          backgroundColor: '#000000',
          borderColor: hasError ? '#f43f5e' : 'var(--border-dim)',
        }}
        className="rounded-2xl border overflow-hidden relative shadow-2xl flex flex-col items-center justify-center min-h-[220px] bg-slate-950"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${selectedMonitor}-${mode}-${streamActive}`}
          ref={imgRef}
          src={activeUrl}
          alt="Workstation Screen Stream"
          onClick={handleImageClick}
          onLoad={() => {
            setImgLoaded(true);
            setHasError(false);
          }}
          onError={() => {
            console.warn('Screen feed error, attempting recovery...');
            setHasError(true);
            if (mode === 'stream') {
              // Automatically switch to fast snapshot polling if MJPEG drops
              setMode('snapshots');
            }
          }}
          className={`w-full h-auto object-contain cursor-crosshair select-none transition-opacity duration-150 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Loading / Error placeholder */}
        {!imgLoaded && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent-sky)]" />
            <span>Connecting to screen feed...</span>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <span className="text-xs text-rose-200 font-medium">Screen feed interrupted</span>
            <button
              onClick={handleRefresh}
              className="mt-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white flex items-center gap-1.5 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Retry / Snapshot</span>
            </button>
          </div>
        )}

        {/* Tap notice popup */}
        {clickNotice && (
          <div className="absolute top-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-[10px] px-3 py-1 rounded-full shadow-lg pointer-events-none animate-in fade-in">
            {clickNotice}
          </div>
        )}

        {/* Quick Click Hint Pill */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-mono text-slate-400 border border-slate-800 pointer-events-none flex items-center gap-1">
          <MousePointerClick className="w-3 h-3 text-[var(--accent-cyan)]" />
          <span>Tap to click PC</span>
        </div>
      </div>

      {/* ── 3. PLAYBACK & STREAM MODE CONTROLS ────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono shrink-0"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStreamActive(!streamActive);
              vibrate(12);
            }}
            style={{
              backgroundColor: streamActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
            }}
            className="px-3 py-1.5 rounded-lg text-white font-bold flex items-center gap-1.5 active:scale-95 transition-all text-xs"
          >
            {streamActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{streamActive ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95"
            title="Refresh snapshot"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Switcher: Live Stream vs Fast Snapshots */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => {
              setMode('stream');
              setHasError(false);
              setSnapshotKey(Date.now());
              vibrate(8);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
              mode === 'stream'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Live</span>
          </button>

          <button
            onClick={() => {
              setMode('snapshots');
              setHasError(false);
              setSnapshotKey(Date.now());
              vibrate(8);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
              mode === 'snapshots'
                ? 'bg-[var(--accent-sky)] text-black font-extrabold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>Snap</span>
          </button>

          {/* FPS selector */}
          <div className="flex items-center gap-0.5 pl-1 border-l border-slate-700">
            {[2, 5, 8].map((rate) => (
              <button
                key={rate}
                onClick={() => {
                  setFps(rate);
                  vibrate(8);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  fps === rate ? 'text-[var(--accent-sky)] underline' : 'text-slate-500 hover:text-white'
                }`}
              >
                {rate}f
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. WIRELESS AUDIO RECEIVER (PipeWire -> Phone) ───────────── */}
      <div
        style={{
          backgroundColor: audioActive ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
          borderColor: audioActive ? 'var(--accent-emerald)' : 'var(--border-dim)',
        }}
        className={`p-3.5 rounded-2xl border flex flex-col gap-3 transition-all shrink-0 ${
          audioActive ? 'ring-1 ring-emerald-500/40' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {audioActive ? (
              <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <div className="text-xs font-bold text-slate-200">Desktop Wireless Audio</div>
              <div className="text-[10px] text-slate-400 font-mono">
                Stream PC YouTube/Spotify to Phone Speakers / Earphones
              </div>
            </div>
          </div>

          <button
            onClick={toggleAudio}
            style={{
              backgroundColor: audioActive ? 'var(--accent-emerald)' : 'var(--bg-surface)',
              color: audioActive ? '#000000' : 'var(--text-primary)',
              borderColor: audioActive ? 'transparent' : 'var(--border-dim)',
            }}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold font-mono active:scale-95 transition-all shadow-sm"
          >
            {audioActive ? 'RECEIVING' : 'LISTEN'}
          </button>
        </div>

        {/* Hidden Audio Player */}
        <audio
          ref={audioRef}
          src={audioActive ? '/api/stream/audio' : undefined}
          preload="none"
          onPlay={() => console.log('Audio streaming started')}
        />

        {audioActive && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-xs font-mono text-slate-400">
            <span>Vol:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAudioVolume(val);
                if (audioRef.current) audioRef.current.volume = val;
              }}
              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] text-slate-200 w-8 text-right font-bold">
              {Math.round(audioVolume * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
