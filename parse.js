
// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

function renderBlocks(block, refs, out) {
  for (const child of block.children) renderBlock(child, refs, out);
}

function renderBlock(b, refs, out) {
  switch (b.t) {
    case 'empty':
      return;
    case 'para': {
      out.push('<p>' + renderInline(parseInline(b.lines.join('\n'), refs)) + '</p>\n');
      return;
    }
    case 'heading': {
      out.push('<h' + b.level + '>' + renderInline(parseInline(b.text, refs)) + '</h' + b.level + '>\n');
      return;
    }
    case 'code': {
      let tag = '<pre><code';
      if (b.fenced && b.info) {
        const lang = b.info.split(/[ \t]+/)[0].replace(/\\([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])/g, '$1');
        if (lang) tag += ' class="language-' + escText(lang) + '"';
      }
      out.push(tag + '>' + escCode(b.text) + '</code></pre>\n');
      return;
    }
    case 'html': {
      out.push(b.text);
      return;
    }
    case 'hr': {
      out.push('<hr>\n');
      return;
    }
    case 'quote': {
      out.push('<blockquote>\n');
      renderBlocks(b, refs, out);
      out.push('</blockquote>\n');
      return;
    }
    case 'list': {
      if (b.ordered) {
        out.push(b.start !== 1 ? '<ol start="' + b.start + '">\n' : '<ol>\n');
      } else {
        out.push('<ul>\n');
      }
      renderBlocks(b, refs, out);
      out.push(b.ordered ? '</ol>\n' : '</ul>\n');
      return;
    }
    case 'item': {
      renderItem(b, refs, out);
      return;
    }
    case 'table': {
      out.push('<table>\n<thead>\n<tr>\n');
      for (let i = 0; i < b.header.length; i++) {
        const a = b.aligns[i];
        out.push('<th' + (a ? ' align="' + a + '"' : '') + '>' +
          renderInline(parseInline(b.header[i], refs)) + '</th>\n');
      }
      out.push('</tr>\n</thead>\n');
      if (b.rows.length) {
        out.push('<tbody>');
        for (const row of b.rows) {
          out.push('<tr>\n');
          for (let i = 0; i < b.header.length; i++) {
            const cell = i < row.length ? row[i] : '';
            const a = b.aligns[i];
            out.push('<td' + (a ? ' align="' + a + '"' : '') + '>' +
              renderInline(parseInline(cell, refs)) + '</td>\n');
          }
          out.push('</tr>\n');
        }
        out.push('</tbody>');
      }
      out.push('</table>\n');
      return;
    }
  }
}

// Render one list item. Tight lists render a sole paragraph's inline
// content directly; loose lists render paragraphs as <p> blocks.
function renderItem(item, refs, out) {
  const loose = item.parent && item.parent.loose;
  const kids = item.children.filter((c) => c.t !== 'empty');
  // Task list marker: first paragraph starts with [ ] / [x] / [X].
  let task = null;
  if (kids.length && kids[0].t === 'para' && kids[0].lines.length) {
    const m = /^(\[[ xX]\])(?:[ \t]+|$)/.exec(kids[0].lines[0]);
    if (m) task = m[1];
  }
  if (!loose && kids.length === 1 && kids[0].t === 'para') {
    let html = renderInline(parseInline(kids[0].lines.join('\n'), refs));
    if (task) {
      const checked = task === '[x]' || task === '[X]';
      html = '<input' + (checked ? ' checked=""' : '') + ' disabled="" type="checkbox">' +
        html.slice(task.length);
    }
    out.push('<li>' + html + '</li>\n');
    return;
  }
  if (!loose && kids.length === 1 && kids[0].t === 'table') {
    out.push('<li>');
    renderBlock(kids[0], refs, out);
    out.push('</li>\n');
    return;
  }
  out.push('<li>');
  for (let ci = 0; ci < kids.length; ci++) {
    const child = kids[ci];
    if (!loose && child.t === 'para') {
      let html = renderInline(parseInline(child.lines.join('\n'), refs));
      if (ci === 0 && task) {
        const checked = task === '[x]' || task === '[X]';
        html = '<input' + (checked ? ' checked=""' : '') + ' disabled="" type="checkbox">' +
          html.slice(task.length);
      }
      out.push(html);
    } else if (loose && ci === 0 && task && child.t === 'para') {
      let html = renderInline(parseInline(child.lines.join('\n'), refs));
      const checked = task === '[x]' || task === '[X]';
      html = '<input' + (checked ? ' checked=""' : '') + ' disabled="" type="checkbox">' +
        html.slice(task.length);
      out.push('<p>' + html + '</p>\n');
    } else {
      renderBlock(child, refs, out);
    }
  }
  out.push('</li>\n');
}

export function parse(src) {
  const doc = parseBlocks(src);
  const refs = doc.refs || new Map();
  const out = [];
  renderBlocks(doc, refs, out);
  return out.join('');
}

// parse.js — fast, dependency-free Markdown parser producing exactly the
// HTML marked 18.1.3 produces with its default options (gfm on, breaks
// off, pedantic off). Written from scratch from the CommonMark 0.31.2 spec
// and the GFM 0.29 extensions. Two phases: a line-oriented block parser
// building a block tree, then an inline parser (delimiter stack, as in the
// CommonMark reference algorithm) turning text into HTML.

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const PUNCT = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
function isPunct(ch) {
  return ch.length === 1 && PUNCT.indexOf(ch) >= 0;
}
function isBlankLine(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== ' ' && c !== '\t') return false;
  }
  return true;
}

