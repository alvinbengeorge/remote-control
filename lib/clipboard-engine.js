const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAGIC_DROP_DIR = path.join(process.env.HOME || '/home/alvin', 'Downloads', 'MagicDrop');

function ensureDropDir() {
  if (!fs.existsSync(MAGIC_DROP_DIR)) {
    fs.mkdirSync(MAGIC_DROP_DIR, { recursive: true });
  }
  return MAGIC_DROP_DIR;
}

// In-memory cache for fast streaming and fallback
let cachedImageBuffer = null;
let cachedImageMimeType = 'image/png';
let cachedImageTimestamp = 0;

function processImageBuffer(buf, mimeType, label) {
  let dimensions = '';
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    dimensions = `${w}×${h}`;
  } else {
    const match = (label || '').match(/(\d+)x(\d+)/);
    if (match) dimensions = `${match[1]}×${match[2]}`;
  }

  cachedImageBuffer = buf;
  cachedImageMimeType = mimeType || 'image/png';
  cachedImageTimestamp = Date.now();

  const sizeKB = Math.round(buf.length / 1024);
  let dataUrl = '';
  if (buf.length <= 4 * 1024 * 1024) {
    dataUrl = `data:${cachedImageMimeType};base64,${buf.toString('base64')}`;
  }

  return {
    type: 'image',
    mimeType: cachedImageMimeType,
    size: buf.length,
    dimensions,
    text: `[Screenshot: ${dimensions ? dimensions + ' ' : ''}${sizeKB} KB]`,
    dataUrl,
    imageUrl: `/api/clipboard/image?t=${cachedImageTimestamp}`,
    timestamp: cachedImageTimestamp,
  };
}

function fallbackCliphist(resolve) {
  exec('cliphist list 2>/dev/null | head -n 1', (err, stdout) => {
    const top = (stdout || '').trim();
    if (!top) {
      if (cachedImageBuffer) {
        return resolve(processImageBuffer(cachedImageBuffer, cachedImageMimeType, 'Cached Image'));
      }
      return resolve({ type: 'empty', text: '', timestamp: Date.now() });
    }
    const tabIdx = top.indexOf('\t');
    const id = tabIdx > -1 ? top.substring(0, tabIdx).trim() : top.trim();
    const label = tabIdx > -1 ? top.substring(tabIdx + 1).trim() : '';
    const isImg = label.includes('[[ binary data') && (label.includes('png') || label.includes('jpg') || label.includes('jpeg'));

    exec(`cliphist decode ${id} 2>/dev/null`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (err2, buf) => {
      if (err2 || !buf || buf.length === 0) {
        if (cachedImageBuffer) {
          return resolve(processImageBuffer(cachedImageBuffer, cachedImageMimeType, 'Cached Image'));
        }
        return resolve({ type: 'empty', text: '', timestamp: Date.now() });
      }
      if (isImg) {
        const mimeType = label.includes('jpg') || label.includes('jpeg') ? 'image/jpeg' : 'image/png';
        return resolve(processImageBuffer(buf, mimeType, label));
      } else {
        return resolve({
          type: 'text',
          mimeType: 'text/plain',
          text: buf.toString('utf8'),
          timestamp: Date.now(),
        });
      }
    });
  });
}

