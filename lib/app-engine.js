const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { sendHyprlandEval } = require('./hypr-ipc');

class AppEngine {
  constructor() {
    this.cachedApps = [];
    this.lastScanTime = 0;
    this.SCAN_INTERVAL = 60000; // Refresh cache every 60s
  }

  getAppDirectories() {
    return [
      '/usr/share/applications',
      '/var/lib/flatpak/exports/share/applications',
      path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
      path.join(os.homedir(), '.local/share/applications'),
    ];
  }

  scanInstalledApps() {
    const now = Date.now();
    if (this.cachedApps.length > 0 && now - this.lastScanTime < this.SCAN_INTERVAL) {
      return this.cachedApps;
    }

    const appDirs = this.getAppDirectories();
    const apps = [];
    const seenNames = new Set();

    for (const dir of appDirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (!file.endsWith('.desktop')) continue;

          try {
            const filePath = path.join(dir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            let name = '';
            let execCmd = '';
            let icon = '';
            let comment = '';
            let categories = '';
            let terminal = false;
            let noDisplay = false;
            let inEntry = false;

            for (const line of content.split('\n')) {
              const trimmed = line.trim();
              if (trimmed === '[Desktop Entry]') {
                inEntry = true;
                continue;
              } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                inEntry = false;
              }

              if (!inEntry) continue;

              if (trimmed.startsWith('Name=') && !name) {
                name = trimmed.slice(5).trim();
              } else if (trimmed.startsWith('Exec=') && !execCmd) {
                execCmd = trimmed.slice(5).trim();
              } else if (trimmed.startsWith('Icon=') && !icon) {
                icon = trimmed.slice(5).trim();
              } else if (trimmed.startsWith('Comment=') && !comment) {
                comment = trimmed.slice(8).trim();
              } else if (trimmed.startsWith('Categories=') && !categories) {
                categories = trimmed.slice(11).trim();
              } else if (trimmed === 'Terminal=true') {
                terminal = true;
              } else if (trimmed === 'NoDisplay=true' || trimmed === 'Hidden=true') {
                noDisplay = true;
              }
            }

            // Clean exec command (remove field codes like %U, %F, %u, %f)
            const cleanExec = execCmd.replace(/%[a-zA-Z]/g, '').trim();

            if (noDisplay || !name || !cleanExec) continue;

            const nameKey = name.toLowerCase();
            if (seenNames.has(nameKey)) continue;
            seenNames.add(nameKey);

            // Determine primary category
            let primaryCat = 'Utility';
            const catUpper = categories.toUpperCase();
            if (catUpper.includes('DEVELOPMENT') || catUpper.includes('IDE')) primaryCat = 'Development';
            else if (catUpper.includes('NETWORK') || catUpper.includes('WEB') || catUpper.includes('BROWSER')) primaryCat = 'Internet';
            else if (catUpper.includes('AUDIO') || catUpper.includes('VIDEO') || catUpper.includes('MUSIC')) primaryCat = 'Media';
            else if (catUpper.includes('SYSTEM') || catUpper.includes('SETTINGS')) primaryCat = 'System';
            else if (catUpper.includes('GAME')) primaryCat = 'Games';
            else if (catUpper.includes('OFFICE')) primaryCat = 'Office';
            else if (catUpper.includes('GRAPHICS')) primaryCat = 'Graphics';

            apps.push({
              name,
              desktopId: file,
              exec: cleanExec,
              icon,
              comment,
              category: primaryCat,
              terminal,
            });
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Sort alphabetically by name
    apps.sort((a, b) => a.name.localeCompare(b.name));
    this.cachedApps = apps;
    this.lastScanTime = now;
    return apps;
  }

  launchApp(desktopId, fallbackExec) {
    return new Promise((resolve) => {
      // Target command: prefer gtk-launch with desktop ID, or fallback exec command
      let targetCmd = '';
      if (desktopId) {
        targetCmd = `gtk-launch ${desktopId}`;
      } else if (fallbackExec) {
        // Strip desktop file field codes (%u, %U, %f, %F, etc.)
        targetCmd = fallbackExec.replace(/%[uUfFdDnNickvm]/g, '').trim();
      }

      if (!targetCmd) {
        return resolve({ success: false, error: 'No desktopId or exec provided' });
      }

      // CRITICAL: Launch via Hyprland IPC (hl.dispatch(hl.dsp.exec_cmd(...))) rather than
      // direct child process spawn. This ensures the launched application runs
      // under the compositor's session cgroup (session-2.scope), completely
      // detached from antigravity-remote.service. Otherwise, stopping the service
      // (e.g., when Lite Mode activates) kills any apps launched from the remote!
      const safeCmd = targetCmd.replace(/"/g, '\\"');
      const lua = `hl.dispatch(hl.dsp.exec_cmd("${safeCmd}"))`;
      sendHyprlandEval(lua).then((ok) => {
        if (ok) {
          return resolve({ success: true, method: 'hyprland-lua', cmd: targetCmd });
        }

        // Secondary fallback: systemd-run --user to isolate in its own scope
        exec(`systemd-run --user --slice=app.slice ${targetCmd} 2>/dev/null`, (sErr) => {
          if (!sErr) {
            return resolve({ success: true, method: 'systemd-run', cmd: targetCmd });
          }

          // Last resort direct launch
          exec(`${targetCmd} 2>/dev/null &`, (dErr) => {
            resolve({ success: !dErr, method: 'direct-bg', cmd: targetCmd });
          });
        });
      });
    });
  }
}

module.exports = new AppEngine();
