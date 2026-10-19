# Department of Physics Postgraduate Journey — University of Abuja

A public-facing website plus a closed, role-based portal for Department of Physics
postgraduate students and staff. The University already runs a central portal for
postgraduate students across departments; this project is the department's own tool
for the PG Coordinator and HoD to manage students' **non-result-related progress**
(admission → supervisors → proposals → submissions → completion).

Built to the same conventions as the KMSS school portal (numbered banner sections,
token auth, `HEADERS` schema, `_locked_` wrappers).

## Tech Stack

- **Public site (this repo → Cloudflare Pages)** — one combined `index.html`
  (all five public views) pre-rendered by `tools/build-pg.js`; announcements and
  contact enquiries reach the portal through JSONP.
- **Portal (Google Apps Script)** — HtmlService (`doGet` + `createTemplateFromFile('index')`),
  2 files total: the combined `index.html` template + `Code.gs`. All transactions
  (login, registration + passport upload, approvals, submissions, dashboards) run here.
- Google Sheets (database — one tab per table)
- Google Drive (passport photos + submission files)

## Hosting: GitHub → Cloudflare Pages + Apps Script

Three pieces, each with one job:

| Piece | Holds | Serves |
|-------|-------|--------|
| **GitHub `Physics-pg`** (this repo) | source of truth | pushes to `main` build & deploy automatically (Cloudflare Git integration) |
| **Cloudflare Pages `physics-pg`** | `dist/` built by `npm run build` | the public site: home (with About condensed into it), contact |
| **Apps Script `/exec`** | the 2 pasted files + Spreadsheet | the portal: register, status check, login, dashboards |

- The static site follows the KMSS `loginMode: 'page'` logic for the **Login**
  and **Register** buttons: they go to in-site pages (`/login/`, `/register/`)
  that embed the live portal in a full-page iframe (`?page=login&embed=1`,
  `?page=register&embed=1`, `XFrameOptions ALLOWALL`), so the raw
  `script.google.com` URL never appears in the address bar — only via each
  page's "Open in new tab" escape hatch.
- Those iframes render with `?embed=1`, so the portal drops its own top bar,
  hero, rail and music (`body.embed` in `index.html`); any `?page=` link inside
  the frame stays in-frame (the shared guard appends `&embed=1`).
- Live data on the static site: announcements (`?public=announcements`) and the
  contact enquiry (`?public=enquiry`) are JSONP endpoints in `Code.gs`, so both
  work cross-origin without CORS.
- Old `/register/` links keep working (the page is still the registration form,
  now framed in-site rather than a redirect stub).
- After pasting file changes into Apps Script, publish with
  **Deploy → Manage deployments → Edit → Version: New version → Deploy** so the
  `/exec` link never changes.

Full step-by-step for future releases (GitHub push, Cloudflare auto-deploy,
manual fallback, connection repair): **[`DEPLOYMENT.md`](DEPLOYMENT.md)**.

### Cloudflare Pages build settings

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root (no monorepo path)
- Node: any recent LTS (the build script uses Node built-ins only)

Every push to `main` then redeploys the site automatically. The Git connection
is already established in the dashboard (project `physics-pg` ← GitHub repo
`cbs-workspace/Physics-pg`, branch `main`), and the fields above are exactly
what Cloudflare runs on each push. Manual fallback if ever needed:
`npx wrangler pages deploy dist --project-name physics-pg --branch main`.

## Folder contents

```
Physics-pg/
├── GAS_Files/
│   ├── Code.gs            ← paste into Apps Script editor as "Code"
│   └── index.html         ← file name "index" — ONE template, selected
│                              server-side by the `page` scriptlet: the public
│                              views (home — About is condensed into a Home
│                              section — register, contact) and the portal SPA
│                              (?page=login)
├── images/
│   ├── Phy_Complex.png    ← hero background photo (set HERO_IMAGE_URL — see below)
│   └── PG_Journey_Infographic.png ← journey infographic on Home (set JOURNEY_IMAGE_URL)
├── docs/
│   ├── PG Journey Roadmap.docx ← reference for journey stages
│   └── Staff.xlsx          ← internal staff roster (local only, never committed)
├── README.md
├── SeedData.md              ← seed rows + hash generator for demo accounts
└── tools/
    ├── pg-template.js       ← shared template renderer (doGet semantics)
    ├── serve-pg.js          ← npm run pg — local preview with demo backend
    └── build-pg.js          ← npm run build — static site into dist/ (Cloudflare)
```