function getClipboardData() {
  return new Promise((resolve) => {
    // 1. Check active Wayland clipboard
    exec('wl-paste --list-types 2>/dev/null', (err, stdout) => {
      const types = (stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
      const imgType = types.find(t => t.startsWith('image/'));

      if (imgType) {
        exec(`wl-paste -t "${imgType}" 2>/dev/null`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (err2, buf) => {
          if (!err2 && buf && buf.length > 0) {
            return resolve(processImageBuffer(buf, imgType, 'Wayland Clipboard'));
          }
          fallbackCliphist(resolve);
        });
      } else if (types.length > 0) {
        exec('wl-paste -n 2>/dev/null', { maxBuffer: 10 * 1024 * 1024 }, (err2, textOut) => {
          if (!err2 && textOut && textOut.toString()) {
            return resolve({
              type: 'text',
              mimeType: 'text/plain',
              text: textOut.toString(),
              timestamp: Date.now(),
            });
          }
          fallbackCliphist(resolve);
        });
      } else {
        fallbackCliphist(resolve);
      }
    });
  });
}

function getClipboardImageBuffer() {
  return new Promise((resolve) => {
    // 1. Check active Wayland clipboard
    exec('wl-paste --list-types 2>/dev/null', (err, stdout) => {
      const types = (stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
      const imgType = types.find(t => t.startsWith('image/'));

      if (imgType) {
        exec(`wl-paste -t "${imgType}" 2>/dev/null`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (err2, buf) => {
          if (!err2 && buf && buf.length > 0) {
            cachedImageBuffer = buf;
            cachedImageMimeType = imgType;
            cachedImageTimestamp = Date.now();
            return resolve({ buffer: buf, mimeType: imgType, timestamp: cachedImageTimestamp });
          }
          fallbackCliphistImage(resolve);
        });
      } else {
        fallbackCliphistImage(resolve);
      }
    });
  });
}

function fallbackCliphistImage(resolve) {
  exec('cliphist list 2>/dev/null | head -n 1', (err, stdout) => {
    const top = (stdout || '').trim();
    if (!top) {
      if (cachedImageBuffer) {
        return resolve({ buffer: cachedImageBuffer, mimeType: cachedImageMimeType, timestamp: cachedImageTimestamp });
      }
      return resolve(null);
    }
    const tabIdx = top.indexOf('\t');
    const id = tabIdx > -1 ? top.substring(0, tabIdx).trim() : top.trim();
    const label = tabIdx > -1 ? top.substring(tabIdx + 1).trim() : '';
    const isImg = label.includes('[[ binary data') && (label.includes('png') || label.includes('jpg') || label.includes('jpeg'));

    if (!isImg) {
      if (cachedImageBuffer) {
        return resolve({ buffer: cachedImageBuffer, mimeType: cachedImageMimeType, timestamp: cachedImageTimestamp });
      }
      return resolve(null);
    }

    exec(`cliphist decode ${id} 2>/dev/null`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (err2, buf) => {
      if (!err2 && buf && buf.length > 0) {
        const mimeType = label.includes('jpg') || label.includes('jpeg') ? 'image/jpeg' : 'image/png';
        cachedImageBuffer = buf;
        cachedImageMimeType = mimeType;
        cachedImageTimestamp = Date.now();
        return resolve({ buffer: buf, mimeType, timestamp: cachedImageTimestamp });
      }
      if (cachedImageBuffer) {
        return resolve({ buffer: cachedImageBuffer, mimeType: cachedImageMimeType, timestamp: cachedImageTimestamp });
      }
      return resolve(null);
    });
  });
}

function setClipboardText(text) {
  return new Promise((resolve) => {
    try {
      const p = spawn('wl-copy', [text], { detached: true, stdio: 'ignore' });
      p.unref();

      const preview = (text || '').replace(/[\r\n]+/g, ' ').trim();
      const short = preview.length > 50 ? preview.substring(0, 47) + '...' : preview;
      const safeShort = short.replace(/"/g, '\\"');
      exec(`notify-send "Magic Clipboard" "📋 Copied from phone: ${safeShort}" -a "Antigravity Remote" 2>/dev/null || true`);
      resolve(true);
    } catch (e) {
      console.error('[CLIPBOARD TEXT ERROR]', e);
      resolve(false);
    }
  });
}

function setClipboardImage(filePathOrBuffer, mimeType = 'image/png') {
  return new Promise((resolve) => {
    try {
      let targetPath = filePathOrBuffer;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        ensureDropDir();
        const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
        targetPath = path.join(MAGIC_DROP_DIR, `clipboard_image_${Date.now()}${ext}`);
        fs.writeFileSync(targetPath, filePathOrBuffer);
      }

      cachedImageBuffer = fs.readFileSync(targetPath);
      cachedImageMimeType = mimeType;
      cachedImageTimestamp = Date.now();

      const p = spawn('sh', ['-c', `wl-copy -t "${mimeType}" < "${targetPath}"`], { detached: true, stdio: 'ignore' });
      p.unref();

      const iconArg = fs.existsSync(targetPath) ? `-i "${targetPath}"` : '';
      exec(`notify-send "Magic Clipboard" "📸 Image copied directly to PC clipboard!" ${iconArg} -a "Antigravity Remote" 2>/dev/null || true`);
      resolve(true);
    } catch (e) {
      console.error('[CLIPBOARD IMAGE ERROR]', e);
      resolve(false);
    }
  });
}

function saveDroppedFile(filename, stream, mimeType) {
  ensureDropDir();
  const rawName = (filename || 'dropped_file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeName = `${Date.now()}_${rawName}`;
  const targetPath = path.join(MAGIC_DROP_DIR, safeName);
  const writeStream = fs.createWriteStream(targetPath);

  return new Promise((resolve, reject) => {
    stream.pipe(writeStream);
    writeStream.on('finish', () => {
      const ext = path.extname(safeName).toLowerCase();
      const isImg = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);

      try {
        if (isImg) {
          const imgMime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
          setClipboardImage(targetPath, imgMime);
        } else {
          setClipboardText(targetPath);
          exec(`notify-send "Magic File Drop" "📁 Received: ${safeName}\nPath copied to clipboard!" -a "Antigravity Remote" 2>/dev/null || true`);
        }
      } catch (_) {}

      try {
        const stat = fs.statSync(targetPath);
        resolve({
          filename: safeName,
          path: targetPath,
          size: stat.size,
          isImage: isImg,
          url: `/api/drop/${encodeURIComponent(safeName)}`,
        });
      } catch (err) {
        resolve({ filename: safeName, path: targetPath, size: 0, isImage: isImg });
      }
    });
    writeStream.on('error', reject);
  });
}

function openMagicDropFolder() {
  ensureDropDir();
  exec(`xdg-open "${MAGIC_DROP_DIR}" 2>/dev/null || nautilus "${MAGIC_DROP_DIR}" 2>/dev/null || true`);
}

module.exports = {
  getClipboard: getClipboardData,
  getClipboardData,
  getClipboardImageBuffer,
  setClipboard: setClipboardText,
  setClipboardText,
  setClipboardImage,
  saveDroppedFile,
  openMagicDropFolder,
  MAGIC_DROP_DIR,
};
