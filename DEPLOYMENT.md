# Deployment guide — GitHub & Cloudflare Pages

How updates reach the live site in the future. Three places are involved, each
with its own mechanism:

| Target | What holds | How it updates |
|--------|------------|----------------|
| **GitHub** `cbs-workspace/Physics-pg` | source of truth (code + docs) | you `git push` |
| **Cloudflare Pages** `physics-pg` | built site from `dist/` | **automatic** on every push to `main` |
| **Apps Script portal** `/exec` | 2 pasted files + Spreadsheet | manual paste + *New version* |

Live URLs — site: `https://physics-pg.pages.dev` · portal:
`https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec`
(the portal URL also lives in `tools/build-pg.js` → `GAS_EXEC`).

## 1. Everyday site change (GitHub → Cloudflare, fully automatic)

Sources: all views and the portal SPA live in the single `GAS_Files/index.html`
template (the `page` scriptlet picks the branch); `tools/build-pg.js` renders
the static site into `dist/`.

1. **Edit** the relevant file(s) under `Physics-pg/`.
   (Fresh clone on a new machine: `git clone https://github.com/cbs-workspace/Physics-pg.git`.)
2. **Check locally:**
   ```
   node --check tools/build-pg.js   # if any JS was touched
   npm run pg                       # portal logic with demo mocks → http://localhost:8081
   npm run build                    # production build → dist/
   npx serve dist                   # preview the static site locally
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
5. **Verify live:** `https://physics-pg.pages.dev/` (hard-refresh or a private
   window if the browser shows an old copy).

Pushes to any **other branch** produce *preview* deployments (separate
`…physics-pg.pages.dev` URL) without touching production — merge to `main` to
ship.

### What Cloudflare runs (configured once in the dashboard)

| Field | Value |
|-------|-------|
| Source | GitHub · `cbs-workspace/Physics-pg` · branch `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repository root) |

Change these only if the build script or the output folder is ever renamed.

## 2. Manual fallback (if auto-deploy ever stops)

Direct upload still works even though the repo is connected:

```
npm run build
npx --yes wrangler@latest login          # only when logged out
npx --yes wrangler@latest pages deploy dist --project-name physics-pg --branch main
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

The static site never hosts portal logic; when portal code in `GAS_Files/`
changes:

1. Paste the changed file(s) into the Apps Script editor (`Code.gs` = server
   logic; `index` = all portal + public-site UI — there are only these two files).
   First-time setup is in the README (Steps 3–4).
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

- Never commit `dist/`, `node_modules/`, `.wrangler/` (already gitignored), or
  any token/secret — auth lives in wrangler's OAuth login and the dashboard
  Git connection.
- Never `git add -A` — stage only the paths your change touched.
- Never create a *New deployment* on the portal — always *New version* on the
  existing one.
- Never delete and recreate the Cloudflare project — that severs the Git
  connection and changes the `pages.dev` URL.
