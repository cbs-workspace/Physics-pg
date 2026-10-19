/**
 * Static build for the Physics-pg public site (Cloudflare Pages).
 *
 * The source of truth is GAS_Files/index.html — ONE combined template with
 * five views and the portal SPA, selected server-side by the `page` scriptlet
 * branch. Apps Script renders it (doGet + template scriptlets); this script
 * pre-renders the four public views for a static host:
 *
 *   dist/index.html           home
 *   dist/about/index.html     about
 *   dist/about…               programmes, contact likewise
 *   dist/register/index.html  meta-refresh handoff → live Apps Script portal
 *   dist/login/index.html     in-site portal page (full-page iframe, KMSS
 *                             loginMode "page" — raw /exec URL stays hidden)
 *
 * Transformations applied to every page:
 *   - template scriptlets rendered with page = <view> (tools/pg-template.js);
 *     brand gets execUrl so portal links resolve to the live deployment
 *   - PUBLIC_PAGES drops "register" (register lives on the portal, login is
 *     an in-site page here)
 *   - href="?page=X" rewritten: in-site views → /about/ etc.;
 *     register → the live GAS /exec URL; login → /login/
 *   - a google.script.run → JSONP bridge injected that talks to the live
 *     deployment (announcements + contact enquiry only; any other
 *     call rejects with "runs on the official portal")
 *
 * Assets: images/Phy_Complex.png and PG_Journey_Infographic.png are copied.
 * Run: npm run build   (output in dist/, deploy that folder).
 */
const fs = require("fs");
const path = require("path");
const { renderTemplate } = require("./pg-template");

const ROOT = path.resolve(__dirname, "..");
const GAS_DIR = path.join(ROOT, "GAS_Files");
const OUT = path.join(ROOT, "dist");

/** Live Apps Script Web App — the authoritative portal. */
const GAS_EXEC =
  "https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec";

const BRAND = {
  execUrl: GAS_EXEC,
  schoolName: "Department of Physics Postgraduate Journey",
  subtitle: "University of Abuja",
  footerText: "\u00a9 2026 Capacity Building and Support. All rights reserved.",
  logoUrl: "https://drive.google.com/thumbnail?id=1LDjsF_70W2BpttMyLxfmltABCyUSPeHl",
  cbsLogoUrl: "https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ",
  heroBgUrl: "/images/Phy_Complex.png",
  journeyImgUrl: "/PG_Journey_Infographic.png",
};

/** Public views rendered statically (register stays on the portal; login is
 *  an in-site iframe page built separately — see loginWrapper()). */
const VIEWS = ["home", "about", "programmes", "contact"];

/** href="?page=X" → destination (in-site path or live portal URL).
 *  login uses KMSS "page" mode: an in-site page that iframes the portal,
 *  so the raw script.google.com URL never lands in the address bar. */
const HREFS = {
  home: "/",
  about: "/about/",
  programmes: "/programmes/",
  contact: "/contact/",
  register: GAS_EXEC + "?page=register",
  login: "/login/",
};

