/** File tree sidebar: lists the room's files and lets you add/select them. */
import { useState } from 'react';
import type * as Y from 'yjs';
import { addFile, type FileMeta } from '../collab/session';
import { LANG_META } from '../collab/languages';

interface FileTreeProps {
  doc: Y.Doc;
  files: FileMeta[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

function iconFor(lang: FileMeta['lang']): string {
  return LANG_META[lang].label;
}

export default function FileTree({ doc, files, activePath, onSelect }: FileTreeProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      const meta = addFile(doc, trimmed);
      onSelect(meta.path);
    }
    setName('');
    setAdding(false);
  };

  return (
    <aside className="file-tree">
      <div className="file-tree__header">
        <span>FILES</span>
        <button className="icon-btn" title="New file" onClick={() => setAdding(true)}>
          +
        </button>
      </div>

      <ul className="file-tree__list">
        {files.map((f) => (
          <li key={f.path}>
            <button
              className={`file-item${f.path === activePath ? ' file-item--active' : ''}`}
              onClick={() => onSelect(f.path)}
            >
              <span className="file-item__icon">{iconFor(f.lang)}</span>
              <span className="file-item__name">{f.name}</span>
            </button>
          </li>
        ))}
        {files.length === 0 && <li className="file-tree__empty">No files yet</li>}
      </ul>

      {adding && (
        <div className="file-tree__new">
          <input
            autoFocus
            value={name}
            placeholder="filename.js"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setName('');
                setAdding(false);
              }
            }}
            onBlur={commit}
          />
        </div>
      )}
    </aside>
  );
}
