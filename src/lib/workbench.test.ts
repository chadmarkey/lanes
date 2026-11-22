import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TERMINAL_SETTINGS,
  exportGhosttyConfig,
  normalizeGhosttyGlsl,
  parseGhosttyConfig,
  resolveActiveTerminalTheme,
  sanitizeTerminalSettings,
} from './terminalConfig';
import {
  applyIdOrder,
  moveIdByStep,
  reorderIds,
  sanitizeWorkspaceLayout,
} from './workspaceLayout';
import {
  GEMINI_CHAT_MODELS,
  buildBreadcrumbs,
  formatViewHash,
  parseViewHash,
  readWorkerModel,
  saveWorkerModel,
  pruneWorkerModels,
  settleViewIds,
  servicesForHomeNote,
  STUDIO_TABS,
  WORKER_MODEL_STORAGE_KEY,
  computeLaneStatus,
  computeNeedsCount,
  enforceLaneAgent,
  filterKitCatalog,
  filterLibraryItems,
  filterTokens,
  getThemePair,
  isValidGeminiModel,
  routeHomeInput,
  toggleThemeMode,
} from './workbench';
import { SPATIAL_CAMERA_PRESETS, computeSpatialNodes } from './spatialLayout';
import {
  DEFAULT_APPEARANCE,
  moveRailPin,
  sanitizeAppearanceSettings,
  toggleRailPin,
} from './appearance';
import type { Branch, KitCatalogItem, Lane, LibraryItem, NeedsItem, TokenEntry } from './types';

const SAMPLE_LANES: Lane[] = [
  {
    id: 'lanes-build',
    name: 'Lanes build',
    purpose: 'Design tokens, sidebar polish, and PR reviews for Lanes',
    color: 3,
    icon: 'code',
    isPrivate: false,
    pinned: true,
    unread: false,
    approvalMode: 'Safe-auto',
    defaultAgentId: 'claude',
    instructions: '',
    messages: [],
    updatedAt: '4m',
  },
  {
    id: 'research',
    name: 'Research',
    purpose: 'Weekly PROMIS papers, reading digests, and literature notes',
    color: 1,
    icon: 'flask',
    isPrivate: false,
    pinned: true,
    unread: true,
    approvalMode: 'Ask',
    defaultAgentId: 'antigravity',
    instructions: '',
    messages: [],
    updatedAt: '18m',
  },
  {
    id: 'money',
    name: 'Money',
    purpose: 'Tax filings, bank statements, and household budgets',
    color: 4,
    icon: 'wallet',
    isPrivate: true,
    pinned: false,
    unread: false,
    approvalMode: 'Ask',
    defaultAgentId: 'qwen',
    instructions: '',
    messages: [],
    updatedAt: '2d',
  },
];

test('routeHomeInput routes explicit @lane mentions directly', () => {
  const result = routeHomeInput('@research Summarize the new PROMIS paper', SAMPLE_LANES);
  assert.equal(result.target, 'lane');
  assert.equal(result.laneId, 'research');
  assert.equal(result.cleanedText, 'Summarize the new PROMIS paper');
});

test('routeHomeInput matches purpose keywords and skips private lanes', () => {
  const buildResult = routeHomeInput('Check the sidebar polish PR diff', SAMPLE_LANES);
  assert.equal(buildResult.target, 'lane');
  assert.equal(buildResult.laneId, 'lanes-build');

  // Private lane keywords should not auto-route via cloud routing; falls back to Assistant
  const privateResult = routeHomeInput('Review household budgets and tax filings', SAMPLE_LANES);
  assert.equal(privateResult.target, 'assistant');
});

test('enforceLaneAgent forces local-only lanes onto Qwen', () => {
  const cloudInPrivate = enforceLaneAgent({ isPrivate: true }, 'claude');
  assert.equal(cloudInPrivate.agentId, 'qwen');
  assert.equal(cloudInPrivate.enforcedLocal, true);

  const cloudInNormal = enforceLaneAgent({ isPrivate: false }, 'claude');
  assert.equal(cloudInNormal.agentId, 'claude');
  assert.equal(cloudInNormal.enforcedLocal, false);
});

