const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, exec, execSync } = require('child_process');

const YDO_SOCKET = '/run/user/1000/.ydotool_socket';
let ydotoolProc = null;

// Ensure ydotoold is running
function ensureYdotoolDaemon() {
  if (fs.existsSync(YDO_SOCKET)) {
    return;
  }
  try {
    console.log('[INPUT] Spawning ydotoold daemon on socket:', YDO_SOCKET);
    ydotoolProc = spawn('ydotoold', ['--socket-path', YDO_SOCKET, '--socket-perm', '0660'], {
      detached: true,
      stdio: 'ignore',
    });
    ydotoolProc.unref();
  } catch (e) {
    console.error('[INPUT] Error starting ydotoold:', e);
  }
}

ensureYdotoolDaemon();

function runYdotool(args) {
  ensureYdotoolDaemon();
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env, { YDOTOOL_SOCKET: YDO_SOCKET });
    const p = spawn('ydotool', args, { env });
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

// Find active Hyprland UNIX domain socket
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
      console.warn('[INPUT] Failed to read hyprDir:', e);
    }
  }
  return null;
}

function sendHyprlandCommand(cmd) {
  return new Promise((resolve, reject) => {
    const sockPath = getHyprlandSocket();
    if (!sockPath) {
      // Fallback to hyprctl command
      exec(`hyprctl ${cmd}`, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
      return;
    }
    const client = net.createConnection(sockPath, () => {
      client.write(cmd + '\n');
    });
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    client.on('end', () => {
      resolve(data.trim());
    });
    client.on('error', (err) => {
      reject(err);
    });
  });
}

const InputEngine = {
  // Mouse Actions
  async mouseMove(dx, dy) {
    // Relative move with ydotool
    const rx = Math.round(dx);
    const ry = Math.round(dy);
    if (rx === 0 && ry === 0) return true;
    return runYdotool(['mousemove', '-x', rx.toString(), '-y', ry.toString()]);
  },

  async mouseClick(btn = 'left') {
    let code = '0xC0'; // Left click
    if (btn === 'right') code = '0xC1';
    if (btn === 'middle') code = '0xC2';
    return runYdotool(['click', code]);
  },

  async mouseWheel(deltaY) {
    // 0xC4 = wheel down, 0xC5 = wheel up
    const code = deltaY > 0 ? '0xC4' : '0xC5';
    const steps = Math.min(6, Math.max(1, Math.round(Math.abs(deltaY) / 18)));
    for (let i = 0; i < steps; i++) {
      await runYdotool(['click', code]);
    }
    return true;
  },

  // Keyboard Actions
  async typeText(text) {
    if (!text) return true;
    return runYdotool(['type', text]);
  },

  async keyPress(keyName) {
    // Key codes mapping
    const KEY_MAP = {
      enter: ['28:1', '28:0'],
      return: ['28:1', '28:0'],
      escape: ['1:1', '1:0'],
      esc: ['1:1', '1:0'],
      backspace: ['14:1', '14:0'],
      tab: ['15:1', '15:0'],
      space: ['57:1', '57:0'],
      up: ['103:1', '103:0'],
      down: ['108:1', '108:0'],
      left: ['105:1', '105:0'],
      right: ['106:1', '106:0'],
      super: ['125:1', '125:0'],
      meta: ['125:1', '125:0'],
      // Combos
      copy: ['29:1', '46:1', '46:0', '29:0'], // Ctrl+C
      paste: ['29:1', '47:1', '47:0', '29:0'], // Ctrl+V
      undo: ['29:1', '44:1', '44:0', '29:0'], // Ctrl+Z
      alttab: ['56:1', '15:1', '15:0', '56:0'], // Alt+Tab
      killwin: ['125:1', '16:1', '16:0', '125:0'], // Super+Q
      launcher: ['125:1', '57:1', '57:0', '125:0'], // Super+Space
    };

    const seq = KEY_MAP[keyName.toLowerCase()];
    if (seq) {
      return runYdotool(['key', ...seq]);
    }
    return false;
  },

  // Hyprland Actions
  async switchWorkspace(wsNum) {
    return sendHyprlandCommand(`dispatch workspace ${wsNum}`);
  },

  async toggleFullscreen() {
    return sendHyprlandCommand('dispatch fullscreen');
  },

  async toggleFloating() {
    return sendHyprlandCommand('dispatch togglefloating');
  },

  async killActiveWindow() {
    return sendHyprlandCommand('dispatch killactive');
  },

  async launchApp(appCmd) {
    return sendHyprlandCommand(`dispatch exec ${appCmd}`);
  },

  // System Controls
  async volume(action) {
    if (action === 'up') execSync('wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+');
    if (action === 'down') execSync('wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-');
    if (action === 'mute') execSync('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle');
  },

  async brightness(action) {
    if (action === 'up') execSync('brightnessctl set 5%+');
    if (action === 'down') execSync('brightnessctl set 5%-');
  },

  async media(action) {
    if (action === 'play-pause' || action === 'play') execSync('playerctl play-pause 2>/dev/null || true');
    if (action === 'next') execSync('playerctl next 2>/dev/null || true');
    if (action === 'prev') execSync('playerctl previous 2>/dev/null || true');
  },

  async lockSession() {
    exec('hyprlock 2>/dev/null || loginctl lock-session');
  },

  // Quickshell Controls
  async quickshell(action) {
    if (action === 'antigravity') exec('qs -c antigravity ipc call antigravity toggle');
    if (action === 'whatsapp') exec('qs -c antigravity ipc call whatsapp toggle');
    if (action === 'control') exec('qs -c antigravity ipc call control toggle');
    if (action === 'docker') exec('qs -c antigravity ipc call docker toggle');
    if (action === 'theme') exec('qs -c antigravity ipc call wallpaperTheme toggle');
  },

  // Execute arbitrary shell command
  execCommand(cmd) {
    return new Promise((resolve) => {
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout.toString(),
          stderr: stderr ? stderr.toString() : (error ? error.message : ''),
        });
      });
    });
  },
};

module.exports = InputEngine;
