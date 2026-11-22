import type { ITheme } from 'ghostty-web';

export type TerminalCursorStyle = 'block' | 'bar' | 'underline';

export type TerminalShaderId =
  | 'none'
  | 'bloom'
  | 'bettercrt'
  | 'retro-terminal'
  | 'vhs'
  | 'glitch'
  | 'starfield'
  | 'matrix'
  | 'cursor-warp'
  | 'local-glsl'
  | 'custom-glsl';

export interface TerminalThemePreset {
  id: string;
  name: string;
  ghosttyName: string;
  mode: 'dark' | 'light';
  tags: string[];
  description: string;
  theme: Required<
    Pick<
      ITheme,
      | 'background'
      | 'foreground'
      | 'cursor'
      | 'cursorAccent'
      | 'selectionBackground'
      | 'black'
      | 'red'
      | 'green'
      | 'yellow'
      | 'blue'
      | 'magenta'
      | 'cyan'
      | 'white'
      | 'brightBlack'
      | 'brightRed'
      | 'brightGreen'
      | 'brightYellow'
      | 'brightBlue'
      | 'brightMagenta'
      | 'brightCyan'
      | 'brightWhite'
    >
  >;
}

export interface TerminalShaderPreset {
  id: TerminalShaderId;
  label: string;
  category: 'clean' | 'crt' | 'glow' | 'ambient' | 'cursor' | 'custom';
  description: string;
}

export interface TerminalSettings {
  themeId: string;
  followAppMode: boolean;
  lightThemeId: string;
  darkThemeId: string;
  customOverrides: Partial<ITheme>;
  fontFamily: string;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  cursorStyle: TerminalCursorStyle;
  cursorBlink: boolean;
  backgroundOpacity: number;
  backgroundBlur: number;
  shaderId: TerminalShaderId;
  shaderIntensity: number;
  localShaderPath: string;
  customGlsl: string;
}

export const TERMINAL_SETTINGS_STORAGE_KEY = 'lanes.terminalSettings.v1';