test('getThemePair and toggleThemeMode keep theme families paired', () => {
  assert.deepEqual(getThemePair('midcentury-light'), {
    light: 'midcentury-light',
    dark: 'midcentury-dark',
    family: 'Midcentury Modern',
    isDark: false,
  });
  assert.equal(toggleThemeMode('midcentury-light'), 'midcentury-dark');
  assert.deepEqual(getThemePair('calm-light'), {
    light: 'calm-light',
    dark: 'calm-dark',
    family: 'Calm',
    isDark: false,
  });
  assert.equal(toggleThemeMode('calm-light'), 'calm-dark');
  assert.equal(toggleThemeMode('dark'), 'light');
  assert.equal(toggleThemeMode('midnight-dark'), 'midnight-light');
  assert.equal(toggleThemeMode('xp-light'), 'xp-dark');
  assert.equal(toggleThemeMode('win98-light'), 'win98-dark');
  assert.equal(toggleThemeMode('terminal-dark'), 'terminal-light');
  assert.equal(getThemePair('terminal-dark').family, 'Terminal');
});

test('computeNeedsCount and computeLaneStatus summarize live state', () => {
  const needs: NeedsItem[] = [
    {
      id: 'n1',
      kind: 'approval',
      ask: 'Approve push',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      sourceTitle: 'Look PR',
      age: '4m',
      resolved: false,
    },
    {
      id: 'n2',
      kind: 'capture',
      ask: 'Old task',
      laneName: 'Inbox',
      laneColor: 1,
      sourceTitle: 'Capture',
      age: '1d',
      resolved: true,
    },
  ];
  assert.equal(computeNeedsCount(needs), 1);

  const branches: Branch[] = [
    {
      id: 'b1',
      laneId: 'lanes-build',
      title: 'Look PR',
      gitBranch: 'look-pr',
      agentId: 'claude',
      status: 'needs',
      age: '4m',
      checklist: [],
      files: [],
      messages: [],
    },
  ];
  assert.equal(computeLaneStatus('lanes-build', branches), 'needs');
  assert.equal(computeLaneStatus('research', branches), 'idle');
});

test('filterKitCatalog matches by #id, keyword, group, and portedOnly', () => {
  const items: KitCatalogItem[] = [
    {
      id: 174,
      name: 'Chat with diff',
      group: 'ai-chat',
      route: '/ai/chat/diff',
      kit_section: 'AI Chat',
      kit_page_file: 'page.tsx',
      kit_files: [],
      lanes_files: ['src/web/kit/diff.tsx'],
      lanes_users: [],
      lanes_parts_from_it: [],
      good_for: 'Chat and code diff side by side',
      fits_lanes: 'Changes panel',
      layout_desktop: 'Fixed',
      layout_phone: 'Fixed',
      shots: {},
      note: null,
    },
    {
      id: 104,
      name: 'Issue kanban',
      group: 'projects',
      route: '/projects/kanban',
      kit_section: 'Projects',
      kit_page_file: 'kanban.tsx',
      kit_files: [],
      lanes_files: [],
      lanes_users: [],
      lanes_parts_from_it: [],
      good_for: 'Kanban columns',
      fits_lanes: 'Branch board',
      layout_desktop: 'Fixed',
      layout_phone: 'Fixed',
      shots: {},
      note: null,
    },
  ];

  assert.equal(filterKitCatalog(items, '#174', 'all', false).length, 1);
  assert.equal(filterKitCatalog(items, '', 'all', true).length, 1);
  assert.equal(filterKitCatalog(items, 'kanban', 'projects', false).length, 1);
});

test('filterLibraryItems excludes private lanes automatically', () => {
  const files: LibraryItem[] = [
    {
      id: 'f1',
      name: 'summary.md',
      laneId: 'research',
      laneName: 'Research',
      laneColor: 1,
      kind: 'doc',
      size: '14 KB',
      updatedAt: '12m',
      origin: 'Antigravity',
      preview: 'Weekly notes',
      isPrivateLane: false,
    },
    {
      id: 'f2',
      name: 'tax-2026.pdf',
      laneId: 'money',
      laneName: 'Money',
      laneColor: 4,
      kind: 'pdf',
      size: '420 KB',
      updatedAt: '2d',
      origin: 'Uploaded by you',
      preview: 'Private',
      isPrivateLane: true,
    },
  ];
  const visible = filterLibraryItems(files, '', 'all', 'all');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'f1');
});

