import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { LanesStore } from './src/server/store.ts';
import {
  animateImageToVideo,
  attachLiveVoiceSession,
  generateChatReply,
  generateMusicTrack,
  generateOrEditImage,
  transcribeAudioBuffer,
} from './src/server/gemini.ts';
import {
  attachTerminalWebSocket,
  openExternalTerminal,
  readLocalGhosttyConfig,
  readLocalGhosttyShader,
} from './src/server/terminal.ts';
import type { AgentId, ApprovalMode, Lane, LaneColorIndex, LibraryItem } from './src/lib/types.ts';

// Load local .env automatically when running locally on Node 22+ without overwriting existing env vars
try {
  const loadEnvFile = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  loadEnvFile?.();
} catch {
  // .env not present; continue with process.env
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const BLOCKED_ROOT_PATHS = new Set([
  '/package.json',
  '/package-lock.json',
  '/server.ts',
  '/server.test.mjs',
  '/tsconfig.json',
  '/vite.config.ts',
  '/.gitignore',
  '/.env',
  '/.env.local',
  '/.env.example',
]);

let tokensCache: unknown | null = null;

const MIDCENTURY_TOKENS: Record<string, { light: string; dark: string }> = {
  'l-rail': { light: '#EAE1D3', dark: '#160C09' },
  'l-list': { light: '#F3ECE1', dark: '#241916' },
  'l-bg': { light: '#FAF6F0', dark: '#1C110E' },
  'l-raised': { light: '#FFFDF9', dark: '#342724' },
  'l-panel': { light: '#F1EAE0', dark: '#291D1A' },
  'l-text': { light: '#241916', dark: '#F4DED8' },
  'l-muted': { light: '#5E514C', dark: '#DFC0B8' },
  'l-faint': { light: '#7A6C66', dark: '#A68B84' },
  'l-on-accent': { light: '#FFFFFF', dark: '#611300' },
  'l-on-bad': { light: '#FFFFFF', dark: '#690005' },
  'l-line': { light: '#DDD1C3', dark: '#58423C' },
  'l-line-strong': { light: '#8B7B74', dark: '#8B716B' },
  'l-hover': { light: '#E7DDD0', dark: '#342724' },
  'l-selected': { light: '#DFD3C3', dark: '#3F322E' },
  'l-focus': { light: '#942D10', dark: '#FFB4A1' },
  'l-accent': { light: '#942D10', dark: '#FFB4A1' },
  'l-accent-soft': { light: '#FFE4DD', dark: 'rgb(181 68 38 / 28%)' },
  'l-ok': { light: '#3B6633', dark: '#8BC67F' },
  'l-ok-soft': { light: '#E1EAD9', dark: 'rgb(59 102 51 / 28%)' },
  'l-needs': { light: '#855300', dark: '#E8AE48' },
  'l-needs-soft': { light: '#F5E8CE', dark: 'rgb(133 83 0 / 28%)' },
  'l-bad': { light: '#BA1A1A', dark: '#FFB4AB' },
  'l-bad-soft': { light: '#FFDAD6', dark: '#93000A' },
  'l-news': { light: '#005776', dark: '#80D0FB' },
  'l-type-1': { light: '#005776', dark: '#80D0FB' },
  'l-type-1-soft': { light: '#D3EDFF', dark: '#003549' },
  'l-type-2': { light: '#B54426', dark: '#FFB4A1' },
  'l-type-2-soft': { light: '#FFE4DD', dark: 'rgb(181 68 38 / 28%)' },
  'l-type-3': { light: '#3B6633', dark: '#8BC67F' },
  'l-type-3-soft': { light: '#E1EAD9', dark: 'rgb(59 102 51 / 28%)' },
  'l-type-4': { light: '#7E649E', dark: '#CBB3E6' },
  'l-type-4-soft': { light: '#EDE5F7', dark: 'rgb(126 100 158 / 28%)' },
  'l-type-5': { light: '#A84E73', dark: '#E69CB8' },
  'l-type-5-soft': { light: '#F7E1EA', dark: 'rgb(168 78 115 / 28%)' },
  'l-agent-claude': { light: '#B54426', dark: '#FFB4A1' },
  'l-agent-claude-soft': { light: '#FFE4DD', dark: 'rgb(181 68 38 / 28%)' },
  'l-agent-codex': { light: '#005776', dark: '#80D0FB' },
  'l-agent-codex-soft': { light: '#D3EDFF', dark: '#003549' },
  'l-agent-antigravity': { light: '#7E649E', dark: '#CBB3E6' },
  'l-agent-antigravity-soft': { light: '#EDE5F7', dark: 'rgb(126 100 158 / 28%)' },
  'l-agent-qwen': { light: '#A84E73', dark: '#E69CB8' },
  'l-agent-qwen-soft': { light: '#F7E1EA', dark: 'rgb(168 78 115 / 28%)' },
  'l-terminal': { light: '#1C110E', dark: '#160C09' },
  'l-terminal-text': { light: '#F4DED8', dark: '#F4DED8' },
  'l-paper': { light: '#FFFFFF', dark: '#FFFFFF' },
};

async function loadTokens(): Promise<unknown> {
  if (tokensCache) return tokensCache;
  const raw = await fs.readFile(path.join(ROOT_DIR, 'src', 'lib', 'tokens.json'), 'utf8');
  const parsed = JSON.parse(raw) as {
    color?: {
      themes?: { id: string; name: string }[];
      tokens?: { name: string; value: Record<string, string>; usage: string }[];
    };
  };
  if (parsed.color?.themes) {
    parsed.color.themes = [
      { id: 'midcentury-light', name: 'Midcentury Modern · light' },
      { id: 'midcentury-dark', name: 'Midcentury Modern · dark' },
      { id: 'xp-light', name: 'Windows XP · Luna' },
      { id: 'xp-dark', name: 'Windows XP · Royale Dark' },
      { id: 'win98-light', name: 'Windows 98 · Classic' },
      { id: 'win98-dark', name: 'Windows 98 · Classic Dark' },
      { id: 'terminal-dark', name: 'Terminal · Phosphor' },
      { id: 'terminal-light', name: 'Terminal · Paper' },
      ...parsed.color.themes,
    ];
  }
  const EXTRA_THEME_CORE: Record<string, Record<string, string>> = {
    'l-rail': {
      'xp-light': '#D6DFF7',
      'xp-dark': '#14171D',
      'win98-light': '#B4B4B4',
      'win98-dark': '#171A20',
      'terminal-dark': '#050906',
      'terminal-light': '#E2EAE1',
    },
    'l-list': {
      'xp-light': '#E5ECF9',
      'xp-dark': '#1B2029',
      'win98-light': '#C0C0C0',
      'win98-dark': '#20242C',
      'terminal-dark': '#08100A',
      'terminal-light': '#EBF2EA',
    },
    'l-bg': {
      'xp-light': '#ECE9D8',
      'xp-dark': '#1F242E',
      'win98-light': '#D4D0C8',
      'win98-dark': '#1B1F26',
      'terminal-dark': '#0B140E',
      'terminal-light': '#F5F9F4',
    },
    'l-raised': {
      'xp-light': '#FFFFFF',
      'xp-dark': '#2A313E',
      'win98-light': '#F4F2EE',
      'win98-dark': '#2B303B',
      'terminal-dark': '#112016',
      'terminal-light': '#FFFFFF',
    },
    'l-panel': {
      'xp-light': '#F5F3EA',
      'xp-dark': '#242A35',
      'win98-light': '#C0C0C0',
      'win98-dark': '#232832',
      'terminal-dark': '#0E1912',
      'terminal-light': '#E9F1E8',
    },
    'l-text': {
      'xp-light': '#0A182E',
      'xp-dark': '#EFF4FC',
      'win98-light': '#000000',
      'win98-dark': '#F0F0F0',
      'terminal-dark': '#D2FFDD',
      'terminal-light': '#0C2414',
    },
    'l-accent': {
      'xp-light': '#0054E3',
      'xp-dark': '#58A4FF',
      'win98-light': '#000080',
      'win98-dark': '#5CE1E6',
      'terminal-dark': '#33FF66',
      'terminal-light': '#0F6E2E',
    },
  };
  if (parsed.color?.tokens) {
    for (const tok of parsed.color.tokens) {
      if (!tok.value || typeof tok.value !== 'object') continue;
      const mc = MIDCENTURY_TOKENS[tok.name];
      if (mc) {
        tok.value['midcentury-light'] = mc.light;
        tok.value['midcentury-dark'] = mc.dark;
      }
      const extra = EXTRA_THEME_CORE[tok.name];
      if (extra) {
        Object.assign(tok.value, extra);
      }
    }
  }
  tokensCache = parsed;
  return tokensCache;
}

async function generateReply(opts: {
  message: string;
  laneName: string;
  lanePurpose?: string;
  instructions?: string;
  modelId?: string;
  useSearch?: boolean;
  mode?: string;
  isPrivate?: boolean;
  approvedMemory?: string[];
  history?: { role: string; text: string }[];
}) {
  return generateChatReply(opts);
}

function routeMessageToLane(rawInput: string, lanes: Lane[]) {
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
        target: 'lane' as const,
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
      target: 'lane' as const,
      laneId: bestLane.id,
      cleanedText: trimmed,
      reason: `Matched ${bestLane.name} from lane purpose`,
    };
  }

  return {
    target: 'assistant' as const,
    cleanedText: trimmed,
    reason: 'No specific lane matched; sent to Assistant',
  };
}

