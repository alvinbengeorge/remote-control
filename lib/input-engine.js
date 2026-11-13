const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, exec, execSync } = require('child_process');
const { sendHyprlandEval } = require('./hypr-ipc');

const YDO_SOCKET = '/run/user/1000/.ydotool_socket';
let ydotoolProc = null;
let recovering = false;

// Test if ydotoold socket is responsive
function isSocketHealthy() {
  return new Promise((resolve) => {
    if (!fs.existsSync(YDO_SOCKET)) return resolve(false);
    exec(`YDOTOOL_SOCKET=${YDO_SOCKET} ydotool mousemove -x 0 -y 0`, { timeout: 600 }, (err) => {
      resolve(!err);
    });
  });
}

// Auto-heal ydotoold daemon
async function recoverDaemon() {
  if (recovering) return;
  recovering = true;
  try {
    console.log('[INPUT RECOVERY] Attempting ydotool daemon recovery...');
    exec('systemctl --user reset-failed ydotool.service 2>/dev/null; systemctl --user restart ydotool.service', () => {
      setTimeout(() => { recovering = false; }, 1500);
    });
  } catch (e) {
    recovering = false;
  }
}

// Ensure ydotoold is running
async function ensureYdotoolDaemon() {
  const healthy = await isSocketHealthy();
  if (healthy) return;
  recoverDaemon();
}

ensureYdotoolDaemon();