test('filterTokens filters by category and search term', () => {
  const tokens: TokenEntry[] = [
    { name: 'l-rail', value: { 'calm-light': 'oklch(0.934 0.007 236)' }, usage: 'Layer 1 icon rail' },
    { name: 'l-needs', value: { 'calm-light': 'oklch(0.68 0.14 75)' }, usage: 'Amber for needs you' },
  ];
  assert.equal(filterTokens(tokens, '', 'Layers').length, 1);
  assert.equal(filterTokens(tokens, 'amber', 'All').length, 1);
});

test('buildBreadcrumbs tracks Home, Lane, Branch, Media Studio, Bots, and Design Studio paths', () => {
  const home = buildBreadcrumbs({ place: 'home' });
  assert.deepEqual(
    home.map((c) => ({ label: c.label, current: c.current })),
    [{ label: 'Home', current: true }]
  );

  const laneOnly = buildBreadcrumbs({
    place: 'lanes',
    activeLane: { id: 'lanes-build', name: 'Lanes build', color: 3 },
    activeBranch: null,
  });
  assert.deepEqual(
    laneOnly.map((c) => ({ label: c.label, current: c.current })),
    [
      { label: 'Home', current: false },
      { label: 'Lanes build', current: true },
    ]
  );

  const laneWithBranch = buildBreadcrumbs({
    place: 'lanes',
    activeLane: { id: 'lanes-build', name: 'Lanes build', color: 3 },
    activeBranch: { id: 'br-look-pr', title: 'Look PR: tokens and layers', laneId: 'lanes-build' },
  });
  assert.deepEqual(
    laneWithBranch.map((c) => ({ label: c.label, current: c.current })),
    [
      { label: 'Home', current: false },
      { label: 'Lanes build', current: false },
      { label: 'Look PR: tokens and layers', current: true },
    ]
  );

  // Branch belonging to a different lane must not appear under activeLane
  const mismatchedBranch = buildBreadcrumbs({
    place: 'lanes',
    activeLane: { id: 'research', name: 'Research', color: 1 },
    activeBranch: { id: 'br-look-pr', title: 'Look PR: tokens and layers', laneId: 'lanes-build' },
  });
  assert.equal(mismatchedBranch.length, 2);
  assert.equal(mismatchedBranch[1].current, true);

  const mediaVideo = buildBreadcrumbs({ place: 'media', mediaTab: 'video' });
  assert.deepEqual(
    mediaVideo.map((c) => c.label),
    ['Home', 'Media & Voice', 'Animate Video']
  );

  const botPath = buildBreadcrumbs({
    place: 'bots',
    activeBot: { id: 'bot-researcher', name: 'Researcher' },
  });
  assert.deepEqual(
    botPath.map((c) => c.label),
    ['Home', 'Bots', 'Researcher']
  );

  const studioPath = buildBreadcrumbs({ place: 'studio', studioTab: 'tokens' });
  assert.deepEqual(
    studioPath.map((c) => c.label),
    ['Home', 'Design Studio', 'Tokens']
  );

  const mediaMusic = buildBreadcrumbs({ place: 'media', mediaTab: 'music' });
  assert.deepEqual(
    mediaMusic.map((c) => c.label),
    ['Home', 'Media & Voice', 'Music']
  );

  const spatialPath = buildBreadcrumbs({ place: 'spatial' });
  assert.deepEqual(
    spatialPath.map((c) => ({ label: c.label, current: c.current })),
    [
      { label: 'Home', current: false },
      { label: '3D Studio', current: true },
    ]
  );
});

test('computeSpatialNodes positions grounded lane monoliths and orbiting branches deterministically', () => {
  const branches: Branch[] = [
    {
      id: 'b1',
      laneId: 'lanes-build',
      title: 'Look PR',
      gitBranch: 'look-pr',
      agentId: 'claude',
      status: 'needs',
      age: '4m',
      checklist: [],
      files: [],
      messages: [],
    },
    {
      id: 'b2',
      laneId: 'lanes-build',
      title: 'Merged branch',
      gitBranch: 'merged-pr',
      agentId: 'codex',
      status: 'done',
      merged: true,
      age: '2d',
      checklist: [],
      files: [],
      messages: [],
    },
  ];
  const nodes = computeSpatialNodes(SAMPLE_LANES, branches);
  assert.equal(nodes.length, SAMPLE_LANES.length);
  for (const node of nodes) {
    assert.equal(node.position[1], 0, 'Lane pedestal must be grounded at y = 0');
    assert.ok(Math.hypot(node.position[0], node.position[2]) > 4.0);
  }
  const buildNode = nodes.find((n) => n.laneId === 'lanes-build')!;
  assert.equal(buildNode.status, 'needs');
  assert.equal(buildNode.openBranchCount, 1);
  assert.equal(buildNode.branches.length, 1);
  assert.ok(SPATIAL_CAMERA_PRESETS.hero.position.length === 3);
  assert.ok(SPATIAL_CAMERA_PRESETS.top.position[1] > 10);
});

