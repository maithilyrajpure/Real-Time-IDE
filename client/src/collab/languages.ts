/**
 * Single source of truth for language detection, sidebar badges, and which
 * languages can be executed (via the Piston runner).
 */
export type LangId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c'
  | 'rust'
  | 'php'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'xml'
  | 'yaml'
  | 'sql'
  | 'text';

export interface LangMeta {
  /** Short badge shown in the file tree. */
  label: string;
  /** Piston language/alias — present only for executable languages. */
  pistonLang?: string;
}

export const LANG_META: Record<LangId, LangMeta> = {
  javascript: { label: 'JS', pistonLang: 'javascript' },
  typescript: { label: 'TS', pistonLang: 'typescript' },
  python: { label: 'PY', pistonLang: 'python' },
  java: { label: 'JAVA', pistonLang: 'java' },
  cpp: { label: 'C++', pistonLang: 'c++' },
  c: { label: 'C', pistonLang: 'c' },
  rust: { label: 'RS', pistonLang: 'rust' },
  php: { label: 'PHP', pistonLang: 'php' },
  html: { label: 'HTML' },
  css: { label: 'CSS' },
  json: { label: 'JSON' },
  markdown: { label: 'MD' },
  xml: { label: 'XML' },
  yaml: { label: 'YAML' },
  sql: { label: 'SQL' },
  text: { label: 'TXT' },
};

const EXT_MAP: Record<string, LangId> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  java: 'java',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  rs: 'rust',
  php: 'php',
  html: 'html', htm: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown', markdown: 'markdown',
  xml: 'xml',
  yaml: 'yaml', yml: 'yaml',
  sql: 'sql',
};

export function detectLang(name: string): LangId {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'text';
}

export function isRunnable(id: LangId): boolean {
  return !!LANG_META[id].pistonLang;
}
