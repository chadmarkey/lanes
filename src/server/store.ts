import type {
  AgentId,
  ApprovalMode,
  Bot,
  Branch,
  GroundingSource,
  Lane,
  LaneColorIndex,
  LibraryItem,
  MemoryNote,
  NeedsItem,
  ScheduledJob,
  WorkspaceState,
} from '../lib/types.ts';

function nowLabel(): string {
  return 'just now';
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createInitialWorkspaceState(): WorkspaceState {
  const lanes: Lane[] = [
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
      instructions:
        'Follow DESIGN.md strictly. Every color uses a --l-* token, amber is reserved for "Needs you", and every icon-only button has a tooltip.',
      updatedAt: '4m',
      messages: [
        {
          id: 'm-lb-1',
          role: 'user',
          text: 'Finish the Look PR token sweep and check the sidebar grouping polish before we merge.',
          timestamp: '14m ago',
        },
        {
          id: 'm-lb-2',
          role: 'assistant',
          text: 'I split this into two branches so you can review the token sweep and sidebar grouping separately. Look PR is ready to push once you approve it; the diff viewer scope switch already passed all checks.',
          timestamp: '12m ago',
          agentId: 'claude',
          modelLabel: 'Opus · high',
          steps: [
            {
              id: 'st-1',
              label: 'Checked DESIGN.md and tokens.css',
              detail: 'Verified all 197 contrast pairs pass 4.5:1 on Calm and Warm paper.',
              durationSec: 4,
            },
            {
              id: 'st-2',
              label: 'Started 2 worker branches',
              detail: 'Delegated Look PR to Claude and Sidebar grouping polish to Codex.',
              durationSec: 9,
            },
          ],
        },
      ],
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
      instructions:
        'Always cite page numbers and keep quotes verbatim. Write plain, skimmable summaries for clinical review.',
      updatedAt: '18m',
      messages: [
        {
          id: 'm-res-1',
          role: 'user',
          text: 'Pull this week’s PROMIS physical function papers and draft the weekly digest.',
          timestamp: '1h ago',
        },
        {
          id: 'm-res-2',
          role: 'assistant',
          text: 'Found 3 new papers from the latest issue. Before formatting the final digest, pick whether you want a single-page brief or five tight bullets.',
          timestamp: '52m ago',
          agentId: 'antigravity',
          modelLabel: 'Antigravity · high',
          steps: [
            {
              id: 'st-r1',
              label: 'Scanned 14 journal abstracts',
              detail: 'Matched 3 papers covering PROMIS PF-20 responsiveness and MCID.',
              durationSec: 18,
            },
          ],
        },
      ],
    },
    {
      id: 'writing',
      name: 'Writing',
      purpose: 'Release notes, architecture memos, and calm product copy',
      color: 2,
      icon: 'pen',
      isPrivate: false,
      pinned: false,
      unread: false,
      approvalMode: 'Safe-auto',
      defaultAgentId: 'gemini',
      instructions:
        'Sentence case for every heading and button. No exclamation marks, no filler, say the result rather than the mechanism.',
      updatedAt: '3h',
      messages: [
        {
          id: 'm-wr-1',
          role: 'user',
          text: 'Tighten the empty-state copy for the Library and Needs-you pages.',
          timestamp: '3h ago',
        },
        {
          id: 'm-wr-2',
          role: 'assistant',
          text: 'Updated both empty states to two short lines: what is missing, and the single next action. Saved the draft in Library as empty-state-copy.md.',
          timestamp: '3h ago',
          agentId: 'gemini',
          modelLabel: 'Gemini 4 Flash',
        },
      ],
    },
    {
      id: 'money',
      name: 'Money',
      purpose: 'Household budgets, statements, and tax prep (stays on-device)',
      color: 4,
      icon: 'wallet',
      isPrivate: true,
      pinned: false,
      unread: false,
      approvalMode: 'Ask',
      defaultAgentId: 'qwen',
      instructions:
        'Local-only lane. Never call outbound tools or cloud models. Summarize quarterly estimates clearly.',
      updatedAt: '2d',
      messages: [
        {
          id: 'm-mo-1',
          role: 'user',
          text: 'Categorize Q3 recurring subscriptions and flag anything that went up.',
          timestamp: '2d ago',
        },
        {
          id: 'm-mo-2',
          role: 'assistant',
          text: 'Reviewed 19 recurring items locally on Qwen. Two subscriptions increased since Q2; full breakdown stays inside this private lane.',
          timestamp: '2d ago',
          agentId: 'qwen',
          modelLabel: 'Qwen 30B (local)',
        },
      ],
    },
  ];

  const branches: Branch[] = [
    {
      id: 'br-look-pr',
      laneId: 'lanes-build',
      title: 'Look PR: tokens and layers',
      gitBranch: 'lanes/look-pr',
      agentId: 'claude',
      status: 'needs',
      age: '4m',
      currentStep: 'Waiting on push approval',
      checklist: [
        { id: 'c1', label: 'Map Calm tokens in app.css and ui.css', done: true },
        { id: 'c2', label: 'Reserve amber strictly for Needs you', done: true },
        { id: 'c3', label: 'Verify 4.5:1 muted contrast across all 4 layers', done: true },
        { id: 'c4', label: 'Push look-pr branch to origin', done: false },
      ],
      approval: {
        id: 'app-look-push',
        ask: 'Approve push to look-pr',
        command: 'git push origin lanes/look-pr',
        allowedRule: 'Local edits only; pushes ask first',
        status: 'pending',
      },
      files: [
        {
          path: 'src/web/app.css',
          adds: 42,
          dels: 18,
          patch:
            '@@ -12,6 +12,8 @@ :root {\n-  --l-accent: #1d4ed8;\n+  --l-accent: oklch(0.54 0.14 248);\n+  --l-needs: oklch(0.66 0.14 75);\n   --l-focus: var(--l-accent);',
        },
        {
          path: 'src/web/ui.css',
          adds: 14,
          dels: 5,
          patch:
            '@@ -4,4 +4,5 @@ :root {\n   --primary: var(--l-accent);\n+  --popover: var(--l-raised);\n   --sidebar: var(--l-list);',
        },
      ],
      messages: [
        {
          id: 'bm-1',
          role: 'assistant',
          text: 'All 197 token contrast pairs pass in both Calm light and dark. Ready to push lanes/look-pr once you approve.',
          timestamp: '4m ago',
          agentId: 'claude',
          modelLabel: 'Opus · high',
        },
      ],
    },
    {
      id: 'br-sidebar',
      laneId: 'lanes-build',
      title: 'Sidebar grouping polish',
      gitBranch: 'lanes/sidebar-groups',
      agentId: 'codex',
      askedByBot: 'Reviewer',
      status: 'working',
      age: '12m',
      currentStep: 'Running unit tests on group fold state',
      checklist: [
        { id: 's1', label: 'Sort Waiting on you above Working', done: true },
        { id: 's2', label: 'Fold Idle lanes by default with count', done: true },
        { id: 's3', label: 'Keep hover gear from overlapping unread mark', done: true },
        { id: 's4', label: 'Run server and UI test suite', done: false },
        { id: 's5', label: 'Capture light and dark comparison', done: false },
      ],
      files: [
        {
          path: 'src/web/components/RailSidebar.tsx',
          adds: 29,
          dels: 11,
          patch:
            '@@ -88,6 +88,9 @@ export function RailSidebar() {\n+  const waiting = lanes.filter(hasPendingNeed);\n+  const working = lanes.filter(isActiveWorking);',
        },
      ],
      messages: [
        {
          id: 'bm-2',
          role: 'assistant',
          text: 'Updated group order so Waiting on you always stays pinned first. Running the test suite now.',
          timestamp: '6m ago',
          agentId: 'codex',
          modelLabel: 'Codex · medium',
        },
      ],
    },
    {
      id: 'br-diff-scope',
      laneId: 'lanes-build',
      title: 'Diff viewer scope switch',
      gitBranch: 'lanes/diff-scope',
      agentId: 'claude',
      status: 'done',
      age: '28m',
      summary: 'Added "Last agent turn" scope filter to the diff viewer.',
      checkedBy: 'Unit tests and 1290x800 light/dark visual check',
      merged: false,
      checklist: [
        { id: 'd1', label: 'Add Full branch vs Last turn toggle', done: true },
        { id: 'd2', label: 'Preserve scroll offset when switching files', done: true },
        { id: 'd3', label: 'Verify unified and split layouts', done: true },
      ],
      files: [
        {
          path: 'src/web/components/DiffFileList.tsx',
          adds: 58,
          dels: 9,
          patch:
            '@@ -22,3 +22,9 @@ export function DiffFileList() {\n+  const [scope, setScope] = useState<"branch" | "turn">("branch");',
        },
      ],
      messages: [
        {
          id: 'bm-3',
          role: 'assistant',
          text: 'Done. Added "Last agent turn" to the diff viewer and verified all tests pass. Ready for review and merge.',
          timestamp: '28m ago',
          agentId: 'claude',
          modelLabel: 'Opus · high',
        },
      ],
    },
    {
      id: 'br-promis',
      laneId: 'research',
      title: 'Weekly PROMIS digest',
      gitBranch: 'research/promis-w46',
      agentId: 'antigravity',
      askedByBot: 'Researcher',
      status: 'needs',
      age: '1h',
      currentStep: 'Waiting on format choice',
      checklist: [
        { id: 'p1', label: 'Fetch 3 new PROMIS PF-20 studies', done: true },
        { id: 'p2', label: 'Extract sample size and MCID quotes', done: true },
        { id: 'p3', label: 'Format digest according to choice', done: false },
      ],
      decision: {
        id: 'dec-promis-fmt',
        question: 'Pick a format for the weekly digest',
        choices: [
          { key: 'A', label: 'One page', note: 'Structured summary with key quotes and citations' },
          { key: 'B', label: 'Five bullets', note: 'Compact executive skim for morning review' },
        ],
      },
      files: [
        {
          path: 'sources/promis-week-46.md',
          adds: 64,
          dels: 0,
          patch:
            '@@ -0,0 +1,5 @@\n+# PROMIS Physical Function — Week 46\n+- 3 matched studies\n+- MCID threshold range: 3.5 to 4.8 T-score points',
        },
      ],
      messages: [
        {
          id: 'bm-4',
          role: 'assistant',
          text: 'All 3 papers are indexed with page citations. Pick A or B and I will finalize the digest.',
          timestamp: '1h ago',
          agentId: 'antigravity',
          modelLabel: 'Antigravity · high',
        },
      ],
    },
  ];

  const needs: NeedsItem[] = [
    {
      id: 'need-look-push',
      kind: 'approval',
      ask: 'Approve push to look-pr',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      agentId: 'claude',
      branchId: 'br-look-pr',
      sourceTitle: 'Look PR: tokens and layers',
      age: 'waiting 4m',
      wants: 'git push origin lanes/look-pr',
      allowed: 'Local edits only; pushes ask first',
      resolved: false,
    },
    {
      id: 'need-promis-fmt',
      kind: 'decision',
      ask: 'Pick a format for the weekly digest',
      laneId: 'research',
      laneName: 'Research',
      laneColor: 1,
      agentId: 'antigravity',
      branchId: 'br-promis',
      sourceTitle: 'Weekly PROMIS digest',
      age: 'waiting 1h',
      choices: [
        { key: 'A', label: 'One page' },
        { key: 'B', label: 'Five bullets' },
      ],
      resolved: false,
    },
    {
      id: 'need-qwen-restart',
      kind: 'service',
      ask: 'Check Qwen local endpoint health',
      serviceId: 'srv-qwen',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      sourceTitle: 'Studio services',
      age: 'degraded 20m',
      wants: 'Reconnect mlx-serve on 127.0.0.1:11434',
      allowed: 'Local loopback restart only',
      resolved: false,
    },
  ];

  const bots: Bot[] = [
    {
      id: 'bot-researcher',
      name: 'Researcher',
      job: 'Tracks weekly clinical literature, verifies citations, and prepares structured digests.',
      agentId: 'antigravity',
      allowedLaneIds: ['research', 'writing'],
      morningSuggestions: true,
      messages: [
        {
          id: 'botm-1',
          role: 'assistant',
          text: 'Morning sweep finished across Research. One digest branch is waiting on your format pick, and I drafted one follow-up suggestion below.',
          timestamp: '45m ago',
          agentId: 'antigravity',
          modelLabel: 'Antigravity · high',
        },
      ],
      suggestions: [
        {
          id: 'sug-1',
          botId: 'bot-researcher',
          laneId: 'research',
          laneName: 'Research',
          title: 'Compare MCID thresholds across the last 4 PROMIS digests',
          rationale: 'Three studies this month reported narrower responsiveness bands.',
          status: 'pending',
        },
      ],
    },
    {
      id: 'bot-writer',
      name: 'Writer',
      job: 'Turns finished branches and engineering notes into calm release notes and clear UI copy.',
      agentId: 'gemini',
      allowedLaneIds: ['writing', 'lanes-build'],
      morningSuggestions: true,
      messages: [
        {
          id: 'botm-2',
          role: 'assistant',
          text: 'Standing by for Look PR to merge so I can draft the changelog entry.',
          timestamp: '2h ago',
          agentId: 'gemini',
          modelLabel: 'Gemini 4 Flash',
        },
      ],
      suggestions: [
        {
          id: 'sug-2',
          botId: 'bot-writer',
          laneId: 'writing',
          laneName: 'Writing',
          title: 'Draft Calm theme release note for DESIGN.md changelog',
          rationale: 'Look PR and Diff scope switch are nearly ready to ship.',
          status: 'pending',
        },
      ],
    },
    {
      id: 'bot-reviewer',
      name: 'Reviewer',
      job: 'Audits diffs against DESIGN.md rules: contrast, tooltips, token discipline, and mobile reflow.',
      agentId: 'codex',
      allowedLaneIds: ['lanes-build'],
      morningSuggestions: false,
      messages: [
        {
          id: 'botm-3',
          role: 'assistant',
          text: 'Checked Sidebar grouping polish and Diff viewer scope switch. Zero hardcoded hex values found.',
          timestamp: '18m ago',
          agentId: 'codex',
          modelLabel: 'Codex · medium',
        },
      ],
      suggestions: [],
    },
  ];

  const jobs: ScheduledJob[] = [
    {
      id: 'job-morning-brief',
      name: 'Morning brief',
      laneId: 'research',
      laneName: 'Research',
      cadence: 'Weekdays at 07:30',
      nextRun: 'Tomorrow 07:30',
      status: 'active',
      onlyReportChanges: false,
      prompt: 'Summarize waiting approvals, running branches, and today’s priorities.',
      lastSummary: '3 asks waiting, 1 branch running, 1 ready to merge.',
      history: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    },
    {
      id: 'job-promis-feed',
      name: 'PROMIS journal watch',
      laneId: 'research',
      laneName: 'Research',
      cadence: 'Mondays at 08:00',
      nextRun: 'Mon 08:00',
      status: 'active',
      onlyReportChanges: true,
      prompt: 'Check RSS feeds for new PROMIS physical function studies. Reply NOTHING NEW if unchanged.',
      lastSummary: 'Found 3 new articles and opened Weekly PROMIS digest branch.',
      history: ['noop', 'ok', 'noop', 'noop', 'ok', 'ok', 'ok'],
    },
    {
      id: 'job-token-audit',
      name: 'Nightly contrast & token audit',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      cadence: 'Daily at 02:00',
      nextRun: 'Paused',
      status: 'paused',
      onlyReportChanges: true,
      prompt: 'Verify all 197 token pairs pass 4.5:1 across all 8 presets.',
      lastSummary: 'All 197 pairs passed on last run.',
      history: ['ok', 'ok', 'failed', 'ok', 'ok', 'noop', 'ok'],
    },
  ];

  const library: LibraryItem[] = [
    {
      id: 'lib-1',
      name: 'empty-state-copy.md',
      laneId: 'writing',
      laneName: 'Writing',
      laneColor: 2,
      kind: 'doc',
      size: '4.2 KB',
      updatedAt: '3h',
      origin: 'Gemini 4 Flash · Main thread',
      preview:
        'Library empty state: "No files yet. Drop a document into any non-private lane to index it here."',
      isPrivateLane: false,
    },
    {
      id: 'lib-2',
      name: 'promis-week-46.md',
      laneId: 'research',
      laneName: 'Research',
      laneColor: 1,
      kind: 'doc',
      size: '18.6 KB',
      updatedAt: '1h',
      origin: 'Antigravity · Weekly PROMIS digest',
      preview:
        'Three matched clinical papers on PROMIS PF-20 responsiveness, with verbatim page citations.',
      isPrivateLane: false,
    },
    {
      id: 'lib-3',
      name: 'tokens-contrast-report.json',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      kind: 'code',
      size: '26.1 KB',
      updatedAt: '14m',
      origin: 'Claude · Look PR branch',
      preview:
        '{ "theme": "calm-dark", "pairsChecked": 197, "failures": 0, "lowestMuted": "4.6:1" }',
      isPrivateLane: false,
    },
    {
      id: 'lib-4',
      name: 'icon-drafts-comparison.svg',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      kind: 'image',
      size: '11.4 KB',
      updatedAt: '1d',
      origin: 'Uploaded by you',
      preview: 'Side-by-side comparison of AppIcon drafts A (Tile lanes), B (Color lanes), and C (Tile L).',
      isPrivateLane: false,
    },
    {
      id: 'lib-5',
      name: 'q3-statements-private.pdf',
      laneId: 'money',
      laneName: 'Money',
      laneColor: 4,
      kind: 'pdf',
      size: '412 KB',
      updatedAt: '2d',
      origin: 'Uploaded by you',
      preview: 'Private lane file — hidden from shared Library.',
      isPrivateLane: true,
    },
  ];

  const memory: MemoryNote[] = [
    {
      id: 'mem-1',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      text: 'Calm is the default theme on new devices; Warm paper stays available in Settings and Theme Studio.',
      sourceThread: 'Look PR: tokens and layers',
      createdAt: '12m ago',
      status: 'pending',
      localOnly: false,
    },
    {
      id: 'mem-2',
      laneId: 'research',
      laneName: 'Research',
      laneColor: 1,
      text: 'Prefer verbatim page-cited quotes for PROMIS MCID tables rather than paraphrased ranges.',
      sourceThread: 'Weekly PROMIS digest',
      createdAt: '52m ago',
      status: 'pending',
      localOnly: false,
    },
    {
      id: 'mem-3',
      laneId: 'lanes-build',
      laneName: 'Lanes build',
      laneColor: 3,
      text: 'Never use amber outside "Needs you" states; lanes previously saved as amber map to violet (--l-type-4).',
      sourceThread: 'Design tokens review',
      createdAt: '2d ago',
      status: 'approved',
      localOnly: false,
    },
    {
      id: 'mem-4',
      laneId: 'money',
      laneName: 'Money',
      laneColor: 4,
      text: 'Quarterly estimated tax reminders run two weeks ahead on local Qwen only.',
      sourceThread: 'Q3 recurring subscriptions',
      createdAt: '2d ago',
      status: 'approved',
      localOnly: true,
    },
  ];

  return {
    lanes,
    branches,
    assistantMessages: [
      {
        id: 'am-1',
        role: 'assistant',
        text: 'Good afternoon. You have 3 items waiting in Needs you, 1 branch running in Lanes build, and 1 branch ready to merge. Ask me anything across your non-private lanes or type @lane in Home to route directly.',
        timestamp: '10m ago',
        agentId: 'gemini',
        modelLabel: 'Gemini 4 Flash',
      },
    ],
    needs,
    bots,
    jobs,
    library,
    memory,
    services: [
      {
        id: 'srv-gemini',
        name: 'Gemini API proxy',
        endpoint: '/api/chat (server-side)',
        status: process.env.GEMINI_API_KEY ? 'healthy' : 'degraded',
        latencyMs: 142,
        detail: process.env.GEMINI_API_KEY
          ? 'Connected via server GEMINI_API_KEY (Gemini 4, Nano Banana 2.1, Omni 1.2 Flash, Live 3.8, Transcribe 3.5)'
          : 'GEMINI_API_KEY not set — select a key in Settings > Secrets',
      },
      {
        id: 'srv-lanes-api',
        name: 'Threads & Lanes API',
        endpoint: '/api/lanes · /api/branches · /api/needs',
        status: 'healthy',
        latencyMs: 6,
        detail: 'In-memory workspace store serving live threads, approvals, jobs, and memory',
      },
      {
        id: 'srv-qwen',
        name: 'Local Qwen endpoint',
        endpoint: '127.0.0.1:11434/v1',
        status: 'degraded',
        latencyMs: 0,
        detail: 'Local loopback daemon not attached in cloud container — private lane stub active',
      },
      {
        id: 'srv-catalog',
        name: 'Design Tokens & Terminal API',
        endpoint: '/api/tokens · /api/terminal/ws',
        status: 'healthy',
        latencyMs: 4,
        detail: '16 themes, 26 live shaders, and local Ghostty PTY bridge ready',
      },
    ],
  };
}

