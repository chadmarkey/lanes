import type { Branch, Lane, LaneColorIndex, ThreadStatus } from './types';
import { computeLaneStatus } from './workbench';

export type SpatialCameraPresetId = 'hero' | 'overview' | 'top' | 'closeup';

export interface SpatialCameraPreset {
  id: SpatialCameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface SpatialBranchNode {
  branchId: string;
  laneId: string;
  title: string;
  gitBranch: string;
  status: ThreadStatus;
  position: [number, number, number];
  statusHex: string;
}

export interface SpatialLaneNode {
  laneId: string;
  name: string;
  purpose: string;
  colorIndex: LaneColorIndex;
  colorHex: string;
  isPrivate: boolean;
  status: 'needs' | 'working' | 'idle';
  statusHex: string;
  angleRad: number;
  position: [number, number, number];
  columnHeight: number;
  openBranchCount: number;
  branches: SpatialBranchNode[];
}

export const LANE_COLOR_HEX: Record<LaneColorIndex, string> = {
  1: '#005776', // Deep Teal
  2: '#B54426', // Burnt Terracotta
  3: '#3B6633', // Olive Sage
  4: '#7E649E', // Plum Slate
  5: '#A84E73', // Terracotta Rose
};

export const STATUS_HEX: Record<'needs' | 'working' | 'done' | 'failed' | 'idle', string> = {
  needs: '#C47E12',
  working: '#B54426',
  done: '#3B6633',
  failed: '#BA1A1A',
  idle: '#7A6C66',
};

export const SPATIAL_CAMERA_PRESETS: Record<SpatialCameraPresetId, SpatialCameraPreset> = {
  hero: {
    id: 'hero',
    label: 'Hero',
    position: [4.6, 5.6, 10.9],
    target: [0, 1.05, 0],
  },
  overview: {
    id: 'overview',
    label: 'Overview',
    position: [0.2, 8.6, 12.2],
    target: [0, 0.8, 0],
  },
  top: {
    id: 'top',
    label: 'Top Plan',
    position: [0.01, 14.8, 1.4],
    target: [0, 0.2, 0],
  },
  closeup: {
    id: 'closeup',
    label: 'Hub Close',
    position: [3.6, 2.9, 4.4],
    target: [0, 1.25, 0],
  },
};

/**
 * Pure deterministic layout computing grounded architectural coordinates for Lanes monoliths
 * and orbiting Branch satellites around the central Lanes hub at (0, 0, 0).
 */
export function computeSpatialNodes(lanes: Lane[], branches: Branch[]): SpatialLaneNode[] {
  if (lanes.length === 0) return [];

  const ringRadius = lanes.length <= 4 ? 4.4 : 4.9;
  const startAngle = -Math.PI * 0.78;
  const step = (Math.PI * 2) / lanes.length;

  return lanes.map((lane, index) => {
    const angleRad = startAngle + index * step;
    const x = Number((Math.cos(angleRad) * ringRadius).toFixed(4));
    const z = Number((Math.sin(angleRad) * ringRadius).toFixed(4));

    const status = computeLaneStatus(lane.id, branches);
    const laneBranches = branches.filter((b) => b.laneId === lane.id && !b.merged);
    const activityScore = Math.min(6, lane.messages.length + laneBranches.length * 2);
    const columnHeight = Number((1.35 + activityScore * 0.14).toFixed(3));

    const branchOrbitRadius = 1.42;
    const branchSpread = laneBranches.length > 1 ? 0.85 : 0;

    const spatialBranches: SpatialBranchNode[] = laneBranches.map((branch, bIdx) => {
      const offsetRatio =
        laneBranches.length === 1 ? 0 : bIdx / (laneBranches.length - 1) - 0.5;
      const bAngle = angleRad + offsetRatio * branchSpread;
      const bx = Number((x + Math.cos(bAngle) * branchOrbitRadius).toFixed(4));
      const bz = Number((z + Math.sin(bAngle) * branchOrbitRadius).toFixed(4));
      const by = Number((0.95 + (bIdx % 2) * 0.28).toFixed(3));
      return {
        branchId: branch.id,
        laneId: lane.id,
        title: branch.title,
        gitBranch: branch.gitBranch,
        status: branch.status,
        position: [bx, by, bz],
        statusHex: STATUS_HEX[branch.status] ?? STATUS_HEX.idle,
      };
    });

    return {
      laneId: lane.id,
      name: lane.name,
      purpose: lane.purpose,
      colorIndex: lane.color,
      colorHex: LANE_COLOR_HEX[lane.color] ?? LANE_COLOR_HEX[1],
      isPrivate: lane.isPrivate,
      status,
      statusHex: STATUS_HEX[status],
      angleRad,
      position: [x, 0, z],
      columnHeight,
      openBranchCount: laneBranches.length,
      branches: spatialBranches,
    };
  });
}
