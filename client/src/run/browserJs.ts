/**
 * In-browser JavaScript execution in a sandboxed Web Worker.
 *
 * A Worker has no DOM and no access to the page, so user code can't touch the
 * editor or the network origin. console.* is captured and streamed back, and a
 * timeout terminates runaway loops. Synchronous code only — async work that
 * hasn't settled by the time the top-level script returns won't be captured
 * (a reasonable limit for a "run this snippet" button).
 */
import type { RunResult } from './types';

const WORKER_SRC = `
  const fmt = (args) => args.map((a) => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
  self.console.log = (...a) => self.postMessage({ t: 'out', line: fmt(a) });
  self.console.info = self.console.log;
  self.console.debug = self.console.log;
  self.console.warn = (...a) => self.postMessage({ t: 'err', line: fmt(a) });
  self.console.error = self.console.warn;
  self.onmessage = (e) => {
    try {
      (0, eval)(e.data);
      self.postMessage({ t: 'done', code: 0 });
    } catch (err) {
      self.postMessage({ t: 'err', line: String((err && err.stack) || err) });
      self.postMessage({ t: 'done', code: 1 });
    }
  };
`;

export function runJsInBrowser(source: string, timeoutMs = 4000): Promise<RunResult> {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    const finish = (code: number | null, extraErr?: string) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (extraErr) stderrLines.push(extraErr);
      const stdout = stdoutLines.join('\n');
      const stderr = stderrLines.join('\n');
      const output =
        [stdout, stderr].filter(Boolean).join('\n').trimEnd() || '(no output)';
      resolve({ stdout, stderr, code, output });
    };

    const timer = setTimeout(
      () => finish(124, `Timed out after ${timeoutMs} ms (possible infinite loop).`),
      timeoutMs
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { t: string; line?: string; code?: number };
      if (msg.t === 'out') stdoutLines.push(msg.line ?? '');
      else if (msg.t === 'err') stderrLines.push(msg.line ?? '');
      else if (msg.t === 'done') finish(msg.code ?? 0);
    };
    worker.onerror = (e) => finish(1, e.message);

    worker.postMessage(source);
  });
}