export class LanesStore {
  private state: WorkspaceState;

  constructor(initial?: WorkspaceState) {
    this.state = initial ?? createInitialWorkspaceState();
  }

  getState(): WorkspaceState {
    return this.state;
  }

  createLane(input: {
    name: string;
    purpose: string;
    color?: LaneColorIndex;
    icon?: Lane['icon'];
    isPrivate?: boolean;
    approvalMode?: ApprovalMode;
    instructions?: string;
  }): Lane {
    const slugBase =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'lane';
    let id = slugBase;
    let n = 2;
    while (this.state.lanes.some((l) => l.id === id)) {
      id = `${slugBase}-${n++}`;
    }
    const isPrivate = Boolean(input.isPrivate);
    const lane: Lane = {
      id,
      name: input.name.trim(),
      purpose: input.purpose.trim() || 'Focused workspace lane',
      color: input.color ?? 1,
      icon: input.icon ?? 'layers',
      isPrivate,
      pinned: false,
      unread: false,
      approvalMode: input.approvalMode ?? 'Safe-auto',
      defaultAgentId: isPrivate ? 'qwen' : 'claude',
      instructions: input.instructions?.trim() ?? '',
      messages: [],
      updatedAt: nowLabel(),
    };
    this.state.lanes.push(lane);
    return lane;
  }

