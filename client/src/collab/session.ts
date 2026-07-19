/**
 * Shared-document model for a room.
 *
 * A room is one Y.Doc containing:
 *   - files:            Y.Map<path, FileMeta>   (drives the file tree)
 *   - "content:<path>": Y.Text                  (the editable body of each file)
 *
 * CodeMirror binds to the active file's Y.Text; edits become CRDT updates that
 * Yjs merges across every connected client.
 */
import * as Y from 'yjs';
import { detectLang, type LangId } from './languages';

export interface FileMeta {
  path: string;
  name: string;
  lang: LangId;
}

export function filesMap(doc: Y.Doc): Y.Map<FileMeta> {
  return doc.getMap<FileMeta>('files');
}

/** The Y.Text holding a file's editable content. */
export function fileText(doc: Y.Doc, path: string): Y.Text {
  return doc.getText(`content:${path}`);
}

export function listFiles(doc: Y.Doc): FileMeta[] {
  return Array.from(filesMap(doc).values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Add a file if the path is free; returns the created (or existing) meta. */
export function addFile(doc: Y.Doc, name: string): FileMeta {
  const path = name.trim().replace(/^\/+/, '');
  const map = filesMap(doc);
  const existing = map.get(path);
  if (existing) return existing;
  const meta: FileMeta = { path, name: path, lang: detectLang(path) };
  map.set(path, meta);
  return meta;
}

/**
 * Seed a fresh room with a welcome file so two people always land on the same
 * document. Guarded so only the first client to arrive writes it.
 */
export function ensureSeedFiles(doc: Y.Doc): void {
  const map = filesMap(doc);
  if (map.size > 0) return;
  const meta = addFile(doc, 'welcome.js');
  const text = fileText(doc, meta.path);
  if (text.length === 0) {
    text.insert(
      0,
      [
        '// Welcome to your real-time IDE 👋',
        '// Open this URL in another tab (or send it to a friend)',
        '// and type here — you\'ll see each other\'s cursors live.',
        '',
        'function greet(name) {',
        '  return `hello, ${name}`;',
        '}',
        '',
      ].join('\n')
    );
  }
}
