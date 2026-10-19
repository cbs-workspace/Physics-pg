/**
 * Renders the Apps Script template in GAS_Files/index.html — the same
 * semantics as template_()/renderTemplate in Code.gs:
 *
 *   <?= expr ?>   (and <?!= expr ?>)  → String(expr) appended to the output
 *   <? code ?>                       → JavaScript run with the context keys
 *                                       in scope (branches, loops, guards)
 *
 * Used by tools/serve-pg.js (dev server) and tools/build-pg.js (static
 * build) so both show exactly what the deployed web app serves.
 */
"use strict";

function renderTemplate(tpl, ctx) {
  const keys = Object.keys(ctx);
  const values = keys.map((k) => ctx[k]);
  const re = /<\?!=([\s\S]*?)\?>|<\?([\s\S]*?)\?>/g;
  let body = "var __out = [];\n";
  let last = 0;
  let m;
  while ((m = re.exec(tpl))) {
    body += "__out.push(" + JSON.stringify(tpl.slice(last, m.index)) + ");\n";
    if (m[1] !== undefined) body += "__out.push(String((" + m[1] + ")));\n";
    else body += m[2] + "\n";
    last = re.lastIndex;
  }
  body += "__out.push(" + JSON.stringify(tpl.slice(last)) + ");\nreturn __out.join('');";
  return Function.apply(null, keys.concat(body)).apply(null, values);
}

module.exports = { renderTemplate };
