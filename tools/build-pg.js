/**
 * Static build for the Physics-pg public site (Cloudflare Pages).
 *
 * The source of truth is GAS_Files/index.html — ONE combined template with
 * the public views and the portal SPA, selected server-side by the `page`
 * scriptlet branch. Apps Script renders it (doGet + template scriptlets); this
 * script pre-renders the public views for a static host:
 *
 *   dist/index.html           home (About is condensed into a Home section)
 *   dist/contact/index.html   contact
 *   dist/register/index.html  in-site portal page (full-page iframe, KMSS
 *                             "page" mode — raw /exec URL stays hidden)
 *   dist/login/index.html     in-site portal page (full-page iframe, KMSS
 *                             "page" mode — raw /exec URL stays hidden)
 *   dist/_redirects           /about/ and /programmes/ → / (retired pages)
 *
 * Transformations applied to every page:
 *   - template scriptlets rendered with page = <view> (tools/pg-template.js);
 *     brand gets execUrl so portal links resolve to the live deployment
 *   - PUBLIC_PAGES drops "register" (register + login are in-site iframe pages
 *     served by the live portal with ?embed=1)
 *   - href="?page=X" rewritten: in-site views → /contact/ etc.;
 *     register → /register/; login → /login/
 *   - a google.script.run → JSONP bridge injected that talks to the live
 *     deployment (announcements + contact enquiry only; any other
 *     call rejects with "runs on the official portal")
 *
 * Assets: images/Phy_Complex.png and images/PG_Journey_Infographic.png are copied.
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
  journeyImgUrl: "/images/PG_Journey_Infographic.png",
};

/** Public views rendered statically (register stays on the portal; login is
 *  an in-site iframe page built separately — see portalFramePage()).
 *  About was condensed into a Home section and Programmes was retired. */
const VIEWS = ["home", "contact"];

/** href="?page=X" → destination (in-site path, never a bare portal URL).
 *  login/register use the KMSS "page" mode: in-site pages that iframe the
 *  portal, so the raw script.google.com URL never lands in the address bar. */
const HREFS = {
  home: "/",
  contact: "/contact/",
  register: "/register/",
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
  /* Each withSuccessHandler/withFailureHandler chain gets its OWN proxy, so a
     later call() can never clobber an earlier call's handlers (that orphaned
     the announcements promise and left the home-page spinner running). */
  function makeRunner(success, failure) {
    var runner = {
      withSuccessHandler: function (fn) { return makeRunner(fn, failure); },
      withFailureHandler: function (fn) { return makeRunner(success, fn); }
    };
    return new Proxy(runner, {
      get: function (t, prop) {
        if (prop in t) return t[prop];
        return function () {
          var fn = PUBLIC_APIS[prop];
          if (!fn) {
            if (failure) failure(new Error("This feature runs on the official portal. Please continue there."));
            else console.error(new Error("This feature runs on the official portal. Please continue there."));
            return;
          }
          fn.apply(null, arguments).then(function (r) { if (success) success(r); }, function (e) {
            if (failure) failure(e); else console.error(e);
          });
        };
      }
    });
  }
  var proxy = makeRunner(null, null);
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
    backJson: JSON.stringify(""),
  });

  // 2. register/login are in-site pages on the static host: keep the
  //    interceptor from swallowing those portal links (?page=register /
  //    ?page=login fall through to the real link targets)
  html = html.replace(
    /var PUBLIC_PAGES = \[[^\]]*\];/,
    "var PUBLIC_PAGES = ['home', 'contact'];"
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
  if (html.indexOf('PUBLIC_PAGES = [\'home\', \'contact\']') === -1) {
    throw new Error("PUBLIC_PAGES rewrite failed for view " + view);
  }
  if (html.indexOf("__PG_MOCK_API__") !== -1) throw new Error("Demo mock leaked into static build (" + view + ")");
  return html;
}

/** In-site portal page — the KMSS "page" pattern: a full-page iframe of the
 *  live portal with ?embed=1 (XFrameOptions ALLOWALL on the GAS side, and the
 *  portal drops its own chrome), so the site stays in the address bar. The raw
 *  /exec URL is never linked from the site. Used for both /login/ and /register/. */
