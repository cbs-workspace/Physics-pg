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

Commit source only: `GAS_Files/Code.gs`, `GAS_Files/index.html`, `tools/*.js`,
`package.json`, `*.md`, and the files the specific task touched.

Never stage `dist/`, `node_modules/`, `.wrangler/`, `*.log`,
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
| **Apps Script** portal (§ 4) | Google account with edit access to the Apps Script project and ownership of the Sheet | Owner signs in at `script.google.com`; there is no CLI/agent path. | Manual only |

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
  never in this repo (see § 6).

### 0.6 Pre-commit gate

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

### 0.7 Commit and push

```powershell
git add <path> <path>           # only the files you actually touched, never -A / .
git status --short              # confirm exactly what is staged
git commit -m "scope: what changed and why"
git push origin main
```

If the push is rejected because the remote moved: `git pull --rebase origin main`,
resolve, re-run `npm run build`, then push again. Never force-push `main`.

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
   HTML byte-for-byte with your local `dist/index.html`.

   ```powershell
   npm run build
   "local $((Get-FileHash dist/index.html -Algorithm SHA256).Hash)"
   $r = Invoke-WebRequest https://physics-pg.pages.dev/ -UseBasicParsing
   $tmp = Join-Path $env:TEMP "pg-live.html"
   [IO.File]::WriteAllText($tmp, $r.Content)
   "live  $((Get-FileHash $tmp -Algorithm SHA256).Hash)"
   ```

   ```bash
   npm run build
   sha256sum dist/index.html
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
`GAS_Files/Code.gs` or `GAS_Files/index.html`, tell the owner to follow § 4
(paste the file, *Manage deployments → Edit → New version → Deploy*). An agent
cannot do this without the owner's Google session.

## 1. Everyday site change (GitHub → Cloudflare, fully automatic)

Intended for a human at the keyboard. **Agents should follow § 0 instead** — it
adds machine setup (Git/Node/Wrangler), credentials, staging, and the
pre-commit-gate rules.

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
this path come from § 0.5 (OAuth session from `wrangler login`, or
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`); confirm with `wrangler whoami`
first. If Wrangler is not installed, `npx --yes wrangler@latest …` works — see
§ 0.2.

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
  this repo** (see § 0.5).
- Never `git add -A` — stage only the paths your change touched.
- Never create a *New deployment* on the portal — always *New version* on the
  existing one.
- Never delete and recreate the Cloudflare project — that severs the Git
  connection and changes the `pages.dev` URL.

<!-- Last updated via deployment script: 2026-11-01 -->
