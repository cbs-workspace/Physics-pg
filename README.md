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
- **Portal (Google Apps Script)** — HtmlService (`doGet` + `createTemplateFromFile`),
  5 files total: `index`, `login`, `styles`, `common` + `Code.gs`. All transactions
  (login, registration + passport upload, approvals, submissions, dashboards) run here.
- Google Sheets (database — one tab per table)
- Google Drive (passport photos + submission files)

## Hosting: GitHub → Cloudflare Pages + Apps Script

Three pieces, each with one job:

| Piece | Holds | Serves |
|-------|-------|--------|
| **GitHub `Physics-pg`** (this repo) | source of truth | history only — pushes don't deploy by themselves |
| **Cloudflare Pages `physics-pg`** | `dist/` built by `npm run build` | the public site: home, about, programmes, contact |
| **Apps Script `/exec`** | the 5 pasted files + Spreadsheet | the portal: register, status check, login, dashboards |

- The static site links **Register / Login / Portal** to the live `/exec` URL
  (same architecture as KMSS: static site + portal on GAS).
- Live data on the static site: announcements (`?public=announcements`) and the
  contact enquiry (`?public=enquiry`) are JSONP endpoints in `Code.gs`, so both
  work cross-origin without CORS.
- `/register/` and `/login/` on the static site are redirect stubs to the portal,
  so old links keep working.
- After pasting file changes into Apps Script, publish with
  **Deploy → Manage deployments → Edit → Version: New version → Deploy** so the
  `/exec` link never changes.

### Cloudflare Pages build settings

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root (no monorepo path)
- Node: any recent LTS (the build script uses Node built-ins only)

Every push to `main` then redeploys the site automatically.

## Folder contents

```
Physics-pg/
├── GAS_Files/
│   ├── Code.gs            ← paste into Apps Script editor as "Code"
│   ├── index.html         ← file name "index" — ONE combined file holding all five
│   │                          public views: home, about, programmes, register,
│   │                          contact (client-side view switcher; ?page= still works
│   │                          and deep-links open the right view)
│   ├── login.html         ← file name "login" — the SPA app (login, dashboards, admin)
│   ├── styles.html        ← file name "styles" — all CSS + theme bootstrap (shared)
│   └── common.html        ← file name "common" — brand/helpers/theme/music (shared)
├── images/Phy_Complex.png ← hero background photo (set HERO_IMAGE_URL — see below)
├── PG_Journey_Infographic.png ← journey infographic shown on Home (set JOURNEY_IMAGE_URL)
├── PG Journey Roadmap.docx  ← reference for journey stages
├── README.md
├── SeedData.md              ← seed rows + hash generator for demo accounts
└── tools/
    ├── serve-pg.js          ← npm run pg — local preview with demo backend
    └── build-pg.js          ← npm run build — static site into dist/ (Cloudflare)
```

> Apps Script page URLs: `…/exec` (Home) · `…/exec?page=about|programmes|register|contact|login`.
> Create every HTML file with the exact lowercase name above — `doGet` resolves the
> page name to a file in `template_` (everything except `login` → `index`) and includes
> via `include('…')`.
> The static site paths are `/about/`, `/programmes/`, `/contact/`; register/login
> are handed off to the portal.

## Public site (no login required)

- **Home** — hero (department photo background) + live announcements from the
  Announcements tab (`api_publicAnnouncements`), then **Your Postgraduate Journey**:
  the journey infographic with the five phases / 15 steps summarised and the five
  decision gates (Steps 7, 8, 9, 10, 13) highlighted, and a **Please note** callout.
- **Notice / caveat** — the site is strictly for journey navigation and departmental
  PG coordination, progress monitoring and documentation; other matters (incl. SPGS
  referrals) go to the Head, Department of Physics or the PG Coordinator. Full callout
  on Home; one-line version in the footer of every public page.
- **About / Programmes** — department, degrees, five specialisation areas, 15 stages.
- **Register** — full registration form (`api_register`) with a **two-step flow**: the
  student first reviews a summary card (all details + passport preview) and can go back
  to edit before pressing *Submit Registration*; then a **status-check box**
  (enter reg number → Pending / Approved / Rejected / Not Found via
  `api_checkRegistrationStatus`).
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
- Top navigation on every page with a **Login** button → `?page=login` (the SPA).
- Hero background: upload `images/Phy_Complex.png` to Drive (or any host), set the
  Script Property `HERO_IMAGE_URL` to its direct image URL (`brand_()` reads it as
  `heroBgUrl`; the local harness serves the file from `images/` automatically).
