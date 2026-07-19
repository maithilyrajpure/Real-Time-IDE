/** Bottom drawer that shows program output from the Run button. */
import type { RunResult } from '../run/types';

interface OutputPanelProps {
  running: boolean;
  result: RunResult | null;
  error: string | null;
  onClose: () => void;
}

export default function OutputPanel({ running, result, error, onClose }: OutputPanelProps) {
  return (
    <div className="output">
      <div className="output__header">
        <span className="output__title">
          OUTPUT
          {result && result.code !== null && (
            <span className={`exit exit--${result.code === 0 ? 'ok' : 'err'}`}>
              exit {result.code}
            </span>
          )}
        </span>
        <button className="icon-btn" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <pre className="output__body">
        {running && 'Running…'}
        {!running && error && <span className="output--error">{error}</span>}
        {!running && !error && result && (
          <span className={result.stderr ? 'output--warn' : ''}>{result.output}</span>
        )}
      </pre>
    </div>
  );
}