export const TERMINAL_FONT_OPTIONS: { id: string; label: string; stack: string }[] = [
  { id: 'SF Mono', label: 'SF Mono', stack: '"SF Mono", ui-monospace, Menlo, monospace' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono', stack: '"JetBrains Mono", "SF Mono", Menlo, monospace' },
  { id: 'Geist Mono', label: 'Geist Mono', stack: '"Geist Mono", "SF Mono", Menlo, monospace' },
  { id: 'Fira Code', label: 'Fira Code', stack: '"Fira Code", "SF Mono", Menlo, monospace' },
  { id: 'Menlo', label: 'Menlo', stack: 'Menlo, "SF Mono", monospace' },
  { id: 'Monaco', label: 'Monaco', stack: 'Monaco, Menlo, monospace' },
];

export const TERMINAL_THEME_PRESETS: TerminalThemePreset[] = [
  {
    id: 'lanes-dark',
    name: 'Lanes Slate',
    ghosttyName: 'Lanes Slate',
    mode: 'dark',
    tags: ['minimal', 'calm'],
    description: 'Lanes default dark terminal with balanced Slate contrast.',
    theme: {
      background: '#16171a',
      foreground: '#e6e8ec',
      cursor: '#ffb4a1',
      cursorAccent: '#16171a',
      selectionBackground: '#303642',
      black: '#23262d',
      red: '#f07178',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#d0d5df',
      brightBlack: '#5c6370',
      brightRed: '#ff8a90',
      brightGreen: '#b5e096',
      brightYellow: '#f2d399',
      brightBlue: '#84c5fa',
      brightMagenta: '#dc9ef0',
      brightCyan: '#77d4e0',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    ghosttyName: 'iTerm2 Solarized Dark',
    mode: 'dark',
    tags: ['classic', 'calm'],
    description: 'Deep teal-slate Solarized palette — matches your Ghostty dark default.',
    theme: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#93a1a1',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    ghosttyName: 'iTerm2 Solarized Light',
    mode: 'light',
    tags: ['classic', 'warm'],
    description: 'Warm parchment Solarized palette — matches your Ghostty light default.',
    theme: {
      background: '#fdf6e3',
      foreground: '#586e75',
      cursor: '#586e75',
      cursorAccent: '#fdf6e3',
      selectionBackground: '#eee8d5',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    ghosttyName: 'TokyoNight',
    mode: 'dark',
    tags: ['vivid', 'popular'],
    description: 'Indigo midnight background with crisp neon cyan and violet.',
    theme: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    ghosttyName: 'Catppuccin Mocha',
    mode: 'dark',
    tags: ['pastel', 'popular'],
    description: 'Soothing pastel accents on velvety espresso charcoal.',
    theme: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#45475a',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    ghosttyName: 'Catppuccin Latte',
    mode: 'light',
    tags: ['pastel', 'minimal'],
    description: 'Clean warm-white daylight palette with high-contrast pastels.',
    theme: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      cursor: '#dc8a78',
      cursorAccent: '#eff1f5',
      selectionBackground: '#ccd0da',
      black: '#5c5f77',
      red: '#d20f39',
      green: '#40a02b',
      yellow: '#df8e1d',
      blue: '#1e66f5',
      magenta: '#ea76cb',
      cyan: '#179299',
      white: '#acb0be',
      brightBlack: '#6c6f85',
      brightRed: '#d20f39',
      brightGreen: '#40a02b',
      brightYellow: '#df8e1d',
      brightBlue: '#1e66f5',
      brightMagenta: '#ea76cb',
      brightCyan: '#179299',
      brightWhite: '#bcc0cc',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    ghosttyName: 'Dracula',
    mode: 'dark',
    tags: ['vivid', 'classic'],
    description: 'High-contrast purple-slate dark with pink, mint, and cyan syntax.',
    theme: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    ghosttyName: 'Gruvbox Dark',
    mode: 'dark',
    tags: ['warm', 'retro'],
    description: 'Earthy retro groove with terracotta red, ochre yellow, and sage.',
    theme: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#fe8019',
      cursorAccent: '#282828',
      selectionBackground: '#504945',
      black: '#282828',
      red: '#cc241d',
      green: '#98971a',
      yellow: '#d79921',
      blue: '#458588',
      magenta: '#b16286',
      cyan: '#689d6a',
      white: '#a89984',
      brightBlack: '#928374',
      brightRed: '#fb4934',
      brightGreen: '#b8bb26',
      brightYellow: '#fabd2f',
      brightBlue: '#83a598',
      brightMagenta: '#d3869b',
      brightCyan: '#8ec07c',
      brightWhite: '#ebdbb2',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    ghosttyName: 'Nord',
    mode: 'dark',
    tags: ['calm', 'minimal'],
    description: 'Arctic frost blues and muted snow whites for low eye strain.',
    theme: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    ghosttyName: 'Rose Pine',
    mode: 'dark',
    tags: ['warm', 'pastel'],
    description: 'Soho vibes with muted rose, gold, pine, and foam accents.',
    theme: {
      background: '#191724',
      foreground: '#e0def4',
      cursor: '#ebbcba',
      cursorAccent: '#191724',
      selectionBackground: '#403d52',
      black: '#26233a',
      red: '#eb6f92',
      green: '#31748f',
      yellow: '#f6c177',
      blue: '#9ccfd8',
      magenta: '#c4a7e7',
      cyan: '#ebbcba',
      white: '#e0def4',
      brightBlack: '#6e6a86',
      brightRed: '#eb6f92',
      brightGreen: '#31748f',
      brightYellow: '#f6c177',
      brightBlue: '#9ccfd8',
      brightMagenta: '#c4a7e7',
      brightCyan: '#ebbcba',
      brightWhite: '#e0def4',
    },
  },
  {
    id: 'kanagawa',
    name: 'Kanagawa',
    ghosttyName: 'Kanagawa Wave',
    mode: 'dark',
    tags: ['warm', 'calm'],
    description: 'Inspired by Hokusai ink washes — sumi-ink dark and sakura pink.',
    theme: {
      background: '#1f1f28',
      foreground: '#dcd7ba',
      cursor: '#c8c093',
      cursorAccent: '#1f1f28',
      selectionBackground: '#2d4f67',
      black: '#090618',
      red: '#c34043',
      green: '#76946a',
      yellow: '#c0a36e',
      blue: '#7e9cd8',
      magenta: '#957fb8',
      cyan: '#6a9589',
      white: '#c8c093',
      brightBlack: '#727169',
      brightRed: '#e82424',
      brightGreen: '#98bb6c',
      brightYellow: '#e6c384',
      brightBlue: '#7fb4ca',
      brightMagenta: '#938aa9',
      brightCyan: '#7aa89f',
      brightWhite: '#dcd7ba',
    },
  },
  {
    id: 'retro-phosphor',
    name: 'Phosphor CRT',
    ghosttyName: 'Phosphor CRT',
    mode: 'dark',
    tags: ['retro', 'vivid'],
    description: 'Classic P31 green phosphor monitor — pairs best with Better CRT or Bloom.',
    theme: {
      background: '#08110b',
      foreground: '#5af78e',
      cursor: '#7cffaa',
      cursorAccent: '#08110b',
      selectionBackground: '#173823',
      black: '#0c1a11',
      red: '#ff6b6b',
      green: '#5af78e',
      yellow: '#d8f772',
      blue: '#56d6b0',
      magenta: '#8df0b8',
      cyan: '#6ef2d6',
      white: '#b8f7cb',
      brightBlack: '#2b593c',
      brightRed: '#ff8787',
      brightGreen: '#7cffaa',
      brightYellow: '#e6ff99',
      brightBlue: '#7decd0',
      brightMagenta: '#b0f9cf',
      brightCyan: '#96fce5',
      brightWhite: '#e6ffed',
    },
  },
  {
    id: 'paper-light',
    name: 'Lanes Paper',
    ghosttyName: 'Lanes Paper',
    mode: 'light',
    tags: ['minimal', 'calm'],
    description: 'Crisp studio paper background tuned for daylight coding.',
    theme: {
      background: '#f8f9fb',
      foreground: '#1f2329',
      cursor: '#942d10',
      cursorAccent: '#f8f9fb',
      selectionBackground: '#dce6f5',
      black: '#1f2329',
      red: '#b91c1c',
      green: '#15803d',
      yellow: '#a16207',
      blue: '#1d4ed8',
      magenta: '#7e22ce',
      cyan: '#0f766e',
      white: '#6b7280',
      brightBlack: '#4b5563',
      brightRed: '#dc2626',
      brightGreen: '#16a34a',
      brightYellow: '#ca8a04',
      brightBlue: '#2563eb',
      brightMagenta: '#9333ea',
      brightCyan: '#0d9488',
      brightWhite: '#111827',
    },
  },
];

export const TERMINAL_SHADER_PRESETS: TerminalShaderPreset[] = [
  { id: 'none', label: 'Off (Clean)', category: 'clean', description: 'Crisp native Ghostty canvas with no post-processing.' },
  { id: 'bloom', label: 'Phosphor Bloom', category: 'glow', description: 'Soft golden-spiral glow around bright terminal text.' },
  { id: 'bettercrt', label: 'Better CRT', category: 'crt', description: 'Subtle glass curvature and fine CRT scanlines.' },
  { id: 'retro-terminal', label: 'Retro CRT Tint', category: 'crt', description: 'Warm phosphor scanlines with subtle vignette and glow.' },
  { id: 'vhs', label: 'VHS Tape', category: 'crt', description: 'Chromatic fringe, tracking drift, and analog grain.' },
  { id: 'glitch', label: 'RGB Split', category: 'glow', description: 'Crisp subtle chromatic aberration around bright glyphs.' },
  { id: 'starfield', label: 'Starfield', category: 'ambient', description: 'Drifting deep-space stars blended behind terminal text.' },
  { id: 'matrix', label: 'Matrix Rain', category: 'ambient', description: 'Subtle falling emerald code columns behind your shell.' },
  { id: 'cursor-warp', label: 'Cursor Warp', category: 'cursor', description: 'Neovide / Ghostty-style smooth comet smear as your cursor jumps.' },
];

export const DEFAULT_CUSTOM_GLSL = `// Ghostty-compatible Shadertoy GLSL fragment shader
// Available: iResolution, iTime, iChannel0 (terminal), iCurrentCursor, iPreviousCursor, uIntensity
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 base = texture(iChannel0, uv);
  float scan = sin(fragCoord.y * 1.5) * 0.06 * uIntensity;
  vec2 d = uv - 0.5;
  float vig = 1.0 - dot(d, d) * 0.45 * uIntensity;
  fragColor = vec4((base.rgb - scan) * vig, base.a);
}`;

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  themeId: 'lanes-dark',
  followAppMode: false,
  lightThemeId: 'solarized-light',
  darkThemeId: 'solarized-dark',
  customOverrides: {},
  fontFamily: 'SF Mono',
  fontSize: 13,
  paddingX: 12,
  paddingY: 10,
  cursorStyle: 'block',
  cursorBlink: true,
  backgroundOpacity: 1,
  backgroundBlur: 0,
  shaderId: 'none',
  shaderIntensity: 0.85,
  localShaderPath: '',
  customGlsl: DEFAULT_CUSTOM_GLSL,
};

export const ANSI_PALETTE_KEYS: (keyof ITheme)[] = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(candidate)) return null;
  if (candidate.length === 4) {
    return `#${candidate[1]}${candidate[1]}${candidate[2]}${candidate[2]}${candidate[3]}${candidate[3]}`.toLowerCase();
  }
  return candidate.toLowerCase();
}

