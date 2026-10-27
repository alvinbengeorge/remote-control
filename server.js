const http = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { verifyClient, loadConfig } = require('./lib/mac-guard');
const InputEngine = require('./lib/input-engine');

const dev = process.env.NODE_ENV !== 'production';
const config = loadConfig();
const PORT = parseInt(process.env.PORT || config.port || '3456', 10);
const HOST = '0.0.0.0';

const app = next({ dev });
const handle = app.getRequestHandler();

const QRCode = require('qrcode');
const os = require('os');

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

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
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
            body { background: #080B11; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
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
    handle(req, res, parsedUrl);
  });

  // WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
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

  wss.on('connection', (ws, req, auth) => {
    console.log(`[WS CONNECTED] Client connected from IP: ${auth.ip} (MAC: ${auth.mac})`);

    ws.send(JSON.stringify({
      type: 'connected',
      deviceMac: auth.mac,
      paired: Boolean(auth.paired),
      timestamp: Date.now(),
    }));

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
            await InputEngine.mouseWheel(msg.deltaY || 0);
            break;

          case 'type':
            await InputEngine.typeText(msg.text);
            break;

          case 'key':
            await InputEngine.keyPress(msg.key);
            break;

          case 'hypr':
            if (msg.action === 'workspace') await InputEngine.switchWorkspace(msg.value);
            if (msg.action === 'fullscreen') await InputEngine.toggleFullscreen();
            if (msg.action === 'floating') await InputEngine.toggleFloating();
            if (msg.action === 'kill') await InputEngine.killActiveWindow();
            if (msg.action === 'launch') await InputEngine.launchApp(msg.value);
            break;

          case 'media':
            await InputEngine.media(msg.action);
            break;

          case 'volume':
            await InputEngine.volume(msg.action);
            break;

          case 'brightness':
            await InputEngine.brightness(msg.action);
            break;

          case 'quickshell':
            await InputEngine.quickshell(msg.action);
            break;

          case 'lock':
            await InputEngine.lockSession();
            break;

          case 'cmd':
            if (msg.command) {
              const res = await InputEngine.execCommand(msg.command);
              ws.send(JSON.stringify({ type: 'cmd_result', ...res }));
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (err) {
        console.error('[WS ERROR]', err);
      }
    });

    ws.on('close', () => {
      console.log(`[WS DISCONNECTED] Client ${auth.ip}`);
    });
  });

  server.listen(PORT, HOST, async (err) => {
    if (err) throw err;
    const lanIp = getPrimaryLanIp();
    const remoteUrl = `http://${lanIp}:${PORT}`;
    console.log(`> Antigravity Remote ready on http://localhost:${PORT}`);
    console.log(`> Mobile access: ${remoteUrl}`);
    console.log(`> Strict 1-MAC filtering: ACTIVE`);

    try {
      await QRCode.toFile('/tmp/antigravity_remote_qr.png', remoteUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#00F0FF', light: '#080B11' },
      });
      const qrAscii = await QRCode.toString(remoteUrl, { type: 'terminal', small: true });
      console.log('\n--- Scan with Phone to Pair & Connect ---');
      console.log(qrAscii);
      console.log('-----------------------------------------\n');
    } catch (qrErr) {
      console.warn('QR code generation warning:', qrErr);
    }
  });
});