const VALID_AGENTS = new Set<AgentId>(['claude', 'codex', 'antigravity', 'qwen', 'gemini']);
const VALID_COLORS = new Set<LaneColorIndex>([1, 2, 3, 4, 5]);
const VALID_APPROVAL_MODES = new Set<ApprovalMode>(['Ask', 'Safe-auto', 'Full']);
const VALID_ICONS = new Set<Lane['icon']>(['layers', 'flask', 'pen', 'wallet', 'code', 'compass']);

export async function createApp(
  options: {
    attachFrontend?: boolean;
    isProd?: boolean;
    store?: LanesStore;
    /** Stand-in for the model call, so tests never reach a paid API. */
    replyGenerator?: typeof generateReply;
  } = {}
): Promise<Express> {
  const { attachFrontend = true, isProd = process.env.NODE_ENV === 'production' } = options;
  const store = options.store ?? new LanesStore();
  const replyWith = options.replyGenerator ?? generateReply;
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (BLOCKED_ROOT_PATHS.has(req.path) || req.path.startsWith('/.')) {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // --- Threads & Lanes API ---
  app.get('/api/workspace', (_req: Request, res: Response) => {
    res.json(store.getState());
  });

  app.get('/api/lanes', (_req: Request, res: Response) => {
    res.json({ lanes: store.getState().lanes });
  });

  app.post('/api/lanes', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Lane name is required.' });
      return;
    }
    const color = VALID_COLORS.has(body.color as LaneColorIndex) ? (body.color as LaneColorIndex) : 1;
    const icon = VALID_ICONS.has(body.icon as Lane['icon']) ? (body.icon as Lane['icon']) : 'layers';
    const approvalMode = VALID_APPROVAL_MODES.has(body.approvalMode as ApprovalMode)
      ? (body.approvalMode as ApprovalMode)
      : 'Safe-auto';

    const lane = store.createLane({
      name,
      purpose: typeof body.purpose === 'string' ? body.purpose : '',
      color,
      icon,
      isPrivate: Boolean(body.isPrivate),
      approvalMode,
      defaultAgentId: VALID_AGENTS.has(body.defaultAgentId as AgentId)
        ? (body.defaultAgentId as AgentId)
        : undefined,
      instructions: typeof body.instructions === 'string' ? body.instructions : '',
      enabledPlugins: Array.isArray(body.enabledPlugins) ? (body.enabledPlugins as string[]) : undefined,
    });
    res.status(201).json({ lane, state: store.getState() });
  });

  app.patch('/api/lanes/:id', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<LanesStore['updateLane']>[1] = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.purpose === 'string') patch.purpose = body.purpose;
    if (VALID_COLORS.has(body.color as LaneColorIndex)) patch.color = body.color as LaneColorIndex;
    if (VALID_ICONS.has(body.icon as Lane['icon'])) patch.icon = body.icon as Lane['icon'];
    if (typeof body.isPrivate === 'boolean') patch.isPrivate = body.isPrivate;
    if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    if (typeof body.unread === 'boolean') patch.unread = body.unread;
    if (VALID_APPROVAL_MODES.has(body.approvalMode as ApprovalMode)) {
      patch.approvalMode = body.approvalMode as ApprovalMode;
    }
    if (VALID_AGENTS.has(body.defaultAgentId as AgentId)) {
      patch.defaultAgentId = body.defaultAgentId as AgentId;
    }
    if (typeof body.instructions === 'string') patch.instructions = body.instructions;
    if (Array.isArray(body.enabledPlugins)) patch.enabledPlugins = body.enabledPlugins as string[];

    const updated = store.updateLane(String(req.params.id), patch);
    if (!updated) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.json({ lane: updated, state: store.getState() });
  });

  app.delete('/api/lanes/:id', (req: Request, res: Response) => {
    const ok = store.deleteLane(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.json({ ok: true, state: store.getState() });
  });

  app.post('/api/lanes/:id/plugins', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const pluginId = typeof body?.pluginId === 'string' ? body.pluginId : '';
    if (!pluginId) {
      res.status(400).json({ error: 'Plugin id is required.' });
      return;
    }
    const result = store.toggleLanePlugin(String(req.params.id), pluginId);
    if (result.blockedPrivate) {
      res.status(400).json({ error: 'Cloud plugins cannot be enabled on private local-only lanes.' });
      return;
    }
    if (!result.lane) {
      res.status(404).json({ error: 'Lane or plugin not found.' });
      return;
    }
    res.json({ lane: result.lane, state: store.getState() });
  });

  app.post('/api/lanes/:id/messages', async (req: Request, res: Response) => {
    const laneId = String(req.params.id);
    const lane = store.getState().lanes.find((l) => l.id === laneId);
    if (!lane) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const requestedAgent = VALID_AGENTS.has(body.agentId as AgentId)
      ? (body.agentId as AgentId)
      : lane.defaultAgentId;
    const effectiveAgent: AgentId = lane.isPrivate ? 'qwen' : requestedAgent;
    const mode = typeof body.mode === 'string' ? body.mode : 'Build';
    const output = typeof body.output === 'string' ? body.output : 'Reply here';

    store.appendLaneMessage(lane.id, { role: 'user', text });

    if (output === 'Branch') {
      const title = text.length > 56 ? `${text.slice(0, 53)}…` : text;
      const branch = store.createBranch({
        laneId: lane.id,
        title,
        agentId: effectiveAgent,
        prompt: text,
      });
      store.appendLaneMessage(lane.id, {
        role: 'assistant',
        text: `Started branch "${title}" on ${branch?.gitBranch}. Click the card below to open its workspace beside this thread.`,
        agentId: effectiveAgent,
        modelLabel: lane.isPrivate ? 'Qwen 30B (local)' : effectiveAgent,
        branchId: branch?.id,
      });
      res.status(201).json({ branch, state: store.getState() });
      return;
    }

    const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
    const useSearch = Boolean(body.useSearch) && !lane.isPrivate;

    try {
      const approvedMemory = store
        .getState()
        .memory.filter((m) => m.laneId === lane.id && m.status === 'approved' && (!m.localOnly || lane.isPrivate))
        .map((m) => m.text);

      const { reply, modelLabel, sources } = await replyWith({
        message: text,
        laneName: lane.name,
        lanePurpose: lane.purpose,
        instructions: lane.instructions,
        modelId,
        useSearch,
        mode,
        isPrivate: lane.isPrivate,
        approvedMemory,
        history: lane.messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
      });
      store.appendLaneMessage(lane.id, {
        role: 'assistant',
        text: reply,
        agentId: effectiveAgent,
        modelLabel,
        sources: sources.length > 0 ? sources : undefined,
      });
      res.json({ reply, sources, state: store.getState() });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Model request failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/assistant/messages', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const mode = typeof body.mode === 'string' ? body.mode : 'Ask';
    const agentId = VALID_AGENTS.has(body.agentId as AgentId) ? (body.agentId as AgentId) : 'gemini';
    const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
    const useSearch = Boolean(body.useSearch);

    store.appendAssistantMessage({ role: 'user', text });
    try {
      const { reply, modelLabel, sources } = await replyWith({
        message: text,
        laneName: 'Assistant',
        lanePurpose: 'Cross-lane assistant across all non-private lanes',
        modelId,
        useSearch,
        mode,
        isPrivate: false,
        history: store.getState().assistantMessages.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
      });
      store.appendAssistantMessage({
        role: 'assistant',
        text: reply,
        agentId,
        modelLabel,
        sources: sources.length > 0 ? sources : undefined,
      });
      res.json({ reply, sources, state: store.getState() });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Model request failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/home/route', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const route = routeMessageToLane(text, store.getState().lanes);
    if (route.target === 'lane' && route.laneId) {
      const lane = store.getState().lanes.find((l) => l.id === route.laneId);
      let replyError: string | undefined;
      if (lane) {
        store.appendLaneMessage(lane.id, { role: 'user', text: route.cleanedText });
        try {
          const { reply, modelLabel, sources } = await replyWith({
            message: route.cleanedText,
            laneName: lane.name,
            lanePurpose: lane.purpose,
            instructions: lane.instructions,
            mode: 'Build',
            isPrivate: lane.isPrivate,
          });
          store.appendLaneMessage(lane.id, {
            role: 'assistant',
            text: reply,
            agentId: lane.defaultAgentId,
            modelLabel,
            sources: sources.length > 0 ? sources : undefined,
          });
        } catch (err) {
          replyError = err instanceof Error ? err.message : 'Could not reach Gemini.';
        }
      }
      res.json({ ...route, replyError, state: store.getState() });
      return;
    }

    store.appendAssistantMessage({ role: 'user', text: route.cleanedText });
    let replyError: string | undefined;
    try {
      const { reply, modelLabel, sources } = await replyWith({
        message: route.cleanedText,
        laneName: 'Assistant',
        lanePurpose: 'Cross-lane assistant',
        mode: 'Ask',
      });
      store.appendAssistantMessage({
        role: 'assistant',
        text: reply,
        agentId: 'gemini',
        modelLabel,
        sources: sources.length > 0 ? sources : undefined,
      });
    } catch (err) {
      replyError = err instanceof Error ? err.message : 'Could not reach Gemini.';
    }
    res.json({ ...route, replyError, state: store.getState() });
  });

  app.post('/api/lanes/:id/branches', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : title;
    if (!title) {
      res.status(400).json({ error: 'Branch title is required.' });
      return;
    }
    const agentId = VALID_AGENTS.has(body.agentId as AgentId) ? (body.agentId as AgentId) : 'claude';
    const branch = store.createBranch({
      laneId: String(req.params.id),
      title,
      agentId,
      prompt,
    });
    if (!branch) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.status(201).json({ branch, state: store.getState() });
  });

  app.post('/api/branches/:id/messages', async (req: Request, res: Response) => {
    const branchId = String(req.params.id);
    const branch = store.getState().branches.find((b) => b.id === branchId);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }
    const lane = store.getState().lanes.find((l) => l.id === branch.laneId);
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
    store.appendBranchMessage(branch.id, { role: 'user', text });
    try {
      const { reply, modelLabel } = await replyWith({
        message: text,
        modelId,
        laneName: `${lane?.name ?? 'Lane'} / ${branch.title}`,
        lanePurpose: `Worker branch ${branch.gitBranch}`,
        instructions: lane?.instructions,
        mode: 'Build',
        isPrivate: lane?.isPrivate,
        history: branch.messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
      });
      store.appendBranchMessage(branch.id, {
        role: 'assistant',
        text: reply,
        agentId: branch.agentId,
        modelLabel,
      });
      // Reopen only once the reply succeeded, so a failed call leaves the worker as it was.
      if (body.reopen === true) store.reopenBranch(branch.id);
      res.json({ reply, state: store.getState() });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Model request failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/branches/:id/approval', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const decision = body?.decision === 'approved' || body?.decision === 'declined' ? body.decision : null;
    if (!decision) {
      res.status(400).json({ error: 'Decision must be "approved" or "declined".' });
      return;
    }
    const branch = store.resolveBranchApproval(String(req.params.id), decision);
    if (!branch) {
      res.status(404).json({ error: 'Pending branch approval not found.' });
      return;
    }
    res.json({ branch, state: store.getState() });
  });

  app.post('/api/branches/:id/decision', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const choiceKey = typeof body?.choiceKey === 'string' ? body.choiceKey : '';
    const branch = store.resolveBranchDecision(String(req.params.id), choiceKey);
    if (!branch) {
      res.status(404).json({ error: 'Decision or choice not found.' });
      return;
    }
    res.json({ branch, state: store.getState() });
  });

  app.post('/api/branches/:id/merge', (req: Request, res: Response) => {
    const branch = store.mergeBranch(String(req.params.id));
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }
    res.json({ branch, state: store.getState() });
  });

  app.post('/api/needs/capture', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const ask = typeof body?.ask === 'string' ? body.ask.trim() : '';
    if (!ask) {
      res.status(400).json({ error: 'Capture text is required.' });
      return;
    }
    const item = store.addCaptureNeed(ask);
    res.status(201).json({ item, state: store.getState() });
  });

  app.post('/api/needs/:id/resolve', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const note = typeof body?.note === 'string' ? body.note : 'Done';
    const item = store.resolveNeed(String(req.params.id), note);
    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    res.json({ item, state: store.getState() });
  });

  app.post('/api/bots', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Bot name is required.' });
      return;
    }
    const agentId = VALID_AGENTS.has(body.agentId as AgentId) ? (body.agentId as AgentId) : 'claude';
    const bot = store.createBot({
      name,
      job: typeof body.job === 'string' ? body.job : '',
      agentId,
      instructions: typeof body.instructions === 'string' ? body.instructions : '',
      allowedLaneIds: Array.isArray(body.allowedLaneIds) ? (body.allowedLaneIds as string[]) : [],
      enabledPlugins: Array.isArray(body.enabledPlugins) ? (body.enabledPlugins as string[]) : undefined,
      morningSuggestions: body.morningSuggestions !== false,
    });
    res.status(201).json({ bot, state: store.getState() });
  });

  app.patch('/api/bots/:id', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<LanesStore['updateBot']>[1] = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.job === 'string') patch.job = body.job;
    if (VALID_AGENTS.has(body.agentId as AgentId)) patch.agentId = body.agentId as AgentId;
    if (typeof body.instructions === 'string') patch.instructions = body.instructions;
    if (typeof body.morningSuggestions === 'boolean') patch.morningSuggestions = body.morningSuggestions;
    if (Array.isArray(body.enabledPlugins)) patch.enabledPlugins = body.enabledPlugins as string[];

    const bot = store.updateBot(String(req.params.id), patch);
    if (!bot) {
      res.status(404).json({ error: 'Bot not found.' });
      return;
    }
    res.json({ bot, state: store.getState() });
  });

  app.delete('/api/bots/:id', (req: Request, res: Response) => {
    const ok = store.deleteBot(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Bot not found.' });
      return;
    }
    res.json({ ok: true, state: store.getState() });
  });

  app.post('/api/bots/:id/plugins', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const pluginId = typeof body?.pluginId === 'string' ? body.pluginId : '';
    if (!pluginId) {
      res.status(400).json({ error: 'Plugin id is required.' });
      return;
    }
    const bot = store.toggleBotPlugin(String(req.params.id), pluginId);
    if (!bot) {
      res.status(404).json({ error: 'Bot or plugin not found.' });
      return;
    }
    res.json({ bot, state: store.getState() });
  });

  app.post('/api/bots/:id/lanes', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const laneId = typeof body?.laneId === 'string' ? body.laneId : '';
    const lane = store.getState().lanes.find((l) => l.id === laneId);
    if (lane?.isPrivate) {
      res.status(400).json({ error: 'Private lanes cannot be assigned to bots.' });
      return;
    }
    const bot = store.toggleBotLane(String(req.params.id), laneId);
    if (!bot) {
      res.status(404).json({ error: 'Bot or lane not found.' });
      return;
    }
    res.json({ bot, state: store.getState() });
  });

  app.post('/api/bots/:id/suggestions/:sugId', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const action = body?.action === 'start' || body?.action === 'dismiss' ? body.action : null;
    if (!action) {
      res.status(400).json({ error: 'Action must be "start" or "dismiss".' });
      return;
    }
    const result = store.handleBotSuggestion(String(req.params.id), String(req.params.sugId), action);
    if (!result) {
      res.status(404).json({ error: 'Suggestion not found or lane not permitted for bot.' });
      return;
    }
    res.json({ ...result, state: store.getState() });
  });

  app.post('/api/jobs', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const laneId = typeof body?.laneId === 'string' ? body.laneId : '';
    if (!name || !laneId) {
      res.status(400).json({ error: 'Job name and lane are required.' });
      return;
    }
    const job = store.createJob({
      name,
      laneId,
      cadence: typeof body.cadence === 'string' ? body.cadence : 'Weekdays at 08:00',
      prompt: typeof body.prompt === 'string' ? body.prompt : name,
      onlyReportChanges: Boolean(body.onlyReportChanges),
    });
    if (!job) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.status(201).json({ job, state: store.getState() });
  });

  app.post('/api/jobs/:id', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const action = body?.action === 'toggle' || body?.action === 'run' ? body.action : null;
    if (!action) {
      res.status(400).json({ error: 'Action must be "toggle" or "run".' });
      return;
    }
    const job = store.updateJob(String(req.params.id), action);
    if (!job) {
      res.status(404).json({ error: 'Scheduled job not found.' });
      return;
    }
    res.json({ job, state: store.getState() });
  });

  app.post('/api/library', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const laneId = typeof body?.laneId === 'string' ? body.laneId : '';
    if (!name || !laneId) {
      res.status(400).json({ error: 'File name and lane are required.' });
      return;
    }
    const kind = (['doc', 'code', 'image', 'pdf'] as const).includes(body.kind as LibraryItem['kind'])
      ? (body.kind as LibraryItem['kind'])
      : 'doc';
    const item = store.addLibraryItem({
      name,
      folder: typeof body.folder === 'string' ? body.folder : undefined,
      laneId,
      kind,
      preview: typeof body.preview === 'string' ? body.preview : '',
      size: typeof body.size === 'string' ? body.size : undefined,
    });
    if (!item) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.status(201).json({ item, state: store.getState() });
  });

  app.patch('/api/library/:id', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<LanesStore['updateLibraryItem']>[1] = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.folder === 'string') patch.folder = body.folder;
    if (typeof body.laneId === 'string') patch.laneId = body.laneId;
    if (typeof body.preview === 'string') patch.preview = body.preview;
    if ((['doc', 'code', 'image', 'pdf'] as const).includes(body.kind as LibraryItem['kind'])) {
      patch.kind = body.kind as LibraryItem['kind'];
    }
    const item = store.updateLibraryItem(String(req.params.id), patch);
    if (!item) {
      res.status(404).json({ error: 'File or target lane not found.' });
      return;
    }
    res.json({ item, state: store.getState() });
  });

  app.delete('/api/library/:id', (req: Request, res: Response) => {
    const ok = store.deleteLibraryItem(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.json({ ok: true, state: store.getState() });
  });

  app.post('/api/memory', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const laneId = typeof body?.laneId === 'string' ? body.laneId : '';
    if (!text || !laneId) {
      res.status(400).json({ error: 'Lane and note text are required.' });
      return;
    }
    const note = store.addMemoryNote({ laneId, text });
    if (!note) {
      res.status(404).json({ error: 'Lane not found.' });
      return;
    }
    res.status(201).json({ note, state: store.getState() });
  });

  app.patch('/api/memory/:id', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const status = body?.status === 'approved' || body?.status === 'dismissed' ? body.status : null;
    if (!status) {
      res.status(400).json({ error: 'Status must be "approved" or "dismissed".' });
      return;
    }
    const note = store.updateMemoryNote(String(req.params.id), status);
    if (!note) {
      res.status(404).json({ error: 'Memory note not found.' });
      return;
    }
    res.json({ note, state: store.getState() });
  });

  // --- Quick Ask & Gemini Multi-Modal APIs ---
  app.post('/api/chat', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }
    const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
    const useSearch = Boolean(body.useSearch);
    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (h): h is { role: string; text: string } =>
              Boolean(h && typeof h.role === 'string' && typeof h.text === 'string')
          )
          .slice(-12)
      : undefined;

    try {
      const { reply, modelLabel, sources } = await replyWith({
        message,
        laneName: typeof body.laneName === 'string' ? body.laneName : 'Quick ask',
        lanePurpose: 'Short read-only Q&A about the current Lanes page and design system',
        modelId,
        useSearch,
        mode: 'Ask',
        isPrivate: false,
        history,
      });
      res.json({ reply, modelLabel, sources });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Model request failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/gemini/image', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required to create or edit an image.' });
      return;
    }
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : undefined;
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio.trim() : '1:1';
    const imageSize = typeof body.imageSize === 'string' ? body.imageSize.trim() : '1K';

    try {
      const result = await generateOrEditImage({
        prompt,
        imageBase64,
        mimeType,
        aspectRatio,
        imageSize,
      });
      res.json(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Image generation failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/gemini/video', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : undefined;
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : undefined;
    const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio.trim() : '16:9';

    if (!prompt && !imageBase64) {
      res.status(400).json({ error: 'Upload an image or provide a motion prompt to generate a video.' });
      return;
    }

    try {
      const result = await animateImageToVideo({
        prompt: prompt || 'Animate this photo with subtle, natural cinematic motion.',
        imageBase64,
        mimeType,
        aspectRatio,
      });
      res.json(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Video animation failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/gemini/music', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required to generate music.' });
      return;
    }
    const model = typeof body.model === 'string' ? body.model.trim() : 'lyria-3-clip-preview';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : undefined;

    try {
      const result = await generateMusicTrack({
        prompt,
        model,
        imageBase64,
        mimeType,
      });
      res.json(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Music generation failed.';
      res.status(502).json({ error: detail });
    }
  });

  app.post('/api/gemini/transcribe', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';
    if (!audioBase64) {
      res.status(400).json({ error: 'Audio data is required for transcription.' });
      return;
    }
    try {
      const result = await transcribeAudioBuffer({ audioBase64, mimeType });
      res.json(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Audio transcription failed.';
      res.status(502).json({ error: detail });
    }
  });

  // --- Design Tokens API ---
  app.get('/api/tokens', async (_req: Request, res: Response) => {
    try {
      const tokens = await loadTokens();
      res.json(tokens);
    } catch {
      res.status(500).json({ error: 'Could not read design tokens.' });
    }
  });

  // --- Ghostty terminal config, shaders & external handoff ---
  app.get('/api/terminal/ghostty-config', async (_req: Request, res: Response) => {
    try {
      const discovery = await readLocalGhosttyConfig();
      res.json(discovery);
    } catch {
      res.status(500).json({ error: 'Could not inspect local Ghostty config.' });
    }
  });

  app.get('/api/terminal/ghostty-shader', async (req: Request, res: Response) => {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relPath) {
      res.status(400).json({ error: 'Shader path is required.' });
      return;
    }
    const result = await readLocalGhosttyShader(relPath);
    if (!result) {
      res.status(404).json({ error: 'Shader not found.' });
      return;
    }
    res.json(result);
  });

  app.post('/api/terminal/open-external', async (req: Request, res: Response) => {
    const appName = req.body?.app;
    if (appName !== 'ghostty' && appName !== 'rex') {
      res.status(400).json({ error: 'App must be "ghostty" or "rex".' });
      return;
    }
    const cwd = typeof req.body?.cwd === 'string' && req.body.cwd.trim() ? req.body.cwd.trim() : ROOT_DIR;
    const outcome = await openExternalTerminal(appName, cwd);
    if (!outcome.ok) {
      res.status(400).json({ error: outcome.error || 'Could not launch external terminal.' });
      return;
    }
    res.json({ ok: true, app: appName });
  });

  // --- Allowlisted static assets ---
  app.use(
    express.static(path.join(ROOT_DIR, 'public'), {
      dotfiles: 'ignore',
    })
  );

  if (attachFrontend) {
    if (isProd) {
      const distDir = path.join(ROOT_DIR, 'dist');
      app.use(express.static(distDir, { dotfiles: 'ignore' }));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  } else {
    app.use((_req: Request, res: Response) => {
      res.status(404).type('text/plain').send('Not Found');
    });
  }

  return app;
}

export function attachLiveWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/api/live') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const voiceName = url.searchParams.get('voice') || 'Zephyr';
      const systemInstruction = url.searchParams.get('instruction') || undefined;
      void attachLiveVoiceSession(ws, { voiceName, systemInstruction });
    });
  });
  return wss;
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isEntrypoint) {
  const app = await createApp({ attachFrontend: true });
  const server = http.createServer(app);
  attachLiveWebSocket(server);
  attachTerminalWebSocket(server, ROOT_DIR);
  server.listen(PORT, HOST, () => {
    console.log(`Lanes listening on http://${HOST}:${PORT}`);
  });
}
