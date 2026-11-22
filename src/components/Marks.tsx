import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDot,
  Code2,
  Compass,
  Cpu,
  Feather,
  FlaskConical,
  Layers,
  LoaderCircle,
  Orbit,
  PenLine,
  Sparkles,
  TerminalSquare,
  Wallet,
} from 'lucide-react';
import type { AgentId, Lane, LaneColorIndex, ThreadStatus } from '../lib/types';

export function LaneTile({
  color,
  icon,
  size = 'md',
}: {
  color: LaneColorIndex;
  icon: Lane['icon'];
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon =
    icon === 'flask'
      ? FlaskConical
      : icon === 'pen'
        ? PenLine
        : icon === 'wallet'
          ? Wallet
          : icon === 'code'
            ? Code2
            : icon === 'compass'
              ? Compass
              : Layers;

  const boxClass =
    size === 'sm' ? 'w-5 h-5 rounded-[6px]' : size === 'lg' ? 'w-9 h-9 rounded-[10px]' : 'w-6 h-6 rounded-[7px]';
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;

  return (
    <span
      className={`${boxClass} inline-flex items-center justify-center shrink-0`}
      style={{
        backgroundColor: `var(--l-type-${color}-soft)`,
        color: `var(--l-type-${color})`,
      }}
      aria-hidden="true"
    >
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  );
}

export function AgentGlyph({
  agentId,
  size = 'sm',
}: {
  agentId: AgentId;
  size?: 'xs' | 'sm' | 'md';
}) {
  const Icon =
    agentId === 'claude'
      ? Feather
      : agentId === 'codex'
        ? TerminalSquare
        : agentId === 'antigravity'
          ? Orbit
          : agentId === 'qwen'
            ? Cpu
            : Sparkles;

  const token =
    agentId === 'claude'
      ? 'claude'
      : agentId === 'codex'
        ? 'codex'
        : agentId === 'antigravity'
          ? 'antigravity'
          : agentId === 'qwen'
            ? 'qwen'
            : 'antigravity';

  const boxClass =
    size === 'xs' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const iconSize = size === 'xs' ? 10 : size === 'md' ? 13 : 11;

  return (
    <span
      className={`${boxClass} rounded-full inline-flex items-center justify-center shrink-0`}
      style={{
        backgroundColor: `var(--l-agent-${token}-soft)`,
        color: `var(--l-agent-${token})`,
      }}
      aria-hidden="true"
    >
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  );
}

export function StatusMark({
  status,
  label,
}: {
  status: ThreadStatus;
  label?: string;
}) {
  const prevStatusRef = useRef<ThreadStatus>(status);
  const [swapping, setSwapping] = useState(false);

  // Animate only when status transitions after mount — never when a row first appears (DESIGN.md)
  useEffect(() => {
    if (prevStatusRef.current === status) return;
    prevStatusRef.current = status;
    setSwapping(true);
    const timer = window.setTimeout(() => setSwapping(false), 280);
    return () => window.clearTimeout(timer);
  }, [status]);

  const swapClass = swapping ? 'lanes-status-swap' : '';

  if (status === 'working') {
    return (
      <LoaderCircle
        size={14}
        strokeWidth={2}
        className={`lanes-spin shrink-0 ${swapClass}`}
        style={{ color: 'var(--l-accent)' }}
        aria-label={label ?? 'Working'}
      />
    );
  }
  if (status === 'needs') {
    return (
      <CircleDot
        size={14}
        strokeWidth={2}
        className={`shrink-0 ${swapClass}`}
        style={{ color: 'var(--l-needs)' }}
        aria-label={label ?? 'Needs you'}
      />
    );
  }
  if (status === 'done') {
    return (
      <CheckCircle2
        size={14}
        strokeWidth={2}
        className={`shrink-0 ${swapClass}`}
        style={{ color: 'var(--l-ok)' }}
        aria-label={label ?? 'Done'}
      />
    );
  }
  if (status === 'failed') {
    return (
      <CircleAlert
        size={14}
        strokeWidth={2}
        className={`shrink-0 ${swapClass}`}
        style={{ color: 'var(--l-bad)' }}
        aria-label={label ?? 'Failed'}
      />
    );
  }
  return (
    <Circle
      size={14}
      strokeWidth={2}
      className={`shrink-0 ${swapClass}`}
      style={{ color: 'var(--l-muted)' }}
      aria-label={label ?? 'Idle'}
    />
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 text-[13px]"
      style={{
        backgroundColor: 'var(--l-bad-soft)',
        borderColor: 'var(--l-line)',
        color: 'var(--l-text)',
      }}
    >
      <span className="flex items-center gap-2">
        <CircleAlert size={15} style={{ color: 'var(--l-bad)' }} aria-hidden="true" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[8px] border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors hover:bg-[var(--l-hover)]"
          style={{
            backgroundColor: 'var(--l-raised)',
            borderColor: 'var(--l-line-strong)',
            color: 'var(--l-text)',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-[12px] border p-6"
      style={{
        backgroundColor: 'var(--l-panel)',
        borderColor: 'var(--l-line)',
      }}
    >
      <p className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
        {title}
      </p>
      <p className="m-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
        {detail}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--l-accent)',
            color: 'var(--l-on-accent)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
