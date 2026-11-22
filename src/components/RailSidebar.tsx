import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bot as BotIcon,
  Box,
  Brain,
  CalendarClock,
  ChevronRight,
  FolderOpen,
  House,
  Layers,
  Lock,
  Menu,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wand2,
  X,
} from 'lucide-react';
import type { Branch, Bot, Lane, NeedsItem, PlaceId, ThemeId } from '../lib/types';
import { computeLaneStatus, computeNeedsCount, getThemePair } from '../lib/workbench';
import { CollapsibleRegion } from './AccessiblePrimitives';
import { AgentGlyph, LaneTile, StatusMark } from './Marks';

interface RailSidebarProps {
  place: PlaceId;
  activeLaneId: string | null;
  activeBotId: string | null;
  lanes: Lane[];
  branches: Branch[];
  bots: Bot[];
  needs: NeedsItem[];
  pendingMemoryCount: number;
  theme: ThemeId;
  pinnedRailPlaces: PlaceId[];
  panelPinned: boolean;
  mobileOpen: boolean;
  onTogglePin: () => void;
  onOpenMobile: () => void;
  onCloseMobile: () => void;
  onSelectPlace: (place: PlaceId) => void;
  onSelectLane: (laneId: string) => void;
  onSelectBot: (botId: string) => void;
  onOpenQuickAsk: () => void;
  onOpenNewLane: () => void;
  onOpenCustomizeRail: () => void;
  onToggleLightDark: () => void;
}

