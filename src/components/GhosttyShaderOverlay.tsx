import { useEffect, useRef } from 'react';
import { normalizeGhosttyGlsl, type TerminalShaderId } from '../lib/terminalConfig';

export interface CursorUniformState {
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  prevX: number;
  prevY: number;
  changedAtSec: number;
}

interface GhosttyShaderOverlayProps {
  sourceCanvas: HTMLCanvasElement | null;
  shaderId: TerminalShaderId;
  intensity: number;
  customSource?: string;
  backgroundColor: string;
  cursorColor: string;
  cursorRef: React.MutableRefObject<CursorUniformState>;
  onError?: (err: string | null) => void;
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_HEADER = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform sampler2D iChannel0;
uniform vec4 iCurrentCursor;
uniform vec4 iPreviousCursor;
uniform vec4 iCurrentCursorColor;
uniform vec4 iPreviousCursorColor;
uniform float iTimeCursorChange;
uniform vec4 iBackgroundColor;
uniform float uIntensity;
out vec4 outColor;
`;

const FRAGMENT_FOOTER = `
void main() {
  vec4 col = vec4(0.0);
  mainImage(col, gl_FragCoord.xy);
  outColor = vec4(clamp(col.rgb, 0.0, 1.0), 1.0);
}
`;

const BUILTIN_SHADERS: Record<Exclude<TerminalShaderId, 'none' | 'local-glsl' | 'custom-glsl'>, string> = {
  bloom: `
const vec3 samples[16] = vec3[16](
  vec3( 0.17,  0.99, 1.00), vec3(-1.33,  0.47, 0.71),
  vec3(-0.85, -1.51, 0.58), vec3( 1.55, -1.26, 0.50),
  vec3( 1.68,  1.47, 0.45), vec3(-1.28,  2.09, 0.41),
  vec3(-2.46, -0.98, 0.38), vec3( 0.59, -2.77, 0.35),
  vec3( 3.00,  0.12, 0.33), vec3( 0.41,  3.14, 0.32),
  vec3(-3.17,  0.98, 0.30), vec3(-1.57, -3.09, 0.29),
  vec3( 2.89, -2.16, 0.28), vec3( 2.72,  2.57, 0.27),
  vec3(-2.15,  3.22, 0.26), vec3(-3.65, -1.63, 0.25)
);
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 base = texture(iChannel0, uv);
  vec2 stepPx = vec2(1.45) / iResolution.xy;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    vec3 s = samples[i];
    vec3 c = texture(iChannel0, clamp(uv + s.xy * stepPx, 0.001, 0.999)).rgb;
    float l = lum(c);
    if (l > 0.22) {
      glow += c * l * s.z;
    }
  }
  fragColor = vec4(base.rgb + glow * 0.11 * uIntensity, 1.0);
}`,

  bettercrt: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 dc = abs(0.5 - uv);
  dc *= dc;
  float warp = 0.16 * uIntensity;
  uv.x = (uv.x - 0.5) * (1.0 + dc.y * (0.28 * warp)) + 0.5;
  uv.y = (uv.y - 0.5) * (1.0 + dc.x * (0.36 * warp)) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = iBackgroundColor;
    return;
  }
  vec3 color = texture(iChannel0, uv).rgb;
  float scan = abs(sin(fragCoord.y * 1.15)) * 0.16 * uIntensity;
  vec2 vigUv = uv * (1.0 - uv.yx);
  float vig = pow(max(0.0, vigUv.x * vigUv.y * 18.0), 0.14 * uIntensity);
  fragColor = vec4(mix(color, vec3(0.0), scan) * vig, 1.0);
}`,

  'retro-terminal': `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 dc = abs(0.5 - uv);
  dc *= dc;
  float warp = 0.18 * uIntensity;
  uv.x = (uv.x - 0.5) * (1.0 + dc.y * (0.3 * warp)) + 0.5;
  uv.y = (uv.y - 0.5) * (1.0 + dc.x * (0.4 * warp)) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.02, 0.04, 0.02, 1.0);
    return;
  }
  vec3 c = texture(iChannel0, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 phosphor = mix(c, vec3(l * 0.35, l * 1.15, l * 0.58), 0.55 * uIntensity);
  float scan = abs(sin(fragCoord.y * 1.25)) * 0.22 * uIntensity;
  float pulse = 0.985 + 0.015 * sin(iTime * 7.0);
  fragColor = vec4(mix(phosphor, vec3(0.0), scan) * pulse, 1.0);
}`,

  vhs: `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float wave = sin(uv.y * 16.0 + iTime * 2.2) * 0.0008 * uIntensity;
  float band = smoothstep(0.97, 1.0, sin(uv.y * 5.0 - iTime * 1.1)) * 0.0025 * uIntensity;
  vec2 shift = vec2(wave + band, 0.0);
  float chroma = 0.0014 * uIntensity;
  float r = texture(iChannel0, clamp(uv + shift + vec2(chroma, 0.0), 0.001, 0.999)).r;
  float g = texture(iChannel0, clamp(uv + shift, 0.001, 0.999)).g;
  float b = texture(iChannel0, clamp(uv + shift - vec2(chroma, 0.0), 0.001, 0.999)).b;
  vec3 col = vec3(r, g, b);
  float grain = (hash(fragCoord + fract(iTime) * 100.0) - 0.5) * 0.055 * uIntensity;
  float scan = sin(fragCoord.y * 1.5) * 0.04 * uIntensity;
  fragColor = vec4(col + grain - scan, 1.0);
}`,

  glitch: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = floor(iTime * 6.0);
  float jitter = sin(t * 17.3) * step(0.86, fract(sin(t * 91.7) * 43758.5));
  float off = (0.0014 + abs(jitter) * 0.003) * uIntensity;
  float r = texture(iChannel0, clamp(uv + vec2(off, 0.0), 0.001, 0.999)).r;
  float g = texture(iChannel0, uv).g;
  float b = texture(iChannel0, clamp(uv - vec2(off, 0.0), 0.001, 0.999)).b;
  fragColor = vec4(r, g, b, 1.0);
}`,

  starfield: `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float stars(vec2 uv, float scale, float speed) {
  uv = uv * scale + vec2(iTime * speed, iTime * speed * 0.35);
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash21(id);
  vec2 o = vec2(hash21(id + 1.7), hash21(id + 9.2)) - 0.5;
  float d = length(f - o * 0.65);
  float twinkle = 0.55 + 0.45 * sin(iTime * (1.2 + h * 3.0) + h * 30.0);
  return smoothstep(0.09, 0.0, d) * step(0.76, h) * twinkle;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 suv = fragCoord / max(iResolution.y, 1.0);
  vec3 base = texture(iChannel0, uv).rgb;
  float s = stars(suv, 12.0, 0.05) + stars(suv, 24.0, 0.025) * 0.7 + stars(suv, 44.0, 0.01) * 0.45;
  float bgMask = 1.0 - smoothstep(0.02, 0.16, length(base - iBackgroundColor.rgb));
  vec3 starCol = mix(vec3(0.75, 0.86, 1.0), iCurrentCursorColor.rgb, 0.35);
  fragColor = vec4(base + starCol * s * 0.42 * uIntensity * bgMask, 1.0);
}`,

  matrix: `