// Escape for code spans / code blocks: every special char is escaped.
const CODE_ESC_RE = /[&<>"']/g;
function escCode(s) {
  return s.replace(CODE_ESC_RE, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

// Escape for ordinary text and attribute values. An ampersand starting a
// character reference is left alone when it is a named entity; a valid
// numeric reference is decoded and the resulting character escaped; any
// other ampersand becomes &amp;. This matches marked: named entities pass
// through verbatim, only numeric ones are decoded.
const TEXT_ESC_RE = /&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*));|[&<>"']/g;
function escText(s) {
  return s.replace(TEXT_ESC_RE, (m, dec, hex, name) => {
    if (name !== undefined) return m;
    if (dec !== undefined || hex !== undefined) {
      let cp = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
      if (cp > 0x10ffff) return '&amp;' + m.slice(1);
      if (cp === 0 || (cp >= 0xd800 && cp <= 0xdfff)) cp = 0xfffd;
      const ch = String.fromCodePoint(cp);
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      if (ch === "'") return '&#39;';
      return ch;
    }
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

// marked's URL cleaning: encodeURI, keeping %XX sequences intact.
function cleanUrl(href) {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch (e) {
    return null;
  }
}

// Columns of leading whitespace of s, where s starts at absolute column
// `base` (space = 1, tab = to the next multiple of 4). Returns {col, i}:
// col is the absolute column of the first non-whitespace character, i its
// index. Tab widths depend on the absolute column, so every strip of a
// partially-consumed tab stays exact.
function indentCols(s, base) {
  base = base || 0;
  let col = base, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { col++; i++; }
    else if (c === '\t') { col += 4 - (col % 4); i++; }
    else break;
  }
  return { col, i };
}

// Remove n columns of leading indentation from s, where s starts at
// absolute column `base`. A tab straddling the boundary is replaced by
// the spaces that remain.
function stripIndent(s, n, base) {
  base = base || 0;
  let i = 0, col = base;
  const target = base + n;
  while (i < s.length && col < target) {
    const c = s[i];
    if (c === ' ') { col++; i++; }
    else if (c === '\t') {
      const w = 4 - (col % 4);
      if (col + w > target) return ' '.repeat(col + w - target) + s.slice(i + 1);
      col += w; i++;
    } else break;
  }
  return s.slice(i);
}

// Expand tabs in the leading whitespace of `s` to spaces, using the
// absolute column `col` of s[0] (a tab advances to the next multiple of
// 4). Only the leading run of spaces/tabs is touched; tabs after the
// first non-space character are kept verbatim. Marked expands these
// tabs when the line sits inside a container (list/quote) but keeps a
// tab that starts at column 0 at top level, so callers only invoke
// this when the line went through container stripping (col > 0).
function expandLeadingTabs(s, col) {
  let i = 0, c = col, out = '';
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) {
    if (s[i] === '\t') { const w = 4 - (c % 4); out += ' '.repeat(w); c += w; }
    else { out += ' '; c++; }
    i++;
  }
  return out + s.slice(i);
}

// The column used for tab expansion inside a code block: marked
// re-parses each quote level's content, so containers OUTSIDE the
// innermost quote contribute nothing to the tab column; containers
// inside it (and the quote itself, 2) do. With no quote ancestor the
// absolute column stands.
function tabCol(block, col) {
  let q = null, b = block.parent;
  while (b) { if (b.t === 'quote') { q = b; break; } b = b.parent; }
  if (!q) return col;
  let sub = 0; b = q.parent;
  while (b) {
    if (b.t === 'quote') sub += 2;
    else if (b.t === 'item') sub += b.contentIndent || 0;
    b = b.parent;
  }
  return col - sub;
}

// ---------------------------------------------------------------------------
// Link reference definitions
// ---------------------------------------------------------------------------

// Parse a link label starting just after '[' at s[j]. Returns {label,
// end} (end = index just past ']') or null. Labels may contain balanced
// brackets and backslash escapes; they may not be empty.
function parseLinkLabel(s, j) {
  // `j` points at the first character inside the label. A label ends at
  // the first unescaped ']' (a '[' inside does not nest); a ']' inside a
  // code span or an HTML tag does not close it.
  let k = j;
  while (k < s.length) {
    const c = s[k];
    if (c === '\\' && k + 1 < s.length) { k += 2; continue; }
    if (c === '`') {
      let m = k;
      while (m < s.length && s[m] === '`') m++;
      const run = m - k;
      let q = m, found = -1;
      while (q < s.length) {
        if (s[q] === '`') {
          let e = q;
          while (e < s.length && s[e] === '`') e++;
          if (e - q === run) { found = e; break; }
          q = e;
        } else q++;
      }
      if (found < 0) return null;
      k = found;
      continue;
    }
    if (c === '<') {
      const he = matchInlineHtml(s, k);
      if (he > 0) { k = he; continue; }
    }
    // A reference label may not contain an unescaped '['.
    if (c === '[') return null;
    if (c === ']') {
      const label = s.slice(j, k);
      if (label.length === 0) return null;
      return { label, end: k + 1 };
    }
    k++;
  }
  return null;
}

// Normalize a link label for lookup: collapse whitespace to single
// spaces, trim, lowercase.
function normalizeLabel(label) {
  // Unicode case folding: the sharp s and ligatures fold to multiple
  // letters, which toLowerCase() alone does not do ('ẞ' -> 'ß', not 'ss').
  let s = '';
  for (const ch of label) s += FOLD_MAP[ch] || ch;
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}
const FOLD_MAP = {
  '\u1E9E': 'ss', '\u00DF': 'ss',
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi',
  '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
};

// Parse a bare link destination at s[p]: no spaces or control chars,
// balanced parens allowed. Returns {dest, end} or null.
function parseBareDest(s, p) {
  let k = p, depth = 0, start = p;
  while (k < s.length) {
    const c = s[k];
    if (c === ' ' || c === '\t' || c === '\n' || c.charCodeAt(0) < 0x20) break;
    if (c === '\\' && k + 1 < s.length && isPunct(s[k + 1])) { k += 2; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) break;
      depth--;
    }
    k++;
  }
  if (k === start) return null;
  let dest = s.slice(start, k);
  dest = dest.replace(/\\([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])/g, '$1');
  return { dest, end: k };
}

// Parse a link title at s[p]: "..." or '...' or (...).
// Returns {title, end} or null.
function parseLinkTitle(s, p) {
  const c = s[p];
  if (c !== '"' && c !== "'" && c !== '(') return null;
  const close = c === '(' ? ')' : c;
  let k = p + 1, start = k, out = '';
  while (k < s.length) {
    const ch = s[k];
    if (ch === '\\' && k + 1 < s.length && isPunct(s[k + 1])) {
      out += s.slice(start, k) + s[k + 1]; k += 2; start = k; continue;
    }
    if (ch === close) {
      out += s.slice(start, k);
      return { title: out, end: k + 1 };
    }
    if (ch === '(' && c === '(') return null;
    k++;
  }
  return null;
}

// Try to parse one link reference definition starting at lines[pos].
// The definition (label, destination, title) may span lines; the title
// may itself contain newlines. Returns {label, dest, title, next} (next
// = index after the last line used) or null.
function parseLinkDef(lines, pos) {
  const text = lines.slice(pos).join('\n');
  const m = text.match(/^ {0,3}\[/);
  if (!m) return null;
  let j = m[0].length;
  const labelRes = parseLinkLabel(text, j);
  if (!labelRes) return null;
  const rawLabel = labelRes.label;
  j = labelRes.end;
  while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
  if (text[j] !== ':') return null;
  j++;
  // Skip whitespace including newlines before the destination.
  while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n')) j++;
  if (j >= text.length) return null;
  let dest = null;
  if (text[j] === '<') {
    const end = findGt(text, j + 1);
    if (end < 0) return null;
    const d = text.slice(j + 1, end);
    if (/[\n<>]/.test(d)) return null;
    dest = d.replace(/\\([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])/g, '$1');
    j = end + 1;
  } else {
    const d = parseBareDest(text, j);
    if (d === null) return null;
    dest = d.dest; j = d.end;
  }
  let title = null;
  const saveJ = j;
  let k = j;
  while (k < text.length && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n')) k++;
  // A title must be separated from the destination by whitespace, and
  // must be followed by nothing but whitespace to the end of its line;
  // otherwise the definition is destination-only.
  if (k > saveJ && k < text.length && (text[k] === '"' || text[k] === "'" || text[k] === '(')) {
    const t = parseLinkTitle(text, k);
    if (t) {
      let q = t.end;
      while (q < text.length && (text[q] === ' ' || text[q] === '\t')) q++;
      if (q >= text.length || text[q] === '\n') { title = t.title; j = t.end; }
    }
  }
  if (title === null) j = saveJ;
  // After destination/title, only spaces/tabs may remain on the line.
  let q = j;
  while (q < text.length && (text[q] === ' ' || text[q] === '\t')) q++;
  if (q < text.length && text[q] !== '\n') return null;
  const label = normalizeLabel(rawLabel);
  if (!label) return null;
  const linesUsed = text.slice(0, q).split('\n').length;
  return { label, dest, title, next: pos + linesUsed };
}

// ---------------------------------------------------------------------------
// Block parsing helpers
// ---------------------------------------------------------------------------

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body ' +
  'caption center col colgroup dd details dialog dir div dl dt fieldset ' +
  'figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header ' +
  'hr html iframe legend li link main menu menuitem nav noframes ol optgroup ' +
  'option p param section source summary table tbody td tfoot th thead title ' +
  'tr track ul').split(' '));

// Read a complete HTML tag at s[i] ('<'). Returns {end, name, closing}
// or null.
function htmlTagAt(s, i) {
  if (s[i] !== '<') return null;
  let j = i + 1;
  let closing = false;
  if (s[j] === '/') { closing = true; j++; }
  const nameStart = j;
  if (j >= s.length || !/[A-Za-z]/.test(s[j])) return null;
  j++;
  while (j < s.length && /[A-Za-z0-9-]/.test(s[j])) j++;
  const name = s.slice(nameStart, j).toLowerCase();
  if (closing) {
    // A closing tag takes no attributes: only whitespace, then '>'.
    while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n')) j++;
    if (s[j] === '>') return { end: j + 1, name, closing };
    return null;
  }
  for (;;) {
    // An attribute must be preceded by whitespace; a bare ':' (as in
    // `<m:abc>`) is not an attribute and invalidates the tag.
    let ws = 0;
    while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n')) { j++; ws++; }
    if (j >= s.length) return null;
    if (s[j] === '>') return { end: j + 1, name, closing };
    if (s[j] === '/') {
      if (s[j + 1] === '>') return { end: j + 2, name, closing };
      return null;
    }
    if (ws === 0) return null;
    if (!/[A-Za-z_:]/.test(s[j])) return null;
    j++;
    while (j < s.length && /[A-Za-z0-9_.:-]/.test(s[j])) j++;
    // Optional attribute value: whitespace, '=', whitespace, value.
    // (Look ahead without consuming, so a valueless attribute still
    // leaves its separating whitespace for the next iteration.)
    let k = j;
    while (k < s.length && (s[k] === ' ' || s[k] === '\t' || s[k] === '\n')) k++;
    if (s[k] === '=') {
      j = k + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n')) j++;
      if (s[j] === '"' || s[j] === "'") {
        const q = s[j]; j++;
        while (j < s.length && s[j] !== q) j++;
        if (j >= s.length) return null;
        j++;
      } else {
        const vStart = j;
        while (j < s.length && !/[ \t\n"'=<>`]/.test(s[j])) j++;
        if (j === vStart) return null;
      }
    }
  }
}

// Classify an HTML block starting at the beginning of `line` (container
// prefixes stripped, indentation <= 3 columns). Returns {type, endTag}
// (endTag ends types 1-5; types 6-7 end at a blank line) or null. A block
// tag name alone (tag may span lines) starts type 6; any other complete
// tag starts type 7 only when nothing but whitespace follows it.
function htmlBlockStart(line, base) {
  const ind = indentCols(line, base);
  if (ind.col - (base || 0) > 3) return null;
  if (line[ind.i] !== '<') return null;
  const s = line.slice(ind.i);
  if (s.startsWith('<!--')) return { type: 2, endTag: '-->' };
  if (s.startsWith('<?')) return { type: 3, endTag: '?>' };
  if (/^<![A-Za-z]/.test(s)) return { type: 4, endTag: '>' };
  if (s.startsWith('<![CDATA[')) return { type: 5, endTag: ']]>' };
  const m1 = s.slice(1).match(/^(script|pre|style|textarea)([\s>]|$)/i);
  if (m1) return { type: 1, endTag: '</' + m1[1].toLowerCase() };
  const nm = s.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s>\/]|$)/);
  if (!nm) return null;
  if (BLOCK_TAGS.has(nm[1].toLowerCase())) return { type: 6, endTag: null };
  const tag = htmlTagAt(line, ind.i);
  if (tag && line.slice(tag.end).trim() === '') return { type: 7, endTag: null };
  return null;
}

// Match a block quote marker at the start of s. Returns {s, col} (the
// remaining string and its column) or null.
function matchQuote(s, col) {
  const ind = indentCols(s, col);
  if (ind.col - col > 3) return null;
  if (s[ind.i] !== '>') return null;
  let rest = s.slice(ind.i + 1);
  let ncol = col + (ind.col - col) + 1;
  if (rest.startsWith(' ')) { rest = rest.slice(1); ncol++; }
  else if (rest.startsWith('\t')) {
    const w = 4 - (ncol % 4);
    rest = ' '.repeat(w - 1) + rest.slice(1);
    ncol++;
  }
  return { s: rest, col: ncol };
}

// Match a list marker at the start of s (indentation <= 3 columns,
// relative to `base`, the absolute column where s starts).
// Returns {ordered, start, bullet, delim, markerLen, contentIndent,
// empty, rest, restCol} or null. contentIndent and restCol are absolute
// columns.
function matchListMarker(s, base) {
  base = base || 0;
  const ind = indentCols(s, base);
  if (ind.col - base > 3) return null;
  const t = s.slice(ind.i);
  let m = t.match(/^([*+-])(?=$|[\t ])/);
  let ordered = false, start = 0, bullet = null, markerLen = 0;
  if (m) {
    bullet = m[1]; markerLen = 1;
  } else {
    m = t.match(/^(\d{1,9})([.)])(?=$|[\t ])/);
    if (!m) return null;
    ordered = true; start = parseInt(m[1], 10); markerLen = m[1].length + 1;
  }
  let j = markerLen, ws = 0;
  const baseCol = ind.col + markerLen;
  while (j < t.length && (t[j] === ' ' || t[j] === '\t')) {
    if (t[j] === ' ') { ws++; j++; }
    else { const w = 4 - ((baseCol + ws) % 4); ws += w; j++; }
  }
  let contentIndent, rest;
  if (j >= t.length) {
    contentIndent = ind.col - base + markerLen + 1;
    rest = '';
  } else if (ws >= 1 && ws <= 4) {
    contentIndent = ind.col - base + markerLen + ws;
    rest = stripIndent(t.slice(markerLen), ws, baseCol);
  } else {
    contentIndent = ind.col - base + markerLen + 1;
    rest = stripIndent(t.slice(markerLen), 1, baseCol);
  }
  return {
    ordered, start, bullet, markerLen,
    delim: ordered ? t[markerLen - 1] : null,
    contentIndent, empty: j >= t.length, rest,
    restCol: ind.col + markerLen + (j >= t.length ? 1 : (ws >= 1 && ws <= 4 ? ws : 1)),
  };
}

