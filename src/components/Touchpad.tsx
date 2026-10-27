'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MousePointer, ArrowUpDown } from 'lucide-react';

interface TouchpadProps {
  sendWs: (msg: any) => void;
  connected: boolean;
}

export default function Touchpad({ sendWs, connected }: TouchpadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef<Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>>(new Map());
  const [isTwoFinger, setIsTwoFinger] = useState(false);
  const [sensitivity, setSensitivity] = useState(1.3);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
    });

    if (activePointers.current.size >= 2) {
      setIsTwoFinger(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = activePointers.current.get(e.pointerId);
    if (!ptr) return;

    const count = activePointers.current.size;

    if (count === 1) {
      // Single finger drag = mouse move
      const dx = (e.clientX - ptr.x) * sensitivity;
      const dy = (e.clientY - ptr.y) * sensitivity;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        sendWs({ type: 'mousemove', dx, dy });
      }

      ptr.x = e.clientX;
      ptr.y = e.clientY;
    } else if (count >= 2) {
      // Two finger drag = scroll wheel
      const dy = e.clientY - ptr.y;
      if (Math.abs(dy) > 2) {
        sendWs({ type: 'wheel', deltaY: dy * 1.5 });
      }
      ptr.y = e.clientY;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = activePointers.current.get(e.pointerId);
    const count = activePointers.current.size;

    if (ptr) {
      const dt = Date.now() - ptr.startTime;
      const dist = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);

      // Tap detection (quick tap under 200ms and under 8px movement)
      if (dt < 220 && dist < 10) {
        if (count === 1 && !isTwoFinger) {
          // Left click tap
          sendWs({ type: 'click', button: 'left' });
          vibrate(15);
        } else if (count >= 2 || isTwoFinger) {
          // Right click tap
          sendWs({ type: 'click', button: 'right' });
          vibrate([20, 30, 20]);
        }
      }
    }

    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      setIsTwoFinger(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full select-none touch-none h-full">
      {/* Touchpad Area */}
      <div
        ref={padRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex-1 w-full bg-[#0E1522] rounded-2xl border border-[#1C2B42] flex flex-col items-center justify-center relative shadow-inner overflow-hidden active:border-[#2962FF] transition-colors"
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#2962FF_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="flex flex-col items-center gap-2 pointer-events-none opacity-40">
          <MousePointer className="w-8 h-8 text-[#38BDF8]" />
          <span className="text-xs font-mono tracking-wider">
            {isTwoFinger ? '2-FINGER SCROLLING' : 'TOUCHPAD SURFACE'}
          </span>
          <span className="text-[10px] text-slate-400">
            1-Tap: Left Click • 2-Tap: Right Click • 2-Drag: Scroll
          </span>
        </div>

        {/* Status indicator on trackpad */}
        <div className="absolute top-3 right-3 flex items-center gap-2 text-[10px] font-mono px-2 py-1 bg-[#131D2E] rounded-md border border-[#1C2B42] text-slate-400">
          <ArrowUpDown className="w-3 h-3 text-[#00F0FF]" />
          <span>{sensitivity.toFixed(1)}x</span>
        </div>
      </div>

      {/* Bottom Physical Left & Right Click Bars */}
      <div className="grid grid-cols-2 gap-3 mt-3 h-14">
        <button
          onClick={() => {
            sendWs({ type: 'click', button: 'left' });
            vibrate(18);
          }}
          disabled={!connected}
          className="bg-[#131D2E] active:bg-[#2962FF] text-white font-medium rounded-xl border border-[#1C2B42] active:border-[#2962FF] flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
        >
          Left Click
        </button>

        <button
          onClick={() => {
            sendWs({ type: 'click', button: 'right' });
            vibrate([20, 25, 20]);
          }}
          disabled={!connected}
          className="bg-[#131D2E] active:bg-[#60B01C] text-white font-medium rounded-xl border border-[#1C2B42] active:border-[#60B01C] flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
        >
          Right Click
        </button>
      </div>
    </div>
  );
}