float hash1(float n) { return fract(sin(n) * 43758.5453123); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 base = texture(iChannel0, uv).rgb;
  float cols = floor(iResolution.x / 14.0);
  float colId = floor(uv.x * cols);
  float speed = 0.25 + hash1(colId * 13.7) * 0.45;
  float offset = hash1(colId * 71.3);
  float head = fract(offset - iTime * speed);
  float trail = fract(uv.y - head);
  float drop = smoothstep(0.32, 0.0, trail) * step(0.45, hash1(colId * 3.1));
  float cell = step(0.25, fract(uv.y * 42.0)) * step(0.2, fract(uv.x * cols));
  float bgMask = 1.0 - smoothstep(0.02, 0.18, length(base - iBackgroundColor.rgb));
  vec3 rain = vec3(0.18, 0.92, 0.46) * drop * cell * 0.24 * uIntensity * bgMask;
  fragColor = vec4(base + rain, 1.0);
}`,

  'cursor-warp': `
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 base = texture(iChannel0, uv).rgb;
  float elapsed = max(0.0, iTime - iTimeCursorChange);
  float fade = exp(-elapsed * 8.5);
  vec2 curCenter = iCurrentCursor.xy + vec2(iCurrentCursor.z * 0.5, -iCurrentCursor.w * 0.5);
  vec2 prevCenter = iPreviousCursor.xy + vec2(iPreviousCursor.z * 0.5, -iPreviousCursor.w * 0.5);
  float jumpLen = length(curCenter - prevCenter);
  if (fade > 0.01 && jumpLen > 2.0) {
    float d = segDist(fragCoord, prevCenter, curCenter);
    float radius = max(iCurrentCursor.w * 0.48, 6.0);
    float trail = smoothstep(radius, 0.0, d) * fade * 0.58 * uIntensity;
    base = mix(base, iCurrentCursorColor.rgb, clamp(trail, 0.0, 0.72));
  }
  // Subtle halo around active cursor
  float curD = length(fragCoord - curCenter);
  float halo = smoothstep(max(iCurrentCursor.w * 1.4, 16.0), 0.0, curD) * 0.14 * uIntensity;
  fragColor = vec4(base + iCurrentCursorColor.rgb * halo, 1.0);
}`,
};

function hexToRgbaVec(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) / 255,
      parseInt(clean[1] + clean[1], 16) / 255,
      parseInt(clean[2] + clean[2], 16) / 255,
      1,
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
      1,
    ];
  }
  return [0.09, 0.09, 0.1, 1];
}

export function GhosttyShaderOverlay({
  sourceCanvas,
  shaderId,
  intensity,
  customSource,
  backgroundColor,
  cursorColor,
  cursorRef,
  onError,
}: GhosttyShaderOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  const bgRef = useRef(backgroundColor);
  const cursorColorRef = useRef(cursorColor);
  const onErrorRef = useRef(onError);

  intensityRef.current = intensity;
  bgRef.current = backgroundColor;
  cursorColorRef.current = cursorColor;
  onErrorRef.current = onError;

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !sourceCanvas || shaderId === 'none') {
      onErrorRef.current?.(null);
      return;
    }

    const bodyRaw =
      shaderId === 'local-glsl' || shaderId === 'custom-glsl'
        ? customSource?.trim() || ''
        : BUILTIN_SHADERS[shaderId];

    if (!bodyRaw) {
      onErrorRef.current?.(null);
      return;
    }

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      onErrorRef.current?.('WebGL2 is unavailable in this browser.');
      return;
    }

    const compileShader = (type: number, src: string): { shader: WebGLShader | null; error?: string } => {
      const sh = gl.createShader(type);
      if (!sh) return { shader: null, error: 'Could not allocate shader.' };
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) || 'Shader compile error.';
        gl.deleteShader(sh);
        return { shader: null, error: log.trim() };
      }
      return { shader: sh };
    };

    const normalized = normalizeGhosttyGlsl(bodyRaw);
    const hasMain = /\bvoid\s+main\s*\(/.test(normalized);
    const fragSrc = hasMain
      ? `${FRAGMENT_HEADER}\n${normalized}`
      : `${FRAGMENT_HEADER}\n${normalized}\n${FRAGMENT_FOOTER}`;

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);

    if (!vs.shader || !fs.shader) {
      if (vs.shader) gl.deleteShader(vs.shader);
      if (fs.shader) gl.deleteShader(fs.shader);
      onErrorRef.current?.(fs.error || vs.error || 'Shader failed to compile.');
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs.shader);
      gl.deleteShader(fs.shader);
      return;
    }
    gl.attachShader(program, vs.shader);
    gl.attachShader(program, fs.shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || 'Shader link error.';
      gl.deleteProgram(program);
      gl.deleteShader(vs.shader);
      gl.deleteShader(fs.shader);
      onErrorRef.current?.(log.trim());
      return;
    }

    onErrorRef.current?.(null);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uRes = gl.getUniformLocation(program, 'iResolution');
    const uTime = gl.getUniformLocation(program, 'iTime');
    const uTimeDelta = gl.getUniformLocation(program, 'iTimeDelta');
    const uFrame = gl.getUniformLocation(program, 'iFrame');
    const uChan0 = gl.getUniformLocation(program, 'iChannel0');
    const uCurCursor = gl.getUniformLocation(program, 'iCurrentCursor');
    const uPrevCursor = gl.getUniformLocation(program, 'iPreviousCursor');
    const uCurColor = gl.getUniformLocation(program, 'iCurrentCursorColor');
    const uPrevColor = gl.getUniformLocation(program, 'iPreviousCursorColor');
    const uCursorTime = gl.getUniformLocation(program, 'iTimeCursorChange');
    const uBgColor = gl.getUniformLocation(program, 'iBackgroundColor');
    const uIntensity = gl.getUniformLocation(program, 'uIntensity');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startMs = performance.now();
    let lastMs = startMs;
    let frame = 0;
    let rafId = 0;
    let disposed = false;

    const renderFrame = (nowMs: number) => {
      if (disposed) return;
      if (!document.hidden && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        if (canvas.width !== sourceCanvas.width || canvas.height !== sourceCanvas.height) {
          canvas.width = sourceCanvas.width;
          canvas.height = sourceCanvas.height;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

        const elapsedSec = (nowMs - startMs) / 1000;
        const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - lastMs) / 1000));
        lastMs = nowMs;

        if (uRes) gl.uniform3f(uRes, canvas.width, canvas.height, 1.0);
        if (uTime) gl.uniform1f(uTime, reducedMotion ? 0.0 : elapsedSec);
        if (uTimeDelta) gl.uniform1f(uTimeDelta, dtSec);
        if (uFrame) gl.uniform1i(uFrame, frame++);
        if (uChan0) gl.uniform1i(uChan0, 0);
        if (uIntensity) gl.uniform1f(uIntensity, intensityRef.current);

        const bg = hexToRgbaVec(bgRef.current);
        const curCol = hexToRgbaVec(cursorColorRef.current);
        if (uBgColor) gl.uniform4f(uBgColor, bg[0], bg[1], bg[2], bg[3]);
        if (uCurColor) gl.uniform4f(uCurColor, curCol[0], curCol[1], curCol[2], curCol[3]);
        if (uPrevColor) gl.uniform4f(uPrevColor, curCol[0], curCol[1], curCol[2], curCol[3]);

        const cur = cursorRef.current;
        const dpr = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : window.devicePixelRatio || 1;
        // Convert top-left CSS px to Shadertoy bottom-left physical px
        const curX = cur.currentX * dpr;
        const curY = canvas.height - cur.currentY * dpr;
        const prevX = cur.prevX * dpr;
        const prevY = canvas.height - cur.prevY * dpr;
        const cw = Math.max(2, cur.width * dpr);
        const ch = Math.max(4, cur.height * dpr);
        if (uCurCursor) gl.uniform4f(uCurCursor, curX, curY, cw, ch);
        if (uPrevCursor) gl.uniform4f(uPrevCursor, prevX, prevY, cw, ch);
        if (uCursorTime) gl.uniform1f(uCursorTime, cur.changedAtSec);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        // Under reduced motion, refresh slowly (4 fps) so text updates stay visible without animation
        rafId = window.setTimeout(() => {
          if (!disposed) renderFrame(performance.now());
        }, 250) as unknown as number;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden && !disposed && !rafId) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    rafId = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reducedMotion) {
        window.clearTimeout(rafId);
      } else {
        cancelAnimationFrame(rafId);
      }
      gl.deleteTexture(texture);
      gl.deleteBuffer(posBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs.shader!);
      gl.deleteShader(fs.shader!);
    };
  }, [sourceCanvas, shaderId, customSource, cursorRef]);

  if (!sourceCanvas || shaderId === 'none') {
    return null;
  }

  return (
    <canvas
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
