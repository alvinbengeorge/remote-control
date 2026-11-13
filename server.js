const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { getDesktopEnv } = require('./lib/env-helper');
// Bootstrap desktop Wayland / Hyprland environment
getDesktopEnv();

const { verifyClient, loadConfig } = require('./lib/mac-guard');
const InputEngine = require('./lib/input-engine');
const ThemeSyncer = require('./lib/theme-syncer');
const ClipboardEngine = require('./lib/clipboard-engine');
const AppEngine = require('./lib/app-engine');
const TerminalEngine = require('./lib/terminal-engine');
const WindowEngine = require('./lib/window-engine');
const StreamEngine = require('./lib/stream-engine');
const PowerEngine = require('./lib/power-engine');

const dev = process.env.NODE_ENV !== 'production';
const config = loadConfig();
const PORT = parseInt(process.env.PORT || config.port || '3456', 10);
const HOST = '0.0.0.0';

const app = next({ dev });
const handle = app.getRequestHandler();

const QRCode = require('qrcode');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

function getPrimaryLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function ensureCertificate(lanIp) {
  const certDir = path.join(__dirname, 'certs');
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');

  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  let needsReissue = false;
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    needsReissue = true;
  } else {
    try {
      const cert = new crypto.X509Certificate(fs.readFileSync(certPath));
      if (!cert.subjectAltName || !cert.subjectAltName.includes(lanIp)) {
        console.log(`[CERT GUARDIAN] Current LAN IP ${lanIp} not in certificate SANs. Auto-reissuing...`);
        needsReissue = true;
      }
    } catch (e) {
      needsReissue = true;
    }
  }

  if (needsReissue) {
    try {
      const dashed = lanIp.replace(/\./g, '-');
      const domains = [
        '*.nip.io',
        '*.sslip.io',
        'fedora.local',
        'fedora',
        'localhost',
        '127.0.0.1',
        '192.168.1.174', // Always preserve Home IP
        '192.168.1.174.nip.io',
        '192-168-1-174.nip.io',
        '192-168-1-174.sslip.io',
        lanIp,
        `${lanIp}.nip.io`,
        `${dashed}.nip.io`,
        `${dashed}.sslip.io`,
      ];
      console.log(`[CERT GUARDIAN] Running mkcert with SANs: ${domains.join(', ')}`);
      execSync(`mkcert -cert-file "${certPath}" -key-file "${keyPath}" ${domains.map(d => `"${d}"`).join(' ')}`, { stdio: 'inherit' });
      console.log('[CERT GUARDIAN] Multi-SAN certificate refreshed and trusted by local Root CA!');
    } catch (err) {
      console.error('[CERT GUARDIAN ERROR]', err.message);
    }
  }
}

// Ensure certificate includes current LAN IP and wildcards before preparing Next.js
ensureCertificate(getPrimaryLanIp());

