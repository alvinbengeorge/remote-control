const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, '.local/state/quickshell/user');
const THEME_FILE = path.join(STATE_DIR, 'antigravity-theme.json');
const CUSTOM_THEMES_FILE = path.join(STATE_DIR, 'antigravity-custom-themes.json');
const TEMP_THEME_FILE = path.join(STATE_DIR, 'temp-wallpaper-theme.json');
const WALLPAPER_FILE = path.join(STATE_DIR, 'antigravity-wallpaper.json');

const BUILT_IN_PALETTES = {
  arythmatic: {
    id: "arythmatic",
    name: "Arythmatic",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/arythmatic-obsidian.png"),
    gtkTheme: "Obsidian-flow-yellow-dark",
    bgBase: "#080B10",
    bgSurface: "#0E131C",
    bgSurfaceGlass: "#F20E131C",
    bgModal: "#131926",
    bgCard: "#171F2E",
    bgPill: "#141B29",
    bgHover: "#222C40",
    bgActive: "#2D3A54",
    borderDim: "#1C2536",
    borderGlow: "rgba(255, 170, 0, 0.35)",
    borderActive: "#FFAA00",
    accentViolet: "#FFAA00",
    accentIndigo: "#FF8C00",
    accentCyan: "#FFC533",
    accentSky: "#FFAA00",
    accentEmerald: "#00C758",
    accentAmber: "#FFAA00",
    accentRose: "#F43F5E",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#8E9EB5",
    textOnAccent: "#000000"
  },
  askmeidentity: {
    id: "askmeidentity",
    name: "AskMeIdentity",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/fedora-neon-blue-black.jpg"),
    gtkTheme: "Obsidian-flow-blue-dark",
    bgBase: "#080B11",
    bgSurface: "#0E1522",
    bgSurfaceGlass: "#F20E1522",
    bgModal: "#131D2E",
    bgCard: "#172338",
    bgPill: "#141F32",
    bgHover: "#223352",
    bgActive: "#2E446D",
    borderDim: "#1C2B42",
    borderGlow: "#452962FF",
    borderActive: "#2962FF",
    accentViolet: "#60B01C",
    accentIndigo: "#1965D8",
    accentCyan: "#00F0FF",
    accentSky: "#2962FF",
    accentEmerald: "#60B01C",
    accentAmber: "#F59E0B",
    accentRose: "#F43F5E",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#8295AD",
    textOnAccent: "#FFFFFF"
  },
  deepspace: {
    id: "deepspace",
    name: "Deep Space",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/fedora-neon-blue-black.jpg"),
    gtkTheme: "Obsidian-flow-blue-dark",
    bgBase: "#090D14",
    bgSurface: "#0F172A",
    bgSurfaceGlass: "#F20B0F17",
    bgModal: "#0D1322",
    bgCard: "#131C2E",
    bgPill: "#141D2D",
    bgHover: "#1E2B43",
    bgActive: "#28395A",
    borderDim: "#1E293B",
    borderGlow: "#4038BDF8",
    borderActive: "#6366F1",
    accentViolet: "#A78BFA",
    accentIndigo: "#818CF8",
    accentCyan: "#22D3EE",
    accentSky: "#38BDF8",
    accentEmerald: "#34D399",
    accentAmber: "#FBBF24",
    accentRose: "#FB7185",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    textOnAccent: "#FFFFFF"
  },
  catppuccin: {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/wallhaven-rqyoo1.png"),
    gtkTheme: "Obsidian-flow-purple-dark",
    bgBase: "#11111B",
    bgSurface: "#181825",
    bgSurfaceGlass: "#F2181825",
    bgModal: "#1E1E2E",
    bgCard: "#24273A",
    bgPill: "#26283D",
    bgHover: "#363A4F",
    bgActive: "#494D64",
    borderDim: "#313244",
    borderGlow: "#40CBA6F7",
    borderActive: "#CBA6F7",
    accentViolet: "#DDB6F2",
    accentIndigo: "#B4BEFE",
    accentCyan: "#89DCEB",
    accentSky: "#74C7EC",
    accentEmerald: "#A6E3A1",
    accentAmber: "#F9E2AF",
    accentRose: "#F38BA8",
    textPrimary: "#CDD6F4",
    textSecondary: "#BAC2DE",
    textMuted: "#A6ADC8",
    textOnAccent: "#FFFFFF"
  },
  tokyonight: {
    id: "tokyonight",
    name: "Tokyo Night",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/fedora-neon.jpg"),
    gtkTheme: "Obsidian-flow-blue-dark",
    bgBase: "#16161E",
    bgSurface: "#1A1B26",
    bgSurfaceGlass: "#F21A1B26",
    bgModal: "#1F2335",
    bgCard: "#24283B",
    bgPill: "#222638",
    bgHover: "#2F3549",
    bgActive: "#3B4261",
    borderDim: "#292E42",
    borderGlow: "#407AA2F7",
    borderActive: "#7AA2F7",
    accentViolet: "#C0CAF5",
    accentIndigo: "#7AA2F7",
    accentCyan: "#7DCFFF",
    accentSky: "#2AC3DE",
    accentEmerald: "#9ECE6A",
    accentAmber: "#E0AF68",
    accentRose: "#F7768E",
    textPrimary: "#C0CAF5",
    textSecondary: "#A9B1D6",
    textMuted: "#787C99",
    textOnAccent: "#FFFFFF"
  },
  nord: {
    id: "nord",
    name: "Nord Frost",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/wallhaven-nrd9oj.jpg"),
    gtkTheme: "Obsidian-flow-gray-dark",
    bgBase: "#242933",
    bgSurface: "#2E3440",
    bgSurfaceGlass: "#F22E3440",
    bgModal: "#3B4252",
    bgCard: "#383F4D",
    bgPill: "#333A47",
    bgHover: "#434C5E",
    bgActive: "#4C566A",
    borderDim: "#434C5E",
    borderGlow: "#4088C0D0",
    borderActive: "#88C0D0",
    accentViolet: "#D0A8C7",
    accentIndigo: "#5E81AC",
    accentCyan: "#8FBCBB",
    accentSky: "#88C0D0",
    accentEmerald: "#A3BE8C",
    accentAmber: "#EBCB8B",
    accentRose: "#BF616A",
    textPrimary: "#ECEFF4",
    textSecondary: "#E5E9F0",
    textMuted: "#98A2B3",
    textOnAccent: "#FFFFFF"
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/wallhaven-95kpwx.jpg"),
    gtkTheme: "Obsidian-flow-red-dark",
    bgBase: "#08040C",
    bgSurface: "#0F0A1C",
    bgSurfaceGlass: "#F20F0A1C",
    bgModal: "#18122B",
    bgCard: "#21193D",
    bgPill: "#1E1735",
    bgHover: "#322353",
    bgActive: "#462F76",
    borderDim: "#2D1F4E",
    borderGlow: "#50FF007F",
    borderActive: "#FF007F",
    accentViolet: "#FF79C6",
    accentIndigo: "#BD93F9",
    accentCyan: "#00F0FF",
    accentSky: "#38BDF8",
    accentEmerald: "#10E599",
    accentAmber: "#FFE600",
    accentRose: "#FF007F",
    textPrimary: "#FFF0FA",
    textSecondary: "#F1B7EE",
    textMuted: "#BA93B9",
    textOnAccent: "#FFFFFF"
  },
  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox Warm",
    wallpaper: path.join(HOME, "Pictures/Wallpapers/wallhaven-48wlq2.jpg"),
    gtkTheme: "Obsidian-flow-yellow-dark",
    bgBase: "#1D2021",
    bgSurface: "#282828",
    bgSurfaceGlass: "#F2282828",
    bgModal: "#32302F",
    bgCard: "#3C3836",
    bgPill: "#32302F",
    bgHover: "#504945",
    bgActive: "#665C54",
    borderDim: "#3C3836",
    borderGlow: "#40FABD2F",
    borderActive: "#FABD2F",
    accentViolet: "#E095AA",
    accentIndigo: "#83A598",
    accentCyan: "#8EC07C",
    accentSky: "#83A598",
    accentEmerald: "#B8BB26",
    accentAmber: "#FABD2F",
    accentRose: "#FB4934",
    textPrimary: "#EBDBB2",
    textSecondary: "#D5C4A1",
    textMuted: "#A89984",
    textOnAccent: "#282828"
  }
};

function readJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`[THEME] Error reading JSON file ${filePath}:`, e.message);
  }
  return defaultValue;
}

function getCustomPalettes() {
  const data = readJsonFile(CUSTOM_THEMES_FILE, { themes: {} });
  return data.themes || {};
}

function getCurrentThemeKey() {
  // Check if temporary wallpaper theme is active
  if (fs.existsSync(TEMP_THEME_FILE)) {
    return 'temp_wallpaper';
  }
  const data = readJsonFile(THEME_FILE, { currentTheme: 'askmeidentity' });
  return data.currentTheme || 'askmeidentity';
}

function getCurrentWallpaperPath() {
  // 1. Check wallpaper state file
  const wpData = readJsonFile(WALLPAPER_FILE, {});
  if (wpData.manualWallpaper && fs.existsSync(wpData.manualWallpaper)) {
    return wpData.manualWallpaper;
  }
  // 2. Check active theme wallpaper
  const active = getActiveTheme();
  if (active && active.wallpaper && fs.existsSync(active.wallpaper)) {
    return active.wallpaper;
  }
  // 3. Fallback to default wallpaper dir
  const fallback = path.join(HOME, 'Pictures/Wallpapers/fedora-neon-blue-black.jpg');
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function getActiveTheme() {
  if (fs.existsSync(TEMP_THEME_FILE)) {
    const temp = readJsonFile(TEMP_THEME_FILE, null);
    if (temp && temp.id) return temp;
  }

  const key = getCurrentThemeKey();
  const custom = getCustomPalettes();
  if (custom[key]) {
    return { ...custom[key], id: key };
  }
  if (BUILT_IN_PALETTES[key]) {
    return { ...BUILT_IN_PALETTES[key], id: key };
  }
  return { ...BUILT_IN_PALETTES.askmeidentity, id: 'askmeidentity' };
}

function getAllThemes() {
  const custom = getCustomPalettes();
  const list = [];

  // Built-ins
  for (const [key, p] of Object.entries(BUILT_IN_PALETTES)) {
    list.push({
      id: key,
      name: p.name,
      accentSky: p.accentSky,
      accentViolet: p.accentViolet,
      bgBase: p.bgBase,
      borderActive: p.borderActive,
      isCustom: false,
      isWallpaperTheme: false,
    });
  }

  // Customs & Wallpaper Themes
  for (const [key, p] of Object.entries(custom)) {
    list.push({
      id: key,
      name: p.name || key,
      accentSky: p.accentSky || p.borderActive || '#38BDF8',
      accentViolet: p.accentViolet || '#A78BFA',
      bgBase: p.bgBase || '#0E1522',
      borderActive: p.borderActive || '#38BDF8',
      isCustom: true,
      isWallpaperTheme: Boolean(p.isWallpaperTheme),
    });
  }

  return list;
}

function setTheme(themeKey) {
  return new Promise((resolve) => {
    console.log(`[THEME] Request to switch theme to: ${themeKey}`);
    // 1. Trigger Quickshell IPC
    exec(`qs -c antigravity ipc call theme set ${themeKey}`, (err, stdout, stderr) => {
      if (err) {
        console.warn(`[THEME IPC] Quickshell IPC error: ${stderr || err.message}, fallback to state write`);
        // Fallback: write directly to state file
        try {
          fs.writeFileSync(THEME_FILE, JSON.stringify({ currentTheme: themeKey }, null, 4));
          // Apply system theme python script
          exec(`python3 ${HOME}/Desktop/personal/custom_quickshell/scripts/apply_system_theme.py ${themeKey}`);
          exec(`python3 ${HOME}/Desktop/personal/custom_quickshell/scripts/apply_kitty_theme.py ${themeKey}`);
          exec(`python3 ${HOME}/Desktop/personal/custom_quickshell/scripts/apply_hyprlock_theme.py ${themeKey}`);
        } catch (e) {
          console.error('[THEME] Direct state write error:', e);
        }
      }
      resolve(true);
    });
  });
}

function toggleAutoCycle() {
  return new Promise((resolve) => {
    exec('qs -c antigravity ipc call theme cycleToggle', () => resolve(true));
  });
}

// Media player metadata fetcher
function getMediaState() {
  return new Promise((resolve) => {
    exec('playerctl status 2>/dev/null', (errStatus, statusOut) => {
      const status = (statusOut || '').trim() || 'Stopped';
      if (status === 'Stopped') {
        return resolve({ status: 'Stopped', title: '', artist: '', album: '', artUrl: '' });
      }

      exec('playerctl metadata --format "{{title}};;;{{artist}};;;{{album}};;;{{mpris:artUrl}}" 2>/dev/null', (errMeta, metaOut) => {
        const parts = (metaOut || '').trim().split(';;;');
        resolve({
          status,
          title: parts[0] || 'Unknown Track',
          artist: parts[1] || 'Unknown Artist',
          album: parts[2] || '',
          artUrl: parts[3] || '',
        });
      });
    });
  });
}

module.exports = {
  getActiveTheme,
  getAllThemes,
  getCurrentThemeKey,
  getCurrentWallpaperPath,
  setTheme,
  toggleAutoCycle,
  getMediaState,
  STATE_DIR,
  THEME_FILE,
  CUSTOM_THEMES_FILE,
};
