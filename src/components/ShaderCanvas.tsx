import { useEffect, useRef, useState } from 'react';
import {
  isPaperShader,
  type LanesLiveShaderId,
  type LiveShaderId,
  type ReactBitsShaderId,
} from '../lib/appearance';
import { PaperShaderLayer } from './PaperShaderLayer';

/*
 * Live background shaders for Lanes:
 * - Lanes originals (starfield, nebula, caustics, lava, aurora, ripples)
 * - React Bits interactive WebGL backgrounds (silk, iridescence, liquid chrome, prism, beams, waves, plasma, grid distortion)
 * - Paper Shaders (@paper-design/shaders-react) via PaperShaderLayer
 *
 * Each GLSL shader paints a mostly transparent layer in the theme's own colors
 * (u_ink = text, u_accent, u_second = needs/warm) and responds gently to cursor position (u_mouse).
 */

type GlslLiveShaderId = LanesLiveShaderId | ReactBitsShaderId;

const COMMON = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_ink;
uniform vec3 u_accent;
uniform vec3 u_second;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

const BODIES: Record<GlslLiveShaderId, string> = {
  // --- Lanes Originals ---
  starfield: `
float starLayer(vec2 uv, float scale, float speed) {
  uv = uv * scale + vec2(u_time * speed, u_time * speed * 0.3);
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash(id);
  vec2 off = vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5;
  float d = length(f - off * 0.7);
  float size = mix(0.06, 0.14, h * h);
  float twinkle = 0.55 + 0.45 * sin(u_time * (1.0 + h * 3.0) + h * 40.0);
  return smoothstep(size, 0.0, d) * step(0.74, h) * twinkle;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.y;
  float a = starLayer(uv, 14.0, 0.06) + starLayer(uv, 26.0, 0.03) * 0.75 + starLayer(uv, 48.0, 0.012) * 0.5;
  vec3 col = mix(u_ink, u_accent, 0.45);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * 0.85);
}`,

  nebula: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.04;
  float c = cos(t), s = sin(t);
  uv = mat2(c, -s, s, c) * uv;
  vec2 q = vec2(fbm(uv * 1.8 + t), fbm(uv * 1.8 + vec2(5.2, 1.3) - t));
  float n = fbm(uv * 2.2 + q * 2.0);
  float a = smoothstep(0.42, 0.9, n);
  vec3 col = mix(u_accent, u_second, smoothstep(0.3, 0.8, q.x));
  gl_FragColor = vec4(col, a * 0.32);
}`,

  caustics: `