  updateLane(
    laneId: string,
    patch: Partial<Pick<Lane, 'name' | 'purpose' | 'color' | 'icon' | 'isPrivate' | 'pinned' | 'unread' | 'approvalMode' | 'defaultAgentId' | 'instructions'>>
  ): Lane | null {
    const lane = this.state.lanes.find((l) => l.id === laneId);
    if (!lane) return null;
    if (patch.name !== undefined && patch.name.trim()) lane.name = patch.name.trim();
    if (patch.purpose !== undefined) lane.purpose = patch.purpose.trim();
    if (patch.color !== undefined) lane.color = patch.color;
    if (patch.icon !== undefined) lane.icon = patch.icon;
    if (patch.pinned !== undefined) lane.pinned = patch.pinned;
    if (patch.unread !== undefined) lane.unread = patch.unread;
    if (patch.approvalMode !== undefined) lane.approvalMode = patch.approvalMode;
    if (patch.instructions !== undefined) lane.instructions = patch.instructions;
    if (patch.isPrivate !== undefined) {
      lane.isPrivate = patch.isPrivate;
      if (lane.isPrivate) {
        lane.defaultAgentId = 'qwen';
        // Remove private lane from all bots and hide its files from shared library
        for (const bot of this.state.bots) {
          bot.allowedLaneIds = bot.allowedLaneIds.filter((id) => id !== lane.id);
        }
        for (const item of this.state.library) {
          if (item.laneId === lane.id) item.isPrivateLane = true;
        }
      } else {
        for (const item of this.state.library) {
          if (item.laneId === lane.id) item.isPrivateLane = false;
        }
      }
    }
    if (patch.defaultAgentId !== undefined) {
      lane.defaultAgentId = lane.isPrivate ? 'qwen' : patch.defaultAgentId;
    }
    lane.updatedAt = nowLabel();
    return lane;
  }

