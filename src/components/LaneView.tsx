import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitMerge,
  Globe,
  ListChecks,
  LoaderCircle,
  Lock,
  MessageSquare,
  Plus,
  Settings2,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import type {
  AgentId,
  ApprovalMode,
  Branch,
  ChatMessage,
  ComposerMode,
  ComposerOutput,
  GeminiModelId,
  Lane,
  LaneColorIndex,
} from '../lib/types';
import type { TerminalSettings } from '../lib/terminalConfig';
import {
  AGENTS,
  GEMINI_CHAT_MODELS,
  getAgent,
  getBrowserStorage,
  getGeminiModel,
  readWorkerModel,
  saveWorkerModel,
} from '../lib/workbench';
import {
  AccessibleDialog,
  CollapsibleRegion,
  handleTablistKeyDown,
  useTwoStepConfirm,
} from './AccessiblePrimitives';
import { Composer } from './Composer';
import { GhosttyTerminal } from './GhosttyTerminal';
import { LaneTerminalDrawer } from './LaneTerminalDrawer';
import { AgentGlyph, EmptyState, LaneTile, StatusMark } from './Marks';

interface LaneViewProps {
  lane: Lane | null;
  isAssistant?: boolean;
  assistantMessages?: ChatMessage[];
  branches: Branch[];
  activeBranchId: string | null;
  sending: boolean;
  isActionPending: (key: string) => boolean;
  terminalSettings: TerminalSettings;
  appIsDark: boolean;
  onChangeTerminalSettings: (next: TerminalSettings) => void;
  onOpenTerminalStudio: () => void;
  onSelectBranch: (branchId: string | null) => void;
  onSendMessage: (payload: {
    text: string;
    mode: ComposerMode;
    agentId: AgentId;
    modelId: GeminiModelId;
    useSearch: boolean;
    output: ComposerOutput;
    approvalMode: ApprovalMode;
  }) => Promise<boolean | void>;
  onCreateBranch: (title: string, agentId: AgentId, prompt: string) => Promise<boolean | void>;
  onSendBranchMessage: (
    branchId: string,
    text: string,
    modelId?: GeminiModelId,
    reopen?: boolean
  ) => Promise<boolean | void>;
  onResolveApproval: (branchId: string, decision: 'approved' | 'declined') => Promise<boolean | void>;
  onResolveDecision: (branchId: string, choiceKey: string) => Promise<boolean | void>;
  onMergeBranch: (branchId: string) => Promise<boolean | void>;
  onUpdateLane: (laneId: string, patch: Partial<Lane>) => Promise<boolean | void>;
  onOpenVoice?: () => void;
  onNotify?: (msg: string, tone?: 'info' | 'error') => void;
}

const LANE_COLORS: LaneColorIndex[] = [1, 2, 3, 4, 5];
const LANE_ICONS: { id: Lane['icon']; label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'code', label: 'Code' },
  { id: 'flask', label: 'Research' },
  { id: 'pen', label: 'Writing' },
  { id: 'wallet', label: 'Money' },
  { id: 'compass', label: 'Planning' },
];

function ToolStepsDisclosure({ steps }: { steps: NonNullable<ChatMessage['steps']> }) {
  const [open, setOpen] = useState(false);
  const totalSec = steps.reduce((sum, s) => sum + s.durationSec, 0);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] tabular-nums transition-colors hover:underline"
        style={{ color: 'var(--l-muted)' }}
      >
        <ChevronRight size={13} className="lanes-chevron" data-open={open ? 'true' : 'false'} />
        <span>
          Worked for {totalSec}s · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
      </button>
      <CollapsibleRegion open={open}>
        <ol
          className="mt-1.5 space-y-1 rounded-[10px] border p-2.5 text-[12px]"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          {steps.map((step) => (
            <li key={step.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                  {step.label}
                </span>{' '}
                <span style={{ color: 'var(--l-muted)' }}>{step.detail}</span>
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: 'var(--l-faint)' }}>
                {step.durationSec}s
              </span>
            </li>
          ))}
        </ol>
      </CollapsibleRegion>
    </div>
  );
}

