import type {
  AgentDef,
  AgentId,
  Bot,
  Branch,
  BreadcrumbItem,
  GeminiModelDef,
  GeminiModelId,
  KitCatalogItem,
  Lane,
  LibraryItem,
  MediaStudioTab,
  NeedsItem,
  PlaceId,
  ServiceItem,
  StudioTab,
  ThemeId,
  TokenEntry,
} from './types';

export const GEMINI_CHAT_MODELS: GeminiModelDef[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    shortLabel: '4 Hydrogen',
    tier: 'General',
    description: 'Fast everyday chat and Google Search grounding',
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    shortLabel: '4 Neon',
    tier: 'Complex',
    description: 'Complex interactive tasks, coding, and synthesis',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    shortLabel: '4 Carbon',
    tier: 'Deep reasoning',
    description: 'Deep reasoning for architecture and root-cause analysis',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    shortLabel: '3.1 Flash Lite',
    tier: 'Fast',
    description: 'Low-latency quick drafts and concise answers',
  },
];

export function getGeminiModel(id?: string): GeminiModelDef {
  return GEMINI_CHAT_MODELS.find((m) => m.id === id) ?? GEMINI_CHAT_MODELS[0];
}

export function isValidGeminiModel(id: unknown): id is GeminiModelId {
  return typeof id === 'string' && GEMINI_CHAT_MODELS.some((m) => m.id === id);
}

export const AGENTS: AgentDef[] = [
  { id: 'gemini', label: 'Gemini', modelName: 'Gemini 4 Hydrogen', effort: 'medium', localOnly: false },
  { id: 'claude', label: 'Claude', modelName: 'Opus', effort: 'high', localOnly: false },
  { id: 'codex', label: 'Codex', modelName: 'Codex', effort: 'medium', localOnly: false },
  { id: 'antigravity', label: 'Antigravity', modelName: 'Antigravity', effort: 'high', localOnly: false },
  { id: 'qwen', label: 'Qwen', modelName: 'Qwen 30B (local)', effort: 'medium', localOnly: true },
];

export const THEME_OPTIONS: { id: ThemeId; label: string; family: string; isDark: boolean }[] = [
  { id: 'midcentury-light', label: 'Midcentury · Light', family: 'Midcentury Modern', isDark: false },
  { id: 'midcentury-dark', label: 'Midcentury · Dark', family: 'Midcentury Modern', isDark: true },
  { id: 'xp-light', label: 'Windows XP · Luna', family: 'Windows XP', isDark: false },
  { id: 'xp-dark', label: 'Windows XP · Royale', family: 'Windows XP', isDark: true },
  { id: 'win98-light', label: 'Windows 98 · Classic', family: 'Windows 98', isDark: false },
  { id: 'win98-dark', label: 'Windows 98 · Dark', family: 'Windows 98', isDark: true },
  { id: 'terminal-dark', label: 'Terminal · Phosphor', family: 'Terminal', isDark: true },
  { id: 'terminal-light', label: 'Terminal · Paper', family: 'Terminal', isDark: false },
  { id: 'calm-light', label: 'Calm · light', family: 'Calm', isDark: false },
  { id: 'calm-dark', label: 'Calm · dark', family: 'Calm', isDark: true },
  { id: 'light', label: 'Warm paper · light', family: 'Warm paper', isDark: false },
  { id: 'dark', label: 'Warm paper · dark', family: 'Warm paper', isDark: true },
  { id: 'midnight-light', label: 'Midnight glow · light', family: 'Midnight glow', isDark: false },
  { id: 'midnight-dark', label: 'Midnight glow · dark', family: 'Midnight glow', isDark: true },
  { id: 'contrast-light', label: 'High contrast · light', family: 'High contrast', isDark: false },
  { id: 'contrast-dark', label: 'High contrast · dark', family: 'High contrast', isDark: true },
];

export function getAgent(id: AgentId): AgentDef {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0];
}

