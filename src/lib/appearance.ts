import type { PlaceId, ThemeId } from './types';
import { THEME_OPTIONS, getThemePair } from './workbench';

export type AccentPresetId =
  | 'theme'
  | 'terracotta'
  | 'cobalt'
  | 'olive'
  | 'plum'
  | 'rose';

export type ShaderPresetId =
  | 'clean'
  | 'travertine-grain'
  | 'warm-glow'
  | 'ceramic-sheen'
  | 'blueprint-grid'
  | LiveShaderId;

/** Animated WebGL backgrounds: Lanes originals, Paper Shaders, and React Bits backgrounds. */
export type PaperShaderId =
  | 'paper-mesh'
  | 'paper-grain'
  | 'paper-neuro'
  | 'paper-warp'
  | 'paper-smoke'
  | 'paper-godrays'
  | 'paper-dithering'
  | 'paper-voronoi'
  | 'paper-swirl'
  | 'paper-metaballs'
  | 'paper-dot-orbit'
  | 'paper-color-panels';

export type ReactBitsShaderId =
  | 'rb-silk'
  | 'rb-iridescence'
  | 'rb-liquid-chrome'
  | 'rb-prism'
  | 'rb-beams'
  | 'rb-waves'
  | 'rb-plasma'
  | 'rb-grid-distortion';

export type LanesLiveShaderId =
  | 'starfield'
  | 'nebula'
  | 'caustics'
  | 'lava'
  | 'aurora'
  | 'ripples';

export type LiveShaderId = LanesLiveShaderId | PaperShaderId | ReactBitsShaderId;
export type LiveShaderCollection = 'lanes' | 'paper' | 'reactbits';

export type ComponentRadiusId = 'sharp' | 'balanced' | 'soft';
export type DensityId = 'compact' | 'comfortable' | 'airy';
export type IconPackId = 'outline' | 'tinted' | 'architectural';
export type IconMotionId = 'spring' | 'crisp' | 'glide' | 'off';
export type BloomId = 'off' | 'soft' | 'strong';

export interface AppearanceSettings {
  theme: ThemeId;
  accent: AccentPresetId;
  shader: ShaderPresetId;
  radius: ComponentRadiusId;
  density: DensityId;
  iconPack: IconPackId;
  iconStroke: 1.5 | 1.9 | 2.3;
  iconMotion: IconMotionId;
  bloom: BloomId;
  pinnedRailPlaces: PlaceId[];
}

export const ALL_RAIL_PLACES: { id: PlaceId; label: string; description: string; locked?: boolean }[] = [
  { id: 'home', label: 'Home', description: 'Workspace router and overview', locked: true },
  { id: 'assistant', label: 'Assistant', description: 'Cross-lane chat with Gemini' },
  { id: 'lanes', label: 'Lanes', description: 'Active lane threads & branches' },
  { id: 'bots', label: 'Bots', description: 'Background workspace bots' },
  { id: 'needs', label: 'Needs you', description: 'Approvals and decisions inbox' },
  { id: 'scheduled', label: 'Scheduled', description: 'Recurring automated jobs' },
  { id: 'library', label: 'Library', description: 'Shared files and references' },
  { id: 'memory', label: 'Memory', description: 'Approved context notes' },
  { id: 'media', label: 'Media & Voice', description: 'Images, video, Lyria music, voice' },
  { id: 'spatial', label: '3D Studio', description: 'Interactive Three.js spatial map' },
  { id: 'studio', label: 'Design Studio', description: 'Appearance, shaders, kit & tokens', locked: true },
  { id: 'settings', label: 'Settings', description: 'Safety floor, Tauri runtime & services' },
];

export const DEFAULT_PINNED_RAIL_PLACES: PlaceId[] = [
  'home',
  'assistant',
  'lanes',
  'needs',
  'media',
  'spatial',
  'studio',
  'settings',
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'calm-light',
  accent: 'theme',
  shader: 'clean',
  radius: 'balanced',
  density: 'comfortable',
  iconPack: 'outline',
  iconStroke: 1.9,
  iconMotion: 'off',
  bloom: 'off',
  pinnedRailPlaces: DEFAULT_PINNED_RAIL_PLACES,
};

