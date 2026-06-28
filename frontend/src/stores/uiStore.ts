import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import http from '../services/http';
import { APIS } from '../services/apis';

export type ThemeMode = 'light' | 'dark' | 'system';
export type UIColorTheme =
  | 'default'
  | 'indigo'
  | 'microsoft'
  | 'forest'
  | 'red'
  | 'gray';
export type DarkVariant = 'current' | 'github';
export type AppScale = 100 | 110 | 120;

type ThemeScale = {
  '50': string;
  '100': string;
  '200': string;
  '300': string;
  '400': string;
  '500': string;
  '600': string;
  '700': string;
  '800': string;
  '900': string;
  '950': string;
};

type ColorThemeConfig = {
  primaryScale: ThemeScale;
  primary: string;
  primaryForeground: string;
  ring: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
};

type DarkVariantConfig = {
  appBg: string;
  sidebarBg: string;
  cardBg: string;
  borderColor: string;
  hoverBg: string;
  textPrimary: string;
  textMuted: string;
  overlayBg: string;
  overlaySoftBg: string;
};

const hexToRgbTriplet = (hex: string, fallback: string): string => {
  const normalized = hex.trim().replace('#', '');
  const validHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(validHex)) {
    return fallback;
  }

  const r = parseInt(validHex.slice(0, 2), 16);
  const g = parseInt(validHex.slice(2, 4), 16);
  const b = parseInt(validHex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const COLOR_THEME_CONFIG: Record<UIColorTheme, ColorThemeConfig> = {
  default: {
    primaryScale: {
      '50': '191.2 100% 96.9%',
      '100': '188.8 77.3% 91.4%',
      '200': '178.4 36.6% 80.2%',
      '300': '186.7 73% 71%',
      '400': '185.8 70% 59.4%',
      '500': '187.3 73% 46.5%',
      '600': '188.6 62.7% 34.7%',
      '700': '188.9 62.7% 29.4%',
      '800': '189.2 63.9% 23.9%',
      '900': '190.5 51.3% 15.3%',
      '950': '180 43.8% 6.3%',
    },
    primary: '187.3 73% 46.5%',
    primaryForeground: '210 40% 98%',
    ring: '187.3 73% 46.5%',
    secondary: '180 39.4% 93.5%',
    secondaryForeground: '190.5 51.3% 15.3%',
    accent: '180 39.4% 93.5%',
    accentForeground: '190.5 51.3% 15.3%',
  },
  indigo: {
    primaryScale: {
      '50': '226 100% 97%',
      '100': '226 100% 94%',
      '200': '228 96% 89%',
      '300': '230 94% 82%',
      '400': '234 89% 74%',
      '500': '239 84% 67%',
      '600': '243 75% 59%',
      '700': '245 58% 51%',
      '800': '244 55% 41%',
      '900': '242 47% 34%',
      '950': '244 47% 20%',
    },
    primary: '243 75% 59%',
    primaryForeground: '210 40% 98%',
    ring: '243 75% 59%',
    secondary: '226 35% 95%',
    secondaryForeground: '242 47% 22%',
    accent: '226 35% 95%',
    accentForeground: '242 47% 22%',
  },
  microsoft: {
    primaryScale: {
      '50': '207 83% 96%',
      '100': '206 83% 92%',
      '200': '207 82% 85%',
      '300': '207 82% 72%',
      '400': '207 79% 61%',
      '500': '206 100% 42%',
      '600': '207 84% 40%',
      '700': '206 100% 31%',
      '800': '206 100% 24%',
      '900': '206 100% 17%',
      '950': '208 100% 10%',
    },
    primary: '206 100% 42%',
    primaryForeground: '210 40% 98%',
    ring: '206 100% 42%',
    secondary: '206 35% 95%',
    secondaryForeground: '206 100% 17%',
    accent: '206 35% 95%',
    accentForeground: '206 100% 17%',
  },
  forest: {
    primaryScale: {
      '50': '143 43% 95%',
      '100': '141 46% 90%',
      '200': '141 47% 81%',
      '300': '142 45% 70%',
      '400': '144 43% 54%',
      '500': '147 64% 34%',
      '600': '147 64% 30%',
      '700': '149 63% 24%',
      '800': '149 63% 19%',
      '900': '150 60% 16%',
      '950': '153 58% 9%',
    },
    primary: '147 64% 34%',
    primaryForeground: '210 40% 98%',
    ring: '147 64% 34%',
    secondary: '143 30% 95%',
    secondaryForeground: '150 60% 16%',
    accent: '143 30% 95%',
    accentForeground: '150 60% 16%',
  },
  red: {
    primaryScale: {
      '50': '0 86% 97%',
      '100': '0 93% 94%',
      '200': '0 96% 89%',
      '300': '0 94% 82%',
      '400': '0 91% 71%',
      '500': '0 84% 60%',
      '600': '0 72% 51%',
      '700': '0 74% 42%',
      '800': '0 70% 35%',
      '900': '0 63% 31%',
      '950': '0 75% 15%',
    },
    primary: '0 72% 51%',
    primaryForeground: '210 40% 98%',
    ring: '0 72% 51%',
    secondary: '0 24% 95%',
    secondaryForeground: '0 63% 31%',
    accent: '0 24% 95%',
    accentForeground: '0 63% 31%',
  },
  gray: {
    primaryScale: {
      '50': '220 10% 97%',
      '100': '220 10% 94%',
      '200': '220 10% 86%',
      '300': '220 11% 75%',
      '400': '220 11% 61%',
      '500': '220 10% 47%',
      '600': '220 9% 39%',
      '700': '220 10% 31%',
      '800': '220 11% 22%',
      '900': '220 14% 15%',
      '950': '220 18% 8%',
    },
    primary: '220 10% 47%',
    primaryForeground: '210 40% 98%',
    ring: '220 10% 47%',
    secondary: '220 10% 94%',
    secondaryForeground: '220 14% 15%',
    accent: '220 10% 94%',
    accentForeground: '220 14% 15%',
  },
};

const DARK_VARIANT_CONFIG: Record<DarkVariant, DarkVariantConfig> = {
  current: {
    appBg: '#171c1a',
    sidebarBg: '#1d2320',
    cardBg: '#202723',
    borderColor: '#323a35',
    hoverBg: '#2a332e',
    textPrimary: '#f2f5fa',
    textMuted: '#9aa5b2',
    overlayBg: 'rgba(5, 10, 20, 0.55)',
    overlaySoftBg: 'rgba(5, 10, 20, 0.35)',
  },
  github: {
    appBg: '#101412',
    sidebarBg: '#171c19',
    cardBg: '#1b211e',
    borderColor: '#2d3430',
    hoverBg: '#242c28',
    textPrimary: '#edf2ee',
    textMuted: '#a8b2ac',
    overlayBg: 'rgba(1, 4, 9, 0.55)',
    overlaySoftBg: 'rgba(1, 4, 9, 0.35)',
  },
};

const normalizeTheme = (value: unknown): ThemeMode => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'light';
};

