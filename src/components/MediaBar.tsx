'use client';

import React from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Palette,
  Music,
  RefreshCw,
} from 'lucide-react';

interface MediaBarProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
  allThemes?: any[];
  media?: any;
  volume?: { volume: number; muted: boolean };
  onOpenThemeStudio?: () => void;
}

export default function MediaBar({
  sendWs,
  connected,
  theme,
  allThemes = [],
  media,
  volume = { volume: 50, muted: false },
  onOpenThemeStudio,
}: MediaBarProps) {
  const vibrate = (p: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(p); } catch (e) {}
    }
  };

  const act = (type: string, action: string, value?: any) => {
    sendWs({ type, action, value });
    vibrate(15);
  };

  const isPlaying = media?.status === 'Playing';

  return (
    <div className="flex flex-col flex-1 w-full gap-2.5 overflow-y-auto no-scrollbar pt-1.5 px-0.5 pb-6 select-none">
      {/* ── 1. WORKSTATION AUDIO // MPRIS & MASTER VOLUME ────────────────── */}
      <div
        className="rounded-2xl p-3 border theme-card flex flex-col gap-3 shrink-0 relative overflow-hidden shadow-sm transition-all duration-300"
        style={{
          borderColor: isPlaying ? 'var(--border-active)' : 'var(--border-dim)',
          boxShadow: isPlaying ? '0 0 16px var(--border-glow)' : 'none',
        }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Music className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#00F0FF] animate-pulse' : 'text-slate-500'}`} />
            <span>Workstation Audio // MPRIS</span>
          </div>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
              isPlaying
                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : media?.status === 'Paused'
                ? 'bg-amber-950/40 border-amber-500 text-amber-400'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {media?.status || 'Idle'}
          </span>
        </div>

        {/* Track Metadata */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border relative overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: isPlaying ? 'var(--border-active)' : 'var(--border-dim)',
            }}
          >
            <Music className="w-5 h-5" style={{ color: 'var(--accent-sky)' }} />
            {isPlaying && (
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-bold text-white truncate leading-tight">
              {media?.title || 'No Active Media'}
            </span>
            <span className="text-[10px] text-slate-400 truncate mt-0.5">
              {media?.artist || 'Workstation Audio Sink'}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => act('media', 'prev')}
            disabled={!connected}
            className="action-btn"
          >
            <SkipBack className="w-4 h-4 mr-1" /> Prev
          </button>
          <button
            onClick={() => act('media', 'play-pause')}
            disabled={!connected}
            className={`action-btn font-bold transition-all ${
              isPlaying
                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-[#2962FF]/20 border-[#2962FF] text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-1 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1 fill-current" /> Play
              </>
            )}
          </button>
          <button
            onClick={() => act('media', 'next')}
            disabled={!connected}
            className="action-btn"
          >
            <SkipForward className="w-4 h-4 mr-1" /> Next
          </button>
        </div>

        {/* Integrated Master Volume Control */}
        <div
          className="rounded-xl p-2 border flex items-center justify-between gap-2 mt-0.5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-dim)',
          }}
        >
          <button
            onClick={() => act('volume', 'mute')}
            disabled={!connected}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 active:scale-95 transition-all ${
              volume.muted
                ? 'bg-rose-950/50 border-rose-500 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                : 'border-transparent text-slate-300 active:bg-slate-800'
            }`}
            title="Toggle Mute"
          >
            {volume.muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[10px] font-mono uppercase">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--accent-sky)' }} />
                <span className="text-[10px] font-mono">{volume.volume}%</span>
              </>
            )}
          </button>

          {/* Quick Volume Steppers */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => act('volume', 'down')}
              disabled={!connected}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono text-slate-300 active:scale-95 transition-all"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-dim)',
              }}
              title="Volume Down 5%"
            >
              - 5%
            </button>
            <button
              onClick={() => act('volume', 'up')}
              disabled={!connected}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono text-white active:scale-95 transition-all"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-dim)',
              }}
              title="Volume Up 5%"
            >
              + 5%
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. WORKSTATION THEME SYNC & STUDIO ───────────────────────────── */}
      <div className="rounded-2xl p-3 border theme-card flex flex-col gap-2.5 shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Palette className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Desktop Theme Studio</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full shadow"
              style={{ backgroundColor: theme?.borderActive || '#2962FF' }}
            />
            <span className="text-[10px] font-mono text-white font-semibold">
              {theme?.name || 'Active Theme'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOpenThemeStudio && onOpenThemeStudio()}
            className="action-btn bg-[#2962FF]/20 border-[#2962FF] text-white font-medium flex items-center justify-center gap-1.5 py-2.5"
          >
            <Palette className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Switch Theme ({allThemes.length || 15})</span>
          </button>

          <button
            onClick={() => {
              sendWs({ type: 'cycle_theme' });
              vibrate(20);
            }}
            className="action-btn border-[#1C2B42] text-slate-300 flex items-center justify-center gap-1.5 py-2.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>5m Auto-Cycle</span>
          </button>
        </div>
      </div>
    </div>
  );
}