export interface AccentPresetDef {
  id: AccentPresetId;
  label: string;
  light: string;
  lightSoft: string;
  lightOn: string;
  dark: string;
  darkSoft: string;
  darkOn: string;
}

export const ACCENT_PRESETS: AccentPresetDef[] = [
  {
    id: 'theme',
    label: 'Theme default',
    light: '#942D10',
    lightSoft: '#FFE4DD',
    lightOn: '#FFFFFF',
    dark: '#FFB4A1',
    darkSoft: 'rgb(181 68 38 / 28%)',
    darkOn: '#611300',
  },
  {
    id: 'terracotta',
    label: 'Burnt Terracotta',
    light: '#942D10',
    lightSoft: '#FFE4DD',
    lightOn: '#FFFFFF',
    dark: '#FFB4A1',
    darkSoft: 'rgb(181 68 38 / 28%)',
    darkOn: '#611300',
  },
  {
    id: 'cobalt',
    label: 'Deep Teal',
    light: '#005776',
    lightSoft: '#D3EDFF',
    lightOn: '#FFFFFF',
    dark: '#80D0FB',
    darkSoft: 'rgb(0 87 118 / 32%)',
    darkOn: '#002635',
  },
  {
    id: 'olive',
    label: 'Olive Sage',
    light: '#3B6633',
    lightSoft: '#E1EAD9',
    lightOn: '#FFFFFF',
    dark: '#8BC67F',
    darkSoft: 'rgb(59 102 51 / 30%)',
    darkOn: '#11280D',
  },
  {
    id: 'plum',
    label: 'Plum Slate',
    light: '#6D4E91',
    lightSoft: '#EDE5F7',
    lightOn: '#FFFFFF',
    dark: '#CBB3E6',
    darkSoft: 'rgb(126 100 158 / 30%)',
    darkOn: '#241438',
  },
  {
    id: 'rose',
    label: 'Terracotta Rose',
    light: '#9B3F65',
    lightSoft: '#F7E1EA',
    lightOn: '#FFFFFF',
    dark: '#E69CB8',
    darkSoft: 'rgb(168 78 115 / 30%)',
    darkOn: '#340F1E',
  },
];

export interface LiveShaderPresetDef {
  id: LiveShaderId;
  label: string;
  collection: LiveShaderCollection;
  description: string;
}