// ATX heading: /^ {0,3}(#{1,6})( +|$)/ with optional closing sequence.
function matchAtx(s, base) {
  const ind = indentCols(s, base);
  if (ind.col - (base || 0) > 3) return null;
  const t = s.slice(ind.i);
  const m = t.match(/^(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/);
  if (!m) return null;
  let text = m[2] === undefined ? '' : m[2];
  // A closing sequence is #'s at the end preceded by a space. Prepend a
  // space so a text consisting only of #'s is recognised as one.
  text = (' ' + text).replace(/[ \t]+#+[ \t]*$/, '').trim();
  return { level: m[1].length, text };
}

// Fenced code block start: /^ {0,3}(`{3,}|~{3,})/ with info string
// (backtick fences may not contain backticks in the info string).
// `indent` is the fence's indentation relative to `base`.
function matchFence(s, base) {
  base = base || 0;
  const ind = indentCols(s, base);
  if (ind.col - base > 3) return null;
  const t = s.slice(ind.i);
  const m = t.match(/^(`{3,}|~{3,})(.*)$/);
  if (!m) return null;
  const fence = m[1];
  const info = m[2];
  if (fence[0] === '`' && info.indexOf('`') >= 0) return null;
  return { char: fence[0], len: fence.length, info: info.trim(), indent: ind.col - base };
}

// Thematic break: three or more of -, _ or * (one kind), spaces allowed.
function matchHr(s, base) {
  const ind = indentCols(s, base);
  if (ind.col - (base || 0) > 3) return null;
  const t = s.slice(ind.i).replace(/[ \t]+$/, '');
  if (t.length < 3) return false;
  const c = t[0];
  if (c !== '-' && c !== '_' && c !== '*') return false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== c && ch !== ' ' && ch !== '\t') return false;
  }
  return true;
}

// Setext heading underline: /^ {0,3}(=+|-+)[ \t]*$/.
function matchSetext(s, base) {
  const ind = indentCols(s, base);
  if (ind.col - (base || 0) > 3) return null;
  const m = s.slice(ind.i).match(/^(=+|-+)[ \t]*$/);
  if (!m) return null;
  return m[1][0] === '=' ? 1 : 2;
}

// Does this line start a block that can interrupt a paragraph?
function startsInterruptBlock(s, base) {
  if (matchAtx(s, base)) return true;
  if (matchFence(s, base)) return true;
  if (matchHr(s, base)) return true;
  if (matchQuote(s, base || 0)) return true;
  const hb = htmlBlockStart(s, base);
  if (hb && hb.type !== 7) return true;
  const lm = matchListMarker(s, base);
  if (lm && !lm.empty && (!lm.ordered || lm.start === 1)) return true;
  return false;
}

function newBlock(type) {
  return {
    t: type, children: [], open: true, lastLineBlank: false, parent: null,
  };
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

export function parseBlocks(src) {
  src = src.replace(/\r\n?/g, '\n');
  const srcEndsNl = src.endsWith('\n');
  const lines = src.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  const doc = newBlock('doc');
  let tip = doc;

  // Link reference definitions, collected in document order (first
  // definition wins). Paragraphs strip their leading definitions when
  // they close (finalize) or when a setext underline is found, so the
  // definitions never become paragraph or heading text.
  const refs = new Map();
  doc.refs = refs;

  // Strip leading link reference definitions from a paragraph's lines,
  // registering them. Returns the remaining lines.
  function stripDefs(block) {
    let pos = 0;
    while (pos < block.lines.length) {
      const def = parseLinkDef(block.lines, pos);
      if (!def) break;
      if (!refs.has(def.label)) refs.set(def.label, { dest: def.dest, title: def.title });
      pos = def.next;
    }
    return block.lines.slice(pos);
  }

  function addChild(parent, block) {
    if (parent.t === 'item' && parent.children.length > 0 && parent.lastLineBlank) {
      parent.parent.loose = true;
    }
    block.parent = parent;
    parent.children.push(block);
    // A new block clears the "blank line seen" flag on the whole parent
    // chain: a blank line inside a nested structure must not leak
    // looseness to an outer list.
    let n = parent;
    while (n) { n.lastLineBlank = false; n = n.parent; }
    tip = block;
    return block;
  }

  function finalize(block) {
    block.open = false;
    if (block.t === 'para') {
      if (!tryTable(block)) {
        block.lines = stripDefs(block);
        if (block.lines.length === 0) block.t = 'empty';
      }
    } else if (block.t === 'code') {
      if (!block.fenced) {
        while (block.lines.length && block.lines[block.lines.length - 1] === '') {
          block.lines.pop();
        }
      } else if (block.lines.length && block.lines[block.lines.length - 1] === '') {
        // A fenced code block drops exactly one trailing blank line.
        block.lines.pop();
      }
      block.text = block.lines.join('\n');
      // A block of only blank lines still renders one '\n' per line;
      // join('') hides them, so gate on the line count, not the text.
      if (block.lines.length) block.text += '\n';
    } else if (block.t === 'html') {
      block.text = block.lines.join('\n');
      // Trailing newline: types 1-5 end at an end tag, so the last
      // line's newline is kept unless the next line is blank (or the
      // block is at EOF without one). Types 6-7 end between lines, so
      // a trailing newline appears only at EOF with one in the source.
      if (block.text.length) {
        const ll = block.lastLine === undefined ? lines.length - 1 : block.lastLine;
        if (block.htmlType <= 5) {
          // Only a truly empty next line suppresses the trailing
          // newline; a whitespace-only line (tab/spaces) keeps it.
          const nextBlank = ll + 1 < lines.length && lines[ll + 1].length === 0;
          if (!nextBlank && (ll < lines.length - 1 || srcEndsNl)) block.text += '\n';
        } else if (ll >= lines.length - 1 && srcEndsNl) {
          block.text += '\n';
        }
      }
    }
  }

  function closeTo(container) {
    while (tip !== container) {
      const b = tip;
      tip = tip.parent;
      finalize(b);
    }
  }

  // Handle a blank line (the remainder `s` after container prefixes were
  // stripped, starting at absolute column `base`). `rawBlank` is true when
  // the whole line is whitespace. Blank lines inside code blocks are
  // content, not structural: they do not mark anything loose.
  function handleBlank(s, base, rawBlank) {
    if (tip.t === 'para') { const p = tip; tip = tip.parent; finalize(p); }
    if (tip.t === 'code') {
      tip.lines.push(stripIndent(s, tip.fenced ? tip.fenceIndent : 4, base || 0));
      return;
    }
    if (tip.t === 'html') {
      if (tip.htmlType >= 6) { const h = tip; tip = tip.parent; h.closedByBlank = true; finalize(h); }
      else tip.lines.push('');
    }
    // Mark the blank line. A raw blank line marks every open container;
    // a line blank only after stripping container prefixes (e.g. `>`)
    // marks only the innermost container, so it cannot leak looseness
    // to an outer list.
    if (rawBlank) {
      let n = tip;
      while (n) { n.lastLineBlank = true; n = n.parent; }
    } else {
      tip.lastLineBlank = true;
    }
    // A blank line closes an empty list item: it cannot gain content
    // afterwards.
    if (tip.t === 'item' && tip.children.length === 0) {
      const it = tip; tip = tip.parent; finalize(it);
    }
  }

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    const isLast = ln === lines.length - 1;

    // Phase A: match open containers. This runs for blank lines too: a
    // block quote requires its marker even on a blank line (a marker-less
    // blank line ends the quote), while a list item matches any blank
    // line (the item stays open, the list may go loose).
    let container = doc;
    let cur = line;
    let col = 0;
    let allMatched = true;
    let lazy = false;
    let quoteMatched = false;
    let node = doc;
    while (true) {
      const kids = node.children;
      const last = kids.length ? kids[kids.length - 1] : null;
      if (!last || !last.open) break;
      if (last.t === 'quote') {
        const r = matchQuote(cur, col);
        if (r !== null) { cur = r.s; col = r.col; node = last; quoteMatched = true; }
        else if (!isBlankLine(cur) && tip.t === 'para' && !startsInterruptBlock(cur, col) && !matchListMarker(cur, col)) {
          // A lazy line indented >= 4 columns loses 4 of them.
          const ind = indentCols(cur, col);
          if (ind.col - col >= 4) { cur = stripIndent(cur, 4, col); col += 4; }
          lazy = true; node = last;
        } else { allMatched = false; break; }
      } else if (last.t === 'item') {
        if (isBlankLine(cur)) { node = last; }
        else {
          const ind = indentCols(cur, col);
          if (ind.col - col >= last.contentIndent) {
            cur = stripIndent(cur, last.contentIndent, col);
            col += last.contentIndent;
            node = last;
          } else if (tip.t === 'code' && tip.fenced) {
            // A fenced code block's content need not be indented to the
            // item's content indent: the line is still code content.
            node = last;
          } else if (tip.t === 'para' && !startsInterruptBlock(cur, col) && !matchListMarker(cur, col)) {
            // A lazy line indented >= 4 columns loses 4 of them.
            if (ind.col - col >= 4) { cur = stripIndent(cur, 4, col); col += 4; }
            lazy = true; node = last;
          } else { allMatched = false; break; }
        }
      } else if (last.t === 'list') {
        node = last;
      } else break;
    }
    container = node;

    // Phase B: close unmatched blocks.
    if (!allMatched) closeTo(container);

    // A line that is blank once its container prefixes are stripped
    // (e.g. `>>` inside two quotes) is a blank line — with one
    // exception: a whitespace-only remainder on the last line is kept
    // as paragraph text when a paragraph is open and the line came
    // from inside a block quote (the quote's content has no trailing
    // newline) or the source itself has none.
    if (isBlankLine(cur)) {
      if (cur !== '' && isLast && tip.t === 'para' && (quoteMatched || !srcEndsNl)) {
        tip.lines.push(cur);
        tip.lastLineBlank = false;
      } else if (cur.indexOf('\t') >= 0 && tip.t === 'para' && isTableCandidate(tip.lines)) {
        // A tab-only line inside a table is an empty row, not a blank
        // line: keep it in the paragraph so tryTable can emit it.
        tip.lines.push(cur);
        tip.lastLineBlank = false;
      } else {
        handleBlank(cur, col, isBlankLine(line));
      }
      continue;
    }

    // Phase D: start / continue blocks.
    while (true) {
      // Opening a container can leave an empty remainder (e.g. a lone
      // `>` line): that is a blank line, not a new paragraph.
      if (isBlankLine(cur)) {
        handleBlank(cur, col, isBlankLine(line));
        break;
      }
      if (container.t === 'list') {
        // A thematic break ends the list instead of starting an item.
        if (matchHr(cur, col)) {
          const l = container;
          container = container.parent; tip = container; finalize(l);
          continue;
        }
        const lm0 = matchListMarker(cur, col);
        if (lm0) {
          container = startList(container, lm0);
          cur = lm0.rest; col = lm0.restCol;
          if (lm0.empty) break;
          continue;
        }
        const l = container;
        container = container.parent; tip = container; finalize(l);
        continue;
      }
      if (tip.t === 'code' && tip.fenced) {
        const ind = indentCols(cur, col);
        if (ind.col - col <= 3) {
          const t = cur.slice(ind.i);
          const m = t.match(/^(`{3,}|~{3,})[ \t]*$/);
          if (m && m[1][0] === tip.fenceChar && m[1].length >= tip.fenceLen) {
            const c = tip; tip = tip.parent; finalize(c);
            break;
          }
        }
        tip.lines.push(stripIndent(col > 0 ? expandLeadingTabs(cur, tabCol(tip, col)) : cur, tip.fenceIndent, col));
        break;
      }
      if (tip.t === 'code' && !tip.fenced) {
        const ind = indentCols(cur, col);
        if (ind.col - col >= 4) {
          tip.lines.push(stripIndent(col > 0 ? expandLeadingTabs(cur, tabCol(tip, col)) : cur, 4, col));
          break;
        }
        const c = tip; tip = tip.parent; finalize(c);
        continue;
      }
      if (tip.t === 'html') {
        tip.lines.push(cur);
        tip.lastLine = ln;
        if (tip.htmlType <= 5 && tip.endTag && cur.toLowerCase().indexOf(tip.endTag) >= 0) {
          const h = tip; tip = tip.parent; finalize(h);
        }
        break;
      }
      if (tip.t === 'para') {
        const st = matchSetext(cur, col);
        // A lazy continuation line never interrupts the paragraph: it
        // is paragraph text, whatever it looks like.
        if (lazy) {
          if (st) tip.lines.push('    ' + cur);
          else tip.lines.push(cur);
          tip.lastLineBlank = false;
          break;
        }
        if (st) {
          // Strip leading link definitions first: they are not part of
          // the paragraph, so they must not become heading text.
          const rest = stripDefs(tip);
          if (rest.length === 0) {
            // The paragraph was only definitions: close it and start a
            // fresh paragraph with this line.
            tip.lines = [];
            const p = tip; tip = tip.parent; finalize(p);
            const np = newBlock('para');
            np.lines = [cur];
            addChild(container, np);
            break;
          }
          tip.lines = rest;
          tip.t = 'heading';
          tip.level = st;
          tip.text = rest.join('\n').trim();
          const h = tip; tip = tip.parent; finalize(h);
          break;
        }
        const atx = matchAtx(cur, col);
        if (atx) {
          const p = tip; tip = tip.parent; finalize(p);
          const h = newBlock('heading');
          h.level = atx.level; h.text = atx.text;
          addChild(container, h); finalize(h);
          break;
        }
        const fence = matchFence(cur, col);
        if (fence) {
          const p = tip; tip = tip.parent; finalize(p);
          const c = newBlock('code');
          c.fenced = true; c.fenceChar = fence.char; c.fenceLen = fence.len;
          c.fenceIndent = fence.indent; c.info = fence.info; c.lines = [];
          addChild(container, c);
          break;
        }
        if (matchHr(cur, col)) {
          const p = tip; tip = tip.parent; finalize(p);
          const h = newBlock('hr');
          addChild(container, h); finalize(h);
          break;
        }
        const hb = htmlBlockStart(cur, col);
        if (hb && hb.type !== 7) {
          const p = tip; tip = tip.parent; finalize(p);
          const h = newBlock('html');
          h.htmlType = hb.type; h.endTag = hb.endTag; h.lines = [cur]; h.lastLine = ln;
          addChild(container, h);
          if (hb.endTag && cur.toLowerCase().indexOf(hb.endTag) >= 0) {
            const hh = tip; tip = tip.parent; finalize(hh);
          }
          break;
        }
        const q = matchQuote(cur, col);
        if (q) {
          const p = tip; tip = tip.parent; finalize(p);
          const bq = newBlock('quote');
          addChild(container, bq);
          container = bq; cur = q.s; col = q.col;
          continue;
        }
        const lm = matchListMarker(cur, col);
        // An ordered list may interrupt a paragraph only when it
        // starts with 1 — except when the paragraph sits inside a list
        // item, where any start number may start a nested list.
        if (lm && !lm.empty && (!lm.ordered || lm.start === 1 || (tip.parent && tip.parent.t === 'item'))) {
          const p = tip; tip = tip.parent; finalize(p);
          container = startList(container, lm);
          cur = lm.rest; col = lm.restCol;
          continue;
        }
        // Lazy continuation lines that look like setext underlines are
        // handled above; anything reaching here is plain paragraph text.
        tip.lines.push(cur);
        tip.lastLineBlank = false;
        break;
      }

      // No leaf open: try to start a new block in `container`.
      const atx = matchAtx(cur, col);
      if (atx) {
        const h = newBlock('heading');
        h.level = atx.level; h.text = atx.text;
        addChild(container, h); finalize(h);
        break;
      }
      const fence = matchFence(cur, col);
      if (fence) {
        const c = newBlock('code');
        c.fenced = true; c.fenceChar = fence.char; c.fenceLen = fence.len;
        c.fenceIndent = fence.indent; c.info = fence.info; c.lines = [];
        addChild(container, c);
        break;
      }
      const hb = htmlBlockStart(cur, col);
      if (hb) {
        const h = newBlock('html');
        h.htmlType = hb.type; h.endTag = hb.endTag; h.lines = [cur]; h.lastLine = ln;
        addChild(container, h);
        if (hb.endTag && cur.toLowerCase().indexOf(hb.endTag) >= 0) {
          const hh = tip; tip = tip.parent; finalize(hh);
        }
        break;
      }
      if (matchHr(cur, col)) {
        const h = newBlock('hr');
        addChild(container, h); finalize(h);
        break;
      }
      const q = matchQuote(cur, col);
      if (q) {
        const bq = newBlock('quote');
        addChild(container, bq);
        container = bq; cur = q.s; col = q.col;
        continue;
      }
      const lm = matchListMarker(cur, col);
      if (lm) {
        container = startList(container, lm);
        cur = lm.rest; col = lm.restCol;
        if (lm.empty) break;
        continue;
      }
      const ind = indentCols(cur, col);
      if (ind.col - col >= 4) {
        const c = newBlock('code');
        c.fenced = false; c.lines = [stripIndent(cur, 4, col)];
        addChild(container, c);
        break;
      }
      const p = newBlock('para');
      p.lines = [cur];
      addChild(container, p);
      break;
    }
  }

  closeTo(doc);
  return doc;

  function startList(container, lm) {
    let list = null;
    if (container.t === 'list' && listMatches(container, lm)) {
      list = container;
    } else if (container.t === 'list') {
      const old = container;
      tip = old.parent; finalize(old);
      container = old.parent;
      list = newBlock('list');
      initList(list, lm);
      addChild(container, list);
    } else {
      list = newBlock('list');
      initList(list, lm);
      addChild(container, list);
    }
    if (list.children.length > 0) {
      const prev = list.children[list.children.length - 1];
      if (prev.lastLineBlank) list.loose = true;
    }
    const item = newBlock('item');
    item.contentIndent = lm.contentIndent;
    item.marker = lm;
    addChild(list, item);
    return item;
  }

  function initList(list, lm) {
    list.ordered = lm.ordered;
    list.start = lm.start;
    list.bullet = lm.bullet;
    list.delim = lm.delim;
    list.loose = false;
  }

  function listMatches(list, lm) {
    if (list.ordered !== lm.ordered) return false;
    if (lm.ordered) return list.delim === lm.delim;
    return list.bullet === lm.bullet;
  }
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------
// Flat item model: {t:'text',s} raw text (escaped at render), {t:'code',s}
// pre-escaped code, {t:'html',s} raw HTML, {t:'br'}, {t:'delim',ch,len,
// canOpen,canClose}, {t:'link',href,title,children:[items]},
// {t:'img',src,alt,title}, {t:'em'|'strong'|'del',children:[items]}.