function runYdotool(args) {
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env, { YDOTOOL_SOCKET: YDO_SOCKET });
    const p = spawn('ydotool', args, { env });
    let stderr = '';
    if (p.stderr) {
      p.stderr.on('data', (d) => { stderr += d.toString(); });
    }
    p.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[INPUT ERROR] ydotool ${args.join(' ')} failed (code=${code}): ${stderr.trim()}`);
        if (stderr.includes('Connection refused') || stderr.includes('failed to connect') || code === 2) {
          recoverDaemon();
        }
        resolve(false);
      } else {
        resolve(true);
      }
    });
    p.on('error', (err) => {
      console.error('[INPUT ERROR] ydotool spawn error:', err);
      recoverDaemon();
      resolve(false);
    });
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
    const cleanCmd = cmd.trim();
    const sockPath = getHyprlandSocket();
    if (!sockPath) {
      exec(`hyprctl ${cleanCmd}`, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
      return;
    }
    const client = net.createConnection(sockPath, () => {
      client.end(cleanCmd);
    });
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    client.on('end', () => {
      resolve(data.trim());
    });
    client.on('error', (err) => {
      // Fallback to hyprctl command on socket connection failure
      exec(`hyprctl ${cleanCmd}`, (e, stdout) => {
        if (e) return reject(err);
        resolve(stdout.trim());
      });
    });
  });
}

// Subpixel accumulator for mouse movement
let accumX = 0;
let accumY = 0;

// Subpixel accumulator for mouse wheel scrolling
let wheelAccumX = 0;
let wheelAccumY = 0;
let wheelResetTimer = null;

const InputEngine = {
  // Mouse Actions
  async mouseMove(dx, dy) {
    accumX += Number(dx) || 0;
    accumY += Number(dy) || 0;

    const rx = Math.trunc(accumX);
    const ry = Math.trunc(accumY);

    if (rx === 0 && ry === 0) return true;

    accumX -= rx;
    accumY -= ry;

    return runYdotool(['mousemove', '-x', rx.toString(), '-y', ry.toString()]);
  },

  async mouseClick(btn = 'left') {
    let code = '0xC0'; // Left click
    if (btn === 'right') code = '0xC1';
    if (btn === 'middle') code = '0xC2';
    return runYdotool(['click', code]);
  },

  async mouseWheel(dx = 0, dy = 0) {
    wheelAccumX += Number(dx) || 0;
    wheelAccumY += Number(dy) || 0;

    clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(() => {
      wheelAccumX = 0;
      wheelAccumY = 0;
    }, 350);

    // Number of touch pixels per 1 wheel tick.
    // 12px offers a natural, highly responsive feel for mobile swiping.
    const STEP_Y = 12;
    const STEP_X = 12;

    const ticksX = Math.trunc(wheelAccumX / STEP_X);
    const ticksY = Math.trunc(wheelAccumY / STEP_Y);

    if (ticksX === 0 && ticksY === 0) return true;

    wheelAccumX -= ticksX * STEP_X;
    wheelAccumY -= ticksY * STEP_Y;

    // ydotool mousemove -w -- <X> <Y>
    // X: REL_HWHEEL (horizontal)
    // Y: REL_WHEEL (vertical)
    // Swiping UP on phone (dy < 0) -> scroll DOWN in document (REL_WHEEL < 0)
    // Swiping DOWN on phone (dy > 0) -> scroll UP in document (REL_WHEEL > 0)
    return runYdotool(['mousemove', '-w', '--', ticksX.toString(), ticksY.toString()]);
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
    return sendHyprlandEval(`hl.dispatch(hl.dsp.focus({ workspace = ${wsNum} }))`);
  },

  getActiveWorkspace() {
    return new Promise((resolve) => {
      exec('hyprctl activeworkspace -j', (err, stdout) => {
        if (err || !stdout) return resolve(1);
        try {
          const d = JSON.parse(stdout);
          resolve(d.id || 1);
        } catch (_) {
          resolve(1);
        }
      });
    });
  },

  async toggleFullscreen() {
    return sendHyprlandEval('hl.dispatch(hl.dsp.window.fullscreen({ action = "toggle" }))');
  },

  async toggleFloating() {
    return sendHyprlandEval('hl.dispatch(hl.dsp.window.float({ action = "toggle" }))');
  },

  async killActiveWindow() {
    return sendHyprlandEval('hl.dispatch(hl.dsp.window.close())');
  },

  async launchApp(appCmd) {
    const safeCmd = (appCmd || '').replace(/"/g, '\\"');
    return sendHyprlandEval(`hl.dispatch(hl.dsp.exec_cmd("${safeCmd}"))`);
  },

  getVolumeState() {
    return new Promise((resolve) => {
      exec('wpctl get-volume @DEFAULT_AUDIO_SINK@', (err, stdout) => {
        if (err || !stdout) return resolve({ volume: 50, muted: false });
        const str = stdout.trim();
        const match = str.match(/Volume:\s+([0-9.]+)/);
        const vol = match ? Math.round(parseFloat(match[1]) * 100) : 50;
        const muted = str.includes('[MUTED]');
        resolve({ volume: vol, muted });
      });
    });
  },

  // System Controls
  async volume(action, val) {
    try {
      if (action === 'up') execSync('wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+');
      if (action === 'down') execSync('wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-');
      if (action === 'mute') execSync('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle');
      if (action === 'set' && typeof val === 'number') {
        const clamped = Math.max(0, Math.min(1.5, val / 100)).toFixed(2);
        execSync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${clamped}`);
      }
    } catch (_) {}
    return this.getVolumeState();
  },

  async brightness(action) {
    if (action === 'up') execSync('qs -c antigravity ipc call brightness up 2>/dev/null || brightnessctl set 5%+');
    if (action === 'down') execSync('qs -c antigravity ipc call brightness down 2>/dev/null || brightnessctl set 5%-');
  },

  async media(action) {
    if (action === 'play-pause' || action === 'play') execSync('playerctl play-pause 2>/dev/null || true');
    if (action === 'next') execSync('playerctl next 2>/dev/null || true');
    if (action === 'prev') execSync('playerctl previous 2>/dev/null || true');
  },

  async lockSession() {
    exec('hyprlock --immediate-render 2>/dev/null || loginctl lock-session');
  },

  async unlockSession(password) {
    return new Promise((resolve) => {
      // 1. Wake displays if in DPMS sleep
      sendHyprlandEval('hl.dispatch(hl.dsp.dpms("on"))');
      exec('hyprctl dispatch dpms on 2>/dev/null || true');

      // 2. Instantly dismiss hyprlock screen locker
      exec('pkill -x hyprlock 2>/dev/null; pkill -9 hyprlock 2>/dev/null; loginctl unlock-session 2>/dev/null || true', () => {
        // 3. Send desktop notification
        exec('notify-send "Workstation Unlocked" "🔓 Authenticated via Phone Biometrics" -a "Antigravity Remote" 2>/dev/null || true');
        resolve({ success: true, timestamp: Date.now() });
      });
    });
  },

  // Quickshell Controls
  async quickshell(action) {
    if (action === 'antigravity') exec('qs -c antigravity ipc call antigravity toggle');
    if (action === 'whatsapp') exec('qs -c antigravity ipc call whatsapp toggle');
    if (action === 'control' || action === 'controlCenter') exec('qs -c antigravity ipc call controlCenter toggle');
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
