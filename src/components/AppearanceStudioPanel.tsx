import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Bot,
  Box,
  Brain,
  CalendarClock,
  Check,
  FolderOpen,
  House,
  Layers,
  Lock,
  Palette,
  Pin,
  PinOff,
  RotateCcw,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { PlaceId } from '../lib/types';
import {
  ACCENT_PRESETS,
  ALL_RAIL_PLACES,
  DENSITY_PRESETS,
  ICON_MOTION_PRESETS,
  ICON_PACK_PRESETS,
  RADIUS_PRESETS,
  BLOOM_PRESETS,
  LIVE_SHADER_PRESETS,
  SHADER_PRESETS,
  isLiveShader,
  type LiveShaderCollection,
  type ShaderPresetId,
  moveRailPin,
  toggleRailPin,
  type AppearanceSettings,
} from '../lib/appearance';
import { THEME_OPTIONS, getThemePair } from '../lib/workbench';
import { ShaderCanvas } from './ShaderCanvas';

interface AppearanceStudioPanelProps {
  appearance: AppearanceSettings;
  onChange: (next: AppearanceSettings) => void;
  onReset: () => void;
  onNotify: (msg: string) => void;
}

// One card per theme family, light version first, so each pair reads as one choice.
const THEME_FAMILIES = Array.from(
  THEME_OPTIONS.reduce((map, opt) => {
    map.set(opt.family, [...(map.get(opt.family) ?? []), opt]);
    return map;
  }, new Map<string, typeof THEME_OPTIONS>())
).map(([family, options]) => ({
  family,
  options: [...options].sort((a, b) => Number(a.isDark) - Number(b.isDark)),
}));