test('GEMINI_CHAT_MODELS exposes the 4 supported chat models', () => {
  const ids = GEMINI_CHAT_MODELS.map((m) => m.id);
  assert.deepEqual(ids, [
    'gemini-4-hydrogen',
    'gemini-4-neon',
    'gemini-4-carbon',
    'gemini-3.1-flash-lite',
  ]);
  assert.equal(isValidGeminiModel('gemini-4-carbon'), true);
  assert.equal(isValidGeminiModel('gemini-1.5-pro'), false);
});

test('AppearanceSettings sanitization, rail pinning, and reordering protect locked places', () => {
  const sanitized = sanitizeAppearanceSettings({
    theme: 'invalid-theme',
    shader: 'blueprint-grid',
    accent: 'cobalt',
    radius: 'sharp',
    iconMotion: 'crisp',
    pinnedRailPlaces: ['media', 'media', 'bogus'],
  });
  assert.equal(sanitized.theme, DEFAULT_APPEARANCE.theme);
  assert.equal(DEFAULT_APPEARANCE.theme, 'calm-light');
  assert.equal(DEFAULT_APPEARANCE.shader, 'clean');
  assert.equal(DEFAULT_APPEARANCE.iconMotion, 'off');
  assert.equal(sanitized.shader, 'blueprint-grid');
  assert.equal(sanitized.accent, 'cobalt');
  assert.equal(sanitized.radius, 'sharp');
  assert.equal(sanitized.iconMotion, 'crisp');

  // Amber accent is reserved for Needs you only and safely resets to 'theme'
  const amberSanitized = sanitizeAppearanceSettings({ accent: 'amber' });
  assert.equal(amberSanitized.accent, 'theme');
  // Locked places ('home' and 'studio') are always restored automatically
  assert.ok(sanitized.pinnedRailPlaces.includes('home'));
  assert.ok(sanitized.pinnedRailPlaces.includes('studio'));
  assert.ok(sanitized.pinnedRailPlaces.includes('media'));

  // Toggling locked 'home' never unpins it
  const afterHomeToggle = toggleRailPin(sanitized.pinnedRailPlaces, 'home');
  assert.ok(afterHomeToggle.includes('home'));

  // Toggling non-locked 'bots' pins and unpins cleanly
  const withBots = toggleRailPin(sanitized.pinnedRailPlaces, 'bots');
  assert.ok(withBots.includes('bots'));
  const withoutBots = toggleRailPin(withBots, 'bots');
  assert.equal(withoutBots.includes('bots'), false);

  // Moving pinned items up/down updates exact order
  const reordered = moveRailPin(['home', 'lanes', 'media', 'studio'], 'media', 'up');
  assert.deepEqual(reordered, ['home', 'media', 'lanes', 'studio']);

  // Design Studio Appearance breadcrumb
  const studioAppearance = buildBreadcrumbs({ place: 'studio', studioTab: 'appearance' });
  assert.deepEqual(
    studioAppearance.map((c) => c.label),
    ['Home', 'Design Studio', 'Appearance']
  );
});

test('view hash round-trips every place and sub-view', () => {
  const routes = [
    { place: 'home' as const },
    { place: 'studio' as const, studioTab: 'tokens' as const },
    { place: 'media' as const, mediaTab: 'music' as const },
    { place: 'lanes' as const, laneId: 'lanes-build', branchId: 'b 1' },
    { place: 'lanes' as const, laneId: 'research' },
    { place: 'bots' as const, botId: 'writer' },
    { place: 'settings' as const },
  ];
  for (const route of routes) {
    assert.deepEqual(parseViewHash(formatViewHash(route)), route);
  }
  assert.equal(formatViewHash({ place: 'studio', studioTab: 'terminal' }), '#/studio/terminal');
});

test('parseViewHash ignores unknown places and tabs', () => {
  assert.equal(parseViewHash(''), null);
  assert.equal(parseViewHash('#/nowhere'), null);
  assert.deepEqual(parseViewHash('#/studio/bogus'), { place: 'studio' });
  assert.deepEqual(parseViewHash('#/media/bogus'), { place: 'media' });
});