export const LIVE_SHADER_PRESETS: LiveShaderPresetDef[] = [
  // Lanes Originals
  { id: 'starfield', label: 'Starfield', collection: 'lanes', description: 'Three drifting layers of twinkling points in your text and accent colors.' },
  { id: 'nebula', label: 'Nebula', collection: 'lanes', description: 'Slow-turning clouds that blend your accent into the warm status color.' },
  { id: 'caustics', label: 'Caustics', collection: 'lanes', description: 'Wandering bright lines, like sunlight on a pool floor.' },
  { id: 'lava', label: 'Lava Lamp', collection: 'lanes', description: 'Soft blobs that drift, merge and split apart again.' },
  { id: 'aurora', label: 'Aurora', collection: 'lanes', description: 'Ribbons of color hanging from the top edge, slowly swaying.' },
  { id: 'ripples', label: 'Ripples', collection: 'lanes', description: 'Two drifting sources whose rings cross and interfere.' },

  // Paper Shaders (@paper-design/shaders-react)
  { id: 'paper-mesh', label: 'Mesh Gradient', collection: 'paper', description: 'Smooth fluid multi-point mesh gradient tuned to your theme.' },
  { id: 'paper-grain', label: 'Grain Gradient', collection: 'paper', description: 'Organic soft gradient layered with tactile studio film grain.' },
  { id: 'paper-neuro', label: 'Neuro Noise', collection: 'paper', description: 'Glowing neural filament currents drifting through empty canvas.' },
  { id: 'paper-warp', label: 'Warp', collection: 'paper', description: 'Swirling liquid-fabric distortion waves.' },
  { id: 'paper-smoke', label: 'Smoke Ring', collection: 'paper', description: 'Atmospheric drifting smoke ring orbiting in soft theme tones.' },
  { id: 'paper-godrays', label: 'God Rays', collection: 'paper', description: 'Soft volumetric light beams radiating across the backdrop.' },
  { id: 'paper-dithering', label: 'Dithering', collection: 'paper', description: 'Crisp ordered halftone dithering waves with retro editorial feel.' },
  { id: 'paper-voronoi', label: 'Voronoi', collection: 'paper', description: 'Organic glowing cellular facets shifting gently.' },
  { id: 'paper-swirl', label: 'Swirl', collection: 'paper', description: 'Layered ribbons twisting softly in your theme palette.' },
  { id: 'paper-metaballs', label: 'Metaballs', collection: 'paper', description: 'Liquid spheres merging smoothly across the window.' },
  { id: 'paper-dot-orbit', label: 'Dot Orbit', collection: 'paper', description: 'Orbiting dotted constellations drifting gently.' },
  { id: 'paper-color-panels', label: 'Color Panels', collection: 'paper', description: 'Layered translucent architectural planes gliding past.' },

  // React Bits inspired interactive WebGL backgrounds
  { id: 'rb-silk', label: 'Silk', collection: 'reactbits', description: 'Flowing satin fabric folds that tilt softly toward your cursor.' },
  { id: 'rb-iridescence', label: 'Iridescence', collection: 'reactbits', description: 'Pearlescent oil-slick sheen that stirs gently with mouse movement.' },
  { id: 'rb-liquid-chrome', label: 'Liquid Chrome', collection: 'reactbits', description: 'Metallic liquid ribbons catching specular highlights.' },
  { id: 'rb-prism', label: 'Prism', collection: 'reactbits', description: 'Refracted spectral light bands gliding through empty space.' },
  { id: 'rb-beams', label: 'Beams', collection: 'reactbits', description: 'Diagonal studio light beams breathing slowly across the viewport.' },
  { id: 'rb-waves', label: 'Line Waves', collection: 'reactbits', description: 'Layered topographic sine waves drifting calmly.' },
  { id: 'rb-plasma', label: 'Plasma', collection: 'reactbits', description: 'Smooth interference plasma fields harmonized to your colors.' },
  { id: 'rb-grid-distortion', label: 'Grid Distortion', collection: 'reactbits', description: 'Architectural drafting grid that warps smoothly around your cursor.' },
];

export function isLiveShader(id: ShaderPresetId): id is LiveShaderId {
  return LIVE_SHADER_PRESETS.some((s) => s.id === id);
}

export function isPaperShader(id: LiveShaderId): id is PaperShaderId {
  return id.startsWith('paper-');
}

/** CSS stand-in for a screen bloom: soft light around accent fills, status colors and headings. */
export const BLOOM_PRESETS: { id: BloomId; label: string; description: string }[] = [
  { id: 'off', label: 'Off', description: 'No glow' },
  { id: 'soft', label: 'Soft', description: 'Faint halo on bright parts' },
  { id: 'strong', label: 'Strong', description: 'Neon glow, best on dark themes' },
];

export const SHADER_PRESETS: {
  id: ShaderPresetId;
  label: string;
  description: string;
}[] = [
  {
    id: 'clean',
    label: 'Clean Matte',
    description: 'Zero surface grain or ambient overlay — pure flat tokens for maximum legibility.',
  },
  {
    id: 'travertine-grain',
    label: 'Travertine Grain',
    description: 'Subtle organic stone micro-texture inspired by honed midcentury travertine.',
  },
  {
    id: 'warm-glow',
    label: 'Ambient Studio Glow',
    description: 'Soft studio key-light gradient across the upper canvas and 3D stage.',
  },
  {
    id: 'ceramic-sheen',
    label: 'Ceramic Sheen',
    description: 'Crisp top specular glaze across panels with elevated architectural highlights.',
  },
  {
    id: 'blueprint-grid',
    label: 'Architectural Grid',
    description: 'Precision drafting hairline grid at 28px cadence across canvas and 3D floor.',
  },
];

