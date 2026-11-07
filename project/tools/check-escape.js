#!/usr/bin/env node
/**
 * Heuristic escaping check for project/GAS_Files/index.html (X4).
 *
 * Flags every statement that writes HTML through
 *   el.innerHTML = ...
 *   el.outerHTML = ...
 *   el.insertAdjacentHTML('beforeend', ...)
 * and concatenates a value that is not wrapped in esc(...)/escAttr(...) or produced by a
 * function known to build escaped HTML.
 *
 * It is deliberately a text scanner, not a parser: it understands quotes, template
 * literals, brackets, ternaries and `+`/`||`/`&&` operands, but it cannot see inside a
 * helper function. A hit is a prompt to read that line, not proof of a bug.
 *
 * Usage:
 *   node project/tools/check-escape.js            # report + exit 1 on unreviewed hits
 *   node project/tools/check-escape.js --all      # print every interpolation it found
 *
 * Fixing a hit: wrap the value in esc(...) (or escAttr(...) for an attribute), remove it,
 * or add the exact operand to SAFE_HTML_VARS after reading the helper that produced it.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'GAS_Files', 'index.html');
const SRC = fs.readFileSync(FILE, 'utf8');
const showAll = process.argv.indexOf('--all') !== -1;

/* Functions that return ready, escaped HTML. Anything ending in Html/HTML is treated as safe. */
const SAFE_CALLS = new Set([
  'statusBadge', 'optionsHtml', 'facOptionsHtml', 'depOptionsHtml', 'tplOptions', 'calMonthOptions_',
  'navBadge', 'intentWarningHtml', 'reviewRow', 'themeIcon', 'a11yFix_', 'restoreUi_', 'showSpinner_',
]);
/* Variables that hold HTML already escaped by a builder above (reviewed one by one),
 * plus two constants computed from a fixed set of values in checkRegistrationStatus. */
const SAFE_HTML_VARS = new Set(['html', 'h', 'staffOpts', 'group', 'field', 'alertKind', 'cls', 'rowsHtml']);
/* Constants whose values are fixed markup. */
const SAFE_NAMES = new Set(['icons', 'BRAND']);
/* Numeric helpers. */
const SAFE_NUMERIC_CALLS = new Set(['selCount', 'Math.max', 'Math.min', 'Math.round', 'Number', 'parseInt', 'parseFloat']);

const hits = [];

function lineOf(index) {
  let n = 1;
  for (let i = 0; i < index && i < SRC.length; i++) if (SRC.charCodeAt(i) === 10) n++;
  return n;
}

/** Walks `src` from `from`, tracking quotes and brackets, and calls fn(i, c) for code chars. */
function scan(src, from, to, fn) {
  let depth = 0, quote = '';
  for (let i = from; i < to; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (fn(i, c, depth) === false) return;
  }
}

function expressionEnd(from) {
  let end = SRC.length;
  scan(SRC, from, SRC.length, (i, c, depth) => {
    if (c === ';' && depth === 0) { end = i; return false; }
    if ((c === ')' || c === ']' || c === '}') && depth < 0) { end = i; return false; }
  });
  return end;
}

/** Index of `op` at bracket depth 0 outside strings, or -1. */
function topOperator(text, op) {
  let found = -1;
  scan(text, 0, text.length, (i, c, depth) => {
    if (depth === 0 && text.startsWith(op, i)) { found = i; return false; }
  });
  return found;
}

function splitTop(text, op) {
  const out = [];
  let rest = text, i;
  while ((i = topOperator(rest, op)) !== -1) {
    out.push(rest.slice(0, i));
    rest = rest.slice(i + op.length);
  }
  out.push(rest);
  return out;
}

function stripParens(s) {
  s = String(s).trim();
  while (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')' && closesAtEnd(s)) s = s.slice(1, -1).trim();
  return s;
}
/** True when the '(' at index 0 is closed by the final ')' (so the outer parens are redundant). */
function closesAtEnd(s) {
  let depth = 0, quote = '', end = -1;
  scan(s, 0, s.length, (i, c) => {
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { end = i; return false; } }
  });
  return end === s.length - 1;
}

