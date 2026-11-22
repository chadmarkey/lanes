export type ThemeId =
  | 'midcentury-light'
  | 'midcentury-dark'
  | 'xp-light'
  | 'xp-dark'
  | 'win98-light'
  | 'win98-dark'
  | 'terminal-dark'
  | 'terminal-light'
  | 'calm-light'
  | 'calm-dark'
  | 'light'
  | 'dark'
  | 'midnight-light'
  | 'midnight-dark'
  | 'contrast-light'
  | 'contrast-dark';

export type AgentId = 'claude' | 'codex' | 'antigravity' | 'qwen' | 'gemini';
export type GeminiModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-4-neon'
  | 'gemini-4-carbon'
  | 'gemini-3.1-flash-lite';
export type ThreadStatus = 'working' | 'needs' | 'done' | 'failed' | 'idle';
export type ComposerMode = 'Build' | 'Plan' | 'Ask';
export type ComposerOutput = 'Reply here' | 'Branch' | 'Page';
export type ApprovalMode = 'Ask' | 'Safe-auto' | 'Full';
export type LaneColorIndex = 1 | 2 | 3 | 4 | 5;
export type MediaStudioTab = 'images' | 'video' | 'music' | 'voice' | 'transcribe';
export type StudioTab = 'appearance' | 'terminal' | 'tokens';
export type LyriaModelId = 'lyria-3-clip-preview' | 'lyria-3-pro-preview';

export type PlaceId =
  | 'home'
  | 'assistant'
  | 'lanes'
  | 'bots'
  | 'needs'
  | 'scheduled'
  | 'library'
  | 'memory'
  | 'media'
  | 'spatial'
  | 'studio'
  | 'settings';

export type BreadcrumbTarget =
  | { kind: 'home' }
  | { kind: 'place'; place: PlaceId }
  | { kind: 'lane'; laneId: string }
  | { kind: 'branch'; laneId: string; branchId: string }
  | { kind: 'bot'; botId: string }
  | { kind: 'media-tab'; tab: MediaStudioTab }
  | { kind: 'studio-tab'; tab: StudioTab };

export interface BreadcrumbItem {
  id: string;
  label: string;
  target: BreadcrumbTarget;
  laneColor?: LaneColorIndex;
  current: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AgentDef {
  id: AgentId;
  label: string;
  modelName: string;
  effort: 'low' | 'medium' | 'high';
  localOnly: boolean;
}

export interface GeminiModelDef {
  id: GeminiModelId;
  label: string;
  shortLabel: string;
  tier: string;
  description: string;
}

export interface ToolStepItem {
  id: string;
  label: string;
  detail: string;
  durationSec: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  agentId?: AgentId;
  modelLabel?: string;
  steps?: ToolStepItem[];
  branchId?: string;
  sources?: GroundingSource[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface DiffFile {
  path: string;
  adds: number;
  dels: number;
  patch: string;
}

export interface BranchApproval {
  id: string;
  ask: string;
  command: string;
  allowedRule: string;
  status: 'pending' | 'approved' | 'declined';
}

export interface BranchDecision {
  id: string;
  question: string;
  choices: { key: string; label: string; note: string }[];
  pickedKey?: string;
}

export interface Branch {
  id: string;
  laneId: string;
  title: string;
  gitBranch: string;
  agentId: AgentId;
  askedByBot?: string;
  status: ThreadStatus;
  age: string;
  currentStep?: string;
  summary?: string;
  checkedBy?: string;
  merged?: boolean;
  checklist: ChecklistItem[];
  files: DiffFile[];
  approval?: BranchApproval;
  decision?: BranchDecision;
  messages: ChatMessage[];
}

export interface Lane {
  id: string;
  name: string;
  purpose: string;
  color: LaneColorIndex;
  icon: 'layers' | 'flask' | 'pen' | 'wallet' | 'code' | 'compass';
  isPrivate: boolean;
  pinned: boolean;
  unread: boolean;
  approvalMode: ApprovalMode;
  defaultAgentId: AgentId;
  instructions: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface NeedsItem {
  id: string;
  kind: 'approval' | 'decision' | 'service' | 'capture';
  ask: string;
  laneId?: string;
  laneName: string;
  laneColor: LaneColorIndex;
  agentId?: AgentId;
  branchId?: string;
  /** For kind 'service': the service this request is about, so Home doesn't repeat it. */
  serviceId?: string;
  sourceTitle: string;
  age: string;
  wants?: string;
  allowed?: string;
  choices?: { key: string; label: string }[];
  resolved?: boolean;
  resolutionNote?: string;
}

export interface BotSuggestion {
  id: string;
  botId: string;
  laneId: string;
  laneName: string;
  title: string;
  rationale: string;
  status: 'pending' | 'started' | 'dismissed';
}

export interface Bot {
  id: string;
  name: string;
  job: string;
  agentId: AgentId;
  allowedLaneIds: string[];
  morningSuggestions: boolean;
  messages: ChatMessage[];
  suggestions: BotSuggestion[];
}

export interface ScheduledJob {
  id: string;
  name: string;
  laneId: string;
  laneName: string;
  cadence: string;
  nextRun: string;
  status: 'active' | 'paused' | 'completed';
  onlyReportChanges: boolean;
  prompt: string;
  lastSummary: string;
  history: ('ok' | 'noop' | 'failed')[];
}

export interface LibraryItem {
  id: string;
  name: string;
  laneId: string;
  laneName: string;
  laneColor: LaneColorIndex;
  kind: 'doc' | 'code' | 'image' | 'pdf';
  size: string;
  updatedAt: string;
  origin: string;
  preview: string;
  isPrivateLane: boolean;
}

export interface MemoryNote {
  id: string;
  laneId: string;
  laneName: string;
  laneColor: LaneColorIndex;
  text: string;
  sourceThread: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'dismissed';
  localOnly: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  detail: string;
}

export interface WorkspaceState {
  lanes: Lane[];
  branches: Branch[];
  assistantMessages: ChatMessage[];
  needs: NeedsItem[];
  bots: Bot[];
  jobs: ScheduledJob[];
  library: LibraryItem[];
  memory: MemoryNote[];
  services: ServiceItem[];
}

export interface DesignPartSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  previewUrl: string;
  readme: string;
}

export interface KitCatalogItem {
  id: number;
  name: string;
  group: string;
  route: string;
  kit_section: string;
  kit_page_file: string;
  kit_files: string[];
  lanes_files: string[];
  lanes_users: string[];
  lanes_parts_from_it: string[];
  good_for: string;
  fits_lanes: string;
  layout_desktop: string;
  layout_phone: string;
  shots: {
    'desktop-light'?: string;
    'desktop-dark'?: string;
    'phone-light'?: string;
  };
  note: string | null;
}

export interface TokenEntry {
  name: string;
  value: Record<string, string>;
  usage: string;
}

export interface TokensDocument {
  name: string;
  version: number;
  color: {
    themes: { id: ThemeId; name: string }[];
    tokens: TokenEntry[];
  };
}

export interface DocEntry {
  slug: string;
  title: string;
  subtitle: string;
  relPath: string;
  content?: string;
}
