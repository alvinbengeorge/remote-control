const fs = require('fs');
const path = require('path');

function getDesktopEnv() {
  const env = { ...process.env };
  const uid = process.getuid ? process.getuid() : 1000;
  const runtimeDir = env.XDG_RUNTIME_DIR || `/run/user/${uid}`;
  env.XDG_RUNTIME_DIR = runtimeDir;

  // 1. Resolve WAYLAND_DISPLAY dynamically if missing or socket doesn't exist
  if (!env.WAYLAND_DISPLAY || !fs.existsSync(path.join(runtimeDir, env.WAYLAND_DISPLAY))) {
    try {
      if (fs.existsSync(runtimeDir)) {
        const files = fs.readdirSync(runtimeDir);
        const waylandSocks = files.filter(f => /^wayland-\d+$/.test(f));
        if (waylandSocks.length > 0) {
          waylandSocks.sort((a, b) => {
            const statA = fs.statSync(path.join(runtimeDir, a));
            const statB = fs.statSync(path.join(runtimeDir, b));
            return statB.mtimeMs - statA.mtimeMs;
          });
          env.WAYLAND_DISPLAY = waylandSocks[0];
        } else {
          env.WAYLAND_DISPLAY = 'wayland-1';
        }
      }
    } catch (_) {
      env.WAYLAND_DISPLAY = env.WAYLAND_DISPLAY || 'wayland-1';
    }
  }

  // 2. Resolve HYPRLAND_INSTANCE_SIGNATURE dynamically if missing
  if (!env.HYPRLAND_INSTANCE_SIGNATURE) {
    try {
      const hyprDir = path.join(runtimeDir, 'hypr');
      if (fs.existsSync(hyprDir)) {
        const entries = fs.readdirSync(hyprDir).filter(e => !e.startsWith('.'));
        if (entries.length > 0) {
          entries.sort((a, b) => {
            const statA = fs.statSync(path.join(hyprDir, a));
            const statB = fs.statSync(path.join(hyprDir, b));
            return statB.mtimeMs - statA.mtimeMs;
          });
          env.HYPRLAND_INSTANCE_SIGNATURE = entries[0];
        }
      }
    } catch (_) {}
  }

  // 3. Ensure YDOTOOL_SOCKET
  if (!env.YDOTOOL_SOCKET) {
    env.YDOTOOL_SOCKET = path.join(runtimeDir, '.ydotool_socket');
  }

  // 4. Ensure DISPLAY
  if (!env.DISPLAY) {
    env.DISPLAY = ':0';
  }

  // Keep process.env updated
  process.env.WAYLAND_DISPLAY = env.WAYLAND_DISPLAY;
  process.env.HYPRLAND_INSTANCE_SIGNATURE = env.HYPRLAND_INSTANCE_SIGNATURE;
  process.env.XDG_RUNTIME_DIR = env.XDG_RUNTIME_DIR;
  process.env.YDOTOOL_SOCKET = env.YDOTOOL_SOCKET;

  return env;
}

module.exports = {
  getDesktopEnv,
};
