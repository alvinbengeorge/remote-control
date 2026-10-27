'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Touchpad from '@/components/Touchpad';
import Keypad from '@/components/Keypad';
import MediaBar from '@/components/MediaBar';
import TerminalDrawer from '@/components/TerminalDrawer';
import { MousePointer, Keyboard, Sliders, Terminal, Lock, Wifi, WifiOff, ShieldCheck } from 'lucide-react';

export default function RemotePage() {
  const [activeTab, setActiveTab] = useState<'touchpad' | 'keyboard' | 'media' | 'terminal'>('touchpad');
  const [connected, setConnected] = useState(false);
  const [deviceMac, setDeviceMac] = useState<string>('');
  const [cmdResult, setCmdResult] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connectWs = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}`;
      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('WebSocket connection established');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            setDeviceMac(data.deviceMac || '');
          } else if (data.type === 'cmd_result') {
            setCmdResult(data);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    } catch (e) {
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    }
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  const sendWs = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return (
    <main className="flex flex-col h-screen w-screen max-w-md mx-auto p-3 gap-3 bg-[#080B11] text-[#F8FAFC] overflow-hidden select-none">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#0E1522] border border-[#1C2B42] rounded-2xl px-3.5 py-2.5 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          {/* Brand Shield Dot */}
          <div className="w-8 h-8 rounded-xl bg-[#2962FF]/15 border border-[#2962FF] flex items-center justify-center">
            <span className="text-[#38BDF8] font-bold text-xs">AG</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-wide">Remote</span>
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#131D2E] border border-[#1C2B42] text-slate-400">
                <ShieldCheck className="w-3 h-3 text-[#60B01C]" />
                <span className="truncate max-w-[85px]">{deviceMac || 'MAC Guard'}</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">Fedora // Hyprland</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              connected
                ? 'bg-[#60B01C]/15 border-[#60B01C] text-[#60B01C]'
                : 'bg-rose-950/30 border-rose-800 text-rose-400'
            }`}
          >
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{connected ? 'ONLINE' : 'DISCONNECTED'}</span>
          </div>

          {/* Quick Lock PC Button */}
          <button
            onClick={() => sendWs({ type: 'lock' })}
            disabled={!connected}
            className="w-8 h-8 rounded-xl bg-[#131D2E] border border-[#1C2B42] active:bg-rose-900/40 active:border-rose-500 flex items-center justify-center text-slate-300 active:text-rose-400 transition-colors"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'touchpad' && <Touchpad sendWs={sendWs} connected={connected} />}
        {activeTab === 'keyboard' && <Keypad sendWs={sendWs} connected={connected} />}
        {activeTab === 'media' && <MediaBar sendWs={sendWs} connected={connected} />}
        {activeTab === 'terminal' && (
          <TerminalDrawer sendWs={sendWs} connected={connected} cmdResult={cmdResult} />
        )}
      </div>

      {/* ── BOTTOM NAVIGATION TABS ──────────────────────────────────────── */}
      <nav className="grid grid-cols-4 gap-1.5 bg-[#0E1522] border border-[#1C2B42] rounded-2xl p-1.5 shrink-0 shadow-lg">
        <button
          onClick={() => setActiveTab('touchpad')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'touchpad'
              ? 'bg-[#2962FF] text-white shadow-md'
              : 'text-slate-400 active:bg-[#131D2E] hover:text-white'
          }`}
        >
          <MousePointer className="w-4 h-4 mb-1" />
          <span>Trackpad</span>
        </button>

        <button
          onClick={() => setActiveTab('keyboard')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'keyboard'
              ? 'bg-[#2962FF] text-white shadow-md'
              : 'text-slate-400 active:bg-[#131D2E] hover:text-white'
          }`}
        >
          <Keyboard className="w-4 h-4 mb-1" />
          <span>Keyboard</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'media'
              ? 'bg-[#2962FF] text-white shadow-md'
              : 'text-slate-400 active:bg-[#131D2E] hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 mb-1" />
          <span>Media</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'terminal'
              ? 'bg-[#2962FF] text-white shadow-md'
              : 'text-slate-400 active:bg-[#131D2E] hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 mb-1" />
          <span>Terminal</span>
        </button>
      </nav>
    </main>
  );
}