export const RADIUS_PRESETS: { id: ComponentRadiusId; label: string; px: number }[] = [
  { id: 'sharp', label: 'Sharp', px: 5 },
  { id: 'balanced', label: 'Balanced', px: 10 },
  { id: 'soft', label: 'Soft', px: 15 },
];

export const DENSITY_PRESETS: { id: DensityId; label: string; detail: string }[] = [
  { id: 'compact', label: 'Compact', detail: 'Tighter desktop rows' },
  { id: 'comfortable', label: 'Comfortable', detail: 'Balanced default rhythm' },
  { id: 'airy', label: 'Airy', detail: 'Generous breathing room' },
];

export const ICON_PACK_PRESETS: { id: IconPackId; label: string; detail: string }[] = [
  { id: 'outline', label: 'Clean Outline', detail: 'Pure vector strokes' },
  { id: 'tinted', label: 'Tinted Backing', detail: 'Subtle duotone container tint' },
  { id: 'architectural', label: 'Architectural', detail: 'Framed squared badges' },
];

export const ICON_MOTION_PRESETS: { id: IconMotionId; label: string; detail: string }[] = [
  { id: 'spring', label: 'Spring Lift', detail: 'Subtle tactile lift' },
  { id: 'crisp', label: 'Crisp Scale', detail: 'Clean focused pop' },
  { id: 'glide', label: 'Gentle Glide', detail: 'Subtle horizontal nudge' },
  { id: 'off', label: 'Static', detail: 'Zero icon motion' },
];

const VALID_ACCENTS = new Set<AccentPresetId>(ACCENT_PRESETS.map((a) => a.id));
/** Every surface option: the CSS textures plus the live WebGL backgrounds. */
export const ALL_SHADER_PRESETS = [...SHADER_PRESETS, ...LIVE_SHADER_PRESETS];

const VALID_SHADERS = new Set<ShaderPresetId>(ALL_SHADER_PRESETS.map((s) => s.id));
const VALID_RADII = new Set<ComponentRadiusId>(RADIUS_PRESETS.map((r) => r.id));
const VALID_DENSITIES = new Set<DensityId>(DENSITY_PRESETS.map((d) => d.id));
const VALID_ICON_PACKS = new Set<IconPackId>(ICON_PACK_PRESETS.map((p) => p.id));
const VALID_ICON_MOTIONS = new Set<IconMotionId>(ICON_MOTION_PRESETS.map((m) => m.id));
const VALID_PLACES = new Set<PlaceId>(ALL_RAIL_PLACES.map((p) => p.id));
const LOCKED_PLACES = new Set<PlaceId>(ALL_RAIL_PLACES.filter((p) => p.locked).map((p) => p.id));

