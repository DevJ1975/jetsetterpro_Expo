'use strict';

const fs = require('fs');
const path = require('path');

// ---- What goes into the corpus -------------------------------------------
// The pinned SDK 56 knowledge docs, plus this repo's own source (app/ + src/),
// so the SDK56 agent can retrieve BOTH "what does SDK 56 say" and "how does THIS
// codebase actually use it".
const DOC_FILES = [
  '.claude/skills/expo-sdk-56/SKILL.md',
  '.claude/skills/expo-sdk-56/references/build-and-configure.md',
  '.claude/skills/expo-sdk-56/references/breaking-changes.md',
];
const CODE_ROOTS = ['app', 'src'];

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MD_EXT = new Set(['.md', '.mdx']);
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.expo', 'dist', 'build', 'coverage',
  'functions', 'ios', 'android', 'assets', '__snapshots__',
]);
const MAX_FILE_BYTES = 256 * 1024; // skip anything larger — likely generated/minified

// Chunking knobs
const MD_MAX_CHARS = 1800;   // split markdown sections larger than this
const CODE_WINDOW = 50;      // lines per code chunk
const CODE_OVERLAP = 12;     // overlapping lines between adjacent code chunks

function repoRootFromHere() {
  // this file: <repo>/.claude/skills/expo-sdk-56/rag/lib/corpus.js
  return path.resolve(__dirname, '..', '..', '..', '..', '..');
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') {
      // skip dotfiles/dirs inside source trees (e.g. .DS_Store) but not our own tree
      if (e.isDirectory()) continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (CODE_EXT.has(ext) || MD_EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

// Returns [{ absPath, relPath, kind }]
function collectFiles(repoRoot = repoRootFromHere()) {
  const files = [];
  const seen = new Set();

  const add = (absPath) => {
    const relPath = path.relative(repoRoot, absPath);
    if (seen.has(relPath)) return;
    let stat;
    try { stat = fs.statSync(absPath); } catch { return; }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES || stat.size === 0) return;
    const ext = path.extname(absPath).toLowerCase();
    const kind = MD_EXT.has(ext) ? 'markdown' : 'code';
    seen.add(relPath);
    files.push({ absPath, relPath, kind });
  };

  for (const rel of DOC_FILES) add(path.join(repoRoot, rel));
  for (const root of CODE_ROOTS) {
    const abs = path.join(repoRoot, root);
    if (fs.existsSync(abs)) walk(abs, []).forEach(add);
  }
  return files;
}

// ---- Chunkers -------------------------------------------------------------

function splitLargeMarkdown(chunk) {
  if (chunk.text.length <= MD_MAX_CHARS) return [chunk];
  const paras = chunk.text.split(/\n{2,}/);
  const out = [];
  let buf = [];
  let len = 0;
  const flush = () => {
    const text = buf.join('\n\n').trim();
    if (text) out.push({ ...chunk, text });
    buf = [];
    len = 0;
  };
  for (const p of paras) {
    if (len + p.length > MD_MAX_CHARS && buf.length) flush();
    buf.push(p);
    len += p.length + 2;
  }
  flush();
  return out.length ? out : [chunk];
}

function chunkMarkdown(relPath, content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  const headingStack = []; // [{ level, text }]
  let cur = { headingPath: [], startLine: 1, buf: [] };
  let lineNo = 0;

  const flush = (endLine) => {
    const text = cur.buf.join('\n').trim();
    if (text) {
      chunks.push({
        source: relPath,
        kind: 'markdown',
        heading: cur.headingPath.join(' > '),
        startLine: cur.startLine,
        endLine,
        text,
      });
    }
  };

  for (const line of lines) {
    lineNo++;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush(lineNo - 1);
      const level = m[1].length;
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: m[2].trim() });
      cur = { headingPath: headingStack.map((h) => h.text), startLine: lineNo, buf: [line] };
    } else {
      cur.buf.push(line);
    }
  }
  flush(lineNo);
  return chunks.flatMap(splitLargeMarkdown);
}

function chunkCode(relPath, content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  if (!lines.length) return chunks;
  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + CODE_WINDOW, lines.length);
    const slice = lines.slice(start, end);
    const body = slice.join('\n').trim();
    if (body) {
      chunks.push({
        source: relPath,
        kind: 'code',
        heading: '',
        startLine: start + 1,
        endLine: end,
        // Prepend a locator so the embedding (and the reader) knows the origin.
        text: `// ${relPath} (lines ${start + 1}-${end})\n${slice.join('\n')}`,
      });
    }
    if (end === lines.length) break;
    start += CODE_WINDOW - CODE_OVERLAP;
  }
  return chunks;
}

// Returns a flat array of chunk objects (without embeddings) for the whole corpus.
function buildChunks(repoRoot = repoRootFromHere()) {
  const files = collectFiles(repoRoot);
  const chunks = [];
  for (const f of files) {
    let content;
    try { content = fs.readFileSync(f.absPath, 'utf8'); } catch { continue; }
    const fileChunks = f.kind === 'markdown'
      ? chunkMarkdown(f.relPath, content)
      : chunkCode(f.relPath, content);
    for (const c of fileChunks) chunks.push(c);
  }
  // Stable ids so an index diff is readable.
  chunks.forEach((c, i) => { c.id = i; });
  return { files, chunks };
}

module.exports = {
  repoRootFromHere,
  collectFiles,
  chunkMarkdown,
  chunkCode,
  buildChunks,
  DOC_FILES,
  CODE_ROOTS,
};
