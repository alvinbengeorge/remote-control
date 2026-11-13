'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Send,
  CornerDownLeft,
  RotateCcw,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Command,
} from 'lucide-react';

interface InteractiveTerminalProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
}

// Convert ANSI escape codes into colored HTML spans
function parseAnsi(text: string): string {
  if (!text) return '';

  const ANSI_COLOR_MAP: Record<number, string> = {
    0: '</span>', // Reset
    1: '<span class="font-bold">',
    2: '<span class="opacity-70">',
    30: '<span class="text-zinc-500">',
    31: '<span class="text-rose-400">',
    32: '<span class="text-emerald-400">',
    33: '<span class="text-amber-300">',
    34: '<span class="text-sky-400">',
    35: '<span class="text-purple-400">',
    36: '<span class="text-cyan-300">',
    37: '<span class="text-slate-200">',
    90: '<span class="text-zinc-500">',
    91: '<span class="text-rose-300">',
    92: '<span class="text-emerald-300">',
    93: '<span class="text-yellow-200">',
    94: '<span class="text-sky-300">',
    95: '<span class="text-purple-300">',
    96: '<span class="text-cyan-200">',
    97: '<span class="text-white">',
  };

  // Escape raw HTML entities
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Replace ANSI color sequences
  escaped = escaped.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const parts = codes.split(';').map(Number);
    let html = '';
    for (const code of parts) {
      if (code === 0) {
        html += '</span>';
      } else if (ANSI_COLOR_MAP[code]) {
        html += ANSI_COLOR_MAP[code];
      }
    }
    return html;
  });

  // Strip OSC sequences (Operating System Commands, e.g. systemd/bash shell integration markers)
  escaped = escaped.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
  escaped = escaped.replace(/\][0-9]{4};[^\n\r]*[\x07\x1b\\]/g, '');

  // Strip remaining unhandled ANSI escape sequences (e.g. cursor moves, private modes)
  escaped = escaped.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');

  return escaped;
}

const PRESET_COMMANDS = [
  { label: 'ls -la (~)', cmd: 'ls -la\n' },
  { label: 'git status', cmd: 'git status\n' },
  { label: 'top summary', cmd: 'top -b -n 1 | head -n 20\n' },
  { label: 'docker ps', cmd: 'docker ps\n' },
  { label: 'remote logs', cmd: 'journalctl --user -u antigravity-remote -n 25 --no-pager\n' },
  { label: 'quickshell logs', cmd: 'quickshell log -c antigravity -t 25\n' },
];

