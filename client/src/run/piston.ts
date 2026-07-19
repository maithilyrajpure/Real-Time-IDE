/**
 * Code execution via the public Piston API (https://github.com/engineer-man/piston).
 *
 * Runnable languages are compiled/run in a sandbox on Piston's servers and we
 * get back stdout/stderr. Versions are resolved dynamically from the /runtimes
 * endpoint so we never hardcode a version that later disappears.
 *
 * NOTE: this calls the public instance directly from the browser. For production
 * you'd proxy it through our own server (rate limits, abuse control).
 */
import { LANG_META, type LangId } from '../collab/languages';
import type { RunResult } from './types';

// Configurable so you can point at a self-hosted Piston. The public instance
// (emkc.org) now requires auth for /execute, so non-JS languages need your own
// Piston — e.g. the one in docker-compose.yml: VITE_PISTON_URL=http://localhost:2000/api/v2
const PISTON_URL = import.meta.env.VITE_PISTON_URL ?? 'https://emkc.org/api/v2/piston';

interface Runtime {
  language: string;
  version: string;
  aliases: string[];
}

let runtimesCache: Runtime[] | null = null;

async function getRuntimes(): Promise<Runtime[]> {
  if (runtimesCache) return runtimesCache;
  const res = await fetch(`${PISTON_URL}/runtimes`);
  if (!res.ok) throw new Error(`Could not load runtimes (HTTP ${res.status})`);
  runtimesCache = (await res.json()) as Runtime[];
  return runtimesCache;
}

function resolveRuntime(runtimes: Runtime[], pistonLang: string): Runtime | undefined {
  // Prefer an alias match: when several runtimes share a language (e.g.
  // "javascript" is served by both Node and Deno), the mainstream one carries
  // the plain alias ("javascript" -> Node), so alias-first picks it.
  return (
    runtimes.find((r) => r.aliases.includes(pistonLang)) ??
    runtimes.find((r) => r.language === pistonLang)
  );
}

/** Execute a single file's source. Rejects only on network/API failure; a
 *  program that exits non-zero still resolves (with stderr populated). */
export async function runViaPiston(
  langId: LangId,
  filename: string,
  source: string
): Promise<RunResult> {
  const pistonLang = LANG_META[langId].pistonLang;
  if (!pistonLang) {
    throw new Error(`${LANG_META[langId].label} files can't be executed.`);
  }

  const runtimes = await getRuntimes();
  const runtime = resolveRuntime(runtimes, pistonLang);
  if (!runtime) {
    throw new Error(`No runtime available for ${pistonLang}.`);
  }

  const res = await fetch(`${PISTON_URL}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      files: [{ name: filename, content: source }],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `The execution server requires auth (HTTP ${res.status}). ` +
        `The public Piston no longer allows anonymous runs — set VITE_PISTON_URL ` +
        `to a self-hosted Piston (see docker-compose.yml). JavaScript still runs in-browser.`
    );
  }
  if (!res.ok) {
    throw new Error(`Execution failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    run: { stdout: string; stderr: string; code: number | null };
    compile?: { stdout: string; stderr: string; code: number | null };
  };

  // Surface compile errors (Java/C/C++/Rust) before the run output.
  const compileErr = data.compile?.stderr?.trim() ? data.compile.stderr : '';
  const stdout = data.run.stdout ?? '';
  const stderr = (compileErr ? compileErr + '\n' : '') + (data.run.stderr ?? '');
  const output = [stdout, stderr].filter(Boolean).join('').trimEnd() || '(no output)';

  return { stdout, stderr, code: data.run.code, output };
}