export function getThemePair(themeId: ThemeId): {
  light: ThemeId;
  dark: ThemeId;
  family: string;
  isDark: boolean;
} {
  switch (themeId) {
    case 'xp-light':
    case 'xp-dark':
      return {
        light: 'xp-light',
        dark: 'xp-dark',
        family: 'Windows XP',
        isDark: themeId === 'xp-dark',
      };
    case 'win98-light':
    case 'win98-dark':
      return {
        light: 'win98-light',
        dark: 'win98-dark',
        family: 'Windows 98',
        isDark: themeId === 'win98-dark',
      };
    case 'terminal-light':
    case 'terminal-dark':
      return {
        light: 'terminal-light',
        dark: 'terminal-dark',
        family: 'Terminal',
        isDark: themeId === 'terminal-dark',
      };
    case 'calm-light':
    case 'calm-dark':
      return {
        light: 'calm-light',
        dark: 'calm-dark',
        family: 'Calm',
        isDark: themeId === 'calm-dark',
      };
    case 'light':
    case 'dark':
      return { light: 'light', dark: 'dark', family: 'Warm paper', isDark: themeId === 'dark' };
    case 'midnight-light':
    case 'midnight-dark':
      return {
        light: 'midnight-light',
        dark: 'midnight-dark',
        family: 'Midnight glow',
        isDark: themeId === 'midnight-dark',
      };
    case 'contrast-light':
    case 'contrast-dark':
      return {
        light: 'contrast-light',
        dark: 'contrast-dark',
        family: 'High contrast',
        isDark: themeId === 'contrast-dark',
      };
    case 'midcentury-light':
    case 'midcentury-dark':
    default:
      return {
        light: 'midcentury-light',
        dark: 'midcentury-dark',
        family: 'Midcentury Modern',
        isDark: themeId === 'midcentury-dark',
      };
  }
}

export function toggleThemeMode(themeId: ThemeId): ThemeId {
  const pair = getThemePair(themeId);
  return pair.isDark ? pair.light : pair.dark;
}

/**
 * Enforces Lanes' privacy rule in code: a Local-only (private) lane can only run local models.
 */
export function enforceLaneAgent(lane: Pick<Lane, 'isPrivate'>, requested: AgentId): {
  agentId: AgentId;
  enforcedLocal: boolean;
} {
  if (!lane.isPrivate) {
    return { agentId: requested, enforcedLocal: false };
  }
  const def = getAgent(requested);
  if (def.localOnly) {
    return { agentId: requested, enforcedLocal: false };
  }
  return { agentId: 'qwen', enforcedLocal: true };
}

/**
 * Routes a Home box message:
 * 1. Explicit `@lane-slug` or `@LaneName` prefix routes straight to that lane.
 * 2. Otherwise matches lane name/purpose keywords (skipping private lanes for automatic cloud routing).
 * 3. Falls back to Assistant with a plain reason.
 */
export function routeHomeInput(
  rawInput: string,
  lanes: Lane[]
): { target: 'lane' | 'assistant'; laneId?: string; cleanedText: string; reason: string } {
  const trimmed = rawInput.trim();
  const mentionMatch = /^@([a-zA-Z0-9_-]+)\s+([\s\S]+)$/.exec(trimmed);
  if (mentionMatch) {
    const slug = mentionMatch[1].toLowerCase();
    const rest = mentionMatch[2].trim();
    const exact = lanes.find(
      (l) =>
        l.id.toLowerCase() === slug ||
        l.name.toLowerCase().replace(/\s+/g, '-') === slug ||
        l.name.toLowerCase().startsWith(slug)
    );
    if (exact) {
      return {
        target: 'lane',
        laneId: exact.id,
        cleanedText: rest,
        reason: `Routed directly via @${mentionMatch[1]}`,
      };
    }
  }

  const STOP_WORDS = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'this',
    'that',
    'into',
    'about',
    'your',
    'review',
    'check',
    'update',
    'please',
  ]);
  const words = trimmed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  let bestLane: Lane | null = null;
  let bestScore = 0;

  for (const lane of lanes) {
    if (lane.isPrivate) continue;
    const laneTokens = new Set(
      `${lane.name} ${lane.purpose}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    );
    let score = 0;
    for (const w of words) {
      if (laneTokens.has(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  if (bestLane && bestScore > 0) {
    return {
      target: 'lane',
      laneId: bestLane.id,
      cleanedText: trimmed,
      reason: `Matched ${bestLane.name} from lane purpose`,
    };
  }

  return {
    target: 'assistant',
    cleanedText: trimmed,
    reason: 'No specific lane matched; sent to Assistant',
  };
}

export function computeNeedsCount(needs: NeedsItem[]): number {
  return needs.filter((n) => !n.resolved).length;
}

export function computeLaneStatus(laneId: string, branches: Branch[]): 'needs' | 'working' | 'idle' {
  const laneBranches = branches.filter((b) => b.laneId === laneId && !b.merged);
  if (laneBranches.some((b) => b.status === 'needs')) return 'needs';
  if (laneBranches.some((b) => b.status === 'working')) return 'working';
  return 'idle';
}

export function isKitItemInLanes(item: KitCatalogItem): boolean {
  return (
    (item.lanes_files?.length ?? 0) > 0 ||
    (item.lanes_users?.length ?? 0) > 0 ||
    (item.lanes_parts_from_it?.length ?? 0) > 0
  );
}

export function filterKitCatalog(
  items: KitCatalogItem[],
  query: string,
  group: string,
  portedOnly: boolean
): KitCatalogItem[] {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  return items.filter((item) => {
    if (portedOnly && !isKitItemInLanes(item)) return false;
    if (group !== 'all' && item.group !== group) return false;
    if (!q) return true;
    if (String(item.id) === q) return true;
    const haystack = [
      `#${item.id}`,
      item.name,
      item.group,
      item.kit_section,
      item.route,
      item.good_for,
      item.fits_lanes,
      item.kit_page_file,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function filterLibraryItems(
  items: LibraryItem[],
  query: string,
  laneFilter: string,
  kindFilter: string
): LibraryItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    // Private lane files stay out of the shared Library view (README.md)
    if (item.isPrivateLane) return false;
    if (laneFilter !== 'all' && item.laneId !== laneFilter) return false;
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    if (!q) return true;
    return `${item.name} ${item.laneName} ${item.origin} ${item.preview}`.toLowerCase().includes(q);
  });
}