function portalFramePage(opts) {
  // ?back=%2F tells the portal where the public site's home is, so "Back to
  // public site" leaves the frame and opens the real home page (with its
  // topbar and hero) instead of re-rendering a chrome-less home in-frame.
  const embedUrl = GAS_EXEC + "?page=" + opts.view + "&embed=1&back=%2F";
  const cross = opts.cross
    ? '      <a href="' + opts.cross.href + '">' + opts.cross.label + "</a>\n"
    : "";
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" + opts.title + " — Department of Physics Postgraduate Journey</title>\n" +
    '  <meta name="description" content="' + opts.description + '">\n' +
    '  <meta name="robots" content="noindex, follow">\n' +
    '  <meta name="theme-color" content="#0f172a">\n' +
    "  <style>\n" +
    "    * { box-sizing: border-box; }\n" +
    "    html { height: 100%; }\n" +
    "    body { margin: 0; min-height: 100vh; height: 100vh; height: 100dvh;\n" +
    "      display: flex; flex-direction: column;\n" +
    "      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;\n" +
    "      background: #f8fafc; color: #0f172a; }\n" +
    "    header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;\n" +
    "      flex-wrap: wrap; gap: 6px 12px; padding: 10px 16px; background: #0f172a; color: #fff; }\n" +
    "    header a { color: #fff; text-decoration: none; }\n" +
    "    header .brand { font-weight: 700; font-size: 15px; }\n" +
    "    header .brand span { font-weight: 400; opacity: .7; font-size: 13px; margin-left: 8px; }\n" +
    "    header nav { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }\n" +
    "    header nav a { font-size: 14px; opacity: .85; }\n" +
    "    header nav a:hover { text-decoration: underline; color: #6ee7b7; }\n" +
    "    .frame-wrap { flex: 1 1 auto; position: relative; min-height: 0; }\n" +
    "    .frame-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }\n" +
    "    .hint { flex: 0 0 auto; margin: 0; padding: 8px 16px; text-align: center;\n" +
    "      font-size: 13px; background: #f1f5f9; color: #64748b; border-top: 1px solid #e2e8f0; }\n" +
    "    .hint a { color: #047857; font-weight: 600; }\n" +
    "    @media (max-width: 480px) {\n" +
    "      header { padding: 8px 12px; gap: 4px 10px; }\n" +
    "      header .brand { font-size: 14px; }\n" +
    "      header .brand span { display: none; }\n" +
    "      header nav { gap: 2px 12px; }\n" +
    "      header nav a { font-size: 13px; }\n" +
    "      .hint { font-size: 12px; padding: 8px 12px; }\n" +
    "    }\n" +
    "    @media (prefers-color-scheme: dark) {\n" +
    "      body { background: #0b1220; color: #e2e8f0; }\n" +
    "      header { background: #060b16; }\n" +
    "      .frame-wrap iframe { background: #0f172a; }\n" +
    "      .hint { background: #0f172a; color: #94a3b8; border-top-color: #1e293b; }\n" +
    "      .hint a { color: #6ee7b7; }\n" +
    "    }\n" +
    "  </style>\n</head>\n<body>\n" +
    "  <header>\n" +
    '    <a class="brand" href="/">Department of Physics Postgraduate Journey<span>University of Abuja</span></a>\n' +
    "    <nav>\n" +
    '      <a href="/">Home</a>\n' +
    cross +
    '      <a href="/contact/">Contact</a>\n' +
    "    </nav>\n  </header>\n" +
    '  <div class="frame-wrap">\n' +
    '    <iframe id="portal" title="' + opts.frameTitle + '" src="' + embedUrl + '" allow="clipboard-write"></iframe>\n' +
    "  </div>\n" +
    '  <p class="hint">' + opts.hint + "</p>\n" +
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
writeFile("register/index.html", portalFramePage({
  view: "register",
  title: "Student Registration",
  description: "Register as a new postgraduate student of the Department of Physics, University of Abuja — submit your details and passport photograph, then track approval.",
  frameTitle: "Student registration form",
  cross: { href: "/login/", label: "Login" },
  hint: 'Already have an account? <a href="/login/">Sign in to the portal</a>. Trouble registering? <a href="/contact/">Contact the PG Coordinator</a>.',
}));
writeFile("login/index.html", portalFramePage({
  view: "login",
  title: "Portal Login",
  description: "Sign in to the Department of Physics postgraduate portal — students, staff, PG Coordinator and HoD.",
  frameTitle: "Postgraduate portal login",
  cross: { href: "/register/", label: "Register" },
  hint: 'Sign in with the credentials issued by the department. New student? <a href="/register/">Register here</a>. Trouble signing in? <a href="/contact/">Contact the PG Coordinator</a>.',
}));
copyAsset("images/Phy_Complex.png");
copyAsset("images/PG_Journey_Infographic.png");

/** Retired pages → Home (permanent). Cloudflare Pages serves any real file
 *  first, so these only apply while /about/ and /programmes/ do not exist. */
writeFile(
  "_redirects",
  "# retired pages → Home (About is now a section on Home; Programmes removed)\n" +
    "/about/       /   301\n" +
    "/about        /   301\n" +
    "/programmes/  /   301\n" +
    "/programmes   /   301\n"
);

console.log(
  "Done: " + VIEWS.length + " views + register/login iframe pages + assets + _redirects.\n" +
  "Deploy folder: dist/   (Cloudflare Pages build command: npm run build)"
);