/** "Windows XP · Luna" → "Luna", "Calm · light" → "Light". */
function variantName(label: string): string {
  const name = label.split(' · ').pop() ?? label;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const PLACE_ICONS: Record<PlaceId, typeof House> = {
  home: House,
  assistant: Sparkles,
  lanes: Layers,
  bots: Bot,
  needs: Bell,
  scheduled: CalendarClock,
  library: FolderOpen,
  memory: Brain,
  media: Wand2,
  spatial: Box,
  studio: Palette,
  settings: Settings,
};

const COLLECTION_LABELS: Record<LiveShaderCollection, string> = {
  lanes: 'Lanes',
  paper: 'Paper',
  reactbits: 'React Bits',
};

function staticShaderBackdrop(id: ShaderPresetId): string {
  if (id.startsWith('paper-')) {
    return 'radial-gradient(ellipse at 25% 20%, color-mix(in srgb, var(--l-accent) 26%, transparent), transparent 62%), radial-gradient(ellipse at 82% 80%, color-mix(in srgb, var(--l-needs) 22%, transparent), transparent 60%)';
  }
  if (id.startsWith('rb-')) {
    return 'linear-gradient(125deg, color-mix(in srgb, var(--l-accent) 22%, transparent) 0%, transparent 48%, color-mix(in srgb, var(--l-needs) 24%, transparent) 100%)';
  }
  return 'radial-gradient(circle at 70% 35%, color-mix(in srgb, var(--l-accent) 22%, transparent), transparent 58%)';
}

export function AppearanceStudioPanel({
  appearance,
  onChange,
  onReset,
  onNotify,
}: AppearanceStudioPanelProps) {
  const { isDark } = getThemePair(appearance.theme);
  const [shaderFilter, setShaderFilter] = useState<'all' | LiveShaderCollection>('all');
  const [hoveredShaderId, setHoveredShaderId] = useState<ShaderPresetId | null>(null);

  function update<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    onChange({ ...appearance, [key]: value });
  }

  function renderShaderCard(sh: {
    id: ShaderPresetId;
    label: string;
    description: string;
    collection?: LiveShaderCollection;
  }) {
    const active = appearance.shader === sh.id;
    const live = isLiveShader(sh.id);
    // Mount live WebGL only for the active or hovered card so all 26 live shaders
    // browse smoothly without ever hitting the browser's ~16 WebGL context limit.
    const mountLivePreview = live && (active || hoveredShaderId === sh.id);

    return (
      <button
        key={sh.id}
        type="button"
        aria-pressed={active}
        onMouseEnter={() => live && setHoveredShaderId(sh.id)}
        onMouseLeave={() => setHoveredShaderId((curr) => (curr === sh.id ? null : curr))}
        onFocus={() => live && setHoveredShaderId(sh.id)}
        onBlur={() => setHoveredShaderId((curr) => (curr === sh.id ? null : curr))}
        onClick={() => {
          update('shader', sh.id);
          onNotify(`Applied ${sh.label} shader`);
        }}
        className="flex flex-col overflow-hidden rounded-[12px] border text-left"
        style={{
          backgroundColor: 'var(--l-raised)',
          borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
        }}
      >
        {/* Mini app window with the background shader behind chrome and cards (empty space only). */}
        <div
          aria-hidden="true"
          className="relative isolate flex h-24 w-full overflow-hidden border-b"
          style={{
            backgroundColor: 'var(--l-bg)',
            backgroundImage: live && !mountLivePreview ? staticShaderBackdrop(sh.id) : undefined,
            borderColor: 'var(--l-line)',
          }}
        >
          {isLiveShader(sh.id) ? (
            mountLivePreview && (
              <ShaderCanvas shader={sh.id} scale={1} className="absolute inset-0 z-0 h-full w-full" />
            )
          ) : (
            <div className="lanes-shader-preview" data-shader={sh.id} />
          )}
          <div className="relative z-[1] w-2.5 shrink-0" style={{ backgroundColor: 'var(--l-rail)' }} />
          <div
            className="relative z-[1] flex w-[30%] shrink-0 flex-col gap-1.5 border-r px-1.5 pt-2.5"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: 'var(--l-hover)' }} />
            <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: 'var(--l-line-strong)' }} />
            <span className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: 'var(--l-line-strong)' }} />
          </div>
          <div className="relative z-[1] flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
            <span
              className="h-2 w-1/2 rounded-full"
              style={{ backgroundColor: 'var(--l-text)', opacity: 0.7 }}
            />
            <div
              className="flex flex-col gap-1 rounded-[5px] border p-1.5"
              style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
            >
              <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: 'var(--l-line-strong)' }} />
              <span className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: 'var(--l-line-strong)' }} />
            </div>
            <span className="h-1.5 w-1/3 rounded-full" style={{ backgroundColor: 'var(--l-accent)' }} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
              {sh.label}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {sh.collection && (
                <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  {COLLECTION_LABELS[sh.collection]}
                </span>
              )}
              {active && <Check size={13} style={{ color: 'var(--l-accent)' }} />}
            </span>
          </div>
          <span className="text-pretty text-[12px] leading-[1.4]" style={{ color: 'var(--l-muted)' }}>
            {sh.description}
          </span>
        </div>
      </button>
    );
  }

  const orderedPlaces = [
    ...appearance.pinnedRailPlaces
      .map((id) => ALL_RAIL_PLACES.find((p) => p.id === id))
      .filter((p): p is (typeof ALL_RAIL_PLACES)[number] => Boolean(p)),
    ...ALL_RAIL_PLACES.filter((p) => !appearance.pinnedRailPlaces.includes(p.id)),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-7 pb-8">
        {/* Top bar summary + reset */}
        <div className="lanes-text-surface flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[16px] font-semibold tracking-tight" style={{ color: 'var(--l-text)' }}>
              Workspace appearance &amp; shell
            </h2>
            <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
              Customize color schemes, accent overrides, surface shaders, component geometry, icon motion, and pinned leftmost rail tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onReset();
              onNotify('Reset appearance to Calm defaults');
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset defaults</span>
          </button>
        </div>

        {/* 1. COLOR SCHEMES & ACCENT OVERRIDE */}
        <section aria-labelledby="studio-color-heading">
          <div className="lanes-text-surface mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="studio-color-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Color schemes
            </h3>
            <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
              {THEME_FAMILIES.length} families, each with a light and dark version
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_FAMILIES.map(({ family, options }) => {
              const familyActive = options.some((opt) => opt.id === appearance.theme);
              return (
                <div
                  key={family}
                  role="group"
                  aria-label={family}
                  className="rounded-[12px] border p-2"
                  style={{
                    backgroundColor: 'var(--l-raised)',
                    borderColor: familyActive ? 'var(--l-accent)' : 'var(--l-line-strong)',
                  }}
                >
                  <span
                    className="mb-2 block truncate px-1 pt-0.5 text-[13px] font-semibold"
                    style={{ color: 'var(--l-text)' }}
                  >
                    {family}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {options.map((opt) => {
                      const active = appearance.theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-theme={opt.id}
                          aria-pressed={active}
                          aria-label={opt.label}
                          onClick={() => {
                            update('theme', opt.id);
                            onNotify(`Switched theme to ${opt.label}`);
                          }}
                          className="flex min-w-0 flex-col gap-2 rounded-[8px] border p-2 text-left"
                          style={{
                            backgroundColor: 'var(--l-bg)',
                            borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                            boxShadow: active ? '0 0 0 1px var(--l-accent)' : undefined,
                            color: 'var(--l-text)',
                          }}
                        >
                          <span className="flex items-center gap-1">
                            <span
                              className="h-3.5 w-3.5 rounded-full border"
                              style={{ backgroundColor: 'var(--l-rail)', borderColor: 'var(--l-line-strong)' }}
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border"
                              style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)' }}
                            />
                            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: 'var(--l-accent)' }} />
                          </span>
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate text-[12px] font-medium">{variantName(opt.label)}</span>
                            {active && <Check size={12} strokeWidth={2.5} style={{ color: 'var(--l-accent)' }} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accent Override Strip */}
          <div className="mt-4">
            <span className="mb-2 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              Accent color override
            </span>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const active = appearance.accent === preset.id;
                const swatch = isDark ? preset.dark : preset.light;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => update('accent', preset.id)}
                    className="inline-flex h-8 items-center gap-2 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                      borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border"
                      style={{
                        backgroundColor: preset.id === 'theme' ? 'transparent' : swatch,
                        backgroundImage:
                          preset.id === 'theme'
                            ? 'conic-gradient(from 0deg, #942D10, #005776, #3B6633, #7E649E, #942D10)'
                            : undefined,
                        borderColor: 'var(--l-line-strong)',
                      }}
                    />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. SURFACE SHADERS & 3D ATMOSPHERE */}
        <section aria-labelledby="studio-shaders-heading">
          <div className="lanes-text-surface mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="studio-shaders-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Surface shaders &amp; atmosphere
            </h3>
            <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
              Applies live across the workspace canvas &amp; 3D Studio floor
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SHADER_PRESETS.map(renderShaderCard)}
          </div>

          <div className="lanes-text-surface mt-5 mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="m-0 text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Live backgrounds ({LIVE_SHADER_PRESETS.length})
              </h4>
              <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Hover any card to preview live · stays behind cards and text · holds still when Reduce Motion is on
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'all', label: `All (${LIVE_SHADER_PRESETS.length})` },
                  { id: 'paper', label: `Paper Shaders (${LIVE_SHADER_PRESETS.filter((s) => s.collection === 'paper').length})` },
                  { id: 'reactbits', label: `React Bits (${LIVE_SHADER_PRESETS.filter((s) => s.collection === 'reactbits').length})` },
                  { id: 'lanes', label: `Lanes (${LIVE_SHADER_PRESETS.filter((s) => s.collection === 'lanes').length})` },
                ] as const
              ).map((tab) => {
                const selected = shaderFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setShaderFilter(tab.id)}
                    className="h-7 rounded-[7px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: selected ? 'var(--l-selected)' : 'var(--l-raised)',
                      borderColor: selected ? 'var(--l-accent)' : 'var(--l-line)',
                      color: selected ? 'var(--l-text)' : 'var(--l-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_SHADER_PRESETS.filter(
              (s) => shaderFilter === 'all' || s.collection === shaderFilter
            ).map(renderShaderCard)}
          </div>

          <div className="lanes-text-surface mt-5 mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="m-0 text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Bloom
            </h4>
            <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
              Soft light around accent buttons, badges and headings
            </span>
          </div>
          <div role="radiogroup" aria-label="Bloom" className="grid grid-cols-3 gap-2 sm:max-w-[560px]">
            {BLOOM_PRESETS.map((b) => {
              const active = appearance.bloom === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    update('bloom', b.id);
                    onNotify(b.id === 'off' ? 'Bloom off' : `Bloom set to ${b.label}`);
                  }}
                  className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left"
                  style={{
                    backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                    borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                  }}
                >
                  {/* Sample at this option's own level, so all three can be compared at once. */}
                  <span
                    aria-hidden="true"
                    className="lanes-bloom-sample mb-2 flex h-9 w-full items-center gap-2.5 rounded-[7px] px-2.5"
                    data-bloom={b.id}
                    style={{ backgroundColor: 'var(--l-bg)' }}
                  >
                    <span className="lanes-bloom-pill h-3.5 w-9 rounded-full" />
                    <span className="lanes-bloom-dot h-2.5 w-2.5 rounded-full" />
                    <span className="lanes-bloom-text text-[13px] font-semibold">Aa</span>
                  </span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                    {b.label}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                    {b.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. COMPONENTS & ICONS (2-column balanced split) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Component Geometry & Density */}
          <section
            aria-labelledby="studio-components-heading"
            className="flex flex-col gap-4 rounded-[12px] border p-4"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div>
              <h3 id="studio-components-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Components &amp; density
              </h3>
              <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Tune corner radius and interface rhythm across cards, controls, and lists.
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Corner radius
              </span>
              <div className="grid grid-cols-3 gap-2">
                {RADIUS_PRESETS.map((r) => {
                  const active = appearance.radius === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update('radius', r.id)}
                      className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left"
                      style={{
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                      }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {r.label}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                        {r.px}px
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Layout density
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DENSITY_PRESETS.map((d) => {
                  const active = appearance.density === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update('density', d.id)}
                      className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left"
                      style={{
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                      }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {d.label}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {d.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Hover Highlight & Icon Preview Strip (top-divided band, no nested card) */}
            <div
              className="mt-auto border-t pt-3.5"
              style={{ borderColor: 'var(--l-line)' }}
            >
              <span className="mb-2 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Interactive hover highlight &amp; icon motion preview
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNotify('Primary action hover & press feel active')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium whitespace-nowrap"
                  style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                >
                  <Sparkles size={14} />
                  <span>Primary Action</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNotify('Secondary button hover highlight active')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--l-raised)',
                    borderColor: 'var(--l-line-strong)',
                    color: 'var(--l-text)',
                  }}
                >
                  <Wand2 size={14} />
                  <span>Hover Me</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNotify('3D Studio icon animation preview')}
                  className="lanes-rail-btn inline-flex h-8 w-8 items-center justify-center rounded-[8px]"
                  style={{ color: 'var(--l-text)' }}
                  aria-label="Preview rail icon button"
                >
                  <Box size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Icons & Hover Animation */}
          <section
            aria-labelledby="studio-icons-heading"
            className="flex flex-col gap-4 rounded-[12px] border p-4"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div>
              <h3 id="studio-icons-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Icons &amp; hover animation
              </h3>
              <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Adjust icon rail framing, vector stroke weight, and hover animation curve.
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Rail icon treatment
              </span>
              <div className="grid grid-cols-3 gap-2">
                {ICON_PACK_PRESETS.map((pack) => {
                  const active = appearance.iconPack === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update('iconPack', pack.id)}
                      className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left"
                      style={{
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                      }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {pack.label}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {pack.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Icon stroke weight
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  { value: 1.5 as const, label: 'Light (1.5)' },
                  { value: 1.9 as const, label: 'Regular (1.9)' },
                  { value: 2.3 as const, label: 'Bold (2.3)' },
                ]).map((st) => {
                  const active = appearance.iconStroke === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update('iconStroke', st.value)}
                      className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-[12px] font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      <Layers size={14} strokeWidth={st.value} className="shrink-0" />
                      <span className="truncate">{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Hover icon animation
              </span>
              <div className="grid grid-cols-2 gap-2">
                {ICON_MOTION_PRESETS.map((m) => {
                  const active = appearance.iconMotion === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update('iconMotion', m.id)}
                      className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left"
                      style={{
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                      }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {m.label}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {m.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* 4. LEFTMOST SIDEBAR RAIL PINNING */}
        <section aria-labelledby="studio-rail-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 id="studio-rail-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Leftmost sidebar rail pinning
              </h3>
              <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Pin, unpin, and reorder which icons appear on the leftmost 56px rail. Unpinned places stay accessible in the expandable sidebar panel.
              </p>
            </div>
            <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--l-muted)' }}>
              {appearance.pinnedRailPlaces.length} / {ALL_RAIL_PLACES.length} pinned
            </span>
          </div>

          <div
            className="divide-y rounded-[12px] border"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            {orderedPlaces.map((item) => {
              const Icon = PLACE_ICONS[item.id];
              const pinIdx = appearance.pinnedRailPlaces.indexOf(item.id);
              const isPinned = pinIdx >= 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                  style={{ borderColor: 'var(--l-line)' }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border"
                      style={{
                        backgroundColor: isPinned ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: isPinned ? 'var(--l-accent)' : 'var(--l-line)',
                        color: isPinned ? 'var(--l-text)' : 'var(--l-muted)',
                      }}
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                          {item.label}
                        </span>
                        {item.locked && (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--l-muted)' }}>
                            <Lock size={11} />
                            <span>Always pinned</span>
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isPinned && (
                      <>
                        <button
                          type="button"
                          disabled={pinIdx === 0}
                          onClick={() =>
                            update('pinnedRailPlaces', moveRailPin(appearance.pinnedRailPlaces, item.id, 'up'))
                          }
                          aria-label={`Move ${item.label} up on rail`}
                          title="Move up"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border disabled:opacity-35"
                          style={{
                            backgroundColor: 'var(--l-raised)',
                            borderColor: 'var(--l-line)',
                            color: 'var(--l-text)',
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={pinIdx === appearance.pinnedRailPlaces.length - 1}
                          onClick={() =>
                            update('pinnedRailPlaces', moveRailPin(appearance.pinnedRailPlaces, item.id, 'down'))
                          }
                          aria-label={`Move ${item.label} down on rail`}
                          title="Move down"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border disabled:opacity-35"
                          style={{
                            backgroundColor: 'var(--l-raised)',
                            borderColor: 'var(--l-line)',
                            color: 'var(--l-text)',
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={item.locked}
                      onClick={() => {
                        const next = toggleRailPin(appearance.pinnedRailPlaces, item.id);
                        update('pinnedRailPlaces', next);
                        onNotify(isPinned ? `Unpinned ${item.label} from rail` : `Pinned ${item.label} to rail`);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap disabled:opacity-45"
                      style={{
                        backgroundColor: isPinned ? 'var(--l-selected)' : 'var(--l-raised)',
                        borderColor: isPinned ? 'var(--l-accent)' : 'var(--l-line-strong)',
                        color: 'var(--l-text)',
                      }}
                    >
                      {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                      <span>{isPinned ? 'Pinned' : 'Pin to rail'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