/** Browser-side google.script.run → JSONP bridge against the live deployment. */
const SHIM = `
<script>
/* Static-site bridge (built by tools/build-pg.js): google.script.run is
   replaced with JSONP calls to the live Apps Script deployment. Only the two
   public APIs exist cross-origin; everything else points to the portal. */
(function () {
  var GAS = ${JSON.stringify(GAS_EXEC)};
  var seq = 0;
  function jsonp(base) {
    return new Promise(function (resolve, reject) {
      var name = "__pgJsonp" + (++seq) + "_" + Date.now();
      var done = false, timer = null, s = null;
      function cleanup() {
        try { delete window[name]; } catch (e) { window[name] = undefined; }
        if (timer) clearTimeout(timer);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Could not reach the departmental portal. Please try again."));
      }, 15000);
      window[name] = function (payload) {
        if (done) return;
        done = true;
        cleanup();
        resolve(payload);
      };
      s = document.createElement("script");
      s.src = base + (base.indexOf("?") === -1 ? "?" : "&") + "callback=" + name;
      s.onerror = function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Could not reach the departmental portal. Please try again."));
      };
      document.head.appendChild(s);
    });
  }
  var PUBLIC_APIS = {
    api_publicAnnouncements: function () {
      return jsonp(GAS + "?public=announcements").then(function (r) {
        if (!r || r.ok === false) throw new Error((r && r.error) || "Could not load announcements.");
        return { items: r.items || [] };
      });
    },
    api_publicEnquiry: function (name, email, message) {
      return jsonp(
        GAS + "?public=enquiry" +
        "&name=" + encodeURIComponent(String(name || "")) +
        "&email=" + encodeURIComponent(String(email || "")) +
        "&message=" + encodeURIComponent(String(message || ""))
      ).then(function (r) {
        if (!r || r.ok !== true) throw new Error((r && r.error) || "Could not send your enquiry.");
        return r;
      });
    }
  };
  var success = null, failure = null;
  function fail(e) { if (failure) failure(e); else console.error(e); }
  var runner = {};
  var proxy = new Proxy(runner, {
    get: function (t, prop) {
      if (prop in t) return t[prop];
      return function () {
        var fn = PUBLIC_APIS[prop];
        if (!fn) {
          fail(new Error("This feature runs on the official portal. Please continue there."));
          return;
        }
        fn.apply(null, arguments).then(function (r) { if (success) success(r); }, fail);
      };
    }
  });
  runner.withSuccessHandler = function (fn) { success = fn; return proxy; };
  runner.withFailureHandler = function (fn) { failure = fn; return proxy; };
  window.google = { script: { run: proxy } };
})();
</script>
`;

function readGas(name) {
  return fs.readFileSync(path.join(GAS_DIR, name + ".html"), "utf8");
}

function buildView(view) {
  // 1. render the template with this view as the `page` context
  let html = renderTemplate(readGas("index"), {
    page: view,
    brandJson: JSON.stringify(BRAND),
    initialPageJson: JSON.stringify(view),
    initialViewJson: JSON.stringify(""),
    embedJson: JSON.stringify(false),
  });

  // 2. the register view is portal-only here: keep the interceptor from
  //    swallowing portal links (?page=register / ?page=login fall through)
  html = html.replace(
    /var PUBLIC_PAGES = \[[^\]]*\];/,
    "var PUBLIC_PAGES = ['home', 'about', 'programmes', 'contact'];"
  );

  // 3. real links: in-site views → paths, register → live portal,
  //    login → /login/ (the in-site iframe page)
  Object.keys(HREFS).forEach((p) => {
    html = html.split('href="?page=' + p + '"').join('href="' + HREFS[p] + '"');
  });

  // 4. JSONP bridge instead of demo mocks
  html = html.replace(/<body>/, () => "<body>\n" + SHIM);

  const leftover = html.match(/<\?/g);
  if (leftover) throw new Error("Unreplaced scriptlet(s) in view " + view);
  if (html.indexOf('PUBLIC_PAGES = [\'home\', \'about\', \'programmes\', \'contact\']') === -1) {
    throw new Error("PUBLIC_PAGES rewrite failed for view " + view);
  }
  if (html.indexOf("__PG_MOCK_API__") !== -1) throw new Error("Demo mock leaked into static build (" + view + ")");
  return html;
}

/** Portal handoff page (old ?page=register URLs keep working). */
function portalRedirect(view) {
  const url = GAS_EXEC + "?page=" + view;
  return (
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="refresh" content="0;url=' + url + '">' +
    "<title>Opening the official portal…</title></head><body>" +
    '<p style="font-family:sans-serif;padding:40px;text-align:center">Opening the official portal… ' +
    '<a href="' + url + '">Continue</a></p></body></html>'
  );
}