export function categorizeToken(name: string): string {
  if (['l-rail', 'l-list', 'l-bg', 'l-raised', 'l-panel', 'l-paper', 'l-terminal', 'l-terminal-text', 'l-glow'].includes(name)) {
    return 'Layers';
  }
  if (name.startsWith('l-type-')) return 'Lanes';
  if (name.startsWith('l-agent-')) return 'Agents';
  if (
    name.startsWith('l-accent') ||
    name.startsWith('l-on-') ||
    name.startsWith('l-needs') ||
    name.startsWith('l-ok') ||
    name.startsWith('l-bad') ||
    name.startsWith('l-news') ||
    name === 'l-focus'
  ) {
    return 'Accent & Status';
  }
  return 'Text & Lines';
}

export function filterTokens(tokens: TokenEntry[], query: string, category: string): TokenEntry[] {
  const q = query.trim().toLowerCase();
  return tokens.filter((t) => {
    if (category !== 'All' && categorizeToken(t.name) !== category) return false;
    if (!q) return true;
    return `${t.name} ${t.usage}`.toLowerCase().includes(q);
  });
}

const PLACE_LABELS: Record<PlaceId, string> = {
  home: 'Home',
  assistant: 'Assistant',
  lanes: 'Lanes',
  bots: 'Bots',
  needs: 'Needs you',
  scheduled: 'Scheduled',
  library: 'Library',
  memory: 'Memory',
  media: 'Media & Voice',
  spatial: '3D Studio',
  studio: 'Design Studio',
  settings: 'Settings',
};

const MEDIA_TAB_LABELS: Record<MediaStudioTab, string> = {
  images: 'Images',
  video: 'Animate Video',
  music: 'Music',
  voice: 'Live Voice',
  transcribe: 'Transcribe Audio',
};

/** Design Studio tabs, in display order. The view and the address both use this list. */
export const STUDIO_TABS: readonly StudioTab[] = ['appearance', 'terminal', 'tokens'];

const STUDIO_TAB_LABELS: Record<StudioTab, string> = {
  appearance: 'Appearance',
  terminal: 'Terminal',
  tokens: 'Tokens',
};

/**
 * Pure breadcrumb path builder tracking user location across Home, Lanes, Branches, Bots,
 * Media & Voice tabs, Design Studio sections, and operational views.
 */
