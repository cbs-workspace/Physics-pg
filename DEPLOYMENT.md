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

## 0. Agent runbook — commit to GitHub & ship to Cloudflare Pages

This section is written for an automated agent (or anyone executing it as a
checklist). Run everything from the repo root on `main`. **An agent never
invents, harvests, or stores credentials** — the human owner supplies them
out-of-band (browser OAuth or an environment variable in the same shell).
Never ask the owner to paste a secret into the chat, and never write one into
a file.

### 0.1 What the agent may stage

Commit source only: `GAS_Files/Code.gs`, `GAS_Files/index.html`, `tools/*.js`,
`package.json`, `*.md`, and the files the specific task touched.

Never stage `dist/`, `node_modules/`, `.wrangler/`, `*.log`,
`docs/Staff.xlsx` (PII), or generated `.docx` files unless the owner explicitly
asks for them. Never use `git add -A` / `git add .` — stage explicit paths.
Never force-push, amend a pushed commit, commit with `--no-verify`, or rewrite
`main`.

### 0.2 Credentials — where they come from (the agent cannot fetch these itself)

| Target | Credential | How the owner provides it | How the agent verifies |
|---|---|---|---|
| **GitHub** (push) | Git push access to `cbs-workspace/Physics-pg` | Preferred: owner runs `gh auth login` and approves the device code in a browser. Alternative: a **fine-grained PAT** scoped to that repo with permission **Contents: Read and write**, exported as `$env:GITHUB_TOKEN` or stored by Windows Credential Manager. | `gh auth status` — or `git ls-remote origin -h refs/heads/main` (asks for credentials once, then succeeds) |
| **Cloudflare** (normal path) | **None** | A push to `main` triggers the Pages build; the dashboard GIT connection already holds the GitHub authorization. | § 0.5 |
| **Cloudflare** (manual fallback only, § 2) | OAuth session, or API token + account ID | Owner runs `npx --yes wrangler@latest login` and approves in the browser, **or** creates a token at `dash.cloudflare.com` → **My Profile → API Tokens → Create Token** → template *Cloudflare Pages: Edit*, scoped to the account, then exports `$env:CLOUDFLARE_API_TOKEN` and `$env:CLOUDFLARE_ACCOUNT_ID` (account ID is on the Workers & Pages overview). | `npx --yes wrangler@latest whoami` |
| **Apps Script** portal (§ 4) | Google account with edit access to the Apps Script project and ownership of the Sheet | Owner signs in at `script.google.com`; there is no CLI/agent path. | Manual only |

Rules when a credential is missing:

- Stop and report which of these the owner must do: `gh auth login`,
  `wrangler login`, or exporting the token variables in **this** shell session.
- Do not attempt workarounds — no generating SSH keys, scraping token files,
  copying another user's credential store, or "just trying" a password.
- Credentials live with the site owner, never in this repo (see § 6).

GitHub sign-in without `gh` already installed: the owner runs
`winget install --id GitHub.cli`, then `gh auth login --web --git-protocol https`
followed by `gh auth setup-git`. Without `gh` at all, a plain `git push` opens
**Windows Git Credential Manager** in a browser window — the owner signs in
there, and the token is cached in Windows Credential Manager. In both cases
nothing secret is typed to or stored by the agent.

### 0.3 Pre-commit gate

```powershell
git status                      # review EVERY change; untracked files are not automatically wanted
git diff                        # read the actual diff before committing
node --check tools/build-pg.js  # if any tool JS was touched
npm run build                   # MUST pass:
                                #  - throws on an unrendered template scriptlet
                                #  - throws if PUBLIC_PAGES drifts from build-pg.js
                                #  - throws if the demo mock leaks into dist/
```

If the build fails, fix it — never commit a broken build or skip the gate.

### 0.4 Commit and push

```powershell
git add <path> <path>           # only the files you actually touched, never -A / .
git status --short              # confirm exactly what is staged
git commit -m "scope: what changed and why"
git push origin main
```

If the push is rejected because the remote moved: `git pull --rebase origin main`,
resolve, re-run `npm run build`, then push again. Never force-push `main`.

### 0.5 Confirm Cloudflare deployed

A push to `main` is the deployment — there is nothing else to run.

1. Wait ~30–60 s.
2. `dash.cloudflare.com` → **Workers & Pages** → *physics-pg* →
   **Deployments**: newest entry shows your commit, trigger `github:push`,
   status **Success**.
3. `curl -I https://physics-pg.pages.dev/` → HTTP 200, and spot-check the
   changed content in a private window.

Pushes to any other branch create *preview* deployments only; merge to `main`
to ship. If nothing appears under Deployments, the Git connection is broken —
follow § 3, do not switch to manual uploads as a workaround.

### 0.6 Portal hand-off

A GitHub push does **not** deploy the Apps Script portal. If the task changed
`GAS_Files/Code.gs` or `GAS_Files/index.html`, tell the owner to follow § 4
(paste the file, *Manage deployments → Edit → New version → Deploy*). An agent
cannot do this without the owner's Google session.

## 1. Everyday site change (GitHub → Cloudflare, fully automatic)

Intended for a human at the keyboard. **Agents should follow § 0 instead** — it
adds the credential, staging, and pre-commit-gate rules.

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

Direct upload still works even though the repo is connected. Credentials for
this path come from § 0.2 (OAuth session from `wrangler login`, or
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`); confirm with `wrangler whoami`
first.

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

- Never commit `dist/`, `node_modules/`, `.wrangler/` (already gitignored),
  `docs/Staff.xlsx` (PII), or any token, password, or secret. Auth lives in
  wrangler's OAuth login, Windows Credential Manager / `gh`, the Cloudflare
  dashboard Git connection, and the site owner's Google account — **never in
  this repo** (see § 0.2).
- Never `git add -A` — stage only the paths your change touched.
- Never create a *New deployment* on the portal — always *New version* on the
  existing one.
- Never delete and recreate the Cloudflare project — that severs the Git
  connection and changes the `pages.dev` URL.
