/**
 * Run dispatcher.
 *
 *   JavaScript          -> sandboxed Web Worker in the browser (instant).
 *   VITE_PISTON_URL set  -> local self-hosted Piston (dev convenience).
 *   otherwise            -> our server's /api/run -> Judge0 (production).
 */
import type { LangId } from '../collab/languages';
import type { RunResult } from './types';
import { runJsInBrowser } from './browserJs';
import { runViaPiston } from './piston';
import { runViaServer } from './server';

export type { RunResult };

export function runCode(
  langId: LangId,
  filename: string,
  source: string
): Promise<RunResult> {
  if (langId === 'javascript') {
    return runJsInBrowser(source);
  }
  if (import.meta.env.VITE_PISTON_URL) {
    return runViaPiston(langId, filename, source);
  }
  return runViaServer(langId, filename, source);
}