- Journey infographic: host `PG_Journey_Infographic.png` (Drive or any host) and set
  the Script Property `JOURNEY_IMAGE_URL` (`brand_()` → `brand.journeyImgUrl`; the
  local harness serves the PNG from the repo root — the static build bakes the same
  image as `/PG_Journey_Infographic.png`). Until the Script Property is set, the
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
3. For **each** of the 4 HTML files: File → New → HTML file → name it exactly
   (`index`, `login`, `styles`, `common`) → paste the matching `GAS_Files/*.html`.
   If your project still contains the old standalone `about`, `programmes`, `register`
   or `contact` files, **delete them** — they are superseded by the combined `index`.
4. (Optional) Script Properties: `SPREADSHEET_ID`, `PASSPORT_FOLDER_ID`,
   `HERO_IMAGE_URL` (public hero photo), `JOURNEY_IMAGE_URL` (journey infographic).
5. Run `setUp()` once, authorize.

---

## Step 4 — Deploy as Web App

**Live deployment (v1):**
`https://script.google.com/macros/s/AKfycbwx761QoVvu1MxMMPTctO0ILKNJXY44dpaq-eM3KtWPbIYAOV8LaxCvAj9zzn_3e2y05g/exec`

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

- Two themes, both built on University of Abuja green-and-white (the `--g-50` …
  `--g-950` scale in `styles.html`):
  - **Light** (`:root`) — white/off-white surfaces, dark-green accents.
  - **Creme** (`[data-theme="dark"]`) — warm creme background (`#f6f0e3`) and soft
    creme cards with deep-green accents; no near-black surfaces (the sidebar is a
    deep green `#14532d`, `color-scheme: light`). This is the softer alternate to
    the original near-black green theme.
- Toggle button on every page (public top bar / app top bar / theme fab on the
  login card); choice saved to `localStorage['kms-pg-theme']`; defaults to system
  preference (early inline script in `styles.html` prevents a flash).
- Sidebar is deep green in both themes; the Home hero keeps its photo behind a dark
  green gradient in both.
- Home hero uses the department photo (`images/Phy_Complex.png`) behind a dark
  green gradient — enabled via the `HERO_IMAGE_URL` Script Property (see
  "Folder contents" above); the journey infographic uses `JOURNEY_IMAGE_URL`.
- **Floating quick-access rail** on every public page (injected once by `common.html`,
  mirroring the KMSS landing page): **Contact · Register · Portal · Top**, with labels on
  hover, plus a top **scroll-progress bar**.
- **Animations**: scroll-reveal on headings, lead paragraphs and cards, hover lift on
  cards, animated hero fade-in and smooth back-to-top — all disabled automatically under
  `prefers-reduced-motion`. **Mobile**: public pages collapse to single columns
  (`.row-cols` at ≤640px), the top bar wraps/scrolls, inputs are 16px, and the rail
  shrinks with labels hidden.
- Background music on all public pages + login: playlist cycles
  `music1→2→3→1…`, starts on first interaction, EQ-style mute button + volume
  slider bottom-right (muted state and volume remembered). Controls hide and
  music pauses once signed in. Shared logic lives in `common.html`. The three
  tracks are served from the live static host
  (`https://kingsmetroschools.vercel.app/music*.mp3` — byte-identical copies
  of `audio/music*.mp3` in this repo, since Apps Script cannot serve binary files);
  edit the `MUSIC` track list in `common.html` if you host them elsewhere.

## Local preview (no Apps Script needed)

```
npm run pg          →  http://localhost:8081          (Home)
                       http://localhost:8081/?page=register   etc.
```

`tools/serve-pg.js` inlines the `styles`/`common` includes, substitutes the
template scriptlets and mocks `google.script.run` with the SeedData accounts
(password `PhysicsPG2026!`), including the public APIs
(`api_publicAnnouncements`, `api_checkRegistrationStatus`, `api_publicEnquiry`).

## Static build (Cloudflare Pages)

```
npm run build       →  dist/  (index + about/ + programmes/ + contact/
                               + register/ & login/ handoffs + images)
```

`tools/build-pg.js` pre-renders the four public views from the same combined
`index.html`, rewrites register/login links to the live portal, and injects the
JSONP bridge (`?public=announcements` / `?public=enquiry`) instead of the demo
mocks. To preview the static output locally: `npx serve dist` (any static file
server works).

---

## Before go-live

- Deactivate every `demo.*` account on the Users tab (password `PhysicsPG2026!`).
- Change Config `DEFAULT_PASSWORD` if seeding more real accounts.