export function RailSidebar({
  place,
  activeLaneId,
  activeBotId,
  lanes,
  branches,
  bots,
  needs,
  pendingMemoryCount,
  theme,
  pinnedRailPlaces,
  panelPinned,
  mobileOpen,
  onTogglePin,
  onOpenMobile,
  onCloseMobile,
  onSelectPlace,
  onSelectLane,
  onSelectBot,
  onOpenQuickAsk,
  onOpenNewLane,
  onOpenCustomizeRail,
  onToggleLightDark,
}: RailSidebarProps) {
  const [query, setQuery] = useState('');
  const [idleExpanded, setIdleExpanded] = useState(true);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.requestAnimationFrame(() => {
      const first = mobileDrawerRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]'
      );
      first?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobile();
        return;
      }
      if (e.key !== 'Tab' || !mobileDrawerRef.current) return;
      const focusables = Array.from(
        mobileDrawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !mobileDrawerRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !mobileDrawerRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', onKey);
      mobileReturnFocusRef.current?.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  const needsCount = useMemo(() => computeNeedsCount(needs), [needs]);
  const { isDark } = getThemePair(theme);

  const filteredLanes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lanes;
    return lanes.filter((l) => `${l.name} ${l.purpose}`.toLowerCase().includes(q));
  }, [lanes, query]);

  const waitingLanes = filteredLanes.filter((l) => computeLaneStatus(l.id, branches) === 'needs');
  const workingLanes = filteredLanes.filter((l) => computeLaneStatus(l.id, branches) === 'working');
  const otherLanes = filteredLanes.filter((l) => computeLaneStatus(l.id, branches) === 'idle');

  const allRailItems: Record<
    PlaceId,
    {
      id: PlaceId;
      label: string;
      icon: typeof House;
      badge?: number;
      badgeNeeds?: boolean;
    }
  > = {
    home: { id: 'home', label: 'Home', icon: House },
    assistant: { id: 'assistant', label: 'Assistant', icon: Sparkles },
    lanes: { id: 'lanes', label: 'Lanes', icon: Layers },
    bots: { id: 'bots', label: 'Bots', icon: BotIcon },
    needs: { id: 'needs', label: 'Needs you', icon: Bell, badge: needsCount || undefined, badgeNeeds: true },
    scheduled: { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
    library: { id: 'library', label: 'Library', icon: FolderOpen },
    memory: { id: 'memory', label: 'Memory', icon: Brain, badge: pendingMemoryCount || undefined },
    media: { id: 'media', label: 'Media & Voice', icon: Wand2 },
    spatial: { id: 'spatial', label: '3D Studio', icon: Box },
    studio: { id: 'studio', label: 'Design Studio', icon: Palette },
    settings: { id: 'settings', label: 'Settings', icon: Settings },
  };

  const railItems = pinnedRailPlaces
    .map((id) => allRailItems[id])
    .filter((item): item is (typeof allRailItems)[PlaceId] => Boolean(item));

  const listContent = (
    <div
      className="flex h-full w-[204px] flex-col border-r"
      style={{ backgroundColor: 'var(--l-list)', borderColor: 'var(--l-line)' }}
    >
      {/* List header */}
      <div
        className="flex h-12 items-center justify-between border-b px-3"
        style={{ borderColor: 'var(--l-line)' }}
      >
        <span className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--l-text)' }}>
          Lanes
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenNewLane}
            title="New lane"
            aria-label="New lane"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            onClick={mobileOpen ? onCloseMobile : onTogglePin}
            title={mobileOpen ? 'Close navigation' : 'Collapse sidebar'}
            aria-label={mobileOpen ? 'Close navigation' : 'Collapse sidebar'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            {mobileOpen ? <X size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
      </div>

      {/* Search box */}
      <div className="p-2.5">
        <div
          className="lanes-focus-ring flex h-8 items-center gap-2 rounded-[8px] border px-2.5"
          style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)' }}
        >
          <Search size={13} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter lanes…"
            aria-label="Filter lanes"
            className="w-full border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--l-muted)]"
            style={{ color: 'var(--l-text)' }}
          />
        </div>
      </div>

      {/* Scrollable navigation list */}
      <nav aria-label="Lanes navigation" className="flex-1 overflow-y-auto px-2 pb-3">
        {/* Core links */}
        <div className="space-y-0.5">
          {[
            { id: 'home' as PlaceId, label: 'Home', icon: House },
            { id: 'needs' as PlaceId, label: 'Needs you', icon: Bell, count: needsCount, needsTone: true },
            { id: 'assistant' as PlaceId, label: 'Assistant', icon: Sparkles },
            { id: 'scheduled' as PlaceId, label: 'Scheduled', icon: CalendarClock },
          ].map((item) => {
            const Icon = item.icon;
            const active = place === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectPlace(item.id);
                  onCloseMobile();
                }}
                aria-current={active ? 'page' : undefined}
                className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-[14px] transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                  color: 'var(--l-text)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon
                  size={15}
                  style={{ color: item.needsTone && item.count ? 'var(--l-needs)' : 'var(--l-muted)' }}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
                {item.count ? (
                  <span
                    className="ml-auto text-[12px] font-medium tabular-nums"
                    style={{ color: item.needsTone ? 'var(--l-needs)' : 'var(--l-muted)' }}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Waiting on you lanes */}
        {waitingLanes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between px-2 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              <span>Waiting on you</span>
              <span className="tabular-nums">{waitingLanes.length}</span>
            </div>
            <div className="space-y-0.5">
              {waitingLanes.map((lane) => {
                const active = place === 'lanes' && activeLaneId === lane.id;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    title={lane.name}
                    onClick={() => {
                      onSelectLane(lane.id);
                      onCloseMobile();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className="lanes-density-row flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: active ? 'var(--l-selected)' : 'transparent' }}
                  >
                    <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]" style={{ color: 'var(--l-text)', fontWeight: active ? 500 : 400 }}>
                        {lane.name}
                      </span>
                      <span className="block truncate text-[12px]" style={{ color: 'var(--l-needs)' }}>
                        Needs you
                      </span>
                    </span>
                    <StatusMark status="needs" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Working lanes */}
        {workingLanes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between px-2 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              <span>Working</span>
              <span className="tabular-nums">{workingLanes.length}</span>
            </div>
            <div className="space-y-0.5">
              {workingLanes.map((lane) => {
                const active = place === 'lanes' && activeLaneId === lane.id;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    title={lane.name}
                    onClick={() => {
                      onSelectLane(lane.id);
                      onCloseMobile();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className="lanes-density-row flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: active ? 'var(--l-selected)' : 'transparent' }}
                  >
                    <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--l-text)', fontWeight: active ? 500 : 400 }}>
                      {lane.name}
                    </span>
                    <StatusMark status="working" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Other / Idle lanes */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIdleExpanded(!idleExpanded)}
            aria-expanded={idleExpanded}
            className="flex w-full items-center justify-between rounded-[6px] px-2 py-1 text-[12px] font-medium hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <span className="inline-flex items-center gap-1">
              <ChevronRight size={12} className="lanes-chevron" data-open={idleExpanded ? 'true' : 'false'} />
              <span>Your lanes</span>
            </span>
            <span className="tabular-nums">{otherLanes.length}</span>
          </button>
          <CollapsibleRegion open={idleExpanded}>
            <div className="space-y-0.5 pt-0.5">
              {otherLanes.map((lane) => {
                const active = place === 'lanes' && activeLaneId === lane.id;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    title={lane.name}
                    onClick={() => {
                      onSelectLane(lane.id);
                      onCloseMobile();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className="lanes-density-row flex w-full items-center gap-2.5 rounded-[8px] px-2 text-left transition-colors hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: active ? 'var(--l-selected)' : 'transparent' }}
                  >
                    <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--l-text)', fontWeight: active ? 500 : 400 }}>
                      {lane.name}
                    </span>
                    {lane.isPrivate ? (
                      <Lock size={12} style={{ color: 'var(--l-muted)' }} aria-label="Local-only lane" />
                    ) : (
                      <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                        {lane.updatedAt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CollapsibleRegion>
        </div>

        {/* Bots */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-2 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
            <span>Bots</span>
            <span className="tabular-nums">{bots.length}</span>
          </div>
          <div className="space-y-0.5">
            {bots.map((bot) => {
              const active = place === 'bots' && activeBotId === bot.id;
              const pendingSug = bot.suggestions.filter((s) => s.status === 'pending').length;
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => {
                    onSelectBot(bot.id);
                    onCloseMobile();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left transition-colors hover:bg-[var(--l-hover)]"
                  style={{ backgroundColor: active ? 'var(--l-selected)' : 'transparent' }}
                >
                  <AgentGlyph agentId={bot.agentId} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--l-text)', fontWeight: active ? 500 : 400 }}>
                    {bot.name}
                  </span>
                  {pendingSug > 0 && (
                    <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-accent)' }}>
                      {pendingSug}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Knowledge & Studio */}
        <div className="mt-4">
          <div className="px-2 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
            Knowledge &amp; studio
          </div>
          <div className="space-y-0.5">
            {[
              { id: 'media' as PlaceId, label: 'Media & Voice', icon: Wand2 },
              { id: 'spatial' as PlaceId, label: '3D Studio', icon: Box },
              { id: 'library' as PlaceId, label: 'Library', icon: FolderOpen },
              { id: 'memory' as PlaceId, label: 'Memory', icon: Brain, count: pendingMemoryCount },
              { id: 'studio' as PlaceId, label: 'Design Studio', icon: Palette },
              { id: 'settings' as PlaceId, label: 'Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = place === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectPlace(item.id);
                    onCloseMobile();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-[14px] transition-colors hover:bg-[var(--l-hover)]"
                  style={{
                    backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                    color: 'var(--l-text)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon size={15} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {item.count ? (
                    <span className="ml-auto text-[12px] tabular-nums" style={{ color: 'var(--l-accent)' }}>
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Quick Ask footer trigger */}
      <div className="border-t p-2" style={{ borderColor: 'var(--l-line)' }}>
        <button
          type="button"
          onClick={() => {
            onOpenQuickAsk();
            onCloseMobile();
          }}
          className="flex h-8 w-full items-center justify-between rounded-[8px] border px-2.5 text-[13px] transition-colors hover:bg-[var(--l-hover)]"
          style={{
            backgroundColor: 'var(--l-bg)',
            borderColor: 'var(--l-line)',
            color: 'var(--l-muted)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Search size={13} aria-hidden="true" />
            <span>Quick ask</span>
          </span>
          <kbd className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
            ⌘K
          </kbd>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop 56px Rail */}
      <aside
        aria-label="Places"
        className="relative z-[1] hidden md:flex h-full w-[56px] shrink-0 flex-col items-center justify-between border-r py-2.5"
        style={{ backgroundColor: 'var(--l-rail)', borderColor: 'var(--l-line)' }}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
          {!panelPinned && (
            <button
              type="button"
              onClick={onTogglePin}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--l-hover)]"
              style={{ color: 'var(--l-muted)' }}
            >
              <PanelLeftOpen size={17} />
            </button>
          )}
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = place === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPlace(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="lanes-rail-btn relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: active ? 'var(--l-selected)' : undefined,
                  color: active ? 'var(--l-accent)' : 'var(--l-muted)',
                }}
              >
                <Icon size={17} />
                {item.badge ? (
                  <span
                    className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums leading-none"
                    style={{
                      backgroundColor: item.badgeNeeds ? 'var(--l-needs)' : 'var(--l-accent)',
                      color: item.badgeNeeds ? 'var(--l-on-needs, var(--l-on-accent))' : 'var(--l-on-accent)',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={onOpenCustomizeRail}
            title="Customize rail pins & appearance"
            aria-label="Customize rail pins & appearance"
            className="lanes-rail-btn inline-flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <Pin size={15} />
          </button>
          <button
            type="button"
            onClick={onToggleLightDark}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="lanes-rail-btn inline-flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </aside>

      {/* Desktop pinned list panel with smooth horizontal collapse */}
      <div
        className="lanes-panel-shell relative z-[1] hidden h-full shrink-0 md:grid"
        data-collapsed={!panelPinned ? 'true' : 'false'}
        aria-hidden={!panelPinned}
        inert={!panelPinned ? true : undefined}
      >
        <div className="h-full w-[204px]">{listContent}</div>
      </div>

      {/* Mobile slide-over sheet */}
      {mobileOpen && (
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          <div className="lanes-sheet-in h-full shrink-0 shadow-xl">{listContent}</div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="lanes-backdrop lanes-dialog-backdrop flex-1 bg-black/40"
          />
        </div>
      )}

      {/* Mobile bottom tab bar (PhoneNav from DESIGN.md: Home, Lanes, Assistant, Needs you, More) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t md:hidden"
        style={{ backgroundColor: 'var(--l-rail)', borderColor: 'var(--l-line)' }}
      >
        {[
          { id: 'home' as PlaceId, label: 'Home', icon: House },
          { id: 'lanes' as PlaceId, label: 'Lanes', icon: Layers },
          { id: 'assistant' as PlaceId, label: 'Assistant', icon: Sparkles },
          { id: 'needs' as PlaceId, label: 'Needs you', icon: Bell, badge: needsCount },
        ].map((item) => {
          const Icon = item.icon;
          const active = place === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPlace(item.id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 text-[12px]"
              style={{ color: active ? 'var(--l-accent)' : 'var(--l-muted)' }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? (
                <span
                  className="absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums leading-none"
                  style={{
                    backgroundColor: 'var(--l-needs)',
                    color: 'var(--l-on-needs, var(--l-on-accent))',
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-expanded={mobileOpen}
          className="relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 text-[12px]"
          style={{ color: mobileOpen ? 'var(--l-accent)' : 'var(--l-muted)' }}
        >
          <Menu size={18} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
