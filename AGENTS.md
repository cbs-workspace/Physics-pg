# AGENTS.md — Physics-pg

Dept. of Physics postgraduate site (Univ. of Abuja): a static public site on
Cloudflare Pages + a role-based portal on Google Apps Script, both fed by one
Google Sheet (one tab per table) and a Drive folder for uploads.

## Commands (there is no `package.json` at the repo root)

npm scripts live in `project/`. From the repo root:

```bash
npm --prefix project run build        # static site -> project/dist/ (this IS the Cloudflare build)
npm --prefix project run pg           # preview http://localhost:8081 (in-memory mock + demo data)
node project/tools/serve-pg.js 8082   # port override ($env:PORT=8082 also works)
npx serve project/dist                # preview the built output
```

- `npm run build` from the repo root fails (no root manifest) — `cd project` or use `--prefix`.
- The only gate is `npm --prefix project run build`. It **wipes and recreates
  `project/dist/`**, first runs `tools/check-escape.js` (fails on an unescaped
  interpolation written to `innerHTML`/`outerHTML`/`insertAdjacentHTML`), then
  throws on: an unreplaced `<?…?>` scriptlet, a failed `PUBLIC_PAGES` rewrite,
  `__PG_MOCK_API__` leaking into dist, or the animated poster's stage labels
  drifting from `CFG.JOURNEY_STAGES`.
- `npm --prefix project run check:escape` runs that scanner alone (`--all` lists
  every interpolation). Its allowlists are reviewed by hand: a new hit means read
  the line and either wrap the value in `esc(...)` or, after checking the builder,
  add the exact variable/call to the allowlist in `tools/check-escape.js`.
- No test suite, linter, typecheck or CI. Syntax-check tools with
  `node --check project/tools/<file>.js`; everything else is manual smoke testing.

## Two deploy targets that never trigger each other

| Target | Holds | How it updates |
|---|---|---|
| GitHub `cbs-workspace/Physics-pg` (`main`) | source of truth | you push |
| Cloudflare Pages `physics-pg` | static site built from `project/dist/` | **automatic** on push to `main` |
| Apps Script `/exec` | portal: `project/GAS_Files/Code.gs` + `.../index.html` | **manual paste** + *New version* → Deploy |

Pushing does not deploy the portal; editing `Code.gs` does not rebuild the
static site. Cloudflare runs `npm run build` with **root directory `project`**,
output dir `dist`. `/exec` URL is baked into `GAS_EXEC` in
`project/tools/build-pg.js` and the live site — it must stay constant.

## Architecture

- `project/GAS_Files/index.html` is **one** template serving both the portal SPA
  and the public site; `<? if (page === 'login') { ?>` branches it. **No
  `include()` files** — any other HTML file in the Apps Script project must be
  deleted. Only two pasted files exist: `Code.gs` and `index`.
- Public views are `home`, `register`, `contact` (`<div class="pub-page"
  data-page=…>`). In the GAS deployment all three come from that one template and
  `showView()` toggles blocks client-side; in the static build `home`/`contact`
  are full pre-rendered copies, while `/register/` and `/login/` are the small
  iframe wrappers. `about`/`programmes` are retired: still accepted by
  `publicPageName_` but coerced to home; static `_redirects` 301s them.
- `project/GAS_Files/Code.gs` holds all server logic; `doGet` is the entrypoint.
  `HEADERS` column order is authoritative.
- `project/tools/pg-template.js` re-implements Apps Script `template_()`
  semantics; `serve-pg.js` and `build-pg.js` both use it so preview == production.
- `build-pg.js` pre-renders `home`/`contact`, writes `404.html` (a copy of home),
  builds `/register/` + `/login/` as full-page iframes of
  `…exec?page=…&embed=1&back=%2F`, copies images + both music tracks, writes
  `_redirects`, and injects a JSONP bridge for `google.script.run` (announcements
  + enquiry only; everything else rejects *"runs on the official portal"*).
- `serve-pg.js` renders the same template against an in-memory mock of
  **38 of the 206** `api_*` functions in `Code.gs`. A new endpoint fails locally
  until you add it to the mock — that is expected, not a portal bug.

