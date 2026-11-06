# AGENTS.md — Physics-pg

Dept. of Physics Postgraduate Journey (Univ. of Abuja). Public static site on
Cloudflare Pages + a role-based portal on Google Apps Script, backed by one
Google Sheet (one tab per table).

## Two deploy targets that never trigger each other

| Target | Holds | How it updates |
|---|---|---|
| GitHub `cbs-workspace/Physics-pg` (`main`) | source of truth | you push |
| Cloudflare Pages `physics-pg` | static site built from `project/dist/` | **automatic** on push to `main` |
| Apps Script `/exec` | portal: `project/GAS_Files/Code.gs` + `project/GAS_Files/index.html` | **manual paste** + *New version* → Deploy |

- Pushing does **not** deploy the portal; editing `Code.gs` does **not** rebuild
  the static site. `project/dist/` is gitignored — Cloudflare runs `npm run build`
  with **root directory `project`** (output dir `dist`).

## Commands

Everything app-related lives in `project/`; run the npm scripts from there:

```bash
cd project
npm run pg                    # local preview, http://localhost:8081 (in-memory mock, demo data)
npm run build                 # static site -> project/dist/  (this IS the Cloudflare build)
node tools/serve-pg.js 8082   # port override ($env:PORT=8082 on PowerShell)
npx serve dist                # preview the built output
```

- **No test suite, no linter, no typecheck.** The only automated gate is
  `npm run build`: it throws on unrendered scriptlets, a failed `PUBLIC_PAGES`
  rewrite, or `__PG_MOCK_API__` leaking into `project/dist/`. It also **wipes and
  recreates `project/dist/`**. Use `node --check project/tools/<file>.js` for syntax; everything
  else is manual smoke testing.

## Architecture (not obvious from filenames)

- `project/GAS_Files/index.html` is **one** combined template serving both the portal SPA
  and the public site. The `<? if (page === 'login') { ?>` scriptlets branch it;
  `doGet` (Code.gs:4943) injects `brandJson`, `initialPageJson`,
  `initialViewJson`, `embedJson`, `backJson` (all via `safeJson_`). There are
  **no `include()` files** — every other HTML file in the Apps Script project
  must be deleted.
- Template public views are `home`, `register`, `contact`
  (`<div class="pub-page" data-page=…>`), plus the `login` portal branch.
  `about`/`programmes` are retired: accepted and coerced to `home`; the static
  `_redirects` 301s them.
- `project/GAS_Files/Code.gs` holds **all** server logic. `doGet` is the web entrypoint;
  the column order in `HEADERS` (Code.gs:79) is authoritative.
- `project/tools/pg-template.js` reproduces Apps Script's `template_()` semantics; both
  `serve-pg.js` and `build-pg.js` use it so preview and static output match
  production.
