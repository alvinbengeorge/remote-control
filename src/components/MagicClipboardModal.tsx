'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Clipboard,
  Copy,
  Check,
  Send,
  RefreshCw,
  UploadCloud,
  Camera,
  FolderOpen,
  Smartphone,
  Monitor,
  FileText,
  X,
  Type,
  Sparkles,
  Download,
  Share2,
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';

export interface ClipboardItemData {
  type: 'image' | 'text' | 'empty';
  mimeType?: string;
  size?: number;
  dimensions?: string;
  text?: string;
  imageUrl?: string;
  dataUrl?: string;
  timestamp?: number;
}

interface MagicClipboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendWs: (msg: any) => void;
  connected: boolean;
  workstationClipboard: string | ClipboardItemData | any;
  onRefreshClipboard?: () => void;
}

// Convert any image blob to PNG format for universal ClipboardItem compatibility
async function convertBlobToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    if (blob.type === 'image/png') return resolve(blob);
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(blob);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        resolve(b || blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MagicClipboardModal({
  isOpen,
  onClose,
  sendWs,
  connected,
  workstationClipboard,
  onRefreshClipboard,
}: MagicClipboardModalProps) {
  const [phoneText, setPhoneText] = useState('');
  const [copiedToPhone, setCopiedToPhone] = useState(false);
  const [copyStatusMsg, setCopyStatusMsg] = useState('');
  const [sentToPc, setSentToPc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploadedFile, setLastUploadedFile] = useState<any>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const vibrate = (p: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(p); } catch (_) {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      sendWs({ type: 'get_clipboard' });
      if (onRefreshClipboard) onRefreshClipboard();
    }
  }, [isOpen, sendWs, onRefreshClipboard]);

  if (!isOpen) return null;

  // Normalize clipboard item representation
  const clip: ClipboardItemData =
    typeof workstationClipboard === 'string'
      ? { type: 'text', text: workstationClipboard }
      : (workstationClipboard || { type: 'empty', text: '' });

  const isImage = clip.type === 'image';
  const hasText = clip.type === 'text' && !!clip.text;
  const imageSource = clip.dataUrl || clip.imageUrl || '/api/clipboard/image';

  // 1. Copy Workstation Image to Phone System Clipboard as an actual image
  const handleCopyImageToPhone = async () => {
    try {
      const res = await fetch(imageSource);
      const blob = await res.blob();

      if (typeof window !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
        const pngBlob = await convertBlobToPng(blob);
        const item = new ClipboardItem({ 'image/png': pngBlob });
        await navigator.clipboard.write([item]);

        setCopiedToPhone(true);
        setCopyStatusMsg('Copied image to phone clipboard!');
        vibrate([20, 50, 20]);
        setTimeout(() => {
          setCopiedToPhone(false);
          setCopyStatusMsg('');
        }, 2500);
        return;
      }

      // Fallback: Download
      handleDownloadImage();
      setCopiedToPhone(true);
      setCopyStatusMsg('Saved image to phone!');
      setTimeout(() => {
        setCopiedToPhone(false);
        setCopyStatusMsg('');
      }, 2500);
    } catch (err) {
      console.warn('Failed writing image to clipboard, triggering download fallback:', err);
      handleDownloadImage();
      setCopiedToPhone(true);
      setCopyStatusMsg('Downloaded image to device!');
      setTimeout(() => {
        setCopiedToPhone(false);
        setCopyStatusMsg('');
      }, 2500);
    }
  };

  // 2. Download Screenshot Image directly onto phone
  const handleDownloadImage = () => {
    const a = document.createElement('a');
    a.href = clip.imageUrl || clip.dataUrl || '/api/clipboard/download';
    a.download = `workstation_screenshot_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    vibrate(20);
  };

  // 3. Share Screenshot via Mobile Native Share Sheet (WhatsApp, Telegram, etc.)
  const handleShareImage = async () => {
    try {
      const res = await fetch(imageSource);
      const blob = await res.blob();
      const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Workstation Screenshot',
          files: [file],
        });
        vibrate(20);
      }
    } catch (_) {}
  };

  // 4. Copy Text to Phone Clipboard
  const handleCopyTextToPhone = async () => {
    if (!clip.text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clip.text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = clip.text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedToPhone(true);
      setCopyStatusMsg('Copied text to phone!');
      vibrate([20, 40, 20]);
      setTimeout(() => {
        setCopiedToPhone(false);
        setCopyStatusMsg('');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text to phone:', err);
    }
  };

  // 5. Paste from Phone Clipboard into input or send image
  const handlePasteFromPhone = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            setUploading(true);
            setUploadProgress(40);
            await fetch('/api/clipboard/set-image', {
              method: 'POST',
              headers: { 'Content-Type': imgType },
              body: blob,
            });
            setUploadProgress(100);
            vibrate([25, 50, 25]);
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
            }, 400);
            sendWs({ type: 'get_clipboard' });
            return;
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPhoneText(text);
          vibrate(20);
        }
      }
    } catch (_) {}
  };

  // 6. Send Phone Text to Workstation Clipboard (wl-copy)
  const handleSendToPcClipboard = () => {
    if (!phoneText.trim()) return;
    sendWs({ type: 'set_clipboard', text: phoneText });
    setSentToPc(true);
    vibrate([20, 50, 20]);
    setTimeout(() => setSentToPc(false), 2000);
  };

  // 7. Type directly onto active Workstation screen (ydotool)
  const handleTypeOntoPc = () => {
    if (!phoneText) return;
    sendWs({ type: 'type', text: phoneText });
    vibrate(25);
  };

  // 8. Handle File / Photo Drop
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(15);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-filename': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      setUploadProgress(90);
      const data = await res.json();
      setUploadProgress(100);

      if (data.success) {
        setLastUploadedFile(data);
        vibrate([30, 60, 30]);
        sendWs({ type: 'get_clipboard' });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      e.target.value = '';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className="w-full max-w-md rounded-3xl border flex flex-col max-h-[92dvh] overflow-hidden shadow-2xl text-white"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-dim)',
            boxShadow: '0 0 32px var(--border-glow)',
          }}
        >
          {/* Modal Header */}
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
                <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-sky)' }} />
              </div>
              <div>
                <h2 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
                  Magic Clipboard
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#2962FF]/20 text-[#38BDF8] border border-[#2962FF]/30">
                    LIVE
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400">Phone ⇄ Linux Workstation Bi-Directional</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-transparent hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 flex flex-col gap-3.5">
            {/* ── 1. WORKSTATION TO PHONE (READ PC CLIPBOARD) ──────────────── */}
            <div
              className="rounded-2xl p-3 border flex flex-col gap-2.5 shrink-0"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-sky-400" />
                  <span>Workstation Clipboard</span>
                  {isImage && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Screenshot / Image
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sendWs({ type: 'get_clipboard' });
                    vibrate(15);
                  }}
                  className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 active:scale-95"
                  title="Fetch Latest from PC"
                >
                  <RefreshCw className="w-3 h-3 text-sky-400" />
                  <span>Refresh</span>
                </button>
              </div>

              {/* 📸 IMAGE / SCREENSHOT PREVIEW CARD */}
              {isImage ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950/80 flex flex-col items-center justify-center group cursor-pointer"
                    onClick={() => setShowLightbox(true)}
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    <img
                      src={imageSource}
                      alt="Workstation Clipboard Screenshot"
                      className="max-h-[190px] w-auto max-w-full object-contain rounded-lg p-1 transition-transform group-hover:scale-[1.02]"
                    />

                    {/* Metadata Chip Overlay */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-300">
                      <ImageIcon className="w-3 h-3" />
                      <span>{clip.dimensions || 'Screenshot'}</span>
                      {clip.size ? <span>• {formatBytes(clip.size)}</span> : null}
                    </div>

                    {/* Expand icon overlay */}
                    <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white">
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Image Action Buttons */}
                  <div className="grid grid-cols-1 gap-2">
                    {/* Primary Button: Write to Phone Clipboard as actual image */}
                    <button
                      type="button"
                      onClick={handleCopyImageToPhone}
                      style={{
                        backgroundColor: copiedToPhone ? 'rgba(16, 185, 129, 0.25)' : 'var(--accent-primary)',
                        borderColor: copiedToPhone ? '#10B981' : 'var(--accent-primary)',
                        color: copiedToPhone ? '#34D399' : '#FFFFFF',
                      }}
                      className="py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                    >
                      {copiedToPhone ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>{copyStatusMsg || 'Image in Phone Clipboard!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Image to Phone Clipboard</span>
                        </>
                      )}
                    </button>

                    {/* Secondary Actions: Save / Download & Share */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadImage}
                        className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>Save to Photos</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareImage}
                        className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Share2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Share Image</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : hasText ? (
                /* 📝 TEXT PREVIEW BOX */
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl p-2.5 bg-black/40 border border-slate-800/80 font-mono text-xs text-slate-200 min-h-[58px] max-h-[110px] overflow-y-auto no-scrollbar break-all select-text">
                    <span>{clip.text}</span>
                  </div>

                  <button
                    onClick={handleCopyTextToPhone}
                    style={{
                      backgroundColor: copiedToPhone ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface)',
                      borderColor: copiedToPhone ? '#10B981' : 'var(--border-dim)',
                      color: copiedToPhone ? '#34D399' : '#FFFFFF',
                    }}
                    className="py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    {copiedToPhone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{copyStatusMsg || 'Copied to Phone Clipboard!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-sky-400" />
                        <span>Copy Text to Phone</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* 📭 EMPTY STATE */
                <div className="rounded-xl p-3 bg-black/30 border border-slate-800/60 font-mono text-xs text-slate-500 italic text-center">
                  Workstation clipboard is empty.
                </div>
              )}
            </div>

            {/* ── 2. PHONE TO WORKSTATION (SEND TO PC) ──────────────────────── */}
            <div
              className="rounded-2xl p-3 border flex flex-col gap-2 shrink-0"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Send to Workstation</span>
                </div>
                <button
                  type="button"
                  onClick={handlePasteFromPhone}
                  className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 active:scale-95"
                  title="Paste Phone text or image directly"
                >
                  <Clipboard className="w-3 h-3 text-emerald-400" />
                  <span>Paste Phone Clip</span>
                </button>
              </div>

              <textarea
                rows={2}
                value={phoneText}
                onChange={(e) => setPhoneText(e.target.value)}
                placeholder="Type or paste text to send to PC clipboard or screen..."
                className="w-full bg-black/40 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#2962FF] font-mono resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSendToPcClipboard}
                  disabled={!connected || !phoneText.trim()}
                  style={{
                    backgroundColor: sentToPc ? 'rgba(16, 185, 129, 0.25)' : 'var(--accent-primary)',
                    borderColor: sentToPc ? '#10B981' : 'var(--accent-primary)',
                  }}
                  className="py-2 px-3 rounded-xl border text-xs font-medium text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
                >
                  {sentToPc ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied on PC!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Copy to PC (wl-copy)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTypeOntoPc}
                  disabled={!connected || !phoneText.trim()}
                  className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 hover:text-white"
                  title="Types text into the active PC window"
                >
                  <Type className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Type onto Screen</span>
                </button>
              </div>
            </div>

            {/* ── 3. MAGIC FILE & PHOTO DROP ─────────────────────────────────── */}
            <div
              className="rounded-2xl p-3 border flex flex-col gap-2.5 shrink-0"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-dim)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                  <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>Magic File & Photo Drop</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sendWs({ type: 'open_drop_folder' });
                    vibrate(15);
                  }}
                  className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 active:scale-95"
                  title="Open MagicDrop folder on PC"
                >
                  <FolderOpen className="w-3 h-3 text-purple-400" />
                  <span>Open Folder</span>
                </button>
              </div>

              {/* Hidden native file inputs */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="py-2.5 px-3 rounded-xl border border-purple-500/40 bg-purple-950/20 text-xs font-medium text-purple-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 text-purple-400" />
                  <span>Snap & Drop</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:text-white"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Pick Image / File</span>
                </button>
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Last Uploaded File Pill */}
              {lastUploadedFile && !uploading && (
                <div className="rounded-xl px-2.5 py-1.5 bg-purple-950/30 border border-purple-500/30 flex items-center justify-between text-[11px]">
                  <span className="text-purple-300 truncate max-w-[200px]">
                    ✓ {lastUploadedFile.filename}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0 font-medium">
                    {lastUploadedFile.isImage ? '📸 Image in PC Clipboard!' : 'Path copied to PC!'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FULL SCREEN LIGHTBOX MODAL ─────────────────────────────────────── */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col p-4 animate-in fade-in duration-200"
          onClick={() => setShowLightbox(false)}
        >
          <div className="flex items-center justify-between pb-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                {clip.dimensions || 'Screenshot'}
              </span>
              {clip.size ? (
                <span className="text-xs font-mono text-slate-400">{formatBytes(clip.size)}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyImageToPhone}
                className="px-3 py-1.5 rounded-xl bg-[#2962FF] text-white text-xs font-medium flex items-center gap-1 active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Image</span>
              </button>
              <button
                onClick={handleDownloadImage}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowLightbox(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageSource}
              alt="Screenshot full view"
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
            />
          </div>
        </div>
      )}
    </>
  );
}
