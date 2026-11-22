import { useEffect, useMemo, useRef, useState } from 'react';
import { init as initGhostty, FitAddon, Terminal } from 'ghostty-web';
import {
  ExternalLink,
  Palette,
  RefreshCw,
  Terminal as TerminalIcon,
  Trash2,
} from 'lucide-react';
import { readJsonSafe, resolveApiUrl, resolveWsUrl } from '../lib/tauri';
import {
  getFontStack,
  resolveActiveTerminalTheme,
  type TerminalSettings,
} from '../lib/terminalConfig';
import { GhosttyShaderOverlay, type CursorUniformState } from './GhosttyShaderOverlay';

let ghosttyInitPromise: Promise<void> | null = null;
function ensureGhosttyReady(): Promise<void> {
  if (!ghosttyInitPromise) {
    ghosttyInitPromise = initGhostty().catch((err) => {
      ghosttyInitPromise = null;
      throw err;
    });
  }
  return ghosttyInitPromise;
}

const PREVIEW_ANSI_DEMO = [
  '\x1b[1;36m╭─\x1b[0m \x1b[1;32mdev@lanes\x1b[0m \x1b[38;5;244min\x1b[0m \x1b[1;34m~/workspace/lanes\x1b[0m \x1b[35m(main)\x1b[0m',
  '\x1b[1;36m╰─❯\x1b[0m \x1b[1mgit status -sb && npm test\x1b[0m',
  '\x1b[32m## main...origin/main\x1b[0m',
  ' \x1b[33mM\x1b[0m src/components/GhosttyTerminal.tsx',
  ' \x1b[32mA\x1b[0m src/components/GhosttyShaderOverlay.tsx',
  '',
  '\x1b[1;34m  Ghostty VT100 Engine\x1b[0m   \x1b[36mghostty-web 0.4.0 (WASM)\x1b[0m',
  '\x1b[1;34m  Shader Pipeline\x1b[0m        \x1b[35mWebGL2 · iChannel0 · 60fps\x1b[0m',
  '\x1b[1;34m  Tests\x1b[0m                  \x1b[32m✔ 30 passed\x1b[0m \x1b[90m(0 failed · 174ms)\x1b[0m',
  '',
  '  \x1b[40m   \x1b[41m   \x1b[42m   \x1b[43m   \x1b[44m   \x1b[45m   \x1b[46m   \x1b[47m   \x1b[0m',
  '  \x1b[100m   \x1b[101m   \x1b[102m   \x1b[103m   \x1b[104m   \x1b[105m   \x1b[106m   \x1b[107m   \x1b[0m',
  '',
  '\x1b[1;36m❯\x1b[0m \x1b[33m# Type here or click "Live shell" for real zsh...\x1b[0m',
].join('\r\n');

export interface GhosttyTerminalProps {
  settings: TerminalSettings;
  appIsDark: boolean;
  mode?: 'live' | 'preview';
  cwd?: string;
  sessionLabel?: string;
  showHeader?: boolean;
  onOpenCustomizer?: () => void;
  onNotify?: (msg: string, tone?: 'info' | 'error') => void;
  className?: string;
}

