import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  LoaderCircle,
  Lock,
  Pencil,
  Plug,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { WORKSPACE_PLUGINS } from '../lib/plugins';
import type { AgentId, Bot, Branch, Lane } from '../lib/types';
import { AGENTS, getAgent } from '../lib/workbench';
import { AccessibleDialog, useTwoStepConfirm } from './AccessiblePrimitives';
import { AgentGlyph, EmptyState, LaneTile, StatusMark } from './Marks';

export interface CreateBotPayload {
  name: string;
  job: string;
  agentId: AgentId;
  instructions: string;
  allowedLaneIds: string[];
  enabledPlugins: string[];
  morningSuggestions: boolean;
}

interface BotsViewProps {
  bots: Bot[];
  activeBotId: string | null;
  lanes: Lane[];
  branches: Branch[];
  isActionPending: (key: string) => boolean;
  openCreateTick?: number;
  onSelectBot: (botId: string) => void;
  onCreateBot: (payload: CreateBotPayload) => Promise<boolean | void>;
  onUpdateBot: (
    botId: string,
    patch: Partial<Pick<Bot, 'name' | 'job' | 'agentId' | 'instructions' | 'morningSuggestions' | 'enabledPlugins'>>
  ) => Promise<boolean | void>;
  onDeleteBot: (botId: string) => Promise<boolean | void>;
  onToggleBotLane: (botId: string, laneId: string) => Promise<boolean | void>;
  onToggleBotPlugin: (botId: string, pluginId: string) => Promise<boolean | void>;
  onHandleSuggestion: (botId: string, sugId: string, action: 'start' | 'dismiss') => Promise<boolean | void>;
  onOpenLane: (laneId: string, branchId?: string) => void;
}