export function findThemePresetByName(name: string): TerminalThemePreset | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return TERMINAL_THEME_PRESETS.find(
    (p) =>
      p.id.toLowerCase() === needle ||
      p.name.toLowerCase() === needle ||
      p.ghosttyName.toLowerCase() === needle ||
      needle.includes(p.name.toLowerCase()) ||
      p.ghosttyName.toLowerCase().includes(needle)
  );
}

export function getFontStack(fontFamily: string): string {
  const found = TERMINAL_FONT_OPTIONS.find((f) => f.id === fontFamily);
  if (found) return found.stack;
  const safe = fontFamily.replace(/["\\;]/g, '').trim();
  return safe ? `"${safe}", "SF Mono", ui-monospace, Menlo, monospace` : TERMINAL_FONT_OPTIONS[0].stack;
}

export function resolveActiveTerminalTheme(
  settings: TerminalSettings,
  appIsDark: boolean
): { preset: TerminalThemePreset; theme: ITheme } {
  const targetId = settings.followAppMode
    ? appIsDark
      ? settings.darkThemeId
      : settings.lightThemeId
    : settings.themeId;

  const preset =
    TERMINAL_THEME_PRESETS.find((t) => t.id === targetId) ??
    TERMINAL_THEME_PRESETS[0];

  const theme: ITheme = {
    ...preset.theme,
    ...settings.customOverrides,
  };

  return { preset, theme };
}

export function sanitizeTerminalSettings(raw: unknown): TerminalSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TERMINAL_SETTINGS, customOverrides: {} };
  }
  const obj = raw as Partial<TerminalSettings>;
  const validTheme = (id: unknown, fallback: string) =>
    typeof id === 'string' && TERMINAL_THEME_PRESETS.some((t) => t.id === id) ? id : fallback;

  const validShaders: TerminalShaderId[] = [
    'none',
    'bloom',
    'bettercrt',
    'retro-terminal',
    'vhs',
    'glitch',
    'starfield',
    'matrix',
    'cursor-warp',
    'local-glsl',
    'custom-glsl',
  ];

  const cleanOverrides: Partial<ITheme> = {};
  if (obj.customOverrides && typeof obj.customOverrides === 'object') {
    const allowedKeys: (keyof ITheme)[] = [
      'background',
      'foreground',
      'cursor',
      'cursorAccent',
      'selectionBackground',
      'selectionForeground',
      ...ANSI_PALETTE_KEYS,
    ];
    for (const key of allowedKeys) {
      const val = (obj.customOverrides as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        const hex = normalizeHexColor(val);
        if (hex) cleanOverrides[key] = hex;
      }
    }
  }

  return {
    themeId: validTheme(obj.themeId, DEFAULT_TERMINAL_SETTINGS.themeId),
    followAppMode: Boolean(obj.followAppMode),
    lightThemeId: validTheme(obj.lightThemeId, DEFAULT_TERMINAL_SETTINGS.lightThemeId),
    darkThemeId: validTheme(obj.darkThemeId, DEFAULT_TERMINAL_SETTINGS.darkThemeId),
    customOverrides: cleanOverrides,
    fontFamily:
      typeof obj.fontFamily === 'string' && obj.fontFamily.trim()
        ? obj.fontFamily.trim().slice(0, 64)
        : DEFAULT_TERMINAL_SETTINGS.fontFamily,
    fontSize:
      typeof obj.fontSize === 'number' && Number.isFinite(obj.fontSize)
        ? Math.min(22, Math.max(10, Math.round(obj.fontSize)))
        : DEFAULT_TERMINAL_SETTINGS.fontSize,
    paddingX:
      typeof obj.paddingX === 'number' && Number.isFinite(obj.paddingX)
        ? Math.min(32, Math.max(0, Math.round(obj.paddingX)))
        : DEFAULT_TERMINAL_SETTINGS.paddingX,
    paddingY:
      typeof obj.paddingY === 'number' && Number.isFinite(obj.paddingY)
        ? Math.min(28, Math.max(0, Math.round(obj.paddingY)))
        : DEFAULT_TERMINAL_SETTINGS.paddingY,
    cursorStyle:
      obj.cursorStyle === 'block' || obj.cursorStyle === 'bar' || obj.cursorStyle === 'underline'
        ? obj.cursorStyle
        : DEFAULT_TERMINAL_SETTINGS.cursorStyle,
    cursorBlink: typeof obj.cursorBlink === 'boolean' ? obj.cursorBlink : DEFAULT_TERMINAL_SETTINGS.cursorBlink,
    backgroundOpacity:
      typeof obj.backgroundOpacity === 'number' && Number.isFinite(obj.backgroundOpacity)
        ? Math.min(1, Math.max(0.55, Number(obj.backgroundOpacity.toFixed(2))))
        : DEFAULT_TERMINAL_SETTINGS.backgroundOpacity,
    backgroundBlur:
      typeof obj.backgroundBlur === 'number' && Number.isFinite(obj.backgroundBlur)
        ? Math.min(24, Math.max(0, Math.round(obj.backgroundBlur)))
        : DEFAULT_TERMINAL_SETTINGS.backgroundBlur,
    shaderId:
      typeof obj.shaderId === 'string' && validShaders.includes(obj.shaderId as TerminalShaderId)
        ? (obj.shaderId as TerminalShaderId)
        : DEFAULT_TERMINAL_SETTINGS.shaderId,
    shaderIntensity:
      typeof obj.shaderIntensity === 'number' && Number.isFinite(obj.shaderIntensity)
        ? Math.min(1.5, Math.max(0.15, Number(obj.shaderIntensity.toFixed(2))))
        : DEFAULT_TERMINAL_SETTINGS.shaderIntensity,
    localShaderPath:
      typeof obj.localShaderPath === 'string' ? obj.localShaderPath.trim().slice(0, 200) : '',
    customGlsl:
      typeof obj.customGlsl === 'string' && obj.customGlsl.trim()
        ? obj.customGlsl
        : DEFAULT_CUSTOM_GLSL,
  };
}

