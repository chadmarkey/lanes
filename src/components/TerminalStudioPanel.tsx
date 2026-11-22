import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FolderOpen,
  RotateCcw,
  Search,
  Sparkles,
  Terminal as TerminalIcon,
  Wand2,
} from 'lucide-react';
import { readJsonSafe, resolveApiUrl } from '../lib/tauri';
import {
  ANSI_PALETTE_KEYS,
  DEFAULT_TERMINAL_SETTINGS,
  TERMINAL_FONT_OPTIONS,
  TERMINAL_SHADER_PRESETS,
  TERMINAL_THEME_PRESETS,
  exportGhosttyConfig,
  parseGhosttyConfig,
  resolveActiveTerminalTheme,
  type TerminalCursorStyle,
  type TerminalSettings,
  type TerminalShaderId,
} from '../lib/terminalConfig';
import { GhosttyTerminal } from './GhosttyTerminal';

interface LocalShaderEntry {
  path: string;
  name: string;
  category: string;
}

interface TerminalStudioPanelProps {
  settings: TerminalSettings;
  appIsDark: boolean;
  onChange: (next: TerminalSettings) => void;
  onReset: () => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

export function TerminalStudioPanel({
  settings,
  appIsDark,
  onChange,
  onReset,
  onNotify,
}: TerminalStudioPanelProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'live'>('preview');
  const [themeQuery, setThemeQuery] = useState('');
  const [themeModeFilter, setThemeModeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [localShaders, setLocalShaders] = useState<LocalShaderEntry[]>([]);
  const [localConfigFound, setLocalConfigFound] = useState(false);
  const [localConfigText, setLocalConfigText] = useState('');
  const [localShaderQuery, setLocalShaderQuery] = useState('');
  const [pasteConfig, setPasteConfig] = useState('');
  const [copiedConfig, setCopiedConfig] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(resolveApiUrl('/api/terminal/ghostty-config'))
      .then((res) => (res.ok ? readJsonSafe<{ found?: boolean; configText?: string; shaders?: LocalShaderEntry[] }>(res) : null))
      .then((data) => {
        if (!active || !data) return;
        setLocalConfigFound(Boolean(data.found));
        setLocalConfigText(data.configText || '');
        setLocalShaders(Array.isArray(data.shaders) ? data.shaders : []);
      })
      .catch(() => {
        // local Ghostty discovery is optional
      });
    return () => {
      active = false;
    };
  }, []);

  const { preset, theme } = useMemo(
    () => resolveActiveTerminalTheme(settings, appIsDark),
    [settings, appIsDark]
  );

