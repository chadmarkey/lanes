import { useState } from 'react';
import { ArrowRight, ArrowUp, CircleAlert, LoaderCircle, Lock, Plus } from 'lucide-react';
import type { Branch, Lane, NeedsItem, ServiceItem } from '../lib/types';
import { computeLaneStatus, servicesForHomeNote } from '../lib/workbench';
import { AgentGlyph, LaneTile, StatusMark } from './Marks';

interface HomeViewProps {
  lanes: Lane[];
  branches: Branch[];
  needs: NeedsItem[];
  services: ServiceItem[];
  routing: boolean;
  onRouteMessage: (text: string) => Promise<boolean | void>;
  onOpenLane: (laneId: string, branchId?: string) => void;
  onOpenNeeds: () => void;
  onOpenNewLane: () => void;
  onOpenSettings: () => void;
}

export function HomeView({
  lanes,
  branches,
  needs,
  services,
  routing,
  onRouteMessage,
  onOpenLane,
  onOpenNeeds,
  onOpenNewLane,
  onOpenSettings,
}: HomeViewProps) {
  const [input, setInput] = useState('');
  const openNeeds = needs.filter((n) => !n.resolved);
  const shownNeeds = openNeeds.slice(0, 4);
  // Threads waiting on you stay exclusively in Needs you; Working now lists only active running work
  const workingBranches = branches.filter((b) => !b.merged && b.status === 'working');
  const recentBranches = branches.filter((b) => b.status === 'done' || b.merged).slice(0, 4);
  // Skip services the Needs you card is already asking about, so one problem isn't shown twice.
  const degradedServices = servicesForHomeNote(services, shownNeeds);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || routing) return;
    const ok = await onRouteMessage(trimmed);
    if (ok !== false) {
      setInput('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-8">
      <header className="lanes-text-surface mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
            style={{ color: 'var(--l-text)' }}
          >
            Home
          </h1>
          <p className="mt-1 mb-0 text-[13px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
            {openNeeds.length} waiting on you · {workingBranches.length} working · {lanes.length} lanes
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewLane}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
          style={{
            backgroundColor: 'var(--l-raised)',
            borderColor: 'var(--l-line-strong)',
            color: 'var(--l-text)',
          }}
        >
          <Plus size={14} />
          <span>New lane</span>
        </button>
      </header>

      {/* Unified Home routing box */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="lanes-focus-ring mb-3 rounded-[14px] border p-3"
        style={{
          backgroundColor: 'var(--l-raised)',
          borderColor: 'var(--l-line)',
          boxShadow: 'var(--l-shadow-raised)',
        }}
      >
        <label htmlFor="home-route-input" className="sr-only">
          Send anything to a lane or Assistant
        </label>
        <div className="flex items-center gap-2">
          <input
            id="home-route-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything, or @lane to route it"
            className="w-full border-0 bg-transparent px-1.5 py-1.5 text-[15px] outline-none placeholder:text-[var(--l-muted)]"
            style={{ color: 'var(--l-text)' }}
          />
          <button
            type="submit"
            disabled={routing || !input.trim()}
            aria-label={routing ? 'Routing message' : 'Route message'}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            {routing ? <LoaderCircle size={15} className="lanes-spin" /> : <ArrowUp size={15} strokeWidth={2.2} />}
          </button>
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 text-[12px]"
          style={{ color: 'var(--l-muted)' }}
        >
          <span>Try:</span>
          {lanes
            .filter((l) => !l.isPrivate)
            .slice(0, 3)
            .map((lane) => (
              <button
                key={lane.id}
                type="button"
                onClick={() => setInput(`@${lane.id} `)}
                title={`Route directly to ${lane.name}`}
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--l-accent)' }}
              >
                @{lane.name}
              </button>
            ))}
          <span aria-hidden="true">·</span>
          <span>Private lanes never receive automatic cloud routing</span>
        </div>
      </form>

      {/* Quiet service notice under the message box (only when a service is down/degraded) */}
      {degradedServices.length > 0 ? (
        <div className="mb-7 flex items-center gap-2 px-1 text-[13px]" style={{ color: 'var(--l-muted)' }}>
          <CircleAlert size={14} style={{ color: 'var(--l-needs)' }} aria-hidden="true" />
          <span>
            {degradedServices.length} {degradedServices.length === 1 ? 'service needs' : 'services need'} attention (
            {degradedServices.map((s) => s.name).join(', ')}).
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--l-accent)' }}
          >
            Services
          </button>
        </div>
      ) : (
        <div className="mb-7" />
      )}

      {/* 3-column Command Center row from 1024px wide: Needs you / Working now / Recent */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Workspace overview">
        {/* Card 1: Needs you */}
        <div
          className="flex flex-col rounded-[12px] border"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--l-line)' }}
          >
            <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Needs you{' '}
              {openNeeds.length > 0 && (
                <span className="ml-1 text-[13px] font-normal tabular-nums" style={{ color: 'var(--l-needs)' }}>
                  {openNeeds.length}
                </span>
              )}
            </h2>
            {openNeeds.length > 0 && (
              <button
                type="button"
                onClick={onOpenNeeds}
                className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                style={{ color: 'var(--l-accent)' }}
              >
                <span>Open inbox</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
          {openNeeds.length === 0 ? (
            <p className="m-0 p-4 text-[13px]" style={{ color: 'var(--l-muted)' }}>
              Nothing waiting on you.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--l-line)' }}>
              {shownNeeds.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    // A service request is about a service, so open Services (where it can be checked),
                    // since the services note above is hidden while this request covers it.
                    if (item.kind === 'service') onOpenSettings();
                    else if (item.laneId) onOpenLane(item.laneId, item.branchId);
                    else onOpenNeeds();
                  }}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                  style={{ borderColor: 'var(--l-line)' }}
                >
                  <span className="mt-0.5">
                    <StatusMark status="needs" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Wrap to two lines so the ask is readable; clamp so one long ask can't stretch the row. */}
                    <p
                      className="m-0 line-clamp-2 text-[13px] leading-[1.35] font-medium"
                      style={{ color: 'var(--l-text)' }}
                      title={item.ask}
                    >
                      {item.ask}
                    </p>
                    <p className="mt-0.5 mb-0 truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                      {item.laneName} · {item.age}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Working now */}
        <div
          className="flex flex-col rounded-[12px] border"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--l-line)' }}
          >
            <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Working now{' '}
              {workingBranches.length > 0 && (
                <span className="ml-1 text-[13px] font-normal tabular-nums" style={{ color: 'var(--l-muted)' }}>
                  {workingBranches.length}
                </span>
              )}
            </h2>
          </div>
          {workingBranches.length === 0 ? (
            <p className="m-0 p-4 text-[13px]" style={{ color: 'var(--l-muted)' }}>
              Nothing running.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--l-line)' }}>
              {workingBranches.slice(0, 4).map((branch) => {
                const lane = lanes.find((l) => l.id === branch.laneId);
                const doneCount = branch.checklist.filter((c) => c.done).length;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => onOpenLane(branch.laneId, branch.id)}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                    style={{ borderColor: 'var(--l-line)' }}
                  >
                    <span className="mt-0.5">
                      <StatusMark status="working" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {branch.title}
                      </p>
                      <p className="mt-0.5 mb-0 truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                        {lane?.name ?? branch.laneId} · {doneCount}/{branch.checklist.length} steps · {branch.age}
                      </p>
                    </div>
                    <AgentGlyph agentId={branch.agentId} size="xs" />
                  </button>
                );
              })}
            </div>
          )}
          {/* The row keeps all three cards the same height; when few workers run, say so in the
              leftover space instead of leaving a blank block. */}
          {workingBranches.length > 0 && workingBranches.length < 3 && (
            // Only in the three-column layout, where the cards share a height; stacked cards have no gap.
            <div
              className="hidden flex-1 items-center justify-center border-t px-4 py-3 lg:flex"
              style={{ borderColor: 'var(--l-line)' }}
            >
              <p className="m-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Nothing else running.
              </p>
            </div>
          )}
        </div>

        {/* Card 3: Recent */}
        <div
          className="flex flex-col rounded-[12px] border"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--l-line)' }}
          >
            <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Recent
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--l-line)' }}>
            {recentBranches.map((branch) => {
              const lane = lanes.find((l) => l.id === branch.laneId);
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onOpenLane(branch.laneId, branch.id)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                  style={{ borderColor: 'var(--l-line)' }}
                >
                  <span className="mt-0.5">
                    <StatusMark status="done" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                      {branch.title}
                    </p>
                    <p className="mt-0.5 mb-0 truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                      {lane?.name ?? branch.laneId} · {branch.merged ? 'Merged' : 'Ready to merge'} · {branch.age}
                    </p>
                  </div>
                </button>
              );
            })}
            {lanes.slice(0, Math.max(0, 3 - recentBranches.length)).map((lane) => (
              <button
                key={lane.id}
                type="button"
                onClick={() => onOpenLane(lane.id)}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line)' }}
              >
                <LaneTile color={lane.color} icon={lane.icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                    {lane.name}
                  </p>
                  <p className="mt-0.5 mb-0 truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                    {lane.messages.length} turns · {lane.updatedAt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lanes grid */}
      <section aria-labelledby="home-lanes-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="home-lanes-heading" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
            Your lanes
          </h2>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
            {lanes.length} total
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lanes.map((lane) => {
            const status = computeLaneStatus(lane.id, branches);
            const laneBranchCount = branches.filter((b) => b.laneId === lane.id && !b.merged).length;
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => onOpenLane(lane.id)}
                className="flex flex-col gap-2 rounded-[12px] border p-4 text-left transition-colors hover:bg-[var(--l-hover)]"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <div className="flex items-center gap-2.5">
                  <LaneTile color={lane.color} icon={lane.icon} size="md" />
                  <span className="truncate text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                    {lane.name}
                  </span>
                  {lane.isPrivate && (
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      <Lock size={12} aria-hidden="true" />
                      <span>Local-only</span>
                    </span>
                  )}
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 text-[12px] tabular-nums"
                    style={{ color: 'var(--l-muted)' }}
                  >
                    <StatusMark status={status} />
                    <span>{lane.updatedAt}</span>
                  </span>
                </div>
                <p className="m-0 line-clamp-2 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                  {lane.purpose}
                </p>
                <p className="m-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                  {lane.messages.length} turns · {laneBranchCount} open {laneBranchCount === 1 ? 'branch' : 'branches'} ·{' '}
                  {lane.approvalMode === 'Ask'
                    ? 'Asks first'
                    : lane.approvalMode === 'Full'
                      ? 'Edits alone'
                      : 'Safe-auto'}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
