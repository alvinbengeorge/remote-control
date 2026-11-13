const { spawn, exec, execSync } = require('child_process');
const { getDesktopEnv } = require('./env-helper');
const { sendHyprlandEval } = require('./hypr-ipc');

class StreamEngine {
  constructor() {
    this.audioStreams = new Set();
  }

  // Handle /api/stream/screen (MJPEG or single snapshot)
  handleScreenRequest(req, res, query) {
    const monitor = query.monitor || 'eDP-1';
    const quality = Math.max(20, Math.min(85, parseInt(query.quality, 10) || 55));
    const isSnapshot = query.snapshot === 'true';
    const fps = Math.max(1, Math.min(15, parseInt(query.fps, 10) || 5));
    const env = getDesktopEnv();

    if (isSnapshot) {
      // Capture single JPEG frame directly via grim with cursor
      const grim = spawn(
        'grim',
        ['-s', '0.6', '-t', 'jpeg', '-q', quality.toString(), '-c', '-o', monitor, '-'],
        { env }
      );

      const chunks = [];
      grim.stdout.on('data', (d) => chunks.push(d));

      grim.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });
          res.end(buffer);
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Failed to capture frame');
        }
      });

      grim.on('error', (err) => {
        try {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Grim error: ${err.message}`);
        } catch (_) {}
      });
      return;
    }

    // Live MJPEG Multipart Stream
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--mjpegframe',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'close',
      'Pragma': 'no-cache',
    });

    let running = true;
    let capturing = false;

    const captureFrame = () => {
      if (!running || capturing) return;
      capturing = true;

      const curEnv = getDesktopEnv();
      const grim = spawn(
        'grim',
        ['-s', '0.6', '-t', 'jpeg', '-q', quality.toString(), '-c', '-o', monitor, '-'],
        { env: curEnv }
      );

      const chunks = [];
      grim.stdout.on('data', (d) => chunks.push(d));

      grim.on('close', (code) => {
        capturing = false;
        if (!running) return;

        if (code === 0 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          try {
            res.write(`--mjpegframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${buffer.length}\r\n\r\n`);
            res.write(buffer);
            res.write('\r\n');
          } catch (_) {
            running = false;
          }
        }
      });

      grim.on('error', () => {
        capturing = false;
      });
    };

    const interval = setInterval(captureFrame, Math.round(1000 / fps));
    captureFrame();

    const cleanup = () => {
      running = false;
      clearInterval(interval);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('close', cleanup);
  }

  // Handle /api/stream/audio (Live PipeWire MP3 stream)
  handleAudioRequest(req, res) {
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
    });

    const env = getDesktopEnv();

    // Capture desktop sink output and encode to low-latency MP3
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-v', 'error',
        '-f', 'pulse',
        '-i', 'default',
        '-ac', '2',
        '-ar', '44100',
        '-b:a', '128k',
        '-f', 'mp3',
        '-',
      ],
      { env }
    );

    this.audioStreams.add(ffmpeg);
    ffmpeg.stdout.pipe(res);

    const cleanup = () => {
      this.audioStreams.delete(ffmpeg);
      try {
        ffmpeg.kill('SIGTERM');
      } catch (_) {}
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('close', cleanup);
    ffmpeg.on('error', cleanup);
  }

  // Map tap on preview to actual desktop coordinate and click
  // Uses Hyprland's native 'hl.dsp.cursor.move' to properly handle multi-monitor layout geometry
  async tapScreen(monitorName, normX, normY) {
    try {
      const env = getDesktopEnv();
      const stdout = execSync('hyprctl -j monitors 2>/dev/null', { env, encoding: 'utf8' });
      const monitors = JSON.parse(stdout);
      const mon = monitors.find((m) => m.name === monitorName) || monitors[0];
      if (!mon) return false;

      // Calculate exact absolute compositor coordinates accounting for monitor offset (x, y)
      const clampedX = Math.max(0, Math.min(1, Number(normX) || 0));
      const clampedY = Math.max(0, Math.min(1, Number(normY) || 0));

      const absX = Math.round(mon.x + (clampedX * mon.width));
      const absY = Math.round(mon.y + (clampedY * mon.height));

      // Move cursor directly via Hyprland IPC to exact monitor pixel, then trigger click
      await sendHyprlandEval(`hl.dispatch(hl.dsp.cursor.move({ x = ${absX}, y = ${absY} }))`);
      exec('YDOTOOL_SOCKET=/run/user/1000/.ydotool_socket ydotool click 0xC0');
      return true;
    } catch (_) {
      return false;
    }
  }
}

module.exports = new StreamEngine();