  appendLaneMessage(
    laneId: string,
    message: {
      role: 'user' | 'assistant';
      text: string;
      agentId?: AgentId;
      modelLabel?: string;
      branchId?: string;
      sources?: GroundingSource[];
    }
  ): Lane | null {
    const lane = this.state.lanes.find((l) => l.id === laneId);
    if (!lane) return null;
    lane.messages.push({
      id: makeId('msg'),
      role: message.role,
      text: message.text,
      timestamp: nowLabel(),
      agentId: message.agentId,
      modelLabel: message.modelLabel,
      branchId: message.branchId,
      sources: message.sources,
    });
    lane.updatedAt = nowLabel();
    return lane;
  }

  appendAssistantMessage(message: {
    role: 'user' | 'assistant';
    text: string;
    agentId?: AgentId;
    modelLabel?: string;
    sources?: GroundingSource[];
  }) {
    const entry = {
      id: makeId('amsg'),
      role: message.role,
      text: message.text,
      timestamp: nowLabel(),
      agentId: message.agentId,
      modelLabel: message.modelLabel,
      sources: message.sources,
    };
    this.state.assistantMessages.push(entry);
    return entry;
  }

  createBranch(input: {
    laneId: string;
    title: string;
    agentId: AgentId;
    prompt: string;
    askedByBot?: string;
  }): Branch | null {
    const lane = this.state.lanes.find((l) => l.id === input.laneId);
    if (!lane) return null;
    const effectiveAgent: AgentId = lane.isPrivate ? 'qwen' : input.agentId;
    const slug =
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 28) || 'task';