- `project/tools/build-pg.js` pre-renders `home`/`contact` into `project/dist/`, builds
  `/register/` + `/login/` as full-page iframes of
  `…exec?page=…&embed=1&back=%2F`, copies images and the one music track, writes
  `_redirects`, and injects a JSONP bridge for `google.script.run` (only
  announcements + enquiry; everything else rejects *"runs on the official
  portal"*).
- `project/tools/serve-pg.js` renders the same template against an in-memory mock of
  **29 of the 114** public `api_*` entrypoints; anything else fails at runtime.
  Demo accounts mirror `docs/SeedData.md`, password `PhysicsPG2026!`.
- `GAS_EXEC` (build-pg.js:40) is the live deployment URL and the `embedUrl`
  base; it must stay in sync with the actual deployment.

## Adding a public page (easy to miss one)

1. `project/GAS_Files/index.html`: a `<div class="pub-page" data-page="NAME" hidden>`, a
   topbar `<a href="?page=NAME" data-page="NAME">`, the name in `PAGE_TITLES`
   (~3937), and the name in `PUBLIC_PAGES` (~1212, now
   `['home','register','contact']`).
2. `project/tools/build-pg.js`: `VIEWS`, `HREFS`, **and** the `PUBLIC_PAGES` rewrite
   regex + assertion (lines 178–196). The build replaces the array with
   `['home','contact']` so `register`/`login` fall through to their iframe pages.
3. `project/tools/serve-pg.js`: `PAGES`.
4. `project/GAS_Files/Code.gs`: the allowed map in `publicPageName_` (~4975) and the
   `doGet` `titles` map (~4960).

## Code.gs conventions (critical gotchas)

- Auth: `requireUser_(token)` takes **only** a token; the role check is a
  separate `assertRole_(user, ['Role'], message)`. (`docs/audit.md` and
  `docs/AGENT-GUIDE.md` show the wrong `requireUser_(token, roles…)` signature.)
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
  `HERO_IMAGE_URL`, `JOURNEY_IMAGE_URL`, `ENQUIRIES_EMAIL`,
  `SENDER_DISPLAY_NAME`.
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
- The journey stages live in **five** places that must agree: `CFG.JOURNEY_STAGES`
  (Code.gs), `JOURNEY_STAGES` (index.html portal script), the public phase cards,
  the demo mock (`project/tools/serve-pg.js` `STAGES`, still on the old 15-step names), and
  the poster's own labels — `project/images/PG_Journey_Animated.svg`, whose 16 `<g class="lbl
  lbN">` tspans `npm run build` now checks against `CFG.JOURNEY_STAGES` and *fails*
  on drift. Changing a stage means updating the others (this drift is exactly what
  left the public page on 15 while the portal was on 16).
- Music: `HOST = 'https://physics-pg.pages.dev/'` and a single-element `TRACKS`
  (`audio/music1.mp3`, index.html:1118–1119). `build-pg.js` copies it into
  `project/dist/audio/` because Apps Script cannot serve binaries; edit
  `HOST`/`TRACKS` to move or change the track.
- The older 15-step PNG (`project/images/PG_Journey_Infographic.png`) is deliberately
  **not** shown or linked — its step names differ from the 16 canonical stages.
  The build still copies it so its URL keeps answering; do not re-add it to the
  page. The poster itself is a link (`#journey-link`, `cursor: zoom-in`) opening
  the SVG full size, which is how small screens zoom in.
- Public JSONP endpoints in `doGet`: `?public=announcements`, `?public=enquiry`,
  `?public=facdep`. The static bridge only exposes the first two.
- `project/tools/make-guides.ps1` regenerates the `.docx` guides via Word COM (needs
  Windows + Microsoft Word) and writes to `docs/guides/` — check `$out` at the top
  of the script if the repo moves.
- `docs/Staff.xlsx` (staff roster) is PII/local-only if present — never commit
  it. Tracked `docs/` content is the generated role guides (`docs/guides/`) and
  the stage references (`docs/reference/`).

## Deploy rules

- **Portal:** paste `Code.gs` and `index.html` (file name exactly `index`) into
  the Apps Script editor, then **Deploy → Manage deployments → Edit → Version:
  *New version* → Deploy**. **Never** create a new deployment — the `/exec` URL
  is baked into `build-pg.js` and the live static site, so a new deployment
  breaks every link and both JSONP feeds.
- **Static site:** `npm run build` → commit → push `main`; Cloudflare
  auto-deploys (~30–60 s). Other branches produce preview deployments only.
- Stage explicit paths; **never `git add -A`**. Never commit `project/dist/`,
  `node_modules/`, or `.wrangler/`.
- A server-only change (new JSONP endpoint) is live immediately with no static
  rebuild, since the static site calls `/exec` at runtime.
- Go-live state (2026-10-22): the seeded `demo.*` accounts were **deleted from**
  the live sheet** with `removeDemoAccounts()` (matches on the email `demo.*`,
  never the password, and removes the matching Students rows too). Never re-seed
  the live sheet; real credentials live with the site owner, never in this repo.
- Sharing: the owner is **both** PG Coordinator and Super Admin, so unrestricted
  access for those two roles is accepted by design. Share the sheet and passport
  folder with the coordinator only.

## Reference docs (read before large changes)

- `README.md` — conventions, setup, roles, journey stages, theming (music and
  stage references now match the code; the folder tree is only partly accurate).
- `docs/DEPLOYMENT.md` — step-by-step deploy for both targets (current).
- `docs/AGENT-GUIDE.md` — practical runbook, but stale: `npm run deploy:preview`
  (does not exist), the "section 12a migration", and the
  `requireUser_(token, roles…)` signature.
- `docs/audit.md` — architecture/data-model/security audit. Stale: the
  `requireUser_(token, roles…)` signature and `project/GAS_Files/Admission.html`
  (no such file).
- `docs/SeedData.md` — demo rows + hash generator; local/dev seeding only.

---## Agent Guide (from docs/AGENT-GUIDE.md)

**For:** a developer/agent picking this project up.

**Read first:** [`README.md`](../README.md) (conventions) and [`audit.md`](audit.md) (full forensic audit). This file is the practical runbook.

---

## 1. The 30-second mental model

- **One Google Sheet** = the database (tabs = tables, column order authoritative).
- **One GAS template** (`project/GAS_Files/index.html`) = the entire portal + public site, branched server-side by the `page` scriptlet.
- **One static build** (`project/tools/build-pg.js`) = the Cloudflare Pages site, pre-rendered from the same template.
- **Two deploy targets that never trigger each other:** GitHub (code) and Cloudflare (live site). Pushing to GitHub does NOT deploy; `npm run build` + Cloudflare Git integration does.

## 2. Run it locally

```bash
npm run pg       # local preview at http://localhost:8081 (mock backend, demo accounts)
npm run build    # static site → dist/ (Cloudflare)
```

- Change the port: `PORT=8082 npm run pg` or `node project/tools/serve-pg.js 8082`.
- The preview uses in-memory demo data (accounts from `docs/SeedData.md`, password `PhysicsPG2026!`).
- Kill a stale server: `Get-NetTCPConnection -LocalPort 8081 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.

## 3. File map (what to edit for what)

| I want to… | Edit |
|------------|------|
| Change a public page (Home/Contact) | `project/GAS_Files/index.html` public branch |
| Change the login/portal SPA | `project/GAS_Files/index.html` login branch |
| Change shared behavior (interceptor, theme, scroll) | `project/GAS_Files/index.html` common block |
| Change server logic / endpoints / sheet schema | `project/GAS_Files/Code.gs` |
| Change branding/IDs at runtime | **Script Properties** (not code) |
| Change the static build | `project/tools/build-pg.js` |
| Change the local mock backend | `project/tools/serve-pg.js` |

**Rule of thumb:** if it can be done in `index.html`, do it there (single paste). Only touch `Code.gs` for genuine server-side logic.

## 4. Deploy

### 4.1 GAS portal (the `/exec` URL)

1. Open the Apps Script editor (signed in as the owner).
2. Paste `project/GAS_Files/Code.gs` into `Code.gs` (only if it changed).
3. Paste `project/GAS_Files/index.html` into the HTML file named **`index`** (delete every other HTML file).
4. Set Script Properties (`SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, branding, `ENQUIRIES_EMAIL`).
5. **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy.**
   - **Never create a new deployment** — the `/exec` URL must stay constant or the static site breaks.

### 4.2 Static site (Cloudflare)

- `npm run build` → commit → `git push origin main`. Cloudflare auto-deploys.
- The build writes `dist/_redirects` (`/about/`, `/programmes/` → `/`).

## 5. Common tasks

### Add a new public page

1. Add a `<div class="pub-page" data-page="NAME" hidden>` in the public branch.
2. Add a tab `<a href="?page=NAME" data-page="NAME">` in the topbar.
3. Add `NAME` to `PUBLIC_PAGES` and `PAGE_TITLES`.
4. Add `NAME` to `VIEWS` + `HREFS` in `project/tools/build-pg.js` and to `PAGES` in `project/tools/serve-pg.js`.
5. Add `NAME` to `publicPageName_`'s allowed map in `Code.gs`.

### Add a new GAS endpoint

1. `function api_x(token, …) { requireUser_(token, […]); … }` in `Code.gs`.
2. Call it from the SPA via `call('api_x', …)` (the common-block helper).
3. If the static site needs it cross-origin, add it to the JSONP bridge in `project/tools/build-pg.js` (`PUBLIC_APIS`).

### Change the sheet schema

- Edit `HEADERS` in `Code.gs` (order is authoritative) + the migration in section `12a`.
- Do NOT re-run `setUp()` on the live sheet (it auto-appends duplicate headers).

### Re-seed demo data

- Temp tab → run `setUp()` → paste seed rows from `docs/SeedData.md`.

## 6. Gotchas (learned the hard way)

