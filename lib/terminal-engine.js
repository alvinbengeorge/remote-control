const { spawn } = require('child_process');
const os = require('os');

class TerminalEngine {
  constructor() {
    this.sessions = new Map(); // wsId -> shell process
  }

  // Get or spawn an interactive bash shell in user's home directory (~)
  getOrCreateSession(wsId, sendCallback) {
    if (this.sessions.has(wsId)) {
      const existing = this.sessions.get(wsId);
      if (!existing.killed) return existing;
    }

    const homeDir = os.homedir();
    const shellBin = process.env.SHELL || '/bin/bash';

    const child = spawn(shellBin, ['-i'], {
      cwd: homeDir,
      env: {
        ...process.env,
        HOME: homeDir,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: 'en_US.UTF-8',
        PS1: '\\[\\033[01;32m\\]\\u@fedora\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const onData = (data) => {
      sendCallback({
        type: 'terminal_output',
        data: data.toString(),
      });
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('close', (code) => {
      sendCallback({
        type: 'terminal_closed',
        code,
      });
      this.sessions.delete(wsId);
    });

    child.on('error', (err) => {
      sendCallback({
        type: 'terminal_output',
        data: `\r\n[SHELL ERROR]: ${err.message}\r\n`,
      });
    });

    this.sessions.set(wsId, child);

    // Initial greeting
    setTimeout(() => {
      sendCallback({
        type: 'terminal_output',
        data: `\x1b[1;36m✦ Antigravity Interactive Shell Connected\x1b[0m\r\n\x1b[90mWorking Directory: ${homeDir} (~)\x1b[0m\r\n\r\n`,
      });
    }, 100);

    return child;
  }

  // Send raw input to shell
  sendInput(wsId, text, sendCallback) {
    const session = this.getOrCreateSession(wsId, sendCallback);
    if (session && session.stdin && !session.killed) {
      session.stdin.write(text);
    }
  }

  // Send signal (e.g. Ctrl+C = SIGINT, Ctrl+Z = SIGTSTP)
  sendSignal(wsId, signal = 'SIGINT', sendCallback) {
    const session = this.getOrCreateSession(wsId, sendCallback);
    if (session && !session.killed) {
      if (signal === 'SIGINT') {
        session.stdin.write('\x03');
      } else if (signal === 'SIGTSTP') {
        session.stdin.write('\x1a');
      } else if (signal === 'EOF') {
        session.stdin.write('\x04');
      }
    }
  }

  // Restart shell in ~
  restartSession(wsId, sendCallback) {
    if (this.sessions.has(wsId)) {
      const old = this.sessions.get(wsId);
      try {
        old.kill('SIGTERM');
      } catch (_) {}
      this.sessions.delete(wsId);
    }
    return this.getOrCreateSession(wsId, sendCallback);
  }

  // Clean up when client disconnects
  destroySession(wsId) {
    if (this.sessions.has(wsId)) {
      const child = this.sessions.get(wsId);
      try {
        child.kill('SIGTERM');
      } catch (_) {}
      this.sessions.delete(wsId);
    }
  }
}

module.exports = new TerminalEngine();
