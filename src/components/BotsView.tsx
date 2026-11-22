import { ArrowRight, Check, LoaderCircle, Lock, X } from 'lucide-react';
import type { Bot, Branch, Lane } from '../lib/types';
import { getAgent } from '../lib/workbench';
import { AgentGlyph, EmptyState, LaneTile, StatusMark } from './Marks';

interface BotsViewProps {
  bots: Bot[];
  activeBotId: string | null;
  lanes: Lane[];
  branches: Branch[];
  isActionPending: (key: string) => boolean;
  onSelectBot: (botId: string) => void;
  onToggleBotLane: (botId: string, laneId: string) => Promise<boolean | void>;
  onHandleSuggestion: (botId: string, sugId: string, action: 'start' | 'dismiss') => Promise<boolean | void>;
  onOpenLane: (laneId: string, branchId?: string) => void;
}

export function BotsView({
  bots,
  activeBotId,
  lanes,
  branches,
  isActionPending,
  onSelectBot,
  onToggleBotLane,
  onHandleSuggestion,
  onOpenLane,
}: BotsViewProps) {
  const selectedBot = bots.find((b) => b.id === activeBotId) ?? bots[0] ?? null;

  if (!selectedBot) {
    return (
      <div className="mx-auto max-w-[860px] p-8">
        <EmptyState title="No bots configured" detail="Specialist bots appear here once created." />
      </div>
    );
  }

  const agent = getAgent(selectedBot.agentId);
  const botBranches = branches.filter((b) => b.askedByBot === selectedBot.name);
  const pendingSuggestions = selectedBot.suggestions.filter((s) => s.status === 'pending');

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1
          className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
          style={{ color: 'var(--l-text)' }}
        >
          Bots
        </h1>
        <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
          Specialist workers that read only the lanes you toggle on and propose morning branches for approval.
        </p>
      </header>

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
          {/* Job summary */}
          <section
            className="rounded-[12px] border p-5"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center gap-3">
              <AgentGlyph agentId={selectedBot.agentId} size="md" />
              <div>
                <h2 className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  {selectedBot.name}
                </h2>
                <p className="m-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                  Runs on {agent.modelName} · {selectedBot.allowedLaneIds.length} allowed{' '}
                  {selectedBot.allowedLaneIds.length === 1 ? 'lane' : 'lanes'}
                </p>
              </div>
            </div>
            <p className="mt-3 mb-0 text-[14px] leading-[1.55]" style={{ color: 'var(--l-text)' }}>
              {selectedBot.job}
            </p>
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
                          {isActionPending(`bot-sug:${sug.id}`) ? <LoaderCircle size={13} className="lanes-spin" /> : <Check size={13} />}
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

        {/* Right column: Lane access switches + Recent updates */}
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
    </div>
  );
}
