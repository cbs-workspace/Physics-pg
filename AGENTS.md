# AGENTS.md — Physics-pg

Dept. of Physics Postgraduate Journey (Univ. of Abuja). Public static site on
Cloudflare Pages + a role-based portal on Google Apps Script, backed by one
Google Sheet (one tab per table).

## Two deploy targets that never trigger each other

| Target | Holds | How it updates |
|---|---|---|
| GitHub `cbs-workspace/Physics-pg` (`main`) | source of truth | you push |
| Cloudflare Pages `physics-pg` | static site built from `dist/` | **automatic** on push to `main` |
| Apps Script `/exec` | portal: `GAS_Files/Code.gs` + `GAS_Files/index.html` | **manual paste** + *New version* → Deploy |

- Pushing does **not** deploy the portal; editing `Code.gs` does **not** rebuild
  the static site. `dist/` is gitignored — Cloudflare runs `npm run build`
  (output dir `dist/`).

## Commands

```bash
npm run pg                    # local preview, http://localhost:8081 (in-memory mock, demo data)
npm run build                 # static site -> dist/  (this IS the Cloudflare build command)
node tools/serve-pg.js 8082   # port override ($env:PORT=8082 on PowerShell)
npx serve dist                # preview the built output
```

- **No test suite, no linter, no typecheck.** The only automated gate is
  `npm run build`: it throws on unrendered scriptlets, a failed `PUBLIC_PAGES`
  rewrite, or `__PG_MOCK_API__` leaking into `dist/`. It also **wipes and
  recreates `dist/`**. Use `node --check tools/<file>.js` for syntax; everything
  else is manual smoke testing.

## Architecture (not obvious from filenames)

- `GAS_Files/index.html` is **one** combined template serving both the portal SPA
  and the public site. The `<? if (page === 'login') { ?>` scriptlets branch it;
  `doGet` (Code.gs:4943) injects `brandJson`, `initialPageJson`,
  `initialViewJson`, `embedJson`, `backJson` (all via `safeJson_`). There are
  **no `include()` files** — every other HTML file in the Apps Script project
  must be deleted.
- Template public views are `home`, `register`, `contact`
  (`<div class="pub-page" data-page=…>`), plus the `login` portal branch.
  `about`/`programmes` are retired: accepted and coerced to `home`; the static
  `_redirects` 301s them.
- `GAS_Files/Code.gs` holds **all** server logic. `doGet` is the web entrypoint;
  the column order in `HEADERS` (Code.gs:79) is authoritative.
- `tools/pg-template.js` reproduces Apps Script's `template_()` semantics; both
  `serve-pg.js` and `build-pg.js` use it so preview and static output match
  production.
