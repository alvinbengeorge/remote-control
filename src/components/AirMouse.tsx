'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, Crosshair, RotateCcw, ShieldAlert, Sparkles, Volume2, Move, ArrowUpDown } from 'lucide-react';

interface AirMouseProps {
  sendWs: (msg: any) => void;
  connected: boolean;
  theme?: any;
}

export default function AirMouse({ sendWs, connected, theme }: AirMouseProps) {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isAiming, setIsAiming] = useState(false);
  const [sensitivity, setSensitivity] = useState(1.8);
  const [invertedY, setInvertedY] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(0);
  const [currentRoll, setCurrentRoll] = useState(0);

  const isAimingRef = useRef(false);
  const lastAngles = useRef<{ beta: number; gamma: number } | null>(null);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const invertedYRef = useRef(invertedY);
  invertedYRef.current = invertedY;

  // Haptic feedback
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }, []);

  // Request permission on iOS 13+ or detect Android support
  const requestMotionPermission = async () => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionGranted(true);
          vibrate(30);
        } else {
          setPermissionGranted(false);
        }
      } catch (e) {
        console.error('Permission error:', e);
        setPermissionGranted(false);
      }
    } else {
      // Standard Android / Chrome / Firefox
      setPermissionGranted(true);
      vibrate(20);
    }
  };

  // Orientation listener
  useEffect(() => {
    // Check if permission API is needed
    if (typeof window !== 'undefined') {
      if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta;   // Pitch (-180 to 180, front-to-back tilt)
      const gamma = e.gamma; // Roll (-90 to 90, left-to-right tilt)

      if (beta === null || gamma === null) return;

      setCurrentPitch(Math.round(beta));
      setCurrentRoll(Math.round(gamma));

      if (!isAimingRef.current) {
        lastAngles.current = { beta, gamma };
        return;
      }

      if (!lastAngles.current) {
        lastAngles.current = { beta, gamma };
        return;
      }

      // Calculate angular delta
      let dGamma = gamma - lastAngles.current.gamma;
      let dBeta = beta - lastAngles.current.beta;

      // Handle wrapping at extremes
      if (dGamma > 180) dGamma -= 360;
      if (dGamma < -180) dGamma += 360;
      if (dBeta > 180) dBeta -= 360;
      if (dBeta < -180) dBeta += 360;

      lastAngles.current = { beta, gamma };

      // Deadzone threshold to eliminate hand tremor (0.18 degrees)
      const DEADZONE = 0.18;
      if (Math.abs(dGamma) < DEADZONE) dGamma = 0;
      if (Math.abs(dBeta) < DEADZONE) dBeta = 0;

      if (dGamma === 0 && dBeta === 0) return;

      // Scale to mouse pixel coordinates
      const sens = sensitivityRef.current * 16.0;
      const dx = dGamma * sens;
      const dy = (invertedYRef.current ? -dBeta : dBeta) * sens;

      sendWs({
        type: 'mousemove',
        dx,
        dy,
      });
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [sendWs]);

  // Handle Aim Trigger Press / Release
  const handleAimStart = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    isAimingRef.current = true;
    setIsAiming(true);
    vibrate(25);
  };

  const handleAimEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    isAimingRef.current = false;
    setIsAiming(false);
    lastAngles.current = null;
    vibrate(10);
  };

  // Recalibrate current position
  const handleCalibrate = () => {
    lastAngles.current = null;
    vibrate([15, 30]);
  };

  // Air Scroll strip handling
  const scrollStartY = useRef<number | null>(null);
  const handleScrollTouchStart = (e: React.TouchEvent) => {
    scrollStartY.current = e.touches[0].clientY;
  };

  const handleScrollTouchMove = (e: React.TouchEvent) => {
    if (scrollStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - scrollStartY.current;
    if (Math.abs(deltaY) > 6) {
      sendWs({ type: 'wheel', deltaX: 0, deltaY });
      scrollStartY.current = currentY;
    }
  };

  const handleScrollTouchEnd = () => {
    scrollStartY.current = null;
  };

  return (
    <div className="flex flex-col flex-1 w-full select-none touch-none h-full gap-2.5">
      {/* Motion Sensor Permission Banner (iOS) */}
      {permissionGranted === false && (
        <div className="p-3 bg-amber-950/60 border border-amber-600/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Motion Sensors blocked. Tap to authorize iOS Gyro.</span>
          </div>
          <button
            onClick={requestMotionPermission}
            className="px-2.5 py-1 bg-amber-500 text-black font-semibold rounded-lg text-[11px] shrink-0"
          >
            Authorize
          </button>
        </div>
      )}

      {/* Top Header / Gyro HUD */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-xl border p-2.5 flex items-center justify-between text-xs font-mono"
      >
        <div className="flex items-center gap-2">
          <Crosshair className={`w-4 h-4 ${isAiming ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
          <span className="font-semibold text-slate-200">AIR MOUSE</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isAiming ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isAiming ? 'TRACKING' : 'IDLE'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>P: <strong className="text-slate-200">{currentPitch}°</strong></span>
          <span>R: <strong className="text-slate-200">{currentRoll}°</strong></span>
          <button
            onClick={handleCalibrate}
            title="Recalibrate Zero"
            className="p-1 rounded hover:bg-slate-800 active:scale-95 text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Air Controller Deck */}
      <div className="flex-1 flex gap-2.5 min-h-0">
        {/* Left Column: Huge Dead Man's Aim Trigger */}
        <div
          onPointerDown={handleAimStart}
          onPointerUp={handleAimEnd}
          onPointerCancel={handleAimEnd}
          style={{
            backgroundColor: isAiming ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
            borderColor: isAiming ? 'var(--accent-emerald)' : 'var(--border-dim)',
            boxShadow: isAiming ? '0 0 25px rgba(16, 185, 129, 0.25)' : 'none',
          }}
          className={`flex-[3] rounded-2xl border-2 flex flex-col items-center justify-center relative cursor-pointer transition-all duration-150 select-none touch-none ${
            isAiming ? 'scale-[0.99] border-emerald-400' : 'active:scale-[0.99]'
          }`}
        >
          {/* Subtle Radar Circles */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <div className="w-44 h-44 rounded-full border border-current animate-ping" />
            <div className="w-28 h-28 rounded-full border border-current absolute" />
          </div>

          <div className="flex flex-col items-center gap-2 pointer-events-none text-center px-4">
            <Move
              className={`w-10 h-10 transition-transform duration-200 ${
                isAiming ? 'text-emerald-400 scale-125' : 'text-slate-500'
              }`}
            />
            <span className={`text-sm font-bold tracking-wider ${isAiming ? 'text-emerald-300' : 'text-slate-300'}`}>
              {isAiming ? 'RELEASE TO FREEZE' : 'HOLD TO AIM & POINT'}
            </span>
            <span className="text-[10px] text-slate-400 max-w-[190px]">
              Tilt and wave your phone in the air to glide the cursor across your screens.
            </span>
          </div>

          {/* Aim active badge indicator */}
          <div
            className={`absolute bottom-3 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase transition-all ${
              isAiming
                ? 'bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/50'
                : 'bg-black/40 text-slate-400 border border-slate-800'
            }`}
          >
            {isAiming ? '• ACTIVE •' : 'DEAD MAN TRIGGER'}
          </div>
        </div>

        {/* Right Column: Air Scroll Wheel Strip */}
        <div
          onTouchStart={handleScrollTouchStart}
          onTouchMove={handleScrollTouchMove}
          onTouchEnd={handleScrollTouchEnd}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-dim)',
          }}
          className="flex-1 rounded-2xl border flex flex-col items-center justify-between py-4 select-none touch-none relative active:border-[var(--accent-cyan)] shadow-inner"
        >
          <ArrowUpDown className="w-4 h-4 text-[var(--accent-cyan)] opacity-70" />
          <div className="flex flex-col items-center gap-1.5 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
          <span className="text-[10px] font-mono text-slate-400 rotate-90 tracking-widest uppercase whitespace-nowrap">
            SCROLL
          </span>
          <div className="flex flex-col items-center gap-1.5 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
          <ArrowUpDown className="w-4 h-4 text-[var(--accent-cyan)] opacity-70" />
        </div>
      </div>

      {/* Bottom Physical Left & Right Click Triggers */}
      <div className="grid grid-cols-2 gap-3 h-16 shrink-0">
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
          className="active:bg-[var(--accent-primary)] text-white font-semibold rounded-xl border flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
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
          className="active:bg-[var(--accent-emerald)] text-white font-semibold rounded-xl border flex items-center justify-center text-sm shadow-md transition-all active:scale-[0.98]"
        >
          Right Click
        </button>
      </div>

      {/* Settings / Sensitivity Strip */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-dim)',
        }}
        className="rounded-xl border p-2 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0"
      >
        <div className="flex items-center gap-2 flex-1 mr-3">
          <span className="text-[11px] shrink-0">Sens:</span>
          <input
            type="range"
            min="0.6"
            max="3.5"
            step="0.2"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent-primary)] h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-[11px] text-slate-200 shrink-0 w-8 text-right font-bold">
            {sensitivity.toFixed(1)}x
          </span>
        </div>

        <button
          onClick={() => setInvertedY(!invertedY)}
          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
            invertedY
              ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {invertedY ? 'INV Y: ON' : 'INV Y: OFF'}
        </button>
      </div>
    </div>
  );
}
