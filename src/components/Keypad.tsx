'use client';

import React, { useState, useEffect } from 'react';
import { Send, CornerDownLeft, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, KeyRound, Eye, EyeOff, Lock, Unlock, Clipboard, Sparkles, Fingerprint } from 'lucide-react';

interface KeypadProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  onOpenClipboard?: () => void;
  onOpenBiometric?: () => void;
}

export default function Keypad({ sendWs, connected, onOpenClipboard, onOpenBiometric }: KeypadProps) {
  const [text, setText] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showUnlockBox, setShowUnlockBox] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_remote_pwd');
      if (saved) setUnlockPassword(saved);
    } catch (e) {}
  }, []);

  const vibrate = (pattern: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text) return;
    sendWs({ type: 'type', text });
    vibrate(20);
    setText('');
  };

  const handleUnlockPC = () => {
    if (!unlockPassword) return;
    // Wake screen by tapping escape, then type password and hit enter
    sendWs({ type: 'key', key: 'escape' });
    setTimeout(() => {
      sendWs({ type: 'type', text: unlockPassword });
      setTimeout(() => {
        sendWs({ type: 'key', key: 'enter' });
      }, 150);
    }, 100);
    vibrate([20, 50, 30]);

    try {
      localStorage.setItem('ag_remote_pwd', unlockPassword);
    } catch (e) {}
  };

  const pressKey = (key: string, v: number = 15) => {
    sendWs({ type: 'key', key });
    vibrate(v);
  };

  return (
    <div className="flex flex-col flex-1 w-full gap-3 h-full select-none overflow-y-auto pb-2">
      {/* Live Text Entry Box */}
      <form onSubmit={handleSendText} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type text to send to PC..."
          className="flex-1 bg-[#0E1522] border border-[#1C2B42] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2962FF]"
        />
        <button
          type="submit"
          disabled={!connected || !text}
          className="bg-[#2962FF] disabled:opacity-40 text-white px-4 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Quick Actions: Unlock PC & Magic Clipboard */}
      <div className="bg-[#0E1522] border border-[#1C2B42] rounded-xl p-2.5 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowUnlockBox(!showUnlockBox)}
            className="flex items-center gap-1.5 text-xs font-mono text-[#38BDF8]"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{showUnlockBox ? 'Hide Unlock' : 'Unlock PC'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {onOpenBiometric && (
              <button
                type="button"
                onClick={onOpenBiometric}
                className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 bg-cyan-950/40 border border-cyan-500/40 text-cyan-400 rounded-lg active:scale-95 transition-all shadow-sm"
                title="Unlock PC with Fingerprint / Biometrics"
              >
                <Fingerprint className="w-3 h-3" />
                <span>Biometric</span>
              </button>
            )}

            {onOpenClipboard && (
              <button
                type="button"
                onClick={onOpenClipboard}
                className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 rounded-lg active:scale-95 transition-all"
              >
                <Clipboard className="w-3 h-3" />
                <span>Magic Clip</span>
              </button>
            )}

            {unlockPassword && (
              <button
                onClick={handleUnlockPC}
                disabled={!connected}
                className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 bg-[#60B01C]/20 border border-[#60B01C]/50 text-[#60B01C] rounded-lg active:scale-95"
              >
                <Unlock className="w-3 h-3" />
                <span>Unlock</span>
              </button>
            )}
          </div>
        </div>

        {showUnlockBox && (
          <div className="flex gap-2 pt-1 border-t border-[#1C2B42]">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="PC Password (stored on phone)"
                className="w-full bg-[#131D2E] border border-[#1C2B42] rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#2962FF]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleUnlockPC}
              disabled={!connected || !unlockPassword}
              className="bg-[#2962FF] disabled:opacity-40 text-white text-xs px-3 rounded-lg flex items-center gap-1 font-medium active:scale-95"
            >
              <Unlock className="w-3.5 h-3.5" /> Unlock
            </button>
          </div>
        )}
      </div>

      {/* Main Keys Matrix */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        {/* Row 1 */}
        <button onClick={() => pressKey('escape')} className="key-btn">Esc</button>
        <button onClick={() => pressKey('tab')} className="key-btn">Tab</button>
        <button onClick={() => pressKey('backspace')} className="key-btn text-rose-400">
          <Delete className="w-4 h-4 inline" />
        </button>
        <button onClick={() => pressKey('enter')} className="key-btn bg-[#2962FF]/20 text-[#38BDF8] border-[#2962FF]/40">
          <CornerDownLeft className="w-4 h-4 inline" /> Enter
        </button>

        {/* Row 2: Combos */}
        <button onClick={() => pressKey('copy')} className="key-btn text-xs font-mono">Ctrl+C</button>
        <button onClick={() => pressKey('paste')} className="key-btn text-xs font-mono">Ctrl+V</button>
        <button onClick={() => pressKey('undo')} className="key-btn text-xs font-mono">Ctrl+Z</button>
        <button onClick={() => pressKey('alttab')} className="key-btn text-xs font-mono text-[#00F0FF]">Alt+Tab</button>

        {/* Row 3: Hyprland & Modifiers */}
        <button onClick={() => pressKey('super')} className="key-btn font-bold text-[#60B01C]">Super</button>
        <button onClick={() => pressKey('launcher')} className="key-btn text-xs font-mono text-purple-400">Super+Space</button>
        <button onClick={() => pressKey('killwin')} className="key-btn text-xs font-mono text-rose-400 border-rose-900/40">Super+Q</button>
        <button onClick={() => pressKey('space')} className="key-btn">Space</button>
      </div>

      {/* Directional Pad */}
      <div className="grid grid-cols-3 gap-2 h-28 shrink-0">
        <div />
        <button onClick={() => pressKey('up')} className="key-btn flex items-center justify-center">
          <ArrowUp className="w-5 h-5" />
        </button>
        <div />

        <button onClick={() => pressKey('left')} className="key-btn flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => pressKey('down')} className="key-btn flex items-center justify-center">
          <ArrowDown className="w-5 h-5" />
        </button>
        <button onClick={() => pressKey('right')} className="key-btn flex items-center justify-center">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