- **`icons` scope:** anything in the login branch that needs the icon set must reference the page-level `var icons` (common-script top level) — NOT the copy inside `publicUi()`.
- **Scroll restoration:** the common block sets `history.scrollRestoration='manual'` + a `beforeunload` scroll-to-top. Don't remove these or "Back to public site" lands mid-page.
- **`showView` is public-branch only.** On the login page, `?page=` links do a full navigation (by design).
- **`setUp()` is create-if-missing.** Never re-run on a live sheet.
- **`docs/Staff.xlsx` is PII** — never commit it.
- **Staging:** `npm run deploy:preview` for a Vercel preview; the GAS side has no staging (use a temp Sheet tab to test `setUp()`).
- **PowerShell quirks:** `$home` is read-only (use `$h`); build URIs by concatenation, not interpolation; avoid long inline JSON.

## 7. Demo accounts (password `PhysicsPG2026!`)

| Role | Username | Reg Number |
|------|----------|-----------|
| Student | `demo.student` | `UA/pg2026/000001` |
| PG Coordinator | `demo.coordinator` | `UA/pg2026/000010` |
| HoD | `demo.hod` | `UA/pg2026/000011` |
| Staff | `demo.staff` | `UA/pg2026/000012` |
| Submission Inspector | `demo.inspector` | `UA/pg2026/000013` |

**These are gone from the live sheet** (deleted 2026-10-22 with `removeDemoAccounts()`); the rows above only describe what the local preview (`npm run pg`) and `docs/SeedData.md` seed. **Never re-seed the live sheet.** The live site is tested with a real HoD account — the site owner holds the credentials, they are not in this repo.

## 8. Before go-live checklist

- [x] Remove all `demo.*` accounts (done 2026-10-22).
- [ ] Change `DEFAULT_PASSWORD` if seeding real accounts.
- [ ] Verify Sheet + Drive folder sharing is restricted (PII).
- [ ] Confirm Script Properties (`SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, branding).
- [ ] Paste the latest `index.html` + redeploy a New version.
- [ ] Smoke test: register → approve → login → submit → approve.

---## Deployment Guide (from docs/DEPLOYMENT.md)

How updates reach the live site in the future. Three places are involved, each
with its own mechanism:

| Target | What holds | How it updates |
|--------|------------|----------------|
| **GitHub** `cbs-workspace/Physics-pg` | source of truth (code + docs) | you `git push` |
| **Cloudflare Pages** `physics-pg` | built site from `project/dist/` | **automatic** on every push to `main` |
| **Apps Script portal** `/exec` | 2 pasted files + Spreadsheet | manual paste + *New version* |

Live URLs — site: `https://physics-pg.pages.dev` · portal:
`https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec`
(the portal URL also lives in `project/tools/build-pg.js` → `GAS_EXEC`).

## 0. Agent runbook — commit to GitHub & ship to Cloudflare Pages

This section is written for an automated agent (or anyone executing it as a
checklist) on **any computer**, including one where nothing is installed yet.
It assumes you are in the repo root on `main`. **An agent never invents,
harvests, or stores credentials** — the human owner supplies them out-of-band
(browser OAuth or an environment variable in the same shell). Never ask the
owner to paste a secret into the chat, and never write one into a file.

> **Normal path needs only Git + Node.js.** Wrangler is *not* required to ship
> a site change — pushing to `main` is the deployment. Wrangler is only for the
> manual fallback in § 2. The Apps Script portal (§ 4) is always manual and
> needs no Git tooling.

### 0.1 Check what is installed

Run this first; do not assume any tool is present.

```powershell
git --version; node --version; npm --version; npx --version; gh --version
```

```bash
git --version && node --version && npm --version && npx --version && gh --version
```

| Tool | Needed for | Check | If missing |
|---|---|---|---|
| **Git** | clone, commit, push | `git --version` | § 0.2 |
| **Node.js + npm** | `npm run build`; running Wrangler via `npx` | `node --version`, `npm --version` | § 0.2 |
| **GitHub CLI** (`gh`) | easier GitHub auth (optional) | `gh --version` | § 0.2 |
| **Wrangler** | manual Cloudflare upload only (optional) | `npx --yes wrangler@latest --version` | § 0.2 — run via `npx`, no install required |
| **Google account** | portal paste only | — | § 4 (owner only) |

The build has **no npm dependencies**: `package.json` declares only two Node
scripts and there is no lockfile. Do not run `npm install` / `npm ci`; it adds
nothing and `node_modules/` is gitignored.

If a tool is missing, install it (§ 0.2) when the session allows it. If the
install needs elevation, a package manager the machine lacks, or a reboot,
**stop and hand the command back to the owner** — never silently elevate or
change global machine config.

### 0.2 Install Git, Node.js, GitHub CLI (and optionally Wrangler)

Install **Git** and **Node.js 20 LTS or newer** first. `gh` is optional but is
the smoothest way to authenticate. Reopen the terminal after installing so
`PATH` refreshes, then repeat the checks in § 0.1.

#### Windows (PowerShell; `winget` ships with Windows 10/11)

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id GitHub.cli -e --source winget    # optional
```

If `winget` is unavailable, install *App Installer* from the Microsoft Store,
or download Git from `https://git-scm.com/download/win` and Node LTS from
`https://nodejs.org/`. Git for Windows bundles **Git Credential Manager**, which
handles the GitHub browser sign-in.

#### macOS

```bash
xcode-select --install      # installs Git (or: brew install git)
brew install node gh        # gh optional; nodejs.org .pkg also works
```

#### Linux

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y git
# Fedora
sudo dnf install -y git
# Arch
sudo pacman -S git
```

Install **Node 20+** from `https://nodejs.org/`, via your distro (if it ships a
current version), or via nvm (`nvm install --lts`). Verify with
`node --version` — v20 or newer.

#### Wrangler — no global install needed

Use it through `npx`, which downloads it on demand (Node required):

```bash
npx --yes wrangler@latest --version
npx --yes wrangler@latest whoami
```

Only if the owner prefers a global binary: `npm install -g wrangler`, then use
`wrangler …` directly. Nothing about the normal GitHub → Cloudflare flow
requires this.

### 0.3 Get the repo and set the commit identity

```bash
git clone https://github.com/cbs-workspace/Physics-pg.git
cd Physics-pg
git remote -v                    # origin must be cbs-workspace/Physics-pg.git
git branch --show-current        # main
git pull --ff-only origin main   # bring an existing clone up to date
```

A `403`/`404` on clone means the machine has no GitHub credential yet — do
§ 0.5 first. On a machine that has never committed before, confirm an author
identity exists (the owner sets it if not):

```bash
git config user.name
git config user.email
# owner, once per machine:
git config --global user.name  "Owner Name"
git config --global user.email "owner@example.com"
```

### 0.4 What the agent may stage