test('sanitizeAppearanceSettings keeps a valid bloom level and defaults the rest to off', () => {
  assert.equal(DEFAULT_APPEARANCE.bloom, 'off');
  assert.equal(sanitizeAppearanceSettings({ bloom: 'strong' }).bloom, 'strong');
  assert.equal(sanitizeAppearanceSettings({ bloom: 'blinding' }).bloom, 'off');
  assert.equal(sanitizeAppearanceSettings({}).bloom, 'off');
});

test('worker model picks are remembered per worker and ignore unknown models', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  assert.equal(readWorkerModel('br-a', storage), GEMINI_CHAT_MODELS[0].id);
  saveWorkerModel('br-a', 'gemini-4-neon', storage);
  saveWorkerModel('br-b', 'gemini-4-carbon', storage);
  assert.equal(readWorkerModel('br-a', storage), 'gemini-4-neon');
  assert.equal(readWorkerModel('br-b', storage), 'gemini-4-carbon');
  data.set(WORKER_MODEL_STORAGE_KEY, JSON.stringify({ 'br-a': 'retired-model' }));
  assert.equal(readWorkerModel('br-a', storage), GEMINI_CHAT_MODELS[0].id);
  data.set(WORKER_MODEL_STORAGE_KEY, 'not json');
  assert.equal(readWorkerModel('br-a', storage), GEMINI_CHAT_MODELS[0].id);
});

test('worker model storage survives blocked storage and forgets deleted workers', () => {
  const blocked = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(readWorkerModel('br-blocked-a', blocked), GEMINI_CHAT_MODELS[0].id);
  assert.doesNotThrow(() => saveWorkerModel('br-blocked-a', 'gemini-4-neon', blocked));
  // With storage blocked, a pick is still kept in memory for this session.
  assert.equal(readWorkerModel('br-blocked-a', null), 'gemini-4-neon');
  assert.doesNotThrow(() => saveWorkerModel('br-blocked-b', 'gemini-4-carbon', null));
  assert.equal(readWorkerModel('br-blocked-b', blocked), 'gemini-4-carbon');

  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  saveWorkerModel('br-keep', 'gemini-4-neon', storage);
  saveWorkerModel('br-gone', 'gemini-4-carbon', storage);
  pruneWorkerModels(['br-keep'], storage);
  assert.deepEqual(JSON.parse(data.get(WORKER_MODEL_STORAGE_KEY) ?? '{}'), { 'br-keep': 'gemini-4-neon' });
});

test('studio tab routes only accept real Design Studio tabs', () => {
  for (const tab of STUDIO_TABS) {
    assert.deepEqual(parseViewHash(`#/studio/${tab}`), { place: 'studio', studioTab: tab });
  }
});

test('settleViewIds drops ids that do not exist or do not belong together', () => {
  const ws = {
    lanes: [{ id: 'lane-a' }, { id: 'lane-b' }],
    branches: [
      { id: 'br-a1', laneId: 'lane-a' },
      { id: 'br-b1', laneId: 'lane-b' },
    ],
    bots: [{ id: 'bot-1' }],
  };
  assert.deepEqual(settleViewIds({ laneId: 'lane-a', branchId: 'br-a1', botId: 'bot-1' }, ws), {
    laneId: 'lane-a',
    branchId: 'br-a1',
    botId: 'bot-1',
  });
  // Unknown lane and bot fall back to the first real one; their worker is dropped.
  assert.deepEqual(settleViewIds({ laneId: 'gone', branchId: 'br-a1', botId: 'gone' }, ws), {
    laneId: 'lane-a',
    branchId: 'br-a1',
    botId: 'bot-1',
  });
  // A worker from another lane is not shown, so it is dropped.
  assert.deepEqual(settleViewIds({ laneId: 'lane-a', branchId: 'br-b1', botId: null }, ws), {
    laneId: 'lane-a',
    branchId: null,
    botId: 'bot-1',
  });
  assert.deepEqual(settleViewIds({ laneId: null, branchId: 'nope', botId: null }, { lanes: [], branches: [], bots: [] }), {
    laneId: null,
    branchId: null,
    botId: null,
  });
});