void main() {
  vec2 p = gl_FragCoord.xy / u_res.y * 5.0;
  float t = u_time * 0.35;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    p += 0.45 * vec2(sin(p.y * 1.2 + t + fi * 1.9), cos(p.x * 1.1 - t * 0.8 + fi * 2.7));
  }
  float v = abs(sin(p.x) + sin(p.y));
  float light = pow(1.0 - clamp(v * 0.55, 0.0, 1.0), 5.0);
  vec3 col = mix(u_accent, u_ink, 0.25);
  gl_FragColor = vec4(col, light * 0.42);
}`,

  lava: `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.18;
  float field = 0.0;
  float warm = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * (0.7 + fi * 0.13) + fi * 2.1) * 0.75, cos(t * (0.5 + fi * 0.11) + fi * 1.3) * 0.42);
    float r = 0.11 + 0.04 * sin(fi * 3.3);
    float k = r * r / max(dot(uv - c, uv - c), 1e-4);
    field += k;
    warm += k * step(3.0, fi);
  }
  float body = smoothstep(0.9, 1.15, field);
  float glow = smoothstep(0.25, 0.9, field) * 0.35;
  vec3 col = mix(u_accent, u_second, clamp(warm / max(field, 1e-4), 0.0, 1.0));
  gl_FragColor = vec4(col, (body * 0.3 + glow * 0.25));
}`,

  aurora: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.12;
  float band = sin(uv.x * 3.0 + t + sin(uv.x * 7.0 - t * 1.3) * 0.6 + fbm(vec2(uv.x * 2.0, t)) * 2.0);
  float curtain = smoothstep(0.15, 1.0, uv.y) * (0.5 + 0.5 * band);
  float streaks = 0.6 + 0.4 * noise(vec2(uv.x * 40.0, t * 2.0));
  vec3 col = mix(u_accent, u_second, 0.5 + 0.5 * sin(uv.x * 2.5 - t));
  gl_FragColor = vec4(col, curtain * streaks * 0.55);
}`,

  ripples: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.y;
  float aspect = u_res.x / u_res.y;
  float t = u_time;
  vec2 c1 = vec2(aspect * (0.3 + 0.1 * sin(t * 0.21)), 0.4 + 0.15 * cos(t * 0.17));
  vec2 c2 = vec2(aspect * (0.72 + 0.1 * cos(t * 0.19)), 0.62 + 0.12 * sin(t * 0.23));
  float w = sin(length(uv - c1) * 38.0 - t * 1.6) + sin(length(uv - c2) * 38.0 - t * 1.9);
  float a = smoothstep(1.2, 1.95, w);
  gl_FragColor = vec4(mix(u_accent, u_ink, 0.2), a * 0.22);
}`,

  // --- React Bits Interactive Backgrounds ---
  'rb-silk': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 m = (u_mouse - 0.5) * 0.35;
  float t = u_time * 0.22;
  vec2 p = (uv - 0.5 + m * 0.3) * vec2(u_res.x / u_res.y, 1.0) * 2.6;
  float angle = 0.45 + m.x * 0.4;
  p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
  float fold = sin(p.x * 2.1 + sin(p.y * 1.7 + t) * 1.3 + fbm(p * 1.2 + t * 0.4) * 2.4);
  float sheen = pow(0.5 + 0.5 * fold, 2.2);
  vec3 col = mix(u_accent, mix(u_second, u_ink, 0.25), 0.5 + 0.5 * sin(p.y + t * 0.5));
  gl_FragColor = vec4(col, sheen * 0.34);
}`,

  'rb-iridescence': `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 m = (u_mouse - 0.5) * 0.5;
  float t = u_time * 0.28;
  float d = -t * 0.4;
  float a = 0.0;
  vec2 p = uv * 2.2 + m;
  for (float i = 0.0; i < 6.0; i += 1.0) {
    a += cos(i - d - a * p.x);
    d += sin(p.y * i + a);
  }
  vec3 irid = vec3(
    0.5 + 0.5 * cos(p.x + d),
    0.5 + 0.5 * cos(p.y + a + 2.0),
    0.5 + 0.5 * cos(a + d + 4.0)
  );
  vec3 themed = mix(irid, mix(u_accent, u_second, 0.5), 0.45);
  float mask = 0.24 + 0.14 * sin(a + d);
  gl_FragColor = vec4(themed, clamp(mask, 0.08, 0.38));
}`,

  'rb-liquid-chrome': `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * 2.4;
  vec2 m = (u_mouse - 0.5) * 0.6;
  float t = u_time * 0.35;
  vec2 p = uv - m * 0.4;
  for (int i = 1; i <= 5; i++) {
    float fi = float(i);
    p.x += 0.35 / fi * sin(fi * 2.2 * p.y + t);
    p.y += 0.35 / fi * cos(fi * 2.0 * p.x - t * 0.8);
  }
  float ridge = abs(sin(p.x + p.y));
  float spec = pow(1.0 - ridge, 4.0);
  float body = smoothstep(0.15, 0.9, 1.0 - ridge);
  vec3 col = mix(u_ink, mix(u_accent, vec3(1.0), 0.35), spec);
  gl_FragColor = vec4(col, body * 0.22 + spec * 0.26);
}`,

  'rb-prism': `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.2;
  float c = cos(t * 0.5), s = sin(t * 0.5);
  vec2 p = mat2(c, -s, s, c) * uv;
  float facet = abs(p.x * 1.4) + abs(p.y * 1.1) + 0.25 * sin(p.x * 6.0 - t * 2.0);
  float glow = exp(-abs(facet - 0.42) * 5.5);
  float refr = exp(-abs(facet - 0.46) * 5.0);
  float refr2 = exp(-abs(facet - 0.38) * 5.0);
  vec3 col = u_accent * glow + u_second * refr + mix(u_ink, vec3(0.4, 0.78, 1.0), 0.6) * refr2;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp((glow + refr + refr2) * 0.24, 0.0, 0.42));
}`,

  'rb-beams': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.18;
  float diag = uv.x * 1.35 + uv.y * 0.55;
  float beams = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float pos = fract(diag * (1.2 + fi * 0.35) - t * (0.08 + fi * 0.03) + fi * 0.27);
    float beam = exp(-pow((pos - 0.5) * 9.0, 2.0));
    beams += beam * (0.55 + 0.45 * sin(t + fi * 2.1));
  }
  float fade = smoothstep(0.0, 0.35, uv.y) * smoothstep(1.0, 0.55, uv.y);
  vec3 col = mix(u_accent, u_second, uv.x);
  gl_FragColor = vec4(col, clamp(beams * 0.16 * (0.55 + 0.45 * fade), 0.0, 0.36));
}`,

  'rb-waves': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.35;
  float lines = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float base = 0.14 + fi * 0.12;
    float wave = base + 0.055 * sin(uv.x * (4.0 + fi * 0.6) + t + fi * 1.1)
                      + 0.025 * cos(uv.x * 9.0 - t * 0.7 + fi);
    float d = abs(uv.y - wave);
    lines += smoothstep(0.006, 0.001, d);
  }
  vec3 col = mix(u_accent, u_second, uv.x);
  gl_FragColor = vec4(col, clamp(lines * 0.34, 0.0, 0.48));
}`,

  'rb-plasma': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.y * 3.2;
  float t = u_time * 0.32;
  float v = sin(uv.x + t) + sin(uv.y * 1.1 - t * 0.8) + sin((uv.x + uv.y) * 0.8 + t * 0.6);
  v += sin(length(uv - vec2(1.5, 1.0)) * 2.2 - t);
  float band = 0.5 + 0.5 * sin(v * 1.6);
  vec3 col = mix(u_accent, u_second, 0.5 + 0.5 * cos(v));
  gl_FragColor = vec4(col, band * 0.28);
}`,

  'rb-grid-distortion': `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  vec2 diff = p - m;
  float dist = length(diff);
  float ripple = exp(-dist * 3.2) * 0.065 * sin(dist * 16.0 - u_time * 2.4);
  vec2 warped = p + normalize(diff + 1e-4) * ripple + 0.008 * vec2(sin(p.y * 6.0 + u_time * 0.5), cos(p.x * 6.0 - u_time * 0.4));
  vec2 grid = abs(fract(warped * 14.0 - 0.5) - 0.5) / 0.5;
  float line = 1.0 - smoothstep(0.0, 0.075, min(grid.x, grid.y));
  vec3 col = mix(u_ink, u_accent, exp(-dist * 2.5));
  gl_FragColor = vec4(col, line * 0.26);
}`,
};

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/** Turns any CSS color (hex, rgb, oklch, color-mix…) into 0–1 RGB by painting one pixel. */
function cssColorToRgb(value: string, probe: CanvasRenderingContext2D): [number, number, number] {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = value.trim() || '#000';
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Lanes shader failed to compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

interface ShaderCanvasProps {
  shader: LiveShaderId;
  className?: string;
  /** Drawing resolution relative to CSS pixels. Low values keep a full-screen layer cheap. */
  scale?: number;
}

function GlslShaderCanvas({
  shader,
  className,
  scale = 0.5,
}: {
  shader: GlslLiveShaderId;
  className?: string;
  scale?: number;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [generation, setGeneration] = useState(0);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !onScreen) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(canvas);
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) {
      canvas.remove();
      return;
    }
    const release = () => {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, COMMON + BODIES[shader]);
    if (!vs || !fs) {
      release();
      return;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Lanes shader failed to link:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      release();
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uInk = gl.getUniformLocation(program, 'u_ink');
    const uAccent = gl.getUniformLocation(program, 'u_accent');
    const uSecond = gl.getUniformLocation(program, 'u_second');

    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let mouseX = 0.5;
    let mouseY = 0.5;

    const onPointerMove = (e: PointerEvent) => {
      if (window.innerWidth > 0 && window.innerHeight > 0) {
        targetMouseX = e.clientX / window.innerWidth;
        targetMouseY = 1.0 - e.clientY / window.innerHeight;
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const readColors = () => {
      const style = getComputedStyle(host);
      gl.uniform3fv(uInk, cssColorToRgb(style.getPropertyValue('--l-text'), probe));
      gl.uniform3fv(uAccent, cssColorToRgb(style.getPropertyValue('--l-accent'), probe));
      gl.uniform3fv(uSecond, cssColorToRgb(style.getPropertyValue('--l-needs'), probe));
    };

    const resize = () => {
      const ratio = (window.devicePixelRatio || 1) * scale;
      const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now();
    let frame = 0;
    let lost = false;
    const draw = (now: number) => {
      if (document.hidden || lost) return;
      mouseX += (targetMouseX - mouseX) * 0.08;
      mouseY += (targetMouseY - mouseY) * 0.08;
      if (uMouse) gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform1f(uTime, reduceMotion.matches ? 12 : 12 + (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      if (!lost && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else restart();
    };

    readColors();
    resize();
    restart();

    const sizeObserver = new ResizeObserver(() => {
      resize();
      if (reduceMotion.matches) restart();
    });
    sizeObserver.observe(canvas);
    const themeObserver = new MutationObserver(() => {
      readColors();
      if (reduceMotion.matches) restart();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent', 'style', 'class'],
    });
    reduceMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
    };
    const onRestored = () => setGeneration((g) => g + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      reduceMotion.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      release();
    };
  }, [shader, scale, generation, onScreen]);

  return <span ref={hostRef} aria-hidden="true" className={className} style={{ display: 'block' }} />;
}

export function ShaderCanvas({ shader, className, scale = 0.5 }: ShaderCanvasProps) {
  if (isPaperShader(shader)) {
    return <PaperShaderLayer shader={shader} className={className} />;
  }
  return <GlslShaderCanvas shader={shader} className={className} scale={scale} />;
}
