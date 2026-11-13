const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec, execSync } = require('child_process');
const { getDesktopEnv } = require('./env-helper');
const { sendHyprlandEval } = require('./hypr-ipc');

class PowerEngine {
  constructor() {
    this.scriptPath = path.join(
      os.homedir(),
      'Desktop/personal/custom_quickshell/scripts/virtual_display.sh'
    );
  }

  getBatteryInfo() {
    let capacity = 100;
    let status = 'Full';
    let isCharging = false;
    let watts = 0;
    let timeStr = '';

    try {
      if (fs.existsSync('/sys/class/power_supply/BAT0/capacity')) {
        capacity = parseInt(fs.readFileSync('/sys/class/power_supply/BAT0/capacity', 'utf8').trim(), 10);
        status = fs.readFileSync('/sys/class/power_supply/BAT0/status', 'utf8').trim();
        isCharging = status === 'Charging' || status === 'Full';
      }

      const upower = execSync('upower -i /org/freedesktop/UPower/devices/battery_BAT0 2>/dev/null', {
        encoding: 'utf8',
      });
      const rateMatch = upower.match(/energy-rate:\s+([\d.]+)\s*W/);
      if (rateMatch) watts = parseFloat(rateMatch[1]);
      const timeMatch = upower.match(/time to (?:full|empty):\s+([\d.]+\s*\w+)/);
      if (timeMatch) timeStr = timeMatch[1];
    } catch (_) {}

    return {
      capacity,
      status,
      isCharging,
      watts,
      timeStr,
    };
  }

  getTunedProfile() {
    try {
      const out = execSync('tuned-adm active 2>/dev/null', { encoding: 'utf8' }).trim();
      const match = out.match(/Current active profile:\s*(.+)/);
      return match ? match[1].trim() : 'balanced';
    } catch (_) {
      return 'balanced';
    }
  }

  getVirtualDisplayInfo() {
    let active = false;
    let headlessName = null;
    let url = '';

    try {
      const pgrep = execSync('pgrep -x wayvnc || true', { encoding: 'utf8' }).trim();
      if (pgrep) {
        active = true;
        const env = getDesktopEnv();
        const stdout = execSync('hyprctl -j monitors 2>/dev/null', { env, encoding: 'utf8' });
        const monitors = JSON.parse(stdout || '[]');
        const h = monitors.find((m) => m.name && m.name.startsWith('HEADLESS'));
        if (h) headlessName = h.name;

        let ip = '';
        try {
          ip = execSync(
            'ip -4 addr show wlo1 2>/dev/null | grep -oP "(?<=inet\\s)\\d+(\\.\\d+){3}"',
            { encoding: 'utf8' }
          ).trim();
        } catch (_) {}

        if (!ip) {
          try {
            ip = execSync('hostname -I 2>/dev/null', { encoding: 'utf8' }).trim().split(' ')[0];
          } catch (_) {}
        }

        if (ip) {
          url = `http://${ip}:6080/vnc.html?autoconnect=true&resize=remote`;
        }
      }
    } catch (_) {}

    return {
      active,
      headlessName,
      url,
    };
  }

  getPowerState() {
    return {
      battery: this.getBatteryInfo(),
      tunedProfile: this.getTunedProfile(),
      virtualDisplay: this.getVirtualDisplayInfo(),
      timestamp: Date.now(),
    };
  }

  toggleVirtualDisplay(enable) {
    return new Promise((resolve) => {
      const env = getDesktopEnv();
      const current = this.getVirtualDisplayInfo();
      const shouldStart = enable === undefined ? !current.active : Boolean(enable);
      const action = shouldStart ? 'start' : 'stop';

      exec(`${this.scriptPath} ${action}`, { env }, (err, stdout) => {
        setTimeout(() => {
          resolve(this.getPowerState());
        }, 800);
      });
    });
  }

  async openPowerStatistics() {
    const lua = 'local w = hl.get_window("class:org.gnome.PowerStats"); if w then hl.dispatch(hl.dsp.focus({ window = w })) else hl.dispatch(hl.dsp.exec_cmd("gnome-power-statistics")) end';
    await sendHyprlandEval(lua);
    return { success: true };
  }
}

module.exports = new PowerEngine();