test('servicesForHomeNote leaves out services already asked about in Needs you', () => {
  const services = [
    { id: 'srv-a', name: 'A', status: 'healthy' as const },
    { id: 'srv-b', name: 'B', status: 'degraded' as const },
    { id: 'srv-c', name: 'C', status: 'down' as const },
  ];
  // B is covered by an open request shown on Home; C is not, so it still gets the note.
  assert.deepEqual(
    servicesForHomeNote(services, [{ kind: 'service', serviceId: 'srv-b' }]).map((s) => s.id),
    ['srv-c']
  );
  assert.deepEqual(servicesForHomeNote(services, []).map((s) => s.id), ['srv-b', 'srv-c']);
});

test('parseGhosttyConfig parses theme pairs, palette colors, padding, and shaders', () => {
  const sample = `
# Ghostty sample
theme = light:iTerm2 Solarized Light,dark:iTerm2 Solarized Dark
font-family = JetBrains Mono
font-size = 15
window-padding-x = 10
window-padding-y = 8
cursor-style = bar
background = #1a1b26
palette = 1=#f7768e
custom-shader = shaders/hackr/bettercrt.glsl
`;
  const parsed = parseGhosttyConfig(sample);
  assert.equal(parsed.patch.followAppMode, true);
  assert.equal(parsed.patch.lightThemeId, 'solarized-light');
  assert.equal(parsed.patch.darkThemeId, 'solarized-dark');
  assert.equal(parsed.patch.fontFamily, 'JetBrains Mono');
  assert.equal(parsed.patch.fontSize, 15);
  assert.equal(parsed.patch.paddingX, 10);
  assert.equal(parsed.patch.paddingY, 8);
  assert.equal(parsed.patch.cursorStyle, 'bar');
  assert.equal(parsed.patch.shaderId, 'bettercrt');
  assert.equal(parsed.patch.localShaderPath, 'hackr/bettercrt.glsl');
  assert.equal(parsed.patch.customOverrides?.background, '#1a1b26');
  assert.equal(parsed.patch.customOverrides?.red, '#f7768e');
});

test('exportGhosttyConfig round-trips settings and resolveActiveTerminalTheme follows app mode', () => {
  const settings = sanitizeTerminalSettings({
    ...DEFAULT_TERMINAL_SETTINGS,
    followAppMode: true,
    lightThemeId: 'solarized-light',
    darkThemeId: 'tokyo-night',
    fontSize: 14,
  });
  assert.equal(resolveActiveTerminalTheme(settings, false).preset.id, 'solarized-light');
  assert.equal(resolveActiveTerminalTheme(settings, true).preset.id, 'tokyo-night');
  const exported = exportGhosttyConfig(settings, true);
  assert.match(exported, /theme = light:iTerm2 Solarized Light,dark:TokyoNight/);
  assert.match(exported, /font-size = 14/);
});

test('normalizeGhosttyGlsl converts desktop C-style array initializers to WebGL2 syntax', () => {
  const desktop = `#version 330 core\nconst vec3[2] samples = { vec3(1.0), vec3(2.0) };`;
  const webgl2 = normalizeGhosttyGlsl(desktop);
  assert.ok(!webgl2.includes('#version'));
  assert.ok(webgl2.includes('const vec3 samples[2] = vec3[2]('));
});

test('sanitizeAppearanceSettings accepts Paper Shaders and React Bits live backgrounds', () => {
  const paper = sanitizeAppearanceSettings({ shader: 'paper-mesh' });
  assert.equal(paper.shader, 'paper-mesh');
  const rb = sanitizeAppearanceSettings({ shader: 'rb-silk' });
  assert.equal(rb.shader, 'rb-silk');
});

test('workspaceLayout reorders lanes/bots cleanly and validates dock positions', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorderIds(ids, 'c', 'a'), ['c', 'a', 'b', 'd']);
  assert.deepEqual(moveIdByStep(ids, 'b', -1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(moveIdByStep(ids, 'd', 1), ['a', 'b', 'c', 'd']);

  const ordered = applyIdOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['c', 'a']);
  assert.deepEqual(
    ordered.map((x) => x.id),
    ['c', 'a', 'b']
  );

  const layout = sanitizeWorkspaceLayout({
    terminalDock: 'right',
    workerDock: 'left',
    laneOrder: ['b', 'a', 'b'],
    botOrder: ['bot-2', 'bot-1'],
  });
  assert.equal(layout.terminalDock, 'right');
  assert.equal(layout.workerDock, 'left');
  assert.deepEqual(layout.laneOrder, ['b', 'a']);
  assert.deepEqual(layout.botOrder, ['bot-2', 'bot-1']);
});
