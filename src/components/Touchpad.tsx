'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MousePointer, ArrowUpDown, Crosshair, Sparkles } from 'lucide-react';
import AirMouse from './AirMouse';

interface TouchpadProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
  media?: any;
}

export default function Touchpad({ sendWs, connected, theme, media }: TouchpadProps) {
  const [inputMode, setInputMode] = useState<'trackpad' | 'airmouse'>('trackpad');
  const padRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef<Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>>(new Map());
  const [isTwoFinger, setIsTwoFinger] = useState(false);
  const wasMultiTouch = useRef(false);
  const [sensitivity, setSensitivity] = useState(1.4);

  const isPlaying = media?.status === 'Playing';

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    activePointers.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
    });

    if (activePointers.current.size >= 2) {
      wasMultiTouch.current = true;
      setIsTwoFinger(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = activePointers.current.get(e.pointerId);
    if (!ptr) return;

    const count = activePointers.current.size;

    if (count === 1) {
      // If we recently released from a 2-finger gesture, don't jerk the cursor
      if (wasMultiTouch.current) {
        ptr.x = e.clientX;
        ptr.y = e.clientY;
        return;
      }

      // Single finger drag = mouse move
      const dx = (e.clientX - ptr.x) * sensitivity;
      const dy = (e.clientY - ptr.y) * sensitivity;

      if (dx !== 0 || dy !== 0) {
        sendWs({ type: 'mousemove', dx, dy });
        ptr.x = e.clientX;
        ptr.y = e.clientY;
      }
    } else if (count >= 2) {
      // Two finger drag = smooth scroll wheel
      const dx = (e.clientX - ptr.x) / count;
      const dy = (e.clientY - ptr.y) / count;

      ptr.x = e.clientX;
      ptr.y = e.clientY;

      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
        sendWs({ type: 'wheel', deltaX: dx, deltaY: dy });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = activePointers.current.get(e.pointerId);
    const count = activePointers.current.size;

    if (ptr) {
      const dt = Date.now() - ptr.startTime;
      const dist = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);

      // Tap detection (quick tap under 220ms and minimal travel)
      if (dt < 220 && dist < 10) {
        if (!wasMultiTouch.current && count === 1) {
          // Left click tap (single finger)
          sendWs({ type: 'click', button: 'left' });
          vibrate(15);
        } else if (wasMultiTouch.current || count >= 2) {
          // Right click tap (two fingers)
          sendWs({ type: 'click', button: 'right' });
          vibrate([20, 30, 20]);
        }
      }
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      setIsTwoFinger(false);
      wasMultiTouch.current = false;
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full select-none touch-none h-full gap-2">
      {/* Input Mode Selector Pill: Trackpad vs Air Mouse */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="flex items-center p-1 rounded-xl border shrink-0 text-xs font-mono"
      >
        <button
          onClick={() => {
            setInputMode('trackpad');
            vibrate(10);
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            inputMode === 'trackpad'
              ? 'bg-[var(--accent-primary)] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Touchpad</span>
        </button>

        <button
          onClick={() => {
            setInputMode('airmouse');
            vibrate(15);
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            inputMode === 'airmouse'
              ? 'bg-[var(--accent-primary)] text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Air Mouse 🪄</span>
        </button>
      </div>

      {inputMode === 'airmouse' ? (
        <AirMouse sendWs={sendWs} connected={connected} theme={theme} />
      ) : (
        <>
          {/* Touchpad Area */}
          <div
            ref={padRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              touchAction: 'none',
              backgroundColor: 'var(--bg-surface)',
              borderColor: isPlaying ? 'var(--border-active)' : 'var(--border-dim)',
              boxShadow: isPlaying ? '0 0 20px var(--border-glow)' : 'none',
            }}
            className="flex-1 w-full rounded-2xl border flex flex-col items-center justify-center relative shadow-inner overflow-hidden active:border-[var(--border-active)] transition-all duration-300 touch-none"
          >
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(var(--accent-primary)_1px,transparent_1px)] [background-size:24px_24px]"
            />

            <div className="flex flex-col items-center gap-2 pointer-events-none opacity-40">
              <MousePointer className="w-8 h-8 text-[var(--accent-sky)]" />
              <span className="text-xs font-mono tracking-wider">
                {isTwoFinger ? '2-FINGER SCROLLING' : 'TOUCHPAD SURFACE'}
              </span>
              <span className="text-[10px] text-slate-400">
                1-Tap: Left Click • 2-Tap: Right Click • 2-Drag: Scroll
              </span>
            </div>

            {/* Status indicator on trackpad */}
            <div
              className="absolute top-3 right-3 flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded-md border text-slate-300"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
            >
              <ArrowUpDown className="w-3 h-3 text-[var(--accent-cyan)]" />
              <span>{sensitivity.toFixed(1)}x</span>
            </div>
          </div>

          {/* Bottom Physical Left & Right Click Bars */}
          <div className="grid grid-cols-2 gap-3 h-14 shrink-0">
            <button
              onClick={() => {
                sendWs({ type: 'click', button: 'left' });
                vibrate(18);
              }}
              disabled={!connected}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
              className="active:bg-[var(--accent-primary)] text-white font-medium rounded-xl border flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
            >
              Left Click
            </button>

            <button
              onClick={() => {
                sendWs({ type: 'click', button: 'right' });
                vibrate([20, 25, 20]);
              }}
              disabled={!connected}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
              className="active:bg-[var(--accent-emerald)] text-white font-medium rounded-xl border flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
            >
              Right Click
            </button>
          </div>
        </>
      )}
    </div>
  );
}
