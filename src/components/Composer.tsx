import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Compass,
  Folder,
  GitBranch,
  Globe,
  Hammer,
  LoaderCircle,
  Lock,
  MessageSquare,
  Mic,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Square,
} from 'lucide-react';
import type { AgentId, ApprovalMode, ComposerMode, ComposerOutput, GeminiModelId } from '../lib/types';
import { readJsonSafe, resolveApiUrl } from '../lib/tauri';
import { AGENTS, GEMINI_CHAT_MODELS, getAgent, getGeminiModel } from '../lib/workbench';
import { useDismissibleMenu } from './AccessiblePrimitives';
import { AgentGlyph } from './Marks';

interface ComposerProps {
  placeholder?: string;
  draftKey?: string;
  laneName: string;
  isPrivate?: boolean;
  defaultAgentId: AgentId;
  defaultApprovalMode?: ApprovalMode;
  sending?: boolean;
  showBranchOption?: boolean;
  onNotify?: (msg: string, tone?: 'info' | 'error') => void;
  onSend: (payload: {
    text: string;
    mode: ComposerMode;
    agentId: AgentId;
    modelId: GeminiModelId;
    useSearch: boolean;
    output: ComposerOutput;
    approvalMode: ApprovalMode;
  }) => Promise<boolean | void> | boolean | void;
}

const MODES: ComposerMode[] = ['Build', 'Plan', 'Ask'];
const OUTPUTS: ComposerOutput[] = ['Reply here', 'Branch', 'Page'];
const APPROVALS: ApprovalMode[] = ['Ask', 'Safe-auto', 'Full'];