> Apps Script page URLs: `…/exec` (Home) · `…/exec?page=register|contact|login`.
> There is exactly **one** HTML file: `doGet` renders `index.html` as a template —
> the `page` scriptlet branch serves the portal (`login`) or the public site (all
> other page names) from that single paste. Old `?page=about|programmes` links
> are still accepted by `doGet` and fall back to Home.
> The static site paths are `/contact/`; About is a section on Home and
> Programmes was retired. `/about/` and `/programmes/` redirect to `/`
> (`dist/_redirects`, 301); register and login open `/register/` and `/login/` —
> in-site pages that iframe `…/exec?page=register|login&embed=1`.

## Public site (no login required)

- **Home** — hero (department photo background) + live announcements from the
  Announcements tab (`api_publicAnnouncements`), then **Your Postgraduate Journey**:
  the journey infographic with the five phases / 15 steps summarised and the five
  decision gates (Steps 7, 8, 9, 10, 13) highlighted, and a **Please note** callout.
- **Notice / caveat** — the site is strictly for journey navigation and departmental
  PG coordination, progress monitoring and documentation; other matters (incl. SPGS
  referrals) go to the Head, Department of Physics or the PG Coordinator. Full callout
  on Home; one-line version in the footer of every public page.
- **About** — condensed into a single **About the Department** section on Home
  (the standalone About page was retired; `/about/` redirects to `/`).
- **Register** — full registration form (`api_register`) with a **two-step flow**: the
  student first reviews a summary card (all details + passport preview) and can go back
  to edit before pressing *Submit Registration*; then a **status-check box**
  (enter reg number → Pending / Approved / Rejected / Not Found via
  `api_checkRegistrationStatus`). On the static site this form is served in-site at
  `/register/` (portal iframe, `?embed=1`) instead of leaving the website.
- **Student emails** (all branded via `sendPortalMail_`):
  - On submission, `notifyRegistrationReceived_` emails the student a summary +
    "awaiting approval", with the PG Coordinator BCC'd (`coordinatorEmail_`).
  - On the coordinator's decision, `notifyRegistrationDecision_` emails the student
    either "Registration approved" or "Registration not approved" plus the reason
    (sent from `api_approveStudent_locked_` / `api_rejectStudent_locked_`; failures are
    logged and never block the action).
- **Contact** — department details + enquiry form; `api_publicEnquiry` emails the
  active PG Coordinator through branded `sendPortalMail_` (rate-limited 3/hour/email).
  Public/enquiries address is `abel.osagie@uniabuja.edu.ng` (`ENQUIRIES_EMAIL` in
  `Code.gs`, overridable by the `ENQUIRIES_EMAIL` Script Property).
- Top navigation on every page with a **Login** button → `?page=login` (the SPA;
  on the static site the same buttons go to `/login/`, the iframe wrapper).
- Hero background: upload `images/Phy_Complex.png` to Drive (or any host), set the
  Script Property `HERO_IMAGE_URL` to its direct image URL (`brand_()` reads it as
  `heroBgUrl`; the local harness serves the file from `images/` automatically).
- Journey infographic: host `images/PG_Journey_Infographic.png` (Drive or any host) and
  set the Script Property `JOURNEY_IMAGE_URL` (`brand_()` → `brand.journeyImgUrl`; the
  local harness serves `/images/…` from `images/` — the static build bakes the same
  image as `/images/PG_Journey_Infographic.png`). Until the Script Property is set, the
  portal's Home infographic image is hidden (the phase cards still show); the static
  site always shows it.

---

## Step 1 — Spreadsheet

Open the spreadsheet (ID already embedded as `DEFAULT_SPREADSHEET_ID` in `Code.gs`):
`1cybEF_Fjhyazj4SIH5HnSht6KD31UWftT5fQyGi29uc`

Run the `setUp()` function once from the Apps Script editor. It creates all tabs
with the exact `HEADERS` schema and seeds the Config tab. Then paste demo rows
from `SeedData.md` (generate the password hashes with `generateSeedHashes()`
snippet in that file).