## Adding a public page (easy to miss one)

1. `index.html`: a `<div class="pub-page" data-page="NAME" hidden>`, a topbar link
   `<a href="?page=NAME" data-page="NAME">`, the name in `PAGE_TITLES`, and in
   `PUBLIC_PAGES` (currently `['home','register','contact']`).
2. `project/tools/build-pg.js`: `VIEWS`, `HREFS`, **and** the `PUBLIC_PAGES`
   rewrite regex + its assertion (the build replaces the array with
   `['home','contact']` so register/login fall through to their iframe pages).
3. `project/tools/serve-pg.js`: `PAGES`.
4. `project/GAS_Files/Code.gs`: the `publicPageName_` allowed map and the `doGet`
   `titles` map.

## Code.gs conventions

- Auth: `requireUser_(token)` takes **only** a token; role checks are a separate
  `assertRole_(user, ['Role'], message)`. Never call `requireUser_(token, roles…)`.
- Mutating endpoints come in pairs, **two styles coexist** — match the section
  you edit: older `api_x_locked_(…)` + `api_x()` wrapping `withScriptLock_`; and
  the dominant newer `api_x_l(…)` + `api_x()` returning `L_(api_x_l, arguments)`.
  Both take a 30 s script lock. Throw `Error('user-facing message')`; the client
  shows the message as-is.
- `setUp()` is **create-if-missing, not a reconciler**: it appends missing tabs,
  calls `sheetHeaders_()` to append missing columns, seeds two Config rows and
  `NEW_SETTINGS`. It never fixes or reorders existing columns. Never re-run it on
  the live sheet to "repair" it — test schema changes on a temp sheet.
- Column additions belong in `HEADERS` **and** the live sheet; code indexes by
  position. `HEADERS` defines **23 tabs**, but `CFG.SHEETS` lists only the 7 core
  ones (`Users, Students, Staff, Submissions, Announcements, Config, AuditLog`).
- Upload cells: `LINK_COLUMNS` writes a clickable **label** into the cell and the
  real URL into the cell hyperlink; code reads the URL back out of the hyperlink.
- Roles: `CFG.ROLES` = Student, PG_Coordinator, HoD, Staff, Submission_Inspector,
  Examiner. A separate `SuperAdmin` role exists outside that list and drives
  impersonation / read-only preview (`api_impersonate`, `api_previewAsUser`). The
  local mock has **no** SuperAdmin, so those paths cannot be previewed locally.
- Passwords: `hashPassword_` is a `HASH_ITERATIONS`-round HMAC-SHA256 loop stored as
  `pbkdf2$<iterations>$<hex>`. **Never call it for e-mail/OTP codes** (it is
  deliberately slow) — use `hashCode_` + `safeEqual_`. `verifyPassword_` also
  accepts the legacy single SHA-256 hex, and `api_login` re-hashes old rows in
  place (`needsRehash_`).
- Files: **every** upload is private in Drive (submissions, passport, admission
  letter, inquiry/message attachments); nothing is link-shared. `api_getFileAccess`
  finds the owning row, applies that section's access rule, grants the viewer
  `reader`/`writer` via `grantFileRole_` and returns the URL; `api_getPhotos` and
  `api_getSubmissionFiles` do the same for their sections. New upload paths must
  call `lockFile_`, never `setSharing(ANYONE_WITH_LINK)`.
- Scheduled jobs: `PORTAL_TRIGGERS` in `Code.gs` is authoritative (daily reminders,
  `sendCoordinatorReminders` at 12:00, digests, nightly `autoBackup` at 02:00,
  monthly `archiveOldRecords`, 10-minute submission checks). `installAllTriggers`
  only adds missing jobs; after a schedule change run `reinstallAllTriggers()`.
- Backups: `backupCore_` writes `PG Backup YYYY-MM-DD HHmmss` copies into the
  `Backups` folder and keeps `BACKUP_KEEP` (30).

## Config: Script Properties vs the Config sheet (a real trap)