Commit source only: `project/GAS_Files/Code.gs`, `project/GAS_Files/index.html`, `project/tools/*.js`,
`package.json`, `*.md`, and the files the specific task touched.

Never stage `project/dist/`, `node_modules/`, `.wrangler/`, `*.log`,
`docs/Staff.xlsx` (PII), or generated `.docx` files unless the owner explicitly
asks for them. Never use `git add -A` / `git add .` — stage explicit paths.
Never force-push, amend a pushed commit, commit with `--no-verify`, or rewrite
`main`.

### 0.5 Credentials — where they come from (the agent cannot fetch these itself)

| Target | Credential | How the owner provides it | How the agent verifies |
|---|---|---|---|
| **GitHub** (push) | Git push access to `cbs-workspace/Physics-pg` | Preferred: owner runs `gh auth login --web --git-protocol https`, then `gh auth setup-git`, and approves the device code in a browser. Alternative: a **fine-grained PAT** (repo `cbs-workspace/Physics-pg`, permission **Contents: Read and write**) supplied via `GH_TOKEN`; or a plain `git push` that opens Git Credential Manager. | `gh auth status` — or `git ls-remote origin -h refs/heads/main` (succeeds after sign-in) |
| **Cloudflare** (normal path) | **None** | A push to `main` triggers the Pages build; the dashboard Git connection already holds the GitHub authorization. | § 0.8 |
| **Cloudflare** (manual fallback only, § 2) | OAuth session, or API token + account ID | Owner runs `npx --yes wrangler@latest login` and approves in the browser, **or** creates a token (below) and exports `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. | `npx --yes wrangler@latest whoami` |

**GitHub sign-in — pick one, in this order**

1. **`gh` (best):**

   ```bash
   gh auth login --web --git-protocol https   # owner approves in the browser
   gh auth setup-git                          # makes `git push` use gh
   gh auth status
   ```

2. **No `gh`:** a plain `git push` opens **Git Credential Manager** (Windows) or
   the Keychain/`libsecret` prompt (macOS/Linux). The owner signs in there; the
   token is cached by the OS credential store — never by this repo.

3. **Headless / no browser:** the owner creates a fine-grained PAT at
   `https://github.com/settings/personal-access-tokens/new` (Repository access:
   only `cbs-workspace/Physics-pg`; Permissions → Contents: **Read and write**),
   exports it as `GH_TOKEN` (PowerShell: `$env:GH_TOKEN="…"`; bash:
   `export GH_TOKEN=…`) **in the same shell**, then runs `gh auth setup-git`.
   The agent never reads, echoes, or writes the value.

**Cloudflare credentials (manual fallback only)**

- Interactive: `npx --yes wrangler@latest login` → owner approves in the
  browser. On a headless/remote machine this cannot work — use a token.
- Token: `dash.cloudflare.com` → **My Profile → API Tokens → Create Token** →
  Custom token with **Account → Cloudflare Pages → Edit** (and Account: Read)
  scoped to the owner's account. Copy it once (it is shown only once). The
  account ID is on the **Workers & Pages** overview page. Owner exports both:

  ```powershell
  $env:CLOUDFLARE_API_TOKEN = "…"   # owner types this, not the agent
  $env:CLOUDFLARE_ACCOUNT_ID = "…"
  ```

  ```bash
  export CLOUDFLARE_API_TOKEN="…"
  export CLOUDFLARE_ACCOUNT_ID="…"
  ```

  Then verify: `npx --yes wrangler@latest whoami` (prints the account; if it
  hangs waiting for a browser, the token variables were not set).

**Rules when a credential is missing**

- Stop and report exactly which step the owner must perform (`gh auth login`,
  a PAT via `GH_TOKEN`, `wrangler login`, or exporting the Cloudflare variables
  in **this** shell session). Do not proceed on guesswork.
- Do not attempt workarounds — no generating SSH keys, scraping credential
  files, copying another user's credential store, or "just trying" a password.
- Never commit, print, or log a token. Credentials live with the site owner,
  never in this repo (see § 0.6).

### 0.6 Pre-commit gate

```powershell
git status                      # review EVERY change; untracked files are not automatically wanted
git diff                        # read the actual diff before committing
node --check project/tools/build-pg.js  # if any tool JS was touched
npm --prefix project run build   # MUST pass:
                                #  - throws on an unrendered template scriptlet
                                #  - throws if PUBLIC_PAGES drifts from build-pg.js
                                #  - throws if the demo mock leaks into project/dist/
```

If the build fails, fix it — never commit a broken build or skip the gate.

### 0.7 Commit and push

```powershell
git add <path> <path>           # only the files you actually touched, never -A / .
git status --short              # confirm exactly what is staged
git commit -m "scope: what changed and why"
git push origin main
```

If the push is rejected because the remote moved: `git pull --rebase origin main`,
resolve, re-run `npm --prefix project run build`, then push again. Never force-push `main`.

If the push fails with authentication/`403`/`could not read Username`, the
machine has no valid GitHub credential — stop and follow § 0.5. Do not retry
passwords or invent tokens.

### 0.8 Confirm Cloudflare deployed

A push to `main` is the deployment — there is nothing else to run, and no
Cloudflare credential is needed to *trigger* it.

1. Confirm the commit actually reached GitHub (works without any dashboard):

   ```bash
   git ls-remote origin refs/heads/main   # must equal: git rev-parse HEAD
   ```

2. Wait ~30–60 s.

3. Strong, tool-free check: build from that exact commit and compare the live
   HTML byte-for-byte with your local `project/dist/index.html`.

   ```powershell
   npm --prefix project run build
   "local $((Get-FileHash project/dist/index.html -Algorithm SHA256).Hash)"
   $r = Invoke-WebRequest https://physics-pg.pages.dev/ -UseBasicParsing
   $tmp = Join-Path $env:TEMP "pg-live.html"
   [IO.File]::WriteAllText($tmp, $r.Content)
   "live  $((Get-FileHash $tmp -Algorithm SHA256).Hash)"
   ```

   ```bash
   npm run build
   sha256sum project/dist/index.html
   curl -s https://physics-pg.pages.dev/ | sha256sum
   ```

   Equal hashes mean the live site is serving the build you just pushed. If
   they differ, wait another minute and repeat — Cloudflare may still be
   building.

4. If the owner is signed in to the dashboard: `dash.cloudflare.com` →
   **Workers & Pages** → *physics-pg* → **Deployments** — newest entry shows
   your commit, trigger `github:push`, status **Success**.

