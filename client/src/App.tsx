import { useEffect, useState } from 'react';
import { useCollab } from './collab/useCollab';
import Editor from './components/Editor';
import FileTree from './components/FileTree';
import Presence from './components/Presence';

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

  // Auto-select the first file once one exists (or when the active one vanishes).
  useEffect(() => {
    if (files.length === 0) {
      setActivePath(null);
    } else if (!activePath || !files.some((f) => f.path === activePath)) {
      setActivePath(files[0].path);
    }
  }, [files, activePath]);

  const activeFile = files.find((f) => f.path === activePath) ?? null;

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
        <FileTree doc={doc} files={files} activePath={activePath} onSelect={setActivePath} />
        <main className="editor-pane">
          {activeFile ? (
            <Editor
              key={activeFile.path}
              doc={doc}
              provider={provider}
              file={activeFile}
            />
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