- Script Properties actually read: `SPREADSHEET_ID` (via `PROP_SHEET_ID`),
  `SCHOOL_NAME`, `FOOTER_TEXT`, `SCHOOL_LOGO_URL`, `CBS_LOGO_URL`,
  `HERO_IMAGE_URL`, `JOURNEY_IMAGE_URL`, `ENQUIRIES_EMAIL`, `SENDER_DISPLAY_NAME`.
- `PROP_DRIVE_ID = 'DRIVE_FOLDER_ID'` is **defined but never read**. The
  passport/attachment/backup folder comes from the **Config sheet row
  `PASSPORT_FOLDER_ID`** via `getSetting_` (fallback `DEFAULT_PASSPORT_FOLDER_ID`).
  Setting the `DRIVE_FOLDER_ID` property does nothing.
- `NEW_SETTINGS` (seeded by `ensureSettings_`, called from `setUp`) is ~24 keys:
  similarity/format rules, time limits, `PROGRAMME_*`, `TEMPLATE_PROPOSAL_DEFENCE_FORM`,
  `TEMPLATE_PROGRESS_PPTX`, letter-ref settings, `HOD_NAME`. Add a setting there,
  not in a migration.
- `PASSPORT_PRIVACY` is **no longer read** (`passportPrivate_()` returns true):
  passport photos are always private and served through `api_getPhotos`. The key
  stays in `NEW_SETTINGS` seeded as `private` only so older sheets are not
  misleading; changing it has no effect.
- `ENQUIRIES_EMAIL` defaults to `abel.osagie@uniabuja.edu.ng` in code and the
  same address is published on the contact page. The Script Property overrides
  both the mail reply-to and the enquiry recipient — set it to the same address
  or delete it, or the two drift apart.

## Portal / public-page gotchas (load-bearing, do not "clean up")

- `var icons` must stay at the top level of the common script — not inside
  `publicUi()` — otherwise the login branch throws `ReferenceError`.
- `history.scrollRestoration = 'manual'` + the `beforeunload` scroll-to-top keep
  "Back to public site" landing at the top instead of mid-page.
