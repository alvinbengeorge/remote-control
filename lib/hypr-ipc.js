const fs = require('fs');
const path = require('path');
const net = require('net');
const { exec } = require('child_process');

function getHyprlandSocket() {
  const sig = process.env.HYPRLAND_INSTANCE_SIGNATURE;
  const hyprDir = '/run/user/1000/hypr';
  if (sig) {
    const p = path.join(hyprDir, sig, '.socket.sock');
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(hyprDir)) {
    try {
      const entries = fs.readdirSync(hyprDir)
        .map(e => ({ name: e, path: path.join(hyprDir, e) }))
        .filter(e => {
          try { return fs.statSync(e.path).isDirectory(); } catch { return false; }
        })
        .sort((a, b) => {
          try {
            return fs.statSync(b.path).mtimeMs - fs.statSync(a.path).mtimeMs;
          } catch {
            return 0;
          }
        });

      for (const e of entries) {
        const sock = path.join(e.path, '.socket.sock');
        if (fs.existsSync(sock)) return sock;
      }
    } catch (e) {
      console.warn('[HYPR IPC] Failed to read hyprDir:', e);
    }
  }
  return null;
}

function sendHyprlandEval(luaCode) {
  return new Promise((resolve) => {
    const cleanLua = luaCode.trim();
    const sockPath = getHyprlandSocket();
    if (!sockPath) {
      exec(`hyprctl repl ${JSON.stringify(cleanLua)}`, (err, stdout) => {
        resolve(!err && !stdout.includes('error:'));
      });
      return;
    }
    const client = net.createConnection(sockPath, () => {
      client.end(`eval ${cleanLua}\n`);
    });
    let data = '';
    client.on('data', (chunk) => { data += chunk.toString(); });
    client.on('end', () => {
      const ok = data.includes('ok') || (!data.includes('error:') && data.length > 0);
      resolve(ok);
    });
    client.on('error', () => {
      exec(`hyprctl repl ${JSON.stringify(cleanLua)}`, (e, stdout) => {
        resolve(!e && !stdout.includes('error:'));
      });
    });
  });
}

module.exports = {
  getHyprlandSocket,
  sendHyprlandEval,
};
