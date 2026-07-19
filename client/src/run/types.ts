export interface RunResult {
  stdout: string;
  stderr: string;
  /** Exit code, or null if unknown. */
  code: number | null;
  /** Combined, display-ready output. */
  output: string;
}