const UNI_PUNCT_RE = /^[\p{P}\p{S}]$/u;
function isUniPunct(ch) {
  return ch.length === 1 && (PUNCT.indexOf(ch) >= 0 || UNI_PUNCT_RE.test(ch));
}
function isUniSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\s/.test(ch);
}

// Left/right flanking of the delimiter run s[i..j) (CommonMark).
function flanking(s, i, j) {
  const before = i > 0 ? s[i - 1] : '';
  const after = j < s.length ? s[j] : '';
  const afterWs = after === '' || isUniSpace(after);
  const afterPu = after !== '' && isUniPunct(after);
  const beforeWs = before === '' || isUniSpace(before);
  const beforePu = before !== '' && isUniPunct(before);
  return {
    left: !afterWs && (!afterPu || beforeWs || beforePu),
    right: !beforeWs && (!beforePu || afterWs || afterPu),
  };
}

// Find the end of a link label starting at s[i] == '['. Returns the index
// just past the matching ']' or -1. Handles balanced brackets, backslash
// escapes and code spans (a ']' inside a code span does not count).
// Link *text* may contain nested brackets; only reference labels may not.
function findLabelEnd(s, i) {
  let depth = 0, k = i + 1;
  while (k < s.length) {
    const c = s[k];
    if (c === '\\' && k + 1 < s.length) { k += 2; continue; }
    if (c === '<') {
      // A ']' inside an HTML tag (e.g. in a quoted attribute value) or
      // an autolink <...> does not close the label.
      const he = matchInlineHtml(s, k);
      if (he > 0) { k = he; continue; }
      if (matchAutolink(s, k)) { k = s.indexOf('>', k + 1) + 1; continue; }
    }
    if (c === '`') {
      let j = k;
      while (j < s.length && s[j] === '`') j++;
      const run = j - k;
      let m = j, found = -1;
      while (m < s.length) {
        if (s[m] === '`') {
          let e = m;
          while (e < s.length && s[e] === '`') e++;
          if (e - m === run) { found = e; break; }
          m = e;
        } else m++;
      }
      // No matching closer: the run is literal text (cm-347 rule) —
      // skip just the run and keep scanning for the label end.
      if (found < 0) { k = j; continue; }
      k = found;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      if (depth === 0) return k + 1;
      depth--;
    }
    k++;
  }
  return -1;
}

