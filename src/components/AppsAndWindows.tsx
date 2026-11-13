'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Monitor,
  Maximize2,
  X,
  Layers,
  RefreshCw,
  Eye,
  MoveRight,
  AppWindow,
  Search,
  Code,
  Globe,
  Music,
  Settings,
  Folder,
  Check,
  Rocket,
  Maximize,
  Sliders,
  SunMedium,
  MessageCircle,
  Activity,
  Zap,
} from 'lucide-react';
import { AppItem } from './AppLauncher';

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

interface AppsAndWindowsProps {
  apps: AppItem[];
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
  activeWorkspace?: number;
  setActiveWorkspace?: (ws: number) => void;
}

export default function AppsAndWindows({
  apps,
  sendWs,
  connected,
  theme,
  activeWorkspace = 1,
  setActiveWorkspace,
}: AppsAndWindowsProps) {
  // Navigation segment: 'windows' | 'launch'
  const [activeSection, setActiveSection] = useState<'windows' | 'launch'>('windows');

  // Window Master states
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [clients, setClients] = useState<WindowClient[]>([]);
  const [loadingWindows, setLoadingWindows] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<number | 'all'>('all');
  const [movingAddress, setMovingAddress] = useState<string | null>(null);

  // App Launcher states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lastLaunchedApp, setLastLaunchedApp] = useState<string | null>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }, []);

  // Sync window state
  const fetchWindowState = useCallback(() => {
    setLoadingWindows(true);
    sendWs({ type: 'get_windows' });
    setTimeout(() => setLoadingWindows(false), 500);
  }, [sendWs]);

  useEffect(() => {
    if (connected) {
      fetchWindowState();
    }
    const interval = setInterval(() => {
      if (connected) sendWs({ type: 'get_windows' });
    }, 3500);
    return () => clearInterval(interval);
  }, [connected, fetchWindowState, sendWs]);

  // Listen for WebSocket window updates
  useEffect(() => {
    const handleWsEvent = (e: CustomEvent) => {
      const data = e.detail;
      if (data && data.type === 'windows_state') {
        if (data.monitors) setMonitors(data.monitors);
        if (data.workspaces) setWorkspaces(data.workspaces);
        if (data.clients) setClients(data.clients);
        setLoadingWindows(false);
      }
    };

    window.addEventListener('ag_remote_event' as any, handleWsEvent);
    return () => window.removeEventListener('ag_remote_event' as any, handleWsEvent);
  }, []);

  // Window action dispatcher
  const dispatchWindowAction = (action: string, params: any) => {
    vibrate(15);
    sendWs({
      type: 'window_action',
      action,
      params,
    });
  };

  // Switch workspace
  const handleWorkspaceChange = (wsId: number) => {
    vibrate(12);
    if (setActiveWorkspace) setActiveWorkspace(wsId);
    dispatchWindowAction('change_workspace', { workspaceId: wsId });
  };

  // Launch App
  const handleLaunchApp = (app: AppItem) => {
    vibrate([25, 40]);
    setLastLaunchedApp(app.name);
    sendWs({
      type: 'launch_app',
      name: app.name,
      desktopId: app.desktopId,
      exec: app.exec,
    });
    setTimeout(() => {
      setLastLaunchedApp((curr) => (curr === app.name ? null : curr));
    }, 2500);
  };

  // Filtered Windows
  const filteredClients = clients.filter((c) => {
    if (selectedMonitor === 'all') return true;
    return c.monitorId === selectedMonitor;
  });

  // Filtered Apps
  const categories = useMemo(() => {
    const set = new Set<string>();
    apps.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [apps]);

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return apps.filter((app) => {
      const matchesCategory =
        selectedCategory === 'All' || app.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;
      const nameMatch = app.name && app.name.toLowerCase().includes(q);
      const commentMatch = app.comment && app.comment.toLowerCase().includes(q);
      const execMatch = app.exec && app.exec.toLowerCase().includes(q);
      const catMatch = app.category && app.category.toLowerCase().includes(q);
      return nameMatch || commentMatch || execMatch || catMatch;
    });
  }, [apps, searchQuery, selectedCategory]);

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'Development': return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30';
      case 'Internet': return 'text-sky-400 bg-sky-950/40 border-sky-500/30';
      case 'Media': return 'text-purple-400 bg-purple-950/40 border-purple-500/30';
      case 'System': return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      default: return 'text-slate-400 bg-slate-900 border-slate-700/50';
    }
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Development': return <Code className="w-3.5 h-3.5" />;
      case 'Internet': return <Globe className="w-3.5 h-3.5" />;
      case 'Media': return <Music className="w-3.5 h-3.5" />;
      case 'System': return <Settings className="w-3.5 h-3.5" />;
      default: return <Folder className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full gap-3 overflow-y-auto no-scrollbar pt-1.5 px-0.5 pb-6 select-none">
      {/* ── 1. MONITORS OVERVIEW (Multi-Monitor & Virtual Display) ─── */}
      <div className={`grid gap-2 shrink-0 ${monitors.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {monitors.map((m) => {
          const isSelected = selectedMonitor === m.id;
          const isVirtual = m.name && m.name.startsWith('HEADLESS');
          return (
            <div
              key={m.id}
              onClick={() => {
                setSelectedMonitor(selectedMonitor === m.id ? 'all' : m.id);
                vibrate(10);
              }}
              style={{
                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'var(--bg-card)',
                borderColor: isSelected ? 'var(--accent-sky)' : 'var(--border-dim)',
              }}
              className={`p-2.5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all active:scale-[0.98] ${
                isSelected ? 'ring-1 ring-[var(--accent-sky)]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 truncate">
                  <Monitor className="w-3.5 h-3.5 text-[var(--accent-sky)] shrink-0" />
                  <span className="truncate">{m.name}</span>
                </div>
                {isVirtual ? (
                  <span className="px-1 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-[9px] font-mono">
                    Virtual
                  </span>
                ) : m.focused ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Focus" />
                ) : null}
              </div>

              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                <div>{m.width}×{m.height}</div>
                <div className="text-[9px] text-slate-500 truncate">{m.model}</div>
              </div>

              <div className="mt-1.5 flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px] font-mono">
                <span className="text-slate-400">Workspace</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[var(--accent-cyan)] font-bold">
                  {m.activeWorkspaceId ?? '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. WINDOWS WORKSPACE SWITCHER RAIL (1–10) ────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-2xl border p-2.5 flex flex-col gap-2 shrink-0 shadow-sm"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            Hyprland Workspaces
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Workspaces 1–10</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((wsId) => {
            const hasWindows = workspaces.some((w) => w.id === wsId && w.windowsCount > 0);
            const isCurrent = monitors.some((m) => m.activeWorkspaceId === wsId);

            return (
              <button
                key={wsId}
                onClick={() => handleWorkspaceChange(wsId)}
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

      {/* ── 3. WORKSTATION OVERLAYS CARD ────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-2xl p-3 border flex flex-col gap-2 shrink-0 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Workstation Overlays</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => dispatchWindowAction('toggle_fullscreen', {})}
            disabled={!connected}
            className="action-btn"
          >
            <Maximize className="w-3.5 h-3.5 mr-1 text-purple-400" /> Fullscreen
          </button>
          <button
            onClick={() => dispatchWindowAction('toggle_float', {})}
            disabled={!connected}
            className="action-btn"
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Float
          </button>
          <button
            onClick={() => sendWs({ type: 'hypr', action: 'kill' })}
            disabled={!connected}
            className="action-btn text-rose-400 border-rose-900/40"
          >
            Kill Win
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-0.5">
          <button
            onClick={() => sendWs({ type: 'quickshell', action: 'antigravity' })}
            disabled={!connected}
            className="action-btn text-[#00F0FF] border-[#00F0FF]/30"
          >
            ✦ HUD
          </button>
          <button
            onClick={() => sendWs({ type: 'quickshell', action: 'whatsapp' })}
            disabled={!connected}
            className="action-btn text-[#25D366] border-[#25D366]/30"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1" /> WA
          </button>
          <button
            onClick={() => sendWs({ type: 'quickshell', action: 'control' })}
            disabled={!connected}
            className="action-btn"
          >
            <Sliders className="w-3.5 h-3.5 mr-1" /> Controls
          </button>
        </div>

        {/* Display Brightness Steppers */}
        <div className="grid grid-cols-2 gap-2 mt-1 pt-1.5 border-t" style={{ borderColor: 'var(--border-dim)' }}>
          <button
            onClick={() => sendWs({ type: 'brightness', action: 'down' })}
            disabled={!connected}
            className="action-btn"
          >
            <SunMedium className="w-3.5 h-3.5 mr-1 text-amber-400" /> Bright -
          </button>
          <button
            onClick={() => sendWs({ type: 'brightness', action: 'up' })}
            disabled={!connected}
            className="action-btn"
          >
            <SunMedium className="w-3.5 h-3.5 mr-1 text-amber-400" /> Bright +
          </button>
        </div>

        {/* Virtual Display & Power Controls */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <button
            onClick={() => sendWs({ type: 'toggle_virtual_display' })}
            disabled={!connected}
            className="action-btn text-indigo-400 border-indigo-900/40"
          >
            <Monitor className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Virtual Screen
          </button>
          <button
            onClick={() => sendWs({ type: 'open_power_statistics' })}
            disabled={!connected}
            className="action-btn text-emerald-400 border-emerald-900/40"
          >
            <Activity className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Power Stats
          </button>
        </div>
      </div>

      {/* ── 4. SECTION SWITCHER: WINDOWS vs LAUNCH APPS ─────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-dim)',
        }}
        className="flex items-center p-1 rounded-xl border shrink-0 text-xs font-mono shadow-sm"
      >
        <button
          onClick={() => {
            setActiveSection('windows');
            vibrate(10);
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeSection === 'windows'
              ? 'bg-[var(--accent-primary)] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <AppWindow className="w-3.5 h-3.5" />
          <span>Active Windows ({filteredClients.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveSection('launch');
            vibrate(10);
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeSection === 'launch'
              ? 'bg-[var(--accent-primary)] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Launch Apps ({apps.length})</span>
        </button>
      </div>

      {/* ── SECTION A: ACTIVE WINDOWS ──────────────────────────────── */}
      {activeSection === 'windows' && (
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400 font-mono">
            <span>Windows on Desktop ({filteredClients.length})</span>
            <div className="flex items-center gap-2">
              {selectedMonitor !== 'all' && (
                <button
                  onClick={() => setSelectedMonitor('all')}
                  className="text-[10px] text-[var(--accent-cyan)] hover:underline"
                >
                  Clear Screen Filter
                </button>
              )}
              <button
                onClick={fetchWindowState}
                disabled={loadingWindows}
                className="p-1 rounded text-slate-400 hover:text-white active:scale-95"
                title="Sync Windows"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWindows ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
              className="rounded-2xl border p-8 text-center text-xs text-slate-500 font-mono"
            >
              No active windows open on this screen.
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

                    <span className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-300 font-bold shrink-0">
                      WS {client.workspaceName || client.workspaceId}
                    </span>
                  </div>

                  {/* Move Workspace Drawer */}
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
                              dispatchWindowAction('move_to_workspace', {
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

                  {/* Window Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => dispatchWindowAction('focus', { address: client.address })}
                      className="py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Focus</span>
                    </button>

                    <button
                      onClick={() => setMovingAddress(isMoveOpen ? null : client.address)}
                      className={`py-1.5 px-2 rounded-xl text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all ${
                        isMoveOpen ? 'bg-indigo-600' : 'bg-slate-800/80 hover:bg-slate-700/80'
                      }`}
                    >
                      <MoveRight className="w-3.5 h-3.5 text-[var(--accent-sky)]" />
                      <span>Move</span>
                    </button>

                    <button
                      onClick={() => dispatchWindowAction('toggle_float', { address: client.address })}
                      className="py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>{client.floating ? 'Tile' : 'Float'}</span>
                    </button>

                    <button
                      onClick={() => dispatchWindowAction('close', { address: client.address })}
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
      )}

      {/* ── SECTION B: LAUNCH APPS ─────────────────────────────────── */}
      {activeSection === 'launch' && (
        <div className="flex flex-col gap-2.5 shrink-0">
          {/* Search Box */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-dim)',
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-sm"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps (Chrome, Kitty, Spotify, Code)..."
              className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  vibrate(8);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm font-semibold'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat !== 'All' && getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Apps Grid */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            {filteredApps.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-xs text-slate-500 font-mono">
                No applications match your search.
              </div>
            ) : (
              filteredApps.map((app) => {
                const isLaunching = lastLaunchedApp === app.name;

                return (
                  <button
                    key={app.desktopId || app.name}
                    onClick={() => handleLaunchApp(app)}
                    disabled={!connected}
                    style={{
                      backgroundColor: isLaunching ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                      borderColor: isLaunching ? 'var(--accent-emerald)' : 'var(--border-dim)',
                    }}
                    className={`p-2.5 rounded-2xl border flex items-center gap-2.5 text-left transition-all active:scale-[0.97] shadow-sm relative overflow-hidden ${
                      isLaunching ? 'ring-1 ring-emerald-500/50' : ''
                    }`}
                  >
                    {/* App Icon or Category Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${getCategoryColor(
                        app.category
                      )}`}
                    >
                      {app.icon ? (
                        <span className="text-sm font-bold uppercase font-mono">
                          {app.name.charAt(0)}
                        </span>
                      ) : (
                        getCategoryIcon(app.category)
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {app.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        {app.category || 'App'}
                      </div>
                    </div>

                    {isLaunching && (
                      <div className="absolute right-2 top-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