export function loadTerminalSettings(): TerminalSettings {
  try {
    const raw = window.localStorage.getItem(TERMINAL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TERMINAL_SETTINGS, customOverrides: {} };
    return sanitizeTerminalSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TERMINAL_SETTINGS, customOverrides: {} };
  }
}

export function saveTerminalSettings(settings: TerminalSettings): void {
  try {
    window.localStorage.setItem(TERMINAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore private browsing quota errors
  }
}

export interface ParsedGhosttyConfigResult {
  patch: Partial<TerminalSettings>;
  appliedKeys: string[];
  detectedShaders: string[];
}

/**
 * Parses a standard Ghostty config snippet (e.g., from ~/.config/ghostty/config
 * or ghostty-style.vercel.app) into Lanes TerminalSettings updates.
 */
export function parseGhosttyConfig(configText: string): ParsedGhosttyConfigResult {
  const patch: Partial<TerminalSettings> = {};
  const overrides: Partial<ITheme> = {};
  const appliedKeys: string[] = [];
  const detectedShaders: string[] = [];

  for (const rawLine of configText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!val) continue;

    if (key === 'theme') {
      if (val.includes('light:') || val.includes('dark:')) {
        const parts = val.split(',');
        let matchedPair = false;
        for (const part of parts) {
          const [modeKey, themeName] = part.split(':').map((s) => s.trim());
          const found = findThemePresetByName(themeName || '');
          if (found) {
            if (modeKey === 'light') {
              patch.lightThemeId = found.id;
              matchedPair = true;
            } else if (modeKey === 'dark') {
              patch.darkThemeId = found.id;
              patch.themeId = found.id;
              matchedPair = true;
            }
          }
        }
        if (matchedPair) {
          patch.followAppMode = true;
          appliedKeys.push('theme (light/dark pair)');
        }
      } else {
        const found = findThemePresetByName(val);
        if (found) {
          patch.themeId = found.id;
          patch.followAppMode = false;
          appliedKeys.push(`theme (${found.name})`);
        }
      }
    } else if (key === 'background') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.background = hex;
        appliedKeys.push('background');
      }
    } else if (key === 'foreground') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.foreground = hex;
        appliedKeys.push('foreground');
      }
    } else if (key === 'cursor-color') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.cursor = hex;
        appliedKeys.push('cursor-color');
      }
    } else if (key === 'cursor-text') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.cursorAccent = hex;
        appliedKeys.push('cursor-text');
      }
    } else if (key === 'selection-background') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.selectionBackground = hex;
        appliedKeys.push('selection-background');
      }
    } else if (key === 'selection-foreground') {
      const hex = normalizeHexColor(val);
      if (hex) {
        overrides.selectionForeground = hex;
        appliedKeys.push('selection-foreground');
      }
    } else if (key === 'palette') {
      const pEq = val.indexOf('=');
      if (pEq !== -1) {
        const idx = Number.parseInt(val.slice(0, pEq).trim(), 10);
        const hex = normalizeHexColor(val.slice(pEq + 1));
        if (Number.isInteger(idx) && idx >= 0 && idx < ANSI_PALETTE_KEYS.length && hex) {
          overrides[ANSI_PALETTE_KEYS[idx]] = hex;
          if (!appliedKeys.includes('palette')) appliedKeys.push('palette');
        }
      }
    } else if (key === 'font-family') {
      patch.fontFamily = val;
      appliedKeys.push('font-family');
    } else if (key === 'font-size') {
      const n = Number.parseFloat(val);
      if (Number.isFinite(n) && n >= 8 && n <= 28) {
        patch.fontSize = Math.round(n);
        appliedKeys.push('font-size');
      }
    } else if (key === 'window-padding-x') {
      const n = Number.parseInt(val, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 40) {
        patch.paddingX = n;
        appliedKeys.push('window-padding-x');
      }
    } else if (key === 'window-padding-y') {
      const n = Number.parseInt(val, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 40) {
        patch.paddingY = n;
        appliedKeys.push('window-padding-y');
      }
    } else if (key === 'cursor-style') {
      const style = val.toLowerCase();
      if (style === 'block' || style === 'bar' || style === 'underline') {
        patch.cursorStyle = style;
        appliedKeys.push('cursor-style');
      }
    } else if (key === 'cursor-style-blink') {
      patch.cursorBlink = val.toLowerCase() !== 'false';
      appliedKeys.push('cursor-style-blink');
    } else if (key === 'background-opacity') {
      const n = Number.parseFloat(val);
      if (Number.isFinite(n) && n >= 0.4 && n <= 1) {
        patch.backgroundOpacity = Number(Math.max(0.55, n).toFixed(2));
        appliedKeys.push('background-opacity');
      }
    } else if (key === 'background-blur' || key === 'background-blur-radius') {
      if (val.toLowerCase() === 'true') {
        patch.backgroundBlur = 12;
      } else if (val.toLowerCase() === 'false') {
        patch.backgroundBlur = 0;
      } else {
        const n = Number.parseInt(val, 10);
        if (Number.isFinite(n)) patch.backgroundBlur = Math.max(0, Math.min(24, n));
      }
      appliedKeys.push('background-blur');
    } else if (key === 'custom-shader') {
      detectedShaders.push(val);
      const lower = val.toLowerCase();
      if (lower.includes('bettercrt')) patch.shaderId = 'bettercrt';
      else if (lower.includes('retro-terminal') || lower.includes('crt')) patch.shaderId = 'retro-terminal';
      else if (lower.includes('bloom')) patch.shaderId = 'bloom';
      else if (lower.includes('vhs')) patch.shaderId = 'vhs';
      else if (lower.includes('starfield')) patch.shaderId = 'starfield';
      else if (lower.includes('matrix')) patch.shaderId = 'matrix';
      else if (lower.includes('glitch') || lower.includes('rgbsplit')) patch.shaderId = 'glitch';
      else if (lower.includes('cursor')) patch.shaderId = 'cursor-warp';
      const rel = val.replace(/^shaders\//, '');
      if (rel.endsWith('.glsl')) {
        patch.localShaderPath = rel;
      }
      if (!appliedKeys.includes('custom-shader')) appliedKeys.push('custom-shader');
    }
  }

  if (Object.keys(overrides).length > 0) {
    patch.customOverrides = overrides;
  }

  return { patch, appliedKeys, detectedShaders };
}