const normalizeColorTheme = (value: unknown): UIColorTheme => {
  if (
    value === 'default' ||
    value === 'indigo' ||
    value === 'microsoft' ||
    value === 'forest' ||
    value === 'red' ||
    value === 'gray'
  ) {
    return value;
  }
  return 'default';
};

const normalizeDarkVariant = (value: unknown): DarkVariant => {
  if (value === 'current' || value === 'github') {
    return value;
  }
  return 'current';
};

const normalizeAppScale = (value: unknown): AppScale => {
  if (value === 100 || value === 110 || value === 120) {
    return value;
  }

  const parsed = Number(value);
  if (parsed === 100 || parsed === 110 || parsed === 120) {
    return parsed as AppScale;
  }

  return 110;
};

const isDarkMode = (theme: ThemeMode): boolean => {
  if (theme === 'dark') {
    return true;
  }

  if (theme === 'light') {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyThemeClass = (theme: ThemeMode) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    return;
  }

  if (theme === 'light') {
    root.classList.remove('dark');
    return;
  }

  if (isDarkMode(theme)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const applyAccentThemeVariables = (colorTheme: UIColorTheme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const config = COLOR_THEME_CONFIG[colorTheme];

  Object.entries(config.primaryScale).forEach(([shade, value]) => {
    root.style.setProperty(`--primary-${shade}-hsl`, value);
  });

  root.style.setProperty('--primary', config.primary);
  root.style.setProperty('--primary-foreground', config.primaryForeground);
  root.style.setProperty('--ring', config.ring);
  root.style.setProperty('--secondary', config.secondary);
  root.style.setProperty('--secondary-foreground', config.secondaryForeground);
  root.style.setProperty('--accent', config.accent);
  root.style.setProperty('--accent-foreground', config.accentForeground);
};

const applyDarkVariantVariables = (darkVariant: DarkVariant) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const config = DARK_VARIANT_CONFIG[darkVariant];

  root.style.setProperty('--app-bg', config.appBg);
  root.style.setProperty('--sidebar-bg', config.sidebarBg);
  root.style.setProperty('--card-bg', config.cardBg);
  root.style.setProperty('--border-color', config.borderColor);
  root.style.setProperty('--hover-bg', config.hoverBg);
  root.style.setProperty('--text-primary', config.textPrimary);
  root.style.setProperty('--text-muted', config.textMuted);
  root.style.setProperty('--overlay-bg', config.overlayBg);
  root.style.setProperty('--overlay-soft-bg', config.overlaySoftBg);
  root.style.setProperty('--app-bg-rgb', hexToRgbTriplet(config.appBg, '29, 36, 45'));
  root.style.setProperty('--sidebar-bg-rgb', hexToRgbTriplet(config.sidebarBg, '23, 29, 37'));
  root.style.setProperty('--card-bg-rgb', hexToRgbTriplet(config.cardBg, '39, 49, 61'));
  root.style.setProperty('--hover-bg-rgb', hexToRgbTriplet(config.hoverBg, '49, 61, 75'));
  root.style.setProperty('--border-rgb', hexToRgbTriplet(config.borderColor, '62, 74, 89'));
};

const clearDarkVariantVariables = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  [
    '--app-bg',
    '--sidebar-bg',
    '--card-bg',
    '--border-color',
    '--hover-bg',
    '--text-primary',
    '--text-muted',
    '--overlay-bg',
    '--overlay-soft-bg',
    '--app-bg-rgb',
    '--sidebar-bg-rgb',
    '--card-bg-rgb',
    '--hover-bg-rgb',
    '--border-rgb',
  ].forEach((property) => {
    root.style.removeProperty(property);
  });
};

