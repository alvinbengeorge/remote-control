const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {
    port: 3456,
    allowedMac: '',
    pairingMode: true,
    sensitivity: 1.2,
    scrollSensitivity: 1.0,
    haptics: true,
  };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// Get all local IP addresses of the host machine
function getLocalIps() {
  const ips = new Set(['127.0.0.1', 'localhost', '::1']);
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.address) ips.add(iface.address);
      }
    }
  } catch (e) {}
  return ips;
}

function normalizeMac(mac) {
  if (!mac) return '';
  return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
}

function getMacForIp(ip) {
  if (!ip) return null;
  const cleanIp = ip.replace(/^.*:/, '').trim();

  const localIps = getLocalIps();
  if (localIps.has(cleanIp)) {
    return '00:00:00:00:00:00'; // Host machine loopback / local interface
  }

  // 1. Direct kernel ARP table inspection
  try {
    const table = fs.readFileSync('/proc/net/arp', 'utf8');
    for (const line of table.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && parts[0] === cleanIp) {
        const mac = parts[3].toLowerCase();
        if (mac !== '00:00:00:00:00:00' && mac.length === 17) {
          return mac;
        }
      }
    }
  } catch (e) {}

  // 2. Query `ip neigh show <ip>`
  try {
    const out = execSync(`ip neigh show ${cleanIp} 2>/dev/null`, { timeout: 1000 }).toString();
    const match = out.match(/lladdr\s+([0-9a-fA-F:]{17})/i);
    if (match) {
      return match[1].toLowerCase();
    }
  } catch (e) {}

  // 3. Proactively ping once to populate ARP cache if it wasn't there yet
  try {
    execSync(`ping -c 1 -W 1 ${cleanIp} >/dev/null 2>&1`, { timeout: 1200 });
    const out2 = execSync(`ip neigh show ${cleanIp} 2>/dev/null`, { timeout: 1000 }).toString();
    const match2 = out2.match(/lladdr\s+([0-9a-fA-F:]{17})/i);
    if (match2) {
      return match2[1].toLowerCase();
    }
  } catch (e) {}

  return null;
}

function verifyClient(ip) {
  const cfg = loadConfig();
  const cleanIp = (ip || '').replace(/^.*:/, '').trim();
  const localIps = getLocalIps();

  // Always allow host machine itself (for testing / admin / dashboard)
  if (localIps.has(cleanIp)) {
    return { allowed: true, mac: 'host-loopback', ip: cleanIp };
  }

  const mac = getMacForIp(cleanIp);

  if (!mac) {
    return {
      allowed: false,
      reason: 'Could not resolve device MAC address from ARP cache',
      mac: null,
      ip: cleanIp,
    };
  }

  const normMac = normalizeMac(mac);
  const allowedNorm = normalizeMac(cfg.allowedMac);

  // Auto-Pairing mode: register the first device that connects
  if ((!allowedNorm || allowedNorm === '') && cfg.pairingMode) {
    cfg.allowedMac = mac;
    cfg.pairingMode = false;
    saveConfig(cfg);
    console.log(`[AUTH] Paired new device MAC: ${mac} for IP ${cleanIp}`);
    return { allowed: true, paired: true, mac, ip: cleanIp };
  }

  // Strictly check configured MAC
  if (allowedNorm && allowedNorm === normMac) {
    return { allowed: true, mac, ip: cleanIp };
  }

  return {
    allowed: false,
    reason: `Hardware MAC mismatch (${mac} is not authorized)`,
    mac,
    ip: cleanIp,
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  getMacForIp,
  verifyClient,
  normalizeMac,
};
