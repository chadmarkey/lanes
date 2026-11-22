import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

const GHOSTTY_CONFIG_DIR = path.join(os.homedir(), '.config', 'ghostty');
const GHOSTTY_CONFIG_FILE = path.join(GHOSTTY_CONFIG_DIR, 'config');
const GHOSTTY_SHADERS_DIR = path.join(GHOSTTY_CONFIG_DIR, 'shaders');

export interface LocalGhosttyShaderEntry {
  path: string;
  name: string;
  category: string;
}

export interface LocalGhosttyDiscovery {
  found: boolean;
  configPath: string;
  configText: string;
  shaders: LocalGhosttyShaderEntry[];
}

async function scanGlslFiles(
  baseDir: string,
  currentDir: string,
  depth: number,
  out: LocalGhosttyShaderEntry[]
): Promise<void> {
  if (depth > 3) return;
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await scanGlslFiles(baseDir, full, depth + 1, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glsl')) {
      const rel = path.relative(baseDir, full).split(path.sep).join('/');
      const parts = rel.split('/');
      const category = parts.length > 1 ? parts[0] : 'shaders';
      const stem = entry.name.replace(/\.glsl$/i, '').replace(/[-_]+/g, ' ');
      const name = stem.replace(/\b\w/g, (c) => c.toUpperCase());
      out.push({ path: rel, name, category });
    }
  }
}

export async function readLocalGhosttyConfig(): Promise<LocalGhosttyDiscovery> {
  let configText = '';
  let found = false;
  try {
    configText = await fs.readFile(GHOSTTY_CONFIG_FILE, 'utf8');
    found = true;
  } catch {
    found = false;
  }

  const shaders: LocalGhosttyShaderEntry[] = [];
  await scanGlslFiles(GHOSTTY_SHADERS_DIR, GHOSTTY_SHADERS_DIR, 0, shaders);
  shaders.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return {
    found,
    configPath: GHOSTTY_CONFIG_FILE,
    configText,
    shaders,
  };
}

export async function readLocalGhosttyShader(relPath: string): Promise<{ path: string; source: string } | null> {
  const cleaned = relPath.trim().replace(/^\/+/, '');
  if (!cleaned || !cleaned.toLowerCase().endsWith('.glsl') || cleaned.includes('\0')) {
    return null;
  }
  const resolvedBase = path.resolve(GHOSTTY_SHADERS_DIR);
  const resolvedTarget = path.resolve(resolvedBase, cleaned);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  try {
    const stat = await fs.stat(resolvedTarget);
    if (!stat.isFile() || stat.size > 128 * 1024) return null;
    const source = await fs.readFile(resolvedTarget, 'utf8');
    return {
      path: path.relative(resolvedBase, resolvedTarget).split(path.sep).join('/'),
      source,
    };
  } catch {
    return null;
  }
}

export async function resolveValidCwd(requested: string | null | undefined, fallbackDir: string): Promise<string> {
  if (requested && requested.trim()) {
    const candidate = path.resolve(requested.trim());
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // fall through to fallbackDir
    }
  }
  return fallbackDir;
}

export async function openExternalTerminal(
  targetApp: 'ghostty' | 'rex',
  cwd: string
): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'External macOS app handoff is only supported on macOS.' };
  }
  const validCwd = await resolveValidCwd(cwd, process.cwd());
  const candidates =
    targetApp === 'rex'
      ? ['/Applications/Rex.app', '/Applications/Rex Beta.app']
      : ['/Applications/Ghostty.app'];

  let foundAppPath: string | null = null;
  for (const appPath of candidates) {
    try {
      await fs.access(appPath);
      foundAppPath = appPath;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!foundAppPath) {
    return {
      ok: false,
      error: targetApp === 'rex' ? 'Rex is not installed in /Applications.' : 'Ghostty is not installed in /Applications.',
    };
  }

  const args =
    targetApp === 'ghostty'
      ? ['-a', foundAppPath, '--args', `--working-directory=${validCwd}`]
      : ['-a', foundAppPath, validCwd];

  return new Promise((resolve) => {
    execFile('/usr/bin/open', args, { timeout: 5000 }, (err) => {
      if (err) {
        resolve({ ok: false, error: err.message });
      } else {
        resolve({ ok: true });
      }
    });
  });
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachTerminalWebSocket(server: http.Server, rootDir: string): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const bridgePath = path.join(rootDir, 'bin', 'pty-bridge.py');

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/api/terminal/ws') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      void startTerminalSession(ws, url, bridgePath, rootDir);
    });
  });

  return wss;
}

async function startTerminalSession(
  ws: WebSocket,
  url: URL,
  bridgePath: string,
  rootDir: string
): Promise<void> {
  const cwd = await resolveValidCwd(url.searchParams.get('cwd'), rootDir);
  const cols = Math.max(20, Math.min(400, Number.parseInt(url.searchParams.get('cols') || '80', 10) || 80));
  const rows = Math.max(6, Math.min(200, Number.parseInt(url.searchParams.get('rows') || '24', 10) || 24));
  const shell = process.env.SHELL || '/bin/zsh';

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn('python3', [bridgePath], {
      cwd,
      env: {
        ...process.env,
        LANES_CWD: cwd,
        LANES_COLS: String(cols),
        LANES_ROWS: String(rows),
        LANES_SHELL: shell,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    sendJson(ws, {
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to start local shell bridge.',
    });
    ws.close();
    return;
  }

  sendJson(ws, {
    type: 'ready',
    cwd,
    shell: path.basename(shell),
  });

  let stdoutBuf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk;
    let nl = stdoutBuf.indexOf('\n');
    while (nl !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) {
        try {
          const parsed = JSON.parse(line) as { type?: string; b64?: string; code?: number };
          if (parsed.type === 'data' && typeof parsed.b64 === 'string') {
            const text = Buffer.from(parsed.b64, 'base64').toString('utf8');
            sendJson(ws, { type: 'data', data: text });
          } else if (parsed.type === 'exit') {
            sendJson(ws, { type: 'exit', code: parsed.code ?? 0 });
          }
        } catch {
          // ignore malformed line
        }
      }
      nl = stdoutBuf.indexOf('\n');
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    if (chunk.trim()) {
      sendJson(ws, { type: 'error', message: chunk.trim() });
    }
  });

  child.on('error', (err) => {
    sendJson(ws, { type: 'error', message: `Shell error: ${err.message}` });
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  child.on('close', (code) => {
    sendJson(ws, { type: 'exit', code: code ?? 0 });
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  ws.on('message', (raw) => {
    if (child.killed || !child.stdin.writable) return;
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const msg = JSON.parse(text) as { type?: string; data?: string; cols?: number; rows?: number };
      if (msg.type === 'input' && typeof msg.data === 'string') {
        child.stdin.write(JSON.stringify({ type: 'input', data: msg.data }) + '\n');
      } else if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
        child.stdin.write(
          JSON.stringify({
            type: 'resize',
            cols: Math.max(20, Math.min(400, Math.round(msg.cols))),
            rows: Math.max(6, Math.min(200, Math.round(msg.rows))),
          }) + '\n'
        );
      }
    } catch {
      // ignore invalid client frames
    }
  });

  const killChild = () => {
    if (!child.killed) {
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  };

  ws.on('close', killChild);
  ws.on('error', killChild);
}
