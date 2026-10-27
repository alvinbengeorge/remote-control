'use client';

import React from 'react';
import { Volume2, Volume1, VolumeX, Sun, SunMedium, Play, SkipForward, SkipBack, Maximize, Layers, Terminal, Globe, Code, Folder, MessageCircle, Sliders } from 'lucide-react';

interface MediaBarProps {
  sendWs: (msg: any) => void;
  connected: boolean;
}

export default function MediaBar({ sendWs, connected }: MediaBarProps) {
  const vibrate = (p = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(p); } catch (e) {}
    }
  };

  const act = (type: string, action: string, value?: any) => {
    sendWs({ type, action, value });
    vibrate(15);
  };

  return (
    <div className="flex flex-col flex-1 w-full gap-4 overflow-y-auto pb-4 select-none">
      {/* 1. Hyprland Workspace Matrix */}
      <div className="bg-[#0E1522] border border-[#1C2B42] rounded-2xl p-3">
        <span className="text-[11px] font-mono text-slate-400 mb-2 block uppercase tracking-wider">
          Hyprland Workspaces
        </span>
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((ws) => (
            <button
              key={ws}
              onClick={() => act('hypr', 'workspace', ws)}
              disabled={!connected}
              className="h-11 rounded-xl bg-[#131D2E] border border-[#1C2B42] active:border-[#2962FF] active:bg-[#2962FF]/20 text-white font-mono font-bold text-sm flex items-center justify-center active:scale-95 transition-all"
            >
              {ws}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Volume & Brightness Sliders / Buttons */}
      <div className="bg-[#0E1522] border border-[#1C2B42] rounded-2xl p-3 flex flex-col gap-3">
        <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">
          Volume & Audio
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act('volume', 'down')} className="action-btn">
            <Volume1 className="w-4 h-4 mr-1 text-[#38BDF8]" /> Vol -
          </button>
          <button onClick={() => act('volume', 'mute')} className="action-btn">
            <VolumeX className="w-4 h-4 mr-1 text-rose-400" /> Mute
          </button>
          <button onClick={() => act('volume', 'up')} className="action-btn">
            <Volume2 className="w-4 h-4 mr-1 text-[#38BDF8]" /> Vol +
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider mt-1">
          Media Playback & Backlight
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act('media', 'prev')} className="action-btn">
            <SkipBack className="w-4 h-4 mr-1" /> Prev
          </button>
          <button onClick={() => act('media', 'play-pause')} className="action-btn bg-[#60B01C]/20 border-[#60B01C]/40 text-[#60B01C]">
            <Play className="w-4 h-4 mr-1" /> Play
          </button>
          <button onClick={() => act('media', 'next')} className="action-btn">
            <SkipForward className="w-4 h-4 mr-1" /> Next
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={() => act('brightness', 'down')} className="action-btn">
            <SunMedium className="w-4 h-4 mr-1 text-amber-400" /> Bright -
          </button>
          <button onClick={() => act('brightness', 'up')} className="action-btn">
            <Sun className="w-4 h-4 mr-1 text-amber-400" /> Bright +
          </button>
        </div>
      </div>

      {/* 3. Window & Quickshell Actions */}
      <div className="bg-[#0E1522] border border-[#1C2B42] rounded-2xl p-3 flex flex-col gap-2">
        <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">
          Window & Shell Controls
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act('hypr', 'fullscreen')} className="action-btn">
            <Maximize className="w-4 h-4 mr-1 text-purple-400" /> Fullscreen
          </button>
          <button onClick={() => act('hypr', 'floating')} className="action-btn">
            <Layers className="w-4 h-4 mr-1 text-cyan-400" /> Float
          </button>
          <button onClick={() => act('hypr', 'kill')} className="action-btn text-rose-400 border-rose-900/40">
            Kill Win
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider mt-2">
          Quickshell Overlays
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act('quickshell', 'antigravity')} className="action-btn text-[#00F0FF] border-[#00F0FF]/30">
            ✦ HUD
          </button>
          <button onClick={() => act('quickshell', 'whatsapp')} className="action-btn text-[#25D366] border-[#25D366]/30">
            <MessageCircle className="w-4 h-4 mr-1" /> WA
          </button>
          <button onClick={() => act('quickshell', 'control')} className="action-btn">
            <Sliders className="w-4 h-4 mr-1" /> Controls
          </button>
        </div>
      </div>

      {/* 4. App Launchers */}
      <div className="bg-[#0E1522] border border-[#1C2B42] rounded-2xl p-3">
        <span className="text-[11px] font-mono text-slate-400 mb-2 block uppercase tracking-wider">
          Quick App Launch
        </span>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => act('hypr', 'launch', 'kitty')} className="action-btn flex-col py-3">
            <Terminal className="w-5 h-5 mb-1 text-sky-400" />
            <span className="text-[10px]">Kitty</span>
          </button>
          <button onClick={() => act('hypr', 'launch', 'google-chrome')} className="action-btn flex-col py-3">
            <Globe className="w-5 h-5 mb-1 text-amber-400" />
            <span className="text-[10px]">Chrome</span>
          </button>
          <button onClick={() => act('hypr', 'launch', 'code')} className="action-btn flex-col py-3">
            <Code className="w-5 h-5 mb-1 text-blue-400" />
            <span className="text-[10px]">VS Code</span>
          </button>
          <button onClick={() => act('hypr', 'launch', 'nautilus')} className="action-btn flex-col py-3">
            <Folder className="w-5 h-5 mb-1 text-emerald-400" />
            <span className="text-[10px]">Files</span>
          </button>
        </div>
      </div>
    </div>
  );
}