- "Back to public site" (`goPublicHome_`) leaves the iframe when the static
  wrapper passed `&back=%2F`; the absolute URL is resolved against
  `embedBaseOrigin_`, which reads `location.ancestorOrigins` (own origin first,
  top-most ancestor last). **Never use `document.referrer` for that origin** —
  Apps Script serves the portal in a sandbox chain, so the referrer is Google's
  panel and sent the top window to a 404ing `googleusercontent.com` URL. Never
  assign a bare `/…` to `window.top.location` either (it resolves against the
  frame's origin).
- `showView()` exists only in the public branch. On the login page `?page=` links
  do a full navigation by design; the shared click interceptor in the common
  block must stay before any listener that navigates.
- Every native form `submit` is `preventDefault()`-ed. A listener that fails to
  attach lets the form submit natively and land on Google's internal
  `userCodeAppPanel` URL.
- Brand constants are duplicated: `brand_()` (runtime, Script Properties + `CFG`)
  is authoritative; `BRAND` in `build-pg.js` is what the static build bakes in.
  Change both.
- The journey image: `.journey-img` has a placeholder `src` of
  `images/PG_Journey_Infographic.svg`, **which does not exist**, and is then
  overridden from `BRAND.journeyImgUrl` (static build → the animated SVG; live
  portal → the `JOURNEY_IMAGE_URL` property, empty by default, so the block hides
  via `onerror`). The older 15-step `PG_Journey_Infographic.png` is intentionally
  not shown; the build copies it only so its URL keeps answering. Do not re-add it.
- Music: `HOST = 'https://physics-pg.pages.dev/'` + a single-element `TRACKS`
  (`audio/music1.mp3`); the build copies both `music1`/`music2` into
  `project/dist/audio/` because Apps Script cannot serve binaries. Edit
  `HOST`/`TRACKS` to change the track.
- Public JSONP endpoints in `doGet`: `?public=announcements`, `?public=enquiry`,
  `?public=facdep`. The static bridge exposes only the first two.
- Notification centre: the bell calls `api_getNotifications(token, filter)`
  (`filter` = `all` or `unread`) and returns `id`/`total`/`items` (max 60).
  Opening it does **not** mark anything read — `api_markNotificationRead(token, id)`
  and `api_markNotificationsRead(token)` are explicit actions. Do not reintroduce
  the old "open the bell, mark everything read" behaviour.

## Journey stages and sheet data

- `CFG.JOURNEY_STAGES` is **16 stages** (`1 - Admission` … `16 - Signed Copies
  and Completion`), with the short `S_`/`STAGE_COMPLETE` aliases derived from it.
  They must agree in: `Code.gs` (`CFG.JOURNEY_STAGES`), `JOURNEY_STAGES` in
  `index.html`'s portal script, the public phase-card text, and the poster's own
  labels in `PG_Journey_Animated.svg` (the build *fails* on that one).
- The mock's `STAGES` in `serve-pg.js` is **still the old 15-step list** — local
  preview data uses stage names the real portal does not have. Don't "fix" the
  portal to match the mock; that drift already happened once.
- `setUp()` does not seed demo users. The 2026-10-22 go-live deleted all
  `demo.*` rows from the live sheet with `removeDemoAccounts()`. Never re-seed the
  live sheet; real credentials live with the site owner, never in this repo.

## Local preview logins

Sign in with the **registration number** (not an email/username), password
`PhysicsPG2026!`:

| Role | regNumber |
|---|---|
| Student (approved) | `UA/pg2026/000001` |
| Student (pending → blocked) | `UA/pg2026/000002` |
| PG Coordinator | `UA/pg2026/000010` |
| HoD | `UA/pg2026/000011` |
| Staff | `UA/pg2026/000012` |
| Submission Inspector | `UA/pg2026/000013` |

(`UA/pg2026/003531` and `26/408PHYX/040`-style numbers are also accepted by the
registration form.)

## Deploy

- **Portal (manual, owner's Google session):** paste `Code.gs` and `index.html`
  (file name exactly `index`) into the Apps Script editor, then **Deploy →
  Manage deployments → Edit → Version: New version → Deploy**. **Never create a
  new deployment** — a new `/exec` URL breaks every link and both JSONP feeds.
  An agent cannot do this step; hand it off.
- **Run-once after this Phase 3 deploy** (Apps Script editor, function dropdown):
  `reinstallAllTriggers()` (replaces the weekly backup with the nightly one and
  adds the 12:00 reminder job), `auditPublicFiles()` then `auditPublicFiles(false)`,
  then `syncAllSubmissionAccess()`. Optionally `restrictExistingPassports()` and
  `lockdownPrivateFiles()` for older uploads. `auditPublicFiles(false)` only
  removes link sharing — re-grant access with `syncAllSubmissionAccess()`.
- **Static site:** `npm --prefix project run build` (must pass) → commit explicit
  paths → push `main`; Cloudflare auto-deploys in ~30–60 s. Other branches are
  preview deployments only.
- A server-only change (e.g. a new JSONP endpoint) is live with no static
  rebuild, because the static site calls `/exec` at runtime.
- Verify a deploy without the dashboard: rebuild locally and compare
  `project/dist/index.html` against `https://physics-pg.pages.dev/` (hashes must
  match after the build finishes).
- Sharing: the owner is both PG Coordinator and Super Admin, so unrestricted
  access for those roles is accepted by design. Share the sheet and the passport
  folder with the coordinator only — the Sheet is the trust boundary.

## Never do / never commit

- Never `git add -A` / `git add .` — stage explicit paths. Never force-push,
  amend a pushed commit, or rewrite `main`.
- Never commit `project/dist/`, `node_modules/`, `.wrangler/`, `*.log`,
  `docs/Staff.xlsx` (staff roster, PII, local-only if present), or any token,
  password or secret.
- Never create a *New deployment* on the portal, and never delete/recreate the
  Cloudflare project (it severs the Git connection and changes the `pages.dev` URL).

## Repo docs

- `README.md` covers setup, roles and theming; this file covers what an agent
  needs before editing.
- `docs/` holds only generated role guides (`docs/guides/`, produced by
  `project/tools/make-guides.ps1` — needs Windows + Word COM, check `$out` if the
  repo moves) and stage references (`docs/reference/`).