export function buildBreadcrumbs(params: {
  place: PlaceId;
  activeLane?: Pick<Lane, 'id' | 'name' | 'color'> | null;
  activeBranch?: Pick<Branch, 'id' | 'title' | 'laneId'> | null;
  activeBot?: Pick<Bot, 'id' | 'name'> | null;
  mediaTab?: MediaStudioTab;
  studioTab?: StudioTab;
}): BreadcrumbItem[] {
  const { place, activeLane, activeBranch, activeBot, mediaTab, studioTab } = params;

  if (place === 'home') {
    return [{ id: 'home', label: 'Home', target: { kind: 'home' }, current: true }];
  }

  const items: BreadcrumbItem[] = [
    { id: 'home', label: 'Home', target: { kind: 'home' }, current: false },
  ];

  if (place === 'lanes') {
    if (activeLane) {
      const hasBranch = Boolean(activeBranch && activeBranch.laneId === activeLane.id);
      items.push({
        id: `lane-${activeLane.id}`,
        label: activeLane.name,
        target: { kind: 'lane', laneId: activeLane.id },
        laneColor: activeLane.color,
        current: !hasBranch,
      });
      if (hasBranch && activeBranch) {
        items.push({
          id: `branch-${activeBranch.id}`,
          label: activeBranch.title,
          target: { kind: 'branch', laneId: activeLane.id, branchId: activeBranch.id },
          current: true,
        });
      }
    } else {
      items.push({
        id: 'place-lanes',
        label: 'Lanes',
        target: { kind: 'place', place: 'lanes' },
        current: true,
      });
    }
    return items;
  }

  if (place === 'bots') {
    items.push({
      id: 'place-bots',
      label: 'Bots',
      target: { kind: 'place', place: 'bots' },
      current: !activeBot,
    });
    if (activeBot) {
      items.push({
        id: `bot-${activeBot.id}`,
        label: activeBot.name,
        target: { kind: 'bot', botId: activeBot.id },
        current: true,
      });
    }
    return items;
  }

  if (place === 'media') {
    const tabLabel = mediaTab ? MEDIA_TAB_LABELS[mediaTab] : undefined;
    items.push({
      id: 'place-media',
      label: PLACE_LABELS.media,
      target: { kind: 'place', place: 'media' },
      current: !tabLabel,
    });
    if (mediaTab && tabLabel) {
      items.push({
        id: `media-${mediaTab}`,
        label: tabLabel,
        target: { kind: 'media-tab', tab: mediaTab },
        current: true,
      });
    }
    return items;
  }

  if (place === 'studio') {
    const tabLabel = studioTab ? STUDIO_TAB_LABELS[studioTab] : undefined;
    items.push({
      id: 'place-studio',
      label: PLACE_LABELS.studio,
      target: { kind: 'place', place: 'studio' },
      current: !tabLabel,
    });
    if (studioTab && tabLabel) {
      items.push({
        id: `studio-${studioTab}`,
        label: tabLabel,
        target: { kind: 'studio-tab', tab: studioTab },
        current: true,
      });
    }
    return items;
  }

  items.push({
    id: `place-${place}`,
    label: PLACE_LABELS[place],
    target: { kind: 'place', place },
    current: true,
  });

  return items;
}

const PLACE_IDS = Object.keys(PLACE_LABELS) as PlaceId[];
const MEDIA_TAB_IDS = Object.keys(MEDIA_TAB_LABELS) as MediaStudioTab[];

/** Which view is open, as stored in the page address so a reload or a shared link lands there. */
export interface ViewRoute {
  place: PlaceId;
  laneId?: string;
  branchId?: string;
  botId?: string;
  mediaTab?: MediaStudioTab;
  studioTab?: StudioTab;
}

export function formatViewHash(route: ViewRoute): string {
  const parts: string[] = [route.place];
  if (route.place === 'lanes' && route.laneId) {
    parts.push(route.laneId);
    if (route.branchId) parts.push(route.branchId);
  } else if (route.place === 'bots' && route.botId) {
    parts.push(route.botId);
  } else if (route.place === 'media' && route.mediaTab) {
    parts.push(route.mediaTab);
  } else if (route.place === 'studio' && route.studioTab) {
    parts.push(route.studioTab);
  }
  return '#/' + parts.map(encodeURIComponent).join('/');
}

