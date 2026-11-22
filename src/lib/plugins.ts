export type PluginCategory = 'code' | 'research' | 'files' | 'web' | 'media' | 'automation';

export interface PluginDef {
  id: string;
  name: string;
  category: PluginCategory;
  description: string;
  /** True when safe to run inside private local-only lanes (no cloud calls). */
  localSafe: boolean;
}

export const WORKSPACE_PLUGINS: PluginDef[] = [
  {
    id: 'ghostty-terminal',
    name: 'Ghostty Terminal',
    category: 'code',
    description: 'Run commands and inspect local git branches in an embedded Ghostty shell.',
    localSafe: true,
  },
  {
    id: 'git-diffs',
    name: 'Git & Diff Review',
    category: 'code',
    description: 'Inspect patches, stage files, and review branch diffs before merge.',
    localSafe: true,
  },
  {
    id: 'file-manager',
    name: 'Library & File Manager',
    category: 'files',
    description: 'Read, organize, and attach local lane documents and artifacts.',
    localSafe: true,
  },
  {
    id: 'pdf-reader',
    name: 'PDF & Paper Reader',
    category: 'research',
    description: 'Extract quotes, tables, and page-grounded citations from local PDFs.',
    localSafe: true,
  },
  {
    id: 'memory-sync',
    name: 'Shared Memory',
    category: 'automation',
    description: 'Read approved lane notes and draft new durable notes on completion.',
    localSafe: true,
  },
  {
    id: 'lint-test',
    name: 'Lint & Test Runner',
    category: 'code',
    description: 'Run typechecks and test suites before marking worker branches ready.',
    localSafe: true,
  },
  {
    id: 'web-search',
    name: 'Web Search Grounding',
    category: 'web',
    description: 'Search live web sources and cite URLs in replies (cloud only).',
    localSafe: false,
  },
  {
    id: 'github-prs',
    name: 'GitHub PRs & Issues',
    category: 'code',
    description: 'Track pull requests, review threads, and CI status (cloud only).',
    localSafe: false,
  },
  {
    id: 'calendar-mail',
    name: 'Calendar & Mail Triage',
    category: 'automation',
    description: 'Check schedule conflicts and draft follow-up notes (cloud only).',
    localSafe: false,
  },
  {
    id: 'media-voice',
    name: 'Media & Voice Studio',
    category: 'media',
    description: 'Generate images, video, music, and transcribe voice clips (cloud only).',
    localSafe: false,
  },
];

export const VALID_PLUGIN_IDS = new Set(WORKSPACE_PLUGINS.map((p) => p.id));

export function getPlugin(id: string): PluginDef | undefined {
  return WORKSPACE_PLUGINS.find((p) => p.id === id);
}

export function sanitizePluginIds(raw: unknown, localOnly = false): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || seen.has(item)) continue;
    const def = getPlugin(item);
    if (!def) continue;
    if (localOnly && !def.localSafe) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
