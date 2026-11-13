export type Theme = { name: string; swatch: string; vars: Record<string, string> }

export const THEME_ORDER = ['paper', 'midnight', 'graphite', 'aurora'] as const
export type ThemeKey = (typeof THEME_ORDER)[number]

// Each theme sets CSS variables on the page; every colour in the app reads from them.
export const THEMES: Record<ThemeKey, Theme> = {
  paper: {
    name: 'Paper',
    swatch: '#1F5FBF',
    vars: {
      '--bg': '#F6F5F1', '--panel': '#FFFFFF', '--border': '#E4E1D8', '--text': '#1B1F24', '--muted': '#5B6470',
      '--accent': '#1F5FBF', '--track': '#ECE9E0', '--whisker': '#8FA6C8', '--band': '#BFD3F2', '--median': '#1F5FBF',
      '--dot': '#1B1F24', '--ring': '#FFFFFF', '--pill': '#FFFFFF', '--pillText': '#1B1F24', '--pillBorder': '#CFCBBF',
      '--pillOn': '#1B1F24', '--pillOnText': '#FFFFFF', '--warnBg': '#FFF3D6', '--warnBorder': '#E9C877',
      '--warnText': '#4A3500', '--inputBg': '#FFFFFF', '--shadow': 'none', '--blur': 'none',
      '--display': 'Inter, system-ui, sans-serif', '--num': '#1B1F24', '--rowLine': '#F0EEE6',
      '--s0b': '#E8EEF9', '--s0t': '#1B1F24', '--s1b': '#BFD3F2', '--s1t': '#1B1F24',
      '--s2b': '#6F9BDD', '--s2t': '#0B1B33', '--s3b': '#1F5FBF', '--s3t': '#FFFFFF',
    },
  },
  midnight: {
    name: 'Midnight',
    swatch: '#5EEAD4',
    vars: {
      '--bg': 'radial-gradient(900px 520px at 85% -8%, rgba(94,234,212,0.14), transparent 60%), radial-gradient(800px 480px at -5% 0%, rgba(139,124,255,0.18), transparent 60%), #070A12',
      '--panel': 'rgba(255,255,255,0.045)', '--border': 'rgba(160,190,255,0.16)', '--text': '#EAF0FF', '--muted': '#9FB0CC',
      '--accent': '#5EEAD4', '--track': 'rgba(255,255,255,0.08)', '--whisker': '#5E7BA6', '--band': '#1E6F73',
      '--median': '#5EEAD4', '--dot': '#EAF0FF', '--ring': '#0A0F1C', '--pill': 'rgba(255,255,255,0.05)',
      '--pillText': '#EAF0FF', '--pillBorder': 'rgba(160,190,255,0.28)', '--pillOn': '#5EEAD4', '--pillOnText': '#04141A',
      '--warnBg': 'rgba(250,204,21,0.10)', '--warnBorder': 'rgba(250,204,21,0.45)', '--warnText': '#FDE68A',
      '--inputBg': '#0D1424', '--shadow': '0 0 0 1px rgba(94,234,212,0.05), 0 16px 48px rgba(0,0,0,0.5)',
      '--blur': 'blur(10px)', '--display': 'Sora, Inter, system-ui, sans-serif', '--num': '#F4F8FF',
      '--rowLine': 'rgba(160,190,255,0.10)',
      '--s0b': '#16233A', '--s0t': '#C9D6EE', '--s1b': '#1F4B63', '--s1t': '#EAF0FF',
      '--s2b': '#2FA6A0', '--s2t': '#031A1C', '--s3b': '#5EEAD4', '--s3t': '#031A1C',
    },
  },
  graphite: {
    name: 'Graphite',
    swatch: '#D4AF6A',
    vars: {
      '--bg': '#111111', '--panel': '#1A1A19', '--border': '#2E2B25', '--text': '#F3EEE4', '--muted': '#A8A093',
      '--accent': '#D4AF6A', '--track': '#26241F', '--whisker': '#7A6A44', '--band': '#5A4A24', '--median': '#D4AF6A',
      '--dot': '#F3EEE4', '--ring': '#1A1A19', '--pill': '#1A1A19', '--pillText': '#F3EEE4', '--pillBorder': '#3A362D',
      '--pillOn': '#D4AF6A', '--pillOnText': '#1A1405', '--warnBg': '#2A2310', '--warnBorder': '#7A6420',
      '--warnText': '#F3DFA0', '--inputBg': '#1A1A19', '--shadow': '0 10px 30px rgba(0,0,0,0.4)', '--blur': 'none',
      '--display': 'Fraunces, Georgia, serif', '--num': '#F3EEE4', '--rowLine': '#26241F',
      '--s0b': '#24211B', '--s0t': '#D8D0C0', '--s1b': '#4A3F26', '--s1t': '#F3EEE4',
      '--s2b': '#B8954A', '--s2t': '#14100A', '--s3b': '#E6C98A', '--s3t': '#14100A',
    },
  },
  aurora: {
    name: 'Aurora',
    swatch: '#4F46E5',
    vars: {
      '--bg': 'linear-gradient(135deg, #EEF2FF 0%, #F6F0FF 45%, #E6FAF5 100%)', '--panel': 'rgba(255,255,255,0.72)',
      '--border': 'rgba(99,102,241,0.20)', '--text': '#111827', '--muted': '#4B5563', '--accent': '#4F46E5',
      '--track': 'rgba(99,102,241,0.12)', '--whisker': '#8B96D8', '--band': '#C7D2FE', '--median': '#4F46E5',
      '--dot': '#111827', '--ring': '#FFFFFF', '--pill': 'rgba(255,255,255,0.8)', '--pillText': '#111827',
      '--pillBorder': 'rgba(99,102,241,0.28)', '--pillOn': '#3730A3', '--pillOnText': '#FFFFFF',
      '--warnBg': '#FEF3C7', '--warnBorder': '#E5B84B', '--warnText': '#4A3500', '--inputBg': 'rgba(255,255,255,0.9)',
      '--shadow': '0 12px 40px rgba(79,70,229,0.12)', '--blur': 'blur(8px)',
      '--display': 'Sora, Inter, system-ui, sans-serif', '--num': '#111827', '--rowLine': 'rgba(99,102,241,0.10)',
      '--s0b': '#EEF0FF', '--s0t': '#111827', '--s1b': '#C7D2FE', '--s1t': '#111827',
      '--s2b': '#818CF8', '--s2t': '#0B0B2E', '--s3b': '#4338CA', '--s3t': '#FFFFFF',
    },
  },
}

const STORAGE_KEY = 'player-form-theme'

/** Remembers the viewer's theme in this browser only. Falls back to Paper if storage is blocked. */
export function loadTheme(): ThemeKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (THEME_ORDER as readonly string[]).includes(v)) return v as ThemeKey
  } catch {
    /* storage blocked: use the default */
  }
  return 'paper'
}

export function saveTheme(key: ThemeKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    /* storage blocked: the choice just is not remembered */
  }
}
