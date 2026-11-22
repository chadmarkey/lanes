import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import type {
  AgentId,
  ApprovalMode,
  BreadcrumbTarget,
  ComposerMode,
  ComposerOutput,
  GeminiModelId,
  Lane,
  LaneColorIndex,
  LibraryItem,
  MediaStudioTab,
  PlaceId,
  WorkspaceState,
} from './lib/types';
import {
  DEFAULT_APPEARANCE,
  applyAppearanceToDocument,
  isLiveShader,
  sanitizeAppearanceSettings,
  type AppearanceSettings,
} from './lib/appearance';
import {
  DEFAULT_TERMINAL_SETTINGS,
  loadTerminalSettings,
  saveTerminalSettings,
  type TerminalSettings,
} from './lib/terminalConfig';
import {
  applyIdOrder,
  loadWorkspaceLayout,
  moveIdByStep,
  reorderIds,
  saveWorkspaceLayout,
  type WorkspaceLayout,
} from './lib/workspaceLayout';
import { readJsonSafe, resolveApiUrl } from './lib/tauri';
import {
  buildBreadcrumbs,
  formatViewHash,
  getBrowserStorage,
  parseViewHash,
  pruneWorkerModels,
  settleViewIds,
  toggleThemeMode,
} from './lib/workbench';
import { BotsView } from './components/BotsView';
import { Breadcrumbs } from './components/Breadcrumbs';
import { DesignStudioView, type StudioTab } from './components/DesignStudioView';
import { HomeView } from './components/HomeView';
import { LaneView, NewLaneModal } from './components/LaneView';
import { ErrorNote } from './components/Marks';
import { MediaStudioView } from './components/MediaStudioView';
import { NeedsYouView } from './components/NeedsYouView';
import { LibraryView, MemoryView, ScheduledView } from './components/OperationsViews';
import { QuickAskModal } from './components/QuickAskModal';
import { RailSidebar } from './components/RailSidebar';
import { SettingsView } from './components/SettingsView';
import { ShaderCanvas } from './components/ShaderCanvas';
import { SpatialSceneView } from './components/SpatialSceneView';

const APPEARANCE_STORAGE_KEY = 'lanes.appearance.v1';
const LEGACY_THEME_KEY = 'lanes.theme.v2';

