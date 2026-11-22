import { useEffect, useRef, useState } from 'react';
import {
  ColorPanels,
  Dithering,
  DotOrbit,
  GodRays,
  GrainGradient,
  MeshGradient,
  Metaballs,
  NeuroNoise,
  SmokeRing,
  Swirl,
  Voronoi,
  Warp,
} from '@paper-design/shaders-react';
import type { PaperShaderId } from '../lib/appearance';

interface ThemeHexPalette {
  bg: string;
  panel: string;
  accent: string;
  second: string;
  ink: string;
  soft: string;
}

const FALLBACK_PALETTE: ThemeHexPalette = {
  bg: '#f4f8fb',
  panel: '#e6eff5',
  accent: '#942d10',
  second: '#c4841d',
  ink: '#1a2026',
  soft: '#dbe6ee',
};

function cssToHex(value: string, probe: CanvasRenderingContext2D, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = fallback;
  probe.fillStyle = trimmed;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

interface PaperShaderLayerProps {
  shader: PaperShaderId;
  className?: string;
}

export function PaperShaderLayer({ shader, className }: PaperShaderLayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<ThemeHexPalette>(FALLBACK_PALETTE);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!probe) return;

    const readPalette = () => {
      const style = getComputedStyle(host);
      const bg = cssToHex(style.getPropertyValue('--l-bg'), probe, FALLBACK_PALETTE.bg);
      const panel = cssToHex(style.getPropertyValue('--l-panel'), probe, FALLBACK_PALETTE.panel);
      const accent = cssToHex(style.getPropertyValue('--l-accent'), probe, FALLBACK_PALETTE.accent);
      const second = cssToHex(style.getPropertyValue('--l-needs'), probe, FALLBACK_PALETTE.second);
      const ink = cssToHex(style.getPropertyValue('--l-text'), probe, FALLBACK_PALETTE.ink);
      const soft = mixHex(bg, accent, 0.22);
      setPalette({ bg, panel, accent, second, ink, soft });
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPause = () => setPaused(document.hidden || reduceMotion.matches);

    readPalette();
    syncPause();

    const observer = new MutationObserver(readPalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent', 'style', 'class'],
    });
    reduceMotion.addEventListener('change', syncPause);
    document.addEventListener('visibilitychange', syncPause);

    return () => {
      observer.disconnect();
      reduceMotion.removeEventListener('change', syncPause);
      document.removeEventListener('visibilitychange', syncPause);
    };
  }, []);

  const speed = paused ? 0 : 0.35;
  const fillStyle: React.CSSProperties = { width: '100%', height: '100%', display: 'block' };
  const midAccent = mixHex(palette.bg, palette.accent, 0.34);
  const midSecond = mixHex(palette.bg, palette.second, 0.28);
  const midInk = mixHex(palette.bg, palette.ink, 0.16);

  const renderPaper = () => {
    switch (shader) {
      case 'paper-mesh':
        return (
          <MeshGradient
            style={fillStyle}
            colors={[palette.bg, midAccent, midSecond, palette.panel]}
            distortion={0.6}
            swirl={0.35}
            grainMixer={0.08}
            grainOverlay={0.04}
            speed={speed}
          />
        );
      case 'paper-grain':
        return (
          <GrainGradient
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, midInk]}
            softness={0.65}
            intensity={0.42}
            noise={0.28}
            shape="corners"
            speed={speed}
          />
        );
      case 'paper-neuro':
        return (
          <NeuroNoise
            style={fillStyle}
            colorBack={palette.bg}
            colorMid={midSecond}
            colorFront={midAccent}
            brightness={0.12}
            contrast={0.22}
            speed={speed}
          />
        );
      case 'paper-warp':
        return (
          <Warp
            style={fillStyle}
            colors={[palette.bg, palette.panel, midAccent, midSecond]}
            proportion={0.45}
            softness={1}
            distortion={0.22}
            swirl={0.6}
            swirlIterations={6}
            speed={speed}
          />
        );
      case 'paper-smoke':
        return (
          <SmokeRing
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, midInk]}
            noiseScale={2.6}
            noiseIterations={4}
            radius={0.38}
            thickness={0.45}
            speed={speed}
          />
        );
      case 'paper-godrays':
        return (
          <GodRays
            style={fillStyle}
            colorBack={palette.bg}
            colorBloom={midAccent}
            colors={[midAccent, midSecond, palette.panel]}
            density={0.38}
            intensity={0.5}
            bloom={0.35}
            speed={speed}
          />
        );
      case 'paper-dithering':
        return (
          <Dithering
            style={fillStyle}
            colorBack={palette.bg}
            colorFront={midAccent}
            shape="wave"
            type="4x4"
            size={2.5}
            speed={speed}
          />
        );
      case 'paper-voronoi':
        return (
          <Voronoi
            style={fillStyle}
            colors={[palette.bg, palette.panel, midAccent]}
            colorGlow={midSecond}
            colorGap={palette.bg}
            distortion={0.35}
            gap={0.03}
            glow={0.3}
            speed={speed}
          />
        );
      case 'paper-swirl':
        return (
          <Swirl
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, midInk]}
            bandCount={4}
            twist={0.3}
            softness={0.5}
            noise={0.2}
            speed={speed}
          />
        );
      case 'paper-metaballs':
        return (
          <Metaballs
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, midInk]}
            count={8}
            size={0.65}
            speed={speed}
          />
        );
      case 'paper-dot-orbit':
        return (
          <DotOrbit
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, midInk]}
            size={0.35}
            sizeRange={0.35}
            spreading={0.45}
            speed={speed}
          />
        );
      case 'paper-color-panels':
        return (
          <ColorPanels
            style={fillStyle}
            colorBack={palette.bg}
            colors={[midAccent, midSecond, palette.panel, midInk]}
            density={3}
            blur={0.35}
            speed={speed}
          />
        );
    }
  };

  return (
    <div ref={hostRef} aria-hidden="true" className={className} style={{ opacity: 0.92 }}>
      {renderPaper()}
    </div>
  );
}
