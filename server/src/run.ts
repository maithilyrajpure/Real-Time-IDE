/**
 * Server-side code execution via Judge0 CE (hosted on RapidAPI).
 *
 * The client POSTs { language, filename, source } to /api/run; we forward it to
 * Judge0 with the RapidAPI key kept here on the server (never shipped to the
 * browser). Judge0's `wait=true` returns the result synchronously.
 *
 * Set JUDGE0_KEY (your RapidAPI key). Optional JUDGE0_HOST defaults to the
 * public Judge0 CE host.
 */
const JUDGE0_HOST = process.env.JUDGE0_HOST ?? 'judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_KEY;

/** Our language ids -> Judge0 CE language ids. */
const JUDGE0_LANG: Record<string, number> = {
  javascript: 63, // Node.js
  typescript: 74,
  python: 71, // Python 3
  java: 62, // OpenJDK
  c: 50, // GCC
  cpp: 54, // G++
  rust: 73,
  php: 68,
};

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
  output: string;
}

export function judge0Configured(): boolean {
  return !!JUDGE0_KEY;
}

export async function runViaJudge0(
  language: string,
  _filename: string,
  source: string
): Promise<RunResult> {
  if (!JUDGE0_KEY) {
    throw new Error('Execution is not configured on the server (missing JUDGE0_KEY).');
  }
  const languageId = JUDGE0_LANG[language];
  if (!languageId) {
    throw new Error(`Language "${language}" is not supported by the server runner.`);
  }

  const res = await fetch(
    `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': JUDGE0_KEY,
        'X-RapidAPI-Host': JUDGE0_HOST,
      },
      body: JSON.stringify({ language_id: languageId, source_code: source }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Judge0 request failed (HTTP ${res.status}). ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    message: string | null;
    status: { id: number; description: string };
  };

  const stdout = data.stdout ?? '';
  // Surface compile errors and runtime stderr together.
  const stderr = [data.compile_output, data.stderr, data.message]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join('\n');

  // Judge0 status id 3 = "Accepted" (ran, exit 0). Anything else is a failure.
  const code = data.status.id === 3 ? 0 : 1;
  const output =
    [stdout, stderr].filter(Boolean).join('\n').trimEnd() ||
    `(${data.status.description})`;

  return { stdout, stderr, code, output };
}
