import { useCallback, useEffect, useState } from 'react';
import { useCollab } from './collab/useCollab';
import Editor from './components/Editor';
import FileTree from './components/FileTree';
import Presence from './components/Presence';
import OutputPanel from './components/OutputPanel';
import { fileText } from './collab/session';
import { isRunnable } from './collab/languages';
import { runCode, type RunResult } from './run';

/** Room name comes from the URL hash (#myroom) so links are shareable;
 *  everyone with the same link lands in the same document. */
function roomFromHash(): string {
  const slug = window.location.hash.replace(/^#/, '').trim();
  return slug || 'default';
}

export default function App() {
  const [room] = useState(roomFromHash);
  const { doc, provider, status, files, peers } = useCollab(room);
  const [activePath, setActivePath] = useState<string | null>(null);

  // Run state.
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);

  // Auto-select the first file once one exists (or when the active one vanishes).
  useEffect(() => {
    if (files.length === 0) {
      setActivePath(null);
    } else if (!activePath || !files.some((f) => f.path === activePath)) {
      setActivePath(files[0].path);
    }
  }, [files, activePath]);

  const activeFile = files.find((f) => f.path === activePath) ?? null;
  const canRun = !!activeFile && isRunnable(activeFile.lang) && !running;

  const handleRun = useCallback(async () => {
    if (!doc || !activeFile || !isRunnable(activeFile.lang)) return;
    setRunning(true);
    setOutputOpen(true);
    setResult(null);
    setRunError(null);
    try {
      const source = fileText(doc, activeFile.path).toString();
      const res = await runCode(activeFile.lang, activeFile.name, source);
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [doc, activeFile]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <span className="brand">◧ Real-Time IDE</span>
          <span className="room-badge" title="Share this room link">
            #{room}
          </span>
        </div>
        <div className="topbar__right">
          <Presence peers={peers} />
          <span className={`status status--${status}`}>
            <span className="status__dot" />
            {status}
          </span>
        </div>
      </header>

      <div className="workspace">
        {doc && <FileTree doc={doc} files={files} activePath={activePath} onSelect={setActivePath} />}
        <main className="editor-pane">
          {doc && provider && activeFile ? (
            <>
              <div className="editor-toolbar">
                <span className="editor-toolbar__name">{activeFile.name}</span>
                <button
                  className="run-btn"
                  onClick={handleRun}
                  disabled={!canRun}
                  title={
                    isRunnable(activeFile.lang)
                      ? 'Run this file'
                      : `${activeFile.lang} files aren't executable`
                  }
                >
                  {running ? '● Running…' : '▶ Run'}
                </button>
              </div>
              <Editor key={activeFile.path} doc={doc} provider={provider} file={activeFile} />
              {outputOpen && (
                <OutputPanel
                  running={running}
                  result={result}
                  error={runError}
                  onClose={() => setOutputOpen(false)}
                />
              )}
            </>
          ) : (
            <div className="empty-editor">
              {status === 'connected'
                ? 'Select or create a file to start coding.'
                : 'Connecting to the collaboration server…'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