export function BotsView({
  bots,
  activeBotId,
  lanes,
  branches,
  isActionPending,
  openCreateTick = 0,
  onSelectBot,
  onCreateBot,
  onUpdateBot,
  onDeleteBot,
  onToggleBotLane,
  onToggleBotPlugin,
  onHandleSuggestion,
  onOpenLane,
}: BotsViewProps) {
  const selectedBot = bots.find((b) => b.id === activeBotId) ?? bots[0] ?? null;
  const nonPrivateLanes = lanes.filter((l) => !l.isPrivate);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { armedKey, trigger, disarm } = useTwoStepConfirm();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newJob, setNewJob] = useState('');
  const [newAgent, setNewAgent] = useState<AgentId>('claude');
  const [newInstructions, setNewInstructions] = useState('');
  const [newAllowedLanes, setNewAllowedLanes] = useState<string[]>([]);
  const [newPlugins, setNewPlugins] = useState<string[]>(['file-manager', 'memory-sync']);
  const [newMorning, setNewMorning] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editAgent, setEditAgent] = useState<AgentId>('claude');
  const [editInstructions, setEditInstructions] = useState('');
  const [editMorning, setEditMorning] = useState(true);

  useEffect(() => {
    if (openCreateTick > 0) {
      setCreateOpen(true);
    }
  }, [openCreateTick]);

  useEffect(() => {
    if (selectedBot && editOpen) {
      setEditName(selectedBot.name);
      setEditJob(selectedBot.job);
      setEditAgent(selectedBot.agentId);
      setEditInstructions(selectedBot.instructions ?? '');
      setEditMorning(selectedBot.morningSuggestions);
    }
  }, [selectedBot, editOpen]);

  const creating = isActionPending('create-bot');
  const savingEdit = Boolean(selectedBot && isActionPending(`bot-update:${selectedBot.id}`));
  const deletingBot = Boolean(selectedBot && isActionPending(`bot-delete:${selectedBot.id}`));

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    const ok = await onCreateBot({
      name: newName.trim(),
      job: newJob.trim() || 'Specialist background worker',
      agentId: newAgent,
      instructions: newInstructions.trim(),
      allowedLaneIds: newAllowedLanes,
      enabledPlugins: newPlugins,
      morningSuggestions: newMorning,
    });
    if (ok !== false) {
      setNewName('');
      setNewJob('');
      setNewInstructions('');
      setNewAllowedLanes([]);
      setNewPlugins(['file-manager', 'memory-sync']);
      setNewMorning(true);
      setCreateOpen(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBot || !editName.trim() || savingEdit) return;
    const ok = await onUpdateBot(selectedBot.id, {
      name: editName.trim(),
      job: editJob.trim(),
      agentId: editAgent,
      instructions: editInstructions.trim(),
      morningSuggestions: editMorning,
    });
    if (ok !== false) {
      setEditOpen(false);
    }
  }

  const agent = selectedBot ? getAgent(selectedBot.agentId) : null;
  const botBranches = selectedBot ? branches.filter((b) => b.askedByBot === selectedBot.name) : [];
  const pendingSuggestions = selectedBot
    ? selectedBot.suggestions.filter((s) => s.status === 'pending')
    : [];
  const botPlugins = selectedBot?.enabledPlugins ?? ['file-manager', 'memory-sync'];
  const deleteArmed = Boolean(selectedBot && armedKey === `delete-bot:${selectedBot.id}`);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-8">
      <header className="lanes-text-surface mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
            style={{ color: 'var(--l-text)' }}
          >
            Bots
          </h1>
          <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
            Create and manage specialist agents, control which lanes they can read, and enable plugins per bot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
        >
          <Plus size={14} />
          <span>New bot</span>
        </button>
      </header>

      {!selectedBot ? (
        <EmptyState
          title="No bots configured"
          detail="Click New bot to create a specialist agent with its own lanes and plugins."
        />
      ) : (
        <>
          {/* Bot switcher bar */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {bots.map((bot) => {
              const active = bot.id === selectedBot.id;
              const pendingCount = bot.suggestions.filter((s) => s.status === 'pending').length;
              return (
                <button
                  key={bot.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectBot(bot.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                  style={{
                    backgroundColor: active ? 'var(--l-selected)' : 'var(--l-panel)',
                    borderColor: active ? 'var(--l-accent)' : 'var(--l-line)',
                    color: 'var(--l-text)',
                  }}
                >
                  <AgentGlyph agentId={bot.agentId} size="xs" />
                  <span>{bot.name}</span>
                  {pendingCount > 0 && (
                    <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-accent)' }}>
                      · {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected bot overview */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Job summary + Edit / Delete actions */}
              <section
                className="rounded-[12px] border p-5"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AgentGlyph agentId={selectedBot.agentId} size="md" />
                    <div>
                      <h2 className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
                        {selectedBot.name}
                      </h2>
                      <p className="m-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                        Runs on {agent?.modelName} · {selectedBot.allowedLaneIds.length}{' '}
                        {selectedBot.allowedLaneIds.length === 1 ? 'lane' : 'lanes'} · {botPlugins.length}{' '}
                        {botPlugins.length === 1 ? 'plugin' : 'plugins'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                      style={{
                        backgroundColor: 'var(--l-raised)',
                        borderColor: 'var(--l-line-strong)',
                        color: 'var(--l-text)',
                      }}
                    >
                      <Pencil size={12} />
                      <span>Edit bot</span>
                    </button>
                    {deleteArmed && !deletingBot && (
                      <button
                        type="button"
                        onClick={disarm}
                        className="h-8 rounded-[8px] border px-2.5 text-[12px] font-medium hover:bg-[var(--l-hover)]"
                        style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingBot}
                      onClick={() =>
                        trigger(`delete-bot:${selectedBot.id}`, () => onDeleteBot(selectedBot.id))
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: deleteArmed ? 'var(--l-bad)' : 'var(--l-raised)',
                        borderColor: deleteArmed ? 'var(--l-bad)' : 'var(--l-line)',
                        color: deleteArmed ? 'var(--l-on-bad)' : 'var(--l-muted)',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>{deletingBot ? 'Deleting…' : deleteArmed ? 'Confirm delete' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
                <p className="mt-3 mb-0 text-[14px] leading-[1.55]" style={{ color: 'var(--l-text)' }}>
                  {selectedBot.job}
                </p>
                {selectedBot.instructions && (
                  <div
                    className="mt-3 rounded-[9px] border px-3 py-2 font-mono text-[12px] leading-relaxed"
                    style={{
                      backgroundColor: 'var(--l-bg)',
                      borderColor: 'var(--l-line)',
                      color: 'var(--l-muted)',
                    }}
                  >
                    {selectedBot.instructions}
                  </div>
                )}
              </section>

              {/* Morning suggestions */}
              <section aria-labelledby="bot-suggestions-heading">
                <h2
                  id="bot-suggestions-heading"
                  className="mb-2.5 text-[15px] font-semibold"
                  style={{ color: 'var(--l-text)' }}
                >
                  Morning suggestions{' '}
                  <span className="ml-1 text-[13px] font-normal tabular-nums" style={{ color: 'var(--l-muted)' }}>
                    {pendingSuggestions.length} open
                  </span>
                </h2>
                {selectedBot.suggestions.length === 0 ? (
                  <EmptyState
                    title="No suggestions today"
                    detail={`${selectedBot.name} posts short proposals here when a lane has fresh work.`}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {selectedBot.suggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="rounded-[12px] border p-4"
                        style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="m-0 text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                              {sug.title}
                            </p>
                            <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                              {sug.laneName} · {sug.rationale}
                            </p>
                          </div>
                          {sug.status !== 'pending' && (
                            <span className="shrink-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                              {sug.status === 'started' ? 'Started' : 'Dismissed'}
                            </span>
                          )}
                        </div>
                        {sug.status === 'pending' && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isActionPending(`bot-sug:${sug.id}`)}
                              onClick={() => void onHandleSuggestion(selectedBot.id, sug.id, 'start')}
                              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
                              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                            >
                              {isActionPending(`bot-sug:${sug.id}`) ? (
                                <LoaderCircle size={13} className="lanes-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>{isActionPending(`bot-sug:${sug.id}`) ? 'Starting…' : 'Start it'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isActionPending(`bot-sug:${sug.id}`)}
                              onClick={() => void onHandleSuggestion(selectedBot.id, sug.id, 'dismiss')}
                              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--l-raised)',
                                borderColor: 'var(--l-line-strong)',
                                color: 'var(--l-text)',
                              }}
                            >
                              <X size={13} />
                              <span>Not now</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Branches asked by this bot */}
              <section aria-labelledby="bot-branches-heading">
                <h2
                  id="bot-branches-heading"
                  className="mb-2.5 text-[15px] font-semibold"
                  style={{ color: 'var(--l-text)' }}
                >
                  Branches from {selectedBot.name}
                </h2>
                {botBranches.length === 0 ? (
                  <p className="m-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                    No branches opened by {selectedBot.name} yet.
                  </p>
                ) : (
                  <div
                    className="divide-y rounded-[12px] border"
                    style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
                  >
                    {botBranches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => onOpenLane(branch.laneId, branch.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                        style={{ borderColor: 'var(--l-line)' }}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <StatusMark status={branch.status} />
                          <div className="min-w-0">
                            <p className="m-0 truncate text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                              {branch.title}
                            </p>
                            <p className="m-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                              {branch.gitBranch} · {branch.age}
                            </p>
                          </div>
                        </div>
                        <ArrowRight size={14} style={{ color: 'var(--l-muted)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right column: Lane access switches + Per-bot Plugins + Latest note */}
            <div className="space-y-6">
              <section
                className="rounded-[12px] border p-4"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  Allowed lanes
                </h2>
                <p className="mt-1 mb-3 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  Private local-only lanes cannot be assigned to bots.
                </p>
                <div className="space-y-2">
                  {lanes.map((lane) => {
                    const enabled = selectedBot.allowedLaneIds.includes(lane.id);
                    return (
                      <label
                        key={lane.id}
                        className={`flex items-center justify-between gap-2.5 rounded-[9px] border px-3 py-2 ${
                          lane.isPrivate ? 'opacity-65' : 'cursor-pointer hover:bg-[var(--l-hover)]'
                        }`}
                        style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                          <span className="truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                            {lane.name}
                          </span>
                        </span>
                        {lane.isPrivate ? (
                          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                            <Lock size={12} />
                            <span>Locked</span>
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={isActionPending(`bot-lane:${selectedBot.id}:${lane.id}`)}
                            onChange={() => void onToggleBotLane(selectedBot.id, lane.id)}
                            aria-label={`Allow ${selectedBot.name} in ${lane.name}`}
                            className="h-4 w-4 accent-[var(--l-accent)] disabled:opacity-50"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* Per-bot plugins */}
              <section
                className="rounded-[12px] border p-4"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Plug size={14} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
                    <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                      Plugins for {selectedBot.name}
                    </h2>
                  </div>
                  <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                    {botPlugins.length}/{WORKSPACE_PLUGINS.length}
                  </span>
                </div>
                <p className="mt-1 mb-3 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  Toggle which tools and connectors this bot can invoke.
                </p>
                <div className="space-y-2">
                  {WORKSPACE_PLUGINS.map((plugin) => {
                    const enabled = botPlugins.includes(plugin.id);
                    const busy = isActionPending(`bot-plugin:${selectedBot.id}:${plugin.id}`);
                    return (
                      <label
                        key={plugin.id}
                        className="flex cursor-pointer items-start justify-between gap-2.5 rounded-[9px] border px-3 py-2 hover:bg-[var(--l-hover)]"
                        style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                            {plugin.name}
                          </span>
                          <span className="block text-[12px] leading-snug" style={{ color: 'var(--l-muted)' }}>
                            {plugin.description}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={busy}
                          onChange={() => void onToggleBotPlugin(selectedBot.id, plugin.id)}
                          aria-label={`Enable ${plugin.name} for ${selectedBot.name}`}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--l-accent)] disabled:opacity-50"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>

              <section
                className="rounded-[12px] border p-4"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <h2 className="m-0 mb-3 text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  Latest note
                </h2>
                <div className="space-y-3">
                  {selectedBot.messages.map((m) => (
                    <div key={m.id}>
                      <p className="m-0 text-[13px] leading-[1.5]" style={{ color: 'var(--l-text)' }}>
                        {m.text}
                      </p>
                      <p className="mt-1 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {m.timestamp}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {/* Create New Bot Modal */}
      <AccessibleDialog open={createOpen} onClose={() => setCreateOpen(false)} ariaLabelledBy="new-bot-title">
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="max-h-[88vh] w-[min(540px,calc(100vw-2rem))] overflow-y-auto rounded-[14px] border p-5"
          style={{
            backgroundColor: 'var(--l-raised)',
            borderColor: 'var(--l-line)',
            boxShadow: 'var(--l-shadow-menu)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="new-bot-title" className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
              New bot
            </h2>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              aria-label="Close new bot dialog"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
              style={{ color: 'var(--l-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-bot-name" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Bot name
                </label>
                <input
                  id="new-bot-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Example: Code Reviewer"
                  className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>
              <div>
                <label htmlFor="new-bot-agent" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Model / agent
                </label>
                <select
                  id="new-bot-agent"
                  value={newAgent}
                  onChange={(e) => setNewAgent(e.target.value as AgentId)}
                  className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                >
                  {AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} ({a.modelName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="new-bot-job" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Role &amp; focus
              </label>
              <input
                id="new-bot-job"
                type="text"
                value={newJob}
                onChange={(e) => setNewJob(e.target.value)}
                placeholder="What this specialist watches and proposes"
                className="h-9 w-full rounded-[8px] border px-3 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              />
            </div>

            <div>
              <label htmlFor="new-bot-instructions" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Bot instructions
              </label>
              <textarea
                id="new-bot-instructions"
                rows={3}
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Style rules, safety boundaries, or checklist steps…"
                className="w-full rounded-[8px] border p-2.5 font-mono text-[12px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              />
            </div>

            {nonPrivateLanes.length > 0 && (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Allowed lanes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {nonPrivateLanes.map((lane) => {
                    const checked = newAllowedLanes.includes(lane.id);
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          setNewAllowedLanes((prev) =>
                            prev.includes(lane.id) ? prev.filter((id) => id !== lane.id) : [...prev, lane.id]
                          )
                        }
                        className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium"
                        style={{
                          backgroundColor: checked ? 'var(--l-selected)' : 'var(--l-bg)',
                          borderColor: checked ? 'var(--l-accent)' : 'var(--l-line)',
                          color: 'var(--l-text)',
                        }}
                      >
                        <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                        <span>{lane.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Plugins enabled for this bot
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_PLUGINS.map((plugin) => {
                  const checked = newPlugins.includes(plugin.id);
                  return (
                    <button
                      key={plugin.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() =>
                        setNewPlugins((prev) =>
                          prev.includes(plugin.id)
                            ? prev.filter((id) => id !== plugin.id)
                            : [...prev, plugin.id]
                        )
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-[7px] border px-2.5 text-[12px] font-medium"
                      style={{
                        backgroundColor: checked ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: checked ? 'var(--l-accent)' : 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      {checked && <Check size={11} style={{ color: 'var(--l-accent)' }} />}
                      <span>{plugin.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: 'var(--l-text)' }}>
              <input
                type="checkbox"
                checked={newMorning}
                onChange={(e) => setNewMorning(e.target.checked)}
                className="h-4 w-4 accent-[var(--l-accent)]"
              />
              <span>Propose morning branch suggestions</span>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded-[8px] border px-3 text-[13px] font-medium hover:bg-[var(--l-hover)]"
              style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium disabled:opacity-45"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {creating ? <LoaderCircle size={13} className="lanes-spin" /> : <Plus size={13} />}
              <span>{creating ? 'Creating…' : 'Create bot'}</span>
            </button>
          </div>
        </form>
      </AccessibleDialog>

      {/* Edit Bot Modal */}
      {selectedBot && (
        <AccessibleDialog open={editOpen} onClose={() => setEditOpen(false)} ariaLabelledBy="edit-bot-title">
          <form
            onSubmit={(e) => void handleEditSubmit(e)}
            className="w-[min(480px,calc(100vw-2rem))] rounded-[14px] border p-5"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line)',
              boxShadow: 'var(--l-shadow-menu)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="edit-bot-title" className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Edit {selectedBot.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit bot dialog"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label htmlFor="edit-bot-name" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Name
                </label>
                <input
                  id="edit-bot-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>
              <div>
                <label htmlFor="edit-bot-agent" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Model / agent
                </label>
                <select
                  id="edit-bot-agent"
                  value={editAgent}
                  onChange={(e) => setEditAgent(e.target.value as AgentId)}
                  className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                >
                  {AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} ({a.modelName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-bot-job" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Role &amp; focus
                </label>
                <input
                  id="edit-bot-job"
                  type="text"
                  value={editJob}
                  onChange={(e) => setEditJob(e.target.value)}
                  className="h-9 w-full rounded-[8px] border px-3 text-[13px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>
              <div>
                <label htmlFor="edit-bot-inst" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Bot instructions
                </label>
                <textarea
                  id="edit-bot-inst"
                  rows={4}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="w-full rounded-[8px] border p-2.5 font-mono text-[12px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: 'var(--l-text)' }}>
                <input
                  type="checkbox"
                  checked={editMorning}
                  onChange={(e) => setEditMorning(e.target.checked)}
                  className="h-4 w-4 accent-[var(--l-accent)]"
                />
                <span>Propose morning branch suggestions</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit || !editName.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium disabled:opacity-45"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                {savingEdit && <LoaderCircle size={13} className="lanes-spin" />}
                <span>{savingEdit ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
}
