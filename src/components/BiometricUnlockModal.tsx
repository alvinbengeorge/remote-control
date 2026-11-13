'use client';

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Check,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Globe,
} from 'lucide-react';

interface BiometricUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendWs: (msg: any) => void;
  connected: boolean;
}

export default function BiometricUnlockModal({
  isOpen,
  onClose,
  sendWs,
  connected,
}: BiometricUnlockModalProps) {
  const [scanning, setScanning] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [isRawIp, setIsRawIp] = useState(false);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCertGuide, setShowCertGuide] = useState(false);

  const vibrate = (p: number | number[] = 20) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(p); } catch (_) {}
    }
  };

  useEffect(() => {
    try {
      const pwd = localStorage.getItem('ag_remote_pwd');
      if (pwd) setSavedPassword(pwd);
    } catch (_) {}

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const rawIp = /^[0-9.]+$/.test(host);
      setIsRawIp(rawIp);

      // WebAuthn strictly requires BOTH a Secure Context (https) AND a valid Domain Name (not a raw IP)
      const secure = Boolean(window.isSecureContext) && !rawIp;
      setIsSecure(secure);

      if (
        secure &&
        window.PublicKeyCredential &&
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ) {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then((available) => setHasWebAuthn(Boolean(available)))
          .catch(() => setHasWebAuthn(false));
      } else {
        setHasWebAuthn(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Execute actual unlock dispatch to Hyprland
  const triggerUnlock = (method: string) => {
    setScanning(false);
    setUnlocked(true);
    vibrate([40, 60, 40]);

    sendWs({
      type: 'biometric_unlock',
      method,
      password: savedPassword || undefined,
    });

    setTimeout(() => {
      setUnlocked(false);
      onClose();
    }, 1200);
  };

  // Hardware WebAuthn Phone Biometric Sensor Flow (TouchID / Android Fingerprint / FaceID)
  const handleHardwareWebAuthn = async () => {
    if (unlocked || scanning) return;
    setErrorMsg('');
    setScanning(true);
    vibrate(25);

    try {
      const host = window.location.hostname;

      // If user is accessing via raw IP, redirect to .nip.io domain
      if (/^[0-9.]+$/.test(host)) {
        const targetUrl = `https://${host}.nip.io:3457`;
        window.location.href = targetUrl;
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Check if we already have a registered credential ID stored in browser
      const savedCredId = localStorage.getItem('ag_webauthn_cred_id');

      if (savedCredId && navigator.credentials && navigator.credentials.get) {
        try {
          const rawId = Uint8Array.from(atob(savedCredId), (c) => c.charCodeAt(0));
          await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: host,
              userVerification: 'required',
              allowCredentials: [
                {
                  id: rawId,
                  type: 'public-key',
                  transports: ['internal'],
                },
              ],
              timeout: 60000,
            },
          });
          triggerUnlock('phone_hardware_biometric');
          return;
        } catch (getErr: any) {
          console.warn('WebAuthn get failed, attempting credential re-registration:', getErr);
        }
      }

      // First time enrollment / registration using native device authenticator
      if (navigator.credentials && navigator.credentials.create) {
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const newCred: any = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'Antigravity Workstation Remote',
              id: host,
            },
            user: {
              id: userId,
              name: 'alvin',
              displayName: 'Alvin (Workstation)',
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },   // ES256
              { alg: -257, type: 'public-key' },  // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform', // Strictly Native Phone Sensor (Fingerprint / FaceID)
              userVerification: 'required',
              requireResidentKey: false,
            },
            timeout: 60000,
            attestation: 'none',
          },
        });

        if (newCred && newCred.rawId) {
          const rawStr = btoa(String.fromCharCode(...new Uint8Array(newCred.rawId)));
          localStorage.setItem('ag_webauthn_cred_id', rawStr);
        }

        triggerUnlock('phone_hardware_biometric');
        return;
      }

      throw new Error('WebAuthn credentials API not available on this browser');
    } catch (err: any) {
      console.warn('Phone biometric error:', err);
      setScanning(false);
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Authentication canceled or domain mismatch (W3C restricts raw IPs)');
      } else {
        setErrorMsg(err.message || 'Biometric authentication failed');
      }
    }
  };

  const handleSavePassword = (val: string) => {
    setSavedPassword(val);
    try {
      localStorage.setItem('ag_remote_pwd', val);
    } catch (_) {}
  };

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '192.168.1.174';
  const nipHost = isRawIp ? `${currentHost}.nip.io` : currentHost;
  const nipHttpsUrl = `https://${nipHost}:3457`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-sm rounded-3xl border flex flex-col overflow-hidden shadow-2xl text-white relative max-h-[92dvh]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-dim)',
          boxShadow: '0 0 32px var(--border-glow)',
        }}
      >
        {/* Top Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border-dim)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-active)',
              }}
            >
              <Fingerprint className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
                Phone Biometric Unlock
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md border ${
                    isSecure
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-950/40 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isSecure ? 'HTTPS SECURE' : isRawIp ? 'RAW IP (NEEDS DOMAIN)' : 'HTTP INSECURE'}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">Native Android & iOS Fingerprint / FaceID</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center border border-transparent hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto no-scrollbar">
          {/* IP / Insecure Context Warning Banner */}
          {!isSecure && (
            <div className="w-full bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3 text-left flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{isRawIp ? 'WebAuthn Requires Domain (Not Raw IP)' : 'HTTPS Connection Required'}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isRawIp ? (
                  <>
                    The W3C WebAuthn standard strictly forbids raw IP addresses (which causes <code className="text-amber-300">NotAllowedError</code>). Tap below to open via your local domain:
                  </>
                ) : (
                  <>
                    Mobile browsers strictly disable hardware biometric sensors over plain HTTP.
                  </>
                )}
              </p>
              
              <div className="flex flex-col gap-2 pt-1">
                <a
                  href={nipHttpsUrl}
                  className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Open via {nipHost}</span>
                </a>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="/rootCA.crt"
                    download="rootCA.crt"
                    className="text-[10px] font-mono text-cyan-300 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Local Root CA</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowCertGuide(!showCertGuide)}
                    className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-0.5"
                  >
                    <span>Setup Guide</span>
                    {showCertGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showCertGuide && (
                  <div className="bg-black/40 rounded-xl p-2.5 text-[10px] text-slate-300 font-mono space-y-1.5 border border-slate-800">
                    <p className="font-bold text-cyan-300">📱 1-Minute Local SSL Trust Setup:</p>
                    <p>1. Tap <strong className="text-white">Download Local Root CA</strong> above.</p>
                    <p>2. <strong className="text-white">Android:</strong> Settings → Security → More Security Settings → Install a Certificate → CA certificate → Choose downloaded <code className="text-cyan-200">rootCA.crt</code>.</p>
                    <p>3. <strong className="text-white">iPhone:</strong> Tap file in Safari → Install Profile in Settings → About → Certificate Trust Settings → Enable full trust.</p>
                    <p>4. Open <code className="text-emerald-300">{nipHttpsUrl}</code> for full biometric unlock!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Biometric Interactive Core Pad */}
          <div className="relative flex items-center justify-center my-1">
            {/* Pulsing Ripple Rings */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-700 ${
                unlocked
                  ? 'bg-emerald-500/20 scale-125'
                  : scanning
                  ? 'bg-cyan-500/20 scale-110 animate-ping'
                  : 'bg-transparent'
              }`}
            />

            {/* Main Native Biometric Button */}
            <button
              type="button"
              onClick={handleHardwareWebAuthn}
              disabled={!connected || unlocked || !isSecure}
              style={{
                backgroundColor: unlocked
                  ? 'rgba(16, 185, 129, 0.25)'
                  : scanning
                  ? 'var(--bg-hover)'
                  : isSecure
                  ? 'var(--bg-card)'
                  : 'rgba(30, 41, 59, 0.5)',
                borderColor: unlocked
                  ? '#10B981'
                  : scanning
                  ? 'var(--border-active)'
                  : isSecure
                  ? '#00F0FF'
                  : 'var(--border-dim)',
              }}
              className="w-32 h-32 rounded-full border-2 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all relative overflow-hidden"
            >
              {unlocked ? (
                <Check className="w-14 h-14 text-emerald-400 animate-in zoom-in-75 duration-200" />
              ) : (
                <>
                  <Fingerprint
                    className={`w-14 h-14 transition-colors ${
                      scanning
                        ? 'text-cyan-400 animate-pulse'
                        : isSecure
                        ? 'text-cyan-300'
                        : 'text-slate-500'
                    }`}
                  />
                  {scanning && (
                    <span className="absolute bottom-3 text-[9px] font-mono text-cyan-300 animate-pulse">
                      Awaiting Sensor...
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Status Label */}
          <div>
            <h3
              className={`font-bold text-base transition-colors ${
                unlocked
                  ? 'text-emerald-400'
                  : isSecure
                  ? 'text-white'
                  : 'text-slate-400'
              }`}
            >
              {unlocked
                ? 'WORKSTATION UNLOCKED'
                : scanning
                ? 'Touch Phone Fingerprint Sensor'
                : isSecure
                ? 'Tap to Authenticate'
                : 'Domain Setup Required'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {unlocked
                ? 'Hyprlock session dismissed'
                : scanning
                ? 'Waiting for native biometric response...'
                : isSecure
                ? 'Prompts native Android Fingerprint / Apple FaceID'
                : isRawIp
                ? 'Tap "Open via Domain" above to enable sensor'
                : 'Switch to HTTPS to activate native sensor'}
            </p>
            {errorMsg && <p className="text-xs text-amber-400 mt-1 font-mono">{errorMsg}</p>}
          </div>

          {/* Action Trigger Button if Secure */}
          {isSecure && !unlocked && (
            <button
              type="button"
              onClick={handleHardwareWebAuthn}
              disabled={scanning}
              style={{ backgroundColor: 'var(--accent-primary)' }}
              className="w-full py-3 rounded-2xl font-bold text-xs text-white flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{scanning ? 'Touch Phone Sensor...' : 'Scan Fingerprint (Phone Biometrics)'}</span>
            </button>
          )}

          {/* Password Vault Fallback Toggle */}
          <div className="w-full pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPasswordBox(!showPasswordBox)}
              className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto"
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
              <span>{showPasswordBox ? 'Hide Fallback Password' : 'PAM Password Vault (Optional)'}</span>
            </button>

            {showPasswordBox && (
              <div className="mt-2.5 flex flex-col gap-1.5 text-left">
                <span className="text-[10px] text-slate-400 font-mono">
                  Saved locally in phone storage to auto-type for PAM login managers:
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={savedPassword}
                    onChange={(e) => handleSavePassword(e.target.value)}
                    placeholder="Linux user password"
                    className="w-full bg-black/50 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