export default function InteractiveTerminal({ sendWs, connected }: InteractiveTerminalProps) {
  const [output, setOutput] = useState<string>('');
  const [inputCmd, setInputCmd] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }, []);

  // Request terminal session initialization on mount
  useEffect(() => {
    if (connected) {
      sendWs({ type: 'terminal_init' });
    }
  }, [connected, sendWs]);

  // Handle incoming terminal output from WebSocket
  useEffect(() => {
    const handleWsEvent = (e: CustomEvent) => {
      const data = e.detail;
      if (data && data.type === 'terminal_output') {
        setOutput((prev) => {
          const next = prev + data.data;
          // Keep maximum ~60,000 characters in memory
          if (next.length > 60000) return next.slice(-45000);
          return next;
        });
      } else if (data && data.type === 'terminal_closed') {
        setOutput((prev) => prev + '\r\n\x1b[31m[Session terminated. Tap Reset to respawn in ~]\x1b[0m\r\n');
      }
    };

    window.addEventListener('ag_remote_event' as any, handleWsEvent);
    return () => window.removeEventListener('ag_remote_event' as any, handleWsEvent);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  // Execute typed command
  const handleSendCommand = (cmdToSend?: string) => {
    const cmd = cmdToSend !== undefined ? cmdToSend : inputCmd;
    if (!cmd && cmdToSend === undefined) return;

    vibrate(15);
    const finalCmd = cmd.endsWith('\n') ? cmd : cmd + '\n';
    sendWs({
      type: 'terminal_input',
      data: finalCmd,
    });

    if (cmd.trim()) {
      setHistory((prev) => [cmd.trim(), ...prev.filter((h) => h !== cmd.trim())].slice(0, 30));
    }

    setInputCmd('');
    setHistoryIdx(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  // Signal dispatch (Ctrl+C, Ctrl+Z)
  const handleSignal = (signal: 'SIGINT' | 'SIGTSTP' | 'EOF') => {
    vibrate(20);
    sendWs({
      type: 'terminal_signal',
      signal,
    });
  };

  // Restart shell in ~
  const handleRestart = () => {
    vibrate([20, 40]);
    setOutput('');
    sendWs({ type: 'terminal_restart' });
  };

  // Clear client buffer
  const handleClear = () => {
    setOutput('');
    vibrate(10);
  };

  // History navigation
  const navigateHistory = (direction: 'up' | 'down') => {
    vibrate(10);
    if (history.length === 0) return;

    let nextIdx = historyIdx;
    if (direction === 'up') {
      nextIdx = Math.min(history.length - 1, historyIdx + 1);
    } else {
      nextIdx = Math.max(-1, historyIdx - 1);
    }

    setHistoryIdx(nextIdx);
    if (nextIdx === -1) {
      setInputCmd('');
    } else {
      setInputCmd(history[nextIdx]);
    }
  };

  // Quick symbol helper
  const insertSymbol = (sym: string) => {
    setInputCmd((prev) => prev + sym);
    vibrate(10);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full gap-2 select-none min-h-0">
      {/* ── TOP HEADER / TOOLBAR ────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="p-2 rounded-xl border flex items-center justify-between text-xs font-mono shrink-0"
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="font-bold text-slate-200">INTERACTIVE SHELL</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            ~ (home)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClear}
            title="Clear Screen"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRestart}
            title="Respawn Shell in ~"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all text-[11px]"
          >
            <RotateCcw className="w-3 h-3 text-[var(--accent-cyan)]" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── PRESET COMMANDS BAR ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
        {PRESET_COMMANDS.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSendCommand(preset.cmd)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-[11px] font-mono whitespace-nowrap active:scale-95 transition-all shrink-0"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── TERMINAL DISPLAY SCREEN ─────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#0a0d14',
          borderColor: 'var(--border-dim)',
        }}
        className="flex-1 w-full rounded-2xl border p-3 font-mono text-[11px] text-slate-200 overflow-y-auto no-scrollbar whitespace-pre-wrap break-all shadow-inner select-text relative"
      >
        <div
          dangerouslySetInnerHTML={{
            __html: parseAnsi(output || 'Starting shell session in ~ ...\r\n'),
          }}
        />
        <div ref={terminalEndRef} />
      </div>

      {/* ── MOBILE ACCESSORY KEYS BAR ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0 font-mono text-xs">
        {/* Ctrl+C (SIGINT) */}
        <button
          onClick={() => handleSignal('SIGINT')}
          className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 border border-rose-700/40 text-rose-300 font-bold active:scale-95 transition-all shrink-0"
        >
          Ctrl+C
        </button>

        {/* Tab */}
        <button
          onClick={() => handleSendCommand('\t')}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 font-bold active:scale-95 transition-all shrink-0"
        >
          Tab ⇥
        </button>

        {/* History Nav */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigateHistory('up')}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 active:scale-95"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigateHistory('down')}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 active:scale-95"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick symbol keys */}
        {['~', '/', '|', '-', '&', '..'].map((sym) => (
          <button
            key={sym}
            onClick={() => insertSymbol(sym)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 active:scale-95 transition-all shrink-0"
          >
            {sym}
          </button>
        ))}
      </div>

      {/* ── INTERACTIVE COMMAND INPUT BAR ───────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendCommand();
        }}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-2xl border p-2 flex items-center gap-2 shrink-0 shadow-md"
      >
        <span className="text-emerald-400 font-mono text-xs font-bold pl-1">$</span>
        <input
          ref={inputRef}
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          placeholder="Type command... (e.g. cd Desktop, nvim, git)"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={!connected || !inputCmd}
          style={{
            backgroundColor: inputCmd ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
          }}
          className="p-2 rounded-xl text-white font-medium disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
