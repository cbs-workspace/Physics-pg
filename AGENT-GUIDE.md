# Agent Guide — Physics-pg continuation runbook

**For:** a developer/agent picking this project up.
**Read first:** `README.md` (conventions) and `audit.md` (full forensic audit). This file is the practical runbook.

---

## 1. The 30-second mental model

- **One Google Sheet** = the database (tabs = tables, column order authoritative).
- **One GAS template** (`GAS_Files/index.html`) = the entire portal + public site, branched server-side by the `page` scriptlet.
- **One static build** (`tools/build-pg.js`) = the Cloudflare Pages site, pre-rendered from the same template.
- **Two deploy targets that never trigger each other:** GitHub (code) and Cloudflare (live site). Pushing to GitHub does NOT deploy; `npm run build` + Cloudflare Git integration does.

---

## 2. Run it locally

```bash
npm run pg       # local preview at http://localhost:8081 (mock backend, demo accounts)
npm run build    # static site → dist/ (Cloudflare)
```

- Change the port: `PORT=8082 npm run pg` or `node tools/serve-pg.js 8082`.
- The preview uses in-memory demo data (accounts from `SeedData.md`, password `PhysicsPG2026!`).
- Kill a stale server: `Get-NetTCPConnection -LocalPort 8081 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.

---

## 3. File map (what to edit for what)

| I want to… | Edit |
|------------|------|
| Change a public page (Home/Contact) | `GAS_Files/index.html` public branch |
| Change the login/portal SPA | `GAS_Files/index.html` login branch |
| Change shared behavior (interceptor, theme, scroll) | `GAS_Files/index.html` common block |
| Change server logic / endpoints / sheet schema | `GAS_Files/Code.gs` |
| Change branding/IDs at runtime | **Script Properties** (not code) |
| Change the static build | `tools/build-pg.js` |
| Change the local mock backend | `tools/serve-pg.js` |

**Rule of thumb:** if it can be done in `index.html`, do it there (single paste). Only touch `Code.gs` for genuine server-side logic.

---

## 4. Deploy

### 4.1 GAS portal (the `/exec` URL)
1. Open the Apps Script editor (signed in as the owner).
2. Paste `GAS_Files/Code.gs` into `Code.gs` (only if it changed).
3. Paste `GAS_Files/index.html` into the HTML file named **`index`** (delete every other HTML file).
4. Set Script Properties (`SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, branding, `ENQUIRIES_EMAIL`).
5. **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy.**
   - **Never create a new deployment** — the `/exec` URL must stay constant or the static site breaks.

### 4.2 Static site (Cloudflare)
- `npm run build` → commit → `git push origin main`. Cloudflare auto-deploys.
- The build writes `dist/_redirects` (`/about/`, `/programmes/` → `/`).

---

## 5. Common tasks

### Add a new public page
1. Add a `<div class="pub-page" data-page="NAME" hidden>` in the public branch.
2. Add a tab `<a href="?page=NAME" data-page="NAME">` in the topbar.
3. Add `NAME` to `PUBLIC_PAGES` and `PAGE_TITLES`.
4. Add `NAME` to `VIEWS` + `HREFS` in `tools/build-pg.js` and to `PAGES` in `tools/serve-pg.js`.
5. Add `NAME` to `publicPageName_`'s allowed map in `Code.gs`.

### Add a new GAS endpoint
1. `function api_x(token, …) { requireUser_(token, […]); … }` in `Code.gs`.
2. Call it from the SPA via `call('api_x', …)` (the common-block helper).
3. If the static site needs it cross-origin, add it to the JSONP bridge in `tools/build-pg.js` (`PUBLIC_APIS`).

### Change the sheet schema
- Edit `HEADERS` in `Code.gs` (order is authoritative) + the migration in section `12a`.
- Do NOT re-run `setUp()` on the live sheet (it auto-appends duplicate headers).

### Re-seed demo data
- Temp tab → run `setUp()` → paste seed rows from `SeedData.md`.

---

## 6. Gotchas (learned the hard way)

- **`icons` scope:** anything in the login branch that needs the icon set must reference the page-level `var icons` (common-script top level) — NOT the copy inside `publicUi()`.
- **Scroll restoration:** the common block sets `history.scrollRestoration='manual'` + a `beforeunload` scroll-to-top. Don't remove these or "Back to public site" lands mid-page.
- **`showView` is public-branch only.** On the login page, `?page=` links do a full navigation (by design).
- **`setUp()` is create-if-missing.** Never re-run on a live sheet.
- **`docs/Staff.xlsx` is PII** — never commit it.
- **Staging:** `npm run deploy:preview` for a Vercel preview; the GAS side has no staging (use a temp Sheet tab to test `setUp()`).
- **PowerShell quirks:** `$home` is read-only (use `$h`); build URIs by concatenation, not interpolation; avoid long inline JSON.

---

## 7. Demo accounts (password `PhysicsPG2026!`)

| Role | Username | Reg Number |
|------|----------|-----------|
| Student | `demo.student` | `UA/pg2026/000001` |
| PG Coordinator | `demo.coordinator` | `UA/pg2026/000010` |
| HoD | `demo.hod` | `UA/pg2026/000011` |
| Staff | `demo.staff` | `UA/pg2026/000012` |
| Submission Inspector | `demo.inspector` | `UA/pg2026/000013` |

**Deactivate every `demo.*` account before go-live** (set `active=FALSE` on the Users tab).

---

## 8. Before go-live checklist

- [ ] Deactivate all `demo.*` accounts.
- [ ] Change `DEFAULT_PASSWORD` if seeding real accounts.
- [ ] Verify Sheet + Drive folder sharing is restricted (PII).
- [ ] Confirm Script Properties (`SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, branding).
- [ ] Paste the latest `index.html` + redeploy a New version.
- [ ] Smoke test: register → approve → login → submit → approve.