// Find an unescaped '>' at or after s[i] (a backslash-escaped char does
// not count). Returns the index or -1.
function findGt(s, i) {
  let k = i;
  while (k < s.length) {
    if (s[k] === '\\' && k + 1 < s.length && isPunct(s[k + 1])) { k += 2; continue; }
    if (s[k] === '>') return k;
    k++;
  }
  return -1;
}

// Parse an inline link's (dest title) starting at s[p] == '('.
// Returns {dest, title, end} (end = index past ')') or null.
function parseInlineLink(s, p) {
  let i = p + 1;
  const skipWs = () => {
    while (i < s.length && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n')) i++;
  };
  skipWs();
  if (i >= s.length) return null;
  let dest = null;
  if (s[i] === ')') return { dest: '', title: null, end: i + 1 };
  if (s[i] === '<') {
    const end = findGt(s, i + 1);
    if (end < 0) return null;
    const d = s.slice(i + 1, end);
    if (/[\n<>]/.test(d)) return null;
    dest = d.replace(/\\([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])/g, '$1');
    i = end + 1;
  } else {
    const d = parseBareDest(s, i);
    if (!d) return null;
    dest = d.dest; i = d.end;
  }
  let title = null;
  const saveI = i;
  skipWs();
  if (i < s.length && (s[i] === '"' || s[i] === "'" || s[i] === '(')) {
    const t = parseLinkTitle(s, i);
    if (t) { title = t.title; i = t.end; skipWs(); }
    else i = saveI;
  }
  if (s[i] !== ')') return null;
  return { dest, title, end: i + 1 };
}

// Try to match an autolink <...> at s[i] == '<'. Returns
// {href, text} or null. Covers <scheme:...> and <email>.
function matchAutolink(s, i) {
  const end = s.indexOf('>', i + 1);
  if (end < 0) return null;
  const inner = s.slice(i + 1, end);
  if (inner.length === 0 || /[\s<>]/.test(inner)) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.test(inner)) {
    return { href: inner, text: inner };
  }
  if (/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(inner)) {
    return { href: 'mailto:' + inner, text: inner };
  }
  return null;
}

