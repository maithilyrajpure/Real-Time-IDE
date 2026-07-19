/**
 * Production runner: POST the code to our own server's /api/run, which forwards
 * to Judge0. Keeps the execution API key server-side (never in the browser).
 *
 * The server's HTTP URL is derived from VITE_WS_URL (ws->http, wss->https),
 * or set explicitly via VITE_API_URL.
 */
import type { LangId } from '../collab/languages';
import type { RunResult } from './types';

function apiBase(): string {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const ws = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234';
  return ws.replace(/^ws/, 'http').replace(/\/$/, '');
}

export async function runViaServer(
  langId: LangId,
  filename: string,
  source: string
): Promise<RunResult> {
  const res = await fetch(`${apiBase()}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language: langId, filename, source }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Run failed (HTTP ${res.status})`
    );
  }
  return data as RunResult;
}