export function Composer({
  placeholder = 'Ask anything…',
  draftKey,
  laneName,
  isPrivate = false,
  defaultAgentId,
  defaultApprovalMode = 'Safe-auto',
  sending = false,
  showBranchOption = true,
  onNotify,
  onSend,
}: ComposerProps) {
  // P0 privacy: isolate unsent drafts per lane so confidential text from a Private lane never leaks into a public lane
  const resolvedDraftKey = draftKey ?? laneName;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const text = drafts[resolvedDraftKey] ?? '';
  const setText = (next: string | ((prev: string) => string)) => {
    setDrafts((prev) => {
      const curr = prev[resolvedDraftKey] ?? '';
      const value = typeof next === 'function' ? next(curr) : next;
      return { ...prev, [resolvedDraftKey]: value };
    });
  };
  const [mode, setMode] = useState<ComposerMode>('Build');
  const [agentId, setAgentId] = useState<AgentId>(isPrivate ? 'qwen' : defaultAgentId);
  const [modelId, setModelId] = useState<GeminiModelId>('gemini-4-hydrogen');
  const [useSearch, setUseSearch] = useState(false);
  const [output, setOutput] = useState<ComposerOutput>('Reply here');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(defaultApprovalMode);
  const [openMenu, setOpenMenu] = useState<'mode' | 'model' | 'output' | 'approval' | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useDismissibleMenu(openMenu, setOpenMenu, toolbarRef);

  useEffect(() => {
    setAgentId(isPrivate ? 'qwen' : defaultAgentId);
    if (isPrivate) setUseSearch(false);
  }, [isPrivate, defaultAgentId]);

  // P0 safety: always sync approvalMode when switching lanes so Edits alone never leaks into Asks first
  useEffect(() => {
    setApprovalMode(defaultApprovalMode);
    setOpenMenu(null);
  }, [defaultApprovalMode, laneName]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const effectiveAgentId: AgentId = isPrivate ? 'qwen' : agentId;
  const agent = getAgent(effectiveAgentId);
  const selectedGemini = getGeminiModel(useSearch ? 'gemini-4-hydrogen' : modelId);
  const availableAgents = isPrivate ? AGENTS.filter((a) => a.localOnly) : AGENTS;

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setOpenMenu(null);
    const ok = await onSend({
      text: trimmed,
      mode,
      agentId: effectiveAgentId,
      modelId: useSearch ? 'gemini-4-hydrogen' : modelId,
      useSearch: isPrivate ? false : useSearch,
      output: showBranchOption ? output : 'Reply here',
      approvalMode,
    });
    if (ok !== false) {
      setText('');
    }
  }

  async function handleToggleDictation() {
    if (transcribing) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result || '');
          const idx = dataUrl.indexOf(',');
          const audioBase64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
          const cleanMime = (blob.type || 'audio/webm').split(';')[0];
          setTranscribing(true);
          try {
            const res = await fetch(resolveApiUrl('/api/gemini/transcribe'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64, mimeType: cleanMime }),
            });
            const data = await readJsonSafe<{ transcript?: string; error?: string }>(res);
            if (!res.ok || !data?.transcript) {
              throw new Error(data?.error || `Transcription failed (HTTP ${res.status}).`);
            }
            const transcript = data.transcript;
            setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
            onNotify?.('Transcribed voice note', 'info');
          } catch (err) {
            onNotify?.(err instanceof Error ? err.message : 'Could not transcribe audio.', 'error');
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Microphone access is required for dictation.', 'error');
    }
  }

  const approvalLabel =
    approvalMode === 'Ask' ? 'Asks first' : approvalMode === 'Full' ? 'Edits alone' : 'Safe-auto';

  const modelButtonText = isPrivate
    ? agent.modelName
    : effectiveAgentId === 'gemini'
      ? selectedGemini.label
      : `${agent.modelName} · ${selectedGemini.shortLabel}`;

  return (
    <div className="mx-auto w-full max-w-[768px]">
      <div
        className="lanes-focus-ring relative rounded-[14px] border p-2.5 transition-colors"
        style={{
          backgroundColor: 'var(--l-raised)',
          borderColor: 'var(--l-line)',
          boxShadow: 'var(--l-shadow-raised)',
        }}
      >
        <label htmlFor={`composer-${laneName}`} className="sr-only">
          Message {laneName}
        </label>
        <textarea
          id={`composer-${laneName}`}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          className="w-full resize-none border-0 bg-transparent px-1.5 py-1 text-[15px] leading-[1.45] outline-none placeholder:text-[var(--l-muted)]"
          style={{ color: 'var(--l-text)' }}
        />

        <div ref={toolbarRef} className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* Mode selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'mode' ? null : 'mode')}
              aria-label={`Mode: ${mode}`}
              aria-expanded={openMenu === 'mode'}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                borderColor: 'var(--l-line)',
                color: 'var(--l-text)',
                backgroundColor: 'transparent',
              }}
            >
              {mode === 'Build' ? (
                <Hammer size={12} />
              ) : mode === 'Plan' ? (
                <Compass size={12} />
              ) : (
                <MessageSquare size={12} />
              )}
              <span>{mode}</span>
            </button>
            {openMenu === 'mode' && (
              <div
                role="menu"
                className="lanes-menu-pop absolute bottom-9 left-0 z-30 min-w-[132px] rounded-[10px] border p-1"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line)',
                  boxShadow: 'var(--l-shadow-menu)',
                }}
              >
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMode(m);
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: mode === m ? 'var(--l-selected)' : 'transparent',
                      color: 'var(--l-text)',
                    }}
                  >
                    <span>{m}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model & Agent selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
              aria-label={`Model: ${modelButtonText}`}
              aria-expanded={openMenu === 'model'}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                borderColor: 'var(--l-line)',
                color: 'var(--l-text)',
              }}
            >
              <AgentGlyph agentId={agent.id} size="xs" />
              <span>{modelButtonText}</span>
            </button>
            {openMenu === 'model' && (
              <div
                role="menu"
                className="lanes-menu-pop absolute bottom-9 left-0 z-30 w-[min(272px,calc(100vw-2rem))] rounded-[10px] border p-1.5"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line)',
                  boxShadow: 'var(--l-shadow-menu)',
                }}
              >
                {isPrivate ? (
                  <>
                    <p className="m-0 px-2.5 py-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      Private lane — local models only
                    </p>
                    {availableAgents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAgentId(a.id);
                          setOpenMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                        style={{
                          backgroundColor: effectiveAgentId === a.id ? 'var(--l-selected)' : 'transparent',
                          color: 'var(--l-text)',
                        }}
                      >
                        <AgentGlyph agentId={a.id} size="xs" />
                        <span className="font-medium">{a.modelName}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <p className="m-0 px-2.5 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                      Gemini chat model
                    </p>
                    {GEMINI_CHAT_MODELS.map((gm) => {
                      const active = selectedGemini.id === gm.id;
                      return (
                        <button
                          key={gm.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setModelId(gm.id);
                            if (gm.id !== 'gemini-4-hydrogen') setUseSearch(false);
                            setAgentId('gemini');
                            setOpenMenu(null);
                          }}
                          className="flex w-full flex-col rounded-[6px] px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--l-hover)]"
                          style={{
                            backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                            color: 'var(--l-text)',
                          }}
                        >
                          <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                            <span>{gm.label}</span>
                            <span className="text-[12px] font-normal" style={{ color: 'var(--l-muted)' }}>
                              {gm.tier}
                            </span>
                          </span>
                          <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                            {gm.description}
                          </span>
                        </button>
                      );
                    })}
                    <div className="my-1.5 h-px" style={{ backgroundColor: 'var(--l-line)' }} />
                    <p className="m-0 px-2.5 py-1 text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                      Worker profile
                    </p>
                    {availableAgents
                      .filter((a) => a.id !== 'gemini' && !a.localOnly)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAgentId(a.id);
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                          style={{
                            backgroundColor: effectiveAgentId === a.id ? 'var(--l-selected)' : 'transparent',
                            color: 'var(--l-text)',
                          }}
                        >
                          <AgentGlyph agentId={a.id} size="xs" />
                          <span className="font-medium">{a.label}</span>
                          <span className="ml-auto text-[12px]" style={{ color: 'var(--l-muted)' }}>
                            {a.effort}
                          </span>
                        </button>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Google Search grounding toggle */}
          {!isPrivate && (
            <button
              type="button"
              onClick={() => setUseSearch((v) => !v)}
              aria-pressed={useSearch}
              title="Ground reply with live Google Search results (gemini-4-hydrogen)"
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                backgroundColor: useSearch ? 'var(--l-accent-soft)' : 'transparent',
                borderColor: useSearch ? 'var(--l-accent)' : 'var(--l-line)',
                color: useSearch ? 'var(--l-accent)' : 'var(--l-muted)',
              }}
            >
              <Globe size={12} aria-hidden="true" />
              <span>Search</span>
            </button>
          )}

          {/* Output selector */}
          {showBranchOption && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'output' ? null : 'output')}
                aria-label={`Output: ${output}`}
                aria-expanded={openMenu === 'output'}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  borderColor: output === 'Branch' ? 'var(--l-accent)' : 'var(--l-line)',
                  color: 'var(--l-text)',
                }}
              >
                {output === 'Branch' ? <GitBranch size={12} /> : <MessageSquare size={12} />}
                <span>{output}</span>
              </button>
              {openMenu === 'output' && (
                <div
                  role="menu"
                  className="lanes-menu-pop absolute bottom-9 left-0 z-30 min-w-[150px] rounded-[10px] border p-1"
                  style={{
                    backgroundColor: 'var(--l-raised)',
                    borderColor: 'var(--l-line)',
                    boxShadow: 'var(--l-shadow-menu)',
                  }}
                >
                  {OUTPUTS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOutput(o);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                      style={{
                        backgroundColor: output === o ? 'var(--l-selected)' : 'transparent',
                        color: 'var(--l-text)',
                      }}
                    >
                      <span>{o}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Approval selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'approval' ? null : 'approval')}
              aria-label={`Approval: ${approvalLabel}`}
              aria-expanded={openMenu === 'approval'}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
              style={{
                borderColor: approvalMode === 'Full' ? 'var(--l-needs)' : 'var(--l-line)',
                color: approvalMode === 'Full' ? 'var(--l-needs)' : 'var(--l-text)',
              }}
            >
              {approvalMode === 'Full' ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
              <span>{approvalLabel}</span>
            </button>
            {openMenu === 'approval' && (
              <div
                role="menu"
                className="lanes-menu-pop absolute bottom-9 left-0 z-30 min-w-[180px] rounded-[10px] border p-1"
                style={{
                  backgroundColor: 'var(--l-raised)',
                  borderColor: 'var(--l-line)',
                  boxShadow: 'var(--l-shadow-menu)',
                }}
              >
                {APPROVALS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setApprovalMode(a);
                      setOpenMenu(null);
                    }}
                    className="flex w-full flex-col rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: approvalMode === a ? 'var(--l-selected)' : 'transparent',
                      color: 'var(--l-text)',
                    }}
                  >
                    <span className="font-medium">
                      {a === 'Ask' ? 'Asks first' : a === 'Full' ? 'Edits alone' : 'Safe-auto'}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      {a === 'Ask'
                        ? 'Every action outside sandbox asks'
                        : a === 'Full'
                          ? 'Runs everything except safety floor'
                          : 'Reads and saved rules run'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {text.length > 200 && (
              <span
                className="hidden text-[12px] tabular-nums sm:inline-flex"
                style={{ color: 'var(--l-muted)' }}
              >
                {text.length.toLocaleString()} chars
              </span>
            )}

            {/* Audio transcription button (gemini-3.5-transcribe) */}
            {!isPrivate && (
              <button
                type="button"
                onClick={() => void handleToggleDictation()}
                disabled={transcribing}
                aria-label={recording ? 'Stop recording and transcribe' : 'Dictate audio'}
                title={recording ? 'Stop recording and transcribe' : 'Dictate with gemini-3.5-transcribe'}
                className="lanes-press inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                style={{
                  backgroundColor: recording ? 'var(--l-bad)' : 'transparent',
                  borderColor: recording ? 'var(--l-bad)' : 'var(--l-line)',
                  color: recording ? 'var(--l-on-bad)' : 'var(--l-muted)',
                }}
              >
                {transcribing ? (
                  <LoaderCircle size={14} className="lanes-spin" />
                ) : recording ? (
                  <Square size={11} fill="currentColor" />
                ) : (
                  <Mic size={14} />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={sending || !text.trim()}
              aria-label={sending ? 'Sending message' : 'Send message'}
              title={sending ? 'Sending…' : 'Send (Enter)'}
              className="lanes-press inline-flex h-8 w-8 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: 'var(--l-accent)',
                color: 'var(--l-on-accent)',
              }}
            >
              {sending ? <LoaderCircle size={15} className="lanes-spin" /> : <ArrowUp size={15} strokeWidth={2.2} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className="mt-1.5 flex flex-wrap items-center gap-3 px-2 text-[12px]"
        style={{ color: 'var(--l-muted)' }}
      >
        <span className="inline-flex items-center gap-1">
          <Monitor size={12} aria-hidden="true" />
          <span>Local workspace</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Folder size={12} aria-hidden="true" />
          <span>{laneName}</span>
        </span>
        {useSearch && !isPrivate && (
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--l-accent)' }}>
            <Globe size={12} aria-hidden="true" />
            <span>Google Search grounded</span>
          </span>
        )}
        {isPrivate && (
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--l-text)' }}>
            <Lock size={12} aria-hidden="true" />
            <span>Local-only</span>
          </span>
        )}
      </div>
    </div>
  );
}