function loadInitialAppearance(): AppearanceSettings {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      return sanitizeAppearanceSettings(JSON.parse(raw));
    }
    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme) {
      return sanitizeAppearanceSettings({ ...DEFAULT_APPEARANCE, theme: legacyTheme });
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_APPEARANCE, pinnedRailPlaces: [...DEFAULT_APPEARANCE.pinnedRailPlaces] };
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appearance, setAppearance] = useState<AppearanceSettings>(loadInitialAppearance);
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>(loadTerminalSettings);
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(loadWorkspaceLayout);
  const appIsDark = appearance.theme === 'dark' || appearance.theme.endsWith('-dark');

  useEffect(() => {
    saveTerminalSettings(terminalSettings);
  }, [terminalSettings]);

  useEffect(() => {
    saveWorkspaceLayout(workspaceLayout);
  }, [workspaceLayout]);
  // The open view lives in the address (#/studio/tokens), so a reload or a shared link lands on it.
  const [initialRoute] = useState(() => parseViewHash(window.location.hash));
  const [place, setPlace] = useState<PlaceId>(initialRoute?.place ?? 'home');
  const [activeLaneId, setActiveLaneId] = useState<string | null>(initialRoute?.laneId ?? null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(initialRoute?.branchId ?? null);
  const [activeBotId, setActiveBotId] = useState<string | null>(initialRoute?.botId ?? null);
  const [mediaTab, setMediaTab] = useState<MediaStudioTab>(initialRoute?.mediaTab ?? 'images');
  const [studioTab, setStudioTab] = useState<StudioTab>(
    initialRoute?.studioTab ?? 'appearance'
  );

  // When set, the next address update rewrites the current history entry instead of adding one:
  // used for the first load, after Back/Forward, and when a link names something that no longer exists.
  const replaceNextUrlRef = useRef(true);
  // Bumped on every Back/Forward so the address effect always runs and clears replaceNextUrlRef.
  const [popTick, setPopTick] = useState(0);

  // Write the open view into the address; each user navigation is a history step so Back works.
  useEffect(() => {
    const hash = formatViewHash({
      place,
      laneId: activeLaneId ?? undefined,
      branchId: activeBranchId ?? undefined,
      botId: activeBotId ?? undefined,
      mediaTab,
      studioTab,
    });
    const replace = replaceNextUrlRef.current || !window.location.hash;
    replaceNextUrlRef.current = false;
    if (window.location.hash === hash) return;
    if (replace) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
  }, [place, activeLaneId, activeBranchId, activeBotId, mediaTab, studioTab, popTick]);

  // Back, Forward, or a typed address: move to the view it names.
  useEffect(() => {
    const onPopState = () => {
      const route = parseViewHash(window.location.hash);
      if (!route) return;
      replaceNextUrlRef.current = true;
      setPopTick((n) => n + 1);
      setPlace(route.place);
      if (route.laneId) setActiveLaneId(route.laneId);
      // A worker panel is only open when the address names one.
      setActiveBranchId(route.place === 'lanes' ? (route.branchId ?? null) : null);
      if (route.botId) setActiveBotId(route.botId);
      if (route.mediaTab) setMediaTab(route.mediaTab);
      if (route.studioTab) setStudioTab(route.studioTab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [panelPinned, setPanelPinned] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAskOpen, setQuickAskOpen] = useState(false);
  const [newLaneOpen, setNewLaneOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
      toastTimerRef.current = null;
    }, tone === 'error' ? 4500 : 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const isActionPending = useCallback((key: string) => pendingKeys.has(key), [pendingKeys]);

  const runPending = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T | null> => {
    if (pendingKeys.has(key)) return null;
    setPendingKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      return await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed. Try again.', 'error');
      return null;
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [pendingKeys, showToast]);

  // Apply live AppearanceSettings (theme, accent, shader, radius, density, icon pack & motion)
  useEffect(() => {
    applyAppearanceToDocument(appearance);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      // ignore
    }
  }, [appearance]);

  // Global Cmd/Ctrl+K shortcut for Quick Ask
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickAskOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // The address (first load, Back/Forward, a typed link) can name a lane, worker or bot that
  // doesn't exist, or a worker from another lane. Settle on real ones and fix the address in
  // place rather than adding a history step.
  useEffect(() => {
    if (!workspace) return;
    const next = settleViewIds({ laneId: activeLaneId, branchId: activeBranchId, botId: activeBotId }, workspace);
    if (next.laneId === activeLaneId && next.branchId === activeBranchId && next.botId === activeBotId) return;
    replaceNextUrlRef.current = true;
    setActiveLaneId(next.laneId);
    setActiveBranchId(next.branchId);
    setActiveBotId(next.botId);
  }, [workspace, activeLaneId, activeBranchId, activeBotId]);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/workspace'));
      if (!res.ok) throw new Error('Could not load Lanes workspace.');
      const data: WorkspaceState = await res.json();
      setWorkspace(data);
      pruneWorkerModels(
        data.branches.map((b) => b.id),
        getBrowserStorage()
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Lanes API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  async function apiPost(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    const res = await fetch(resolveApiUrl(url), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readJsonSafe<Record<string, any>>(res);
    if (!res.ok) {
      throw new Error(
        typeof data?.error === 'string' && data.error
          ? data.error
          : `Request failed (HTTP ${res.status}).`
      );
    }
    if (!data) {
      throw new Error('Server returned an unexpected response.');
    }
    if (data.state) {
      setWorkspace(data.state);
    }
    return data;
  }

  const pendingMemoryCount = useMemo(
    () => (workspace?.memory ?? []).filter((m) => m.status === 'pending').length,
    [workspace]
  );

  const activeLane = useMemo(
    () => (workspace?.lanes ?? []).find((l) => l.id === activeLaneId) ?? workspace?.lanes[0] ?? null,
    [workspace, activeLaneId]
  );

  const activeBranch = useMemo(
    () =>
      activeBranchId
        ? (workspace?.branches ?? []).find((b) => b.id === activeBranchId) ?? null
        : null,
    [workspace, activeBranchId]
  );

  const activeBot = useMemo(
    () =>
      activeBotId
        ? (workspace?.bots ?? []).find((b) => b.id === activeBotId) ?? null
        : null,
    [workspace, activeBotId]
  );

  const breadcrumbs = useMemo(
    () =>
      buildBreadcrumbs({
        place,
        activeLane,
        activeBranch,
        activeBot,
        mediaTab,
        studioTab,
      }),
    [place, activeLane, activeBranch, activeBot, mediaTab, studioTab]
  );

  function handleBreadcrumbNavigate(target: BreadcrumbTarget) {
    switch (target.kind) {
      case 'home':
        setActiveBranchId(null);
        setPlace('home');
        break;
      case 'place':
        setActiveBranchId(null);
        setPlace(target.place);
        if (target.place === 'media') setMediaTab('images');
        if (target.place === 'studio') setStudioTab('appearance');
        break;
      case 'lane':
        setActiveLaneId(target.laneId);
        setActiveBranchId(null);
        setPlace('lanes');
        break;
      case 'branch':
        setActiveLaneId(target.laneId);
        setActiveBranchId(target.branchId);
        setPlace('lanes');
        break;
      case 'bot':
        setActiveBotId(target.botId);
        setPlace('bots');
        break;
      case 'media-tab':
        setMediaTab(target.tab);
        setPlace('media');
        break;
      case 'studio-tab':
        setStudioTab(target.tab);
        setPlace('studio');
        break;
    }
  }

  const handleSelectBranch = useCallback((branchId: string | null) => {
    setActiveBranchId(branchId);
    // Auto-collapse the 204px panel on laptop/narrow viewports when inspecting a worker beside the chat
    if (branchId && typeof window !== 'undefined' && window.innerWidth < 1360) {
      setPanelPinned(false);
    }
  }, []);

  async function handleHomeRoute(text: string): Promise<boolean> {
    setSending(true);
    try {
      const data = await apiPost('/api/home/route', { text });
      showToast(
        data.replyError ? `${data.reason} · ${data.replyError}` : data.reason || 'Message routed',
        data.replyError ? 'error' : 'info'
      );
      if (data.target === 'lane' && data.laneId) {
        setActiveLaneId(data.laneId);
        setActiveBranchId(null);
        setPlace('lanes');
      } else {
        setPlace('assistant');
      }
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not route message.', 'error');
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleSendLaneOrAssistant(payload: {
    text: string;
    mode: ComposerMode;
    agentId: AgentId;
    modelId: GeminiModelId;
    useSearch: boolean;
    output: ComposerOutput;
    approvalMode: ApprovalMode;
  }): Promise<boolean> {
    setSending(true);
    try {
      if (place === 'assistant') {
        await apiPost('/api/assistant/messages', payload);
      } else if (activeLane) {
        const data = await apiPost(`/api/lanes/${encodeURIComponent(activeLane.id)}/messages`, payload);
        if (data.branch?.id) {
          handleSelectBranch(data.branch.id);
          showToast(`Started branch ${data.branch.gitBranch}`);
        }
      }
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send message.', 'error');
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleCreateLane(payload: {
    name: string;
    purpose: string;
    color: LaneColorIndex;
    icon: Lane['icon'];
    isPrivate: boolean;
    approvalMode: ApprovalMode;
  }): Promise<boolean> {
    const data = await runPending('create-lane', () => apiPost('/api/lanes', payload));
    if (!data) return false;
    if (data.lane?.id) {
      setActiveLaneId(data.lane.id);
      setActiveBranchId(null);
      setPlace('lanes');
      showToast(`Created lane ${data.lane.name}`);
    }
    return true;
  }

  async function handleUpdateLane(laneId: string, patch: Partial<Lane>): Promise<boolean> {
    const data = await runPending(`lane-settings:${laneId}`, () =>
      apiPost(`/api/lanes/${encodeURIComponent(laneId)}`, patch, 'PATCH')
    );
    if (!data) return false;
    showToast('Saved lane settings');
    return true;
  }

  async function handleCreateBranch(title: string, agentId: AgentId, prompt: string): Promise<boolean> {
    if (!activeLane) return false;
    const data = await runPending('create-branch', () =>
      apiPost(`/api/lanes/${encodeURIComponent(activeLane.id)}/branches`, {
        title,
        agentId,
        prompt,
      })
    );
    if (!data) return false;
    if (data.branch?.id) {
      handleSelectBranch(data.branch.id);
      showToast(`Started branch ${data.branch.gitBranch}`);
    }
    return true;
  }

  async function handleSendBranchMessage(
    branchId: string,
    text: string,
    modelId?: string,
    reopen = false
  ): Promise<boolean> {
    const data = await runPending(`branch-msg:${branchId}`, () =>
      apiPost(`/api/branches/${encodeURIComponent(branchId)}/messages`, { text, modelId, reopen })
    );
    return Boolean(data);
  }

  async function handleResolveApproval(branchId: string, decision: 'approved' | 'declined'): Promise<boolean> {
    const data = await runPending(`approval:${branchId}`, () =>
      apiPost(`/api/branches/${encodeURIComponent(branchId)}/approval`, { decision })
    );
    if (!data) return false;
    showToast(decision === 'approved' ? 'Approved branch action' : 'Declined branch action');
    return true;
  }

  async function handleResolveDecision(branchId: string, choiceKey: string): Promise<boolean> {
    const data = await runPending(`decision:${branchId}`, () =>
      apiPost(`/api/branches/${encodeURIComponent(branchId)}/decision`, { choiceKey })
    );
    if (!data) return false;
    showToast(`Picked option ${choiceKey}`);
    return true;
  }

  async function handleMergeBranch(branchId: string): Promise<boolean> {
    const data = await runPending(`merge:${branchId}`, () =>
      apiPost(`/api/branches/${encodeURIComponent(branchId)}/merge`, {})
    );
    if (!data) return false;
    showToast('Merged branch to main');
    return true;
  }

  async function handleCaptureNeed(ask: string): Promise<boolean> {
    const data = await runPending('capture-need', () => apiPost('/api/needs/capture', { ask }));
    if (!data) return false;
    showToast('Added to Needs you');
    return true;
  }

  async function handleResolveNeed(needId: string, note: string): Promise<boolean> {
    const data = await runPending(`need:${needId}`, () =>
      apiPost(`/api/needs/${encodeURIComponent(needId)}/resolve`, { note })
    );
    if (!data) return false;
    showToast(note);
    return true;
  }

  async function handleToggleBotLane(botId: string, laneId: string): Promise<boolean> {
    const data = await runPending(`bot-lane:${botId}:${laneId}`, () =>
      apiPost(`/api/bots/${encodeURIComponent(botId)}/lanes`, { laneId })
    );
    return Boolean(data);
  }

  async function handleBotSuggestion(botId: string, sugId: string, action: 'start' | 'dismiss'): Promise<boolean> {
    const data = await runPending(`bot-sug:${sugId}`, () =>
      apiPost(`/api/bots/${encodeURIComponent(botId)}/suggestions/${encodeURIComponent(sugId)}`, {
        action,
      })
    );
    if (!data) return false;
    if (action === 'start' && data.branch) {
      setActiveLaneId(data.branch.laneId);
      handleSelectBranch(data.branch.id);
      setPlace('lanes');
      showToast(`Started ${data.branch.title}`);
    } else {
      showToast('Dismissed suggestion');
    }
    return true;
  }

  async function handleCreateJob(payload: {
    name: string;
    laneId: string;
    cadence: string;
    prompt: string;
    onlyReportChanges: boolean;
  }): Promise<boolean> {
    const data = await runPending('create-job', () => apiPost('/api/jobs', payload));
    if (!data) return false;
    showToast(`Scheduled ${payload.name}`);
    return true;
  }

  async function handleJobAction(jobId: string, action: 'toggle' | 'run'): Promise<boolean> {
    const data = await runPending(`job:${jobId}:${action}`, () =>
      apiPost(`/api/jobs/${encodeURIComponent(jobId)}`, { action })
    );
    if (!data) return false;
    showToast(action === 'run' ? 'Ran job now' : 'Updated job schedule');
    return true;
  }

  async function handleAddFile(payload: {
    name: string;
    laneId: string;
    kind: LibraryItem['kind'];
    preview: string;
  }): Promise<boolean> {
    const data = await runPending('add-file', () => apiPost('/api/library', payload));
    if (!data) return false;
    showToast(`Saved ${payload.name}`);
    return true;
  }

  async function handleAddMemory(laneId: string, text: string): Promise<boolean> {
    const data = await runPending('add-memory', () => apiPost('/api/memory', { laneId, text }));
    if (!data) return false;
    showToast('Saved memory note');
    return true;
  }

  async function handleUpdateMemory(noteId: string, status: 'approved' | 'dismissed'): Promise<boolean> {
    const data = await runPending(`memory:${noteId}`, () =>
      apiPost(`/api/memory/${encodeURIComponent(noteId)}`, { status }, 'PATCH')
    );
    if (!data) return false;
    showToast(status === 'approved' ? 'Approved memory note' : 'Dismissed note');
    return true;
  }

  function openLane(laneId: string, branchId?: string) {
    setActiveLaneId(laneId);
    handleSelectBranch(branchId ?? null);
    setPlace('lanes');
  }

  const contextLabel =
    place === 'lanes' && activeLane
      ? activeLane.name
      : place === 'media'
        ? 'Media & Voice'
        : place === 'spatial'
          ? '3D Studio'
          : place === 'studio'
            ? 'Design Studio'
            : place.charAt(0).toUpperCase() + place.slice(1);

  const orderedLanes = useMemo(
    () => applyIdOrder(workspace?.lanes ?? [], workspaceLayout.laneOrder),
    [workspace?.lanes, workspaceLayout.laneOrder]
  );

  const orderedBots = useMemo(
    () => applyIdOrder(workspace?.bots ?? [], workspaceLayout.botOrder),
    [workspace?.bots, workspaceLayout.botOrder]
  );

  const handleReorderLanes = useCallback(
    (fromId: string, toId: string) => {
      const currentIds = orderedLanes.map((l) => l.id);
      const nextOrder = reorderIds(currentIds, fromId, toId);
      setWorkspaceLayout((curr) => ({ ...curr, laneOrder: nextOrder }));
    },
    [orderedLanes]
  );

  const handleMoveLaneStep = useCallback(
    (laneId: string, delta: -1 | 1) => {
      const currentIds = orderedLanes.map((l) => l.id);
      const nextOrder = moveIdByStep(currentIds, laneId, delta);
      setWorkspaceLayout((curr) => ({ ...curr, laneOrder: nextOrder }));
    },
    [orderedLanes]
  );

  const handleReorderBots = useCallback(
    (fromId: string, toId: string) => {
      const currentIds = orderedBots.map((b) => b.id);
      const nextOrder = reorderIds(currentIds, fromId, toId);
      setWorkspaceLayout((curr) => ({ ...curr, botOrder: nextOrder }));
    },
    [orderedBots]
  );

  const handleMoveBotStep = useCallback(
    (botId: string, delta: -1 | 1) => {
      const currentIds = orderedBots.map((b) => b.id);
      const nextOrder = moveIdByStep(currentIds, botId, delta);
      setWorkspaceLayout((curr) => ({ ...curr, botOrder: nextOrder }));
    },
    [orderedBots]
  );

  return (
    <div
      className="relative isolate flex h-screen w-screen overflow-hidden"
      style={{ backgroundColor: 'var(--l-bg)', color: 'var(--l-text)' }}
    >
      {/* Surface atmosphere shader background (strictly behind UI, only visible in empty space) */}
      <div className="lanes-shader-layer" aria-hidden="true" />
      {isLiveShader(appearance.shader) && (
        <ShaderCanvas shader={appearance.shader} className="lanes-shader-canvas" />
      )}

      <RailSidebar
        place={place}
        activeLaneId={activeLane?.id ?? null}
        activeBotId={activeBotId}
        lanes={orderedLanes}
        branches={workspace?.branches ?? []}
        bots={orderedBots}
        needs={workspace?.needs ?? []}
        pendingMemoryCount={pendingMemoryCount}
        theme={appearance.theme}
        pinnedRailPlaces={appearance.pinnedRailPlaces}
        panelPinned={panelPinned}
        mobileOpen={mobileOpen}
        onTogglePin={() => setPanelPinned((v) => !v)}
        onOpenMobile={() => setMobileOpen(true)}
        onCloseMobile={() => setMobileOpen(false)}
        onSelectPlace={(next) => {
          setPlace(next);
          if (next === 'lanes' && !activeLaneId && orderedLanes[0]) {
            setActiveLaneId(orderedLanes[0].id);
          }
        }}
        onSelectLane={(id) => openLane(id)}
        onSelectBot={(id) => {
          setActiveBotId(id);
          setPlace('bots');
        }}
        onOpenQuickAsk={() => setQuickAskOpen(true)}
        onOpenNewLane={() => setNewLaneOpen(true)}
        onOpenCustomizeRail={() => {
          setStudioTab('appearance');
          setPlace('studio');
        }}
        onToggleLightDark={() =>
          setAppearance((curr) => ({ ...curr, theme: toggleThemeMode(curr.theme) }))
        }
        onReorderLanes={handleReorderLanes}
        onMoveLaneStep={handleMoveLaneStep}
        onReorderBots={handleReorderBots}
        onMoveBotStep={handleMoveBotStep}
      />

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top header */}
        <div
          className="flex h-12 shrink-0 items-center justify-between border-b px-3 md:hidden"
          style={{ backgroundColor: 'var(--l-rail)', borderColor: 'var(--l-line)' }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-text)' }}
          >
            <Menu size={18} />
          </button>
          <span className="text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
            Lanes
          </span>
          <button
            type="button"
            onClick={() => setQuickAskOpen(true)}
            aria-label="Open Quick ask"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-text)' }}
          >
            <Search size={17} />
          </button>
        </div>

        {/* Breadcrumb navigation bar */}
        <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />

        {/* Main view */}
        <main
          className={
            place === 'spatial'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0'
              : 'flex min-h-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0'
          }
        >
          {error && (
            <div className="mx-auto w-full max-w-[860px] p-4">
              <ErrorNote message={error} onRetry={() => void fetchWorkspace()} />
            </div>
          )}

          {loading || !workspace ? (
            <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: 'var(--l-muted)' }}>
              Loading Lanes workspace…
            </div>
          ) : (
            <>
              {place === 'home' && (
                <HomeView
                  lanes={orderedLanes}
                  branches={workspace.branches}
                  needs={workspace.needs}
                  services={workspace.services}
                  routing={sending}
                  onRouteMessage={handleHomeRoute}
                  onOpenLane={openLane}
                  onOpenNeeds={() => setPlace('needs')}
                  onOpenNewLane={() => setNewLaneOpen(true)}
                  onOpenSettings={() => setPlace('settings')}
                />
              )}

              {place === 'lanes' && (
                <LaneView
                  lane={activeLane}
                  branches={workspace.branches}
                  activeBranchId={activeBranchId}
                  sending={sending}
                  isActionPending={isActionPending}
                  terminalSettings={terminalSettings}
                  appIsDark={appIsDark}
                  terminalDock={workspaceLayout.terminalDock}
                  workerDock={workspaceLayout.workerDock}
                  onChangeTerminalDock={(dock) =>
                    setWorkspaceLayout((curr) => ({ ...curr, terminalDock: dock }))
                  }
                  onChangeWorkerDock={(dock) =>
                    setWorkspaceLayout((curr) => ({ ...curr, workerDock: dock }))
                  }
                  onChangeTerminalSettings={setTerminalSettings}
                  onOpenTerminalStudio={() => {
                    setStudioTab('terminal');
                    setPlace('studio');
                  }}
                  onSelectBranch={handleSelectBranch}
                  onSendMessage={handleSendLaneOrAssistant}
                  onCreateBranch={handleCreateBranch}
                  onSendBranchMessage={handleSendBranchMessage}
                  onResolveApproval={handleResolveApproval}
                  onResolveDecision={handleResolveDecision}
                  onMergeBranch={handleMergeBranch}
                  onUpdateLane={handleUpdateLane}
                  onNotify={showToast}
                />
              )}

              {place === 'assistant' && (
                <LaneView
                  lane={null}
                  isAssistant
                  assistantMessages={workspace.assistantMessages}
                  branches={[]}
                  activeBranchId={null}
                  sending={sending}
                  isActionPending={isActionPending}
                  terminalSettings={terminalSettings}
                  appIsDark={appIsDark}
                  terminalDock={workspaceLayout.terminalDock}
                  workerDock={workspaceLayout.workerDock}
                  onChangeTerminalDock={(dock) =>
                    setWorkspaceLayout((curr) => ({ ...curr, terminalDock: dock }))
                  }
                  onChangeWorkerDock={(dock) =>
                    setWorkspaceLayout((curr) => ({ ...curr, workerDock: dock }))
                  }
                  onChangeTerminalSettings={setTerminalSettings}
                  onOpenTerminalStudio={() => {
                    setStudioTab('terminal');
                    setPlace('studio');
                  }}
                  onSelectBranch={() => undefined}
                  onSendMessage={handleSendLaneOrAssistant}
                  onCreateBranch={async () => false}
                  onSendBranchMessage={async () => false}
                  onResolveApproval={handleResolveApproval}
                  onResolveDecision={handleResolveDecision}
                  onMergeBranch={handleMergeBranch}
                  onUpdateLane={handleUpdateLane}
                  onOpenVoice={() => {
                    setMediaTab('voice');
                    setPlace('media');
                  }}
                  onNotify={showToast}
                />
              )}

              {place === 'needs' && (
                <NeedsYouView
                  needs={workspace.needs}
                  isActionPending={isActionPending}
                  onCapture={handleCaptureNeed}
                  onResolveApproval={handleResolveApproval}
                  onResolveDecision={handleResolveDecision}
                  onResolveNeed={handleResolveNeed}
                  onOpenLane={openLane}
                />
              )}

              {place === 'bots' && (
                <BotsView
                  bots={orderedBots}
                  activeBotId={activeBotId}
                  lanes={orderedLanes}
                  branches={workspace.branches}
                  isActionPending={isActionPending}
                  onSelectBot={setActiveBotId}
                  onToggleBotLane={handleToggleBotLane}
                  onHandleSuggestion={handleBotSuggestion}
                  onOpenLane={openLane}
                />
              )}

              {place === 'scheduled' && (
                <ScheduledView
                  jobs={workspace.jobs}
                  lanes={workspace.lanes}
                  isActionPending={isActionPending}
                  onCreateJob={handleCreateJob}
                  onJobAction={handleJobAction}
                />
              )}

              {place === 'library' && (
                <LibraryView
                  items={workspace.library}
                  lanes={workspace.lanes}
                  isActionPending={isActionPending}
                  onAddFile={handleAddFile}
                />
              )}

              {place === 'memory' && (
                <MemoryView
                  notes={workspace.memory}
                  lanes={workspace.lanes}
                  isActionPending={isActionPending}
                  onAddNote={handleAddMemory}
                  onUpdateStatus={handleUpdateMemory}
                />
              )}

              {place === 'media' && (
                <MediaStudioView
                  activeTab={mediaTab}
                  lanes={workspace.lanes}
                  onSelectTab={setMediaTab}
                  onSaveToLibrary={handleAddFile}
                  onSendTranscriptToAssistant={async (text) => {
                    setPlace('assistant');
                    await handleSendLaneOrAssistant({
                      text,
                      mode: 'Ask',
                      agentId: 'gemini',
                      modelId: 'gemini-4-hydrogen',
                      useSearch: false,
                      output: 'Reply here',
                      approvalMode: 'Safe-auto',
                    });
                  }}
                  onNotify={showToast}
                />
              )}

              {place === 'spatial' && (
                <SpatialSceneView
                  lanes={workspace.lanes}
                  branches={workspace.branches}
                  theme={appearance.theme}
                  shader={appearance.shader}
                  onOpenLane={(laneId) => openLane(laneId)}
                />
              )}

              {place === 'studio' && (
                <DesignStudioView
                  appearance={appearance}
                  terminalSettings={terminalSettings}
                  appIsDark={appIsDark}
                  activeTab={studioTab}
                  onTabChange={setStudioTab}
                  onChangeAppearance={setAppearance}
                  onResetAppearance={() =>
                    setAppearance({
                      ...DEFAULT_APPEARANCE,
                      pinnedRailPlaces: [...DEFAULT_APPEARANCE.pinnedRailPlaces],
                    })
                  }
                  onChangeTerminalSettings={setTerminalSettings}
                  onResetTerminalSettings={() =>
                    setTerminalSettings({ ...DEFAULT_TERMINAL_SETTINGS, customOverrides: {} })
                  }
                  onNotify={showToast}
                />
              )}

              {place === 'settings' && (
                <SettingsView
                  appearance={appearance}
                  services={workspace.services}
                  onOpenDesignStudio={() => {
                    setStudioTab('appearance');
                    setPlace('studio');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Toast */}
      <QuickAskModal
        open={quickAskOpen}
        contextLabel={contextLabel}
        onClose={() => setQuickAskOpen(false)}
      />

      <NewLaneModal
        open={newLaneOpen}
        existingLanes={workspace?.lanes ?? []}
        submitting={isActionPending('create-lane')}
        onClose={() => setNewLaneOpen(false)}
        onCreate={handleCreateLane}
      />

      {toast && (
        <div
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          className="lanes-toast-in fixed bottom-16 right-4 z-50 flex max-w-[360px] items-center gap-2.5 rounded-[10px] border px-3.5 py-2 text-[13px] font-medium md:bottom-4"
          style={{
            backgroundColor: toast.tone === 'error' ? 'var(--l-bad-soft)' : 'var(--l-raised)',
            borderColor: toast.tone === 'error' ? 'var(--l-bad)' : 'var(--l-line-strong)',
            color: 'var(--l-text)',
            boxShadow: 'var(--l-shadow-menu)',
          }}
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