  const filteredThemes = useMemo(() => {
    const q = themeQuery.trim().toLowerCase();
    return TERMINAL_THEME_PRESETS.filter((t) => {
      if (themeModeFilter !== 'all' && t.mode !== themeModeFilter) return false;
      if (!q) return true;
      return `${t.name} ${t.ghosttyName} ${t.description} ${t.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [themeQuery, themeModeFilter]);

  const filteredLocalShaders = useMemo(() => {
    const q = localShaderQuery.trim().toLowerCase();
    if (!q) return localShaders;
    return localShaders.filter((s) => `${s.name} ${s.category} ${s.path}`.toLowerCase().includes(q));
  }, [localShaders, localShaderQuery]);

  function update(patch: Partial<TerminalSettings>) {
    onChange({ ...settings, ...patch });
  }

  function updateColorOverride(key: keyof typeof theme, value: string) {
    onChange({
      ...settings,
      customOverrides: {
        ...settings.customOverrides,
        [key]: value,
      },
    });
  }

  function handleImportText(rawText: string, sourceLabel: string) {
    const { patch, appliedKeys } = parseGhosttyConfig(rawText);
    if (appliedKeys.length === 0) {
      onNotify(`No Ghostty settings recognized in ${sourceLabel}.`, 'error');
      return;
    }
    const next: TerminalSettings = {
      ...settings,
      ...patch,
      customOverrides: patch.customOverrides
        ? { ...settings.customOverrides, ...patch.customOverrides }
        : patch.themeId
          ? {}
          : settings.customOverrides,
    };
    onChange(next);
    onNotify(`Applied ${appliedKeys.slice(0, 4).join(', ')}${appliedKeys.length > 4 ? ` +${appliedKeys.length - 4} more` : ''}`);
  }

  async function handleCopyGhosttyConfig() {
    const exported = exportGhosttyConfig(settings, appIsDark);
    try {
      await navigator.clipboard.writeText(exported);
      setCopiedConfig(true);
      onNotify('Copied Ghostty config to clipboard');
      window.setTimeout(() => setCopiedConfig(false), 1800);
    } catch {
      onNotify('Could not access clipboard.', 'error');
    }
  }

  const overrideCount = Object.keys(settings.customOverrides).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        {/* Top bar */}
        <div className="lanes-text-surface flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--l-text)' }}>
              Ghostty Terminal Studio
            </h2>
            <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
              Powered by real <code className="font-mono text-[12px]">ghostty-web</code> WASM + WebGL2 shaders. Changes apply live to every lane drawer and worker terminal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {localConfigFound && (
              <button
                type="button"
                onClick={() => handleImportText(localConfigText, '~/.config/ghostty/config')}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              >
                <FolderOpen size={13} aria-hidden="true" />
                <span>Load ~/.config/ghostty</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleCopyGhosttyConfig()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
              style={{
                backgroundColor: 'var(--l-raised)',
                borderColor: 'var(--l-line-strong)',
                color: 'var(--l-text)',
              }}
            >
              {copiedConfig ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              <span>{copiedConfig ? 'Copied config' : 'Copy Ghostty config'}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
              style={{
                backgroundColor: 'var(--l-panel)',
                borderColor: 'var(--l-line)',
                color: 'var(--l-muted)',
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Live Ghostty Preview stage */}
        <section
          className="overflow-hidden rounded-[12px] border"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
            style={{ borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center gap-2">
              <TerminalIcon size={14} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
              <span className="text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Live Preview
              </span>
              <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                · {preset.name} · {settings.fontFamily} {settings.fontSize}px
                {settings.shaderId !== 'none'
                  ? ` · ${settings.shaderId === 'local-glsl' ? settings.localShaderPath || 'local shader' : settings.shaderId}`
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'preview', label: 'Demo preview' },
                  { id: 'live', label: 'Live zsh shell' },
                ] as const
              ).map((m) => {
                const active = previewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPreviewMode(m.id)}
                    className="inline-flex h-7 items-center rounded-[7px] px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                      color: active ? 'var(--l-text)' : 'var(--l-muted)',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <GhosttyTerminal
              settings={settings}
              appIsDark={appIsDark}
              mode={previewMode}
              sessionLabel="Studio preview"
              showHeader={false}
              onNotify={onNotify}
              className="h-full w-full"
            />
          </div>
        </section>

        {/* Section 1: Ghostty Theme Gallery */}
        <section
          className="rounded-[12px] border p-5"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Themes
              </h3>
              <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Click any theme to apply immediately, or pair separate Light and Dark themes like Ghostty.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex items-center">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5"
                  style={{ color: 'var(--l-muted)' }}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={themeQuery}
                  onChange={(e) => setThemeQuery(e.target.value)}
                  placeholder="Search themes…"
                  aria-label="Search terminal themes"
                  className="h-8 w-44 rounded-[8px] border pl-8 pr-2.5 text-[12px] outline-none placeholder:text-[var(--l-muted)]"
                  style={{
                    backgroundColor: 'var(--l-bg)',
                    borderColor: 'var(--l-line)',
                    color: 'var(--l-text)',
                  }}
                />
              </label>
              <div className="flex items-center gap-1">
                {(['all', 'dark', 'light'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={themeModeFilter === m}
                    onClick={() => setThemeModeFilter(m)}
                    className="h-8 rounded-[8px] border px-2.5 text-[12px] font-medium capitalize transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: themeModeFilter === m ? 'var(--l-selected)' : 'var(--l-bg)',
                      borderColor: themeModeFilter === m ? 'var(--l-line-strong)' : 'var(--l-line)',
                      color: themeModeFilter === m ? 'var(--l-text)' : 'var(--l-muted)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Follow app light/dark pairing bar */}
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y py-3"
            style={{ borderColor: 'var(--l-line)' }}
          >
            <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: 'var(--l-text)' }}>
              <input
                type="checkbox"
                checked={settings.followAppMode}
                onChange={(e) => update({ followAppMode: e.target.checked })}
              />
              <span className="font-medium">Auto-switch with Lanes Light / Dark mode</span>
            </label>

            {settings.followAppMode && (
              <div className="flex flex-wrap items-center gap-3 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                <label className="flex items-center gap-1.5">
                  <span>Light:</span>
                  <select
                    value={settings.lightThemeId}
                    onChange={(e) => update({ lightThemeId: e.target.value, customOverrides: {} })}
                    className="h-7 rounded-[7px] border px-2 text-[12px]"
                    style={{
                      backgroundColor: 'var(--l-bg)',
                      borderColor: 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {TERMINAL_THEME_PRESETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span>Dark:</span>
                  <select
                    value={settings.darkThemeId}
                    onChange={(e) => update({ darkThemeId: e.target.value, customOverrides: {} })}
                    className="h-7 rounded-[7px] border px-2 text-[12px]"
                    style={{
                      backgroundColor: 'var(--l-bg)',
                      borderColor: 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {TERMINAL_THEME_PRESETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredThemes.map((t) => {
              const active = preset.id === t.id && overrideCount === 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...settings,
                      themeId: t.id,
                      followAppMode: false,
                      customOverrides: {},
                    })
                  }
                  className="group flex flex-col overflow-hidden rounded-[10px] border text-left transition-colors"
                  style={{
                    borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                    backgroundColor: 'var(--l-bg)',
                  }}
                >
                  {/* Mini Ghostty terminal swatch */}
                  <div
                    className="px-3 py-2.5 font-mono text-[12px] leading-relaxed"
                    style={{
                      backgroundColor: t.theme.background,
                      color: t.theme.foreground,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        ➜ lanes (main) npm test
                      </span>
                      <span
                        className="inline-block h-3 w-1.5 shrink-0"
                        style={{ backgroundColor: t.theme.cursor }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[
                        t.theme.red,
                        t.theme.green,
                        t.theme.yellow,
                        t.theme.blue,
                        t.theme.magenta,
                        t.theme.cyan,
                        t.theme.brightRed,
                        t.theme.brightCyan,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          className="h-2.5 flex-1 rounded-[3px]"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {t.name}
                      </div>
                      <div className="truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {t.mode === 'light' ? 'Light' : 'Dark'} · {t.tags.join(', ')}
                      </div>
                    </div>
                    {active && <Check size={14} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Ghostty WebGL2 Shaders */}
        <section
          className="rounded-[12px] border p-5"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
              <div>
                <h3 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  Ghostty Shaders (WebGL2)
                </h3>
                <p className="mt-0.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  Post-process your Ghostty terminal with built-in WebGL2 shaders, your Mac&apos;s own <code className="font-mono">~/.config/ghostty/shaders</code>, or custom GLSL.
                </p>
              </div>
            </div>

            {settings.shaderId !== 'none' && (
              <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                <span>Intensity</span>
                <input
                  type="range"
                  min={0.2}
                  max={1.5}
                  step={0.05}
                  value={settings.shaderIntensity}
                  onChange={(e) => update({ shaderIntensity: Number(e.target.value) })}
                  className="w-28"
                />
                <span className="w-9 text-right font-mono tabular-nums" style={{ color: 'var(--l-text)' }}>
                  {Math.round(settings.shaderIntensity * 100)}%
                </span>
              </label>
            )}
          </div>

          {/* Built-in shader grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TERMINAL_SHADER_PRESETS.map((sh) => {
              const active = settings.shaderId === sh.id;
              return (
                <button
                  key={sh.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ shaderId: sh.id })}
                  className="flex flex-col gap-1 rounded-[10px] border p-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                  style={{
                    borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                    backgroundColor: active ? 'var(--l-selected)' : 'var(--l-bg)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                      {sh.label}
                    </span>
                    <span className="text-[12px] capitalize" style={{ color: 'var(--l-muted)' }}>
                      {sh.category}
                    </span>
                  </div>
                  <p className="m-0 text-pretty text-[12px] leading-snug" style={{ color: 'var(--l-muted)' }}>
                    {sh.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Local Mac ~/.config/ghostty/shaders/*.glsl picker */}
          {localShaders.length > 0 && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--l-line)' }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wand2 size={14} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
                  <h4 className="m-0 text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
                    Your Mac&apos;s Ghostty Shaders ({localShaders.length} found)
                  </h4>
                </div>
                <input
                  type="search"
                  value={localShaderQuery}
                  onChange={(e) => setLocalShaderQuery(e.target.value)}
                  placeholder="Filter .glsl files…"
                  aria-label="Filter local Ghostty shaders"
                  className="h-7 w-44 rounded-[7px] border px-2.5 text-[12px] outline-none placeholder:text-[var(--l-muted)]"
                  style={{
                    backgroundColor: 'var(--l-bg)',
                    borderColor: 'var(--l-line)',
                    color: 'var(--l-text)',
                  }}
                />
              </div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {filteredLocalShaders.map((sh) => {
                  const active = settings.shaderId === 'local-glsl' && settings.localShaderPath === sh.path;
                  return (
                    <button
                      key={sh.path}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        update({
                          shaderId: 'local-glsl',
                          localShaderPath: sh.path,
                        })
                      }
                      title={sh.path}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] transition-colors hover:bg-[var(--l-hover)]"
                      style={{
                        borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                        backgroundColor: active ? 'var(--l-selected)' : 'var(--l-bg)',
                        color: active ? 'var(--l-text)' : 'var(--l-muted)',
                      }}
                    >
                      <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                        {sh.name}
                      </span>
                      <span style={{ color: 'var(--l-muted)' }}>{sh.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom GLSL editor */}
          <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--l-line)' }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 size={14} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                <h4 className="m-0 text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  Custom GLSL Shader
                </h4>
              </div>
              <button
                type="button"
                aria-pressed={settings.shaderId === 'custom-glsl'}
                onClick={() => update({ shaderId: settings.shaderId === 'custom-glsl' ? 'none' : 'custom-glsl' })}
                className="inline-flex h-7 items-center rounded-[7px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  borderColor: settings.shaderId === 'custom-glsl' ? 'var(--l-accent)' : 'var(--l-line)',
                  backgroundColor: settings.shaderId === 'custom-glsl' ? 'var(--l-selected)' : 'var(--l-bg)',
                  color: 'var(--l-text)',
                }}
              >
                {settings.shaderId === 'custom-glsl' ? 'Active (click to disable)' : 'Use custom GLSL'}
              </button>
            </div>
            <textarea
              value={settings.customGlsl}
              onChange={(e) =>
                onChange({
                  ...settings,
                  customGlsl: e.target.value,
                  shaderId: 'custom-glsl' as TerminalShaderId,
                })
              }
              rows={6}
              spellCheck={false}
              aria-label="Custom Ghostty GLSL fragment shader"
              className="w-full rounded-[8px] border p-2.5 font-mono text-[12px] leading-relaxed outline-none"
              style={{
                backgroundColor: 'var(--l-bg)',
                borderColor: 'var(--l-line)',
                color: 'var(--l-text)',
              }}
            />
          </div>
        </section>

        {/* Section 3: Font, Padding, Cursor & Surface + Colors */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section
            className="rounded-[12px] border p-5"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <h3 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Typography, Cursor &amp; Surface
            </h3>
            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-1.5 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                  Font family
                </span>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  className="h-8 rounded-[8px] border px-2.5 text-[13px]"
                  style={{
                    backgroundColor: 'var(--l-bg)',
                    borderColor: 'var(--l-line)',
                    color: 'var(--l-text)',
                  }}
                >
                  {TERMINAL_FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                  {!TERMINAL_FONT_OPTIONS.some((f) => f.id === settings.fontFamily) && (
                    <option value={settings.fontFamily}>{settings.fontFamily}</option>
                  )}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  <span className="flex justify-between">
                    <span>Font size</span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--l-text)' }}>
                      {settings.fontSize}px
                    </span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={22}
                    value={settings.fontSize}
                    onChange={(e) => update({ fontSize: Number(e.target.value) })}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  <span className="flex justify-between">
                    <span>Opacity</span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--l-text)' }}>
                      {Math.round(settings.backgroundOpacity * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0.6}
                    max={1}
                    step={0.02}
                    value={settings.backgroundOpacity}
                    onChange={(e) => update({ backgroundOpacity: Number(e.target.value) })}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  <span className="flex justify-between">
                    <span>Horizontal padding</span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--l-text)' }}>
                      {settings.paddingX}px
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={28}
                    value={settings.paddingX}
                    onChange={(e) => update({ paddingX: Number(e.target.value) })}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  <span className="flex justify-between">
                    <span>Vertical padding</span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--l-text)' }}>
                      {settings.paddingY}px
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={settings.paddingY}
                    onChange={(e) => update({ paddingY: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1">
                  {(['block', 'bar', 'underline'] as TerminalCursorStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={settings.cursorStyle === style}
                      onClick={() => update({ cursorStyle: style })}
                      className="h-8 rounded-[8px] border px-3 text-[12px] font-medium capitalize transition-colors hover:bg-[var(--l-hover)]"
                      style={{
                        backgroundColor: settings.cursorStyle === style ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: settings.cursorStyle === style ? 'var(--l-line-strong)' : 'var(--l-line)',
                        color: settings.cursorStyle === style ? 'var(--l-text)' : 'var(--l-muted)',
                      }}
                    >
                      {style}
                    </button>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: 'var(--l-text)' }}>
                  <input
                    type="checkbox"
                    checked={settings.cursorBlink}
                    onChange={(e) => update({ cursorBlink: e.target.checked })}
                  />
                  <span>Blink cursor</span>
                </label>
              </div>
            </div>
          </section>

          {/* Colors & Ghostty Config Import */}
          <section
            className="rounded-[12px] border p-5"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Colors &amp; Ghostty Config Import
              </h3>
              {overrideCount > 0 && (
                <button
                  type="button"
                  onClick={() => update({ customOverrides: {} })}
                  className="text-[12px] underline"
                  style={{ color: 'var(--l-muted)' }}
                >
                  Clear {overrideCount} custom
                </button>
              )}
            </div>

            {/* Core color pickers */}
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(
                [
                  { key: 'background', label: 'Background' },
                  { key: 'foreground', label: 'Text' },
                  { key: 'cursor', label: 'Cursor' },
                  { key: 'selectionBackground', label: 'Selection' },
                ] as const
              ).map((c) => {
                const value = theme[c.key] || '#16171a';
                return (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 rounded-[8px] border px-2 py-1.5 text-[12px]"
                    style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)', color: 'var(--l-text)' }}
                  >
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => updateColorOverride(c.key, e.target.value)}
                      className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                );
              })}
            </div>

            {/* 16 ANSI colors */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {ANSI_PALETTE_KEYS.map((key, idx) => (
                <label key={key} title={`palette ${idx} (${key})`} className="cursor-pointer">
                  <input
                    type="color"
                    aria-label={`ANSI palette ${idx} ${key}`}
                    value={theme[key] || '#888888'}
                    onChange={(e) => updateColorOverride(key, e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded-[5px] border bg-transparent p-0"
                    style={{ borderColor: 'var(--l-line)' }}
                  />
                </label>
              ))}
            </div>

            {/* Paste from ghostty-style.vercel.app */}
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: 'var(--l-line)' }}>
              <label className="block text-[12px] font-medium" style={{ color: 'var(--l-text)' }}>
                Paste any config from ghostty-style.vercel.app
              </label>
              <textarea
                value={pasteConfig}
                onChange={(e) => setPasteConfig(e.target.value)}
                rows={4}
                placeholder={'background = #1a1b26\nforeground = #c0caf5\nfont-size = 14\ncursor-style = bar'}
                spellCheck={false}
                className="mt-1.5 w-full rounded-[8px] border p-2 font-mono text-[12px] outline-none placeholder:text-[var(--l-muted)]"
                style={{
                  backgroundColor: 'var(--l-bg)',
                  borderColor: 'var(--l-line)',
                  color: 'var(--l-text)',
                }}
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={!pasteConfig.trim()}
                  onClick={() => handleImportText(pasteConfig, 'pasted config')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)] disabled:opacity-45"
                  style={{
                    backgroundColor: 'var(--l-raised)',
                    borderColor: 'var(--l-line-strong)',
                    color: 'var(--l-text)',
                  }}
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Apply Ghostty config</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_TERMINAL_SETTINGS };
