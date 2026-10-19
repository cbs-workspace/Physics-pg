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
 *   dist/login/index.html     meta-refresh handoff → live Apps Script portal
 *
 * Transformations applied to every page:
 *   - template scriptlets rendered with page = <view> (tools/pg-template.js);
 *     brand gets execUrl so portal links resolve to the live deployment
 *   - PUBLIC_PAGES drops "register" (register/login live on the portal)
 *   - href="?page=X" rewritten: in-site views → /about/ etc.;
 *     register/login → the live GAS /exec URL (KMSS-style portal links)
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

/** Public views rendered statically (register + login stay on the portal). */
const VIEWS = ["home", "about", "programmes", "contact"];

/** href="?page=X" → destination (in-site path or live portal URL). */
const HREFS = {
  home: "/",
  about: "/about/",
  programmes: "/programmes/",
  contact: "/contact/",
  register: GAS_EXEC + "?page=register",
  login: GAS_EXEC + "?page=login",
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

  // 3. real links: in-site views → paths, register/login → live portal
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

/** Portal handoff page (old ?page=register / ?page=login URLs keep working). */
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
writeFile("login/index.html", portalRedirect("login"));
copyAsset("images/Phy_Complex.png");
copyAsset("PG_Journey_Infographic.png");

console.log(
  "Done: " + VIEWS.length + " views + register/login handoffs + assets.\n" +
  "Deploy folder: dist/   (Cloudflare Pages build command: npm run build)"
);