// Match a raw HTML tag/comment/PI/declaration starting at s[i] == '<'.
// Returns the index just past it, or -1.
function matchInlineHtml(s, i) {
  // `<!-->` and `<!--->` are complete (empty) comments on their own.
  if (s.startsWith('<!-->', i)) return i + 5;
  if (s.startsWith('<!--->', i)) return i + 7;
  if (s.startsWith('<!--', i)) {
    const e = s.indexOf('-->', i + 4);
    return e < 0 ? -1 : e + 3;
  }
  if (s.startsWith('<?', i)) {
    const e = s.indexOf('?>', i + 2);
    return e < 0 ? -1 : e + 2;
  }
  if (s.startsWith('<![CDATA[', i)) {
    const e = s.indexOf(']]>', i + 9);
    return e < 0 ? -1 : e + 3;
  }
  if (/^<![A-Za-z]/.test(s.slice(i, i + 3))) {
    const e = s.indexOf('>', i + 2);
    return e < 0 ? -1 : e + 1;
  }
  const tag = htmlTagAt(s, i);
  return tag ? tag.end : -1;
}

// Trim trailing punctuation from a GFM autolink candidate (.,;:!?*_~ and
// unbalanced closing brackets). Returns the trimmed end index.
function trimAutolinkEnd(s, start, end) {
  let e = end;
  // Repeat until stable: trimming a closer can expose punctuation,
  // and trimming punctuation can expose another unbalanced closer.
  for (;;) {
    const before = e;
    // Trailing punctuation (note: ';' is not in this set — it is handled
    // by the entity rule below).
    while (e > start && '.,:!?*_~'.indexOf(s[e - 1]) >= 0) e--;
    while (e > start && (s[e - 1] === ')' || s[e - 1] === ']')) {
      const open = s[e - 1] === ')' ? '(' : '[';
      const close = s[e - 1];
      let opens = 0, closes = 0;
      for (let k = start; k < e - 1; k++) {
        if (s[k] === open) opens++;
        else if (s[k] === close) closes++;
      }
      if (opens > closes) break; // this closer is matched: keep it
      e--;
    }
    // A trailing entity-like `&name;` is not part of the link; a bare
    // trailing ';' is trailing punctuation and is trimmed too.
    if (e > start && s[e - 1] === ';') {
      let a = e - 2;
      while (a >= start && /[A-Za-z0-9]/.test(s[a])) a--;
      if (a >= start && s[a] === '&' && a + 1 < e - 1) e = a;
      else e--;
    }
    if (e === before) break;
  }
  return e;
}

// Try to match a GFM extended autolink (www., email, or bare scheme URL)
// at s[i]. Returns {href, text, end} or null. Sticky regexes (no slicing)
// keep this cheap on long lines.
const WWW_RE = /www\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*/y;
// Spec email: local part may contain .!#$%&'*+/=?^_`{|}~- ; domain
// segments start and end with an alphanumeric.
const EMAIL_RE = /[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?)*/y;
const URL_RE = /(?:https?|ftp):\/\/[^\s<]+/iy;

// Match a bare email address at s[i]. Returns {end} or null. The domain
// must contain a dot, and the match is rejected if the next character
// is '-' or '_' (the address may continue there).
function matchEmail(s, i) {
  // Only try when an '@' lies ahead within the same word.
  let at = -1;
  for (let k = i; k < s.length && k < i + 64; k++) {
    if (s[k] === '@') { at = k; break; }
    if (isUniSpace(s[k]) || s[k] === '<') break;
  }
  if (at < 0) return null;
  EMAIL_RE.lastIndex = i;
  const m = EMAIL_RE.exec(s);
  if (!m) return null;
  const text = m[0];
  if (text.indexOf('.', text.indexOf('@')) < 0) return null;
  const end = i + text.length;
  if (end < s.length && (s[end] === '-' || s[end] === '_')) {
    // A trailing '_' that closes an emphasis run (with a '_' opener
    // earlier on the same line) is not part of the address.
    if (s[end] === '_') {
      for (let k = i - 1; k >= 0; k--) {
        if (s[k] === '\n') break;
        if (s[k] === '_') return { end };
      }
    }
    return null;
  }
  return { end };
}