Pushes to any other branch create *preview* deployments only; merge to `main`
to ship. If nothing appears after several minutes and the hash never matches,
the Git connection is broken — follow § 3, do not switch to manual uploads as a
workaround.

### 0.9 Portal hand-off

A GitHub push does **not** deploy the Apps Script portal. If the task changed
`project/GAS_Files/Code.gs` or `project/GAS_Files/index.html`, tell the owner to follow § 4
(paste the file, *Manage deployments → Edit → New version → Deploy*). An agent
cannot do this without the owner's Google session.

## 1. Everyday site change (GitHub → Cloudflare, fully automatic)

Intended for a human at the keyboard. **Agents should follow § 0 instead** — it
adds machine setup (Git/Node/Wrangler), credentials, staging, and the
pre-commit-gate rules.

Sources: all views and the portal SPA live in the single `project/GAS_Files/index.html`
template (the `page` scriptlet picks the branch); `project/tools/build-pg.js` renders
the static site into `project/dist/`.

1. **Edit** the relevant file(s) under `Physics-pg/`.
   (Fresh clone on a new machine: `git clone https://github.com/cbs-workspace/Physics-pg.git`.)
2. **Check locally:**
   ```
   node --check project/tools/build-pg.js   # if any JS was touched
   npm --prefix project run pg      # portal logic with demo mocks → http://localhost:8081
   npm --prefix project run build   # production build → project/dist/
   npx serve project/dist           # preview the static site locally
   ```
3. **Commit & push** — stage explicit paths, never `git add -A`:
   ```
   git add <files you touched>
   git commit -m "what changed and why"
   git push origin main
   ```
4. **Cloudflare builds automatically** (~30–60 s): dashboard → Workers & Pages →
   *physics-pg* → **Deployments** — the newest entry shows your commit, trigger
   `github:push`, status **Success**.

Pushes to any **other branch** produce *preview* deployments (separate
`…physics-pg.pages.dev` URL) without touching production — merge to `main`
to ship.

### What Cloudflare runs (configured once in the dashboard)

| Field | Value |
|-------|-------|
| Source | GitHub · `cbs-workspace/Physics-pg` · branch `main` |
| Build command | `npm run build` |
| Build output directory | `dist` (inside `project`) |
| Root directory | `project` |

Change these only if the build script or the output folder is ever renamed.

## 2. Manual fallback (if auto-deploy ever stops)