function InlineBranchCard({
  branch,
  selected,
  isActionPending,
  onOpen,
  onResolveApproval,
  onResolveDecision,
  onMergeBranch,
}: {
  branch: Branch;
  selected: boolean;
  isActionPending: (key: string) => boolean;
  onOpen: () => void;
  onResolveApproval: (branchId: string, decision: 'approved' | 'declined') => Promise<boolean | void>;
  onResolveDecision: (branchId: string, choiceKey: string) => Promise<boolean | void>;
  onMergeBranch: (branchId: string) => Promise<boolean | void>;
}) {
  const { armedKey, trigger, disarm } = useTwoStepConfirm();
  const doneCount = branch.checklist.filter((c) => c.done).length;
  const totalCount = branch.checklist.length || 1;
  const pct = Math.round((doneCount / totalCount) * 100);
  const agent = getAgent(branch.agentId);
  const pendingApproval = branch.approval && branch.approval.status === 'pending';
  const pendingDecision = branch.decision && !branch.decision.pickedKey;
  const readyToMerge = branch.status === 'done' && !branch.merged && !pendingApproval && !pendingDecision;
  const approvalBusy = isActionPending(`approval:${branch.id}`);
  const decisionBusy = isActionPending(`decision:${branch.id}`);
  const mergeBusy = isActionPending(`merge:${branch.id}`);
  const mergeArmed = armedKey === `merge:${branch.id}`;

  return (
    <div
      className="mt-3 overflow-hidden rounded-[12px] border p-3.5 transition-colors"
      style={{
        backgroundColor: 'var(--l-panel)',
        borderColor: selected
          ? 'var(--l-accent)'
          : pendingApproval || pendingDecision
            ? 'var(--l-needs)'
            : 'var(--l-line)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <span className="mt-0.5">
            <StatusMark status={branch.status} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
              {branch.title}
            </span>
            <span className="mt-0.5 block truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
              {branch.gitBranch} · {agent.label} · {doneCount} of {branch.checklist.length} steps
              {branch.askedByBot ? ` · asked by ${branch.askedByBot}` : ''}
              {branch.merged ? ' · merged' : ''}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <AgentGlyph agentId={branch.agentId} size="sm" />
          <button
            type="button"
            onClick={onOpen}
            className="h-7 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
            style={{
              backgroundColor: selected ? 'var(--l-selected)' : 'var(--l-raised)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          >
            {selected ? 'Open beside' : 'Inspect'}
          </button>
        </div>
      </div>

      {/* Progress line */}
      <div className="mt-3 flex items-center gap-2.5">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--l-line)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor:
                branch.status === 'needs'
                  ? 'var(--l-needs)'
                  : branch.status === 'done'
                    ? 'var(--l-ok)'
                    : 'var(--l-accent)',
            }}
          />
        </div>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
          {pct}%
        </span>
      </div>

      {branch.currentStep && !branch.merged && (
        <p className="mt-2 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
          {branch.currentStep}
        </p>
      )}
      {branch.summary && (
        <p className="mt-1.5 mb-0 text-[13px]" style={{ color: 'var(--l-text)' }}>
          {branch.summary}
          {branch.checkedBy ? ` · Checked by ${branch.checkedBy}` : ''}
        </p>
      )}

      {/* Inline approval dock (flush top-divided band — avoids card-in-card nesting) */}
      {pendingApproval && branch.approval && (
        <div
          className="-mx-3.5 -mb-3.5 mt-3 overflow-x-auto border-t px-3.5 py-3"
          style={{ backgroundColor: 'var(--l-needs-soft)', borderColor: 'var(--l-line)' }}
        >
          <p className="m-0 break-words text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
            Needs you: {branch.approval.ask}
          </p>
          <p className="mt-1 mb-0 break-all font-mono text-[12px]" style={{ color: 'var(--l-text)' }}>
            Wants: {branch.approval.command}
          </p>
          <p className="mt-0.5 mb-0 break-words text-[12px]" style={{ color: 'var(--l-muted)' }}>
            Allowed: {branch.approval.allowedRule}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={approvalBusy}
              onClick={() => void onResolveApproval(branch.id, 'approved')}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {approvalBusy && <LoaderCircle size={12} className="lanes-spin" />}
              <span>{approvalBusy ? 'Working…' : 'Approve'}</span>
            </button>
            <button
              type="button"
              disabled={approvalBusy}
              onClick={() => void onResolveApproval(branch.id, 'declined')}
              className="h-7 rounded-[7px] border px-3 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
              style={{
                backgroundColor: 'var(--l-raised)',
                borderColor: 'var(--l-line-strong)',
                color: 'var(--l-text)',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Inline decision dock (flush top-divided band — avoids card-in-card nesting) */}
      {pendingDecision && branch.decision && (
        <div
          className="-mx-3.5 -mb-3.5 mt-3 border-t px-3.5 py-3"
          style={{ backgroundColor: 'var(--l-needs-soft)', borderColor: 'var(--l-line)' }}
        >
          <p className="m-0 break-words text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
            Needs you: {branch.decision.question}
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {branch.decision.choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                disabled={decisionBusy}
                onClick={() => void onResolveDecision(branch.id, choice.key)}
                className="flex flex-col items-start rounded-[8px] border p-2.5 text-left transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)' }}
              >
                <span className="text-[13px] font-medium break-words" style={{ color: 'var(--l-text)' }}>
                  {choice.key}. {choice.label}
                </span>
                <span className="mt-0.5 text-[12px] break-words" style={{ color: 'var(--l-muted)' }}>
                  {choice.note}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Merge bar for completed branches (two-step inline confirm) */}
      {readyToMerge && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--l-line)' }}>
          <span className="text-[12px]" style={{ color: 'var(--l-ok)' }}>
            Ready to review and merge
          </span>
          <span className="sr-only" role="status" aria-live="polite">
            {mergeArmed ? 'Confirm merge: activate the merge button again within 8 seconds, or press Cancel.' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {mergeArmed && !mergeBusy && (
              <button
                type="button"
                onClick={disarm}
                className="h-7 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={mergeBusy}
              onClick={() => trigger(`merge:${branch.id}`, () => onMergeBranch(branch.id))}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: mergeArmed ? 'var(--l-needs)' : 'var(--l-accent)',
                color: mergeArmed ? 'var(--l-on-needs, var(--l-on-accent))' : 'var(--l-on-accent)',
              }}
            >
              {mergeBusy ? <LoaderCircle size={13} className="lanes-spin" /> : <GitMerge size={13} />}
              <span>{mergeBusy ? 'Merging…' : mergeArmed ? 'Click again to merge' : 'Merge to main'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const WORKER_TABS = ['chat', 'changes', 'checklist', 'terminal'] as const;
const WORKER_MIN_WIDTH = 320;
const WORKER_MAX_WIDTH = 640;
const WORKER_DEFAULT_WIDTH = 400;

function WorkerSidePanel({
  branch,
  isPrivate = false,
  isActionPending,
  terminalSettings,
  appIsDark,
  onOpenTerminalStudio,
  onNotify,
  onClose,
  onSendBranchMessage,
  onResolveApproval,
  onResolveDecision,
  onMergeBranch,
  panelWidth,
  setPanelWidth,
}: {
  branch: Branch;
  isPrivate?: boolean;
  isActionPending: (key: string) => boolean;
  terminalSettings: TerminalSettings;
  appIsDark: boolean;
  onOpenTerminalStudio: () => void;
  onNotify?: (msg: string, tone?: 'info' | 'error') => void;
  onClose: () => void;
  /** Held by LaneView so the size you dragged survives switching workers (this panel is keyed per worker). */
  panelWidth: number;
  setPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  onSendBranchMessage: (
    branchId: string,
    text: string,
    modelId?: GeminiModelId,
    reopen?: boolean
  ) => Promise<boolean | void>;
  onResolveApproval: (branchId: string, decision: 'approved' | 'declined') => Promise<boolean | void>;
  onResolveDecision: (branchId: string, choiceKey: string) => Promise<boolean | void>;
  onMergeBranch: (branchId: string) => Promise<boolean | void>;
}) {
  const [tab, setTab] = useState<'chat' | 'changes' | 'checklist' | 'terminal'>('chat');
  const [input, setInput] = useState('');
  // Each worker remembers its own pick in this browser. The panel is keyed per worker, so this
  // reads storage once when a worker opens, not on every keystroke or drag.
  const [modelId, setModelId] = useState<GeminiModelId>(() => readWorkerModel(branch.id, getBrowserStorage()));
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(WORKER_DEFAULT_WIDTH);
  const { armedKey, trigger, disarm } = useTwoStepConfirm();

  // Hardened gesture cleanup: release drag state if window loses focus mid-drag
  useEffect(() => {
    if (!dragging) return;
    function endDrag() {
      dragPointerIdRef.current = null;
      setDragging(false);
    }
    window.addEventListener('blur', endDrag);
    return () => window.removeEventListener('blur', endDrag);
  }, [dragging]);

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== null) return;
    dragPointerIdRef.current = e.pointerId;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== e.pointerId) return;
    const delta = dragStartXRef.current - e.clientX;
    const maxAllowed = Math.min(WORKER_MAX_WIDTH, Math.max(WORKER_MIN_WIDTH, window.innerWidth - 360));
    const next = Math.max(WORKER_MIN_WIDTH, Math.min(maxAllowed, dragStartWidthRef.current + delta));
    setPanelWidth(Math.round(next));
  }

  function handleResizePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragPointerIdRef.current = null;
    setDragging(false);
  }

  function handleResizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPanelWidth((w) => Math.min(WORKER_MAX_WIDTH, w + 24));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPanelWidth((w) => Math.max(WORKER_MIN_WIDTH, w - 24));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPanelWidth(WORKER_DEFAULT_WIDTH);
    }
  }

  const agent = getAgent(branch.agentId);
  // The model that will answer the next message (matches the Model menu below the input).
  const replyModelLabel = isPrivate
    ? 'Qwen 30B (local)'
    : getGeminiModel(modelId).label;
  const doneCount = branch.checklist.filter((c) => c.done).length;
  const totalAdds = branch.files.reduce((s, f) => s + f.adds, 0);
  const totalDels = branch.files.reduce((s, f) => s + f.dels, 0);
  const approvalBusy = isActionPending(`approval:${branch.id}`);
  const decisionBusy = isActionPending(`decision:${branch.id}`);
  const mergeBusy = isActionPending(`merge:${branch.id}`);
  const mergeArmed = armedKey === `panel-merge:${branch.id}`;

  // A finished, unmerged worker asks first: answer only, or put it back to work.
  const [reopenChoiceOpen, setReopenChoiceOpen] = useState(false);
  const isFinished = branch.status === 'done' && !branch.merged;

  async function send(reopen: boolean) {
    // Close the prompt first, so it can't get stuck open if the box was cleared meanwhile.
    setReopenChoiceOpen(false);
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const ok = await onSendBranchMessage(branch.id, trimmed, isPrivate ? undefined : modelId, reopen);
      if (ok !== false) {
        setInput('');
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    if (isFinished) {
      setReopenChoiceOpen(true);
      return;
    }
    await send(false);
  }

  return (
    <div className="flex h-full w-full lg:w-auto lg:shrink-0">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize branch panel"
        aria-valuemin={WORKER_MIN_WIDTH}
        aria-valuemax={WORKER_MAX_WIDTH}
        aria-valuenow={panelWidth}
        tabIndex={0}
        data-dragging={dragging ? 'true' : 'false'}
        title="Drag to resize branch panel (or use Left/Right arrow keys)"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
        onLostPointerCapture={() => {
          dragPointerIdRef.current = null;
          setDragging(false);
        }}
        onDoubleClick={() => setPanelWidth(WORKER_DEFAULT_WIDTH)}
        onKeyDown={handleResizeKeyDown}
        className="lanes-resize-handle hidden lg:block"
      />
      <aside
        aria-label={`Branch ${branch.title}`}
        className="flex h-full w-full flex-col border-l lg:w-[var(--worker-panel-w)] lg:shrink-0"
        style={
          {
            backgroundColor: 'var(--l-list)',
            borderColor: 'var(--l-line)',
            '--worker-panel-w': `${panelWidth}px`,
            transition: dragging ? 'none' : 'width 160ms var(--l-hover-ease)',
          } as React.CSSProperties
        }
      >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--l-line)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusMark status={branch.status} />
            <h2 className="m-0 truncate text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
              {branch.title}
            </h2>
          </div>
          <p className="mt-0.5 mb-0 truncate text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
            {branch.gitBranch} · {replyModelLabel} · {branch.age}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close branch panel"
          aria-label="Close branch panel"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--l-hover)]"
          style={{ color: 'var(--l-muted)' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto border-b px-3 py-1.5"
        style={{ borderColor: 'var(--l-line)' }}
        role="tablist"
        aria-label="Worker views"
        onKeyDown={(e) => handleTablistKeyDown(e, WORKER_TABS, tab, setTab)}
      >
        {[
          { id: 'chat' as const, label: 'Chat', icon: MessageSquare, count: branch.messages.length },
          { id: 'changes' as const, label: 'Changes', icon: FileCode2, count: branch.files.length },
          { id: 'checklist' as const, label: 'Checklist', icon: ListChecks, count: `${doneCount}/${branch.checklist.length}` },
          { id: 'terminal' as const, label: 'Terminal', icon: Terminal, count: null },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              id={`worker-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`worker-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                color: active ? 'var(--l-text)' : 'var(--l-muted)',
              }}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              {t.count !== null && <span className="tabular-nums opacity-75">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* Action banner inside side panel if approval or decision pending */}
      {branch.approval && branch.approval.status === 'pending' && (
        <div
          className="overflow-x-auto border-b px-4 py-3"
          style={{ backgroundColor: 'var(--l-needs-soft)', borderColor: 'var(--l-line)' }}
        >
          <p className="m-0 break-words text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
            {branch.approval.ask}
          </p>
          <p className="mt-1 mb-0 break-all font-mono text-[12px]" style={{ color: 'var(--l-text)' }}>
            {branch.approval.command}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={approvalBusy}
              onClick={() => void onResolveApproval(branch.id, 'approved')}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-medium whitespace-nowrap disabled:opacity-50"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {approvalBusy && <LoaderCircle size={12} className="lanes-spin" />}
              <span>{approvalBusy ? 'Working…' : 'Approve'}</span>
            </button>
            <button
              type="button"
              disabled={approvalBusy}
              onClick={() => void onResolveApproval(branch.id, 'declined')}
              className="h-7 rounded-[7px] border px-3 text-[12px] font-medium whitespace-nowrap disabled:opacity-50"
              style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {branch.decision && !branch.decision.pickedKey && (
        <div
          className="border-b px-4 py-3"
          style={{ backgroundColor: 'var(--l-needs-soft)', borderColor: 'var(--l-line)' }}
        >
          <p className="m-0 break-words text-[13px] font-semibold" style={{ color: 'var(--l-text)' }}>
            {branch.decision.question}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {branch.decision.choices.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={decisionBusy}
                onClick={() => void onResolveDecision(branch.id, c.key)}
                className="min-h-7 max-w-full rounded-[7px] border px-2.5 py-1 text-left text-[12px] font-medium break-words hover:bg-[var(--l-hover)] disabled:opacity-50"
                style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                {c.key}. {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div
        id={`worker-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`worker-tab-${tab}`}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {tab === 'chat' && (
          <div className="space-y-4">
            {branch.messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}>
                {m.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-[12px] border px-3 py-2 text-[14px]"
                    style={{
                      backgroundColor: 'var(--l-raised)',
                      borderColor: 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {m.text}
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="mb-1 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      <AgentGlyph agentId={m.agentId ?? branch.agentId} size="xs" />
                      <span>{m.modelLabel ?? agent.label}</span>
                      <span>· {m.timestamp}</span>
                    </div>
                    <p className="m-0 text-[14px] leading-[1.55] whitespace-pre-wrap" style={{ color: 'var(--l-text)' }}>
                      {m.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'changes' && (
          <div className="space-y-3">
            {branch.files.length === 0 ? (
              <EmptyState
                title="No file edits yet"
                detail="Diffs appear here as the worker edits files on this git branch."
              />
            ) : (
              <>
                <p className="m-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                  {branch.files.length} {branch.files.length === 1 ? 'file' : 'files'} ·{' '}
                  <span style={{ color: 'var(--l-ok)' }}>+{totalAdds}</span>{' '}
                  <span style={{ color: 'var(--l-bad)' }}>−{totalDels}</span>
                </p>
                {branch.files.map((file) => (
                  <div
                    key={file.path}
                    className="overflow-hidden rounded-[10px] border"
                    style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
                  >
                    <div
                      className="flex items-center justify-between border-b px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
                    >
                      <span className="truncate font-mono font-medium" style={{ color: 'var(--l-text)' }}>
                        {file.path}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span style={{ color: 'var(--l-ok)' }}>+{file.adds}</span>{' '}
                        <span style={{ color: 'var(--l-bad)' }}>−{file.dels}</span>
                      </span>
                    </div>
                    <pre
                      className="m-0 overflow-x-auto p-3 font-mono text-[12px] leading-[1.55]"
                      style={{ color: 'var(--l-text)' }}
                    >
                      {file.patch}
                    </pre>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'checklist' && (
          <ul className="m-0 list-none space-y-2 p-0">
            {branch.checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line)' }}
              >
                <span
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: item.done ? 'var(--l-ok-soft)' : 'var(--l-panel)',
                    color: item.done ? 'var(--l-ok)' : 'var(--l-muted)',
                  }}
                >
                  {item.done ? <Check size={11} strokeWidth={2.5} /> : null}
                </span>
                <span style={{ color: item.done ? 'var(--l-text)' : 'var(--l-muted)' }}>{item.label}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'terminal' && (
          <div
            className="-m-4 flex h-[calc(100%+2rem)] flex-col"
            style={{ minHeight: '280px' }}
          >
            <GhosttyTerminal
              settings={terminalSettings}
              appIsDark={appIsDark}
              mode="live"
              sessionLabel={branch.gitBranch}
              showHeader
              onOpenCustomizer={onOpenTerminalStudio}
              onNotify={onNotify}
              className="h-full flex-1"
            />
          </div>
        )}
      </div>

      {/* Footer: merge or talk to branch */}
      <div className="border-t p-3" style={{ borderColor: 'var(--l-line)' }}>
        {branch.status === 'done' && !branch.merged && (
          <div className="mb-2.5 flex items-center gap-2">
            <span className="sr-only" role="status" aria-live="polite">
              {mergeArmed ? 'Confirm merge: activate the merge button again within 8 seconds, or press Cancel.' : ''}
            </span>
            {mergeArmed && !mergeBusy && (
              <button
                type="button"
                onClick={disarm}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={mergeBusy}
              onClick={() => trigger(`panel-merge:${branch.id}`, () => onMergeBranch(branch.id))}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: mergeArmed ? 'var(--l-needs)' : 'var(--l-accent)',
                color: mergeArmed ? 'var(--l-on-needs, var(--l-on-accent))' : 'var(--l-on-accent)',
              }}
            >
              {mergeBusy ? <LoaderCircle size={14} className="lanes-spin" /> : <GitMerge size={14} />}
              <span>{mergeBusy ? 'Merging…' : mergeArmed ? 'Click again to merge' : 'Merge branch to main'}</span>
            </button>
          </div>
        )}
        {reopenChoiceOpen && (
          <div
            role="group"
            aria-label="This worker is finished"
            className="mb-2.5 rounded-[9px] border px-3 py-2.5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)' }}
          >
            <p className="m-0 text-[13px]" style={{ color: 'var(--l-text)' }}>
              This worker is finished. Should it get back to work?
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => void send(false)}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Just ask
              </button>
              <button
                type="button"
                onClick={() => void send(true)}
                className="h-8 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                Reopen worker
              </button>
              <button
                type="button"
                onClick={() => setReopenChoiceOpen(false)}
                className="ml-auto h-8 rounded-[8px] px-2 text-[12px] whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                Cancel
              </button>
            </div>
            <p className="mt-1.5 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
              Just ask keeps it ready to merge. Reopen puts it back in progress.
            </p>
          </div>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to this worker…"
            aria-label="Talk to this worker"
            className="h-9 flex-1 rounded-[9px] border px-3 text-[13px] placeholder:text-[var(--l-muted)]"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label={sending ? 'Sending to branch worker' : 'Send to branch worker'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            {sending ? <LoaderCircle size={15} className="lanes-spin" /> : <ArrowUp size={15} />}
          </button>
        </form>
        {/* Which model answers the next message. Private lanes always stay on the local model. */}
        <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
          <label htmlFor={`worker-model-${branch.id}`}>Model</label>
          {isPrivate ? (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--l-text)' }}>
              <Lock size={11} /> Qwen 30B (local)
            </span>
          ) : (
            <select
              id={`worker-model-${branch.id}`}
              value={modelId}
              onChange={(e) => {
                const next = e.target.value as GeminiModelId;
                setModelId(next);
                saveWorkerModel(branch.id, next, getBrowserStorage());
              }}
              className="h-6 cursor-pointer rounded-[6px] border-0 bg-transparent px-1 text-[12px] font-medium hover:bg-[var(--l-hover)]"
              style={{ color: 'var(--l-text)' }}
            >
              {GEMINI_CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </aside>
    </div>
  );
}

export function LaneView({
  lane,
  isAssistant = false,
  assistantMessages = [],
  branches,
  activeBranchId,
  sending,
  isActionPending,
  terminalSettings,
  appIsDark,
  onChangeTerminalSettings,
  onOpenTerminalStudio,
  onSelectBranch,
  onSendMessage,
  onCreateBranch,
  onSendBranchMessage,
  onResolveApproval,
  onResolveDecision,
  onMergeBranch,
  onUpdateLane,
  onOpenVoice,
  onNotify,
}: LaneViewProps) {
  const [workerPanelWidth, setWorkerPanelWidth] = useState(WORKER_DEFAULT_WIDTH);
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ctrl+` toggles the bottom Ghostty terminal drawer on any lane
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === '`') {
        e.preventDefault();
        setTerminalDrawerOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [branchTitle, setBranchTitle] = useState('');
  const [branchAgent, setBranchAgent] = useState<AgentId>(lane?.isPrivate ? 'qwen' : lane?.defaultAgentId ?? 'claude');

  // Lane settings form state
  const [editName, setEditName] = useState(lane?.name ?? '');
  const [editPurpose, setEditPurpose] = useState(lane?.purpose ?? '');
  const [editColor, setEditColor] = useState<LaneColorIndex>(lane?.color ?? 1);
  const [editIcon, setEditIcon] = useState<Lane['icon']>(lane?.icon ?? 'layers');
  const [editPrivate, setEditPrivate] = useState(lane?.isPrivate ?? false);
  const [confirmUnprivate, setConfirmUnprivate] = useState(false);
  const [editApproval, setEditApproval] = useState<ApprovalMode>(lane?.approvalMode ?? 'Safe-auto');
  const [editInstructions, setEditInstructions] = useState(lane?.instructions ?? '');

  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lane) {
      setEditName(lane.name);
      setEditPurpose(lane.purpose);
      setEditColor(lane.color);
      setEditIcon(lane.icon);
      setEditPrivate(lane.isPrivate);
      setConfirmUnprivate(false);
      setEditApproval(lane.approvalMode);
      setEditInstructions(lane.instructions);
      setBranchAgent(lane.isPrivate ? 'qwen' : lane.defaultAgentId);
    }
  }, [lane]);

  const messages = isAssistant ? assistantMessages : lane?.messages ?? [];
  const laneBranches = isAssistant || !lane ? [] : branches.filter((b) => b.laneId === lane.id);
  const activeBranch = laneBranches.find((b) => b.id === activeBranchId) ?? null;

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const referencedBranchIds = new Set(messages.map((m) => m.branchId).filter(Boolean));
  const orphanBranches = laneBranches.filter((b) => !referencedBranchIds.has(b.id));
  const savingSettings = Boolean(lane && isActionPending(`lane-settings:${lane.id}`));
  const creatingBranch = isActionPending('create-branch');
  const downgradingPrivacy = Boolean(lane?.isPrivate && !editPrivate);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!lane || savingSettings) return;
    if (downgradingPrivacy && !confirmUnprivate) return;
    const ok = await onUpdateLane(lane.id, {
      name: editName.trim() || lane.name,
      purpose: editPurpose.trim(),
      color: editColor,
      icon: editIcon,
      isPrivate: editPrivate,
      approvalMode: editApproval,
      instructions: editInstructions,
    });
    if (ok !== false) {
      setConfirmUnprivate(false);
      setSettingsOpen(false);
    }
  }

  async function handleCreateBranchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = branchTitle.trim();
    if (!title || !lane || creatingBranch) return;
    const ok = await onCreateBranch(title, lane.isPrivate ? 'qwen' : branchAgent, title);
    if (ok !== false) {
      setBranchTitle('');
      setNewBranchOpen(false);
    }
  }

  if (!isAssistant && !lane) {
    return (
      <div className="mx-auto max-w-[768px] p-8">
        <EmptyState title="Pick a lane" detail="Select a lane from the sidebar to open its main thread." />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Main thread column */}
      <div className={`flex min-w-0 flex-1 flex-col ${activeBranch ? 'hidden lg:flex' : 'flex'}`}>
        {/* Thread header */}
        <header
          className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-6"
          style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {isAssistant ? (
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]"
                style={{ backgroundColor: 'var(--l-accent-soft)', color: 'var(--l-accent)' }}
              >
                <Sparkles size={14} />
              </span>
            ) : (
              lane && <LaneTile color={lane.color} icon={lane.icon} size="md" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="m-0 truncate text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  {isAssistant ? 'Assistant' : lane?.name}
                </h1>
                {lane?.isPrivate && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[12px]"
                    style={{ color: 'var(--l-muted)' }}
                    title="Local-only private lane"
                  >
                    <Lock size={12} aria-hidden="true" />
                    <span className="hidden sm:inline">Local-only</span>
                  </span>
                )}
              </div>
              <p className="m-0 truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
                {isAssistant
                  ? 'Sees across every non-private lane · Quick ask (⌘K) stays separate'
                  : lane?.purpose}
              </p>
            </div>
          </div>

          {isAssistant && onOpenVoice && (
            <button
              type="button"
              onClick={onOpenVoice}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                backgroundColor: 'var(--l-raised)',
                borderColor: 'var(--l-line-strong)',
                color: 'var(--l-text)',
              }}
            >
              <AudioLines size={13} />
              <span>Live voice</span>
            </button>
          )}

          {!isAssistant && lane && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-pressed={terminalDrawerOpen}
                onClick={() => setTerminalDrawerOpen((v) => !v)}
                title="Toggle Ghostty terminal drawer (⌃`)"
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: terminalDrawerOpen ? 'var(--l-selected)' : 'var(--l-raised)',
                  borderColor: terminalDrawerOpen ? 'var(--l-accent)' : 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              >
                <Terminal size={13} />
                <span className="hidden sm:inline">Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => setNewBranchOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              >
                <GitBranch size={13} />
                <span>New branch</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Lane settings"
                aria-label="Lane settings"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              >
                <Settings2 size={14} />
              </button>
            </div>
          )}
        </header>

        {/* Scrollable chat feed */}
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 md:px-6">
          <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6">
            {messages.map((msg) => {
              const attachedBranch = msg.branchId
                ? laneBranches.find((b) => b.id === msg.branchId)
                : undefined;

              return (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[82%] rounded-[14px] border px-4 py-2.5 text-[15px] leading-[1.55]"
                        style={{
                          backgroundColor: 'var(--l-raised)',
                          borderColor: 'var(--l-line)',
                          color: 'var(--l-text)',
                        }}
                      >
                        <p className="m-0 whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="lanes-text-surface w-full">
                      <div className="mb-1.5 flex items-center gap-2 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        <AgentGlyph agentId={msg.agentId ?? 'gemini'} size="xs" />
                        <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                          {msg.modelLabel ?? getAgent(msg.agentId ?? 'gemini').modelName}
                        </span>
                        <span>· {msg.timestamp}</span>
                      </div>

                      {msg.steps && msg.steps.length > 0 && <ToolStepsDisclosure steps={msg.steps} />}

                      <p
                        className="m-0 max-w-[54ch] text-[15px] leading-[1.6] whitespace-pre-wrap"
                        style={{ color: 'var(--l-text)' }}
                      >
                        {msg.text}
                      </p>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 text-[12px] font-medium"
                            style={{ color: 'var(--l-muted)' }}
                          >
                            <Globe size={12} aria-hidden="true" />
                            <span>Sources</span>
                          </span>
                          {msg.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-full border px-2.5 py-0.5 text-[12px] transition-colors hover:bg-[var(--l-hover)]"
                              style={{
                                backgroundColor: 'var(--l-panel)',
                                borderColor: 'var(--l-line)',
                                color: 'var(--l-text)',
                              }}
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink size={11} className="shrink-0" style={{ color: 'var(--l-muted)' }} />
                            </a>
                          ))}
                        </div>
                      )}

                      {attachedBranch && (
                        <InlineBranchCard
                          branch={attachedBranch}
                          selected={activeBranchId === attachedBranch.id}
                          isActionPending={isActionPending}
                          onOpen={() =>
                            onSelectBranch(activeBranchId === attachedBranch.id ? null : attachedBranch.id)
                          }
                          onResolveApproval={onResolveApproval}
                          onResolveDecision={onResolveDecision}
                          onMergeBranch={onMergeBranch}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Branches not tied to an earlier message */}
            {orphanBranches.length > 0 && (
              <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--l-line)' }}>
                <p className="m-0 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Active branches in this lane
                </p>
                {orphanBranches.map((branch) => (
                  <InlineBranchCard
                    key={branch.id}
                    branch={branch}
                    selected={activeBranchId === branch.id}
                    isActionPending={isActionPending}
                    onOpen={() => onSelectBranch(activeBranchId === branch.id ? null : branch.id)}
                    onResolveApproval={onResolveApproval}
                    onResolveDecision={onResolveDecision}
                    onMergeBranch={onMergeBranch}
                  />
                ))}
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>
        </div>

        {/* WorkerDock + Bottom composer */}
        <div className="shrink-0 px-4 pb-16 pt-2 md:px-6 md:pb-4">
          {!isAssistant && laneBranches.filter((b) => !b.merged).length > 0 && (() => {
            const openWorkers = laneBranches.filter((b) => !b.merged);
            const waitingWorker = openWorkers.find((b) => b.status === 'needs');
            const workingCount = openWorkers.filter((b) => b.status === 'working').length;
            const waitingCount = openWorkers.filter((b) => b.status === 'needs').length;
            const doneCount = openWorkers.filter((b) => b.status === 'done').length;
            const parts: string[] = [];
            if (workingCount > 0) parts.push(`${workingCount} working`);
            if (waitingCount > 0) parts.push(`${waitingCount} needs you`);
            if (doneCount > 0) parts.push(`${doneCount} ready`);
            const targetBranch = waitingWorker ?? openWorkers[0];
            return (
              <div className="mx-auto mb-2 flex w-full max-w-[768px] items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    onSelectBranch(activeBranchId === targetBranch.id ? null : targetBranch.id)
                  }
                  title={targetBranch.title}
                  className="inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-[10px] border px-3 text-[12px] font-medium tabular-nums transition-colors hover:bg-[var(--l-hover)]"
                  style={{
                    backgroundColor: waitingCount > 0 ? 'var(--l-needs-soft)' : 'var(--l-panel)',
                    borderColor: waitingCount > 0 ? 'var(--l-needs)' : 'var(--l-line)',
                    color: 'var(--l-text)',
                  }}
                >
                  <StatusMark status={waitingCount > 0 ? 'needs' : workingCount > 0 ? 'working' : 'done'} />
                  <span className="shrink-0">{parts.join(' · ')}</span>
                  <span className="min-w-0 truncate" style={{ color: 'var(--l-muted)' }}>
                    · {targetBranch.title}
                  </span>
                </button>
              </div>
            );
          })()}
          <Composer
            draftKey={isAssistant ? 'assistant' : lane?.id ?? 'lane'}
            laneName={isAssistant ? 'Assistant' : lane?.name ?? 'Lane'}
            isPrivate={Boolean(lane?.isPrivate)}
            defaultAgentId={isAssistant ? 'gemini' : lane?.defaultAgentId ?? 'claude'}
            defaultApprovalMode={lane?.approvalMode ?? 'Safe-auto'}
            sending={sending}
            showBranchOption={!isAssistant}
            placeholder={
              isAssistant
                ? 'Ask across your non-private lanes…'
                : lane?.isPrivate
                  ? 'Ask Qwen locally in this private lane…'
                  : 'Ask, or choose Output → Branch to spin up a worker…'
            }
            onNotify={onNotify}
            onSend={onSendMessage}
          />
        </div>

        {/* Collapsible lane bottom Ghostty terminal drawer */}
        {!isAssistant && lane && (
          <LaneTerminalDrawer
            open={terminalDrawerOpen}
            laneName={lane.name}
            settings={terminalSettings}
            appIsDark={appIsDark}
            onChangeSettings={onChangeTerminalSettings}
            onClose={() => setTerminalDrawerOpen(false)}
            onOpenStudio={onOpenTerminalStudio}
            onNotify={(msg, tone) => onNotify?.(msg, tone)}
          />
        )}
      </div>

      {/* Worker side panel */}
      {activeBranch && (
        <WorkerSidePanel
          key={activeBranch.id}
          branch={activeBranch}
          panelWidth={workerPanelWidth}
          setPanelWidth={setWorkerPanelWidth}
          isPrivate={lane?.isPrivate}
          isActionPending={isActionPending}
          terminalSettings={terminalSettings}
          appIsDark={appIsDark}
          onOpenTerminalStudio={onOpenTerminalStudio}
          onNotify={onNotify}
          onClose={() => onSelectBranch(null)}
          onSendBranchMessage={onSendBranchMessage}
          onResolveApproval={onResolveApproval}
          onResolveDecision={onResolveDecision}
          onMergeBranch={onMergeBranch}
        />
      )}

      {/* New Branch Modal */}
      {lane && (
        <AccessibleDialog
          open={newBranchOpen}
          onClose={() => setNewBranchOpen(false)}
          ariaLabelledBy="new-branch-dialog-title"
        >
          <form
            onSubmit={(e) => void handleCreateBranchSubmit(e)}
            className="w-[min(440px,calc(100vw-2rem))] rounded-[14px] border p-5"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line)',
              boxShadow: 'var(--l-shadow-menu)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-branch-dialog-title" className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
                New branch in {lane.name}
              </h2>
              <button
                type="button"
                onClick={() => setNewBranchOpen(false)}
                aria-label="Close new branch dialog"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="new-branch-title" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Task title
                </label>
                <input
                  id="new-branch-title"
                  type="text"
                  required
                  value={branchTitle}
                  onChange={(e) => setBranchTitle(e.target.value)}
                  placeholder="Example: Tighten sidebar row density"
                  className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
                  style={{
                    backgroundColor: 'var(--l-bg)',
                    borderColor: 'var(--l-line-strong)',
                    color: 'var(--l-text)',
                  }}
                />
              </div>
              <div>
                <label htmlFor="new-branch-agent" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Worker model
                </label>
                <select
                  id="new-branch-agent"
                  value={lane.isPrivate ? 'qwen' : branchAgent}
                  onChange={(e) => setBranchAgent(e.target.value as AgentId)}
                  disabled={lane.isPrivate}
                  className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
                  style={{
                    backgroundColor: 'var(--l-bg)',
                    borderColor: 'var(--l-line-strong)',
                    color: 'var(--l-text)',
                  }}
                >
                  {(lane.isPrivate ? AGENTS.filter((a) => a.localOnly) : AGENTS).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.modelName} ({a.label})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewBranchOpen(false)}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingBranch || !branchTitle.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-45"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                {creatingBranch ? <LoaderCircle size={14} className="lanes-spin" /> : <Plus size={14} />}
                <span>{creatingBranch ? 'Starting…' : 'Start branch'}</span>
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}

      {/* Lane Settings Modal */}
      {lane && (
        <AccessibleDialog
          open={settingsOpen}
          onClose={() => {
            setConfirmUnprivate(false);
            setSettingsOpen(false);
          }}
          ariaLabelledBy="lane-settings-dialog-title"
        >
          <form
            onSubmit={(e) => void handleSaveSettings(e)}
            className="max-h-[88vh] w-[min(520px,calc(100vw-2rem))] overflow-y-auto rounded-[14px] border p-5"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line)',
              boxShadow: 'var(--l-shadow-menu)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="lane-settings-dialog-title" className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Lane settings
              </h2>
              <button
                type="button"
                onClick={() => {
                  setConfirmUnprivate(false);
                  setSettingsOpen(false);
                }}
                aria-label="Close lane settings"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="lane-name-input" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Name
                </label>
                <input
                  id="lane-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>

              <div>
                <label htmlFor="lane-purpose-input" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Purpose
                </label>
                <input
                  id="lane-purpose-input"
                  type="text"
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                    Color
                  </span>
                  <div className="flex items-center gap-2">
                    {LANE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        aria-label={`Lane color ${c}`}
                        aria-pressed={editColor === c}
                        className="h-7 w-7 rounded-[7px] border-2"
                        style={{
                          backgroundColor: `var(--l-type-${c})`,
                          borderColor: editColor === c ? 'var(--l-text)' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="lane-icon-select" className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                    Icon
                  </label>
                  <select
                    id="lane-icon-select"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value as Lane['icon'])}
                    className="h-8 w-full rounded-[8px] border px-2 text-[13px]"
                    style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    {LANE_ICONS.map((ic) => (
                      <option key={ic.id} value={ic.id}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 rounded-[10px] border p-3" style={{ borderColor: downgradingPrivacy ? 'var(--l-needs)' : 'var(--l-line)', backgroundColor: downgradingPrivacy ? 'var(--l-needs-soft)' : 'var(--l-panel)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                      Local-only privacy
                    </p>
                    <p className="m-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      Locks to local Qwen, hides files from Library, and blocks bot access.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPrivate}
                    onChange={(e) => {
                      setEditPrivate(e.target.checked);
                      if (e.target.checked) setConfirmUnprivate(false);
                    }}
                    aria-label="Local-only privacy"
                    className="h-4 w-4 shrink-0 accent-[var(--l-accent)]"
                  />
                </div>
                {downgradingPrivacy && (
                  <label
                    className="flex cursor-pointer items-start gap-2 border-t pt-2.5 text-[12px]"
                    style={{ borderColor: 'var(--l-line)', color: 'var(--l-text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={confirmUnprivate}
                      onChange={(e) => setConfirmUnprivate(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--l-needs)]"
                    />
                    <span>
                      I understand turning off Local-only lets cloud models, Library, and Bots access this lane.
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label htmlFor="lane-approval-select" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Approval level
                </label>
                <select
                  id="lane-approval-select"
                  value={editApproval}
                  onChange={(e) => setEditApproval(e.target.value as ApprovalMode)}
                  className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                >
                  <option value="Ask">Asks first</option>
                  <option value="Safe-auto">Safe-auto</option>
                  <option value="Full">Edits alone</option>
                </select>
              </div>

              <div>
                <label htmlFor="lane-agents-md" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Lane instructions (AGENTS.md)
                </label>
                <textarea
                  id="lane-agents-md"
                  rows={4}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="w-full rounded-[8px] border p-2.5 font-mono text-[12px] leading-[1.5]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmUnprivate(false);
                  setSettingsOpen(false);
                }}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSettings || (downgradingPrivacy && !confirmUnprivate)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-45"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                {savingSettings && <LoaderCircle size={13} className="lanes-spin" />}
                <span>{savingSettings ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
}

function pickLeastUsedColor(lanes: Lane[]): LaneColorIndex {
  const counts = new Map<LaneColorIndex, number>(LANE_COLORS.map((c) => [c, 0]));
  for (const lane of lanes) {
    counts.set(lane.color, (counts.get(lane.color) ?? 0) + 1);
  }
  let best: LaneColorIndex = 1;
  let minCount = Infinity;
  for (const c of LANE_COLORS) {
    const count = counts.get(c) ?? 0;
    if (count < minCount) {
      minCount = count;
      best = c;
    }
  }
  return best;
}

export function NewLaneModal({
  open,
  existingLanes = [],
  submitting = false,
  onClose,
  onCreate,
}: {
  open: boolean;
  existingLanes?: Lane[];
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    purpose: string;
    color: LaneColorIndex;
    icon: Lane['icon'];
    isPrivate: boolean;
    approvalMode: ApprovalMode;
  }) => Promise<boolean | void>;
}) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [color, setColor] = useState<LaneColorIndex>(1);
  const [icon, setIcon] = useState<Lane['icon']>('layers');
  const [isPrivate, setIsPrivate] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('Safe-auto');

  useEffect(() => {
    if (open) {
      setColor(pickLeastUsedColor(existingLanes));
    }
  }, [open, existingLanes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    const ok = await onCreate({
      name: name.trim(),
      purpose: purpose.trim(),
      color,
      icon,
      isPrivate,
      approvalMode,
    });
    if (ok !== false) {
      setName('');
      setPurpose('');
      setIsPrivate(false);
      onClose();
    }
  }

  return (
    <AccessibleDialog open={open} onClose={onClose} ariaLabelledBy="new-lane-dialog-title">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-[min(460px,calc(100vw-2rem))] rounded-[14px] border p-5"
        style={{
          backgroundColor: 'var(--l-raised)',
          borderColor: 'var(--l-line)',
          boxShadow: 'var(--l-shadow-menu)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-lane-dialog-title" className="m-0 text-[16px] font-semibold" style={{ color: 'var(--l-text)' }}>
            New lane
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new lane dialog"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
            style={{ color: 'var(--l-muted)' }}
          >
            <X size={15} />
          </button>
        </div>
        <div className="space-y-3.5">
          <div>
            <label htmlFor="create-lane-name" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              Lane name
            </label>
            <input
              id="create-lane-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Clinic ops"
              className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            />
          </div>
          <div>
            <label htmlFor="create-lane-purpose" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              Purpose
            </label>
            <input
              id="create-lane-purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What belongs in this lane"
              className="h-9 w-full rounded-[8px] border px-3 text-[14px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Color
              </span>
              <div className="flex items-center gap-2">
                {LANE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                    className="h-7 w-7 rounded-[7px] border-2"
                    style={{
                      backgroundColor: `var(--l-type-${c})`,
                      borderColor: color === c ? 'var(--l-text)' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="create-lane-icon" className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Icon
              </label>
              <select
                id="create-lane-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value as Lane['icon'])}
                className="h-8 w-full rounded-[8px] border px-2 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                {LANE_ICONS.map((ic) => (
                  <option key={ic.id} value={ic.id}>
                    {ic.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}>
            <div>
              <p className="m-0 text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                Local-only private lane
              </p>
              <p className="m-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                Local models only, excluded from shared Library and bots.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              aria-label="Local-only private lane"
              className="h-4 w-4 shrink-0 accent-[var(--l-accent)]"
            />
          </div>
          <div>
            <label htmlFor="create-lane-approval" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
              Approval level
            </label>
            <select
              id="create-lane-approval"
              value={approvalMode}
              onChange={(e) => setApprovalMode(e.target.value as ApprovalMode)}
              className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              <option value="Ask">Asks first</option>
              <option value="Safe-auto">Safe-auto</option>
              <option value="Full">Edits alone</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
            style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-45"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            {submitting && <LoaderCircle size={13} className="lanes-spin" />}
            <span>{submitting ? 'Creating…' : 'Create lane'}</span>
          </button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
