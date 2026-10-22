# AGENTS.md — Physics-pg

Dept. of Physics Postgraduate Journey (Univ. of Abuja). Public static site on
Cloudflare Pages + a role-based portal on Google Apps Script, backed by one
Google Sheet (one tab per table).

## Two deploy targets that never trigger each other

| Target | Holds | How it updates |
|---|---|---|
| GitHub `cbs-workspace/Physics-pg` | source of truth | you push |
| Cloudflare Pages `physics-pg` | static site built from `dist/` | **automatic** on push to `main` |
| Apps Script `/exec` | portal: `GAS_Files/Code.gs` + `GAS_Files/index.html` | **manual paste** into the Apps Script editor |

Pushing to GitHub does **not** deploy the portal, and editing `Code.gs` does
**not** rebuild the static site. See `DEPLOYMENT.md`.

## Commands

```bash
npm run pg       # local preview, http://localhost:8081 (mock backend, demo data)
npm run build    # static site -> dist/  (this IS the Cloudflare build command)
```

- Port override: `node tools/serve-pg.js 8082` (the `PORT=8082 npm run pg` form
  in `AGENT-GUIDE.md` does **not** work in PowerShell; use
  `$env:PORT=8082; npm run pg`).
- Preview the static output: `npx serve dist`.
- **No test suite, no linter, no typecheck.** The only automated gate is
  `npm run build` — it throws if a template scriptlet is left unrendered, if
  the `PUBLIC_PAGES` rewrite fails, or if the demo mock (`__PG_MOCK_API__`)
  leaks into the static output. Add `node --check tools/<file>.js` for a syntax
  check on JS you touched. Anything else is manual smoke testing.

## Architecture (the parts that aren't obvious from the filenames)

- `GAS_Files/index.html` (~3.2k lines) is **one** combined template that serves
  both the portal SPA and the public site. The `<? if (page === 'login') { ?>`
  scriptlet branches it; `doGet` injects `brandJson`, `initialPageJson`,
  `initialViewJson`, `embedJson`. There are no `include()` files — every HTML
  file in the Apps Script project other than `index` must be deleted.
- `GAS_Files/Code.gs` (~3.9k lines) holds **all** server logic. One tab per
  table; column order in `HEADERS` (Code.gs:70) is authoritative.
- `tools/pg-template.js` reproduces Apps Script's `template_()` semantics so
  the local preview and the static build render identically to production.
- `tools/build-pg.js` pre-renders the public views from that same template into
  `dist/`, rewrites `?page=X` links to in-site paths, and injects a JSONP
  bridge (`google.script.run` -> `?public=announcements` / `?public=enquiry`)
  against the live `/exec`.
- `tools/serve-pg.js` mocks `google.script.run` in memory (SeedData accounts,
  password `PhysicsPG2026!`). It is **not** a faithful mock of `Code.gs` — it
  implements 26 of the ~149 `api_*` endpoints; anything it lacks 404s at runtime.
- Public `/login/` and `/register/` are in-site pages that iframe
  `…/exec?page=…&embed=1`. In embed mode the portal drops its own chrome.
  `GAS_EXEC` (build-pg.js:40) is the live deployment URL and must stay in sync
  with the actual deployment.
- `dist/` is gitignored — never commit it; Cloudflare builds it from source.

## Adding a public page (5 files, easy to miss one)

1. `GAS_Files/index.html`: a `<div class="pub-page" data-page="NAME" hidden>`,
   a topbar `<a href="?page=NAME" data-page="NAME">`, the name in `PAGE_TITLES`,
   and the name in `PUBLIC_PAGES` (index.html:1166).
2. `tools/build-pg.js`: `VIEWS`, `HREFS`, **and** the hardcoded
   `var PUBLIC_PAGES = ['home', 'contact'];` replacement *plus* its assertion
   (build-pg.js:171 and 186) — the build throws if these two strings disagree.
3. `tools/serve-pg.js`: `PAGES`.
4. `GAS_Files/Code.gs`: the allowed map in `publicPageName_` (Code.gs:3837).
5. Legacy page names (`about`, `programmes`) are still accepted and fall back
   to Home; `dist/_redirects` 301s them.

## Code.gs conventions

- Auth: `requireUser_(token)` takes **only** a token; the role check is a
  separate `assertRole_(user, ['Role'], message)`. (`audit.md` and
  `AGENT-GUIDE.md` say `requireUser_(token, roles…)` — that is wrong.)
- Mutating endpoints come in pairs: `api_x_locked_(...)` does the work,
  `api_x()` wraps it in `withScriptLock_` (or the `L_(fn, args)` helper).
  Follow that pattern for new endpoints.
- `setUp()` is **create-if-missing**, not a reconciler: it auto-appends missing
  columns but never fixes or reorders existing ones. Never re-run it on the
  live sheet to "repair" it — test schema changes on a temp sheet.
- Sheet column additions belong in `HEADERS` **and** the live sheet; the order
  in `HEADERS` is what the code indexes by.
- Sheet tabs beyond `CFG.SHEETS` exist (`Meetings`, `Deadlines`,
  `Notifications`, `Messages`, `Templates`, `Inquiries`, `Requests`,
  `Seminars`, `Examiners`) — `setUp()` creates them from `HEADERS`.

## Config: Script Properties vs the Config sheet (a real trap)

- Script Properties actually read by the code: `SPREADSHEET_ID`, `SCHOOL_NAME`,
  `FOOTER_TEXT`, `SCHOOL_LOGO_URL`, `CBS_LOGO_URL`, `HERO_IMAGE_URL`,
  `JOURNEY_IMAGE_URL`, `ENQUIRIES_EMAIL`, `SENDER_DISPLAY_NAME`.
