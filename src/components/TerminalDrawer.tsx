'use client';

import React, { useState } from 'react';
import { Terminal as TermIcon, Play, Trash2 } from 'lucide-react';

interface TerminalDrawerProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  cmdResult: { stdout?: string; stderr?: string; success?: boolean } | null;
}

export default function TerminalDrawer({ sendWs, connected, cmdResult }: TerminalDrawerProps) {
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const handleRun = (commandToRun?: string) => {
    const c = commandToRun || cmd;
    if (!c.trim()) return;
    sendWs({ type: 'cmd', command: c });
    setHistory((prev) => [c, ...prev.slice(0, 8)]);
    if (!commandToRun) setCmd('');
  };

  const PRESET_COMMANDS = [
    { label: 'Docker PS', cmd: 'docker ps --format "table {{.Names}}\t{{.Status}}"' },
    { label: 'System Uptime', cmd: 'uptime -p' },
    { label: 'Memory', cmd: 'free -h' },
    { label: 'Git Status', cmd: 'git status -s' },
    { label: 'Lock Session', cmd: 'hyprlock' },
    { label: 'Audio Sinks', cmd: 'wpctl status | head -n 25' },
  ];

  return (
    <div className="flex flex-col flex-1 w-full gap-3 overflow-hidden select-none h-full">
      {/* Preset Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
        {PRESET_COMMANDS.map((p) => (
          <button
            key={p.label}
            onClick={() => handleRun(p.cmd)}
            disabled={!connected}
            className="px-3 py-1.5 rounded-lg bg-[#0E1522] border border-[#1C2B42] text-xs font-mono text-slate-300 active:border-[#2962FF] shrink-0"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="flex gap-2 shrink-0">
        <div className="flex-1 flex items-center bg-[#0E1522] border border-[#1C2B42] rounded-xl px-3 py-2 text-sm">
          <span className="text-[#38BDF8] font-mono mr-2">$</span>
          <input
            type="text"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="Run bash command on host..."
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
          />
        </div>
        <button
          onClick={() => handleRun()}
          disabled={!connected || !cmd.trim()}
          className="bg-[#2962FF] disabled:opacity-40 text-white px-4 rounded-xl flex items-center justify-center"
        >
          <Play className="w-4 h-4" />
        </button>
      </div>

      {/* Output Console */}
      <div className="flex-1 bg-[#06080E] border border-[#1C2B42] rounded-xl p-3 font-mono text-xs overflow-y-auto text-slate-300">
        {cmdResult ? (
          <div>
            {cmdResult.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-400">{cmdResult.stdout}</pre>
            )}
            {cmdResult.stderr && (
              <pre className="whitespace-pre-wrap text-rose-400 mt-2">{cmdResult.stderr}</pre>
            )}
            {!cmdResult.stdout && !cmdResult.stderr && (
              <span className="text-slate-500">Command finished with no output.</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <TermIcon className="w-4 h-4" />
            <span>Output will appear here...</span>
          </div>
        )}
      </div>
    </div>
  );
}