export function sanitizeAppearanceSettings(raw: unknown): AppearanceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APPEARANCE, pinnedRailPlaces: [...DEFAULT_PINNED_RAIL_PLACES] };
  }
  const obj = raw as Record<string, unknown>;
  const theme = THEME_OPTIONS.some((t) => t.id === obj.theme)
    ? (obj.theme as ThemeId)
    : DEFAULT_APPEARANCE.theme;
  const accent = VALID_ACCENTS.has(obj.accent as AccentPresetId)
    ? (obj.accent as AccentPresetId)
    : DEFAULT_APPEARANCE.accent;
  const shader = VALID_SHADERS.has(obj.shader as ShaderPresetId)
    ? (obj.shader as ShaderPresetId)
    : DEFAULT_APPEARANCE.shader;
  const radius = VALID_RADII.has(obj.radius as ComponentRadiusId)
    ? (obj.radius as ComponentRadiusId)
    : DEFAULT_APPEARANCE.radius;
  const density = VALID_DENSITIES.has(obj.density as DensityId)
    ? (obj.density as DensityId)
    : DEFAULT_APPEARANCE.density;
  const iconPack = VALID_ICON_PACKS.has(obj.iconPack as IconPackId)
    ? (obj.iconPack as IconPackId)
    : DEFAULT_APPEARANCE.iconPack;
  const iconStroke: 1.5 | 1.9 | 2.3 =
    obj.iconStroke === 1.5 || obj.iconStroke === 1.9 || obj.iconStroke === 2.3
      ? obj.iconStroke
      : DEFAULT_APPEARANCE.iconStroke;
  const iconMotion = VALID_ICON_MOTIONS.has(obj.iconMotion as IconMotionId)
    ? (obj.iconMotion as IconMotionId)
    : DEFAULT_APPEARANCE.iconMotion;
  const bloom = BLOOM_PRESETS.some((b) => b.id === obj.bloom) ? (obj.bloom as BloomId) : DEFAULT_APPEARANCE.bloom;

  let pinned: PlaceId[] = [...DEFAULT_PINNED_RAIL_PLACES];
  if (Array.isArray(obj.pinnedRailPlaces)) {
    const seen = new Set<PlaceId>();
    const filtered: PlaceId[] = [];
    for (const item of obj.pinnedRailPlaces) {
      if (typeof item === 'string' && VALID_PLACES.has(item as PlaceId) && !seen.has(item as PlaceId)) {
        seen.add(item as PlaceId);
        filtered.push(item as PlaceId);
      }
    }
    for (const req of LOCKED_PLACES) {
      if (!seen.has(req)) {
        filtered.push(req);
      }
    }
    if (filtered.length > 0) {
      pinned = filtered;
    }
  }

  return {
    theme,
    accent,
    shader,
    radius,
    density,
    iconPack,
    iconStroke,
    iconMotion,
    bloom,
    pinnedRailPlaces: pinned,
  };
}

export function toggleRailPin(current: PlaceId[], placeId: PlaceId): PlaceId[] {
  if (LOCKED_PLACES.has(placeId)) {
    return current.includes(placeId) ? current : [...current, placeId];
  }
  if (current.includes(placeId)) {
    return current.filter((p) => p !== placeId);
  }
  return [...current, placeId];
}

export function moveRailPin(
  current: PlaceId[],
  placeId: PlaceId,
  direction: 'up' | 'down'
): PlaceId[] {
  const idx = current.indexOf(placeId);
  if (idx < 0) return current;
  const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= current.length) return current;
  const copy = [...current];
  const [moved] = copy.splice(idx, 1);
  copy.splice(nextIdx, 0, moved);
  return copy;
}

/**
 * Applies all live AppearanceSettings onto document.documentElement via data attributes
 * and CSS variables (never using brittle !important inversion overrides).
 */
export function applyAppearanceToDocument(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { isDark } = getThemePair(settings.theme);

  root.dataset.theme = settings.theme;
  root.dataset.shader = settings.shader;
  root.dataset.liveShader = isLiveShader(settings.shader) ? 'true' : 'false';
  root.dataset.radius = settings.radius;
  root.dataset.density = settings.density;
  root.dataset.iconPack = settings.iconPack;
  root.dataset.iconMotion = settings.iconMotion;
  root.dataset.bloom = settings.bloom;

  const radiusDef = RADIUS_PRESETS.find((r) => r.id === settings.radius) ?? RADIUS_PRESETS[1];
  root.style.setProperty('--l-user-radius', `${radiusDef.px}px`);
  root.style.setProperty('--l-icon-stroke', String(settings.iconStroke));

  if (settings.accent === 'theme') {
    root.style.removeProperty('--l-accent');
    root.style.removeProperty('--l-accent-soft');
    root.style.removeProperty('--l-on-accent');
    root.style.removeProperty('--l-focus');
  } else {
    const preset = ACCENT_PRESETS.find((a) => a.id === settings.accent);
    if (preset) {
      root.style.setProperty('--l-accent', isDark ? preset.dark : preset.light);
      root.style.setProperty('--l-accent-soft', isDark ? preset.darkSoft : preset.lightSoft);
      root.style.setProperty('--l-on-accent', isDark ? preset.darkOn : preset.lightOn);
      root.style.setProperty('--l-focus', isDark ? preset.dark : preset.light);
    }
  }
}