- `tools/build-pg.js` pre-renders `home`/`contact` into `dist/`, builds
  `/register/` + `/login/` as full-page iframes of
  `…exec?page=…&embed=1&back=%2F`, copies images and the one music track, writes
  `_redirects`, and injects a JSONP bridge for `google.script.run` (only
  announcements + enquiry; everything else rejects *"runs on the official
  portal"*).
- `tools/serve-pg.js` renders the same template against an in-memory mock of
  **29 of the 114** public `api_*` entrypoints; anything else fails at runtime.
  Demo accounts mirror `SeedData.md`, password `PhysicsPG2026!`.
- `GAS_EXEC` (build-pg.js:40) is the live deployment URL and the `embedUrl`
  base; it must stay in sync with the actual deployment.

## Adding a public page (easy to miss one)

1. `GAS_Files/index.html`: a `<div class="pub-page" data-page="NAME" hidden>`, a
   topbar `<a href="?page=NAME" data-page="NAME">`, the name in `PAGE_TITLES`
   (~3937), and the name in `PUBLIC_PAGES` (~1212, now
   `['home','register','contact']`).
2. `tools/build-pg.js`: `VIEWS`, `HREFS`, **and** the `PUBLIC_PAGES` rewrite
   regex + assertion (lines 178–196). The build replaces the array with
   `['home','contact']` so `register`/`login` fall through to their iframe pages.
3. `tools/serve-pg.js`: `PAGES`.
4. `GAS_Files/Code.gs`: the allowed map in `publicPageName_` (~4975) and the
   `doGet` `titles` map (~4960).

## Code.gs conventions (critical gotchas)

- Auth: `requireUser_(token)` takes **only** a token; the role check is a
  separate `assertRole_(user, ['Role'], message)`. (`audit.md` and
  `AGENT-GUIDE.md` show the wrong `requireUser_(token, roles…)` signature.)
- Mutating endpoints come in pairs; **two conventions coexist**:
  - older: `api_x_locked_(…)` does the work, `api_x()` wraps it in
    `withScriptLock_` (30 s);
  - newer: `api_x_l(…)` does the work, `api_x()` returns
    `L_(api_x_l, arguments)` (`L_` = withScriptLock_ helper, Code.gs:2539).
  Match the style of the section you are editing.
- `setUp()` is **create-if-missing, not a reconciler**: it appends missing tabs
  and columns, seeds `PASSPORT_FOLDER_ID`/`ADMIN_EMAIL` and the `NEW_SETTINGS`
  defaults, but never fixes or reorders existing columns. Never re-run it on the
  live sheet to "repair" it — test schema changes on a temp sheet.
- Column additions belong in `HEADERS` **and** the live sheet; `HEADERS` order is
  what the code indexes by.
- `HEADERS` defines **18 tabs**, but `CFG.SHEETS` lists only the 7 core ones
  (`Users, Students, Staff, Submissions, Announcements, Config, AuditLog`).
  Others: `Meetings, Deadlines, Notifications, Messages, Templates, Inquiries,
  Requests, PresentationIntents, Seminars, ProgrammeSessions, Examiners`.
- Upload cells: `LINK_COLUMNS` writes a clickable **label** into the cell and the
  real URL into the cell hyperlink; code reads the URL back out of the hyperlink.

## Config: Script Properties vs the Config sheet (a real trap)

- Script Properties actually read: `SPREADSHEET_ID` (via `PROP_SHEET_ID`),
  `SCHOOL_NAME`, `FOOTER_TEXT`, `SCHOOL_LOGO_URL`, `CBS_LOGO_URL`,
  `HERO_IMAGE_URL`, `JOURNEY_IMAGE_URL`, `JOURNEY_ARCHIVE_IMAGE_URL`,
  `ENQUIRIES_EMAIL`, `SENDER_DISPLAY_NAME`.
- `PROP_DRIVE_ID = 'DRIVE_FOLDER_ID'` (Code.gs:20) is **defined but never read**.
  The passport/attachments/backups folder comes from the **Config sheet row
  `PASSPORT_FOLDER_ID`** via `getSetting_` (fallback
  `DEFAULT_PASSPORT_FOLDER_ID`, Code.gs:18). Setting the `DRIVE_FOLDER_ID`
  Script Property does nothing.
- Config settings seeded by `NEW_SETTINGS` (Code.gs:749): `SIMILARITY_LIMIT`,
  `REQUIRE_SIMILARITY`, `EXAMINER_APPROVAL_REQUIRED`, `PASSPORT_PRIVACY`,
  `TIME_LIMITS_ENABLED`, `LIMIT_MONTHS_*`, `TIME_ALERT_MONTHS`,
  `ENDORSE_REMIND_DAYS`, `NUDGE_DAYS`, `BLOCK_APPROVAL_ON_FORMAT`,
  `PROGRAMME_START_MONTH`, `PROGRAMME_TIMEZONE`, `PROGRAMME_SEEDED`,
  `TEMPLATE_PROPOSAL_DEFENCE_FORM`, `TEMPLATE_PROGRESS_PPTX`.
- `ENQUIRIES_EMAIL` defaults to `abel.osagie@uniabuja.edu.ng` in code
  (Code.gs:24) and the same address is published on the contact page
  (index.html:779). The Script Property overrides both the mail reply-to
  (`mailEnquiriesAddress_`, Code.gs:539) and the enquiry recipient — **set it to
  the same address or delete it**, otherwise the two drift apart again.

## Gotchas (learned the hard way — do not "clean these up")

- `var icons` must stay at the top level of the common script (index.html:1052),
  **not** inside `publicUi()` (index.html:1060) — otherwise the login branch
  throws `ReferenceError`.
- `history.scrollRestoration = 'manual'` (index.html:524) + the `beforeunload`
  scroll-to-top (index.html:1045) are load-bearing: without them "Back to public
  site" lands mid-page.
- "Back to public site" (`goPublicHome_`, index.html:1243) has two paths:
  standalone → the portal's public home; inside the static `/login/` iframe → it
  must **leave the frame** because embed mode hides the topbar and hero. The
  static wrapper passes `&back=%2F`; the portal resolves it against the
  embedding page's origin and assigns it to `window.top.location`. A relative
  path assigned there resolves against the *frame's* origin — never assign a
  bare `/…`.
- **Do not use `document.referrer` for that origin.** Apps Script serves the
  portal in a sandbox chain (`script.google.com` →
  `…-script.googleusercontent.com/userCodeAppPanel`), so the referrer is Google's
  panel, not the embedding site — resolving against it sent the top window to a
  `googleusercontent.com` URL that 404s. `embedBaseOrigin_` (index.html:1223)
  reads `location.ancestorOrigins` (own origin first, **top-most ancestor
  last**); `document.referrer` is only the fallback.
- `showView()` exists only in the public branch. On the login page `?page=` links
  do a full navigation by design. The shared click interceptor (index.html:1259)
  keeps `?page=` links in-app and must run before any listener that navigates.
- Every native form `submit` is `preventDefault()`-ed (index.html:1288). A
  listener that fails to attach lets the form submit natively and land on
  Google's internal `userCodeAppPanel` URL.
- Brand constants are duplicated: `brand_()` (Code.gs:118) is authoritative at
  runtime (Script Properties + `CFG`), `BRAND` (build-pg.js:43) is what the
  static build bakes in. They drift — change both.
- The journey stages live in **four** places that must agree: `CFG.JOURNEY_STAGES`
  (Code.gs:56), `JOURNEY_STAGES` (index.html portal script), the public phase
  cards, and the infographic `images/PG_Journey_Infographic.svg`. Changing a
  stage means updating all four (this drift is exactly what left the public page
  on 15 while the portal was on 16).
- Music: `HOST = 'https://physics-pg.pages.dev/'` and a single-element `TRACKS`
  (`audio/music1.mp3`, index.html:1118–1119). `build-pg.js` copies it into
  `dist/audio/` because Apps Script cannot serve binaries; edit `HOST`/`TRACKS`
  to move or change the track. The Cloudflare host is hardcoded **twice** —
  `HOST` (index.html, audio) and `CFG.DEFAULT_STATIC_HOST` (Code.gs, the full-size
  journey PNG linked under the poster) — a host change must touch both.
- The full-size infographic PNG is linked, not embedded: `#journey-archive` is
  `hidden` markup that the `BRAND.journeyArchiveImgUrl` block unhides, so the line
  disappears if that URL is ever empty.
- Public JSONP endpoints in `doGet`: `?public=announcements`, `?public=enquiry`,
  `?public=facdep`. The static bridge only exposes the first two.
- `tools/make-guides.ps1` regenerates the `.docx` guides via Word COM (needs
  Windows + Microsoft Word) and hardcodes `$out` to an old Desktop path
  (`C:\Users\Abel U. Osagie\…`) — repoint it at the current repo `docs/` first.
- `docs/Staff.xlsx` (staff roster) is PII/local-only if present — never commit
  it. Tracked `docs/` files are the generated guides + roadmap.

## Deploy rules

- **Portal:** paste `Code.gs` and `index.html` (file name exactly `index`) into
  the Apps Script editor, then **Deploy → Manage deployments → Edit → Version:
  *New version* → Deploy**. **Never** create a new deployment — the `/exec` URL
  is baked into `build-pg.js` and the live static site, so a new deployment
  breaks every link and both JSONP feeds.
- **Static site:** `npm run build` → commit → push `main`; Cloudflare
  auto-deploys (~30–60 s). Other branches produce preview deployments only.
- Stage explicit paths; **never `git add -A`**. Never commit `dist/`,
  `node_modules/`, or `.wrangler/`.
- A server-only change (new JSONP endpoint) is live immediately with no static
  rebuild, since the static site calls `/exec` at runtime.
- Go-live state (2026-10-22): the seeded `demo.*` accounts were **deleted from
  the live sheet** with `removeDemoAccounts()` (matches on the email `demo.*`,
  never the password, and removes the matching Students rows too). Never re-seed
  the live sheet; real credentials live with the site owner, never in this repo.
- Sharing: the owner is **both** PG Coordinator and Super Admin, so unrestricted
  access for those two roles is accepted by design. Share the sheet and passport
  folder with the coordinator only.

## Reference docs (read before large changes)

- `README.md` — conventions, setup, roles, journey stages, theming (music and
  stage references now match the code; the folder tree is only partly accurate).
- `DEPLOYMENT.md` — step-by-step deploy for both targets (current).
- `AGENT-GUIDE.md` — practical runbook, but stale: `npm run deploy:preview`
  (does not exist), the "section 12a migration", and the
  `requireUser_(token, roles…)` signature.
- `audit.md` — architecture/data-model/security audit. Stale: the
  `requireUser_(token, roles…)` signature and `GAS_Files/Admission.html`
  (no such file).
- `SeedData.md` — demo rows + hash generator; local/dev seeding only.