app.prepare().then(() => {
  const certPath = path.join(__dirname, 'certs', 'cert.pem');
  const keyPath = path.join(__dirname, 'certs', 'key.pem');

  const requestHandler = (req, res) => {
    const ip = req.socket.remoteAddress;
    const auth = verifyClient(ip);

    // Block non-authorized MAC addresses
    if (!auth.allowed) {
      console.warn(`[SECURITY 403] Blocked access from IP ${auth.ip} (MAC: ${auth.mac || 'unknown'}): ${auth.reason}`);
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Denied - Antigravity Remote</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { background: #080B11; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100dvh; margin: 0; text-align: center; }
            .card { background: #131D2E; border: 1px solid #EF4444; padding: 28px; border-radius: 16px; max-width: 360px; }
            h1 { color: #EF4444; font-size: 20px; margin-top: 0; }
            p { color: #94A3B8; font-size: 13px; line-height: 1.5; }
            .mac { font-family: monospace; background: #080B11; padding: 6px 10px; border-radius: 6px; color: #38BDF8; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🛡️ Device Not Authorized</h1>
            <p>This workstation is locked to a single authorized hardware MAC address.</p>
            <div class="mac">Your MAC: ${auth.mac || 'Unresolved'}</div>
            <p>To authorize this phone, add its MAC to <code>config.json</code> on the host or enable pairing mode.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const parsedUrl = parse(req.url, true);

    // Dynamic endpoint to stream current workstation desktop wallpaper
    if (parsedUrl.pathname === '/api/wallpaper') {
      const wpPath = ThemeSyncer.getCurrentWallpaperPath();
      if (wpPath && fs.existsSync(wpPath)) {
        const ext = path.extname(wpPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=15',
        });
        return fs.createReadStream(wpPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Wallpaper not found');
      }
    }

    // Dynamic endpoint for active theme
    if (parsedUrl.pathname === '/api/theme') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        theme: ThemeSyncer.getActiveTheme(),
        allThemes: ThemeSyncer.getAllThemes(),
      }));
    }

    // Dynamic endpoint for installed workstation apps
    if (parsedUrl.pathname === '/api/apps' && req.method === 'GET') {
      const apps = AppEngine.scanInstalledApps();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ apps, count: apps.length }));
    }

    // Magic Clipboard Endpoints
    if (parsedUrl.pathname === '/api/clipboard' && req.method === 'GET') {
      ClipboardEngine.getClipboard().then((clip) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...clip }));
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    // Dynamic endpoint to stream / preview current clipboard image
    if (parsedUrl.pathname === '/api/clipboard/image' && (req.method === 'GET' || req.method === 'HEAD')) {
      ClipboardEngine.getClipboardImageBuffer().then((img) => {
        if (!img || !img.buffer) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('No image in clipboard');
        }
        res.writeHead(200, {
          'Content-Type': img.mimeType || 'image/png',
          'Content-Length': img.buffer.length,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        if (req.method === 'HEAD') return res.end();
        res.end(img.buffer);
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // Direct download endpoint for clipboard screenshot
    if (parsedUrl.pathname === '/api/clipboard/download' && (req.method === 'GET' || req.method === 'HEAD')) {
      ClipboardEngine.getClipboardImageBuffer().then((img) => {
        if (!img || !img.buffer) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('No image in clipboard');
        }
        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : img.mimeType === 'image/webp' ? 'webp' : 'png';
        res.writeHead(200, {
          'Content-Type': img.mimeType || 'image/png',
          'Content-Length': img.buffer.length,
          'Content-Disposition': `attachment; filename="screenshot_${Date.now()}.${ext}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        if (req.method === 'HEAD') return res.end();
        res.end(img.buffer);
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // Direct upload endpoint to set workstation image clipboard
    if (parsedUrl.pathname === '/api/clipboard/set-image' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const mimeType = req.headers['content-type'] || 'image/png';
          await ClipboardEngine.setClipboardImage(buffer, mimeType);
          const updatedClip = await ClipboardEngine.getClipboardData();
          broadcast({
            type: 'clipboard_sync',
            clipboard: updatedClip,
            contentType: updatedClip.type,
            text: updatedClip.text || '',
            imageUrl: updatedClip.imageUrl || '',
            dataUrl: updatedClip.dataUrl || '',
            mimeType: updatedClip.mimeType || '',
            size: updatedClip.size || 0,
            dimensions: updatedClip.dimensions || '',
            timestamp: Date.now(),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, clipboard: updatedClip }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (parsedUrl.pathname === '/api/clipboard' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          await ClipboardEngine.setClipboard(parsed.text || '');
          const updatedClip = await ClipboardEngine.getClipboardData();
          broadcast({
            type: 'clipboard_sync',
            clipboard: updatedClip,
            contentType: updatedClip.type,
            text: updatedClip.text || '',
            imageUrl: updatedClip.imageUrl || '',
            dataUrl: updatedClip.dataUrl || '',
            mimeType: updatedClip.mimeType || '',
            size: updatedClip.size || 0,
            dimensions: updatedClip.dimensions || '',
            timestamp: Date.now(),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Magic File Drop Upload Endpoint
    if (parsedUrl.pathname === '/api/upload' && req.method === 'POST') {
      const rawFilename = req.headers['x-filename']
        ? decodeURIComponent(req.headers['x-filename'])
        : `upload_${Date.now()}`;
      const mimeType = req.headers['content-type'] || 'application/octet-stream';

      ClipboardEngine.saveDroppedFile(rawFilename, req, mimeType)
        .then((fileInfo) => {
          broadcast({
            type: 'file_dropped',
            file: fileInfo,
            timestamp: Date.now(),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...fileInfo }));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    // Open Magic Drop folder on workstation
    if (parsedUrl.pathname === '/api/open-drop-folder' && req.method === 'POST') {
      ClipboardEngine.openMagicDropFolder();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    // Live Wayland Screen Mirroring stream & snapshots
    if (parsedUrl.pathname === '/api/stream/screen') {
      return StreamEngine.handleScreenRequest(req, res, parsedUrl.query || {});
    }

    // Live PipeWire Desktop Audio Streaming
    if (parsedUrl.pathname === '/api/stream/audio') {
      return StreamEngine.handleAudioRequest(req, res);
    }

    // Workstation Power & Virtual Display Telemetry API
    if (parsedUrl.pathname === '/api/power' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(PowerEngine.getPowerState()));
    }

    if (parsedUrl.pathname === '/api/virtual-display/toggle' && req.method === 'POST') {
      PowerEngine.toggleVirtualDisplay().then((state) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
      });
      return;
    }

    handle(req, res, parsedUrl);
  };

  let server;
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const https = require('https');
    server = https.createServer({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }, requestHandler);
  } else {
    server = http.createServer(requestHandler);
  }

  // WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  // Broadcast helper
  function broadcast(dataObj) {
    const msg = JSON.stringify(dataObj);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  // Watch desktop theme changes in ~/.local/state/quickshell/user/
  let themeDebounce = null;
  function notifyThemeChange() {
    clearTimeout(themeDebounce);
    themeDebounce = setTimeout(() => {
      try {
        const theme = ThemeSyncer.getActiveTheme();
        const allThemes = ThemeSyncer.getAllThemes();
        console.log(`[THEME SYNC] Broadcasting active desktop theme: ${theme.name} (${theme.id})`);
        broadcast({
          type: 'theme_sync',
          theme,
          allThemes,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('[THEME SYNC ERROR]', e);
      }
    }, 80);
  }

  try {
    if (fs.existsSync(ThemeSyncer.STATE_DIR)) {
      fs.watch(ThemeSyncer.STATE_DIR, (eventType, filename) => {
        if (!filename) return;
        if (filename.includes('theme') || filename.includes('wallpaper')) {
          notifyThemeChange();
        }
      });
      console.log(`[THEME] Watching desktop theme state at ${ThemeSyncer.STATE_DIR}`);
    }
  } catch (err) {
    console.warn('[THEME WATCH WARN]', err.message);
  }

  // Poll playerctl media, hyprland workspace, audio volume, and battery state
  let lastMediaKey = '';
  let lastActiveWs = 1;
  let lastVolKey = '';
  let lastPowerKey = '';
  let powerTicks = 0;
  setInterval(async () => {
    try {
      const [media, wsId, vol] = await Promise.all([
        ThemeSyncer.getMediaState(),
        InputEngine.getActiveWorkspace(),
        InputEngine.getVolumeState(),
      ]);

      const key = `${media.status}:${media.title}:${media.artist}`;
      if (key !== lastMediaKey) {
        lastMediaKey = key;
        broadcast({
          type: 'media_sync',
          media,
          timestamp: Date.now(),
        });
      }

      if (wsId !== lastActiveWs) {
        lastActiveWs = wsId;
        broadcast({
          type: 'workspace_sync',
          activeWorkspace: wsId,
          timestamp: Date.now(),
        });
      }

      const volKey = `${vol.volume}:${vol.muted}`;
      if (volKey !== lastVolKey) {
        lastVolKey = volKey;
        broadcast({
          type: 'volume_sync',
          volume: vol,
          timestamp: Date.now(),
        });
      }

      powerTicks = (powerTicks + 1) % 3;
      if (powerTicks === 0) {
        const power = PowerEngine.getPowerState();
        const pKey = `${power.battery.capacity}:${power.battery.status}:${power.virtualDisplay.active}`;
        if (pKey !== lastPowerKey) {
          lastPowerKey = pKey;
          broadcast({
            type: 'power_sync',
            power,
            timestamp: Date.now(),
          });
        }
      }
    } catch (_) {}
  }, 1200);

  server.on('upgrade', (req, socket, head) => {
    socket.on('close', (hadError) => {
      if (hadError) console.log('[TCP SOCKET CLOSED WITH ERROR]');
    });
    socket.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Normal client drop/sleep/tab-switch from mobile device
        return;
      }
      console.warn('[TCP SOCKET ERROR]', err.message || err);
    });

    const ip = req.socket.remoteAddress;
    const auth = verifyClient(ip);

    if (!auth.allowed) {
      console.warn(`[WS 403] Denied WebSocket handshake from IP ${auth.ip} (MAC: ${auth.mac || 'unknown'})`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, auth);
    });
  });

  wss.on('connection', async (ws, req, auth) => {
    ws.wsId = `${auth.ip || 'client'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`[WS CONNECTED] Client connected from IP: ${auth.ip} (MAC: ${auth.mac}) [Session: ${ws.wsId}]`);

    ws.on('error', (err) => {
      console.error(`[WS ERROR] Client ${auth.ip}:`, err);
    });

    ws.on('close', (code, reason) => {
      TerminalEngine.destroySession(ws.wsId);
      console.log(`[WS DISCONNECTED] Client ${auth.ip}, code=${code}, reason=${reason ? reason.toString() : ''}`);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'mousemove':
            await InputEngine.mouseMove(msg.dx, msg.dy);
            break;

          case 'click':
            await InputEngine.mouseClick(msg.button || 'left');
            break;

          case 'wheel':
            await InputEngine.mouseWheel(msg.deltaX || 0, msg.deltaY || 0);
            break;

          case 'type':
            await InputEngine.typeText(msg.text);
            break;

          case 'key':
            await InputEngine.keyPress(msg.key);
            break;

          case 'set_theme':
            if (msg.themeKey) {
              await ThemeSyncer.setTheme(msg.themeKey);
              notifyThemeChange();
            }
            break;

          case 'cycle_theme':
            await ThemeSyncer.toggleAutoCycle();
            notifyThemeChange();
            break;

          case 'get_theme':
            ws.send(JSON.stringify({
              type: 'theme_sync',
              theme: ThemeSyncer.getActiveTheme(),
              allThemes: ThemeSyncer.getAllThemes(),
            }));
            break;

          case 'hypr':
            if (msg.action === 'workspace') {
              console.log(`[HYPR] Remote requested workspace ${msg.value}`);
              await InputEngine.switchWorkspace(msg.value);
              const activeWs = await InputEngine.getActiveWorkspace();
              broadcast({
                type: 'workspace_sync',
                activeWorkspace: activeWs,
                timestamp: Date.now(),
              });
            }
            if (msg.action === 'fullscreen') await InputEngine.toggleFullscreen();
            if (msg.action === 'floating') await InputEngine.toggleFloating();
            if (msg.action === 'kill') await InputEngine.killActiveWindow();
            if (msg.action === 'launch') await InputEngine.launchApp(msg.value);
            break;

          case 'media':
            await InputEngine.media(msg.action);
            // Refresh media state promptly
            setTimeout(async () => {
              const m = await ThemeSyncer.getMediaState();
              broadcast({ type: 'media_sync', media: m });
            }, 250);
            break;

          case 'volume': {
            const vol = await InputEngine.volume(msg.action, msg.value);
            broadcast({
              type: 'volume_sync',
              volume: vol,
              timestamp: Date.now(),
            });
            break;
          }

          case 'brightness':
            await InputEngine.brightness(msg.action);
            break;

          case 'quickshell':
            await InputEngine.quickshell(msg.action);
            break;

          case 'lock':
            console.log(`[REMOTE ACTION] Lock session requested from ${auth.ip}`);
            await InputEngine.lockSession();
            break;

          case 'unlock':
          case 'biometric_unlock': {
            console.log(`[REMOTE ACTION] Biometric unlock session requested from ${auth.ip} (method: ${msg.method || 'unknown'})`);
            const unlockRes = await InputEngine.unlockSession(msg.password);
            ws.send(JSON.stringify({ type: 'unlock_result', ...unlockRes }));
            broadcast({ type: 'session_unlocked', timestamp: Date.now() });
            break;
          }

          case 'get_clipboard': {
            const clip = await ClipboardEngine.getClipboard();
            ws.send(JSON.stringify({
              type: 'clipboard_sync',
              clipboard: clip,
              contentType: clip.type,
              text: clip.text || '',
              imageUrl: clip.imageUrl || '',
              dataUrl: clip.dataUrl || '',
              mimeType: clip.mimeType || '',
              size: clip.size || 0,
              dimensions: clip.dimensions || '',
              timestamp: Date.now(),
            }));
            break;
          }

          case 'set_clipboard': {
            if (msg.contentType === 'image' && msg.dataUrl) {
              const base64Data = msg.dataUrl.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              await ClipboardEngine.setClipboardImage(buffer, msg.mimeType || 'image/png');
            } else {
              await ClipboardEngine.setClipboardText(msg.text || '');
            }
            const updatedClip = await ClipboardEngine.getClipboard();
            broadcast({
              type: 'clipboard_sync',
              clipboard: updatedClip,
              contentType: updatedClip.type,
              text: updatedClip.text || '',
              imageUrl: updatedClip.imageUrl || '',
              dataUrl: updatedClip.dataUrl || '',
              mimeType: updatedClip.mimeType || '',
              size: updatedClip.size || 0,
              dimensions: updatedClip.dimensions || '',
              timestamp: Date.now(),
            });
            break;
          }

          case 'open_drop_folder':
            ClipboardEngine.openMagicDropFolder();
            break;

          case 'get_apps': {
            const apps = AppEngine.scanInstalledApps();
            ws.send(JSON.stringify({
              type: 'apps_sync',
              apps,
              count: apps.length,
              timestamp: Date.now(),
            }));
            break;
          }

          case 'launch_app': {
            console.log(`[APP LAUNCH] Launching '${msg.name || msg.desktopId}' on Hyprland`);
            const res = await AppEngine.launchApp(msg.desktopId, msg.exec);
            ws.send(JSON.stringify({
              type: 'app_launch_result',
              name: msg.name,
              desktopId: msg.desktopId,
              ...res,
            }));
            broadcast({
              type: 'app_launched',
              name: msg.name,
              desktopId: msg.desktopId,
              timestamp: Date.now(),
            });
            break;
          }

          // ── Interactive Terminal ──────────────────────────────────────────
          case 'terminal_init':
            TerminalEngine.getOrCreateSession(ws.wsId, (payload) => ws.send(JSON.stringify(payload)));
            break;

          case 'terminal_input':
            TerminalEngine.sendInput(ws.wsId, msg.data, (payload) => ws.send(JSON.stringify(payload)));
            break;

          case 'terminal_signal':
            TerminalEngine.sendSignal(ws.wsId, msg.signal, (payload) => ws.send(JSON.stringify(payload)));
            break;

          case 'terminal_restart':
            TerminalEngine.restartSession(ws.wsId, (payload) => ws.send(JSON.stringify(payload)));
            break;

          // ── Window & Workspace Master ──────────────────────────────────────
          case 'get_windows': {
            const winState = await WindowEngine.getState();
            ws.send(JSON.stringify({ type: 'windows_state', ...winState }));
            break;
          }

          case 'window_action': {
            const actionRes = await WindowEngine.dispatch(msg.action, msg.params);
            ws.send(JSON.stringify({ type: 'window_action_result', ...actionRes }));
            if (actionRes.state) {
              broadcast({ type: 'windows_state', ...actionRes.state });
            }
            break;
          }

          // ── Screen Tap to Click ───────────────────────────────────────────
          case 'screen_tap':
            await StreamEngine.tapScreen(msg.monitor, msg.normX, msg.normY);
            break;

          case 'cmd':
            if (msg.command) {
              const res = await InputEngine.execCommand(msg.command);
              ws.send(JSON.stringify({ type: 'cmd_result', ...res }));
            }
            break;

          case 'get_power': {
            const power = PowerEngine.getPowerState();
            ws.send(JSON.stringify({ type: 'power_sync', power, timestamp: Date.now() }));
            break;
          }

          case 'toggle_virtual_display': {
            const updated = await PowerEngine.toggleVirtualDisplay(msg.enable);
            broadcast({ type: 'power_sync', power: updated, timestamp: Date.now() });
            // Also notify window engine to refresh monitors list
            const winState = await WindowEngine.getState();
            broadcast({ type: 'windows_state', ...winState });
            break;
          }

          case 'open_power_statistics': {
            await PowerEngine.openPowerStatistics();
            break;
          }

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (err) {
        console.error('[WS ERROR]', err);
      }
    });

    // Send initial handshake with theme, media, workspace, volume, and clipboard
    try {
      const [activeTheme, allThemes, currentMedia, activeWs, currentVol, clipText] = await Promise.all([
        ThemeSyncer.getActiveTheme(),
        ThemeSyncer.getAllThemes(),
        ThemeSyncer.getMediaState(),
        InputEngine.getActiveWorkspace(),
        InputEngine.getVolumeState(),
        ClipboardEngine.getClipboard(),
      ]);

      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'connected',
          deviceMac: auth.mac,
          paired: Boolean(auth.paired),
          theme: activeTheme,
          allThemes,
          media: currentMedia,
          activeWorkspace: activeWs,
          volume: currentVol,
          clipboard: clipText,
          apps: AppEngine.scanInstalledApps(),
          power: PowerEngine.getPowerState(),
          timestamp: Date.now(),
        }));
      }
    } catch (e) {
      console.warn('[HANDSHAKE ERROR]', e);
    }
  });

  server.listen(PORT, HOST, async (err) => {
    if (err) throw err;
    const lanIp = getPrimaryLanIp();
    const dashedIp = lanIp.replace(/\./g, '-');
    const nipDomain = `${lanIp}.nip.io`;
    const remoteUrl = `https://${nipDomain}:${PORT}`;
    const dashedUrl = `https://${dashedIp}.nip.io:${PORT}`;
    const mdnsUrl = `https://fedora.local:${PORT}`;
    console.log(`> Antigravity Remote (Biometric HTTPS): ${remoteUrl}`);
    console.log(`> Wildcard HTTPS (Zero-Cert-Drift):     ${dashedUrl}`);
    console.log(`> mDNS Local Domain:                   ${mdnsUrl}`);
    console.log(`> Strict 1-MAC filtering: ACTIVE`);
    console.log(`> Native Phone Biometrics (WebAuthn): ACTIVE`);

    try {
      await QRCode.toFile('/tmp/antigravity_remote_qr.png', remoteUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const qrAscii = await QRCode.toString(remoteUrl, { type: 'terminal', small: true });
      console.log('\n--- Scan with Phone to Pair & Connect ---');
      console.log(qrAscii);
      console.log('-----------------------------------------\n');

      const info = {
        url: remoteUrl,
        dashedUrl: dashedUrl,
        mdnsUrl: mdnsUrl,
        ip: lanIp,
        port: PORT,
        qrPath: '/tmp/antigravity_remote_qr.png',
        timestamp: Date.now(),
      };
      fs.writeFileSync('/tmp/antigravity_remote_info.json', JSON.stringify(info, null, 2), 'utf8');
      fs.writeFileSync('/tmp/antigravity_remote_url.txt', remoteUrl, 'utf8');
      const userStateDir = path.join(os.homedir(), '.local', 'state', 'quickshell', 'user');
      if (fs.existsSync(userStateDir)) {
        fs.writeFileSync(path.join(userStateDir, 'remote_info.json'), JSON.stringify(info, null, 2), 'utf8');
        fs.writeFileSync(path.join(userStateDir, 'remote_url.txt'), remoteUrl, 'utf8');
        try {
          fs.copyFileSync('/tmp/antigravity_remote_qr.png', path.join(userStateDir, 'remote_qr.png'));
        } catch (_) {}
      }
    } catch (qrErr) {
      console.warn('QR code generation warning:', qrErr);
    }
  });
});