    const branch: Branch = {
      id: makeId('br'),
      laneId: lane.id,
      title: input.title.trim(),
      gitBranch: `${lane.id}/${slug}`,
      agentId: effectiveAgent,
      askedByBot: input.askedByBot,
      status: 'working',
      age: nowLabel(),
      currentStep: 'Planning steps and checking lane files',
      checklist: [
        { id: makeId('chk'), label: 'Read lane instructions and context', done: true },
        { id: makeId('chk'), label: `Draft solution for "${input.title.trim()}"`, done: false },
        { id: makeId('chk'), label: 'Verify checks before resolving', done: false },
      ],
      files: [],
      messages: [
        {
          id: makeId('bm'),
          role: 'user',
          text: input.prompt,
          timestamp: nowLabel(),
        },
        {
          id: makeId('bm'),
          role: 'assistant',
          text: `Started branch ${lane.id}/${slug}. Working on this in isolation from the main thread.`,
          timestamp: nowLabel(),
          agentId: effectiveAgent,
        },
      ],
    };
    this.state.branches.unshift(branch);
    return branch;
  }

  appendBranchMessage(
    branchId: string,
    message: { role: 'user' | 'assistant'; text: string; agentId?: AgentId; modelLabel?: string }
  ): Branch | null {
    const branch = this.state.branches.find((b) => b.id === branchId);
    if (!branch) return null;
    branch.messages.push({
      id: makeId('bm'),
      role: message.role,
      text: message.text,
      timestamp: nowLabel(),
      agentId: message.agentId,
      modelLabel: message.modelLabel,
    });
    return branch;
  }

  /** Puts a finished worker back in progress. Merged workers stay finished. */
  reopenBranch(branchId: string): Branch | null {
    const branch = this.state.branches.find((b) => b.id === branchId);
    if (!branch) return null;
    if (branch.status === 'done' && !branch.merged) {
      branch.status = 'working';
    }
    return branch;
  }

  resolveBranchApproval(branchId: string, decision: 'approved' | 'declined'): Branch | null {
    const branch = this.state.branches.find((b) => b.id === branchId);
    if (!branch || !branch.approval) return null;
    branch.approval.status = decision;
    if (decision === 'approved') {
      branch.status = 'done';
      branch.currentStep = undefined;
      branch.summary = `Approved and ran: ${branch.approval.command}`;
      branch.checkedBy = 'Approved by you';
      branch.checklist = branch.checklist.map((c) => ({ ...c, done: true }));
      // Draft a memory note when a branch finishes
      const lane = this.state.lanes.find((l) => l.id === branch.laneId);
      if (lane) {
        this.state.memory.unshift({
          id: makeId('mem'),
          laneId: lane.id,
          laneName: lane.name,
          laneColor: lane.color,
          text: `Approved "${branch.approval.command}" on ${branch.title}.`,
          sourceThread: branch.title,
          createdAt: nowLabel(),
          status: 'pending',
          localOnly: lane.isPrivate,
        });
      }
    } else {
      branch.status = 'idle';
      branch.currentStep = 'Action declined';
    }
    for (const need of this.state.needs) {
      if (need.branchId === branchId && need.kind === 'approval') {
        need.resolved = true;
        need.resolutionNote = decision === 'approved' ? 'Approved' : 'Declined';
      }
    }
    return branch;
  }

  resolveBranchDecision(branchId: string, choiceKey: string): Branch | null {
    const branch = this.state.branches.find((b) => b.id === branchId);
    if (!branch || !branch.decision) return null;
    const choice = branch.decision.choices.find((c) => c.key === choiceKey);
    if (!choice) return null;
    branch.decision.pickedKey = choice.key;
    branch.status = 'done';
    branch.currentStep = undefined;
    branch.summary = `Completed with choice ${choice.key} (${choice.label}).`;
    branch.checkedBy = 'Verified citations against source pages';
    branch.checklist = branch.checklist.map((c) => ({ ...c, done: true }));
    branch.messages.push({
      id: makeId('bm'),
      role: 'user',
      text: `${choice.key} · ${choice.label}`,
      timestamp: nowLabel(),
    });
    branch.messages.push({
      id: makeId('bm'),
      role: 'assistant',
      text: `Got it — formatted using ${choice.label} and marked the branch ready.`,
      timestamp: nowLabel(),
      agentId: branch.agentId,
    });
    for (const need of this.state.needs) {
      if (need.branchId === branchId && need.kind === 'decision') {
        need.resolved = true;
        need.resolutionNote = `Picked ${choice.key} · ${choice.label}`;
      }
    }
    return branch;
  }

  mergeBranch(branchId: string): Branch | null {
    const branch = this.state.branches.find((b) => b.id === branchId);
    if (!branch) return null;
    branch.merged = true;
    branch.status = 'done';
    return branch;
  }

  addCaptureNeed(ask: string): NeedsItem {
    const item: NeedsItem = {
      id: makeId('need'),
      kind: 'capture',
      ask: ask.trim(),
      laneName: 'Inbox',
      laneColor: 1,
      sourceTitle: 'Captured for later',
      age: nowLabel(),
      resolved: false,
    };
    this.state.needs.unshift(item);
    return item;
  }

  resolveNeed(needId: string, note = 'Done'): NeedsItem | null {
    const need = this.state.needs.find((n) => n.id === needId);
    if (!need) return null;
    need.resolved = true;
    need.resolutionNote = note;
    if (need.kind === 'service') {
      // Fix the service this request is about (older requests without a link meant Qwen).
      const service = this.state.services.find((s) => s.id === (need.serviceId ?? 'srv-qwen'));
      if (service) {
        service.status = 'healthy';
        service.latencyMs = 19;
        service.detail = 'Restarted and responding on loopback';
      }
    }
    return need;
  }

  toggleBotLane(botId: string, laneId: string): Bot | null {
    const bot = this.state.bots.find((b) => b.id === botId);
    const lane = this.state.lanes.find((l) => l.id === laneId);
    if (!bot || !lane || lane.isPrivate) return null;
    if (bot.allowedLaneIds.includes(laneId)) {
      bot.allowedLaneIds = bot.allowedLaneIds.filter((id) => id !== laneId);
    } else {
      bot.allowedLaneIds = [...bot.allowedLaneIds, laneId];
    }
    return bot;
  }

  handleBotSuggestion(
    botId: string,
    suggestionId: string,
    action: 'start' | 'dismiss'
  ): { bot: Bot; branch?: Branch } | null {
    const bot = this.state.bots.find((b) => b.id === botId);
    if (!bot) return null;
    const suggestion = bot.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return null;
    if (action === 'dismiss') {
      suggestion.status = 'dismissed';
      return { bot };
    }
    if (!bot.allowedLaneIds.includes(suggestion.laneId)) {
      return null;
    }
    suggestion.status = 'started';
    const branch = this.createBranch({
      laneId: suggestion.laneId,
      title: suggestion.title,
      agentId: bot.agentId,
      prompt: `${suggestion.title}. ${suggestion.rationale}`,
      askedByBot: bot.name,
    });
    return { bot, branch: branch ?? undefined };
  }

  createJob(input: {
    name: string;
    laneId: string;
    cadence: string;
    prompt: string;
    onlyReportChanges: boolean;
  }): ScheduledJob | null {
    const lane = this.state.lanes.find((l) => l.id === input.laneId);
    if (!lane) return null;
    const job: ScheduledJob = {
      id: makeId('job'),
      name: input.name.trim(),
      laneId: lane.id,
      laneName: lane.name,
      cadence: input.cadence.trim() || 'Daily at 08:00',
      nextRun: 'Tomorrow 08:00',
      status: 'active',
      onlyReportChanges: input.onlyReportChanges,
      prompt: input.prompt.trim(),
      lastSummary: 'Scheduled — no runs yet.',
      history: [],
    };
    this.state.jobs.unshift(job);
    return job;
  }

  updateJob(
    jobId: string,
    action: 'toggle' | 'run'
  ): ScheduledJob | null {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    if (action === 'toggle') {
      job.status = job.status === 'active' ? 'paused' : 'active';
      job.nextRun = job.status === 'active' ? 'Tomorrow 08:00' : 'Paused';
    } else if (action === 'run') {
      job.history = [...job.history.slice(-6), 'ok'];
      job.lastSummary = `Manual run completed (${nowLabel()}).`;
    }
    return job;
  }

  addLibraryItem(input: {
    name: string;
    laneId: string;
    kind: LibraryItem['kind'];
    preview: string;
  }): LibraryItem | null {
    const lane = this.state.lanes.find((l) => l.id === input.laneId);
    if (!lane) return null;
    const item: LibraryItem = {
      id: makeId('lib'),
      name: input.name.trim(),
      laneId: lane.id,
      laneName: lane.name,
      laneColor: lane.color,
      kind: input.kind,
      size: `${Math.max(1, Math.ceil(input.preview.length / 80))} KB`,
      updatedAt: nowLabel(),
      origin: 'Uploaded by you',
      preview: input.preview.trim() || 'Added to lane files.',
      isPrivateLane: lane.isPrivate,
    };
    this.state.library.unshift(item);
    return item;
  }

  updateMemoryNote(noteId: string, status: 'approved' | 'dismissed'): MemoryNote | null {
    const note = this.state.memory.find((m) => m.id === noteId);
    if (!note) return null;
    note.status = status;
    return note;
  }

  addMemoryNote(input: { laneId: string; text: string }): MemoryNote | null {
    const lane = this.state.lanes.find((l) => l.id === input.laneId);
    if (!lane) return null;
    const note: MemoryNote = {
      id: makeId('mem'),
      laneId: lane.id,
      laneName: lane.name,
      laneColor: lane.color,
      text: input.text.trim(),
      sourceThread: 'Added manually',
      createdAt: nowLabel(),
      status: 'approved',
      localOnly: lane.isPrivate,
    };
    this.state.memory.unshift(note);
    return note;
  }
}
