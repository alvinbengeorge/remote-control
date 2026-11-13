'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Rocket,
  Monitor,
  Terminal,
  Globe,
  Code,
  Music,
  Settings,
  Folder,
  Layers,
  Sparkles,
  Check,
  ChevronRight,
  Maximize,
  MessageCircle,
  Sliders,
  SunMedium,
  Sun,
} from 'lucide-react';

export interface AppItem {
  name: string;
  desktopId: string;
  exec: string;
  icon?: string;
  comment?: string;
  category?: string;
  terminal?: boolean;
}

interface AppLauncherProps {
  apps: AppItem[];
  sendWs: (msg: any) => void;
  connected: boolean;
  activeWorkspace: number;
  setActiveWorkspace: (ws: number) => void;
}

const CATEGORIES = ['All', 'Development', 'Internet', 'Media', 'System', 'Utility'];

export default function AppLauncher({
  apps = [],
  sendWs,
  connected,
  activeWorkspace = 1,
  setActiveWorkspace,
}: AppLauncherProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lastLaunchedApp, setLastLaunchedApp] = useState<string | null>(null);

  const WORKSPACES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const activeWsButtonRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active workspace button into visible horizontal view
  useEffect(() => {
    if (activeWsButtonRef.current) {
      activeWsButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeWorkspace]);

  const vibrate = (p: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(p); } catch (_) {}
    }
  };

  const act = (type: string, action: string, value?: any) => {
    sendWs({ type, action, value });
    vibrate(15);
  };

  const handleWorkspaceClick = (ws: number) => {
    setActiveWorkspace(ws);
    sendWs({ type: 'hypr', action: 'workspace', value: ws });
    vibrate(15);
  };

  const handleLaunchApp = (app: AppItem) => {
    if (!connected) return;
    vibrate([20, 40, 20]);
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

  // Filter apps based on search query and category
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
    <div className="flex flex-col flex-1 w-full gap-2.5 overflow-y-auto no-scrollbar pt-1.5 px-0.5 pb-6 select-none">
      {/* ── 1. HYPRLAND WORKSPACES (Horizontal Scrollable 1–10) ─────────── */}
      <div className="rounded-2xl p-3 border theme-card flex flex-col gap-2 shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            <span>Hyprland Workspaces (1–10)</span>
          </div>
          <span className="text-[9px] font-mono text-slate-400">
            Active: <span className="font-bold text-white">WS {activeWorkspace}</span>
          </span>
        </div>

        {/* Scrollable Workspace Track */}
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth"
          style={{ touchAction: 'pan-x' }}
        >
          {WORKSPACES.map((ws) => {
            const isActive = ws === activeWorkspace;
            return (
              <button
                key={ws}
                ref={isActive ? activeWsButtonRef : null}
                onClick={() => handleWorkspaceClick(ws)}
                disabled={!connected}
                style={{
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-dim)',
                  boxShadow: isActive ? '0 0 14px var(--border-glow)' : 'none',
                }}
                className={`min-w-[50px] h-11 px-3 rounded-xl border font-mono font-bold text-sm shrink-0 flex items-center justify-center active:scale-95 transition-all ${
                  isActive ? 'text-white scale-[1.03]' : 'text-slate-300 hover:text-white'
                }`}
              >
                {ws}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. WORKSTATION OVERLAYS & CONTROLS ───────────────────────────── */}
      <div className="rounded-2xl p-3 border theme-card flex flex-col gap-2 shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workstation Overlays</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => act('hypr', 'fullscreen')}
            disabled={!connected}
            className="action-btn"
          >
            <Maximize className="w-3.5 h-3.5 mr-1 text-purple-400" /> Fullscreen
          </button>
          <button
            onClick={() => act('hypr', 'floating')}
            disabled={!connected}
            className="action-btn"
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Float
          </button>
          <button
            onClick={() => act('hypr', 'kill')}
            disabled={!connected}
            className="action-btn text-rose-400 border-rose-900/40"
          >
            Kill Win
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-0.5">
          <button
            onClick={() => act('quickshell', 'antigravity')}
            disabled={!connected}
            className="action-btn text-[#00F0FF] border-[#00F0FF]/30"
          >
            ✦ HUD
          </button>
          <button
            onClick={() => act('quickshell', 'whatsapp')}
            disabled={!connected}
            className="action-btn text-[#25D366] border-[#25D366]/30"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1" /> WA
          </button>
          <button
            onClick={() => act('quickshell', 'control')}
            disabled={!connected}
            className="action-btn"
          >
            <Sliders className="w-3.5 h-3.5 mr-1" /> Controls
          </button>
        </div>

        {/* Display Brightness Steppers */}
        <div className="grid grid-cols-2 gap-2 mt-1 pt-1.5 border-t" style={{ borderColor: 'var(--border-dim)' }}>
          <button
            onClick={() => act('brightness', 'down')}
            disabled={!connected}
            className="action-btn"
          >
            <SunMedium className="w-3.5 h-3.5 mr-1 text-amber-400" /> Bright -
          </button>
          <button
            onClick={() => act('brightness', 'up')}
            disabled={!connected}
            className="action-btn"
          >
            <Sun className="w-3.5 h-3.5 mr-1 text-amber-400" /> Bright +
          </button>
        </div>
      </div>

      {/* ── 3. APP LAUNCHER SEARCH & CATEGORY FILTER ─────────────────────── */}
      <div className="rounded-2xl p-3 border theme-card flex flex-col gap-2.5 shrink-0 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workstation App Launcher</span>
          </div>
          <span className="text-[9px] font-mono text-slate-400">
            {filteredApps.length} of {apps.length} apps
          </span>
        </div>

        {/* Search Input Box */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed apps (e.g. Code, Kitty, Chrome)..."
            className="w-full bg-black/40 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth"
          style={{ touchAction: 'pan-x' }}
        >
          {CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  vibrate(10);
                }}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase shrink-0 transition-all ${
                  isCatActive
                    ? 'bg-cyan-500 text-black font-bold border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                    : 'bg-black/30 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. INSTALLED APPS LIST ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 flex-1 min-h-[300px]">
        {filteredApps.length === 0 ? (
          <div className="rounded-2xl p-8 border theme-card flex flex-col items-center justify-center text-center gap-2 text-slate-400">
            <Search className="w-8 h-8 text-slate-600 mb-1" />
            <p className="font-bold text-sm text-white">No applications match &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-xs text-slate-500">Try clearing your search or category filter.</p>
          </div>
        ) : (
          filteredApps.map((app) => {
            const isJustLaunched = lastLaunchedApp === app.name;
            return (
              <div
                key={app.desktopId}
                onClick={() => handleLaunchApp(app)}
                className={`rounded-2xl p-3 border theme-card flex items-center justify-between gap-3 shrink-0 active:scale-[0.98] transition-all cursor-pointer ${
                  isJustLaunched
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                    : 'hover:border-slate-700'
                }`}
              >
                {/* Left: App Avatar + Meta */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Monogram Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border relative overflow-hidden text-xs font-bold font-mono"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: isJustLaunched ? '#10B981' : 'var(--border-dim)',
                      color: isJustLaunched ? '#10B981' : 'var(--accent-sky)',
                    }}
                  >
                    {isJustLaunched ? (
                      <Check className="w-5 h-5 text-emerald-400 animate-in zoom-in-50" />
                    ) : (
                      <span>{app.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  {/* App Text Info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate leading-tight">
                        {app.name}
                      </span>
                      {app.terminal && (
                        <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                          CLI
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate mt-0.5 leading-snug">
                      {app.comment || app.exec || 'Desktop Application'}
                    </span>
                  </div>
                </div>

                {/* Right: Category Badge & Launch CTA */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${getCategoryColor(
                      app.category
                    )}`}
                  >
                    {getCategoryIcon(app.category)}
                    <span>{app.category || 'App'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchApp(app);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                      isJustLaunched
                        ? 'bg-emerald-500 border-emerald-400 text-black'
                        : 'bg-black/30 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isJustLaunched ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
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
