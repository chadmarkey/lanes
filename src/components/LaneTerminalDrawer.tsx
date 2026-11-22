import { useEffect, useRef, useState } from 'react';
import { Palette, Plus, Terminal as TerminalIcon, X } from 'lucide-react';
import {
  TERMINAL_SHADER_PRESETS,
  TERMINAL_THEME_PRESETS,
  type TerminalSettings,
  type TerminalShaderId,
} from '../lib/terminalConfig';
import { GhosttyTerminal } from './GhosttyTerminal';

const DRAWER_MIN_HEIGHT = 180;
const DRAWER_MAX_HEIGHT = 520;
const DRAWER_DEFAULT_HEIGHT = 270;

interface TerminalTabItem {
  id: string;
  label: string;
}

interface LaneTerminalDrawerProps {
  open: boolean;
  laneName: string;
  settings: TerminalSettings;
  appIsDark: boolean;
  onChangeSettings: (next: TerminalSettings) => void;
  onClose: () => void;
  onOpenStudio: () => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

export function LaneTerminalDrawer({
  open,
  laneName,
  settings,
  appIsDark,
  onChangeSettings,
  onClose,
  onOpenStudio,
  onNotify,
}: LaneTerminalDrawerProps) {
  const [height, setHeight] = useState(DRAWER_DEFAULT_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const [tabs, setTabs] = useState<TerminalTabItem[]>([{ id: 'shell-1', label: 'zsh 1' }]);
  const [activeTabId, setActiveTabId] = useState('shell-1');
  const nextTabNumRef = useRef(2);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(DRAWER_DEFAULT_HEIGHT);

  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      pointerIdRef.current = null;
      setDragging(false);
    };
    window.addEventListener('blur', end);
    return () => window.removeEventListener('blur', end);
  }, [dragging]);

  if (!open) return null;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    const delta = startYRef.current - e.clientY;
    const maxAllowed = Math.min(DRAWER_MAX_HEIGHT, Math.max(DRAWER_MIN_HEIGHT, window.innerHeight - 240));
    setHeight(Math.round(Math.max(DRAWER_MIN_HEIGHT, Math.min(maxAllowed, startHeightRef.current + delta))));
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    pointerIdRef.current = null;
    setDragging(false);
  }

  function handleResizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHeight((h) => Math.min(DRAWER_MAX_HEIGHT, h + 24));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHeight((h) => Math.max(DRAWER_MIN_HEIGHT, h - 24));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHeight(DRAWER_DEFAULT_HEIGHT);
    }
  }

  function addTab() {
    const n = nextTabNumRef.current++;
    const next: TerminalTabItem = { id: `shell-${n}`, label: `zsh ${n}` };
    setTabs((prev) => [...prev, next]);
    setActiveTabId(next.id);
  }

  function closeTab(id: string) {
    if (tabs.length <= 1) {
      onClose();
      return;
    }
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  }

  return (
    <section
      aria-label={`${laneName} Ghostty terminal drawer`}
      className="flex shrink-0 flex-col border-t"
      style={{
        height: `${height}px`,
        borderColor: 'var(--l-line)',
        backgroundColor: 'var(--l-panel)',
        transition: dragging ? 'none' : 'height 140ms var(--l-hover-ease)',
      }}
    >
      {/* Horizontal resize grip */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal drawer"
        aria-valuemin={DRAWER_MIN_HEIGHT}
        aria-valuemax={DRAWER_MAX_HEIGHT}
        aria-valuenow={height}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={() => setHeight(DRAWER_DEFAULT_HEIGHT)}
        onKeyDown={handleResizeKeyDown}
        title="Drag to resize terminal (or use Up/Down arrows)"
        className="h-1.5 w-full cursor-row-resize transition-colors hover:bg-[var(--l-accent-soft)]"
      />

      {/* Drawer tab bar + quick Ghostty theme & shader pickers */}
      <div
        className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3"
        style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
      >
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <TerminalIcon size={13} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium"
                style={{
                  backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                  color: active ? 'var(--l-text)' : 'var(--l-muted)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className="bg-transparent p-0 text-left text-inherit"
                >
                  {tab.label}
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(tab.id)}
                  aria-label={`Close ${tab.label}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] opacity-70 hover:bg-[var(--l-hover)] hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addTab}
            title="New terminal tab"
            aria-label="New terminal tab"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Quick theme picker */}
          <select
            aria-label="Terminal theme"
            value={settings.themeId}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                themeId: e.target.value,
                followAppMode: false,
                customOverrides: {},
              })
            }
            className="hidden h-6 rounded-[6px] border px-1.5 text-[12px] sm:block"
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

          {/* Quick shader picker */}
          <select
            aria-label="Terminal shader"
            value={settings.shaderId === 'local-glsl' || settings.shaderId === 'custom-glsl' ? 'none' : settings.shaderId}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                shaderId: e.target.value as TerminalShaderId,
              })
            }
            className="hidden h-6 rounded-[6px] border px-1.5 text-[12px] md:block"
            style={{
              backgroundColor: 'var(--l-bg)',
              borderColor: 'var(--l-line)',
              color: 'var(--l-text)',
            }}
          >
            {TERMINAL_SHADER_PRESETS.map((sh) => (
              <option key={sh.id} value={sh.id}>
                Shader: {sh.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenStudio}
            title="Open Ghostty Terminal Studio (all themes & shaders)"
            className="inline-flex h-6 items-center gap-1 rounded-[6px] border px-2 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line)',
              color: 'var(--l-text)',
            }}
          >
            <Palette size={11} aria-hidden="true" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Hide terminal drawer (⌃`)"
            aria-label="Hide terminal drawer"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Active tab terminals (kept mounted while open so running processes survive tab switches) */}
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'h-full w-full' : 'hidden'}
          >
            <GhosttyTerminal
              settings={settings}
              appIsDark={appIsDark}
              mode="live"
              sessionLabel={`${laneName} · ${tab.label}`}
              showHeader={false}
              onOpenCustomizer={onOpenStudio}
              onNotify={onNotify}
              className="h-full w-full"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