Tabs: **Users, Students, Staff, Submissions, Announcements, Config, AuditLog**

Key schema columns (order is authoritative — see `HEADERS` in `Code.gs`):

- Users: `id, regNumber, email, passwordHash, salt, role, fullName, firstLogin, active, status, createdAt`
- Students: `… passportFileId, passportUrl, mainSupervisorId, coSupervisorId, currentStage, yearOfAdmission, …`
- Staff: `id, fullName, email, rank, specialisation, active, createdAt`

---

## Step 2 — Drive folders

1. Passport photos folder (default ID already in Config): `1Bz3EtP8euZF3W2L4oLY_EoHHXxLLZl2Y`
2. Upload the three student templates and note their file IDs (already wired in
   `Code.gs` CONFIG):
   - Research Plan Form (PDF) — `18LZ-3c0rrMPrpuJbrGgngJp9ALzpPetS`
   - PG Journey Roadmap (PDF) — `1ToBmrpIYu-5hvRHy3SVTxxgHSOnIMBp1`
   - Seminar Template (PPTX) — `1e1Ep8-LvFlxXP8VBLPiWnP-lVqCq_lFH`

---

## Step 3 — Apps Script project

1. [script.google.com](https://script.google.com) → **New project** → rename `Physics_PG_Portal`.
2. Paste `GAS_Files/Code.gs` over the default `Code.gs`.
3. Create **one** HTML file: File → New → HTML file → name it exactly `index` →
   paste `GAS_Files/index.html`. **Delete every other HTML file** in the project
   (`login`, `styles`, `common`, and any old standalone `about`, `programmes`,
   `register`, `contact`) — the single template supersedes all of them.
4. (Optional) Script Properties: `SPREADSHEET_ID`, `PASSPORT_FOLDER_ID`,
   `HERO_IMAGE_URL` (public hero photo), `JOURNEY_IMAGE_URL` (journey infographic).
5. Run `setUp()` once, authorize.

---

## Step 4 — Deploy as Web App

**Live deployment (v1):**
`https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec`

1. **Deploy → New deployment → Type: Web app**.
2. **Execute as: Me** · **Who has access: Anyone**.
3. Deploy, authorize (Advanced → Go to project), copy the URL.
4. Updates: **Deploy → Manage deployments → Edit → Version: New version → Deploy**
   (keeps the same URL — never create a new deployment).

---

## Roles & Access

| Role | Can Do |
|------|--------|
| **Student** | Register (pending approval), dashboard: profile + photo update, supervisors, 15-stage journey bar, announcements, templates, new submissions; view own submissions |
| **PG_Coordinator** | Approve/reject registrations, assign main + co-supervisor, manage staff list, post announcements, export CSV |
| **HoD** | Read-only: stats, programme/status breakdowns, all submissions |
| **Staff** | See students they supervise, add supervisory notes on submissions |
| **Submission_Inspector** | Review queue: Approve / Reject / Request Changes / Under Review (comments mandatory for Reject & Request Changes) — emails student via branded `sendPortalMail_` |

## Auth model

- Login by `regNumber` + password → session token in `CacheService` (`sess_<token>`),
  epoch invalidation on password change; token kept in `sessionStorage` client-side.
- Passwords: SHA-256 of `password:salt` via `hashPassword_`; default `PhysicsPG2026!`
  banned from reuse (`assertStrongPassword_`).
- All mutating APIs run inside `_locked_` (`withScriptLock_`) and pass `requireUser_(token, roles…)`.
- First login (`firstLogin=TRUE`) forces password change before any other view.

## Reg Number Validation

Accepts **both** patterns:
- `UA/pg20YY/NNNNNN` — e.g. `UA/pg2026/003531`
- `YY/NNNXXX[X]/NNN[N]` — e.g. `26/408PHYX/040`

---

## Submission Types

Research Plan Form · Seminar Presentation · Research Proposal · Progress Report ·
Final Thesis/Dissertation

Statuses: Draft → Submitted → Under Review → Approved / Rejected / Changes Requested

---

## Journey Stages (from PG Journey Roadmap.docx)

| # | Stage | | # | Stage |
|---|-------|-|---|-------|
| 1 | Admission (Formal) and Registration | | 9 | Compliance & QA Inspection ← decision |
| 2 | Lecture Attendance (MSc only) | | 10 | Plagiarism Check ← decision |
| 3 | Supervisor Allocation | | 11 | External Defence |
| 4 | Submission of Proposal to Supervisor | | 12 | Response to Examiners' Comments |
| 5 | Submission of Form for Proposal Defence | | 13 | Final Compliance & QA Inspection ← decision |
| 6 | Proposal Defence | | 14 | Submission of Signed Copies |
| 7 | Evaluation & Progression Clearance ← decision | | 15 | Completion |
| 8 | Progress Report (Seminar) ← decision | | | |

---

## Theming, hero & landing-page music

- Two themes, both on the KMSS palette — emerald accents on slate neutrals (the
  `--g-50` … `--g-950` scale in `index.html` is the Tailwind emerald scale):
  - **Light** (`:root`) — white/slate-50 canvas (`#f8fafc`), slate text, emerald
    `#059669` accents, slate-900 `#0f172a` sidebar/header.
  - **Dark** (`[data-theme="dark"]`) — slate-950 canvas (`#0b1220`), `#0f172a`
    surfaces, `#1e293b` borders, bright emerald accents (`#6ee7b7` links,
    `#34d399` highlights) and `color-scheme: dark`.
- Toggle button on every page (public top bar / app top bar / theme fab on the
  login card); choice saved to `localStorage['kms-pg-theme']`; defaults to system
  preference (early inline script in `index.html` prevents a flash).
- Home hero uses the department photo (`images/Phy_Complex.png`) under a **bright
  emerald gradient** (deep → emerald-500/400) so the photo stays visible instead of
  being buried under near-black green; white text keeps a soft shadow for contrast.
  Sidebar/header are slate-900 in light and near-black `#060b16` in dark.
- Home hero photo is enabled via the `HERO_IMAGE_URL` Script Property (see
  "Folder contents" above); the journey infographic uses `JOURNEY_IMAGE_URL`.
- **Floating quick-access rail** on every public page (injected once by the
  shared script in `index.html`, mirroring the KMSS landing page): **Contact · Register · Portal · Top**, with labels on
  hover, plus a top **scroll-progress bar**.
- **Animations**: scroll-reveal on headings, lead paragraphs and cards, hover lift on
  cards, animated hero fade-in and smooth back-to-top — all disabled automatically under
  `prefers-reduced-motion`. **Mobile**: public pages collapse to single columns
  (`.row-cols` at ≤640px), the top bar wraps/scrolls, inputs are 16px, and the rail
  shrinks with labels hidden.
- Background music on all public pages + login: playlist cycles
  `music1→2→3→1…`, starts on first interaction, EQ-style mute button + volume
  slider bottom-right (muted state and volume remembered). Controls hide and
  music pauses once signed in. Shared logic lives in the common block of `index.html`. The three
  tracks are served from the live static host
  (`https://kingsmetroschools.vercel.app/music*.mp3` — byte-identical copies
  of `audio/music*.mp3` in this repo, since Apps Script cannot serve binary files);
  edit the `MUSIC` track list in `index.html` if you host them elsewhere.

## Local preview (no Apps Script needed)

```
npm run pg          →  http://localhost:8081          (Home)
                       http://localhost:8081/?page=register   etc.
```

`tools/serve-pg.js` renders the `index.html` template scriptlets exactly like
`doGet` and mocks `google.script.run` with the SeedData accounts
(password `PhysicsPG2026!`), including the public APIs
(`api_publicAnnouncements`, `api_checkRegistrationStatus`, `api_publicEnquiry`).

## Static build (Cloudflare Pages)

```
npm run build       →  dist/  (index + contact/
                               + register/ & login/ iframe pages + images
                               + _redirects: /about/ & /programmes/ → /)
```

`tools/build-pg.js` pre-renders the public views from the same combined
`index.html`, rewrites register/login links to the in-site `/register/` and
`/login/` iframe pages, and injects the
JSONP bridge (`?public=announcements` / `?public=enquiry`) instead of the demo
mocks. To preview the static output locally: `npx serve dist` (any static file
server works).

---

## Before go-live

- Deactivate every `demo.*` account on the Users tab (password `PhysicsPG2026!`).
- Change Config `DEFAULT_PASSWORD` if seeding more real accounts.
