/**
 * Collaborative CodeMirror 6 editor for a single file.
 *
 * yCollab wires the editor to the file's Y.Text (content sync) and to awareness
 * (remote cursors + selections). Switching files rebuilds the editor bound to
 * the new Y.Text.
 */
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { yCollab } from 'y-codemirror.next';
import { fileText, type FileMeta } from '../collab/session';

interface EditorProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
  file: FileMeta;
}

function langExtension(lang: FileMeta['lang']) {
  if (lang === 'javascript') return javascript({ jsx: true, typescript: true });
  if (lang === 'python') return python();
  return [];
}

export default function Editor({ doc, provider, file }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const yText = fileText(doc, file.path);
    const undoManager = new Y.UndoManager(yText);

    const state = EditorState.create({
      doc: yText.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langExtension(file.lang),
        oneDark,
        EditorView.lineWrapping,
        // The collaborative binding: content + remote cursors via awareness.
        yCollab(yText, provider.awareness, { undoManager }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    view.focus();

    return () => {
      view.destroy();
      undoManager.destroy();
    };
  }, [doc, provider, file.path, file.lang]);

  return <div className="editor-host" ref={hostRef} />;
}