/**
 * Exports current Lanes TerminalSettings back into valid ~/.config/ghostty/config syntax.
 */
export function exportGhosttyConfig(settings: TerminalSettings, appIsDark = true): string {
  const { preset, theme } = resolveActiveTerminalTheme(settings, appIsDark);
  const lines: string[] = [
    '# Exported from Lanes Terminal Studio',
  ];

  if (settings.followAppMode) {
    const lightPreset =
      TERMINAL_THEME_PRESETS.find((t) => t.id === settings.lightThemeId) ?? TERMINAL_THEME_PRESETS[2];
    const darkPreset =
      TERMINAL_THEME_PRESETS.find((t) => t.id === settings.darkThemeId) ?? TERMINAL_THEME_PRESETS[1];
    lines.push(`theme = light:${lightPreset.ghosttyName},dark:${darkPreset.ghosttyName}`);
  } else {
    lines.push(`theme = ${preset.ghosttyName}`);
  }

  lines.push(`font-family = ${settings.fontFamily}`);
  lines.push(`font-size = ${settings.fontSize}`);
  lines.push(`window-padding-x = ${settings.paddingX}`);
  lines.push(`window-padding-y = ${settings.paddingY}`);
  lines.push(`cursor-style = ${settings.cursorStyle}`);
  lines.push(`cursor-style-blink = ${settings.cursorBlink ? 'true' : 'false'}`);

  if (settings.backgroundOpacity < 1) {
    lines.push(`background-opacity = ${settings.backgroundOpacity}`);
  }
  if (settings.backgroundBlur > 0) {
    lines.push(`background-blur = ${settings.backgroundBlur}`);
  }

  if (theme.background) lines.push(`background = ${theme.background}`);
  if (theme.foreground) lines.push(`foreground = ${theme.foreground}`);
  if (theme.cursor) lines.push(`cursor-color = ${theme.cursor}`);
  if (theme.selectionBackground) lines.push(`selection-background = ${theme.selectionBackground}`);

  ANSI_PALETTE_KEYS.forEach((key, idx) => {
    const val = theme[key];
    if (val) lines.push(`palette = ${idx}=${val}`);
  });

  if (settings.shaderId === 'local-glsl' && settings.localShaderPath) {
    lines.push(`custom-shader = shaders/${settings.localShaderPath}`);
  } else if (settings.shaderId !== 'none' && settings.shaderId !== 'custom-glsl') {
    lines.push(`# Lanes built-in shader: ${settings.shaderId}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Normalizes desktop Ghostty GLSL idioms (such as C-style brace array initializers
 * like `const vec3[24] samples = { ... };`) into valid WebGL2 / GLSL ES 3.00 syntax.
 */
export function normalizeGhosttyGlsl(source: string): string {
  // Strip #version directives if present (our wrapper prepends `#version 300 es`)
  let out = source.replace(/^\s*#version[^\n]*\n/gm, '');

  // Convert `const TYPE[N] NAME = { ... };` -> `const TYPE NAME[N] = TYPE[N]( ... );`
  out = out.replace(
    /\b(const\s+)?(float|int|vec2|vec3|vec4)\s*\[\s*(\d+)\s*\]\s+(\w+)\s*=\s*\{([\s\S]*?)\}\s*;/g,
    (_m, constKw, typeName, count, varName, body) =>
      `${constKw ?? ''}${typeName} ${varName}[${count}] = ${typeName}[${count}](${body});`
  );

  // Also handle `const TYPE NAME[N] = { ... };`
  out = out.replace(
    /\b(const\s+)?(float|int|vec2|vec3|vec4)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/g,
    (_m, constKw, typeName, varName, count, body) =>
      `${constKw ?? ''}${typeName} ${varName}[${count}] = ${typeName}[${count}](${body});`
  );

  return out;
}
