'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Maximize2,
  X,
  Layers,
  ExternalLink,
  RefreshCw,
  Eye,
  Minimize2,
  MoveRight,
  Sparkles,
  Radio,
  AppWindow,
} from 'lucide-react';

interface WindowClient {
  address: string;
  title: string;
  class: string;
  workspaceId: number | null;
  workspaceName: string;
  monitorId: number;
  floating: boolean;
  fullscreen: boolean;
  isFocused: boolean;
  pid: number;
}

interface MonitorInfo {
  id: number;
  name: string;
  model: string;
  width: number;
  height: number;
  activeWorkspaceId: number | null;
  focused: boolean;
}

interface WorkspaceInfo {
  id: number;
  name: string;
  monitor: string;
  monitorId: number;
  windowsCount: number;
}

interface WindowMasterProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
}

export default function WindowMaster({ sendWs, connected, theme }: WindowMasterProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [clients, setClients] = useState<WindowClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<number | 'all'>('all');
  const [movingAddress, setMovingAddress] = useState<string | null>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }, []);

  const fetchState = useCallback(() => {
    setLoading(true);
    sendWs({ type: 'get_windows' });
    setTimeout(() => setLoading(false), 500);
  }, [sendWs]);

  // Request window state on mount & periodic sync
  useEffect(() => {
    if (connected) {
      fetchState();
    }
    const interval = setInterval(() => {
      if (connected) sendWs({ type: 'get_windows' });
    }, 4000);
    return () => clearInterval(interval);
  }, [connected, fetchState, sendWs]);

  // Listen for WebSocket window updates
  useEffect(() => {
    const handleWsEvent = (e: CustomEvent) => {
      const data = e.detail;
      if (data && data.type === 'windows_state') {
        if (data.monitors) setMonitors(data.monitors);
        if (data.workspaces) setWorkspaces(data.workspaces);
        if (data.clients) setClients(data.clients);
        setLoading(false);
      }
    };

    window.addEventListener('ag_remote_event' as any, handleWsEvent);
    return () => window.removeEventListener('ag_remote_event' as any, handleWsEvent);
  }, []);

  const dispatchAction = (action: string, params: any) => {
    vibrate(15);
    sendWs({
      type: 'window_action',
      action,
      params,
    });
  };

  const filteredClients = clients.filter((c) => {
    if (selectedMonitor === 'all') return true;
    return c.monitorId === selectedMonitor;
  });

  return (
    <div className="flex flex-col flex-1 w-full gap-3 overflow-y-auto no-scrollbar pt-1 pb-6 select-none">
      {/* ── HEADER / REFRESH ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <AppWindow className="w-5 h-5 text-[var(--accent-primary)]" />
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">
            Window & Workspace Master
          </h2>
        </div>

        <button
          onClick={fetchState}
          disabled={loading || !connected}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-dim)',
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs text-slate-300 font-mono active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-cyan)] ${loading ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* ── 1. DUAL MONITORS OVERVIEW ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        {monitors.map((m) => {
          const isSelected = selectedMonitor === m.id;
          return (
            <div
              key={m.id}
              onClick={() => {
                setSelectedMonitor(selectedMonitor === m.id ? 'all' : m.id);
                vibrate(10);
              }}
              style={{
                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card)',
                borderColor: isSelected ? 'var(--accent-sky)' : 'var(--border-dim)',
              }}
              className={`p-3 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all active:scale-[0.98] ${
                isSelected ? 'ring-1 ring-[var(--accent-sky)]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Monitor className="w-4 h-4 text-[var(--accent-sky)]" />
                  <span>{m.name}</span>
                </div>
                {m.focused && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Focus" />
                )}
              </div>

              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                <div>{m.width}×{m.height}</div>
                <div className="text-[10px] text-slate-500 truncate">{m.model}</div>
              </div>

              <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                <span className="text-slate-400">Workspace</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[var(--accent-cyan)] font-bold">
                  {m.activeWorkspaceId ?? '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. QUICK WORKSPACE JUMP RAIL (1–10) ────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-2xl border p-2.5 flex flex-col gap-2 shrink-0"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            Workspace Switcher
          </span>
          <span className="text-[10px] text-slate-500">Hyprland 1–10</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((wsId) => {
            const hasWindows = workspaces.some((w) => w.id === wsId && w.windowsCount > 0);
            const isCurrent = monitors.some((m) => m.activeWorkspaceId === wsId);

            return (
              <button
                key={wsId}
                onClick={() => dispatchAction('change_workspace', { workspaceId: wsId })}
                style={{
                  backgroundColor: isCurrent ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  borderColor: isCurrent ? 'var(--border-active)' : 'var(--border-dim)',
                  color: isCurrent ? '#FFFFFF' : hasWindows ? 'var(--accent-cyan)' : 'var(--text-muted)',
                }}
                className={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center font-mono text-xs font-bold shrink-0 transition-all active:scale-95 relative ${
                  isCurrent ? 'shadow-lg shadow-[var(--accent-primary)]/30' : ''
                }`}
              >
                <span>{wsId}</span>
                {hasWindows && !isCurrent && (
                  <span className="w-1 h-1 rounded-full bg-[var(--accent-cyan)] absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. WINDOW CLIENTS LIST ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between px-1 text-xs text-slate-400 font-mono">
          <span>Active Windows ({filteredClients.length})</span>
          {selectedMonitor !== 'all' && (
            <button
              onClick={() => setSelectedMonitor('all')}
              className="text-[10px] text-[var(--accent-cyan)] hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>

        {filteredClients.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-dim)',
            }}
            className="rounded-2xl border p-8 text-center text-xs text-slate-500 font-mono"
          >
            No active windows open on this display.
          </div>
        ) : (
          filteredClients.map((client) => {
            const isMoveOpen = movingAddress === client.address;

            return (
              <div
                key={client.address}
                style={{
                  backgroundColor: client.isFocused ? 'rgba(129, 140, 248, 0.08)' : 'var(--bg-card)',
                  borderColor: client.isFocused ? 'var(--accent-primary)' : 'var(--border-dim)',
                }}
                className={`p-3 rounded-2xl border flex flex-col gap-2.5 transition-all shadow-sm ${
                  client.isFocused ? 'ring-1 ring-[var(--accent-primary)]' : ''
                }`}
              >
                {/* Window Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/40 text-[10px] font-mono font-bold text-[var(--accent-cyan)] border border-slate-800">
                        {client.class}
                      </span>
                      {client.floating && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-950/60 text-amber-400 border border-amber-800/40">
                          FLOAT
                        </span>
                      )}
                      {client.fullscreen && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950/60 text-purple-400 border border-purple-800/40">
                          FULLSCREEN
                        </span>
                      )}
                      {client.isFocused && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          FOCUSED
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-slate-200 truncate mt-1" title={client.title}>
                      {client.title}
                    </div>
                  </div>

                  {/* Workspace badge */}
                  <span className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-300 font-bold shrink-0">
                    WS {client.workspaceName || client.workspaceId}
                  </span>
                </div>

                {/* Move to Workspace Expanded Drawer */}
                {isMoveOpen && (
                  <div className="p-2.5 rounded-xl bg-black/50 border border-slate-800 flex flex-col gap-2 animate-in fade-in duration-150">
                    <span className="text-[10px] font-mono text-slate-400">
                      Move &quot;{client.class}&quot; to workspace:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((targetWs) => (
                        <button
                          key={targetWs}
                          onClick={() => {
                            dispatchAction('move_to_workspace', {
                              address: client.address,
                              workspaceId: targetWs,
                            });
                            setMovingAddress(null);
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold border ${
                            client.workspaceId === targetWs
                              ? 'bg-[var(--accent-primary)] text-white border-transparent'
                              : 'bg-slate-800 text-slate-300 border-slate-700 active:scale-95'
                          }`}
                        >
                          {targetWs}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Window Action Buttons Bar */}
                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80">
                  {/* Focus */}
                  <button
                    onClick={() => dispatchAction('focus', { address: client.address })}
                    className="py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Focus</span>
                  </button>

                  {/* Move Workspace */}
                  <button
                    onClick={() => setMovingAddress(isMoveOpen ? null : client.address)}
                    className={`py-1.5 px-2 rounded-xl text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all ${
                      isMoveOpen ? 'bg-indigo-600' : 'bg-slate-800/80 hover:bg-slate-700/80'
                    }`}
                  >
                    <MoveRight className="w-3.5 h-3.5 text-[var(--accent-sky)]" />
                    <span>Move</span>
                  </button>

                  {/* Float / Tile */}
                  <button
                    onClick={() => dispatchAction('toggle_float', { address: client.address })}
                    className="py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>{client.floating ? 'Tile' : 'Float'}</span>
                  </button>

                  {/* Close Window */}
                  <button
                    onClick={() => dispatchAction('close', { address: client.address })}
                    className="py-1.5 px-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>Close</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