type ThemePrefs = {
  theme: ThemeMode;
  colorTheme: UIColorTheme;
  darkVariant: DarkVariant;
  appScale: AppScale;
};

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleSyncToServer = (prefs: ThemePrefs) => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  if (!token) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    http.patch(APIS.USER_PREFERENCES, prefs).catch(() => {});
  }, 800);
};

const applyAppScaleVariable = (appScale: AppScale) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.style.setProperty('--app-scale', `${appScale / 100}`);
};

const applyVisualTheme = ({
  theme,
  colorTheme,
  darkVariant,
}: {
  theme: ThemeMode;
  colorTheme: UIColorTheme;
  darkVariant: DarkVariant;
}) => {
  applyThemeClass(theme);
  applyAccentThemeVariables(colorTheme);

  if (isDarkMode(theme)) {
    applyDarkVariantVariables(darkVariant);
  } else {
    clearDarkVariantVariables();
  }
};

let systemThemeListenerAttached = false;

const ensureSystemThemeListener = (getState: () => {
  theme: ThemeMode;
  colorTheme: UIColorTheme;
  darkVariant: DarkVariant;
}) => {
  if (typeof window === 'undefined' || systemThemeListenerAttached) {
    return;
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    const { theme, colorTheme, darkVariant } = getState();
    if (theme !== 'system') {
      return;
    }

    applyVisualTheme({
      theme,
      colorTheme,
      darkVariant,
    });
  };

  mediaQuery.addEventListener('change', handleSystemThemeChange);
  systemThemeListenerAttached = true;
};