Direct upload still works even though the repo is connected. Credentials for
this path come from § 0.5 (OAuth session from `wrangler login`, or
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`); confirm with `wrangler whoami`
first. If Wrangler is not installed, `npx --yes wrangler@latest …` works — see
§ 0.2.

```
npm --prefix project run build
npx --yes wrangler@latest login          # only when logged out
npx --yes wrangler@latest pages deploy project/dist --project-name physics-pg --branch main
```

Manual uploads appear in the deployment list with trigger `ad_hoc`. Prefer
repairing the connection (§ 3) over living on manual uploads.

## 3. Repairing the GitHub connection

**Symptoms:** pushes stop deploying; errors mentioning "internal issue with
your Cloudflare Pages Git installation" (code `8000011`).

1. `dash.cloudflare.com` → the account → **Workers & Pages** → *physics-pg* →
   **Settings → Source** → **Connect to Git**.
2. Authorize GitHub → choose the **cbs-workspace** account (not a personal
   one) → select repo `Physics-pg` → keep the build settings from the table in § 1.
3. Still failing → GitHub → Settings → Applications → **Installed GitHub Apps**
   → *Cloudflare Pages* → **Uninstall**, then repeat from step 1 (the reinstall
   clears the broken installation).
4. Confirm with a test push: a new commit must appear under Deployments with
   trigger `github:push`.

## 4. Portal changes (Google Apps Script — manual by design)

The static site never hosts portal logic; when portal code in `project/GAS_Files/` changes:

1. Paste the changed file(s) into the Apps Script editor (`Code.gs` = server
   logic; `index` = all portal + public-site UI — there are only these two files).
   First-time setup is in [`../README.md`](../README.md) (Steps 3–4).
2. **Deploy → Manage deployments → ✎ Edit → Version: *New version* → Deploy.**
   This keeps the same `/exec` URL the site links to — **never** create a new
   deployment (a new URL would break every link, including the static site's
   JSONP data feeds).
3. Server-only changes (e.g. a JSONP endpoint in `Code.gs`) are live
   immediately, with **no static rebuild needed** — the site calls `/exec` at
   runtime.

## 5. After any deploy — 30-second check

- `https://physics-pg.pages.dev/` → 200 with the expected content
- Cloudflare **Deployments**: newest = your commit · `github:push` · **Success**
- Portal touched? `…/exec?public=announcements&callback=x` should return one
  line of JavaScript (cross-origin JSONP by design)

## 6. Never do / never commit

- Never commit `project/dist/`, `node_modules/`, `.wrangler/` (already gitignored),
  `docs/Staff.xlsx` (PII), or any token, password, or secret. Auth lives in
  wrangler's OAuth login, Windows Credential Manager / `gh`, the Cloudflare
  dashboard Git connection, and the site owner's Google account — **never in**
  this repo (see § 0.5).
- Never `git add -A` — stage only the paths your change touched.
- Never create a *New deployment* on the portal — always *New version* on
  the existing one.
- Never delete and recreate the Cloudflare project — that severs the Git
  connection and changes the `pages.dev` URL.

<!-- Last updated via deployment script: 2026-11-01 -->

---## Seed Data (from docs/SeedData.md)

Sheet ID: `1cybEF_Fjhyazj4SIH5HnSht6KD31UWftT5fQyGi29uc`

Paste the rows below into the Google Sheet after the `setUp()` function creates the tabs.

> **Local/dev only.** These demo rows were deleted from the live sheet on
> 2026-10-22 with `removeDemoAccounts()` — never re-seed the live sheet. They
> still feed the local preview (`npm run pg`), which mocks the backend from
> these rows.

> **PasswordHash note:** The hashes below are SHA-256 of `PhysicsPG2026!:<salt>`.
> To generate them, paste this into the Apps Script editor and run `generateSeedHashes()`:
> ```js
> function generateSeedHashes() {
>   var pw = 'PhysicsPG2026!';
>   var salts = ['abc123def456', 'xyz789ghi012', 'stu345vwx678', 'yza901bcd234',
>                'efg567hij890', 'klm123nop456', 'qrs789tuv012', 'wxy345zab678'];
>   salts.forEach(function(s) {
>     var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw + ':' + s, Utilities.Charset.UTF_8)
>       .map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
>     Logger.log(s + ' => ' + hash);
>   });
> }
> ```
> Then copy each hash into the matching `PasswordHash` cell below.

---

## Config sheet

| Key | Value |
|-----|-------|
| DEFAULT_PASSWORD | PhysicsPG2026! |
| PASSPORT_FOLDER_ID | 1Bz3EtP8euZF3W2L4oLY_EoHHXxLLZl2Y |
| ADMIN_EMAIL | abel.osagie@uniabuja.edu.ng |

---

## Users sheet

All demo accounts share the password **`PhysicsPG2026!`**.

| id | regNumber | email | passwordHash | salt | role | fullName | firstLogin | active | status | createdAt |
|----|-----------|-------|--------------|------|------|----------|------------|--------|--------|-----------|
| Usr01 | UA/pg2026/000001 | demo.student1@gmail.com | *(generated)* | abc123def456 | Student | Chinedu Okafor | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr02 | UA/pg2026/000002 | demo.student2@gmail.com | *(generated)* | xyz789ghi012 | Student | Fatima Adamu | TRUE | TRUE | Pending | 2026-10-01 08:00:00 |
| Usr03 | 26/408PHYX/040 | demo.student4@gmail.com | *(generated)* | stu345vwx678 | Student | Blessing Eze | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr04 | UA/pg2026/000010 | demo.coordinator@gmail.com | *(generated)* | yza901bcd234 | PG_Coordinator | Amina Bala | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr05 | UA/pg2026/000011 | demo.hod@gmail.com | *(generated)* | efg567hij890 | HoD | Prof. Musa Aliyu | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr06 | UA/pg2026/000012 | demo.staff@gmail.com | *(generated)* | klm123nop456 | Staff | Dr. Grace Obi | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr07 | UA/pg2026/000013 | demo.inspector@gmail.com | *(generated)* | qrs789tuv012 | Submission_Inspector | Dr. Samuel Eze | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |

> **Deactivate all demo accounts before go-live.**

---

## Students sheet

| id | regNumber | surname | firstName | otherNames | gender | phoneNumber | email | faculty | department | programme | specialisation | passportFileId | passportUrl | mainSupervisorId | coSupervisorId | currentStage | yearOfAdmission | createdAt | updatedAt |
|----|-----------|---------|-----------|------------|--------|-------------|-------|---------|------------|-----------|----------------|----------------|-------------|-----------------|----------------|--------------|-----------------|-----------|-----------|
| Stu01 | UA/pg2026/000001 | Okafor | Chinedu | Emeka | Male | 08012345678 | demo.student1@gmail.com | Faculty of Physical Sciences | Physics | MSc | Experimental Solid-State Physics | | | Stf01 | Stf02 | 4 - Proposal Submission | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |
| Stu02 | UA/pg2026/000002 | Adamu | Fatima | Yusuf | Female | 08098765432 | demo.student2@gmail.com | Faculty of Physical Sciences | Physics | PhD | Nuclear Physics | | | | | 1 - Admission | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |
| Stu03 | 26/408PHYX/040 | Eze | Blessing | Chidi | Female | 08055556666 | demo.student4@gmail.com | Faculty of Physical Sciences | Physics | PhD | Solar Physics | | | Stf01 | | 8 - Progress Report | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |

---

## Staff sheet

| id | fullName | email | rank | specialisation | active | createdAt |
|----|----------|-------|------|----------------|--------|-----------|
| Stf01 | Dr. Bala Ahmed | bala.ahmed@uniabuja.edu.ng | Senior Lecturer | Solid-State Physics | TRUE | 2026-10-01 08:00:00 |
| Stf02 | Dr. Grace Obi | grace.obi@uniabuja.edu.ng | Lecturer I | Nuclear Physics | TRUE | 2026-10-01 08:00:00 |
| Stf03 | Prof. Musa Aliyu | musa.aliyu@uniabuja.edu.ng | Professor | Solar Physics | TRUE | 2026-10-01 08:00:00 |

---

## Submissions sheet

| id | regNumber | type | driveFileUrls | status | inspectorComments | supervisorNotes | createdBy | createdAt | updatedAt |
|----|-----------|------|---------------|--------|-------------------|-----------------|-----------|-----------|-----------|
| Sub01 | UA/pg2026/000001 | Research Proposal | https://drive.google.com/file/d/EXAMPLE1 | Approved | Good work | Reviewed by Dr. Bala | Usr01 | 2026-06-15 10:00:00 | 2026-06-20 14:00:00 |
| Sub02 | UA/pg2026/000001 | Progress Report | https://drive.google.com/file/d/EXAMPLE2 | Submitted | | | Usr01 | 2026-09-20 14:30:00 | 2026-09-20 14:30:00 |
| Sub03 | 26/408PHYX/040 | Seminar Presentation | https://drive.google.com/file/d/EXAMPLE3 | Changes Requested | Please expand section 3 | | Usr03 | 2026-07-01 09:15:00 | 2026-07-02 10:00:00 |

---

## Announcements sheet

| id | title | body | active | createdBy | createdAt |
|----|-------|------|--------|-----------|-----------|
| Ann01 | Welcome to 2026/2027 Session | Department of Physics Postgraduate Journey is now live. Register and await approval. | TRUE | Usr04 | 2026-10-01 08:00:00 |
| Ann02 | Monthly Seminar Schedule | Next seminar holds on the last Thursday of every month at 2PM, Physics Seminar Room. | TRUE | Usr04 | 2026-10-15 10:00:00 |

---

## AuditLog sheet

Leave empty — the system writes to it automatically.

---

## Test login quick-reference

| Account | Reg Number | Password | Expected behaviour |
|---------|------------|----------|--------------------|
| Student 1 (approved) | `UA/pg2026/000001` | `PhysicsPG2026!` | Dashboard — shows supervisors Dr. Bala + Dr. Grace |
| Student 2 (pending) | `UA/pg2026/000002` | `PhysicsPG2026!` | Blocked: "Awaiting PG Coordinator approval" |
| Student 4 (approved, pattern 2) | `26/408PHYX/040` | `PhysicsPG2026!` | Dashboard — shows Dr. Bala as main, no co-supervisor |
| PG Coordinator | `UA/pg2026/000010` | `PhysicsPG2026!` | Coordinator dashboard — approve, assign supervisors, announce |
| HoD | `UA/pg2026/000011` | `PhysicsPG2026!` | Read-only stats and all submissions |
| Staff (Dr. Grace Obi) | `UA/pg2026/000012` | `PhysicsPG2026!` | Sees Chinedu Okafor (co-supervised) |
| Submission Inspector | `UA/pg2026/000013` | `PhysicsPG2026!` | Review queue — approve/reject/request changes |

---## Forensic Audit (from docs/audit.md)

**Date:** 2026-10-19
**Scope:** full audit — architecture, data model, auth/security, all API endpoints, known bugs, tech debt, risks.
**Auditor:** automated forensic pass over `project/GAS_Files/`, `project/tools/`, `../README.md`, `DEPLOYMENT.md`, `package.json`.

---

## 1. What the system is

A two-target system for the Department of Physics, University of Abuja:

| Target | Tech | Role |
|--------|------|------|
| **Cloudflare Pages** (`physics-pg`) | Static HTML/CSS/JS built by `project/tools/build-pg.js` | Public site: Home (with About condensed in), Contact, plus `/login/` and `/register/` iframe wrappers |
| **Google Apps Script** (`/exec`) | `Code.gs` (server) + `index.html` (single template SPA) | Register form, login, role dashboards (Student, PG Coordinator, HoD, Staff, Submission Inspector) |

Data lives in **one Google Spreadsheet** (each tab = one table). Passport photos live in a **Google Drive folder**.

**Live URLs**
- Site: `https://physics-pg.pages.dev`
- Portal: `https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec`

---

## 2. Architecture

### 2.1 Single-template design

`project/GAS_Files/index.html` is ONE file with three script blocks:
1. **Common block** — runs on every page. Helpers (`esc`, `call`, `readFileInput`), theme, the shared click interceptor (`PUBLIC_PAGES`), `scrollRestoration='manual'`, and the `publicUi()` IIFE (public pages only: fab rail, scroll progress, reveal).
2. **Login branch** (`<? if (page === 'login') { ?>`) — the portal SPA. `INITIAL_VIEW`, `EMBED`, `icons`, `render()`, `loginHtml()`, `pwChangeHtml()`, all dashboards, and the delegated `data-action` click handler.
3. **Public branch** (`<? } else { ?>`) — `INITIAL_PAGE`, `PAGE_TITLES`, `showView()`, announcements JSONP, contact enquiry.

`Code.gs` `doGet` picks the branch via the `page` scriptlet and injects `brandJson`, `initialPageJson`, `initialViewJson`, `embedJson`.

### 2.2 The `embed` / in-site iframe pattern

- `?page=register&embed=1` and `?page=login&embed=1` are the only framable URLs (`setXFrameOptionsMode(ALLOWALL)`).
- In embed mode the portal hides its own chrome (topbar, hero, rail and music) via `body.emplo…` CSS and keeps internal navigation in-frame (`pageUrl()` appends `&embed=1`).
- The static site's `/login/` and `/register/` are full-page iframes of those URLs (KMSS `loginMode:'page'` pattern), so `script.google.com` never appears in the address bar.

### 2.3 Static build (`project/tools/build-pg.js`)

Pre-renders the public views from the same `index.html`:
- Renders scriptlets with `page = <view>` (`project/tools/pg-template.js`).
- Rewrites `PUBLIC_PAGES` to drop `register`/`login` (those are in-site pages).
- Rewrites `href="?page=X"` → in-site paths (`/`, `/contact/`, `/register/`, `/login/`).
- Injects a JSONP bridge (`google.script.run` → `?public=announcements` / `?public=enquiry`) pointing at the live `/exec`.
- Copies `images/Phy_Complex.png`, `images/PG_Journey_Infographic.png`.
- Writes `dist/_redirects` (`/about/`, `/programmes/` → `/`, 301).

### 2.4 Local preview (`project/tools/serve-pg.js`)

Node http server on `:8081` (override with `PORT`). Renders the template with a mocked `google.script.run` backed by in-memory demo data (accounts from `SeedData.md`). Maps legacy `?page=about|programmes` → Home.

---

## 3. Data model (Google Spreadsheet tabs)

Column order is **authoritative** (`HEADERS` in `Code.gs`).

| Tab | Columns (order matters) |
|-----|--------------------------|
| `Users` | id, regNumber, email, passwordHash, salt, role, fullName, firstLogin, active, status, createdAt |
| `Students` | id, regNumber, surname, firstName, otherNames, gender, phoneNumber, email, faculty, department, programme, specialisation, passportFileId, passportUrl, mainSupervisorId, coSupervisorId, currentStage, yearOfAdmission, createdAt, updatedAt |
| `Staff` | id, fullName, email, rank, specialisation, active, createdAt, role |
| `Submissions` | id, regNumber, type, driveFileUrls, status, inspectorComments, supervisorNotes, createdBy, createdAt, updatedAt |
| `Announcements` | id, title, body, active, createdBy, createdAt |
| `Config` | key, value, updatedAt |
| `AuditLog` | id, at, actorId, actorUsername, action, target, detail |

Short codes (for `nextId_`): Users=`U`, Students=`S`, Staff=`F`, Submissions=`Sub`, Announcements=`AuditLog`.

**Journey stages:** 15 fixed strings (`1 - Admission` … `15 - Completion`). Decision gates at steps 7, 8, 9, 10, 13.

**Roles:** `Student`, `PG_Coordinator`, `HoD`, `Staff`, `Submission_Inspector`.

**Programmes:** `MPhil`, `MSc`, `PhD`. **Specialisations:** 5 (solid-state exp/theory, nuclear, solar, applied geophysics).

---

## 4. Auth & security

- **Passwords:** `SHA-256(password + salt)` via `hashPassword_`. Default `PhysicsPG2026!`, banned from reuse (`assertStrongPassword_`).
- **Sessions:** token = `sess_<uuid>` in `CacheService` (TTL 6 h). Client keeps token in `sessionStorage`. Epoch invalidation on password change.
- **Login lockout:** 5 failures → 900 s lockout (`LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_SECONDS`).
- **Mutating APIs** run inside `withScriptLock_` and pass `requireUser_(token, roles…)` / `assertRole_`.
- **Public endpoints** (no auth): `api_publicAnnouncements`, `api_checkRegistrationStatus`, `api_publicEnquiry` (rate-limited 3/h per email).
- **Audit:** `logAudit_` writes to `AuditLog` for register, password change, staff/student add/remove, stage updates, submission status, announcements.
- **Enquiries** email the active `PG_Coordinator` (`coordinatorEmail_`), falling back to `ENQUIRIES_EMAIL` Script Property (default `abel.osagie@uniabuja.edu.ng`).

### Security notes / risks

- **Spreadsheet ID & Drive folder ID are hardcoded as defaults** (`DEFAULT_SPREADSHEET_ID`, `DEFAULT_PASSPORT_FOLDER_ID`). Override via Script Properties. Anyone with the Sheet id can read all data if sharing is loose — verify Sheet/Drive sharing is restricted.
- **Deployment access = "Anyone"** — intended for a public portal, but the Sheet is the trust boundary.
- **Passport photos** are PII in Drive — restrict the folder.
- **No HTTPS enforcement config** on the static host beyond Cloudflare defaults.
- **`api_publicEnquiry` rate limit** is per-email, 1 h window — trivially bypassed by varying email; acceptable for a departmental form.

---

## 5. API endpoints (Code.gs)

**Public (JSONP, no auth):**
- `?public=announcements&callback=…` → `api_publicAnnouncements` (active announcements, top 12)
- `?public=enquiry&name=&email=&message=` → `api_publicEnquiry`

**Portal (google.script.run, token required unless noted):**
- `api_login(regNumber, password)` / `api_logout(token)` / `api_me(token)`
- `api_changePassword(token, old, new)` (forced on first login)
- `api_register(payload)` — public, locked, emails student + coordinator
- `api_checkRegistrationStatus(regNumber)` — public
- `api_updateProfile(token, payload)`, `api_updateProfilePhoto(token, filePayload)`
- `api_getStudentDashboard(token)`
- `api_listStaff(token)`, `api_saveStaff`, `api_removeStaff`, `api_addStudent`, `api_removeStudent`
- `api_assignSupervisors(token, reg, mainId, coId)`, `api_updateStudentStage(token, reg, stage)`
- `api_createSubmission`, `api_listSubmissions`, `api_updateSubmissionStatus`, `api_addSupervisoryNote`
- `api_getCoordinatorDashboard`, `api_getHoDStats`, `api_getStaffDashboard`
- `api_approveStudent`, `api_rejectStudent`, `api_addAnnouncement`, `api_exportData`

**Maintenance:** `setUp()` (create tabs/seed — **create-if-missing, do not re-run on the live sheet**), `importStaff()` (idempotent staff import from `docs/Staff.xlsx`).

---

## 6. Known bugs & issues

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | `icons` was scoped inside `publicUi()` → `ReferenceError` on the login branch | **Fixed** (`643b218`) | Hoisted `var icons` to the common-script top level |
| 2 | "Back to public site" landed on the About section, not the top of Home | **Fixed** (`905d5fc`) | `history.scrollRestoration='manual'` + `beforeunload` scroll-to-top |
| 3 | Login page has no `showView`, so `?page=home` does a full nav (intended) | By design | Relies on fix #2 for correct scroll |
| 4 | `setUp()` is create-if-missing, not a reconciler | By design | Re-running auto-appends duplicate headers; reset via temp tab → `setUp()` → paste |
| 5 | `docs/Staff.xlsx` is untracked (PII) | Intentional | Never commit |
| 6 | `prog-card` CSS removed with Programmes view | Done | No dead CSS remains |

---

## 7. Tech debt / cleanup

- **`view` vs `name` in `doGet`:** `view` (from `?view=`) selects the SPA's initial view; `name` (from `?page=`) selects the public page. `?view=` is essentially unused by the static site — harmless but a subtle duplication.
- **Duplicated brand constants:** `BRAND` in `index.html` and `brand_()` in `Code.gs` can drift. `brand_()` is authoritative at runtime; the static build injects `execUrl` via `build-pg.js`.
- **Legacy page names** (`about`, `programmes`) still accepted by `publicPageName_` and coerced to Home — deliberate for old links, but `doGet`'s `titles` map still lists them (harmless).
- **No automated tests.** `serve-pg.js` mocks the backend; there is no test harness. The `npm run build` + manual smoke test is the only gate.
- **Console error handler** on the login branch renders a generic "Something went wrong" into `#app` if the SPA fails to boot — useful, but it also masks the real message in production (only `e.message` is shown).

---

## 8. Config & deployment quick reference

**Script Properties:** `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `SCHOOL_LOGO_URL`, `CBS_LOGO_URL`, `FOOTER_TEXT`, `HERO_IMAGE_URL`, `JOURNEY_IMAGE_URL`, `ENQUIRIES_EMAIL`.

**Deploy (GAS):** paste `project/GAS_Files/Code.gs` + `project/GAS_Files/index.html` (file name `index`) → set Script Properties → run `setUp()` once → Deploy as Web app (Execute as **Me**, Access **Anyone**) → **New version on the existing deployment** (never a new deployment, or the `/exec` URL changes).

**Deploy (static):** `npm run build` → push to `main` (Cloudflare Git integration auto-deploys).

**Local:** `npm run pg` (preview :8081), `npm run build` (static → `dist/`).

---

## 9. File map

```
Physics-pg/
├ project/GAS_Files/
│   ├── Code.gs            ← server (paste as "Code")
│   └── index.html         ← ONE template (paste as "index")
├ images/                ← Phy_Complex.png (hero), PG_Journey_Animated.svg, PG_Journey_Infographic.png
├ audio/                 ← music1.mp3 (copied to dist/audio/)
├ docs/
│   ├── DEPLOYMENT.md      ← deploy runbook (GitHub → Cloudflare, Apps Script)
│   ├── AGENT-GUIDE.md     ← runbook for the next agent
│   ├── audit.md           ← this file
│   ├── SeedData.md        ← demo seed rows + hash generator
│   ├── guides/            ← generated role guides (.docx/.pdf)
│   ├── reference/         ← PG_Journey_Stages.docx, pg_journey_roadmap.html
│   └── Staff.xlsx         ← internal roster (NEVER commit)
├ project/tools/
│   ├── pg-template.js     ← GAS-compatible template renderer
│   ├── serve-pg.js        ← local preview (mock backend)
│   ├── build-pg.js        ← static build → dist/ (Cloudflare)
│   └── make-guides.ps1    ← regenerates docs/guides/ via Word COM
├ dist/                  ← build output (gitignored)
├ AGENTS.md              ← conventions + gotchas for coding agents
├ README.md
└ package.json           ← scripts: pg, build
```

---

## 10. Verdict

The system is **coherent and deliberately simple**: one GAS template, one Sheet, one static build. The two bugs found during this audit (`icons` scope, scroll restoration) are fixed. The main operational risks are **Sheet/Drive sharing** (PII + data integrity) and the **hardcoded default IDs** — both are deployment-time concerns, not code defects. No automated tests exist; the build + manual smoke test is the only gate.