/**
 * Server-side code execution via Paiza.io — a free, keyless (api_key=guest)
 * code-runner. The client POSTs { language, source } to /api/run and we forward
 * it here. No API key, no card, no signup required.
 *
 * Paiza is asynchronous: create a job, then poll get_details until it completes.
 */
const PAIZA_BASE = process.env.PAIZA_URL ?? 'https://api.paiza.io';
const PAIZA_KEY = process.env.PAIZA_KEY ?? 'guest';

/** Our language ids -> Paiza language names. */
const PAIZA_LANG: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python3',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  rust: 'rust',
  php: 'php',
};

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
  output: string;
}

/** Paiza needs no key, so execution is always available. */
export function runnerReady(): boolean {
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PaizaCreate {
  id?: string;
  status?: string;
  error?: string;
}

interface PaizaDetails {
  status: string; // "running" | "completed"
  build_stderr: string | null;
  build_result: string | null; // "success" | "failure" | null
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  result: string | null; // "success" | "failure" | "timeout"
  error?: string;
}

async function form(path: string, params: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(params);
  return fetch(`${PAIZA_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export async function runProgram(
  language: string,
  _filename: string,
  source: string
): Promise<RunResult> {
  const paizaLang = PAIZA_LANG[language];
  if (!paizaLang) {
    throw new Error(`Language "${language}" is not supported by the runner.`);
  }

  // 1. Create the job.
  const created = (await (
    await form('/runners/create', {
      source_code: source,
      language: paizaLang,
      api_key: PAIZA_KEY,
    })
  ).json()) as PaizaCreate;

  if (created.error || !created.id) {
    throw new Error(`Runner rejected the job: ${created.error ?? 'no id returned'}`);
  }

  // 2. Poll until completed (or give up after ~25s).
  const deadline = Date.now() + 25_000;
  let details: PaizaDetails | null = null;
  while (Date.now() < deadline) {
    await sleep(1000);
    const res = await fetch(
      `${PAIZA_BASE}/runners/get_details?id=${encodeURIComponent(created.id)}&api_key=${PAIZA_KEY}`
    );
    details = (await res.json()) as PaizaDetails;
    if (details.error) throw new Error(`Runner error: ${details.error}`);
    if (details.status === 'completed') break;
  }

  if (!details || details.status !== 'completed') {
    throw new Error('Execution timed out.');
  }

  // 3. Shape the result. Build (compile) failures come back in build_stderr.
  const buildFailed = details.build_result === 'failure';
  const stdout = details.stdout ?? '';
  const stderr = [buildFailed ? details.build_stderr : '', details.stderr]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join('\n');

  // Paiza returns exit_code as a string ("0"); coerce so the client compares it
  // as a number.
  const code = buildFailed
    ? 1
    : details.exit_code != null
      ? Number(details.exit_code)
      : details.result === 'success'
        ? 0
        : 1;
  const output =
    [stdout, stderr].filter(Boolean).join('\n').trimEnd() ||
    `(${details.result ?? 'no output'})`;

  return { stdout, stderr, code, output };
}