export function GhosttyTerminal({
  settings,
  appIsDark,
  mode = 'live',
  cwd,
  sessionLabel = 'zsh',
  showHeader = true,
  onOpenCustomizer,
  onNotify,
  className = '',
}: GhosttyTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'preview' | 'error'>(
    mode === 'preview' ? 'preview' : 'connecting'
  );
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [reconnectTick, setReconnectTick] = useState(0);
  const [shaderError, setShaderError] = useState<string | null>(null);
  const [localShaderSource, setLocalShaderSource] = useState<string>('');
  const mountStartRef = useRef<number>(performance.now());
  const replayBufferRef = useRef<string>('');
  const appliedThemeSigRef = useRef<string>('');

  const cursorRef = useRef<CursorUniformState>({
    currentX: 12,
    currentY: 12,
    width: 8,
    height: 16,
    prevX: 12,
    prevY: 12,
    changedAtSec: 0,
  });

  const { preset, theme } = useMemo(
    () => resolveActiveTerminalTheme(settings, appIsDark),
    [settings, appIsDark]
  );

  const fontStack = useMemo(() => getFontStack(settings.fontFamily), [settings.fontFamily]);

  // Load local ~/.config/ghostty/shaders/*.glsl when shaderId === 'local-glsl'
  useEffect(() => {
    if (settings.shaderId !== 'local-glsl' || !settings.localShaderPath) {
      setLocalShaderSource('');
      return;
    }
    let active = true;
    fetch(resolveApiUrl(`/api/terminal/ghostty-shader?path=${encodeURIComponent(settings.localShaderPath)}`))
      .then((res) => (res.ok ? readJsonSafe<{ source?: string }>(res) : null))
      .then((data) => {
        if (!active) return;
        if (data?.source) {
          setLocalShaderSource(data.source);
          setShaderError(null);
        } else {
          setLocalShaderSource('');
          setShaderError(`Could not load shader "${settings.localShaderPath}".`);
        }
      })
      .catch(() => {
        if (active) {
          setLocalShaderSource('');
          setShaderError('Could not load local Ghostty shader.');
        }
      });
    return () => {
      active = false;
    };
  }, [settings.shaderId, settings.localShaderPath]);

  // Mount ghostty-web Terminal instance + WebSocket (in live mode)
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let localTerm: Terminal | null = null;
    let localWs: WebSocket | null = null;

    async function mount() {
      try {
        await ensureGhosttyReady();
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setStatusDetail(err instanceof Error ? err.message : 'Ghostty WASM failed to initialize.');
        }
        return;
      }

      const container = hostRef.current;
      if (cancelled || !container) return;

      container.innerHTML = '';
      const term = new Terminal({
        fontSize: settings.fontSize,
        fontFamily: fontStack,
        cursorStyle: settings.cursorStyle,
        cursorBlink: settings.cursorBlink,
        scrollback: 5000,
        theme,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();

      localTerm = term;
      termRef.current = term;
      fitRef.current = fitAddon;
      mountStartRef.current = performance.now();
      appliedThemeSigRef.current = JSON.stringify(theme);
      replayBufferRef.current = '';

      const canvasEl = container.querySelector('canvas');
      if (canvasEl instanceof HTMLCanvasElement) {
        setSourceCanvas(canvasEl);
      }

      const updateCursorCoords = () => {
        try {
          const buf = term.buffer?.active;
          const renderer = term.renderer;
          if (!buf || !renderer) return;
          const cw = renderer.charWidth || 8;
          const ch = renderer.charHeight || 16;
          const nextX = buf.cursorX * cw;
          const nextY = buf.cursorY * ch;
          const prev = cursorRef.current;
          if (Math.abs(nextX - prev.currentX) > 0.5 || Math.abs(nextY - prev.currentY) > 0.5) {
            cursorRef.current = {
              prevX: prev.currentX,
              prevY: prev.currentY,
              currentX: nextX,
              currentY: nextY,
              width: cw,
              height: ch,
              changedAtSec: (performance.now() - mountStartRef.current) / 1000,
            };
          }
        } catch {
          // ignore cursor metric errors during dispose
        }
      };

      term.onCursorMove(updateCursorCoords);
      term.onRender(updateCursorCoords);

      resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore resize during teardown
        }
      });
      resizeObserver.observe(container);

      if (mode === 'preview') {
        setStatus('preview');
        setStatusDetail('Ghostty preview');
        replayBufferRef.current = PREVIEW_ANSI_DEMO;
        term.write(PREVIEW_ANSI_DEMO);
        // Allow typing in preview mode so cursor shaders & fonts can be tested live!
        term.onData((data) => {
          let chunk = '';
          if (data === '\r') {
            chunk = '\r\n\x1b[1;36m❯\x1b[0m ';
          } else if (data === '\x7f') {
            chunk = '\b \b';
          } else if (data >= ' ') {
            chunk = data;
          }
          if (chunk) {
            replayBufferRef.current = (replayBufferRef.current + chunk).slice(-65536);
            term.write(chunk);
          }
        });
        updateCursorCoords();
        return;
      }

      // Live shell mode over WebSocket
      setStatus('connecting');
      setStatusDetail('Starting zsh…');

      const params = new URLSearchParams({
        cols: String(term.cols || 80),
        rows: String(term.rows || 24),
      });
      if (cwd) params.set('cwd', cwd);

      const ws = new WebSocket(resolveWsUrl(`/api/terminal/ws?${params.toString()}`));
      localWs = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setStatus('connected');
        setStatusDetail(sessionLabel);
        term.focus();
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            data?: string;
            shell?: string;
            cwd?: string;
            code?: number;
            message?: string;
          };
          if (msg.type === 'ready') {
            const folder = msg.cwd ? msg.cwd.split('/').filter(Boolean).pop() || msg.cwd : '';
            setStatus('connected');
            setStatusDetail(`${msg.shell || 'zsh'}${folder ? ` · ${folder}` : ''}`);
          } else if (msg.type === 'data' && typeof msg.data === 'string') {
            replayBufferRef.current = (replayBufferRef.current + msg.data).slice(-65536);
            term.write(msg.data);
          } else if (msg.type === 'exit') {
            setStatus('disconnected');
            setStatusDetail(`Exited (${msg.code ?? 0})`);
            term.writeln(`\r\n\x1b[90m[shell exited with code ${msg.code ?? 0} — click Reconnect to start a new session]\x1b[0m`);
          } else if (msg.type === 'error' && msg.message) {
            setStatus('error');
            setStatusDetail(msg.message);
            term.writeln(`\r\n\x1b[31m[${msg.message}]\x1b[0m`);
          }
        } catch {
          // ignore malformed payload
        }
      };

      ws.onerror = () => {
        if (!cancelled) {
          setStatus('error');
          setStatusDetail('Shell connection lost');
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          setStatus((prev) => (prev === 'error' ? 'error' : 'disconnected'));
        }
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
    }

    void mount();

    return () => {
      cancelled = true;
      setSourceCanvas(null);
      resizeObserver?.disconnect();
      if (localWs && (localWs.readyState === WebSocket.OPEN || localWs.readyState === WebSocket.CONNECTING)) {
        localWs.close();
      }
      wsRef.current = null;
      try {
        localTerm?.dispose();
      } catch {
        // ignore dispose errors
      }
      termRef.current = null;
      fitRef.current = null;
    };
    // Intentionally reconnect only when mode, cwd, or reconnectTick changes; visual styling updates live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cwd, reconnectTick]);

  // Live-update visual options without restarting the running shell.
  // ghostty-web bakes fg/bg/ANSI palette into wasmTerm on creation, so when the theme
  // changes we rebuild wasmTerm via term.reset() and replay buffered output — keeping the
  // underlying WebSocket and zsh process completely untouched.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    try {
      const nextThemeSig = JSON.stringify(theme);
      const themeChanged = nextThemeSig !== appliedThemeSigRef.current;

      term.options.theme = theme;
      term.options.fontSize = settings.fontSize;
      term.options.fontFamily = fontStack;
      term.options.cursorStyle = settings.cursorStyle;
      term.options.cursorBlink = settings.cursorBlink;

      term.renderer?.setTheme(theme);
      term.renderer?.setFontSize(settings.fontSize);
      term.renderer?.setFontFamily(fontStack);
      term.renderer?.setCursorStyle(settings.cursorStyle);
      term.renderer?.setCursorBlink(settings.cursorBlink);

      if (themeChanged) {
        appliedThemeSigRef.current = nextThemeSig;
        term.reset();
        const replay = mode === 'preview' ? (replayBufferRef.current || PREVIEW_ANSI_DEMO) : replayBufferRef.current;
        if (replay) {
          term.write(replay);
        }
      }

      fitRef.current?.fit();
      if (term.wasmTerm) {
        term.renderer?.render(term.wasmTerm, true, term.viewportY, term);
      }
    } catch {
      // ignore if terminal is mid-teardown
    }
  }, [theme, mode, settings.fontSize, fontStack, settings.cursorStyle, settings.cursorBlink, settings.paddingX, settings.paddingY]);

  async function openInExternal(appName: 'ghostty' | 'rex') {
    try {
      const res = await fetch(resolveApiUrl('/api/terminal/open-external'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appName, cwd }),
      });
      const data = await readJsonSafe<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        onNotify?.(data?.error || `Could not open ${appName === 'rex' ? 'Rex' : 'Ghostty'}.`, 'error');
        return;
      }
      onNotify?.(`Opened in ${appName === 'rex' ? 'Rex' : 'Ghostty'}`);
    } catch {
      onNotify?.(`Could not open ${appName === 'rex' ? 'Rex' : 'Ghostty'}.`, 'error');
    }
  }

  const effectiveCustomSource =
    settings.shaderId === 'local-glsl'
      ? localShaderSource
      : settings.shaderId === 'custom-glsl'
        ? settings.customGlsl
        : undefined;

  const bgHex = theme.background || '#16171a';
  const shaderActive =
    settings.shaderId !== 'none' &&
    !shaderError &&
    (settings.shaderId !== 'local-glsl' || Boolean(localShaderSource));

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden ${className}`}
      style={{
        backgroundColor: bgHex,
      }}
    >
      {showHeader && (
        <div
          className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3"
          style={{
            backgroundColor: 'var(--l-panel)',
            borderColor: 'var(--l-line)',
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <TerminalIcon size={13} style={{ color: 'var(--l-accent)' }} aria-hidden="true" />
            <span className="truncate text-[12px] font-medium" style={{ color: 'var(--l-text)' }}>
              {statusDetail || sessionLabel}
            </span>
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              title={status}
              style={{
                backgroundColor:
                  status === 'connected' || status === 'preview'
                    ? 'var(--l-ok)'
                    : status === 'connecting'
                      ? 'var(--l-needs)'
                      : 'var(--l-bad)',
              }}
            />
            <span
              className="hidden truncate text-[12px] sm:inline"
              style={{ color: 'var(--l-muted)' }}
            >
              · {preset.name}
              {settings.shaderId !== 'none' ? ` · ${settings.shaderId}` : ''}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onOpenCustomizer && (
              <button
                type="button"
                onClick={onOpenCustomizer}
                title="Customize terminal theme & shaders"
                className="inline-flex h-6 items-center gap-1 rounded-[6px] border px-2 text-[12px] font-medium transition-colors hover:bg-[var(--l-hover)]"
                style={{
                  borderColor: 'var(--l-line)',
                  backgroundColor: 'var(--l-raised)',
                  color: 'var(--l-text)',
                }}
              >
                <Palette size={11} aria-hidden="true" />
                <span>Style</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void openInExternal('ghostty')}
              title="Open this folder in native Ghostty"
              className="hidden h-6 items-center gap-1 rounded-[6px] px-1.5 text-[12px] transition-colors hover:bg-[var(--l-hover)] sm:inline-flex"
              style={{ color: 'var(--l-muted)' }}
            >
              <span>Ghostty</span>
              <ExternalLink size={10} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void openInExternal('rex')}
              title="Open this folder in Rex"
              className="hidden h-6 items-center gap-1 rounded-[6px] px-1.5 text-[12px] transition-colors hover:bg-[var(--l-hover)] sm:inline-flex"
              style={{ color: 'var(--l-muted)' }}
            >
              <span>Rex</span>
              <ExternalLink size={10} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                replayBufferRef.current = '';
                termRef.current?.clear();
              }}
              title="Clear terminal"
              aria-label="Clear terminal"
              className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
              style={{ color: 'var(--l-muted)' }}
            >
              <Trash2 size={12} />
            </button>
            {mode === 'live' && (
              <button
                type="button"
                onClick={() => setReconnectTick((t) => t + 1)}
                title="Restart shell session"
                aria-label="Restart shell session"
                className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--l-hover)]"
                style={{ color: 'var(--l-muted)' }}
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {shaderError && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1 text-[12px]"
          style={{
            backgroundColor: 'var(--l-needs-soft)',
            borderColor: 'var(--l-line)',
            color: 'var(--l-text)',
          }}
        >
          <span className="truncate">Shader fallback (showing clean Ghostty): {shaderError}</span>
        </div>
      )}

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          paddingLeft: `${settings.paddingX}px`,
          paddingRight: `${settings.paddingX}px`,
          paddingTop: `${settings.paddingY}px`,
          paddingBottom: `${settings.paddingY}px`,
          backgroundColor: bgHex,
          opacity: settings.backgroundOpacity,
          backdropFilter: settings.backgroundBlur > 0 ? `blur(${settings.backgroundBlur}px)` : undefined,
        }}
        onClick={() => termRef.current?.focus()}
      >
        <div className="relative h-full w-full">
          <div
            ref={hostRef}
            className="h-full w-full"
            style={{
              opacity: shaderActive ? 0.001 : 1,
            }}
          />
          <GhosttyShaderOverlay
            sourceCanvas={sourceCanvas}
            shaderId={settings.shaderId}
            intensity={settings.shaderIntensity}
            customSource={effectiveCustomSource}
            backgroundColor={bgHex}
            cursorColor={theme.cursor || theme.foreground || '#ffffff'}
            cursorRef={cursorRef}
            onError={setShaderError}
          />
        </div>
      </div>
    </div>
  );
}
