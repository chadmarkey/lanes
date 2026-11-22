import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Maximize2,
  Minimize2,
  RotateCw,
  X,
} from 'lucide-react';
import type { Branch, Lane, ThemeId } from '../lib/types';
import type { ShaderPresetId } from '../lib/appearance';
import {
  SPATIAL_CAMERA_PRESETS,
  computeSpatialNodes,
  type SpatialCameraPresetId,
} from '../lib/spatialLayout';
import { getThemePair } from '../lib/workbench';
import { createStudioScene, type StudioSceneController } from '../three/studioScene';

interface SpatialSceneViewProps {
  lanes: Lane[];
  branches: Branch[];
  theme: ThemeId;
  shader: ShaderPresetId;
  onOpenLane: (laneId: string) => void;
}

const PRESET_LIST: SpatialCameraPresetId[] = ['hero', 'overview', 'top', 'closeup'];

export function SpatialSceneView({ lanes, branches, theme, shader, onOpenLane }: SpatialSceneViewProps) {
  const { isDark } = getThemePair(theme);
  const nodes = useMemo(() => computeSpatialNodes(lanes, branches), [lanes, branches]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<StudioSceneController | null>(null);

  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<SpatialCameraPresetId>('hero');
  const [explode, setExplode] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const selectedNode = useMemo(
    () => (selectedLaneId ? nodes.find((n) => n.laneId === selectedLaneId) ?? null : null),
    [nodes, selectedLaneId]
  );

  // Mount Three.js engine once on an isolated empty container div
  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    const controller = createStudioScene(
      el,
      nodes,
      isDark,
      {
        onSelectLane: (laneId) => {
          setSelectedLaneId(laneId);
        },
      },
      shader
    );
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
    // Mount once and sync state via controller methods below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controllerRef.current?.updateData(nodes);
  }, [nodes]);

  useEffect(() => {
    controllerRef.current?.setTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    controllerRef.current?.setShader(shader);
  }, [shader]);

  useEffect(() => {
    controllerRef.current?.setExplode(explode / 100);
  }, [explode]);

  useEffect(() => {
    controllerRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // Keyboard shortcut: H toggles the bottom dock, Escape exits fullscreen
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key.toLowerCase() === 'h') {
        setControlsOpen((v) => !v);
      } else if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  const surfaceBg = isDark ? 'rgba(36, 25, 22, 0.94)' : 'rgba(255, 253, 249, 0.94)';
  const surfaceBorder = isDark ? 'rgba(139, 113, 107, 0.45)' : 'rgba(139, 123, 116, 0.35)';

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-40 h-screen w-screen overflow-hidden'
          : 'relative flex min-h-0 flex-1 overflow-hidden'
      }
      style={{ backgroundColor: isDark ? '#18100D' : '#EFE7DC' }}
    >
      {/* Isolated empty mount node for WebGL canvas (no React children) */}
      <div
        ref={canvasMountRef}
        data-testid="spatial-canvas-mount"
        className="absolute inset-0 h-full w-full"
      />

      {/* Minimal top-left title & selected-lane readout (no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        <div
          className="pointer-events-auto inline-flex items-center gap-2.5 rounded-[10px] border px-3 py-1.5"
          style={{
            backgroundColor: surfaceBg,
            borderColor: surfaceBorder,
            boxShadow: 'var(--l-shadow-raised)',
          }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: 'var(--l-accent)' }}
            aria-hidden="true"
          />
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--l-text)' }}>
            Lanes 3D Studio
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--l-muted)' }}>
            {nodes.length} lanes · {branches.filter((b) => !b.merged).length} branches
          </span>
        </div>

        {selectedNode && (
          <div
            className="pointer-events-auto flex max-w-[300px] flex-col gap-2 rounded-[12px] border p-3"
            style={{
              backgroundColor: surfaceBg,
              borderColor: surfaceBorder,
              boxShadow: 'var(--l-shadow-menu)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: selectedNode.colorHex }}
                  />
                  <span className="truncate text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                    {selectedNode.name}
                  </span>
                </div>
                <p className="mt-0.5 mb-0 text-[12px] leading-[1.4]" style={{ color: 'var(--l-muted)' }}>
                  {selectedNode.purpose}
                </p>
              </div>
              <button
                type="button"
                aria-label="Clear selected lane"
                onClick={() => {
                  setSelectedLaneId(null);
                  controllerRef.current?.focusLane(null);
                }}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--l-muted)' }}>
                {selectedNode.openBranchCount} open{' '}
                {selectedNode.openBranchCount === 1 ? 'branch' : 'branches'} · {selectedNode.status}
              </span>
              <button
                type="button"
                onClick={() => onOpenLane(selectedNode.laneId)}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[12px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
              >
                <span>Open lane</span>
                <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single collapsible floating bottom control dock (<= 15% footprint, solid rgba surface) */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex w-full max-w-[96%] -translate-x-1/2 justify-center px-2">
        {controlsOpen ? (
          <div
            role="toolbar"
            aria-label="3D Studio camera and inspection controls"
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-[12px] border px-3 py-2"
            style={{
              backgroundColor: surfaceBg,
              borderColor: surfaceBorder,
              boxShadow: 'var(--l-shadow-menu)',
            }}
          >
            {/* Camera presets */}
            <div className="flex items-center gap-1">
              {PRESET_LIST.map((presetId) => {
                const preset = SPATIAL_CAMERA_PRESETS[presetId];
                const active = activePreset === presetId;
                return (
                  <button
                    key={presetId}
                    type="button"
                    onClick={() => {
                      setActivePreset(presetId);
                      setSelectedLaneId(null);
                      controllerRef.current?.setCameraPreset(presetId);
                    }}
                    className="h-7 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--l-selected)' : 'transparent',
                      borderColor: active ? 'var(--l-accent)' : 'transparent',
                      color: active ? 'var(--l-text)' : 'var(--l-muted)',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <span className="hidden h-4 w-px sm:inline-block" style={{ backgroundColor: 'var(--l-line)' }} />

            {/* Exploded architectural layer separation */}
            <label className="inline-flex items-center gap-2 px-1 text-[12px]" style={{ color: 'var(--l-muted)' }}>
              <Layers size={13} aria-hidden="true" />
              <span className="whitespace-nowrap">Explode</span>
              <input
                type="range"
                min={0}
                max={100}
                value={explode}
                aria-label="Exploded view separation"
                onChange={(e) => setExplode(Number(e.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-[var(--l-accent)]"
              />
              <span className="w-7 text-right font-mono text-[11px] tabular-nums">{explode}%</span>
            </label>

            <span className="hidden h-4 w-px sm:inline-block" style={{ backgroundColor: 'var(--l-line)' }} />

            {/* Auto-orbit & Fullscreen 100vw toggles */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={autoRotate}
                onClick={() => setAutoRotate((v) => !v)}
                className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: autoRotate ? 'var(--l-selected)' : 'transparent',
                  borderColor: autoRotate ? 'var(--l-accent)' : 'var(--l-line)',
                  color: 'var(--l-text)',
                }}
              >
                <RotateCw size={12} />
                <span>Orbit</span>
              </button>

              <button
                type="button"
                aria-pressed={fullscreen}
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? 'Exit full-bleed viewport' : 'Expand to full-bleed 100vw viewport'}
                className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  borderColor: 'var(--l-line)',
                  color: 'var(--l-text)',
                }}
              >
                {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{fullscreen ? 'Exit' : 'Full'}</span>
              </button>

              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                title="Hide controls (H)"
                className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <ChevronDown size={13} />
                <span>Hide</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            title="Show controls (H)"
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: surfaceBg,
              borderColor: surfaceBorder,
              color: 'var(--l-text)',
              boxShadow: 'var(--l-shadow-raised)',
            }}
          >
            <ChevronUp size={13} />
            <span>Show Controls</span>
          </button>
        )}
      </div>
    </div>
  );
}