- `PROP_DRIVE_ID = 'DRIVE_FOLDER_ID'` (Code.gs:20) is **defined but never
  read**. The passport / attachments / backups folder comes from the **Config
  sheet row `PASSPORT_FOLDER_ID`** via `getSetting_`. Setting the
  `DRIVE_FOLDER_ID` Script Property does nothing.
- Config sheet settings (key/value) live in `NEW_SETTINGS` (Code.gs:719):
  `SIMILARITY_LIMIT`, `REQUIRE_SIMILARITY`, `EXAMINER_APPROVAL_REQUIRED`,
  `PASSPORT_PRIVACY`, `TIME_LIMITS_ENABLED`, `LIMIT_MONTHS_*`, `TIME_ALERT_MONTHS`,
  `ENDORSE_REMIND_DAYS`, `NUDGE_DAYS`.
- `ENQUIRIES_EMAIL` defaults to `abel.osagie@uniabuja.edu.ng` in code
  (Code.gs:24) and the same address is published on the contact page
  (index.html:742). The Script Property `ENQUIRIES_EMAIL` overrides both the
  mail reply-to (`mailEnquiriesAddress_`, Code.gs:512) and the enquiry
  recipient — **set it to the same address or delete it**, otherwise the
  published text and the actual inbox drift apart again.

## Gotchas (learned the hard way — do not "clean these up")

- `var icons` must stay at the top level of the common script (index.html:1006),
  **not** inside `publicUi()` — otherwise the login branch throws
  `ReferenceError`.
- `history.scrollRestoration = 'manual'` (set in `<head>`, index.html:467) +
  the `beforeunload` scroll-to-top (index.html:999) are load-bearing: without
  them "Back to public site" lands mid-page.
- "Back to public site" (`goPublicHome_()`, index.html:1177) has two paths:
  standalone → the portal's public home; inside the static `/login/` iframe →
  it must **leave the frame**, because embed mode hides the topbar and hero.
  The static wrapper passes `&back=%2F` on the iframe src; the portal resolves
  that path against the embedding page's origin and assigns it to
  `window.top.location`. A relative path assigned to `window.top.location`
  resolves against the *frame's* origin, not the top's — never assign a bare
  `/…` there.
  **Do not use `document.referrer` for that origin.** Apps Script serves the
  portal inside its own sandbox chain
  (`script.google.com` → `…-script.googleusercontent.com/userCodeAppPanel`),
  so the portal's referrer is Google's panel, not the site that embedded it —
  resolving against it sent the top window to a `googleusercontent.com` URL
  that 404s. `embedBaseOrigin_()` (index.html:1177) reads
  `location.ancestorOrigins` instead: own origin first, **top-most ancestor
  last**, so the last entry is the real public site. `document.referrer` is
  only the fallback.
- `showView()` exists only in the public branch. On the login page `?page=`
  links do a full navigation by design.
- Every native form `submit` is `preventDefault()`-ed (index.html:1225). A
  listener that fails to attach lets the form submit natively and land on
  Google's internal `userCodeAppPanel` URL.
- The shared click interceptor (index.html:1195) is what keeps `?page=` links
  inside the app; it must run before any listener that navigates.
- Brand constants are duplicated: `brand_()` (Code.gs:102) is authoritative at
  runtime, `BRAND` (build-pg.js:43) is what the static build bakes in. They
  drift — change both.
- Music loads from `https://kingsmetroschools.vercel.app/music*.mp3`; the repo's
  `audio/*.mp3` are byte-identical copies and are **not** copied into `dist/`.
  Change the `TRACKS` list (index.html:1073) to move the host.
- `docs/Staff.xlsx` is PII: untracked, never commit it.
- `tools/make-guides.ps1` regenerates the three `.docx` guides via Word COM
  (needs Microsoft Word installed on Windows) and hardcodes an absolute output
  path — update `$out` if the repo moves.

## Deploy rules

- **Portal:** paste `Code.gs` and `index.html` (file name exactly `index`) into
  the Apps Script editor, then **Deploy → Manage deployments → Edit → Version:
  *New version* → Deploy**. **Never** create a new deployment — the `/exec`
  URL is baked into `build-pg.js` and into the live static site, so a new
  deployment breaks every link and both JSONP feeds.
- **Static site:** `npm run build` → commit → push to `main`; Cloudflare
  auto-deploys (~30-60 s). Other branches produce preview deployments only.
- Stage explicit paths; **never `git add -A`**.
- Server-only changes (a new JSONP endpoint) are live immediately with no
  static rebuild, since the static site calls `/exec` at runtime.
- Go-live state (updated 2026-10-22): the seeded `demo.*` accounts have been
  **deleted from the live sheet** with `removeDemoAccounts()` (it matches on
  the email `demo.*`, never on the password, and removes the matching Students
  rows too). All seven demo logins now answer *"Invalid registration number /
  staff ID or password."* `SeedData.md` is kept only for local/dev seeding —
  never re-seed the live sheet. The live site is tested with a real HoD
  account; **credentials live with the site owner, never in this repo.**
- Before go-live: restrict Sheet/Drive sharing to the coordinator/SuperAdmin.

## Reference docs (read before large changes)

- `README.md` — conventions, setup, roles, journey stages, theming.
- `DEPLOYMENT.md` — step-by-step deploy for both targets.
- `AGENT-GUIDE.md` — practical runbook (mostly accurate; its
  `npm run deploy:preview`, "section 12a migration" and `requireUser_` role
  signature references are stale).
- `audit.md` — forensic audit (architecture, data model, security). Its ID
  prefix list (`U`/`S`/`F`) and `GAS_Files/Admission.html` are stale.
- `SeedData.md` — demo rows + the hash generator to run in Apps Script.
