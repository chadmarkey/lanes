import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { StudioTab, TokensDocument } from '../lib/types';
import type { AppearanceSettings } from '../lib/appearance';
import type { TerminalSettings } from '../lib/terminalConfig';
import { readJsonSafe, resolveApiUrl } from '../lib/tauri';
import {
  categorizeToken,
  filterTokens,
  getThemePair,
  STUDIO_TABS,
} from '../lib/workbench';
import { handleTablistKeyDown } from './AccessiblePrimitives';
import { AppearanceStudioPanel } from './AppearanceStudioPanel';
import { EmptyState, ErrorNote } from './Marks';
import { TerminalStudioPanel } from './TerminalStudioPanel';

export type { StudioTab };

interface DesignStudioViewProps {
  appearance: AppearanceSettings;
  terminalSettings: TerminalSettings;
  appIsDark: boolean;
  activeTab?: StudioTab;
  onTabChange?: (tab: StudioTab) => void;
  onChangeAppearance: (next: AppearanceSettings) => void;
  onResetAppearance: () => void;
  onChangeTerminalSettings: (next: TerminalSettings) => void;
  onResetTerminalSettings: () => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

export function DesignStudioView({
  appearance,
  terminalSettings,
  appIsDark,
  activeTab,
  onTabChange,
  onChangeAppearance,
  onResetAppearance,
  onChangeTerminalSettings,
  onResetTerminalSettings,
  onNotify,
}: DesignStudioViewProps) {
  const theme = appearance.theme;
  const [internalTab, setInternalTab] = useState<StudioTab>(activeTab ?? 'appearance');
  const tab = activeTab ?? internalTab;
  const setTab = (next: StudioTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  const [loadingTokens, setLoadingTokens] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [tokensDoc, setTokensDoc] = useState<TokensDocument | null>(null);
  const [tokenQuery, setTokenQuery] = useState('');
  const [tokenCategory, setTokenCategory] = useState('All');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const themePair = getThemePair(theme);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingTokens(true);
      setError(null);
      try {
        const res = await fetch(resolveApiUrl('/api/tokens'));
        if (!res.ok) throw new Error('Failed to load design tokens.');
        const data = await readJsonSafe<TokensDocument>(res);
        if (!active) return;
        setTokensDoc(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load design tokens.');
      } finally {
        if (active) setLoadingTokens(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const filteredTokens = useMemo(
    () => filterTokens(tokensDoc?.color?.tokens ?? [], tokenQuery, tokenCategory),
    [tokensDoc, tokenQuery, tokenCategory]
  );

  async function copyText(val: string, label: string) {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedToken(val);
      onNotify(`Copied ${label}`);
      setTimeout(() => setCopiedToken((curr) => (curr === val ? null : curr)), 1600);
    } catch {
      onNotify(`Copy ${label}`);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Studio header + tabs */}
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 md:px-6"
        style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
      >
        <div className="flex items-center gap-2.5">
          <Palette size={17} style={{ color: 'var(--l-accent)' }} />
          <div>
            <h1 className="m-0 text-[20px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: 'var(--l-text)' }}>
              Design Studio
            </h1>
            <p className="m-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
              16 themes · 26 live shaders · Ghostty Terminal · {themePair.family}
            </p>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Design Studio sections"
          onKeyDown={(e) => handleTablistKeyDown(e, STUDIO_TABS, tab, setTab)}
        >
          {[
            { id: 'appearance' as StudioTab, label: 'Appearance', icon: Sparkles },
            { id: 'terminal' as StudioTab, label: 'Terminal', icon: Terminal },
            { id: 'tokens' as StudioTab, label: 'Tokens', icon: SlidersHorizontal },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                  color: active ? 'var(--l-text)' : 'var(--l-muted)',
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {error && tab === 'tokens' && (
        <div className="p-4">
          <ErrorNote message={error} onRetry={() => setReloadTick((v) => v + 1)} />
        </div>
      )}

      {tab === 'appearance' ? (
        <AppearanceStudioPanel
          appearance={appearance}
          onChange={onChangeAppearance}
          onReset={onResetAppearance}
          onNotify={onNotify}
        />
      ) : tab === 'terminal' ? (
        <TerminalStudioPanel
          settings={terminalSettings}
          appIsDark={appIsDark}
          onChange={onChangeTerminalSettings}
          onReset={onResetTerminalSettings}
          onNotify={onNotify}
        />
      ) : loadingTokens ? (
        <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: 'var(--l-muted)' }}>
          Loading design tokens…
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
          <div className="mx-auto max-w-[1040px]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="lanes-text-surface">
                <h2 className="m-0 text-[18px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  OKLCH Color &amp; Surface Tokens
                </h2>
                <p className="mt-0.5 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                  Click any token to copy its CSS variable (<code className="font-mono text-[12px]">var(--l-...)</code>).
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
                    value={tokenQuery}
                    onChange={(e) => setTokenQuery(e.target.value)}
                    placeholder="Filter tokens…"
                    aria-label="Filter tokens"
                    className="h-8 w-44 rounded-[8px] border pl-8 pr-2.5 text-[12px] outline-none placeholder:text-[var(--l-muted)]"
                    style={{
                      backgroundColor: 'var(--l-raised)',
                      borderColor: 'var(--l-line-strong)',
                      color: 'var(--l-text)',
                    }}
                  />
                </label>
                {['All', 'Layers', 'Text & Lines', 'Status', 'Lane Types', 'Agents'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={tokenCategory === cat}
                    onClick={() => setTokenCategory(cat)}
                    className="h-8 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: tokenCategory === cat ? 'var(--l-selected)' : 'var(--l-raised)',
                      borderColor: tokenCategory === cat ? 'var(--l-accent)' : 'var(--l-line)',
                      color: tokenCategory === cat ? 'var(--l-text)' : 'var(--l-muted)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredTokens.length === 0 ? (
              <EmptyState title="No matching tokens" detail="Try a different search or category filter." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTokens.map((tok) => {
                  const cssVar = `var(--${tok.name})`;
                  const currentVal = tok.value[theme] ?? tok.value['calm-light'] ?? Object.values(tok.value)[0] ?? '';
                  const copied = copiedToken === cssVar;
                  return (
                    <button
                      key={tok.name}
                      type="button"
                      onClick={() => void copyText(cssVar, cssVar)}
                      className="flex flex-col gap-2 rounded-[10px] border p-3.5 text-left transition-colors hover:bg-[var(--l-hover)]"
                      style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-5 w-5 shrink-0 rounded-[5px] border"
                            style={{ backgroundColor: cssVar, borderColor: 'var(--l-line-strong)' }}
                          />
                          <code className="truncate font-mono text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                            --{tok.name}
                          </code>
                        </div>
                        <span style={{ color: 'var(--l-muted)' }}>
                          {copied ? <Check size={13} style={{ color: 'var(--l-ok)' }} /> : <Copy size={13} />}
                        </span>
                      </div>
                      <p className="m-0 text-[12px] leading-snug" style={{ color: 'var(--l-muted)' }}>
                        {tok.usage}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        <span className="truncate font-mono">{currentVal}</span>
                        <span className="shrink-0">{categorizeToken(tok.name)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
