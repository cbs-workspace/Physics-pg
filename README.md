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
  (the three public views: home, register, contact) pre-rendered by
  `project/tools/build-pg.js`; announcements and contact enquiries reach the portal
  through JSONP.
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
| **Cloudflare Pages `physics-pg`** | `project/dist/` built by `npm run build` | the public site: home (with About condensed into it), contact |
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
manual fallback, connection repair): **[`AGENTS.md`](AGENTS.md)**.

### Cloudflare Pages build settings

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `project`
- Node: any recent LTS (the build script uses Node built-ins only)

Every push to `main` then redeploys the site automatically. The Git connection
is already established in the dashboard (project `physics-pg` ← GitHub repo
`cbs-workspace/Physics-pg`, branch `main`), and the fields above are exactly
what Cloudflare runs on each push. Manual fallback if ever needed:
`npx wrangler pages deploy project/dist --project-name physics-pg --branch main`.

## Folder contents

```
Physics-pg/
├── project/                 ← application source, assets and build tooling
│   ├── GAS_Files/
│   │   ├── Code.gs          ← paste into Apps Script editor as "Code"
│   │   └── index.html       ← file name "index" — ONE template, selected
│   │                          server-side by the `page` scriptlet: the public
│   │                          views (home — About is condensed into a Home
│   │                          section — register, contact) and the portal SPA
│   │                          (?page=login)
│   ├── images/
│   │   ├── Phy_Complex.png  ← hero background photo (set HERO_IMAGE_URL — see below)
│   │   ├── PG_Journey_Animated.svg ← animated 17-stage poster on Home (set JOURNEY_IMAGE_URL)
│   │   └── PG_Journey_Infographic.png ← older 15-step poster (shown beneath it)
│   ├── audio/
│   │   ├── music1.mp3       ← background music (TRACKS; copied to dist/audio/ by the build)
│   │   └── music2.mp3       ← alternate track (copied, not referenced yet)
│   ├── tools/
│   │   ├── pg-template.js   ← shared template renderer (doGet semantics)
│   │   ├── serve-pg.js      ← npm run pg — local preview with demo backend
│   │   ├── build-pg.js      ← npm run build — static site into dist/ (Cloudflare)
│   │   └── make-guides.ps1  ← regenerates the role guides into docs/guides/ (Word COM)
│   ├── package.json         ← scripts: pg, build (run from this folder)
│   └── dist/                ← build output (gitignored; Cloudflare deploys this)
├── docs/
│   ├── guides/              ← generated role guides (.docx/.pdf) + training programme
│   │   └── …                ← produced by project/tools/make-guides.ps1; the checked-in
│   │                          files predate Step 10b and the document catalogue, so
│   │                          regenerate them before handing them to a new role
│   ├── reference/           ← PG_Journey_Stages.docx + pg_journey_roadmap.html
│   └── Staff.xlsx           ← internal staff roster (local only, never committed)
├── AGENTS.md                ← conventions, gotchas + deploy runbook for coding agents
├── README.md                ← this file
└── .gitignore
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
  Announcements tab (`api_publicAnnouncements`), then directly **Your Postgraduate
  Journey**: the animated 17-stage poster (16 core stages plus the PhD-only Step
  10b; opens full size in a new tab) with the five phases summarised as cards and the
  decision gates (Steps 7, 10, 10b PhD, 12, 13, 15) highlighted. Then **About the Department**, three highlight cards (Register Online /
  Track Your Journey / Supervision & Submissions), and the **Please note** callout last,
  just above the footer.
- **Notice / caveat** — the site is strictly for journey navigation and departmental
  PG coordination, progress monitoring and documentation; other matters (incl. SPGS
  referrals) go to the Head, Department of Physics or the PG Coordinator. Full callout
  closes the Home page; one-line version in the footer of every public page.
- **About** — condensed into a single **About the Department** section on Home, below
  the journey (the standalone About page was retired; `/about/` redirects to `/`).
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
- Journey poster: the repo ships `images/PG_Journey_Animated.svg` (a 1000×900
  animated loop: serpentine path, 17 nodes (including the PhD-only Step 10b), phase
  colours, gate badges, honours `prefers-reduced-motion`) and the static build bakes it in as
  `/images/PG_Journey_Animated.svg`. On the portal, set the Script Property
  `JOURNEY_IMAGE_URL` to an image URL (`brand_()` → `brand.journeyImgUrl`); until
  then the portal's Home poster is hidden (the phase cards still show). The local
  harness serves `/images/…` from `images/`.
  `npm run build` fails if the poster's 17 labels drift from `CFG.JOURNEY_STAGES`.
- The older 15-step poster `images/PG_Journey_Infographic.png` is shown in its own
  card directly beneath the animated poster on the public site (its step names
  differ from the 16 canonical stages). The build copies it to
  `/images/PG_Journey_Infographic.png`; on the portal it hides itself via
  `onerror`, since Apps Script cannot serve static binaries.

---

## Step 1 — Spreadsheet

Open the spreadsheet (ID already embedded as `DEFAULT_SPREADSHEET_ID` in `Code.gs`):
`1cybEF_Fjhyazj4SIH5HnSht6KD31UWftT5fQyGi29uc`

Run the `setUp()` function once from the Apps Script editor. It creates all tabs
with the exact `HEADERS` schema and seeds the Config tab. Demo rows are **not**
re-seeded on a live sheet (the `demo.*` accounts were removed on 2026-10-22) —
local preview data lives in `project/tools/serve-pg.js`; see `AGENTS.md` for the
preview logins.

The 7 core tabs are **Users, Students, Staff, Submissions, Announcements, Config,
AuditLog**; `setUp()` also creates the other operational tabs listed in
`HEADERS` (Meetings, Actions, Programmes sessions, Examiners, …).

Key schema columns (order is authoritative — see `HEADERS` in `Code.gs`):

- Users: `id, regNumber, email, passwordHash, salt, role, fullName, firstLogin, active, status, createdAt`
- Students: `… passportFileId, passportUrl, mainSupervisorId, coSupervisorId, currentStage, yearOfAdmission, …`
- Staff: `id, fullName, email, rank, specialisation, active, createdAt, role`

---

## Step 2 — Drive folders and templates

1. Passport / admission-letter / attachment folder: the Config sheet row
   `PASSPORT_FOLDER_ID` (default `1Bz3EtP8euZF3W2L4oLY_EoHHXxLLZl2Y`). The
   `DRIVE_FOLDER_ID` Script Property is **not read** by the portal.
2. Put the two admin-controlled template file IDs in the Config sheet:
   - `TEMPLATE_PROGRESS_PPTX` — the official presentation template (PPTX).
   - `TEMPLATE_PROPOSAL_DEFENCE_FORM` — the official Proposal Defence Form (PDF).

   These are the only two files in the student **Downloads** card. An empty key hides
   that download; there is no silent fallback to the old Seminar Template. Other IDs
   left in `TEMPLATES` are legacy/operational and are not offered as student downloads.

---

## Step 3 — Apps Script project

1. [script.google.com](https://script.google.com) → **New project** → rename `Physics_PG_Portal`.
2. Paste `project/GAS_Files/Code.gs` over the default `Code.gs`.
3. Create **one** HTML file: File → New → HTML file → name it exactly `index` →
   paste `project/GAS_Files/index.html`. **Delete every other HTML file** in the project
   (`login`, `styles`, `common`, and any old standalone `about`, `programmes`,
   `register`, `contact`) — the single template supersedes all of them.
4. (Optional) Script Properties actually read: `SPREADSHEET_ID`, `SCHOOL_NAME`,
   `FOOTER_TEXT`, `SCHOOL_LOGO_URL`, `CBS_LOGO_URL`, `HERO_IMAGE_URL`,
   `JOURNEY_IMAGE_URL`, `ENQUIRIES_EMAIL`, `SENDER_DISPLAY_NAME`. The Drive folder
   and template IDs belong in the Config sheet, not in Script Properties.
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
| **Student** | Register (pending approval), dashboard: profile + photo update, supervisors, 17-stage journey bar (Step 10b is PhD-only), announcements, templates, new submissions; view own submissions |
| **PG_Coordinator** | Approve/reject registrations, add/import/remove students, correct a student's registration number (cascades to every linked record), assign main + co-supervisor (plus a second co-supervisor for PhD students), record the Proposal Defence and PhD-only Internal Examination II outcomes (Passed / Passed with corrections / Not passed), manage staff list, post announcements, export CSV |
| **HoD** | Read-only: stats, programme/status breakdowns, all submissions |
| **Staff** | See students they supervise, add supervisory notes on submissions |
| **Submission_Inspector** | Review queue: Approve / Reject / Request Changes / Under Review (comments mandatory for Reject & Request Changes) — emails student via branded `sendPortalMail_` |

## Auth model

- Login by `regNumber` + password → session token in `CacheService` (`sess_<token>`),
  epoch invalidation on password change; token kept in `sessionStorage` client-side.
- The sign-in form's password field has a show/hide eye toggle (same pattern as the
  KMSS site); it starts masked and reveals on click.
- Passwords: `pbkdf2$<iterations>$<hex>` from an iterated HMAC-SHA256 loop
  (`hashPassword_`, `HASH_ITERATIONS`); older single-round SHA-256 rows still verify
  and are re-hashed at the next successful sign-in (`verifyPassword_`/`needsRehash_`).
  The default `PhysicsPG2026!` is banned from reuse (`assertStrongPassword_`).
- All mutating APIs run inside a script lock (`withScriptLock_`/`L_`) and take
  `requireUser_(token)`, with a separate `assertRole_` check.
- First login (`firstLogin=TRUE`) forces password change before any other view.

## Reg Number Validation

Accepts **both** patterns:
- `UA/pg20YY/NNNNNN` — e.g. `UA/pg2026/003531`
- `YY/NNNXXX[X]/NNN[N]` — e.g. `26/408PHYX/040`

---

## Submission Types

The catalogue `DOCUMENT_CONFIG` in `Code.gs` (exposed by `api_getDocumentCatalog()`)
is the single source of truth — see the table under **Journey Stages**. Retired labels
such as *Research Plan Form* and *Seminar Presentation* remain only for legacy sheet
rows and are never offered as new uploads. Examiner reports live in
`Examiners.reportUrl`, not in `Submissions`.

Statuses: Draft → Submitted → Under Review → Approved / Rejected / Changes Requested,
plus the catalogue labels *Not Yet Available*, *Correction Required*,
*Awaiting examiner feedback* and *Feedback received*.

---

## Journey Stages (16 core stages + PhD Step 10b, 5 phases)

`CFG.JOURNEY_STAGES` (Code.gs) is authoritative and matches the client-side
`JOURNEY_STAGES` in `index.html` and the animated poster. 10b was inserted without
renumbering 11–16, so existing students' stored stage strings stay valid and no data
migration is needed. Approving the Progress Presentation (PPTX) moves PhD students to
10b and everyone else straight to stage 11; only the PG Coordinator records the 10b
outcome (a pass advances to stage 11, "Not passed" keeps the student at 10b).

| # | Stage | | # | Stage |
|---|-------|-|---|-------|
| 1 | Admission | | 9 | Internal Examiner Assignment |
| 2 | Lecture Attendance (MSc only) | | 10 | Progress Presentation/Internal Examination I ← gate |
| 3 | Supervisor Allocation | | 10b | Internal Examination II (PhD only) ← gate, Coordinator records outcome |
| 4 | Title Approval | | 11 | Final Examination Intent |
| 5 | Proposal Submission | | 12 | Thesis Submission ← gate |
| 6 | Defence Readiness | | 13 | External Examiner Assignment ← gate |
| 7 | Proposal Defence ← gate | | 14 | External Examination |
| 8 | Progress Report Intent | | 15 | Final Compliance ← gate |
| | | | 16 | Signed Copies and Completion |

### Student documents: central config, formats, stages and status

There is **one** document catalogue: `DOCUMENT_CONFIG`, `DOWNLOAD_CONFIG` and
`DOCUMENT_STATUS_LABELS` in `Code.gs`. `api_getDocumentCatalog()` exposes it to signed-in
users, and the student dashboard is rendered from the resolved `documents` /
`downloads` rows returned by `api_getStudentDashboard()` — there are no hardcoded
per-document upload cards left in `index.html`. Each entry carries id, name, section,
stage, programme applicability, trigger, uploader role, formats, required flag,
examiner-dependency, viewers and resubmission permission. Availability, status and
file access are decided on the server; the client only renders them.

Formats are enforced by `checkUploadKind_()` on both the small and chunked upload paths
and on Drive-link pastes (`assertUploadLinkKind_()`), so the picker and the server agree.

| Spec item | Portal type | Format | Opens at |
|---|---|---|---|
| 1 Passport photograph | Students row `passportFileId` / `passportUrl` (registration) | image | registration |
| 2 Admission letter | Students row `admissionLetterUrl` (registration) | PDF | registration |
| 3 Research proposal | `Research Proposal` | Word | 5 |
| 4 Proposal defence presentation | `Proposal Defence Presentation (PPTX)` (plus `Signed Proposal Defence Form` / readiness intent for the signing route) | PPTX (form PDF) | 6 |
| 5 Progress report | `Progress Report` | Word | 8 (readable by the assigned Internal Examiner) |
| 6 Progress presentation | `Progress Presentation (PPTX)` | PPTX | 10 |
| 7 Internal examiner report/comments | examiner assessment comments + optional Word report uploaded to `Examiners.reportUrl` | Word / text | after assignment |
| 8 Response to internal comments | `Comment-by-Comment Response (Internal Examiner)` | Word | 10 |
| 9 Clean copy after internal comments | `Corrected Clean Copy (Internal Examiner)` | Word | 10 |
| 5–9 second cycle (PhD only) | `… (Second Internal)` variants, plus a separate `Internal (Second)` assessment row | as above | 10b, PhD students only |
| 10 School fees receipt | `Receipt of Fees` | PDF | 11 |
| 11 External examination fee receipt | `Evidence of Payment for Examination` | PDF | 11 |
| 12 Plagiarism certificate | `Plagiarism Certificate` | PDF | 11 |
| 13 Final thesis/dissertation | `Final Thesis/Dissertation` | Word | 12 (readable by the assigned External Examiner) |
| 14 External examiner report/comments | examiner assessment comments + optional Word report uploaded to `Examiners.reportUrl` (legacy `External Examiner Comments` rows stay readable, but students no longer upload that type) | Word / text | 14 |
| 15 Response to external comments | `Comment-by-Comment Response (External Examiner)` | Word | 14 |
| 16 Clean copy after external comments | `Final Correction` | Word | 14 |

The student dashboard groups those rows into expandable **Documents by Journey Stage**
sections and a separate **Downloads** card. Downloads are admin-controlled through the
Config keys `TEMPLATE_PROGRESS_PPTX` and `TEMPLATE_PROPOSAL_DEFENCE_FORM`; an unset key
hides that item instead of falling back to the old Seminar Template. Status labels are
`Not Yet Available`, `Pending Submission`, `Submitted`, `Under Review`,
`Correction Required` and `Approved/Accepted`, with `Awaiting examiner feedback` /
`Feedback received` for examiner-dependent items. `api_replaceSubmission()` handles
config-permitted replacements (drafts, approved documents and stage reversion), caches
the filename plus both sides of the change in `Submissions.history`, and keeps the old
file; `api_resubmit()` still handles correction requests. The final correction package
also needs the External Examiner Assessment to be scored before Final Compliance opens.
Every upload is private in Drive and opened through `api_getFileAccess()`.
Second-internal types are refused for non-PhD students in both the config and
`validateSubmissionStage_()`; assigning a second examiner notifies the student, and
`api_replaceExaminer()` revokes the old assignment and appoints the replacement in one
locked call.

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
- Background music on all public pages + login: one track
  (`audio/music1.mp3`), starts on first interaction, EQ-style mute button + volume
  slider bottom-right (muted state and volume remembered). Controls hide and
  music pauses once signed in. Shared logic lives in the common block of
  `index.html` (`TRACKS`). The track is served from the live static host
  (`HOST = https://physics-pg.pages.dev/` → `dist/audio/music1.mp3`) because Apps
  Script cannot serve binary files; `npm run build` copies it from
  `project/audio/music1.mp3`.