interface UIState {
  theme: ThemeMode;
  colorTheme: UIColorTheme;
  darkVariant: DarkVariant;
  appScale: AppScale;
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  selectionCount: number;
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: UIColorTheme) => void;
  applyBusinessColorTheme: (colorTheme: UIColorTheme) => void;
  setDarkVariant: (darkVariant: DarkVariant) => void;
  setAppScale: (appScale: AppScale) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setSelectionCount: (count: number) => void;
  loadThemeFromDB: () => Promise<void>;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      colorTheme: 'forest',
      darkVariant: 'current',
      appScale: 110,
      sidebarCollapsed: false,
      sidebarOpen: false,
      selectionCount: 0,

      setTheme: (theme) => {
        const normalizedTheme = normalizeTheme(theme);
        const { colorTheme, darkVariant, appScale } = get();
        set({ theme: normalizedTheme });
        applyVisualTheme({ theme: normalizedTheme, colorTheme, darkVariant });
        scheduleSyncToServer({ theme: normalizedTheme, colorTheme, darkVariant, appScale });
      },

      setColorTheme: (colorTheme) => {
        const normalizedColorTheme = normalizeColorTheme(colorTheme);
        const { theme, darkVariant, appScale } = get();
        set({ colorTheme: normalizedColorTheme });
        applyVisualTheme({ theme, colorTheme: normalizedColorTheme, darkVariant });
        scheduleSyncToServer({ theme, colorTheme: normalizedColorTheme, darkVariant, appScale });
      },

      // Apply business-level color theme without saving to user preferences
      applyBusinessColorTheme: (colorTheme) => {
        const normalizedColorTheme = normalizeColorTheme(colorTheme);
        const { theme, darkVariant } = get();
        set({ colorTheme: normalizedColorTheme });
        applyVisualTheme({ theme, colorTheme: normalizedColorTheme, darkVariant });
      },

      setDarkVariant: (darkVariant) => {
        const normalizedDarkVariant = normalizeDarkVariant(darkVariant);
        const { theme, colorTheme, appScale } = get();
        set({ darkVariant: normalizedDarkVariant });
        applyVisualTheme({ theme, colorTheme, darkVariant: normalizedDarkVariant });
        scheduleSyncToServer({ theme, colorTheme, darkVariant: normalizedDarkVariant, appScale });
      },

      setAppScale: (appScale) => {
        const normalizedAppScale = normalizeAppScale(appScale);
        const { theme, colorTheme, darkVariant } = get();
        set({ appScale: normalizedAppScale });
        applyAppScaleVariable(normalizedAppScale);
        scheduleSyncToServer({ theme, colorTheme, darkVariant, appScale: normalizedAppScale });
      },

      loadThemeFromDB: async () => {
        try {
          const res = await http.get(APIS.USER_PREFERENCES);
          const data = res.data as Partial<ThemePrefs>;
          // Only override keys that the DB actually returned — never reset to defaults
          if (!data || Object.keys(data).length === 0) return;
          const current = get();
          const newTheme = data.theme != null ? normalizeTheme(data.theme) : current.theme;
          const newColorTheme = data.colorTheme != null ? normalizeColorTheme(data.colorTheme) : current.colorTheme;
          const newDarkVariant = data.darkVariant != null ? normalizeDarkVariant(data.darkVariant) : current.darkVariant;
          const newAppScale = data.appScale != null ? normalizeAppScale(data.appScale) : current.appScale;
          set({ theme: newTheme, colorTheme: newColorTheme, darkVariant: newDarkVariant, appScale: newAppScale });
          applyVisualTheme({ theme: newTheme, colorTheme: newColorTheme, darkVariant: newDarkVariant });
          applyAppScaleVariable(newAppScale);
        } catch {
          // Silently fail — localStorage values remain in effect
        }
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setSelectionCount: (count) => {
        set({ selectionCount: count });
      },

      toggleTheme: () => {
        const { theme } = get();
        const nextTheme =
          theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        get().setTheme(nextTheme);
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        colorTheme: state.colorTheme,
        darkVariant: state.darkVariant,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        const normalizedTheme = normalizeTheme(state?.theme);
        const normalizedColorTheme = normalizeColorTheme(state?.colorTheme);
        const normalizedDarkVariant = normalizeDarkVariant(state?.darkVariant);
        const normalizedAppScale = normalizeAppScale(state?.appScale);

        if (state) {
          state.theme = normalizedTheme;
          state.colorTheme = normalizedColorTheme;
          state.darkVariant = normalizedDarkVariant;
          state.appScale = normalizedAppScale;
        }

        applyVisualTheme({
          theme: normalizedTheme,
          colorTheme: normalizedColorTheme,
          darkVariant: normalizedDarkVariant,
        });
        applyAppScaleVariable(normalizedAppScale);

        ensureSystemThemeListener(() => {
          const currentState = useUIStore.getState();
          return {
            theme: currentState.theme,
            colorTheme: currentState.colorTheme,
            darkVariant: currentState.darkVariant,
          };
        });
      },
    }
  )
);

ensureSystemThemeListener(() => {
  const currentState = useUIStore.getState();
  return {
    theme: currentState.theme,
    colorTheme: currentState.colorTheme,
    darkVariant: currentState.darkVariant,
  };
});

applyAppScaleVariable(normalizeAppScale(useUIStore.getState().appScale));
