# Forensic Audit — Department of Physics Postgraduate Journey (Physics-pg)

**Date:** 2026-10-19
**Scope:** full audit — architecture, data model, auth/security, all API endpoints, known bugs, tech debt, risks.
**Auditor:** automated forensic pass over `GAS_Files/`, `tools/`, `README.md`, `DEPLOYMENT.md`, `package.json`.

---

## 1. What the system is

A two-target system for the Department of Physics, University of Abuja:

| Target | Tech | Role |
|--------|------|------|
| **Cloudflare Pages** (`physics-pg`) | Static HTML/CSS/JS built by `tools/build-pg.js` | Public site: Home (with About condensed in), Contact, plus `/login/` and `/register/` iframe wrappers |
| **Google Apps Script** (`/exec`) | `Code.gs` (server) + `index.html` (single template SPA) | Register form, login, role dashboards (Student, PG Coordinator, HoD, Staff, Submission Inspector) |

Data lives in **one Google Spreadsheet** (each tab = one table). Passport photos live in a **Google Drive folder**.

**Live URLs**
- Site: `https://physics-pg.pages.dev`
- Portal: `https://script.google.com/macros/s/AKfycbxOubqD0Dd46th37J-AKeeuO1BQPsAlx-hFmtRnkvcfmC5kLYzihJPA2qLunVojl75v_A/exec`

---

## 2. Architecture

### 2.1 Single-template design
`GAS_Files/index.html` is ONE file with three script blocks:
1. **Common block** — runs on every page. Helpers (`esc`, `call`, `readFileInput`), theme, the shared click interceptor (`PUBLIC_PAGES`), `scrollRestoration='manual'`, and the `publicUi()` IIFE (public pages only: fab rail, scroll progress, reveal).
2. **Login branch** (`<? if (page === 'login') { ?>`) — the portal SPA. `INITIAL_VIEW`, `EMBED`, `icons`, `render()`, `loginHtml()`, `pwChangeHtml()`, all dashboards, and the delegated `data-action` click handler.
3. **Public branch** (`<? } else { ?>`) — `INITIAL_PAGE`, `PAGE_TITLES`, `showView()`, announcements JSONP, contact enquiry.

`Code.gs` `doGet` picks the branch via the `page` scriptlet and injects `brandJson`, `initialPageJson`, `initialViewJson`, `embedJson`.

### 2.2 The `embed` / in-site iframe pattern
- `?page=register&embed=1` and `?page=login&embed=1` are the only framable URLs (`setXFrameOptionsMode(ALLOWALL)`).
- In embed mode the portal hides its own chrome (topbar, hero, fab rail, music, scroll progress, footer) via `body.emplo…` CSS and keeps internal navigation in-frame (`pageUrl()` appends `&embed=1`).
- The static site's `/login/` and `/register/` are full-page iframes of those URLs (KMSS `loginMode:'page'` pattern), so `script.google.com` never appears in the address bar.

### 2.3 Static build (`tools/build-pg.js`)
Pre-renders the public views from the same `index.html`:
- Renders scriptlets with `page = <view>` (`tools/pg-template.js`).
- Rewrites `PUBLIC_PAGES` to drop `register`/`login` (those are in-site pages).
- Rewrites `href="?page=X"` → in-site paths (`/`, `/contact/`, `/register/`, `/login/`).
- Injects a JSONP bridge (`google.script.run` → `?public=announcements` / `?public=enquiry`) pointing at the live `/exec`.
- Copies `images/Phy_Complex.png`, `images/PG_Journey_Infographic.png`.
- Writes `dist/_redirects` (`/about/`, `/programmes/` → `/`, 301).

### 2.4 Local preview (`tools/serve-pg.js`)
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

Short codes (for `nextId_`): Users=`U`, Students=`S`, Staff=`F`, Submissions=`Sub`, Announcements=`Ann`, AuditLog=`Log`.

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

**Deploy (GAS):** paste `GAS_Files/Code.gs` + `GAS_Files/index.html` (file name `index`) → set Script Properties → run `setUp()` once → Deploy as Web app (Execute as **Me**, Access **Anyone**) → **New version on the existing deployment** (never a new deployment, or the `/exec` URL changes).

**Deploy (static):** `npm run build` → push to `main` (Cloudflare Git integration auto-deploys).

**Local:** `npm run pg` (preview :8081), `npm run build` (static → `dist/`).

---

## 9. File map

```
Physics-pg/
├── GAS_Files/
│   ├── Code.gs            ← server (paste as "Code")
│   ├── index.html         ← ONE template (paste as "index")
│   └── Admission.html     ← legacy public admission form (superseded)
├── images/                ← Phy_Complex.png (hero), PG_Journey_Infographic.png
├── docs/
│   ├── PG Journey Roadmap.docx
│   └── Staff.xlsx         ← internal roster (NEVER commit)
├── tools/
│   ├── pg-template.js     ← GAS-compatible template renderer
│   ├── serve-pg.js        ← local preview (mock backend)
│   └── build-pg.js        ← static build → dist/ (Cloudflare)
├── dist/                  ← build output (gitignored)
├── audit.md               ← this file
├── AGENT-GUIDE.md         ← runbook for the next agent
├── student_guide.docx        ← student guide
├── staff_guide.docx          ← staff guide
├── admin_guide.docx          ← admin/technical guide
├── README.md
└── package.json           ← scripts: pg, build
```

---

## 10. Verdict

The system is **coherent and deliberately simple**: one GAS template, one Sheet, one static build. The two bugs found during this audit (`icons` scope, scroll restoration) are fixed. The main operational risks are **Sheet/Drive sharing** (PII + data integrity) and the **hardcoded default IDs** — both are deployment-time concerns, not code defects. No automated tests exist; the build + manual smoke test is the only gate.
