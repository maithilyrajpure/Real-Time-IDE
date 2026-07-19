/**
 * Run dispatcher.
 *
 *   JavaScript -> sandboxed Web Worker in the browser (instant, no server).
 *   Everything else -> Piston (self-hosted or configured via VITE_PISTON_URL).
 */
import type { LangId } from '../collab/languages';
import type { RunResult } from './types';
import { runJsInBrowser } from './browserJs';
import { runViaPiston } from './piston';

export type { RunResult };

export function runCode(
  langId: LangId,
  filename: string,
  source: string
): Promise<RunResult> {
  if (langId === 'javascript') {
    return runJsInBrowser(source);
  }
  return runViaPiston(langId, filename, source);
}
