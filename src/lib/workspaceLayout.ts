export type TerminalDockPosition = 'bottom' | 'right' | 'left';
export type WorkerDockPosition = 'right' | 'left';

export interface WorkspaceLayout {
  terminalDock: TerminalDockPosition;
  workerDock: WorkerDockPosition;
  laneOrder: string[];
  botOrder: string[];
}

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'lanes.workspaceLayout.v1';

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  terminalDock: 'bottom',
  workerDock: 'right',
  laneOrder: [],
  botOrder: [],
};

export function sanitizeWorkspaceLayout(raw: unknown): WorkspaceLayout {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WORKSPACE_LAYOUT, laneOrder: [], botOrder: [] };
  }
  const obj = raw as Partial<WorkspaceLayout>;
  const terminalDock: TerminalDockPosition =
    obj.terminalDock === 'left' || obj.terminalDock === 'right' || obj.terminalDock === 'bottom'
      ? obj.terminalDock
      : 'bottom';
  const workerDock: WorkerDockPosition =
    obj.workerDock === 'left' || obj.workerDock === 'right' ? obj.workerDock : 'right';

  const cleanList = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of val) {
      if (typeof item === 'string' && item.trim() && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  };

  return {
    terminalDock,
    workerDock,
    laneOrder: cleanList(obj.laneOrder),
    botOrder: cleanList(obj.botOrder),
  };
}

export function loadWorkspaceLayout(): WorkspaceLayout {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_LAYOUT, laneOrder: [], botOrder: [] };
    return sanitizeWorkspaceLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKSPACE_LAYOUT, laneOrder: [], botOrder: [] };
  }
}

export function saveWorkspaceLayout(layout: WorkspaceLayout): void {
  try {
    window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns items ordered according to a saved ID list; any newly added items appear at the end
 * in their original relative order.
 */
export function applyIdOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const rank = new Map<string, number>();
  order.forEach((id, idx) => rank.set(id, idx));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0;
  });
}

/**
 * Moves `fromId` to the position of `toId` inside `allIds`.
 */
export function reorderIds(allIds: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return allIds;
  const fromIdx = allIds.indexOf(fromId);
  const toIdx = allIds.indexOf(toId);
  if (fromIdx === -1 || toIdx === -1) return allIds;
  const next = [...allIds];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

/**
 * Moves `id` one slot up (-1) or down (+1) inside `allIds`.
 */
export function moveIdByStep(allIds: string[], id: string, delta: -1 | 1): string[] {
  const idx = allIds.indexOf(id);
  if (idx === -1) return allIds;
  const target = idx + delta;
  if (target < 0 || target >= allIds.length) return allIds;
  return reorderIds(allIds, id, allIds[target]);
}
