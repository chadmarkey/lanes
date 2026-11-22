import { useEffect, useRef, useState } from 'react';
import {
  GripHorizontal,
  GripVertical,
  Palette,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import {
  TERMINAL_SHADER_PRESETS,
  TERMINAL_THEME_PRESETS,
  type TerminalSettings,
  type TerminalShaderId,
} from '../lib/terminalConfig';
import type { TerminalDockPosition } from '../lib/workspaceLayout';
import { GhosttyTerminal } from './GhosttyTerminal';

const DRAWER_MIN_HEIGHT = 180;
const DRAWER_MAX_HEIGHT = 520;
const DRAWER_DEFAULT_HEIGHT = 270;

const SIDE_MIN_WIDTH = 300;
const SIDE_MAX_WIDTH = 680;
const SIDE_DEFAULT_WIDTH = 440;

interface TerminalTabItem {
  id: string;
  label: string;
}

interface LaneTerminalDrawerProps {
  open: boolean;
  dock: TerminalDockPosition;
  laneName: string;
  settings: TerminalSettings;
  appIsDark: boolean;
  onChangeDock: (dock: TerminalDockPosition) => void;
  onDragPaneStart?: () => void;
  onDragPaneEnd?: () => void;
  onChangeSettings: (next: TerminalSettings) => void;
  onClose: () => void;
  onOpenStudio: () => void;
  onNotify: (msg: string, tone?: 'info' | 'error') => void;
}

export function LaneTerminalDrawer({
  open,
  dock,
  laneName,
  settings,
  appIsDark,
  onChangeDock,
  onDragPaneStart,
  onDragPaneEnd,
  onChangeSettings,
  onClose,
  onOpenStudio,
  onNotify,
}: LaneTerminalDrawerProps) {
  const [height, setHeight] = useState(DRAWER_DEFAULT_HEIGHT);
  const [width, setWidth] = useState(SIDE_DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const [tabs, setTabs] = useState<TerminalTabItem[]>([{ id: 'shell-1', label: 'zsh 1' }]);
  const [activeTabId, setActiveTabId] = useState('shell-1');
  const nextTabNumRef = useRef(2);
  const pointerIdRef = useRef<number | null>(null);
  const startCoordRef = useRef(0);
  const startSizeRef = useRef(DRAWER_DEFAULT_HEIGHT);

  const isSide = dock === 'left' || dock === 'right';

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
    startCoordRef.current = isSide ? e.clientX : e.clientY;
    startSizeRef.current = isSide ? width : height;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    if (isSide) {
      const rawDelta = e.clientX - startCoordRef.current;
      const delta = dock === 'right' ? -rawDelta : rawDelta;
      const maxAllowed = Math.min(SIDE_MAX_WIDTH, Math.max(SIDE_MIN_WIDTH, window.innerWidth - 340));
      setWidth(Math.round(Math.max(SIDE_MIN_WIDTH, Math.min(maxAllowed, startSizeRef.current + delta))));
    } else {
      const delta = startCoordRef.current - e.clientY;
      const maxAllowed = Math.min(DRAWER_MAX_HEIGHT, Math.max(DRAWER_MIN_HEIGHT, window.innerHeight - 240));
      setHeight(Math.round(Math.max(DRAWER_MIN_HEIGHT, Math.min(maxAllowed, startSizeRef.current + delta))));
    }
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
    if (isSide) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setWidth((w) => Math.max(SIDE_MIN_WIDTH, Math.min(SIDE_MAX_WIDTH, w + (dock === 'right' ? 24 : -24))));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setWidth((w) => Math.max(SIDE_MIN_WIDTH, Math.min(SIDE_MAX_WIDTH, w + (dock === 'right' ? -24 : 24))));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setWidth(SIDE_DEFAULT_WIDTH);
      }
    } else {
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

  const resizeHandle = (
    <div
      role="separator"
      aria-orientation={isSide ? 'vertical' : 'horizontal'}
      aria-label="Resize terminal panel"
      aria-valuemin={isSide ? SIDE_MIN_WIDTH : DRAWER_MIN_HEIGHT}
      aria-valuemax={isSide ? SIDE_MAX_WIDTH : DRAWER_MAX_HEIGHT}
      aria-valuenow={isSide ? width : height}
      tabIndex={0}
      data-dragging={dragging ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={() => (isSide ? setWidth(SIDE_DEFAULT_WIDTH) : setHeight(DRAWER_DEFAULT_HEIGHT))}
      onKeyDown={handleResizeKeyDown}
      title={
        isSide
          ? 'Drag to resize terminal width (or use Left/Right arrows)'
          : 'Drag to resize terminal height (or use Up/Down arrows)'
      }
      className={
        isSide
          ? 'lanes-resize-handle hidden lg:block'
          : 'h-1.5 w-full shrink-0 cursor-row-resize transition-colors hover:bg-[var(--l-accent-soft)]'
      }
    />
  );

  const panelBody = (
    <section
      aria-label={`${laneName} Ghostty terminal`}
      className={`flex min-h-0 flex-1 flex-col ${
        dock === 'bottom' ? 'border-t' : dock === 'right' ? 'border-l' : 'border-r'
      }`}
      style={{
        height: isSide ? '100%' : `${height}px`,
        width: isSide ? `${width}px` : '100%',
        borderColor: 'var(--l-line)',
        backgroundColor: 'var(--l-panel)',
        transition: dragging ? 'none' : isSide ? 'width 140ms var(--l-hover-ease)' : 'height 140ms var(--l-hover-ease)',
      }}
    >
      {dock === 'bottom' && resizeHandle}

      {/* Draggable header bar (drag to Left / Right / Bottom to re-dock like VS Code / Antigravity) */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-lanes-pane', 'terminal');
          e.dataTransfer.effectAllowed = 'move';
          onDragPaneStart?.();
        }}
        onDragEnd={() => onDragPaneEnd?.()}
        className="flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b px-2.5 active:cursor-grabbing"
        style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
        title="Drag this bar to dock terminal on Left, Right, or Bottom"
      >
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {isSide ? (
            <GripVertical size={12} className="shrink-0 opacity-60" style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
          ) : (
            <GripHorizontal size={12} className="shrink-0 opacity-60" style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
          )}
          <TerminalIcon size={13} className="shrink-0" style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium"
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
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Quick theme picker */}
          {!isSide && (
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
          )}

          {/* Quick shader picker */}
          {!isSide && (
            <select
              aria-label="Terminal shader"
              value={settings.shaderId === 'local-glsl' || settings.shaderId === 'custom-glsl' ? 'none' : settings.shaderId}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  shaderId: e.target.value as TerminalShaderId,
                })
              }
              className="hidden h-6 rounded-[6px] border px-1.5 text-[12px] lg:block"
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
          )}

          {/* Dock position switcher: Left / Bottom / Right */}
          <div
            role="group"
            aria-label="Terminal dock position"
            className="hidden items-center rounded-[6px] border p-0.5 sm:inline-flex"
            style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
          >
            {(
              [
                { id: 'left' as const, label: 'Dock terminal on left', icon: PanelLeft },
                { id: 'bottom' as const, label: 'Dock terminal at bottom', icon: PanelBottom },
                { id: 'right' as const, label: 'Dock terminal on right', icon: PanelRight },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = dock === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={opt.label}
                  title={opt.label}
                  onClick={() => onChangeDock(opt.id)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--l-hover)]"
                  style={{
                    backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                    color: active ? 'var(--l-accent)' : 'var(--l-muted)',
                  }}
                >
                  <Icon size={12} />
                </button>
              );
            })}
          </div>

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
            <span className="hidden sm:inline">Studio</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Hide terminal (⌃`)"
            aria-label="Hide terminal"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Active tab terminals (stay mounted across tab & dock switches so running zsh never resets) */}
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

  if (isSide) {
    return (
      <div
        className={`flex h-full shrink-0 ${dock === 'left' ? 'order-first' : 'order-last'}`}
      >
        {dock === 'right' && resizeHandle}
        {panelBody}
        {dock === 'left' && resizeHandle}
      </div>
    );
  }

  return panelBody;
}