/** In-site portal login page — KMSS loginMode "page": a full-page iframe of
 *  the live portal (?embed=1 → XFrameOptions ALLOWALL on the GAS side), so the
 *  site stays in the address bar. The raw /exec URL is only reachable through
 *  the "Open in new tab" escape hatch. */
function loginWrapper() {
  const embedUrl = GAS_EXEC + "?page=login&embed=1";
  const plainUrl = GAS_EXEC + "?page=login";
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>Portal Login — Department of Physics Postgraduate Journey</title>\n" +
    '  <meta name="description" content="Sign in to the Department of Physics postgraduate portal — students, staff, PG Coordinator and HoD.">\n' +
    '  <meta name="robots" content="noindex, follow">\n' +
    '  <meta name="theme-color" content="#14532d">\n' +
    "  <style>\n" +
    "    * { box-sizing: border-box; }\n" +
    "    body { margin: 0; height: 100vh; display: flex; flex-direction: column;\n" +
    "      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;\n" +
    "      background: #f4f6f5; color: #1c2b21; }\n" +
    "    header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;\n" +
    "      gap: 12px; padding: 10px 16px; background: #14532d; color: #fff; }\n" +
    "    header a { color: #fff; text-decoration: none; }\n" +
    "    header .brand { font-weight: 700; font-size: 15px; }\n" +
    "    header .brand span { font-weight: 400; opacity: .75; font-size: 13px; margin-left: 8px; }\n" +
    "    header nav a { font-size: 14px; margin-left: 14px; opacity: .9; }\n" +
    "    header nav a:hover { text-decoration: underline; }\n" +
    "    .frame-wrap { flex: 1 1 auto; position: relative; min-height: 0; }\n" +
    "    .frame-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }\n" +
    "    .hint { flex: 0 0 auto; margin: 0; padding: 8px 16px; text-align: center;\n" +
    "      font-size: 13px; background: #eceff0; color: #44504a; }\n" +
    "    .hint a { color: #14532d; font-weight: 600; }\n" +
    "  </style>\n</head>\n<body>\n" +
    "  <header>\n" +
    '    <a class="brand" href="/">Department of Physics Postgraduate Journey<span>University of Abuja</span></a>\n' +
    "    <nav>\n" +
    '      <a href="/">Home</a>\n' +
    '      <a href="/contact/">Contact</a>\n' +
    '      <a href="' + plainUrl + '" target="_blank" rel="noreferrer">Open in new tab</a>\n' +
    "    </nav>\n  </header>\n" +
    '  <div class="frame-wrap">\n' +
    '    <iframe id="portal" title="Postgraduate portal login" src="' + embedUrl + '" allow="clipboard-write"></iframe>\n' +
    "  </div>\n" +
    '  <p class="hint">Sign in with the credentials issued by the department. Trouble signing in? <a href="/contact/">Contact the PG Coordinator</a>.</p>\n' +
    "</body>\n</html>\n"
  );
}

function writeFile(rel, content) {
  const out = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  console.log("  " + rel + "  (" + Math.round(content.length / 1024) + " KB)");
}

function copyAsset(rel) {
  const src = path.join(ROOT, rel);
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("  " + rel + "  (asset)");
}

console.log("Building static site → dist/");
fs.rmSync(OUT, { recursive: true, force: true });

for (const view of VIEWS) {
  const html = buildView(view);
  if (view === "home") {
    writeFile("index.html", html);
    writeFile("404.html", html); // unknown URLs land on the site, not a blank page
  } else {
    writeFile(view + "/index.html", html);
  }
}
writeFile("register/index.html", portalRedirect("register"));
writeFile("login/index.html", loginWrapper());
copyAsset("images/Phy_Complex.png");
copyAsset("PG_Journey_Infographic.png");

console.log(
  "Done: " + VIEWS.length + " views + register handoff + login iframe page + assets.\n" +
  "Deploy folder: dist/   (Cloudflare Pages build command: npm run build)"
);