## Local preview (no Apps Script needed)

```
cd project
npm run pg          →  http://localhost:8081          (Home)
                       http://localhost:8081/?page=register   etc.
```

`project/tools/serve-pg.js` renders the `index.html` template scriptlets exactly like
`doGet` and mocks `google.script.run` with in-memory demo accounts
(registration number + password `PhysicsPG2026!`; the list is in `AGENTS.md`),
covering 52 of the portal's `api_*` endpoints — anything else fails at runtime.

## Static build (Cloudflare Pages)

```
cd project
npm run build       →  dist/  (index + contact/
                               + register/ & login/ iframe pages + images
                               + _redirects: /about/ & /programmes/ → /)
```

`project/tools/build-pg.js` pre-renders the public views from the same combined
`index.html`, rewrites register/login links to the in-site `/register/` and
`/login/` iframe pages, and injects the
JSONP bridge (`?public=announcements` / `?public=enquiry`) instead of the demo
mocks. To preview the static output locally: `npx serve dist` (any static file
server works).

---

## Before go-live

- ~~Deactivate every `demo.*` account~~ — **done 2026-10-22**: the seeded demo
  accounts were deleted from the live sheet with `removeDemoAccounts()`. All
  seven demo logins now refuse to sign in.
- Change `CFG.DEFAULT_PASSWORD` in `Code.gs` if seeding more real accounts (it is
  no longer written to the Config sheet).
- Sheet/Drive sharing: the site owner **is** both the PG Coordinator and the
  Super Admin, so unrestricted access for those two roles is accepted by
  design — share the sheet and the passport folder with the coordinator only
  and no other departmental account needs write access.
