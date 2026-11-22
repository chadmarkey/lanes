/**
 * Tauri desktop runtime detection and transport helpers.
 * Keeps web preview and packaged Tauri desktop builds using the exact same React codebase.
 */

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

export function getApiBaseUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_API_BASE as string | undefined)
      : undefined;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  return '';
}

export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

/**
 * Safely parses a JSON response body without throwing raw SyntaxErrors on 502/HTML error pages.
 */
export async function readJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function resolveWsUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base) {
    const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsBase}${normalized}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalized}`;
}

export function getRuntimeSummary(): {
  kind: 'tauri' | 'web';
  label: string;
  apiBase: string;
} {
  const tauri = isTauriRuntime();
  const base = getApiBaseUrl();
  return {
    kind: tauri ? 'tauri' : 'web',
    label: tauri ? 'Tauri Desktop WebView' : 'Browser SPA',
    apiBase: base || 'Same-origin (/api)',
  };
}
