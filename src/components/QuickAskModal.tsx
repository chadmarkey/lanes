import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ExternalLink, Globe, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react';
import type { GeminiModelId, GroundingSource } from '../lib/types';
import { readJsonSafe, resolveApiUrl } from '../lib/tauri';
import { GEMINI_CHAT_MODELS } from '../lib/workbench';
import { AccessibleDialog } from './AccessiblePrimitives';

interface QuickAskModalProps {
  open: boolean;
  contextLabel: string;
  onClose: () => void;
}

interface QuickMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  modelLabel?: string;
  sources?: GroundingSource[];
}

export function QuickAskModal({ open, contextLabel, onClose }: QuickAskModalProps) {
  const [messages, setMessages] = useState<QuickMsg[]>([]);
  const [input, setInput] = useState('');
  const [modelId, setModelId] = useState<GeminiModelId>('gemini-4-hydrogen');
  const [useSearch, setUseSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, messages.length, sending]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: trimmed }]);

    try {
      const res = await fetch(resolveApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          laneName: contextLabel,
          modelId: useSearch ? 'gemini-4-hydrogen' : modelId,
          useSearch,
          history,
        }),
      });
      const data = await readJsonSafe<{
        reply?: string;
        error?: string;
        modelLabel?: string;
        sources?: GroundingSource[];
      }>(res);
      if (res.ok && data?.reply) {
        setInput('');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text:
            res.ok && data?.reply
              ? data.reply
              : data?.error || `Could not reach Quick ask (HTTP ${res.status}).`,
          modelLabel: data?.modelLabel,
          sources: Array.isArray(data?.sources) ? data.sources : undefined,
        },
      ]);
    } catch {
      // Preserve draft in input and roll back optimistic bubble if request failed to send
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userMsgId),
        { id: `e-${Date.now()}`, role: 'assistant', text: 'Network error. Your draft is still in the box — try again.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <AccessibleDialog open={open} onClose={onClose} ariaLabel="Quick ask" initialFocusRef={inputRef} align="top">
      <div
        className="flex max-h-[76vh] w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[14px] border"
        style={{
          backgroundColor: 'var(--l-raised)',
          borderColor: 'var(--l-line)',
          boxShadow: 'var(--l-shadow-menu)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--l-line)' }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={15} style={{ color: 'var(--l-accent)' }} />
            <span className="text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
              Quick ask
            </span>
            <span className="truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
              · {contextLabel} · Separate from Assistant
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                title="New chat"
                aria-label="New chat"
                className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <RotateCcw size={12} />
                <span>New chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close Quick ask (Esc)"
              aria-label="Close Quick ask"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
              style={{ color: 'var(--l-muted)' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Model & Search toolbar */}
        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
          style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
        >
          <label htmlFor="quick-ask-model" className="sr-only">
            Gemini model
          </label>
          <select
            id="quick-ask-model"
            value={useSearch ? 'gemini-4-hydrogen' : modelId}
            onChange={(e) => {
              setModelId(e.target.value as GeminiModelId);
              if (e.target.value !== 'gemini-4-hydrogen') setUseSearch(false);
            }}
            className="h-7 rounded-[7px] border px-2 text-[12px] font-medium outline-none"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          >
            {GEMINI_CHAT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.tier}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUseSearch((v) => !v)}
            aria-pressed={useSearch}
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: useSearch ? 'var(--l-accent-soft)' : 'var(--l-raised)',
              borderColor: useSearch ? 'var(--l-accent)' : 'var(--l-line)',
              color: useSearch ? 'var(--l-accent)' : 'var(--l-muted)',
            }}
          >
            <Globe size={12} aria-hidden="true" />
            <span>Google Search</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="m-0 text-[13px] leading-[1.55]" style={{ color: 'var(--l-muted)' }}>
              Multi-turn Gemini chat kept separate from your lane thread and Assistant history. Toggle Google Search for live web grounding.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}>
                  {m.role === 'user' ? (
                    <div
                      className="max-w-[85%] rounded-[10px] border px-3 py-2 text-[13px]"
                      style={{
                        backgroundColor: 'var(--l-panel)',
                        borderColor: 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      {m.text}
                    </div>
                  ) : (
                    <div className="w-full">
                      {m.modelLabel && (
                        <p className="mt-0 mb-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                          {m.modelLabel}
                        </p>
                      )}
                      <p className="m-0 text-[14px] leading-[1.55] whitespace-pre-wrap" style={{ color: 'var(--l-text)' }}>
                        {m.text}
                      </p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[12px] hover:bg-[var(--l-hover)]"
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
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--l-muted)' }} role="status">
                  <LoaderCircle size={14} className="lanes-spin" />
                  <span>Thinking…</span>
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex items-center gap-2 border-t p-3"
          style={{ borderColor: 'var(--l-line)' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything quickly…"
            aria-label="Quick ask prompt"
            className="h-9 flex-1 rounded-[9px] border px-3 text-[14px] placeholder:text-[var(--l-muted)]"
            style={{
              backgroundColor: 'var(--l-bg)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label={sending ? 'Sending Quick ask' : 'Send Quick ask'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            {sending ? <LoaderCircle size={15} className="lanes-spin" /> : <ArrowUp size={15} />}
          </button>
        </form>
      </div>
    </AccessibleDialog>
  );
}
