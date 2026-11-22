import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  LoaderCircle,
  Lock,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Lane, LibraryItem, MemoryNote, ScheduledJob } from '../lib/types';
import { filterLibraryItems } from '../lib/workbench';
import { useTwoStepConfirm } from './AccessiblePrimitives';
import { EmptyState, LaneTile } from './Marks';

/* -------------------------------------------------------------------------- */
/* Scheduled Jobs                                                             */
/* -------------------------------------------------------------------------- */

interface ScheduledViewProps {
  jobs: ScheduledJob[];
  lanes: Lane[];
  isActionPending: (key: string) => boolean;
  onCreateJob: (payload: {
    name: string;
    laneId: string;
    cadence: string;
    prompt: string;
    onlyReportChanges: boolean;
  }) => Promise<boolean | void>;
  onJobAction: (jobId: string, action: 'toggle' | 'run') => Promise<boolean | void>;
}

export function ScheduledView({ jobs, lanes, isActionPending, onCreateJob, onJobAction }: ScheduledViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? '');
  const [cadence, setCadence] = useState('Weekdays at 08:00');
  const [prompt, setPrompt] = useState('');
  const [onlyReportChanges, setOnlyReportChanges] = useState(true);

  const visibleJobs = jobs.filter((j) => (filter === 'all' ? true : j.status === filter));
  const creatingJob = isActionPending('create-job');

  useEffect(() => {
    if (!lanes.some((l) => l.id === laneId)) {
      setLaneId(lanes[0]?.id ?? '');
    }
  }, [lanes, laneId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !laneId || creatingJob) return;
    const ok = await onCreateJob({
      name: name.trim(),
      laneId,
      cadence: cadence.trim() || 'Weekdays at 08:00',
      prompt: prompt.trim() || name.trim(),
      onlyReportChanges,
    });
    if (ok !== false) {
      setName('');
      setPrompt('');
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
            style={{ color: 'var(--l-text)' }}
          >
            Scheduled
          </h1>
          <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
            Recurring jobs that post back into their lane only when something changed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap"
          style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
        >
          <Plus size={14} />
          <span>New job</span>
        </button>
      </header>

      {creating && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mb-6 space-y-3 rounded-[12px] border p-4"
          style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="job-name" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Job name
              </label>
              <input
                id="job-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Morning PR diff check"
                className="h-9 w-full rounded-[8px] border px-3 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              />
            </div>
            <div>
              <label htmlFor="job-lane" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Target lane
              </label>
              <select
                id="job-lane"
                value={laneId}
                onChange={(e) => setLaneId(e.target.value)}
                className="h-9 w-full rounded-[8px] border px-2.5 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="job-cadence" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Cadence
              </label>
              <input
                id="job-cadence"
                type="text"
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                className="h-9 w-full rounded-[8px] border px-3 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              />
            </div>
            <div>
              <label htmlFor="job-prompt" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Prompt
              </label>
              <input
                id="job-prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What should the worker check"
                className="h-9 w-full rounded-[8px] border px-3 text-[13px]"
                style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: 'var(--l-text)' }}>
              <input
                type="checkbox"
                checked={onlyReportChanges}
                onChange={(e) => setOnlyReportChanges(e.target.checked)}
                className="h-4 w-4 accent-[var(--l-accent)]"
              />
              <span>Only report when something changed</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-8 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap"
                style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingJob || !name.trim() || !laneId}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-45"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                {creatingJob && <LoaderCircle size={13} className="lanes-spin" />}
                <span>{creatingJob ? 'Saving…' : 'Save job'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-1.5">
        {(['all', 'active', 'paused'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filter === tab}
            onClick={() => setFilter(tab)}
            className="h-8 rounded-[8px] px-3 text-[13px] font-medium capitalize whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
            style={{
              backgroundColor: filter === tab ? 'var(--l-selected)' : 'transparent',
              color: filter === tab ? 'var(--l-text)' : 'var(--l-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {visibleJobs.length === 0 ? (
        <EmptyState title="No jobs in this filter" detail="Create a scheduled job or switch filters." />
      ) : (
        <div className="space-y-3">
          {visibleJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-[12px] border p-4"
              style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                      {job.name}
                    </h2>
                    <span className="text-[12px]" style={{ color: job.status === 'active' ? 'var(--l-ok)' : 'var(--l-muted)' }}>
                      · {job.status}
                    </span>
                  </div>
                  <p className="mt-0.5 mb-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                    {job.laneName} · {job.cadence} · Next: {job.nextRun}
                    {job.onlyReportChanges ? ' · Only reports changes' : ''}
                  </p>
                  <p className="mt-2 mb-0 text-[13px]" style={{ color: 'var(--l-text)' }}>
                    {job.lastSummary}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* 7-run visual history */}
                  <div
                    role="img"
                    aria-label={`Recent ${job.history.length} runs: ${job.history.filter((h) => h === 'ok').length} reported, ${job.history.filter((h) => h === 'noop').length} no change, ${job.history.filter((h) => h === 'failed').length} failed`}
                    className="mr-2 flex items-center gap-1"
                    title="Recent runs (green = reported, gray = no change, red = failed)"
                  >
                    {job.history.map((h, i) => (
                      <span
                        key={i}
                        className="h-3.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            h === 'ok'
                              ? 'var(--l-ok)'
                              : h === 'failed'
                                ? 'var(--l-bad)'
                                : 'var(--l-line-strong)',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isActionPending(`job:${job.id}:run`)}
                    onClick={() => void onJobAction(job.id, 'run')}
                    className="inline-flex h-8 items-center gap-1 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--l-raised)',
                      borderColor: 'var(--l-line-strong)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {isActionPending(`job:${job.id}:run`) ? <LoaderCircle size={12} className="lanes-spin" /> : <Play size={12} />}
                    <span>{isActionPending(`job:${job.id}:run`) ? 'Running…' : 'Run now'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isActionPending(`job:${job.id}:toggle`)}
                    onClick={() => void onJobAction(job.id, 'toggle')}
                    className="inline-flex h-8 items-center gap-1 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--l-raised)',
                      borderColor: 'var(--l-line-strong)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {job.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                    <span>{job.status === 'active' ? 'Pause' : 'Resume'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Library (Cross-lane files, excluding private lanes)                        */
/* -------------------------------------------------------------------------- */

interface LibraryViewProps {
  items: LibraryItem[];
  lanes: Lane[];
  isActionPending: (key: string) => boolean;
  onAddFile: (payload: {
    name: string;
    folder?: string;
    laneId: string;
    kind: LibraryItem['kind'];
    preview: string;
    size?: string;
  }) => Promise<boolean | void>;
  onUpdateFile?: (
    itemId: string,
    patch: Partial<Pick<LibraryItem, 'name' | 'folder' | 'laneId' | 'kind' | 'preview'>>
  ) => Promise<boolean | void>;
  onDeleteFile?: (itemId: string) => Promise<boolean | void>;
}

function inferKindFromName(filename: string): LibraryItem['kind'] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'py', 'json', 'css', 'html', 'sh', 'rs', 'go', 'sql', 'glsl'].includes(ext)) {
    return 'code';
  }
  return 'doc';
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${Math.max(1, bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryView({
  items,
  lanes,
  isActionPending,
  onAddFile,
  onUpdateFile,
  onDeleteFile,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { armedKey, trigger, disarm } = useTwoStepConfirm();

  const nonPrivateLanes = lanes.filter((l) => !l.isPrivate);
  const [newName, setNewName] = useState('');
  const [newFolder, setNewFolder] = useState('General');
  const [newLaneId, setNewLaneId] = useState(nonPrivateLanes[0]?.id ?? '');
  const [newKind, setNewKind] = useState<LibraryItem['kind']>('doc');
  const [newPreview, setNewPreview] = useState('');
  const savingFile = isActionPending('add-file');

  // Inline editor state for the selected file
  const [editName, setEditName] = useState('');
  const [editFolder, setEditFolder] = useState('General');
  const [editLaneId, setEditLaneId] = useState('');
  const [editPreview, setEditPreview] = useState('');

  useEffect(() => {
    if (!nonPrivateLanes.some((l) => l.id === newLaneId)) {
      setNewLaneId(nonPrivateLanes[0]?.id ?? '');
    }
  }, [nonPrivateLanes, newLaneId]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (!item.isPrivateLane) {
        set.add(item.folder?.trim() || 'General');
      }
    }
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(() => {
    const base = filterLibraryItems(items, query, laneFilter, kindFilter);
    if (folderFilter === 'all') return base;
    return base.filter((i) => (i.folder?.trim() || 'General') === folderFilter);
  }, [items, query, laneFilter, kindFilter, folderFilter]);

  const selectedItem = visible.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedItem) {
      setEditName(selectedItem.name);
      setEditFolder(selectedItem.folder?.trim() || 'General');
      setEditLaneId(selectedItem.laneId);
      setEditPreview(selectedItem.preview);
    }
  }, [selectedItem?.id]);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newLaneId || savingFile) return;
    const ok = await onAddFile({
      name: newName.trim(),
      folder: newFolder.trim() || 'General',
      laneId: newLaneId,
      kind: newKind,
      preview: newPreview.trim() || 'Added manually to Library.',
    });
    if (ok !== false) {
      setNewName('');
      setNewPreview('');
      setAdding(false);
    }
  }

  async function handleDiskFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !newLaneId) return;
    for (const file of Array.from(fileList).slice(0, 8)) {
      const kind = inferKindFromName(file.name);
      let preview = `Uploaded ${file.name} (${formatByteSize(file.size)}).`;
      if (kind === 'doc' || kind === 'code') {
        try {
          const text = await file.text();
          preview = text.slice(0, 12000) || preview;
        } catch {
          // keep summary fallback
        }
      }
      await onAddFile({
        name: file.name,
        folder: folderFilter !== 'all' ? folderFilter : 'Uploads',
        laneId: laneFilter !== 'all' ? laneFilter : newLaneId,
        kind,
        preview,
        size: formatByteSize(file.size),
      });
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !onUpdateFile || !editName.trim()) return;
    await onUpdateFile(selectedItem.id, {
      name: editName.trim(),
      folder: editFolder.trim() || 'General',
      laneId: editLaneId || selectedItem.laneId,
      preview: editPreview,
    });
  }

  function handleDownloadSelected() {
    if (!selectedItem) return;
    const blob = new Blob([selectedItem.preview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedItem.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const updatingSelected = Boolean(selectedItem && isActionPending(`file-update:${selectedItem.id}`));
  const deletingSelected = Boolean(selectedItem && isActionPending(`file-delete:${selectedItem.id}`));
  const deleteArmed = Boolean(selectedItem && armedKey === `delete-file:${selectedItem.id}`);

  return (
    <div
      className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-8"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleDiskFiles(e.dataTransfer.files);
      }}
    >
      <header className="lanes-text-surface mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
            style={{ color: 'var(--l-text)' }}
          >
            Library &amp; File Manager
          </h1>
          <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
            Organize, upload, edit, and move files across non-private lanes. Drop files anywhere on this page to upload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleDiskFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={nonPrivateLanes.length === 0 || savingFile}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)] disabled:opacity-45"
            style={{
              backgroundColor: 'var(--l-raised)',
              borderColor: 'var(--l-line-strong)',
              color: 'var(--l-text)',
            }}
          >
            <Upload size={14} />
            <span>Upload from Mac</span>
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            <Plus size={14} />
            <span>New file</span>
          </button>
        </div>
      </header>

      {dragOver && (
        <div
          className="mb-4 rounded-[12px] border-2 border-dashed p-5 text-center text-[13px] font-medium"
          style={{
            borderColor: 'var(--l-accent)',
            backgroundColor: 'var(--l-accent-soft)',
            color: 'var(--l-text)',
          }}
        >
          Drop files here to add them to {laneFilter !== 'all' ? lanes.find((l) => l.id === laneFilter)?.name : 'Library'}
        </div>
      )}

      {adding && (
        <form
          onSubmit={(e) => void handleAddSubmit(e)}
          className="mb-6 space-y-3 rounded-[12px] border p-4"
          style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="File name (e.g. notes.md)"
              aria-label="File name"
              className="h-9 rounded-[8px] border px-3 text-[13px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            />
            <input
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Folder (e.g. Docs)"
              aria-label="Folder"
              className="h-9 rounded-[8px] border px-3 text-[13px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            />
            <select
              value={newLaneId}
              onChange={(e) => setNewLaneId(e.target.value)}
              aria-label="Lane"
              disabled={nonPrivateLanes.length === 0}
              className="h-9 rounded-[8px] border px-2.5 text-[13px] disabled:opacity-50"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              {nonPrivateLanes.length === 0 ? (
                <option value="">No shared lanes available</option>
              ) : (
                nonPrivateLanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as LibraryItem['kind'])}
              aria-label="File type"
              className="h-9 rounded-[8px] border px-2.5 text-[13px]"
              style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              <option value="doc">Document</option>
              <option value="code">Code</option>
              <option value="image">Image</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <textarea
            rows={4}
            value={newPreview}
            onChange={(e) => setNewPreview(e.target.value)}
            placeholder="File content or excerpt…"
            aria-label="File content"
            className="w-full rounded-[8px] border p-2.5 font-mono text-[12px]"
            style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-8 rounded-[8px] border px-3 text-[13px] font-medium"
              style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingFile || !newName.trim() || !newLaneId}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium disabled:opacity-45"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {savingFile && <LoaderCircle size={13} className="lanes-spin" />}
              <span>{savingFile ? 'Saving…' : 'Save file'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Folder pills */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={folderFilter === 'all'}
          onClick={() => setFolderFilter('all')}
          className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
          style={{
            backgroundColor: folderFilter === 'all' ? 'var(--l-selected)' : 'var(--l-panel)',
            borderColor: folderFilter === 'all' ? 'var(--l-accent)' : 'var(--l-line)',
            color: 'var(--l-text)',
          }}
        >
          <Folder size={12} aria-hidden="true" />
          <span>All folders</span>
        </button>
        {folders.map((folder) => (
          <button
            key={folder}
            type="button"
            aria-pressed={folderFilter === folder}
            onClick={() => setFolderFilter(folder)}
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
            style={{
              backgroundColor: folderFilter === folder ? 'var(--l-selected)' : 'var(--l-panel)',
              borderColor: folderFilter === folder ? 'var(--l-accent)' : 'var(--l-line)',
              color: 'var(--l-text)',
            }}
          >
            <Folder size={12} aria-hidden="true" />
            <span>{folder}</span>
          </button>
        ))}
      </div>

      {/* Search + filter controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div
          className="lanes-focus-ring flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-[8px] border px-3"
          style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)' }}
        >
          <Search size={14} style={{ color: 'var(--l-muted)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            aria-label="Search library"
            className="w-full border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--l-muted)]"
            style={{ color: 'var(--l-text)' }}
          />
        </div>
        <select
          value={laneFilter}
          onChange={(e) => setLaneFilter(e.target.value)}
          aria-label="Filter by lane"
          className="h-9 rounded-[8px] border px-2.5 text-[13px]"
          style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
        >
          <option value="all">All lanes</option>
          {nonPrivateLanes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          aria-label="Filter by kind"
          className="h-9 rounded-[8px] border px-2.5 text-[13px]"
          style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
        >
          <option value="all">All types</option>
          <option value="doc">Documents</option>
          <option value="code">Code</option>
          <option value="image">Images</option>
          <option value="pdf">PDFs</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className={selectedItem ? 'lg:col-span-3' : 'lg:col-span-5'}>
          {visible.length === 0 ? (
            <EmptyState title="No matching files" detail="Try clearing filters, creating a file, or dropping files from your Mac." />
          ) : (
            <div
              className="divide-y rounded-[12px] border"
              style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
            >
              {visible.map((item) => {
                const Icon =
                  item.kind === 'code' ? FileCode2 : item.kind === 'image' ? FileImage : FileText;
                const active = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(active ? null : item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      borderColor: 'var(--l-line)',
                      backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--l-muted)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[14px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {item.name}
                      </p>
                      <p className="m-0 truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {item.folder || 'General'} · {item.laneName} · {item.origin}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
                      {item.size} · {item.updatedAt}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedItem && (
          <aside
            className="rounded-[12px] border p-4 lg:col-span-2"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <form onSubmit={(e) => void handleSaveEdit(e)} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 break-all text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                  File inspector
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close file inspector"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
                  style={{ color: 'var(--l-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <label htmlFor="lib-edit-name" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Name
                </label>
                <input
                  id="lib-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-full rounded-[7px] border px-2.5 text-[13px]"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="lib-edit-folder" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                    Folder
                  </label>
                  <input
                    id="lib-edit-folder"
                    type="text"
                    value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    className="h-8 w-full rounded-[7px] border px-2.5 text-[12px]"
                    style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  />
                </div>
                <div>
                  <label htmlFor="lib-edit-lane" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                    Lane
                  </label>
                  <select
                    id="lib-edit-lane"
                    value={editLaneId}
                    onChange={(e) => setEditLaneId(e.target.value)}
                    className="h-8 w-full rounded-[7px] border px-2 text-[12px]"
                    style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    {nonPrivateLanes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="lib-edit-content" className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Content / notes ({selectedItem.size})
                </label>
                <textarea
                  id="lib-edit-content"
                  rows={7}
                  value={editPreview}
                  onChange={(e) => setEditPreview(e.target.value)}
                  className="w-full rounded-[7px] border p-2 font-mono text-[12px] leading-relaxed"
                  style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadSelected}
                    title="Download file"
                    className="inline-flex h-7 items-center gap-1 rounded-[7px] border px-2 text-[12px] font-medium hover:bg-[var(--l-hover)]"
                    style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                  {onDeleteFile && (
                    <>
                      {deleteArmed && !deletingSelected && (
                        <button
                          type="button"
                          onClick={disarm}
                          className="h-7 rounded-[7px] border px-2 text-[12px] hover:bg-[var(--l-hover)]"
                          style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingSelected}
                        onClick={() =>
                          trigger(`delete-file:${selectedItem.id}`, async () => {
                            const ok = await onDeleteFile(selectedItem.id);
                            if (ok !== false) setSelectedId(null);
                          })
                        }
                        className="inline-flex h-7 items-center gap-1 rounded-[7px] border px-2 text-[12px] font-medium disabled:opacity-50"
                        style={{
                          backgroundColor: deleteArmed ? 'var(--l-bad)' : 'transparent',
                          borderColor: deleteArmed ? 'var(--l-bad)' : 'var(--l-line)',
                          color: deleteArmed ? 'var(--l-on-bad)' : 'var(--l-muted)',
                        }}
                      >
                        <Trash2 size={12} />
                        <span>{deleteArmed ? 'Confirm' : 'Delete'}</span>
                      </button>
                    </>
                  )}
                </div>

                {onUpdateFile && (
                  <button
                    type="submit"
                    disabled={updatingSelected || !editName.trim()}
                    className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[12px] font-medium disabled:opacity-45"
                    style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                  >
                    {updatingSelected ? <LoaderCircle size={12} className="lanes-spin" /> : <Save size={12} />}
                    <span>Save</span>
                  </button>
                )}
              </div>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Memory (Pending approval + Approved notes, respecting Local-only lanes)    */
/* -------------------------------------------------------------------------- */

interface MemoryViewProps {
  notes: MemoryNote[];
  lanes: Lane[];
  isActionPending: (key: string) => boolean;
  onAddNote: (laneId: string, text: string) => Promise<boolean | void>;
  onUpdateStatus: (noteId: string, status: 'approved' | 'dismissed') => Promise<boolean | void>;
}

export function MemoryView({ notes, lanes, isActionPending, onAddNote, onUpdateStatus }: MemoryViewProps) {
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? '');
  const [text, setText] = useState('');

  const pending = notes.filter((n) => n.status === 'pending');
  const approved = notes.filter((n) => n.status === 'approved');
  const addingNote = isActionPending('add-memory');

  useEffect(() => {
    if (!lanes.some((l) => l.id === laneId)) {
      setLaneId(lanes[0]?.id ?? '');
    }
  }, [lanes, laneId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !laneId || addingNote) return;
    const ok = await onAddNote(laneId, text.trim());
    if (ok !== false) {
      setText('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1
          className="m-0 text-[24px] font-[650] leading-[1.2] tracking-[-0.015em]"
          style={{ color: 'var(--l-text)' }}
        >
          Memory
        </h1>
        <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
          Notes agents remember per lane. Drafted facts wait for your approval before future threads use them.
        </p>
      </header>

      {/* Add note form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mb-8 rounded-[12px] border p-3.5"
        style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <select
            value={laneId}
            onChange={(e) => setLaneId(e.target.value)}
            aria-label="Lane for memory note"
            className="h-9 rounded-[8px] border px-2.5 text-[13px] sm:w-[180px]"
            style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
          >
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.isPrivate ? ' (local-only)' : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a durable preference or project rule for this lane…"
            aria-label="Memory note text"
            className="h-9 flex-1 rounded-[8px] border px-3 text-[13px]"
            style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
          />
          <button
            type="submit"
            disabled={addingNote || !text.trim() || !laneId}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
          >
            {addingNote ? <LoaderCircle size={14} className="lanes-spin" /> : <Plus size={14} />}
            <span>{addingNote ? 'Saving…' : 'Add note'}</span>
          </button>
        </div>
      </form>

      {/* Pending approval */}
      <section className="mb-8" aria-labelledby="memory-pending-heading">
        <h2 id="memory-pending-heading" className="mb-2.5 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
          Waiting for approval{' '}
          <span className="ml-1 text-[13px] font-normal tabular-nums" style={{ color: 'var(--l-accent)' }}>
            {pending.length}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="m-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
            No drafted memory notes waiting right now.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pending.map((note) => {
              const lane = lanes.find((l) => l.id === note.laneId);
              return (
                <div
                  key={note.id}
                  className="rounded-[12px] border p-4"
                  style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
                >
                  <div className="flex items-start gap-2.5">
                    {lane && <LaneTile color={lane.color} icon={lane.icon} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[14px] leading-[1.5]" style={{ color: 'var(--l-text)' }}>
                        {note.text}
                      </p>
                      <p className="mt-1 mb-0 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                        {note.laneName} · from {note.sourceThread} · {note.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isActionPending(`memory:${note.id}`)}
                      onClick={() => void onUpdateStatus(note.id, 'approved')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium whitespace-nowrap disabled:opacity-50"
                      style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                    >
                      {isActionPending(`memory:${note.id}`) ? <LoaderCircle size={13} className="lanes-spin" /> : <Check size={13} />}
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={isActionPending(`memory:${note.id}`)}
                      onClick={() => void onUpdateStatus(note.id, 'dismissed')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)] disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--l-raised)',
                        borderColor: 'var(--l-line-strong)',
                        color: 'var(--l-text)',
                      }}
                    >
                      <X size={13} />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Approved notes */}
      <section aria-labelledby="memory-approved-heading">
        <h2 id="memory-approved-heading" className="mb-2.5 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
          Approved notes{' '}
          <span className="ml-1 text-[13px] font-normal tabular-nums" style={{ color: 'var(--l-muted)' }}>
            {approved.length}
          </span>
        </h2>
        {approved.length === 0 ? (
          <EmptyState title="No approved notes" detail="Approve drafted notes above or add one manually." />
        ) : (
          <div
            className="divide-y rounded-[12px] border"
            style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-panel)' }}
          >
            {approved.map((note) => {
              const lane = lanes.find((l) => l.id === note.laneId);
              return (
                <div key={note.id} className="flex items-start gap-3 px-4 py-3.5" style={{ borderColor: 'var(--l-line)' }}>
                  {lane && <LaneTile color={lane.color} icon={lane.icon} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] leading-[1.5]" style={{ color: 'var(--l-text)' }}>
                      {note.text}
                    </p>
                    <p className="mt-1 mb-0 flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      <span>{note.laneName}</span>
                      <span>· {note.sourceThread}</span>
                      <span>· {note.createdAt}</span>
                      {note.localOnly && (
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--l-text)' }}>
                          · <Lock size={11} /> Local-only
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onUpdateStatus(note.id, 'dismissed')}
                    title="Remove note"
                    aria-label="Remove note"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] hover:bg-[var(--l-hover)]"
                    style={{ color: 'var(--l-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