// Try to match a GFM extended autolink (www., email, or scheme URL) at
// s[i]. Returns {href, text, end} or null. Sticky regexes (no slicing)
// keep this cheap on long lines. Scheme URLs are restricted to the
// schemes marked recognises: http/https/ftp with `://`, and mailto/xmpp
// (lowercase) followed by an email address; xmpp may carry one
// resource segment (user@domain/resource).
function matchGfmAutolink(s, i) {
  const prev = i > 0 ? s[i - 1] : '';
  // A '_' before the address is a boundary when it is an emphasis
  // delimiter (not preceded by an alphanumeric, i.e. not intraword).
  if (prev !== '' && /[A-Za-z0-9_]/.test(prev) && !(prev === '_' && (i < 2 || !/[A-Za-z0-9]/.test(s[i - 2])))) return null;
  if (s.startsWith('www.', i)) {
    WWW_RE.lastIndex = i;
    const m = WWW_RE.exec(s);
    if (m) {
      const dom = m[0];
      if (dom.indexOf('.', 4) >= 0) {
        let j = i + dom.length;
        while (j < s.length && !isUniSpace(s[j]) && s[j] !== '<') j++;
        const end = trimAutolinkEnd(s, i, j);
        const text = s.slice(i, end);
        if (text.length > 4) return { href: 'http://' + text, text, end };
      }
    }
  }
  const c = s[i];
  if (c === 'h' || c === 'H' || c === 'f' || c === 'F') {
    URL_RE.lastIndex = i;
    const m = URL_RE.exec(s);
    if (m) {
      const end = trimAutolinkEnd(s, i, i + m[0].length);
      const text = s.slice(i, end);
      return { href: text, text, end };
    }
  }
  if (s.startsWith('mailto:', i) || s.startsWith('xmpp:', i)) {
    const scheme = s.startsWith('mailto:', i) ? 'mailto' : 'xmpp';
    const em = matchEmail(s, i + scheme.length + 1);
    if (em) {
      let end = em.end;
      if (scheme === 'xmpp' && s[end] === '/') {
        let j = end + 1;
        while (j < s.length && !isUniSpace(s[j]) && s[j] !== '<' && s[j] !== '/') j++;
        if (j > end + 1) end = j;
      }
      end = trimAutolinkEnd(s, i, end);
      const text = s.slice(i, end);
      return { href: text, text, end };
    }
  }
  const em = matchEmail(s, i);
  if (!em) return null;
  const end = trimAutolinkEnd(s, i, em.end);
  const text = s.slice(i, end);
  return { href: 'mailto:' + text, text, end };
}

// Does an item list contain a link node at any depth? Autolinks
// (<...>, www./email/bare-URL) may nest inside a link's text, so only
// a real [text](dest)/reference link counts.
function containsLink(items) {
  for (const it of items) {
    if (it.t === 'link' && !it.auto) return true;
    if (it.children && containsLink(it.children)) return true;
  }
  return false;
}

// Scan inline content into a flat item list, then resolve emphasis.
function parseInline(s, refs, noGfm) {
  const items = [];
  let text = '';
  const flush = () => { if (text) { items.push({ t: 'text', s: text }); text = ''; } };
  const n = s.length;
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === '\\' && i + 1 < n) {
      const d = s[i + 1];
      if (d === '\n') {
        flush(); items.push({ t: 'br' });
        i += 2;
        while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
        continue;
      }
      // A backslash-escaped character is literal: emit it pre-escaped so
      // it can never be re-read as an entity or tag start (\& -> &amp;).
      if (isPunct(d)) { flush(); items.push({ t: 'html', s: escText(d) }); i += 2; continue; }
      text += c; i++;
      continue;
    }
    if (c === '\n') {
      let k = text.length;
      while (k > 0 && text[k - 1] === ' ') k--;
      if (text.length - k >= 2) {
        text = text.slice(0, k);
        flush(); items.push({ t: 'br' });
        i++;
        // A hard break strips the next line's leading whitespace.
        while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
      } else {
        text += '\n';
        i++;
      }
      continue;
    }
    if (c === '`') {
      let j = i;
      while (j < n && s[j] === '`') j++;
      const run = j - i;
      let k = j, found = -1;
      while (k < n) {
        if (s[k] === '`') {
          let e = k;
          while (e < n && s[e] === '`') e++;
          if (e - k === run) { found = e; break; }
          k = e;
        } else k++;
      }
      // An unmatched backtick run is literal text as a whole: the
      // remaining backticks must not be retried as a shorter run.
      if (found < 0) { text += s.slice(i, j); i = j; continue; }
      let content = s.slice(j, found - run);
      content = content.replace(/\n/g, ' ');
      if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && /[^ ]/.test(content)) {
        content = content.slice(1, -1);
      }
      flush();
      items.push({ t: 'code', s: escCode(content) });
      i = found;
      continue;
    }
    if (c === '*' || c === '_' || c === '~') {
      let j = i;
      while (j < n && s[j] === c) j++;
      const len = j - i;
      const fl = flanking(s, i, j);
      let canOpen, canClose;
      if (c === '*') {
        // '*' may open/close intraword; '_' may not.
        canOpen = fl.left;
        canClose = fl.right;
      } else if (c === '_') {
        canOpen = fl.left && (!fl.right || (i > 0 && isUniPunct(s[i - 1])));
        canClose = fl.right && (!fl.left || (j < n && isUniPunct(s[j])));
      } else {
        // A tilde run of 3+ is not a strikethrough delimiter.
        canOpen = len < 3 && fl.left;
        canClose = len < 3 && fl.right;
      }
      flush();
      items.push({ t: 'delim', ch: c, len, canOpen, canClose });
      i = j;
      continue;
    }
    if (c === '<') {
      const auto = matchAutolink(s, i);
      if (auto) {
        const href = cleanUrl(auto.href);
        if (href !== null) {
          flush();
          items.push({ t: 'link', href, title: null, auto: true, children: [{ t: 'text', s: auto.text }] });
          i = s.indexOf('>', i + 1) + 1;
          continue;
        }
      }
      const he = matchInlineHtml(s, i);
      if (he > 0) { flush(); items.push({ t: 'html', s: s.slice(i, he) }); i = he; continue; }
      text += c; i++;
      continue;
    }
    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const isImg = c === '!';
      const open = isImg ? i + 1 : i;
      const labelEnd = findLabelEnd(s, open);
      if (labelEnd < 0) { text += c; i++; continue; }
      const labelText = s.slice(open + 1, labelEnd - 1);
      let dest = null, title = null, end = labelEnd;
      if (s[labelEnd] === '(') {
        const il = parseInlineLink(s, labelEnd);
        if (il) { dest = il.dest; title = il.title; end = il.end; }
      }
      if (dest === null) {
        if (s[labelEnd] === '[') {
          const le2 = findLabelEnd(s, labelEnd);
          if (le2 >= 0) {
            const lab = s.slice(labelEnd + 1, le2 - 1);
            const key = normalizeLabel(lab.length ? lab : labelText);
            const ref = refs ? refs.get(key) : undefined;
            if (ref) { dest = ref.dest; title = ref.title; end = le2; }
          }
        } else {
          const key = normalizeLabel(labelText);
          const ref = refs ? refs.get(key) : undefined;
          if (ref) { dest = ref.dest; title = ref.title; }
        }
      }
      if (dest === null) { text += c; i++; continue; }
      const href = cleanUrl(dest);
      if (href === null) { text += c; i++; continue; }
      const kids = parseInline(labelText, refs, true);
      if (!isImg && containsLink(kids)) { text += c; i++; continue; }
      flush();
      if (isImg) {
        items.push({ t: 'img', src: href, alt: plainText(kids), title });
      } else {
        items.push({ t: 'link', href, title, children: kids });
      }
      i = end;
      continue;
    }
    // GFM extended autolinks: www. / email / bare scheme URL, at a word
    // boundary only. They are not recognised inside link text (marked
    // leaves a bare URL/email/www. there as plain text). A '_' before
    // the address is a boundary too when it is an emphasis delimiter
    // (not preceded by an alphanumeric, i.e. not intraword).
    if (!noGfm && /[A-Za-z0-9]/.test(c) && (i === 0 || !/[A-Za-z0-9_]/.test(s[i - 1]) || (s[i - 1] === '_' && (i < 2 || !/[A-Za-z0-9]/.test(s[i - 2]))))) {
      const g = matchGfmAutolink(s, i);
      if (g) {
        const href = cleanUrl(g.href);
        if (href !== null) {
          flush();
          items.push({ t: 'link', href, title: null, auto: true, children: [{ t: 'text', s: g.text }] });
          i = g.end;
          continue;
        }
      }
    }
    text += c;
    i++;
  }
  flush();
  return processEmphasis(items);
}

