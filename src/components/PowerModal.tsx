'use client';

import React, { useState } from 'react';
import {
  Battery,
  Zap,
  Activity,
  Monitor,
  Copy,
  Check,
  ExternalLink,
  Power,
  Sliders,
  X,
  Gauge,
  Clock,
  Laptop,
} from 'lucide-react';

interface PowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  power: any;
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
}

export default function PowerModal({
  isOpen,
  onClose,
  power,
  sendWs,
  connected,
  theme,
}: PowerModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [togglingVd, setTogglingVd] = useState(false);

  if (!isOpen) return null;

  const battery = power?.battery || {
    capacity: 100,
    status: 'Full',
    isCharging: false,
    watts: 0,
    timeStr: '',
  };

  const virtualDisplay = power?.virtualDisplay || {
    active: false,
    headlessName: null,
    url: '',
  };

  const tunedProfile = power?.tunedProfile || 'balanced';

  const copyVncUrl = () => {
    if (virtualDisplay.url) {
      navigator.clipboard.writeText(virtualDisplay.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(25); } catch (_) {}
      }
    }
  };

  const handleToggleVd = () => {
    setTogglingVd(true);
    sendWs({ type: 'toggle_virtual_display' });
    setTimeout(() => setTogglingVd(false), 1500);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(40); } catch (_) {}
    }
  };

  const handleOpenPowerStats = () => {
    sendWs({ type: 'open_power_statistics' });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (_) {}
    }
  };

  const isCharging = battery.isCharging;
  const batColor = isCharging
    ? '#10B981'
    : battery.capacity <= 20
    ? '#F43F5E'
    : battery.capacity <= 40
    ? '#F59E0B'
    : '#38BDF8';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-2xl border p-4 shadow-2xl flex flex-col gap-3.5 select-none text-slate-100"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-glow)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: batColor,
              }}
            >
              <Zap className="w-4 h-4" style={{ color: batColor }} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Power & Workstation Health</h3>
              <p className="text-[10px] text-slate-400 font-mono">Real-time Telemetry & Displays</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-700/60 flex items-center justify-center text-slate-400 active:text-white active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Battery Health Card */}
        <div
          className="rounded-xl border p-3 flex flex-col gap-2.5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-dim)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="w-5 h-5" style={{ color: batColor }} />
              <div>
                <div className="text-base font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
                  {battery.capacity}%
                  {isCharging && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-sans border border-emerald-500/30">
                      Charging
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {battery.status} {battery.timeStr ? `• ${battery.timeStr}` : ''}
                </div>
              </div>
            </div>

            {battery.watts > 0 && (
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {battery.watts.toFixed(1)} W
                </div>
                <div className="text-[9px] text-slate-400 font-mono">Rate</div>
              </div>
            )}
          </div>

          {/* Capacity Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(4, Math.min(100, battery.capacity))}%`,
                backgroundColor: batColor,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              TuneD: <span className="text-cyan-300 font-semibold">{tunedProfile}</span>
            </span>
            <button
              onClick={handleOpenPowerStats}
              disabled={!connected}
              className="text-sky-400 active:underline flex items-center gap-1"
            >
              <Activity className="w-3 h-3" />
              Open Desktop Graphs
            </button>
          </div>
        </div>

        {/* Virtual Second Display (Windows Laptop Streaming) */}
        <div
          className="rounded-xl border p-3 flex flex-col gap-2.5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: virtualDisplay.active ? 'var(--border-active)' : 'var(--border-dim)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor
                className="w-5 h-5"
                style={{ color: virtualDisplay.active ? 'var(--accent-sky)' : '#94A3B8' }}
              />
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  Virtual Second Display
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      virtualDisplay.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {virtualDisplay.active
                    ? `${virtualDisplay.headlessName || 'HEADLESS'} @ -1920,0 (Left of HDMI)`
                    : 'Stream extended desktop to Windows Laptop'}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleVd}
              disabled={!connected || togglingVd}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 border ${
                virtualDisplay.active
                  ? 'bg-rose-950/40 border-rose-600/50 text-rose-300'
                  : 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white'
              }`}
            >
              <Power className="w-3 h-3" />
              {togglingVd ? 'Updating...' : virtualDisplay.active ? 'Stop' : 'Start'}
            </button>
          </div>

          {virtualDisplay.active && virtualDisplay.url && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">Windows Laptop Browser URL:</div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={virtualDisplay.url}
                  className="flex-1 bg-slate-900 border border-slate-700/70 rounded-lg px-2.5 py-1 text-[11px] font-mono text-cyan-300 select-all"
                />
                <button
                  onClick={copyVncUrl}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 active:scale-95 text-xs flex items-center gap-1"
                  title="Copy noVNC URL"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={virtualDisplay.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 active:text-white"
                  title="Open Preview"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="text-[9px] text-slate-500 font-mono">
                Open in Chrome or Edge on Windows and press F11 for full screen.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-mono text-slate-500">
            {connected ? '● LIVE SYNC ACTIVE' : '○ DISCONNECTED'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
