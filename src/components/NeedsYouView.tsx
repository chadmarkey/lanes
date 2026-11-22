import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, LoaderCircle, Plus } from 'lucide-react';
import type { NeedsItem } from '../lib/types';
import { CollapsibleRegion } from './AccessiblePrimitives';
import { AgentGlyph, EmptyState, StatusMark } from './Marks';

interface NeedsYouViewProps {
  needs: NeedsItem[];
  isActionPending: (key: string) => boolean;
  onCapture: (ask: string) => Promise<boolean | void>;
  onResolveApproval: (branchId: string, decision: 'approved' | 'declined') => Promise<boolean | void>;
  onResolveDecision: (branchId: string, choiceKey: string) => Promise<boolean | void>;
  onResolveNeed: (needId: string, note: string) => Promise<boolean | void>;
  onOpenLane: (laneId: string, branchId?: string) => void;
}

export function NeedsYouView({
  needs,
  isActionPending,
  onCapture,
  onResolveApproval,
  onResolveDecision,
  onResolveNeed,
  onOpenLane,
}: NeedsYouViewProps) {
  const [captureText, setCaptureText] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const openItems = needs.filter((n) => !n.resolved);
  const resolvedItems = needs.filter((n) => n.resolved);
  const capturing = isActionPending('capture-need');

  async function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = captureText.trim();
    if (!trimmed || capturing) return;
    const ok = await onCapture(trimmed);
    if (ok !== false) {
      setCaptureText('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1
          className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
          style={{ color: 'var(--l-text)' }}
        >
          Needs you
        </h1>
        <p className="mt-1 mb-0 text-[13px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
          {openItems.length === 0
            ? 'Nothing waiting on you right now.'
            : `${openItems.length} ${openItems.length === 1 ? 'item' : 'items'} waiting across your lanes and services.`}
        </p>
      </header>

      {/* Quick capture */}
      <form
        onSubmit={(e) => void handleCaptureSubmit(e)}
        className="lanes-focus-ring mb-6 flex items-center gap-2 rounded-[12px] border p-2"
        style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
      >
        <input
          type="text"
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          placeholder="Capture something to remember or follow up on…"
          aria-label="Quick capture for Needs you"
          className="h-8 flex-1 border-0 bg-transparent px-2 text-[14px] outline-none placeholder:text-[var(--l-muted)]"
          style={{ color: 'var(--l-text)' }}
        />
        <button
          type="submit"
          disabled={capturing || !captureText.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
        >
          {capturing ? <LoaderCircle size={14} className="lanes-spin" /> : <Plus size={14} />}
          <span>{capturing ? 'Saving…' : 'Capture'}</span>
        </button>
      </form>

      {/* Open items */}
      {openItems.length === 0 ? (
        <EmptyState
          title="All clear"
          detail="Approvals, branch choices, and paused services appear here the moment a worker needs a decision."
        />
      ) : (
        <ol className="m-0 list-none space-y-3 p-0">
          {openItems.map((item, idx) => {
            const approvalPending = Boolean(item.branchId && isActionPending(`approval:${item.branchId}`));
            const decisionPending = Boolean(item.branchId && isActionPending(`decision:${item.branchId}`));
            const needPending = isActionPending(`need:${item.id}`);
            return (
              <li
                key={item.id}
                className="rounded-[12px] border p-4"
                style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums"
                      style={{ backgroundColor: 'var(--l-needs-soft)', color: 'var(--l-needs)' }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 break-words text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                        {item.ask}
                      </p>
                      <p className="mt-0.5 mb-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                        {item.laneName} · {item.sourceTitle} · {item.age}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.agentId && <AgentGlyph agentId={item.agentId} size="sm" />}
                    {item.laneId && (
                      <button
                        type="button"
                        onClick={() => onOpenLane(item.laneId!, item.branchId)}
                        className="inline-flex h-7 items-center gap-1 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                        style={{
                          backgroundColor: 'var(--l-raised)',
                          borderColor: 'var(--l-line-strong)',
                          color: 'var(--l-text)',
                        }}
                      >
                        <span>Open thread</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {item.wants && (
                  <div
                    className="mt-3 overflow-x-auto rounded-[9px] border px-3 py-2 text-[12px]"
                    style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line)' }}
                  >
                    <p className="m-0 break-all font-mono" style={{ color: 'var(--l-text)' }}>
                      Wants: {item.wants}
                    </p>
                    {item.allowed && (
                      <p className="mt-1 mb-0 break-words" style={{ color: 'var(--l-muted)' }}>
                        Allowed: {item.allowed}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.kind === 'approval' && item.branchId && (
                    <>
                      <button
                        type="button"
                        disabled={approvalPending}
                        onClick={() => void onResolveApproval(item.branchId!, 'approved')}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                      >
                        {approvalPending && <LoaderCircle size={13} className="lanes-spin" />}
                        <span>{approvalPending ? 'Working…' : 'Approve'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={approvalPending}
                        onClick={() => void onResolveApproval(item.branchId!, 'declined')}
                        className="h-8 rounded-[8px] border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--l-raised)',
                          borderColor: 'var(--l-line-strong)',
                          color: 'var(--l-text)',
                        }}
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {item.kind === 'decision' && item.branchId && item.choices && (
                    <>
                      {item.choices.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          disabled={decisionPending}
                          onClick={() => void onResolveDecision(item.branchId!, c.key)}
                          className="min-h-8 max-w-full rounded-[8px] border px-3 py-1.5 text-left text-[13px] font-medium break-words transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                          style={{
                            backgroundColor: 'var(--l-raised)',
                            borderColor: 'var(--l-line-strong)',
                            color: 'var(--l-text)',
                          }}
                        >
                          {c.key}. {c.label}
                        </button>
                      ))}
                    </>
                  )}

                  {(item.kind === 'service' || item.kind === 'capture') && (
                    <button
                      type="button"
                      disabled={needPending}
                      onClick={() =>
                        void onResolveNeed(
                          item.id,
                          item.kind === 'service' ? 'Restarted service' : 'Marked done'
                        )
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                    >
                      {needPending ? <LoaderCircle size={14} className="lanes-spin" /> : <Check size={14} />}
                      <span>
                        {needPending
                          ? 'Updating…'
                          : item.kind === 'service'
                            ? 'Restart worker'
                            : 'Mark done'}
                      </span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Resolved items */}
      {resolvedItems.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            aria-expanded={showResolved}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-[13px] font-medium tabular-nums hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <ChevronRight size={14} className="lanes-chevron" data-open={showResolved ? 'true' : 'false'} />
            <span>Resolved ({resolvedItems.length})</span>
          </button>
          <CollapsibleRegion open={showResolved}>
            <div
              className="mt-2.5 divide-y rounded-[12px] border"
              style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
            >
              {resolvedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]" style={{ borderColor: 'var(--l-line)' }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <StatusMark status="done" />
                    <span className="truncate" style={{ color: 'var(--l-text)' }}>
                      {item.ask}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                    {item.resolutionNote ?? 'Done'}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleRegion>
        </section>
      )}
    </div>
  );
}