// Plain-text rendering of inline items (for image alt text).
function plainText(items) {
  let out = '';
  for (const it of items) {
    if (it.t === 'text') out += it.s;
    else if (it.t === 'code') out += it.s;
    else if (it.t === 'img') out += it.alt;
    else if (it.t === 'br') out += '\n';
    else if (it.t === 'delim') out += it.ch.repeat(it.len);
    else if (it.children) out += plainText(it.children);
  }
  return out;
}

// Resolve emphasis/strikethrough delimiter pairs (CommonMark algorithm).
function processEmphasis(items) {
  for (;;) {
    const delims = [];
    for (let idx = 0; idx < items.length; idx++) {
      if (items[idx].t === 'delim') delims.push({ ...items[idx], idx });
    }
    let matched = false;
    for (let ci = 0; ci < delims.length && !matched; ci++) {
      const closer = delims[ci];
      if (!closer.canClose) continue;
      for (let oi = ci - 1; oi >= 0; oi--) {
        const opener = delims[oi];
        if (opener.ch !== closer.ch || !opener.canOpen) continue;
        if ((opener.ch === '*' || opener.ch === '_') &&
            ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose)) &&
            (opener.len + closer.len) % 3 === 0 &&
            !(opener.len % 3 === 0 && closer.len % 3 === 0)) continue;
        if (closer.ch === '~' && opener.len !== closer.len) continue;
        const nn = closer.ch === '~' ? opener.len :
          (opener.len >= 2 && closer.len >= 2 ? 2 : 1);
        const tag = closer.ch === '~' ? 'del' : (nn === 2 ? 'strong' : 'em');
        const children = items.slice(opener.idx + 1, closer.idx);
        const node = { t: tag, children };
        const repl = [];
        if (opener.len > nn) {
          repl.push({ t: 'delim', ch: opener.ch, len: opener.len - nn,
            canOpen: opener.canOpen, canClose: opener.canClose });
        }
        repl.push(node);
        if (closer.len > nn) {
          repl.push({ t: 'delim', ch: closer.ch, len: closer.len - nn,
            canOpen: closer.canOpen, canClose: closer.canClose });
        }
        items.splice(opener.idx, closer.idx - opener.idx + 1, ...repl);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }
  return items;
}

// Render an inline item list to HTML.
function renderInline(items) {
  let out = '';
  for (const it of items) {
    switch (it.t) {
      case 'text': out += escText(it.s); break;
      case 'code': out += '<code>' + it.s + '</code>'; break;
      case 'html': out += it.s; break;
      case 'br': out += '<br>'; break;
      case 'delim': out += it.ch.repeat(it.len); break;
      case 'em': out += '<em>' + renderInline(it.children) + '</em>'; break;
      case 'strong': out += '<strong>' + renderInline(it.children) + '</strong>'; break;
      case 'del': out += '<del>' + renderInline(it.children) + '</del>'; break;
      case 'link': {
        out += '<a href="' + escText(it.href) + '"';
        if (it.title !== null && it.title !== undefined) out += ' title="' + escText(it.title) + '"';
        out += '>' + renderInline(it.children) + '</a>';
        break;
      }
      case 'img': {
        out += '<img src="' + escText(it.src) + '" alt="' + escText(it.alt) + '"';
        if (it.title !== null && it.title !== undefined) out += ' title="' + escText(it.title) + '"';
        out += '>';
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// GFM tables
// ---------------------------------------------------------------------------

// Is `line` a table delimiter row? Returns the alignment array
// ('left'|'right'|'center'|null per column) or null.
function tableDelimiter(line) {
  const m = line.match(/^ {0,3}(\|?((?: *:?-+:? *\|)+ *:?-+:? *| *:?-+:? *)\|?)[ \t]*$/);
  if (!m) return null;
  let inner = m[1].trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|')) inner = inner.slice(0, -1);
  const cells = inner.split('|');
  const aligns = [];
  for (const cell of cells) {
    const t = cell.trim();
    if (!/^:?-+:?$/.test(t)) return null;
    if (t.startsWith(':') && t.endsWith(':')) aligns.push('center');
    else if (t.endsWith(':')) aligns.push('right');
    else if (t.startsWith(':')) aligns.push('left');
    else aligns.push(null);
  }
  return aligns;
}

// Split a table row into cells, honouring escaped pipes and code spans.
function splitCells(row) {
  const cells = [];
  let cur = '', i = 0;
  while (i < row.length) {
    const c = row[i];
    if (c === '\\' && i + 1 < row.length && row[i + 1] === '|') {
      // An escaped pipe is a literal pipe (the backslash is consumed
      // while splitting, so it never reaches a code span).
      cur += '|'; i += 2; continue;
    }
    if (c === '`') {
      let j = i;
      while (j < row.length && row[j] === '`') j++;
      const run = j - i;
      let k = j, found = -1;
      while (k < row.length) {
        if (row[k] === '`') {
          let e = k;
          while (e < row.length && row[e] === '`') e++;
          if (e - k === run) { found = e; break; }
          k = e;
        } else k++;
      }
      if (found >= 0) { cur += row.slice(i, found).replace(/\\\|/g, '|'); i = found; continue; }
      cur += row.slice(i, j); i = j; continue;
    }
    if (c === '|') { cells.push(cur.trim()); cur = ''; i++; continue; }
    cur += c; i++;
  }
  cells.push(cur.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

// Try to interpret a paragraph block as a GFM table. Returns true when
// it is one, and annotates the block (t='table', aligns, header, rows).
// True when a paragraph's lines so far form a table header + delimiter
// (same conditions tryTable requires). Used by the blank-line path so a
// tab-only line inside a table is kept as an empty row.
function isTableCandidate(lines) {
  if (lines.length < 2 || lines[0].indexOf('|') < 0) return false;
  const aligns = tableDelimiter(lines[1]);
  if (!aligns) return false;
  return splitCells(lines[0]).length === aligns.length;
}

function tryTable(block) {
  const lines = block.lines;
  if (lines.length < 2) return false;
  if (lines[0].indexOf('|') < 0) return false;
  const aligns = tableDelimiter(lines[1]);
  if (!aligns) return false;
  const header = splitCells(lines[0]);
  if (header.length !== aligns.length) return false;
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      // A tab-only line is an empty row (marked behaviour); a
      // space-only or empty line ends the table.
      if (lines[i].indexOf('\t') >= 0) { rows.push(new Array(aligns.length).fill('')); continue; }
      break;
    }
    rows.push(splitCells(lines[i]));
  }
  block.t = 'table';
  block.aligns = aligns;
  block.header = header;
  block.rows = rows;
  return true;
}

// ---------------------------------------------------------------------------
// Link reference definitions (document-wide, marked-style)
// ---------------------------------------------------------------------------

// Definitions are stripped from paragraphs inside parseBlocks (finalize
// and the setext branch) into doc.refs; tables are detected in finalize
// via tryTable. parseLinkDef below parses one definition.