/** Reads a `#/place/...` address. Returns null when it names no known place. */
export function parseViewHash(hash: string): ViewRoute | null {
  const [place, a, b] = hash.replace(/^#\/?/, '').split('/').map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (!PLACE_IDS.includes(place as PlaceId)) return null;
  const route: ViewRoute = { place: place as PlaceId };
  if (route.place === 'lanes' && a) {
    route.laneId = a;
    if (b) route.branchId = b;
  } else if (route.place === 'bots' && a) {
    route.botId = a;
  } else if (route.place === 'media' && MEDIA_TAB_IDS.includes(a as MediaStudioTab)) {
    route.mediaTab = a as MediaStudioTab;
  } else if (route.place === 'studio' && STUDIO_TABS.includes(a as StudioTab)) {
    route.studioTab = a as StudioTab;
  }
  return route;
}

/** Browser storage holding each worker's last-picked reply model: { [branchId]: modelId }. */
export const WORKER_MODEL_STORAGE_KEY = 'lanes.workerModels.v1';

type ModelStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null when the browser blocks it (privacy settings, sandboxing). */
export function getBrowserStorage(): ModelStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Session copy of every pick, used when browser storage is blocked or full.
const sessionWorkerModels: Record<string, GeminiModelId> = {};

/** The saved picks, or null when storage can't be used at all (blocked). Bad data reads as empty. */
function readWorkerModelMap(storage: ModelStorage | null): Record<string, unknown> | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(WORKER_MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeWorkerModelMap(map: Record<string, unknown>, storage: ModelStorage | null): void {
  try {
    storage?.setItem(WORKER_MODEL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or blocked: sessionWorkerModels still holds the pick until the page reloads.
  }
}

/** The worker's saved model, or the default when none is saved or it is no longer offered. */
export function readWorkerModel(branchId: string, storage: ModelStorage | null): GeminiModelId {
  const map = readWorkerModelMap(storage);
  const saved = map ? map[branchId] : sessionWorkerModels[branchId];
  return isValidGeminiModel(saved) ? saved : GEMINI_CHAT_MODELS[0].id;
}

export function saveWorkerModel(branchId: string, modelId: GeminiModelId, storage: ModelStorage | null): void {
  sessionWorkerModels[branchId] = modelId;
  const map = readWorkerModelMap(storage);
  if (map) writeWorkerModelMap({ ...map, [branchId]: modelId }, storage);
}

/** Drops saved picks for workers that no longer exist. */
export function pruneWorkerModels(existingBranchIds: string[], storage: ModelStorage | null): void {
  const map = readWorkerModelMap(storage);
  if (!map) return;
  const keep = new Set(existingBranchIds);
  const pruned = Object.fromEntries(Object.entries(map).filter(([id]) => keep.has(id)));
  if (Object.keys(pruned).length !== Object.keys(map).length) writeWorkerModelMap(pruned, storage);
}

/**
 * Checks the ids named by the address against the workspace. Unknown lanes and bots fall back
 * to the first real one; a worker is kept only if it exists in the chosen lane.
 */
export function settleViewIds(
  ids: { laneId: string | null; branchId: string | null; botId: string | null },
  workspace: {
    lanes: { id: string }[];
    branches: { id: string; laneId: string }[];
    bots: { id: string }[];
  }
): { laneId: string | null; branchId: string | null; botId: string | null } {
  const laneId =
    ids.laneId && workspace.lanes.some((l) => l.id === ids.laneId) ? ids.laneId : (workspace.lanes[0]?.id ?? null);
  const branchId =
    ids.branchId && workspace.branches.some((b) => b.id === ids.branchId && b.laneId === laneId) ? ids.branchId : null;
  const botId =
    ids.botId && workspace.bots.some((b) => b.id === ids.botId) ? ids.botId : (workspace.bots[0]?.id ?? null);
  return { laneId, branchId, botId };
}

/**
 * Services for Home's "needs attention" note: every unhealthy service, minus those an open
 * Needs you request shown on Home is already asking about, so one problem isn't shown twice.
 * Pass only open requests (Home's Needs you card never shows resolved ones).
 */
export function servicesForHomeNote<S extends Pick<ServiceItem, 'id' | 'status'>>(
  services: S[],
  shownOpenNeeds: Pick<NeedsItem, 'kind' | 'serviceId'>[]
): S[] {
  const covered = new Set(shownOpenNeeds.filter((n) => n.kind === 'service' && n.serviceId).map((n) => n.serviceId));
  return services.filter((s) => s.status !== 'healthy' && !covered.has(s.id));
}
