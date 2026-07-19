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
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import { fileText, type FileMeta } from '../collab/session';
import type { LangId } from '../collab/languages';

interface EditorProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
  file: FileMeta;
}

function langExtension(lang: LangId): Extension {
  switch (lang) {
    case 'javascript':
      return javascript({ jsx: true });
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'python':
      return python();
    case 'java':
      return java();
    case 'c':
    case 'cpp':
      return cpp();
    case 'rust':
      return rust();
    case 'php':
      return php();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'markdown':
      return markdown();
    case 'xml':
      return xml();
    case 'yaml':
      return yaml();
    case 'sql':
      return sql();
    default:
      return [];
  }
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