function checkSegment(raw, line) {
  let s = stripParens(raw);
  if (!s) return;
  // Ternary (lowest precedence): the condition is not HTML; both branches are.
  const q = topOperator(s, '?');
  if (q !== -1) {
    const colon = topOperator(s.slice(q + 1), ':');
    if (colon !== -1) {
      checkSegment(s.slice(q + 1, q + 1 + colon), line);
      checkSegment(s.slice(q + 1 + colon + 1), line);
      return;
    }
  }
  // Logical fallbacks: every side must be safe.
  const ops = ['||', '&&'];
  for (let k = 0; k < ops.length; k++) {
    if (topOperator(s, ops[k]) !== -1) { splitTop(s, ops[k]).forEach((p) => checkSegment(p, line)); return; }
  }
  // Concatenation (binds tighter than the checks above).
  if (topOperator(s, '+') !== -1) { splitTop(s, '+').forEach((p) => checkSegment(p, line)); return; }
  if (isSafe(s)) return;
  hits.push({ line: line, expr: s });
}

function isSafe(s) {
  if (!s) return true;
  // A complete string / template literal with no interpolation is markup, not data.
  if (/^'(?:[^'\\]|\\.)*'$/.test(s) || /^"(?:[^"\\]|\\.)*"$/.test(s)) return true;
  if (/^`(?:[^`\\$]|\\.)*`$/.test(s)) return true;
  if (/^(\d+(\.\d+)?|true|false|null|undefined)$/.test(s)) return true;
  if (/\.length\s*$/.test(s)) return true;
  if (/^esc(Html|Attr)?\s*\(/.test(s)) return true;
  if (/^encodeURIComponent\s*\(/.test(s)) return true;
  const fn = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(/.exec(s);
  if (fn) {
    const name = fn[1];
    if (/(Html|HTML)$/.test(name) || SAFE_CALLS.has(name) || SAFE_NUMERIC_CALLS.has(name)) return true;
  }
  const bare = /^([A-Za-z_$][\w$]*)(\.[\w$]+)*$/.exec(s);
  if (bare) {
    if (SAFE_NAMES.has(bare[1]) || SAFE_HTML_VARS.has(bare[1]) || bare[1] === 'duration') return true;
  }
  return false;
}

/** True when `idx` sits inside a JS string/template literal that opens earlier on the
 *  same line. This is how an assignment embedded in an HTML attribute is skipped, e.g.
 *    '<img … onerror="this.outerHTML=\'<div …>\'">'
 *  A full-file lexer is not used on purpose: one mis-detected regex would silently
 *  desync it and hide real hits. */
function insideStringOnLine(idx) {
  const from = SRC.lastIndexOf('\n', idx - 1) + 1;
  let quote = '', lastSig = '';
  for (let i = from; i < idx; i++) {
    const c = SRC[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && SRC[i + 1] === '/') return false;   // rest of the line is a comment
    if (c === '/' && /[=(:,!&|?{};[\]+\-*%~^]/.test(lastSig || '=')) {
      let inClass = false;                                // skip a regex literal
      for (i++; i < idx; i++) {
        const r = SRC[i];
        if (r === '\\') i++;
        else if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) break;
      }
      lastSig = '/';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; lastSig = c; continue; }
    if (!/\s/.test(c)) lastSig = c;
  }
  return !!quote;
}

const assignment = /\.(innerHTML|outerHTML)\s*=\s*|insertAdjacentHTML\(\s*(['"])[^'"]*\2\s*,\s*/g;
const debug = process.argv.indexOf('--debug') !== -1;
let m;
while ((m = assignment.exec(SRC))) {
  if (insideStringOnLine(m.index)) { if (debug) console.log(`  skipped (inside an HTML attribute on line ${lineOf(m.index)})`); continue; }
  const start = assignment.lastIndex;
  const end = expressionEnd(start);
  const body = SRC.slice(start, end);
  const line = lineOf(start);
  checkSegment(body, line);
  assignment.lastIndex = end;
}

const seen = new Set();
const unique = hits.filter((h) => {
  const k = h.line + ':' + h.expr;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (showAll) unique.forEach((h) => console.log(`  ${h.line}: ${h.expr}`));

if (unique.length) {
  console.error(`check-escape: ${unique.length} interpolation(s) written to innerHTML without esc():`);
  unique.forEach((h) => console.error(`  ${FILE}:${h.line} -> ${h.expr}`));
  console.error('\nWrap the value in esc(...) (or escAttr(...) for an attribute), remove it, or add the exact operand to SAFE_HTML_VARS after reviewing it.');
  process.exit(1);
}

console.log('check-escape: OK — every HTML interpolation is escaped or reviewed.');
