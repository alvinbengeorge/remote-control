const { exec } = require('child_process');
const { sendHyprlandEval } = require('./hypr-ipc');

class WindowEngine {
  // Query Hyprland for monitors, workspaces, and window clients
  getState() {
    return new Promise((resolve) => {
      exec('hyprctl -j monitors 2>/dev/null', (mErr, mStdout) => {
        let monitors = [];
        try {
          if (!mErr && mStdout) monitors = JSON.parse(mStdout.trim());
        } catch (_) {}

        exec('hyprctl -j workspaces 2>/dev/null', (wErr, wStdout) => {
          let workspaces = [];
          try {
            if (!wErr && wStdout) workspaces = JSON.parse(wStdout.trim());
          } catch (_) {}

          exec('hyprctl -j clients 2>/dev/null', (cErr, cStdout) => {
            let clients = [];
            try {
              if (!cErr && cStdout) clients = JSON.parse(cStdout.trim());
            } catch (_) {}

            // Normalize and format data
            const cleanClients = clients
              .filter((c) => c.mapped && c.title && c.title.trim().length > 0)
              .map((c) => ({
                address: c.address,
                title: c.title,
                class: c.class || c.initialClass || 'Application',
                workspaceId: c.workspace ? c.workspace.id : null,
                workspaceName: c.workspace ? c.workspace.name : '',
                monitorId: c.monitor,
                floating: !!c.floating,
                fullscreen: c.fullscreen > 0,
                isFocused: c.focusHistoryID === 0,
                pid: c.pid,
              }));

            const cleanMonitors = monitors.map((m) => ({
              id: m.id,
              name: m.name,
              model: m.model || m.name,
              width: m.width,
              height: m.height,
              x: m.x,
              y: m.y,
              activeWorkspaceId: m.activeWorkspace ? m.activeWorkspace.id : null,
              focused: !!m.focused,
            }));

            // Sort workspaces by ID
            const cleanWorkspaces = workspaces
              .sort((a, b) => a.id - b.id)
              .map((w) => ({
                id: w.id,
                name: w.name,
                monitor: w.monitor,
                monitorId: w.monitorID,
                windowsCount: w.windows,
              }));

            resolve({
              success: true,
              monitors: cleanMonitors,
              workspaces: cleanWorkspaces,
              clients: cleanClients,
              timestamp: Date.now(),
            });
          });
        });
      });
    });
  }

  // Execute Hyprland window actions
  async dispatch(action, params = {}) {
    let lua = '';
    const rawAddr = params.address || '';
    const formattedAddr = rawAddr.startsWith('address:') ? rawAddr : `address:${rawAddr}`;

    switch (action) {
      case 'focus':
        if (rawAddr) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.focus({ window = win })) end`;
        }
        break;

      case 'close':
        if (rawAddr) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.window.close({ window = win })) end`;
        } else {
          lua = `hl.dispatch(hl.dsp.window.close())`;
        }
        break;

      case 'kill':
        if (rawAddr) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.window.kill({ window = win })); if win.pid and win.pid > 0 then os.execute("kill -9 " .. win.pid) end end`;
        } else {
          lua = `hl.dispatch(hl.dsp.window.kill())`;
        }
        break;

      case 'move_to_workspace':
        if (rawAddr && params.workspaceId !== undefined) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.window.move({ window = win, workspace = ${params.workspaceId} })) end`;
        }
        break;

      case 'toggle_float':
        if (rawAddr) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.window.float({ window = win, action = "toggle" })) end`;
        } else {
          lua = `hl.dispatch(hl.dsp.window.float({ action = "toggle" }))`;
        }
        break;

      case 'toggle_fullscreen':
        if (rawAddr) {
          lua = `local win = hl.get_window("${formattedAddr}"); if win then hl.dispatch(hl.dsp.window.fullscreen({ window = win, action = "toggle" })) end`;
        } else {
          lua = `hl.dispatch(hl.dsp.window.fullscreen({ action = "toggle" }))`;
        }
        break;

      case 'change_workspace':
        if (params.workspaceId !== undefined) {
          lua = `hl.dispatch(hl.dsp.focus({ workspace = ${params.workspaceId} }))`;
        }
        break;

      default:
        return { success: false, error: 'Unknown action' };
    }

    if (!lua) return { success: false, error: 'Invalid parameters for action' };

    const ok = await sendHyprlandEval(lua);

    // Yield small delay for Hyprland compositor animation/state refresh
    await new Promise((r) => setTimeout(r, 120));

    // Return freshly updated state after action
    const newState = await this.getState();
    return {
      success: ok,
      action,
      state: newState,
    };
  }
}

module.exports = new WindowEngine();
