/**
 * Department of Physics Postgraduate Journey — University of Abuja
 * Google Apps Script web app. Backed by one Google Spreadsheet (tabs = tables)
 * with passport photos stored in a Google Drive folder.
 *
 * DEPLOY
 *   1. Create the tabs and seed data: run setUp() once.
 *   2. Project Settings → Script Properties:
 *        SPREADSHEET_ID  = <your Google Sheet id>
 *        DRIVE_FOLDER_ID = <your Drive folder id>
 *        SCHOOL_LOGO_URL, CBS_LOGO_URL, FOOTER_TEXT  (optional branding)
 *   3. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone.
 */

/* =========================== 1. CONFIG =========================== */

var DEFAULT_SPREADSHEET_ID = '1cybEF_Fjhyazj4SIH5HnSht6KD31UWftT5fQyGi29uc';
var DEFAULT_PASSPORT_FOLDER_ID = '1Bz3EtP8euZF3W2L4oLY_EoHHXxLLZl2Y';
var PROP_SHEET_ID = 'SPREADSHEET_ID';
var PROP_DRIVE_ID = 'DRIVE_FOLDER_ID';
var EMAIL_RE = /^[a-z0-9]+(?:[._%+\-][a-z0-9]+)*@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

var SENDER_DISPLAY_NAME = 'Physics Postgraduate Journey (No-Reply)';
var ENQUIRIES_EMAIL = 'cbs4u4me@gmail.com';
var NOREPLY_FROM_ALIAS = '';
var DEPT_ADDRESS = 'Department of Physics, University of Abuja';
var DEPT_PHONE = '';

var CFG = {
  APP_NAME: 'Department of Physics Postgraduate Journey',
  APP_SUBTITLE: 'University of Abuja',
  DEFAULT_FOOTER_TEXT: '© 2026 Capacity Building and Support. All rights reserved.',
  DEFAULT_LOGO_URL: 'https://drive.google.com/thumbnail?id=1LDjsF_70W2BpttMyLxfmltABCyUSPeHl',
  DEFAULT_CBS_LOGO_URL: 'https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ',
  SESSION_TTL_SECONDS: 21600,
  LOGIN_MAX_FAILURES: 5,
  LOGIN_LOCKOUT_SECONDS: 900,
  DEFAULT_PASSWORD: 'PhysicsPG2026!',
  UPLOAD_MAX_BYTES: 1024 * 1024,
  SUBMISSION_MAX_BYTES: 50 * 1024 * 1024,   // PDF / Word submissions
  SMALL_UPLOAD_BYTES: 10 * 1024 * 1024,     // single-call path; bigger files use the chunked path
  SHEETS: {
    USERS: 'Users', STUDENTS: 'Students', STAFF: 'Staff',
    SUBMISSIONS: 'Submissions', ANNOUNCEMENTS: 'Announcements',
    CONFIG: 'Config', AUDIT_LOG: 'AuditLog'
  },
  ROLES: ['Student', 'PG_Coordinator', 'HoD', 'Staff', 'Submission_Inspector'],
  PROGRAMMES: ['MPhil', 'MSc', 'PhD'],
  SPECIALISATIONS: ['Experimental Solid-State Physics', 'Theoretical Solid-State Physics', 'Nuclear Physics', 'Solar Physics', 'Applied Geophysics'],
  SUBMISSION_TYPES: ['Research Plan Form', 'Seminar Presentation', 'Research Proposal', 'Progress Report', 'Final Thesis/Dissertation',
    'Internal Examiner and Other Observations', 'Final Correction',
    'Comment-by-Comment Response (External Examiner)', 'Comment-by-Comment Response (Internal Examiner)'],
  SUBMISSION_STATUSES: ['Draft', 'Submitted', 'Under Review', 'Changes Requested', 'Approved', 'Rejected'],
  USER_STATUSES: ['Pending', 'Approved', 'Rejected'],
  JOURNEY_STAGES: [
    '1 - Admission', '2 - Lecture Attendance', '3 - Supervisor Allocation',
    '4 - Proposal Submission', '5 - Proposal Defence Form', '6 - Proposal Defence',
    '7 - Progression Clearance', '8 - Progress Report', '9 - Compliance Inspection',
    '10 - Plagiarism Check', '11 - External Defence', '12 - Examiners Comments',
    '13 - Final Compliance', '14 - Signed Copies', '15 - Completion'
  ],
  TEMPLATES: {
    'Research Plan Form': '18LZ-3c0rrMPrpuJbrGgngJp9ALzpPetS',
    'PG Journey Roadmap': '1ToBmrpIYu-5hvRHy3SVTxxgHSOnIMBp1',
    'Seminar Template': '1e1Ep8-LvFlxXP8VBLPiWnP-lVqCq_lFH'
  }
};

/** Sheet tabs and their column order (fields). Order is authoritative. */
var HEADERS = {
  Users: ['id', 'regNumber', 'email', 'passwordHash', 'salt', 'role', 'fullName', 'firstLogin', 'active', 'status', 'createdAt', 'emailPref'],
  Students: ['id', 'regNumber', 'surname', 'firstName', 'otherNames', 'gender', 'phoneNumber', 'email', 'faculty', 'department', 'programme', 'specialisation', 'passportFileId', 'passportUrl', 'mainSupervisorId', 'coSupervisorId', 'currentStage', 'yearOfAdmission', 'createdAt', 'updatedAt', 'thesisTitle', 'titleStatus', 'titleConfirmedBy', 'titleConfirmedAt', 'titleUpdatedAt', 'admissionLetterUrl', 'lastNudgeAt'],
  Staff: ['id', 'fullName', 'email', 'rank', 'specialisation', 'active', 'createdAt', 'role'],
  Submissions: ['id', 'regNumber', 'type', 'driveFileUrls', 'status', 'inspectorComments', 'supervisorNotes', 'createdBy', 'createdAt', 'updatedAt', 'reviewedBy', 'reviewedAt', 'checklist', 'endorsedBy', 'assignedTo', 'history', 'compliance', 'similarity', 'similarityUrl', 'similarityBy', 'similarityAt', 'lastRemindedAt'],
  Announcements: ['id', 'title', 'body', 'active', 'createdBy', 'createdAt', 'audience'],
  Config: ['key', 'value', 'updatedAt'],
  Meetings: ['id', 'regNumber', 'date', 'notes', 'actions', 'createdBy', 'createdAt', 'time', 'venue', 'status', 'ackAt'],
  Deadlines: ['id', 'title', 'date', 'createdBy', 'createdAt'],
  Notifications: ['id', 'regNumber', 'text', 'read', 'createdAt'],
  Messages: ['id', 'regNumber', 'fromName', 'fromRole', 'text', 'createdAt', 'readBy'],
  Templates: ['id', 'owner', 'kind', 'title', 'body', 'createdAt'],
  Inquiries: ['id', 'regNumber', 'subject', 'category', 'status', 'thread', 'createdAt', 'updatedAt', 'lastBy', 'closedBy', 'closedAt'],
  Requests: ['id', 'regNumber', 'type', 'reason', 'status', 'decisionNote', 'createdAt', 'decidedBy', 'decidedAt'],
  Seminars: ['id', 'title', 'date', 'venue', 'presenters', 'attendees', 'createdBy', 'createdAt'],
  Examiners: ['id', 'regNumber', 'examinerName', 'type', 'email', 'score', 'comments', 'status', 'createdAt'],
  AuditLog: ['id', 'at', 'actorId', 'actorUsername', 'action', 'target', 'detail']
};

/** Upload/link columns: the sheet cell shows a clickable label; the real URL lives in the cell's hyperlink.
 *  Code reads the URL back out of the hyperlink, so the rest of the app keeps working with plain URLs. */
var LINK_COLUMNS = {
  Students: { passportUrl: 'View passport', admissionLetterUrl: 'View admission letter' },
  Submissions: { driveFileUrls: 'View file', similarityUrl: 'View report' }
};

var ID_PREFIXES = {
  Users: 'Usr', Students: 'Stu', Staff: 'Stf',
  Submissions: 'Sub', Announcements: 'Ann', AuditLog: 'Log', Meetings: 'Mtg', Notifications: 'Ntf', Requests: 'Req', Seminars: 'Sem', Examiners: 'Exm', Messages: 'Msg', Deadlines: 'Ddl', Inquiries: 'Inq', Templates: 'Tpl'
};
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function brand_() {
  var p = PropertiesService.getScriptProperties();
  return {
    schoolName: p.getProperty('SCHOOL_NAME') || CFG.APP_NAME,
    subtitle: CFG.APP_SUBTITLE,
    footerText: p.getProperty('FOOTER_TEXT') || CFG.DEFAULT_FOOTER_TEXT,
    logoUrl: p.getProperty('SCHOOL_LOGO_URL') || CFG.DEFAULT_LOGO_URL,
    cbsLogoUrl: p.getProperty('CBS_LOGO_URL') || CFG.DEFAULT_CBS_LOGO_URL,
    heroBgUrl: p.getProperty('HERO_IMAGE_URL') || '',
    journeyImgUrl: p.getProperty('JOURNEY_IMAGE_URL') || ''
  };
}

/* =========================== 2. UTILITIES =========================== */

function idPrefix_(table) { return ID_PREFIXES[table] || 'ID'; }
function formatId_(table, n) {
  var p = idPrefix_(table), s = String(n);
  while (s.length < 2) s = '0' + s;
  return p + s;
}
function maxIdNumber_(table) {
  var p = idPrefix_(table);
  var re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
  var max = 0;
  readTableSafe_(table).forEach(function (r) {
    var m = re.exec(String(r.id || ''));
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return max;
}
function nextId_(table) { return formatId_(table, maxIdNumber_(table) + 1); }
function uuid_() { return Utilities.getUuid(); }
function nowIso_() {
  try { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }
  catch (e) { return new Date().toISOString().slice(0, 19); }
}
function toBool_(value) {
  if (value === true || value === false) return value;
  var s = String(value).toLowerCase();
  return !(s === '' || s === 'false' || s === '0' || s === 'no');
}
function escHtml_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeJson_(v) {
  return JSON.stringify(v === undefined ? null : v)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function cellSafe_(v) {
  if (typeof v !== 'string') return v;
  if (/^=/.test(v) || (/^[+\-@][A-Za-z(]/.test(v))) return "'" + v;
  if (/^0\d{10}$/.test(v)) return "'" + v;   // phone numbers: stay text so the leading 0 survives
  return v;
}
function fullNameOf_(rec) { return [rec.firstName, rec.otherNames, rec.surname].filter(Boolean).join(' '); }

/* ---- Lock ---- */
var __lockObj = null, __lockDepth = 0;
function lockAcquire_(ms) {
  if (__lockDepth > 0) { __lockDepth++; return true; }
  var l = LockService.getScriptLock();
  if (!l.tryLock(ms || 20000)) return false;
  __lockObj = l; __lockDepth = 1;
  return true;
}
function lockRelease_() {
  if (__lockDepth === 0) return;
  __lockDepth--;
  if (__lockDepth === 0 && __lockObj) { try { __lockObj.releaseLock(); } catch (e) {} __lockObj = null; }
}
function withScriptLock_(fn, timeoutMs) {
  if (!lockAcquire_(timeoutMs || 20000)) throw new Error('The portal is busy. Please try again in a moment.');
  try { return fn(); } finally { lockRelease_(); }
}

/* ---- Password hashing ---- */
function makeSalt_() { return Utilities.getUuid().replace(/-/g, ''); }
function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + ':' + String(salt), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) { var h = (bytes[i] & 0xff).toString(16); out += h.length === 1 ? '0' + h : h; }
  return out;
}
function assertStrongPassword_(pw, username) {
  var s = String(pw || '');
  if (s.length < 8 || s.length > 128) throw new Error('Password must be 8–128 characters.');
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) throw new Error('Password must contain at least one letter and one number.');
  if (username && s.toLowerCase() === String(username).toLowerCase()) throw new Error('Password cannot be your registration number.');
  var banned = ['password', 'qwerty', '12345678', 'abcd1234', 'demo@1234', 'physicspg2026!'];
  if (banned.indexOf(s.toLowerCase()) !== -1) throw new Error('That password is too common. Choose something unique.');
}


/* ---- One-time (temporary) passwords: random per account, emailed, never stored in plain text ---- */
var TEMP_PW_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function genTempPassword_() {
  for (var attempt = 0; attempt < 20; attempt++) {
    var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), out = '';
    for (var i = 0; i < 10; i++) out += TEMP_PW_ALPHABET.charAt(parseInt(hex.substr(i * 2, 2), 16) % TEMP_PW_ALPHABET.length);
    if (/[A-Za-z]/.test(out) && /[0-9]/.test(out)) return out;
  }
  return 'Pg' + String(new Date().getTime()).slice(-8);   // practically unreachable fallback
}
/** Gives an existing user a fresh random one-time password and forces a change at next sign-in. Returns the plain text to email. */
function issueTempPassword_(userRow) {
  var pw = genTempPassword_(), salt = makeSalt_();
  updateRow_('Users', userRow.id, { passwordHash: hashPassword_(pw, salt), salt: salt, firstLogin: true });
  bumpSessionEpoch_(userRow.id);
  return pw;
}
/** Branded email carrying a staff member's one-time password. Returns true when it was sent. */
function notifyStaffLogin_(email, name, id, role, pw) {
  if (!email || !EMAIL_RE.test(String(email))) return false;
  var roleName = ROLE_NAMES_[role] || role;
  var text = 'Dear ' + name + ',\n\nA ' + roleName + ' login was created for you on the ' + CFG.APP_NAME + '.\nStaff ID: ' + id + '\nOne-time password: ' + pw + '\n\nYou will be asked to choose a new password at first sign-in.';
  var html = '<h2 style="color:#14532d;margin:0 0 4px;font-size:18px">' + escHtml_(CFG.APP_NAME) + '</h2><p style="color:#66756f;margin:0 0 16px;font-size:13px">Portal login created</p>' +
    '<p style="margin:0 0 12px">Dear ' + escHtml_(name) + ', a <strong>' + escHtml_(roleName) + '</strong> login was created for you.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d"><strong>Staff ID</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4">' + escHtml_(id) + '</td></tr>' +
    '<tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d"><strong>One-time password</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4;font-family:monospace">' + escHtml_(pw) + '</td></tr></table>' +
    '<p style="color:#66756f;font-size:13px;margin-top:12px">You will be asked to choose a new password at first sign-in.</p>';
  try { return sendPortalMail_({ to: email, subject: 'Portal login created — ' + id, body: text, htmlBody: html }); } catch (e) { Logger.log('notifyStaffLogin_ ' + id + ': ' + e); return false; }
}
/** RUN ONCE (optional): accounts that still use the old shared default password (never changed) get a random one-time password by email.
 *  Run with dryRun = true first to see how many accounts would change. */
function rotateLegacyDefaultPasswords(dryRun) {
  var n = 0, mailed = 0, failed = [];
  readTable_('Users').forEach(function (u) {
    if (u.role === 'SuperAdmin' || !toBool_(u.active) || String(u.status) !== 'Approved' || !toBool_(u.firstLogin)) return;
    if (hashPassword_(CFG.DEFAULT_PASSWORD, u.salt) !== String(u.passwordHash)) return;
    n++;
    if (dryRun) return;
    var pw = issueTempPassword_(u), ok = false;
    try {
      if (u.role === 'Student') ok = notifyStudentAccountCreated_({ regNumber: u.regNumber, email: u.email, firstName: String(u.fullName || '').split(' ')[0], surname: String(u.fullName || '').split(' ').slice(1).join(' '), programme: '', password: pw });
      else ok = notifyStaffLogin_(u.email, u.fullName || u.regNumber, u.regNumber, u.role, pw);
    } catch (e) {}
    if (ok) mailed++; else failed.push(u.regNumber);
  });
  Logger.log('rotateLegacyDefaultPasswords' + (dryRun ? ' (dry run)' : '') + ': ' + n + ' account(s) on the old default password' + (dryRun ? '' : ', ' + mailed + ' emailed') + (failed.length ? '. Email failed for: ' + failed.join(', ') + ' (they can use Forgot password).' : '.'));
  return { accounts: n, emailed: mailed, failed: failed };
}

/* =========================== 2b. FACULTY / DEPARTMENT LIST =========================== */

/** Spreadsheet that holds the University faculty/department list. The record lives in its SECOND tab, "Fac_Dept_MBBS"
 *  (column A = Faculty, column B = Department). */
const FACULTY_SHEET = '1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8';
const FAC_DEP_TAB = 'Fac_Dept_MBBS';
const FAC_DEP_CACHE_KEY = 'facdep_v1';
const FACULTY_PHYSICAL_SCIENCES = 'Faculty of Physical Sciences';

/** Every reference to the Physics faculty is "Faculty of Physical Sciences" (never "Faculty of Science"). */
function normFaculty_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim().replace(/\s+/g, ' ');
  if (/^faculty of (physical )?sciences?$/i.test(s)) return FACULTY_PHYSICAL_SCIENCES;
  return s;
}
function facDepSheet_() {
  var ss = SpreadsheetApp.openById(FACULTY_SHEET);
  var sh = ss.getSheetByName(FAC_DEP_TAB);
  if (!sh) { var all = ss.getSheets(); if (all.length > 1) sh = all[1]; }   // fall back to the second tab
  if (!sh) throw new Error('The faculty/department list could not be found (second tab "' + FAC_DEP_TAB + '").');
  return sh;
}
/** Returns { faculties: [A-Z], map: { faculty: [departments A-Z] } }, cached for 10 minutes. */
function readFacDep_() {
  var cache = CacheService.getScriptCache(), raw = cache.get(FAC_DEP_CACHE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  var sh = facDepSheet_(), n = sh.getLastRow(), map = {};
  if (n >= 1) {
    sh.getRange(1, 1, n, 2).getValues().forEach(function (r, i) {
      var rawF = String(r[0] === null ? '' : r[0]).trim(), d = String(r[1] === null ? '' : r[1]).trim().replace(/\s+/g, ' ');
      if (i === 0 && /^faculty$/i.test(rawF) && /^department$/i.test(d)) return;   // header row
      var f = normFaculty_(rawF);
      if (!f || !d) return;
      if (!map[f]) map[f] = [];
      if (map[f].indexOf(d) === -1) map[f].push(d);
    });
  }
  var cmp = function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); };
  var faculties = Object.keys(map).sort(cmp);
  faculties.forEach(function (f) { map[f].sort(cmp); });
  var out = { faculties: faculties, map: map };
  try { cache.put(FAC_DEP_CACHE_KEY, JSON.stringify(out), 600); } catch (e) {}
  return out;
}
/** Public (needed by the registration page before sign-in). */
function api_getFacultyDepartments() { return readFacDep_(); }
/** Faculty and Department are both mandatory and the department must belong to the chosen faculty. */
function resolveFacDep_(faculty, department) {
  var f = normFaculty_(faculty), d = String(department || '').trim().replace(/\s+/g, ' ');
  if (!f) throw new Error('Faculty is required.');
  if (!d) throw new Error('Department is required.');
  var data = readFacDep_(), fKey = null, dKey = null;
  data.faculties.forEach(function (x) { if (x.toLowerCase() === f.toLowerCase()) fKey = x; });
  if (!fKey) throw new Error('Please choose a faculty from the list.');
  data.map[fKey].forEach(function (x) { if (x.toLowerCase() === d.toLowerCase()) dKey = x; });
  if (!dKey) throw new Error('Please choose a department that belongs to ' + fKey + '.');
  return { faculty: fKey, department: dKey };
}

/* =========================== 3. DATABASE =========================== */

var __ss = null, __sheets = {}, __tables = {}, __headers = {}, __tv = {};

function getSpreadsheet_() {
  if (!__ss) {
    var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID) || DEFAULT_SPREADSHEET_ID;
    if (id) __ss = SpreadsheetApp.openById(id);
    else __ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  return __ss;
}
function getSheet_(name) {
  if (!__sheets[name]) {
    var s = getSpreadsheet_().getSheetByName(name);
    if (!s && HEADERS[name]) {   // known tab that has not been created yet: create it with its header row
      s = getSpreadsheet_().insertSheet(name);
      s.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold').setBackground('#14532d').setFontColor('#ffffff');
      s.setFrozenRows(1);
    }
    if (!s) throw new Error('Missing sheet tab: ' + name + '. Run setUp() first.');
    __sheets[name] = s;
  }
  return __sheets[name];
}
function sheetHeaders_(name) {
  if (__headers[name]) return __headers[name];
  var sheet = getSheet_(name), lastCol = Math.max(sheet.getLastColumn(), 1);
  var row = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  while (row.length && row[row.length - 1] === '') row.pop();
  if (row.length && HEADERS[name]) {
    HEADERS[name].forEach(function (h) {
      if (row.indexOf(h) === -1) { sheet.getRange(1, row.length + 1).setValue(h); row.push(h); }
    });
  }
  __headers[name] = row.length ? row : HEADERS[name].slice();
  return __headers[name];
}
function readTableFromSheet_(name) {
  var values = getSheet_(name).getDataRange().getValues();
  var rows = [];
  if (values.length >= 2) {
    var headers = values[0];
    for (var i = 1; i < values.length; i++) {
      if (values[i].join('').toString().trim() === '') continue;
      var obj = { _row: i + 1 };
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = sheetCellValue_(values[i][c]);
      rows.push(obj);
    }
    // Link columns: the cell shows a label, so recover the real URL(s) from the hyperlink.
    var lc = LINK_COLUMNS[name];
    if (lc && rows.length) {
      var sheet = getSheet_(name);
      Object.keys(lc).forEach(function (field) {
        var ci = values[0].indexOf(field);
        if (ci < 0) return;
        var rts = sheet.getRange(2, ci + 1, values.length - 1, 1).getRichTextValues();
        rows.forEach(function (r) {
          var urls = richTextUrls_(rts[r._row - 2] && rts[r._row - 2][0]);
          if (urls.length) r[field] = urls.join('\n');   // legacy plain-URL cells keep their text
        });
      });
    }
  }
  return rows;
}
function sheetCellValue_(v) {
  if (Object.prototype.toString.call(v) !== '[object Date]') return v;
  var tz = Session.getScriptTimeZone();
  var hasTime = Utilities.formatDate(v, tz, 'HH:mm:ss') !== '00:00:00';
  return Utilities.formatDate(v, tz, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
}
/** URLs found in free text (space / comma / newline separated). */
function urlsFromText_(v) {
  return String(v === undefined || v === null ? '' : v).split(/[\s,]+/).filter(function (u) { return /^https?:\/\//i.test(u); });
}
/** Hyperlink URLs inside a RichTextValue, in order. */
function richTextUrls_(rt) {
  var urls = [];
  if (!rt) return urls;
  var add = function (u) { if (u && urls.indexOf(u) === -1) urls.push(u); };
  add(rt.getLinkUrl());
  rt.getRuns().forEach(function (run) { add(run.getLinkUrl()); });
  return urls;
}
/** Build a "View passport" style rich-text cell from one or more URLs. */
function linkRichText_(urls, label) {
  if (urls.length === 1) {
    return SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(urls[0]).build();
  }
  var text = '', spans = [];
  urls.forEach(function (u, i) {
    var t = label + ' ' + (i + 1);
    if (i) text += '\n';
    spans.push({ start: text.length, end: text.length + t.length, url: u });
    text += t;
  });
  var b = SpreadsheetApp.newRichTextValue().setText(text);
  spans.forEach(function (sp) { b.setLinkUrl(sp.start, sp.end, sp.url); });
  return b.build();
}
/** Write URL(s) into a link cell as a clickable label (blank clears the cell). */
function writeLinkCell_(sheet, rowNum, colIdx, rawUrls, label) {
  var urls = urlsFromText_(rawUrls);
  var cell = sheet.getRange(rowNum, colIdx + 1);
  if (!urls.length) { cell.setValue(''); return; }
  cell.setRichTextValue(linkRichText_(urls, label));
}
function readTable_(name) {
  if (__tables[name]) return __tables[name];
  var rows = readTableFromSheet_(name);
  __tables[name] = rows;
  return rows;
}
function readTableSafe_(name) { try { return readTable_(name); } catch (e) { return []; } }
function findWhere_(name, predicate) { var rows = readTable_(name); for (var i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i]; return null; }
function filterWhere_(name, predicate) { return readTable_(name).filter(predicate); }
function findById_(name, id) { return findWhere_(name, function (r) { return String(r.id) === String(id); }); }
function invalidateTable_(name) { delete __tables[name]; delete __headers[name]; }
function appendRow_(name, obj) {
  return withScriptLock_(function () {
    if (ID_PREFIXES[name] && (!obj.id || UUID_RE.test(String(obj.id)))) obj.id = nextId_(name);
    var headers = sheetHeaders_(name), sheet = getSheet_(name);
    var lc = LINK_COLUMNS[name] || {};
    sheet.appendRow(headers.map(function (h) {
      if (lc[h] && urlsFromText_(obj[h]).length) return lc[h];   // label now; hyperlink set just below
      return obj[h] === undefined || obj[h] === null ? '' : cellSafe_(obj[h]);
    }));
    var newRow = sheet.getLastRow();
    headers.forEach(function (h, ci) { if (lc[h] && urlsFromText_(obj[h]).length) writeLinkCell_(sheet, newRow, ci, obj[h], lc[h]); });
    invalidateTable_(name);
    return obj;
  }, 30000);
}
function updateRowByField_(name, keyField, keyValue, patch) {
  return withScriptLock_(function () {
    invalidateTable_(name);
    var rows = readTable_(name);
    var target = null;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][keyField]) === String(keyValue)) { target = rows[i]; break; }
    if (!target) return false;
    var sheet = getSheet_(name), headers = sheetHeaders_(name), keyCol = headers.indexOf(keyField);
    if (keyCol < 0) throw new Error('Column "' + keyField + '" is missing from ' + name + '.');
    writeRowPatch_(sheet, headers, target._row, patch);
    invalidateTable_(name);
    return true;
  }, 30000);
}
/** Reads only the last n data rows of a sheet (fast for the ever-growing log sheets). Rows carry _row like readTable_. */
function readTableTail_(name, n) {
  var sheet = getSheet_(name), last = sheet.getLastRow();
  if (last < 2) return [];
  var cols = Math.max(sheet.getLastColumn(), 1), headers = sheet.getRange(1, 1, 1, cols).getValues()[0];
  var start = Math.max(2, last - n + 1), vals = sheet.getRange(start, 1, last - start + 1, cols).getValues(), rows = [];
  vals.forEach(function (r, i) {
    if (r.join('').toString().trim() === '') return;
    var o = { _row: start + i };
    headers.forEach(function (h, c) { o[h] = sheetCellValue_(r[c]); });
    rows.push(o);
  });
  return rows;
}
/** Write a {field: value} patch into ONE physical sheet row (by row number),
 *  coalescing adjacent columns into single setValues calls. */
function writeRowPatch_(sheet, headers, rowNum, patch) {
  var lc = LINK_COLUMNS[sheet.getName()] || {};
  var cols = [], linkCols = [];
  headers.forEach(function (h, ci) {
    if (!Object.prototype.hasOwnProperty.call(patch, h)) return;
    if (lc[h]) linkCols.push(ci); else cols.push(ci);
  });
  linkCols.forEach(function (ci) { writeLinkCell_(sheet, rowNum, ci, patch[headers[ci]], lc[headers[ci]]); });
  var run = null, runs = [];
  cols.forEach(function (ci) {
    if (run && ci === run.end + 1) run.end = ci; else { run = { start: ci, end: ci }; runs.push(run); }
  });
  runs.forEach(function (r) {
    var vals = [];
    for (var ci = r.start; ci <= r.end; ci++) { var v = patch[headers[ci]]; vals.push(v === null || v === undefined ? '' : cellSafe_(v)); }
    sheet.getRange(rowNum, r.start + 1, 1, vals.length).setValues([vals]);
  });
  return cols.length + linkCols.length;
}
function updateRow_(name, id, patch) { return updateRowByField_(name, 'id', id, patch); }
function stripRow_(obj) { var c = {}; Object.keys(obj).forEach(function (k) { if (k !== '_row') c[k] = obj[k]; }); return c; }

/* ---- Audit ---- */
var __actor = null;   // the real Super Admin when the current request runs inside an impersonation session
var IMPERSONATION_TTL = 3600;   // seconds
function logAudit_(actorId, actorUsername, action, target, detail) {
  if (__actor) {   // always record who is really behind an impersonated action
    detail = '[via SuperAdmin ' + __actor.regNumber + ' ' + (__actor.fullName || '') + '] ' + (detail || '');
    actorUsername = String(actorUsername) + ' (SuperAdmin ' + __actor.regNumber + ')';
  }
  try {
    appendRow_('AuditLog', { id: uuid_(), at: nowIso_(), actorId: actorId, actorUsername: actorUsername, action: action, target: target, detail: detail });
  } catch (e) { Logger.log('logAudit_ failed: ' + e); }
}

/* =========================== 4. AUTH =========================== */

var SESSION_EPOCH_TTL = 21600;

function mailSenderName_() {
  try { return PropertiesService.getScriptProperties().getProperty('SENDER_DISPLAY_NAME') || SENDER_DISPLAY_NAME; } catch (e) { return SENDER_DISPLAY_NAME; }
}
function mailEnquiriesAddress_() {
  try { return PropertiesService.getScriptProperties().getProperty('ENQUIRIES_EMAIL') || ENQUIRIES_EMAIL; } catch (e) { return ENQUIRIES_EMAIL; }
}
function noReplyBanner_() {
  return '<div style="max-width:640px;margin:0 auto;background:#b3261e;color:#ffffff;padding:10px 16px;text-align:center;font-size:12.5px;font-weight:700">' +
    '&#9888; DO NOT REPLY &mdash; this is an automated message from ' + escHtml_(CFG.APP_NAME) + '.</div>';
}
function mailFooterBlock_() {
  var addr = mailEnquiriesAddress_();
  return '<div style="max-width:640px;margin:0 auto;background:#f4f7f5;border:1px solid #dbe5df;border-top:none;padding:12px 16px;text-align:center">' +
    '<p style="margin:0;font-size:12px;color:#46584f">This email was generated automatically and cannot receive replies. For enquiries, contact ' +
    '<a href="mailto:' + addr + '" style="color:#14532d;font-weight:600;text-decoration:none">' + addr + '</a>.</p>' +
    '<p style="margin:6px 0 0;font-size:11px;color:#7a8a82">' + escHtml_(DEPT_ADDRESS) + '</p>' +
    '</div>';
}
function buildBrandedHtml_(innerHtml) {
  return '<div style="background:#eef2f0;margin:0;padding:0;font-family:Segoe UI,Arial,Helvetica,sans-serif;color:#1b2a26">' +
    noReplyBanner_() + '<div style="max-width:640px;margin:0 auto">' + (innerHtml || '') + '</div>' + mailFooterBlock_() + '</div>';
}
function mailTextFooter_() {
  return '\n\n—\nThis is an automated message — please do not reply.\nFor enquiries, contact ' + mailEnquiriesAddress() + '.';
}
function mailEnquiriesAddress() { return mailEnquiriesAddress_(); }
function sendPortalMail_(opts) {
  opts = opts || {};
  if (!opts.to) return false;
  try { if (MailApp.getRemainingDailyQuota() < 1) { Logger.log('Mail quota exhausted; not sent: ' + opts.subject); return false; } } catch (qe) {}
  var text = String(opts.body || '');
  if (text.indexOf('automated message') === -1) text += mailTextFooter_();
  var html = opts.htmlBody || '';
  if (html && html.indexOf('generated automatically') === -1) {
    html = buildBrandedHtml_('<div style="background:#ffffff;border:1px solid #dbe5df;border-top:none;padding:24px;font-size:14px;line-height:1.5">' + html + '</div>');
  }
  var o = { to: opts.to, subject: opts.subject || CFG.APP_NAME, body: text };
  if (html) o.htmlBody = html;
  if (opts.attachments) o.attachments = opts.attachments;
  if (opts.bcc) o.bcc = opts.bcc;
  o.name = opts.name || mailSenderName_();
  var reply = opts.replyTo || mailEnquiriesAddress_();
  if (reply && EMAIL_RE.test(reply)) o.replyTo = reply;
  if (NOREPLY_FROM_ALIAS && EMAIL_RE.test(NOREPLY_FROM_ALIAS)) o.from = NOREPLY_FROM_ALIAS;
  MailApp.sendEmail(o);
  return true;
}

function publicUser_(u) {
  return { id: u.id, regNumber: u.regNumber, role: u.role, fullName: u.fullName, email: u.email, status: u.status, firstLogin: toBool_(u.firstLogin), emailPref: u.emailPref || 'instant', photoPrivate: passportPrivate_() };
}
function sessionEpoch_(userId) {
  var v = CacheService.getScriptCache().get('ue_' + userId);
  return v ? String(v) : '0';
}
function bumpSessionEpoch_(userId) {
  try { CacheService.getScriptCache().put('ue_' + userId, String(new Date().getTime()), SESSION_EPOCH_TTL); } catch (e) {}
}
function isLoginLocked_(key) {
  var v = CacheService.getScriptCache().get('lck_' + key);
  return v !== null && parseInt(v, 10) >= CFG.LOGIN_MAX_FAILURES;
}
function recordLoginFailure_(key) {
  var k = 'lck_' + key;
  var n = parseInt(CacheService.getScriptCache().get(k) || '0', 10) + 1;
  CacheService.getScriptCache().put(k, String(n), CFG.LOGIN_LOCKOUT_SECONDS);
}
function clearLoginFailures_(key) { CacheService.getScriptCache().remove('lck_' + key); }
function requireUser_(token) {
  __actor = null;
  if (!token) throw new Error('Please sign in to continue.');
  var raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Your session has expired. Please sign in again.');
  var sess = {};
  try { sess = JSON.parse(raw); } catch (e) { sess = { id: raw }; }
  var user = findById_('Users', sess.id);
  if (!user || !toBool_(user.active)) throw new Error('Please sign in again.');
  if (sess.epoch && String(sess.epoch) !== String(sessionEpoch_(user.id))) throw new Error('Your session has expired. Please sign in again.');
  __actor = null;
  if (sess.actorId) {   // impersonation session: the Super Admin behind it must still be valid
    var actor = findById_('Users', sess.actorId);
    if (!actor || !toBool_(actor.active) || actor.role !== 'SuperAdmin' || (sess.actorEpoch && String(sess.actorEpoch) !== String(sessionEpoch_(actor.id)))) {
      CacheService.getScriptCache().remove('sess_' + token);
      throw new Error('Your session has expired. Please sign in again.');
    }
    __actor = actor;
  }
  return user;
}
function hasRole_(user, roles) { if (!user) return false; return roles.indexOf(user.role) !== -1; }
function assertRole_(user, roles, message) { if (!hasRole_(user, roles)) throw new Error(message || 'You do not have permission to do that.'); }

function api_login(regNumber, password) {
  if (!regNumber || !password) throw new Error('Enter your registration number or staff ID and password.');
  var key = String(regNumber).trim();
  if (isLoginLocked_(key)) throw new Error('Too many failed attempts. Please try again in 15 minutes.');
  var user = findWhere_('Users', function (u) { return String(u.regNumber) === key; });
  if (!user || !toBool_(user.active)) { recordLoginFailure_(key); throw new Error('Invalid registration number / staff ID or password.'); }
  if (String(user.status) === 'Pending') throw new Error('Awaiting PG Coordinator approval. You cannot log in yet.');
  if (String(user.status) === 'Rejected') throw new Error('Your registration was rejected. Please contact the PG Coordinator.');
  if (hashPassword_(password, user.salt) !== String(user.passwordHash)) { recordLoginFailure_(key); throw new Error('Invalid registration number / staff ID or password.'); }
  clearLoginFailures_(key);
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({ id: user.id, epoch: sessionEpoch_(user.id) }), CFG.SESSION_TTL_SECONDS);
  return { token: token, user: publicUser_(user) };
}
function api_logout(token) { if (token) CacheService.getScriptCache().remove('sess_' + token); return true; }
function api_me(token) {
  var u = publicUser_(requireUser_(token));
  if (__actor) u.impersonator = { regNumber: __actor.regNumber, fullName: __actor.fullName };
  return u;
}

function api_changePassword(token, oldPassword, newPassword) {
  var user = requireUser_(token);
  if (__actor) throw new Error('Passwords cannot be changed while signed in as another user. Return to Super Admin first.');
  if (hashPassword_(oldPassword, user.salt) !== String(user.passwordHash)) throw new Error('Old password is incorrect.');
  assertStrongPassword_(newPassword, user.regNumber);
  var salt = makeSalt_();
  updateRow_('Users', user.id, { passwordHash: hashPassword_(newPassword, salt), salt: salt, firstLogin: false });
  bumpSessionEpoch_(user.id);
  logAudit_(user.id, user.regNumber, 'PASSWORD_CHANGE', user.id, 'Password changed');
  return true;
}

/* ---- Super Admin: sign in as any other user (full access, fully audited) ---- */
function api_listImpersonatable(token) {
  var admin = requireUser_(token);
  assertRole_(admin, ['SuperAdmin'], 'Super Admin only.');
  if (__actor) throw new Error('Return to Super Admin first.');
  var order = { PG_Coordinator: 0, HoD: 1, Staff: 2, Submission_Inspector: 3, Student: 4 };
  var list = readTable_('Users').filter(function (u) {
    return u.role !== 'SuperAdmin' && String(u.status) === 'Approved' && toBool_(u.active);
  }).map(function (u) { return { regNumber: u.regNumber, fullName: u.fullName || u.regNumber, role: u.role, email: u.email || '' }; });
  list.sort(function (a, b) { return ((order[a.role] === undefined ? 9 : order[a.role]) - (order[b.role] === undefined ? 9 : order[b.role])) || String(a.fullName).localeCompare(String(b.fullName)); });
  return list;
}
function api_impersonate(token, regNumber) {
  var admin = requireUser_(token);
  if (__actor) throw new Error('Return to Super Admin first.');
  assertRole_(admin, ['SuperAdmin'], 'Only a Super Admin can sign in as another user.');
  var key = String(regNumber || '').trim();
  var target = findWhere_('Users', function (u) { return String(u.regNumber) === key; });
  if (!target || !toBool_(target.active)) throw new Error('That user was not found or is not active.');
  if (target.role === 'SuperAdmin') throw new Error('You cannot sign in as another Super Admin.');
  if (String(target.status) !== 'Approved') throw new Error('That account is not approved yet.');
  var tok = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + tok, JSON.stringify({
    id: target.id, epoch: sessionEpoch_(target.id), actorId: admin.id, actorEpoch: sessionEpoch_(admin.id)
  }), IMPERSONATION_TTL);
  logAudit_(admin.id, admin.regNumber, 'IMPERSONATE_START', target.regNumber, 'Signed in as ' + (target.fullName || '') + ' (' + target.role + ')');
  var u = publicUser_(target); u.firstLogin = false;
  return { token: tok, user: u, impersonator: { regNumber: admin.regNumber, fullName: admin.fullName }, expiresInSeconds: IMPERSONATION_TTL };
}
function api_stopImpersonating(token) {
  if (!token) return true;
  var cache = CacheService.getScriptCache(), raw = cache.get('sess_' + token), sess = null;
  try { sess = raw ? JSON.parse(raw) : null; } catch (e) {}
  if (sess && sess.actorId) {
    cache.remove('sess_' + token);
    var admin = findById_('Users', sess.actorId), tgt = findById_('Users', sess.id);
    logAudit_(sess.actorId, admin ? admin.regNumber : '', 'IMPERSONATE_END', tgt ? tgt.regNumber : String(sess.id), 'Returned to Super Admin');
  }
  return true;
}
/** Run ONCE from the Apps Script editor to create (or reset) a Super Admin login, e.g.
 *    createSuperAdmin('SUPER001', 'Your Name', 'you@example.com', 'A-Strong-Passw0rd')
 *  You will be asked to change the password at first sign-in. There is deliberately no in-app way to create one. */
function createSuperAdmin(regNumber, fullName, email, password) {
  var reg = String(regNumber || '').trim().toUpperCase(), em = cleanEmail_(email), name = String(fullName || '').trim();
  if (!reg || name.length < 2 || !validateEmail_(em)) throw new Error('Provide a staff ID, full name and valid email.');
  assertStrongPassword_(password, reg);
  var existing = findWhere_('Users', function (u) { return String(u.regNumber) === reg; });
  if (existing && existing.role !== 'SuperAdmin') throw new Error(reg + ' already belongs to a ' + existing.role + '. Use a different ID.');
  var salt = makeSalt_(), hash = hashPassword_(password, salt);
  if (existing) { updateRow_('Users', existing.id, { passwordHash: hash, salt: salt, fullName: name, email: em, active: true, status: 'Approved', firstLogin: true }); bumpSessionEpoch_(existing.id); }
  else appendRow_('Users', { regNumber: reg, email: em, passwordHash: hash, salt: salt, role: 'SuperAdmin', fullName: name, firstLogin: true, active: true, status: 'Approved', createdAt: nowIso_() });
  logAudit_('system', 'setup', 'CREATE_SUPERADMIN', reg, name);
  Logger.log('Super Admin ready: ' + reg);
}

/* =========================== 5. SETUP / SEED =========================== */

function setUp() {
  var ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var lastCol = Math.max(sheet.getLastColumn(), 0);
    if (lastCol === 0) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold').setBackground('#14532d').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      sheetHeaders_(name); // auto-append missing columns
    }
  });
  // Seed default config (the old shared default password is no longer used and is not written to the sheet)
  var cfgSheet = ss.getSheetByName('Config');
  if (cfgSheet.getLastRow() < 2) {
    cfgSheet.appendRow(['PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID, nowIso_()]);
    cfgSheet.appendRow(['ADMIN_EMAIL', ENQUIRIES_EMAIL, nowIso_()]);
  }
  try { ensureSettings_(); } catch (e) { Logger.log('ensureSettings_: ' + e); }
  Logger.log('setUp complete. Tabs: ' + Object.keys(HEADERS).join(', '));
}

/** Settings you can change in the Config tab (key | value). Missing ones are added with these defaults; existing values are never overwritten.
 *  LIMIT_MONTHS_* are PLACEHOLDER programme time limits \u2014 enter the real ones, then set TIME_LIMITS_ENABLED = yes. */
var NEW_SETTINGS = [
  ['SIMILARITY_LIMIT', '20'], ['REQUIRE_SIMILARITY', 'no'], ['EXAMINER_APPROVAL_REQUIRED', 'no'], ['PASSPORT_PRIVACY', 'public'],
  ['TIME_LIMITS_ENABLED', 'no'], ['LIMIT_MONTHS_MSc', '24'], ['LIMIT_MONTHS_MPhil', '36'], ['LIMIT_MONTHS_PhD', '60'], ['TIME_ALERT_MONTHS', '6'], ['ENDORSE_REMIND_DAYS', '3'], ['NUDGE_DAYS', '30']
];
function ensureSettings_() {
  var sh = getSheet_('Config'), have = {}, added = [];
  readTable_('Config').forEach(function (r) { have[String(r.key)] = 1; });
  NEW_SETTINGS.forEach(function (kv) { if (!have[kv[0]]) { sh.appendRow([kv[0], kv[1], nowIso_()]); added.push(kv[0]); } });
  if (added.length) invalidateTable_('Config');
  return added;
}
function getSetting_(key, def) {
  var row = findWhere_('Config', function (r) { return String(r.key) === String(key); });
  return row ? String(row.value) : def;
}

/* =========================== 6. PUBLIC REGISTRATION =========================== */

var REG_RE_1 = /^UA\/pg20\d{2}\/\d{6}$/;
var REG_RE_2 = /^\d{2}\/\d{3}[A-Z]{3,4}\/\d{3,4}$/;

function validateRegNumber_(reg) { return REG_RE_1.test(reg) || REG_RE_2.test(reg); }
/** Academic year from the registration / admission number:
 *    UA/pg2026/003531  -> 2026  (the four digits after "pg")
 *    26/408PHYX/040    -> 2026  (the first two digits, read as 20xx)
 *  Returns null when the number matches neither pattern. */
function academicYearFromReg_(reg) {
  var r = String(reg || '').trim().replace(/\s+/g, ''), m;
  if ((m = r.match(/^UA\/pg(\d{4})\//i))) return parseInt(m[1], 10);
  if ((m = r.match(/^(\d{2})\/\d{3}[A-Z]{3,4}\/\d{3,4}$/i))) return 2000 + parseInt(m[1], 10);
  return null;
}
/** Academic session label: admission year 2026 -> "2025/2026". */
function sessionLabel_(year) { var y = parseInt(year, 10); return y ? (y - 1) + '/' + y : ''; }
function studentSession_(s) { return sessionLabel_(academicYearFromReg_(s.regNumber) || s.yearOfAdmission); }
/** Supervisor name with rank. Names that already start with a title (Prof., Dr., Engr. ...) are not given a second one. */
function supWithRank_(st) {
  if (!st) return '';
  var name = String(st.fullName || '').trim(), rank = String(st.rank || '').trim();
  if (!name) return '';
  if (/^(prof|professor|dr|engr|mr|mrs|ms|miss)\b\.?/i.test(name) || !rank) return name;
  return rank + ' ' + name;
}
/** Thesis/Dissertation title rules: entry opens at stage 6; once the PG Coordinator confirms it, it is locked until stage 11 (External Defence). */
var TITLE_OPEN_STAGE = '6 - Proposal Defence', TITLE_UNLOCK_STAGE = '11 - External Defence';
function titleState_(s) {
  var idx = CFG.JOURNEY_STAGES.indexOf(String(s.currentStage || ''));
  var status = String(s.titleStatus || '') || (String(s.thesisTitle || '').trim() ? 'Pending' : '');
  var open = idx >= CFG.JOURNEY_STAGES.indexOf(TITLE_OPEN_STAGE);
  var locked = status === 'Confirmed' && idx < CFG.JOURNEY_STAGES.indexOf(TITLE_UNLOCK_STAGE);
  return { open: open, locked: locked, status: status };
}
/** RUN ONCE from the Apps Script editor: re-derives yearOfAdmission for every existing student from their registration number. */
function fixAcademicYears() {
  var n = 0, skipped = 0;
  readTable_('Students').forEach(function (st) {
    var y = academicYearFromReg_(st.regNumber);
    if (!y) { skipped++; return; }
    if (String(st.yearOfAdmission) !== String(y)) { updateRow_('Students', st.id, { yearOfAdmission: y, updatedAt: nowIso_() }); n++; }
  });
  Logger.log('fixAcademicYears: ' + n + ' updated, ' + skipped + ' skipped (unrecognised number format).');
}
/** Staff IDs: three uppercase letters "ACA" + 3 or 4 digits (e.g. ACA1234). */
var STAFF_ID_RE = /^ACA\d{3,4}$/;
function validateStaffId_(id) { return STAFF_ID_RE.test(String(id || '').trim().toUpperCase()); }
function validateEmail_(email) { var e = String(email || '').trim(); return e.length <= 254 && EMAIL_RE.test(e); }
function cleanEmail_(email) { return String(email || '').replace(/\s+/g, '').toLowerCase(); }
/** Nigerian mobile: returns 11-digit local format (08012345678) or null. Accepts +234 / 234 / missing leading 0. */
function validatePhone_(phone) {
  var s = String(phone || '').replace(/[\s\-().]/g, '');
  if (/^\+?234/.test(s)) s = '0' + s.replace(/^\+?234/, '').replace(/^0/, '');
  else if (/^[789]\d{9}$/.test(s)) s = '0' + s;
  return /^0[789][01]\d{8}$/.test(s) ? s : null;
}
function validateName_(name) { var s = String(name || '').trim(); return s.length >= 2 && /^[A-Za-z\s'\-]+$/.test(s); }
/** "jOHN  mary-jane o'brien" -> "John Mary-Jane O'Brien". */
function toTitleCase_(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[\u2019\u2018`]/g, "'").replace(/\s+/g, ' ').trim()
    .toLowerCase().replace(/(^|[\s'\-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
}

/** Serialised wrapper: one writer at a time so read-check-write cannot interleave. */
function api_register_locked_(payload) {
  if (!payload) throw new Error('Missing form data.');
  var reg = String(payload.regNumber || '').trim();
  if (!validateRegNumber_(reg)) throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
  payload.firstName = toTitleCase_(payload.firstName);
  payload.otherNames = toTitleCase_(payload.otherNames);
  if (!validateName_(payload.surname)) throw new Error('Surname must be at least 2 letters.');
  if (!validateName_(payload.firstName)) throw new Error('First name must be at least 2 letters (letters, hyphen and apostrophe only).');
  if (payload.otherNames && !validateName_(payload.otherNames)) throw new Error('Other names may contain letters, spaces, hyphens and apostrophes only.');
  var email = cleanEmail_(payload.email);
  if (!validateEmail_(email)) throw new Error('Invalid email address. Use the form name@example.com.');
  var phone = validatePhone_(payload.phoneNumber);
  if (!phone) throw new Error('Invalid phone number. Use a Nigerian mobile number such as 08012345678.');
  if (CFG.PROGRAMMES.indexOf(payload.programme) === -1) throw new Error('Invalid programme.');
  if (CFG.SPECIALISATIONS.indexOf(payload.specialisation) === -1) throw new Error('Invalid specialisation.');
  if (['Male', 'Female'].indexOf(payload.gender) === -1) throw new Error('Gender must be Male or Female.');
  var fd = resolveFacDep_(payload.faculty, payload.department);

  if (findWhere_('Users', function (u) { return String(u.regNumber) === reg; })) throw new Error('Registration number already registered.');
  if (findWhere_('Users', function (u) { return String(u.email || '').toLowerCase() === email; })) throw new Error('This email address is already used by another account. Use a different email, or contact the PG Coordinator if this is a mistake.');

  // Upload passport
  if (!payload.passportPhoto || !payload.passportPhoto.dataUrl) throw new Error('Passport photo is required.');
  var fileInfo = savePassportPhoto_(payload.passportPhoto, reg);
  var letterInfo = (payload.admissionLetter && payload.admissionLetter.dataUrl) ? saveAdmissionLetter_(payload.admissionLetter, reg) : null;   // optional

  var salt = makeSalt_();
  var now = nowIso_();

  appendRow_('Students', {
    regNumber: reg,
    surname: String(payload.surname).trim(),
    firstName: String(payload.firstName).trim(),
    otherNames: String(payload.otherNames || '').trim(),
    gender: payload.gender,
    phoneNumber: phone,
    email: email,
    faculty: fd.faculty,
    department: fd.department,
    programme: payload.programme,
    specialisation: payload.specialisation,
    passportFileId: fileInfo.id,
    passportUrl: fileInfo.url,
    admissionLetterUrl: letterInfo ? letterInfo.url : '',
    mainSupervisorId: '',
    coSupervisorId: '',
    currentStage: '1 - Admission',
    yearOfAdmission: academicYearFromReg_(reg) || new Date().getFullYear(),
    createdAt: now,
    updatedAt: now
  });

  appendRow_('Users', {
    regNumber: reg,
    email: email,
    passwordHash: hashPassword_(genTempPassword_(), salt),   // placeholder nobody knows; a one-time password is emailed on approval
    salt: salt,
    role: 'Student',
    fullName: payload.firstName + ' ' + payload.surname,
    firstLogin: true,
    active: true,
    status: 'Pending',
    createdAt: now
  });

  logAudit_('system', 'public', 'REGISTER', reg, 'New student: ' + payload.surname + ' ' + payload.firstName);
  try {
    notifyRegistrationReceived_({
      regNumber: reg,
      firstName: String(payload.firstName).trim(),
      surname: String(payload.surname).trim(),
      otherNames: String(payload.otherNames || '').trim(),
      gender: payload.gender,
      phoneNumber: phone,
      email: email,
      faculty: fd.faculty,
      department: fd.department,
      programme: payload.programme,
      specialisation: payload.specialisation
    });
  } catch (mailErr) { Logger.log('Registration email failed for ' + reg + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true, message: 'Registration submitted. Awaiting PG Coordinator approval.' };
}
function api_register() { var a = arguments; return withScriptLock_(function () { return api_register_locked_.apply(null, a); }, 30000); }

/** Branded "registration received" email to the student (coordinator BCC'd). */
function notifyRegistrationReceived_(p) {
  if (!p.email || !EMAIL_RE.test(String(p.email))) return;
  var rows = [
    ['Registration number', p.regNumber],
    ['Name', p.firstName + ' ' + p.surname + (p.otherNames ? ' ' + p.otherNames : '')],
    ['Gender', p.gender],
    ['Phone', p.phoneNumber],
    ['Email', p.email],
    ['Faculty', p.faculty],
    ['Department', p.department],
    ['Programme', p.programme],
    ['Specialisation', p.specialisation]
  ];
  var text = [CFG.APP_NAME + ' — registration received', '', 'Dear ' + p.firstName + ' ' + p.surname + ',', '',
    'Your registration has been received and is awaiting approval by the PG Coordinator.', '']
    .concat(rows.map(function (r) { return r[0] + ': ' + (r[1] || '—'); }))
    .concat(['', 'You will receive another email once your registration has been reviewed.',
      'You can also check your status on the Register page at any time.']).join('\n');
  var html = '<h2 style="color:#14532d;margin:0 0 4px;font-size:18px">' + escHtml_(CFG.APP_NAME) + '</h2>' +
    '<p style="color:#66756f;margin:0 0 16px;font-size:13px">Registration received</p>' +
    '<p style="margin:0 0 12px">Dear ' + escHtml_(p.firstName + ' ' + p.surname) + ', your registration has been received and is <strong>awaiting approval</strong> by the PG Coordinator.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">' +
    rows.map(function (r) {
      return '<tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d;white-space:nowrap"><strong>' + escHtml_(r[0]) + '</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4">' + escHtml_(String(r[1] || '—')) + '</td></tr>';
    }).join('') +
    '</table><p style="color:#66756f;font-size:13px;margin-top:12px">You will receive another email once your registration has been reviewed. You can also check your status on the Register page at any time.</p>';
  var opts = { to: p.email, subject: 'Registration received — ' + p.regNumber + ' (' + CFG.APP_NAME + ')', body: text, htmlBody: html };
  var coord = coordinatorEmail_();
  if (coord && String(coord).toLowerCase() !== String(p.email).toLowerCase()) opts.bcc = coord;
  sendPortalMail_(opts);
}

/** Branded approve/reject decision email to the student. */
function notifyRegistrationDecision_(target, status, reason, tempPassword) {
  if (!target || !target.email || !EMAIL_RE.test(String(target.email))) return false;
  var approved = status === 'Approved';
  var name = String(target.fullName || target.regNumber);
  var head = approved ? 'Registration approved' : 'Registration not approved';
  var line1 = approved
    ? 'Your registration has been approved. You can now sign in with your registration number and the one-time password below.'
    : 'Your registration was not approved.';
  var rows = approved
    ? [['Registration number', target.regNumber], ['One-time password', tempPassword || '(use "Forgot password?" on the sign-in page)']]
    : [['Reason', String(reason || '').trim() || 'Not stated.']];
  var text = [CFG.APP_NAME + ' — ' + head, '', 'Dear ' + name + ',', '', line1, '']
    .concat(rows.map(function (r) { return r[0] + ': ' + r[1]; }))
    .concat(['', approved ? 'You will be asked to choose a new password at your first sign-in.' : 'For clarification, contact ' + mailEnquiriesAddress_() + '.']).join('\n');
  var html = '<h2 style="color:#14532d;margin:0 0 4px;font-size:18px">' + escHtml_(CFG.APP_NAME) + '</h2>' +
    '<p style="color:#66756f;margin:0 0 16px;font-size:13px">' + escHtml_(head) + '</p>' +
    '<p style="margin:0 0 10px">Dear ' + escHtml_(name) + ', ' + escHtml_(line1) + '</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">' + rows.map(function (r, i) {
      return '<tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d;white-space:nowrap"><strong>' + escHtml_(r[0]) + '</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4' + (approved && i === 1 ? ';font-family:monospace' : '') + '">' + escHtml_(r[1]) + '</td></tr>';
    }).join('') + '</table>' +
    '<p style="color:#66756f;font-size:13px;margin-top:12px">' + (approved ? 'You will be asked to choose a new password at your first sign-in.' : 'For clarification, contact the PG Coordinator at ' + escHtml_(mailEnquiriesAddress_()) + '.') + '</p>';
  return sendPortalMail_({ to: target.email, subject: head + ' — ' + target.regNumber + ' (' + CFG.APP_NAME + ')', body: text, htmlBody: html });
}

/** Branded account-created email (coordinator added a student directly). */
function notifyStudentAccountCreated_(p) {
  if (!p.email || !EMAIL_RE.test(String(p.email))) return false;
  var name = String((p.firstName || '') + ' ' + (p.surname || '')).trim() || p.regNumber;
  var rows = [['Registration number', p.regNumber], ['Name', name], ['One-time password', p.password], ['Programme', p.programme || '—']];
  var text = [CFG.APP_NAME + ' — portal account created', '', 'Dear ' + name + ',', '',
    'An account has been created for you by the PG Coordinator. You can now sign in to the portal.', '',
    'Registration number: ' + p.regNumber,
    'One-time password: ' + p.password, '',
    'For your security you will be asked to choose a new password at first sign-in.', '',
    'Open the portal Login page to sign in.'].join('\n');
  var html = '<h2 style="color:#14532d;margin:0 0 4px;font-size:18px">' + escHtml_(CFG.APP_NAME) + '</h2>' +
    '<p style="color:#66756f;margin:0 0 16px;font-size:13px">Portal account created</p>' +
    '<p style="margin:0 0 12px">Dear ' + escHtml_(name) + ', an account has been created for you by the PG Coordinator. You can now sign in to the portal.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">' +
    rows.map(function (r, i) {
      return '<tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d;white-space:nowrap"><strong>' + escHtml_(r[0]) + '</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4' + (i === 2 ? ';font-family:monospace' : '') + '">' + escHtml_(String(r[1] || '—')) + '</td></tr>';
    }).join('') +
    '</table><p style="color:#66756f;font-size:13px;margin-top:12px">For your security you will be asked to choose a new password at first sign-in. Open the portal Login page to sign in.</p>';
  return sendPortalMail_({ to: p.email, subject: 'Portal account created — ' + p.regNumber + ' (' + CFG.APP_NAME + ')', body: text, htmlBody: html });
}

/**
 * RUN THIS ONCE from the Apps Script editor (select "authorizeServices" in the
 * function dropdown -> Run) and accept every permission prompt. This grants the
 * script its Drive / Sheets / Mail / Cache scopes. Without it, the web app throws
 * "Exception: Access denied: DriveApp" when a registration tries to upload a photo.
 * After authorising, redeploy: Deploy -> Manage deployments -> Edit -> Version: New version.
 */
function authorizeServices() {
  var folderId = getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID);
  var folder = DriveApp.getFolderById(folderId);          // forces the Drive scope prompt
  var probe = folder.createFile('authorize-check.txt', 'ok');   // forces WRITE access
  try { probe.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) {
    Logger.log('WARNING: per-file link sharing is blocked (' + e.message + '). Uploads will still work. ' +
      'Share the passport FOLDER itself (Anyone with the link: Viewer) so photos are visible, or ask your Workspace admin to allow link sharing.');
  }
  probe.setTrashed(true);
  getSpreadsheet_().getName();                            // Sheets scope
  MailApp.getRemainingDailyQuota();                       // Mail scope
  try {                                                   // External-request scope + Drive API (large uploads)
    var pr = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (pr.getResponseCode() !== 200) Logger.log('WARNING: Drive API check returned ' + pr.getResponseCode() + '. Enable the Drive API service (Services +) or uploads over 10 MB will fail.');
  } catch (e) { Logger.log('WARNING: UrlFetchApp not authorised: ' + e); }
  Logger.log('Authorised OK. Drive folder: ' + folder.getName() + '. Now redeploy as a NEW VERSION.');
}

/**
 * RUN ONCE from the Apps Script editor to convert EXISTING rows: every raw URL in
 * Students.passportUrl / Submissions.driveFileUrls becomes a clickable "View passport" / "View file".
 * Safe to re-run (cells that are already links are skipped).
 */
function formatLinkColumns() {
  var converted = 0;
  Object.keys(LINK_COLUMNS).forEach(function (name) {
    var sheet = getSheet_(name), headers = sheetHeaders_(name), last = sheet.getLastRow();
    if (last < 2) return;
    Object.keys(LINK_COLUMNS[name]).forEach(function (field) {
      var ci = headers.indexOf(field);
      if (ci < 0) return;
      var rng = sheet.getRange(2, ci + 1, last - 1, 1);
      var vals = rng.getValues(), rts = rng.getRichTextValues();
      for (var i = 0; i < vals.length; i++) {
        if (richTextUrls_(rts[i][0]).length) continue;           // already a link
        var urls = urlsFromText_(vals[i][0]);
        if (!urls.length) continue;
        writeLinkCell_(sheet, i + 2, ci, urls.join(' '), LINK_COLUMNS[name][field]);
        converted++;
      }
    });
  });
  invalidateTable_('Students'); invalidateTable_('Submissions');
  Logger.log('formatLinkColumns: converted ' + converted + ' cell(s).');
}


/** Optional admission letter (PDF/JPG/PNG, up to 3 MB). Not public: only the PG Coordinator(s) and HoD get view access in Drive. */
function saveAdmissionLetter_(filePayload, regNumber) {
  var parts = String(filePayload.dataUrl).split(','), mm = parts[0].match(/data:(.*?);/), mime = mm ? mm[1] : '';
  var ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[mime];
  if (!ext) throw new Error('The admission letter must be a PDF, JPG or PNG file.');
  var bytes = Utilities.base64Decode(parts[1] || '');
  if (bytes.length > 3 * 1024 * 1024) throw new Error('The admission letter must be under 3 MB.');
  try {
    var root = DriveApp.getFolderById(getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID)), it = root.getFoldersByName('Admission Letters');
    var folder = it.hasNext() ? it.next() : root.createFolder('Admission Letters');
    var file = folder.createFile(Utilities.newBlob(bytes, mime, String(regNumber).replace(/[\/\\]/g, '-') + '_admission_' + new Date().getTime() + '.' + ext));
    readTable_('Users').forEach(function (u) {
      if ((u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active) && EMAIL_RE.test(String(u.email || ''))) { try { grantFileRole_(file.getId(), u.email, 'reader'); } catch (e) {} }
    });
    return { id: file.getId(), url: file.getUrl() };
  } catch (e) {
    Logger.log('saveAdmissionLetter_ failed: ' + e);
    throw new Error('Could not save the admission letter. Please try again, or register without it and give it to the PG Coordinator.');
  }
}
/** Possible duplicates among registered students: same phone number, or the same first name + surname. */
function dupFlags_(stu, all) {
  var flags = [];
  if (!stu || !stu.regNumber) return flags;
  var nm = (String(stu.firstName || '') + '|' + String(stu.surname || '')).toLowerCase();
  (all || []).forEach(function (o) {
    if (String(o.regNumber) === String(stu.regNumber)) return;
    if (stu.phoneNumber && String(o.phoneNumber) === String(stu.phoneNumber)) flags.push('Same phone number as ' + o.regNumber);
    else if ((String(o.firstName || '') + '|' + String(o.surname || '')).toLowerCase() === nm) flags.push('Same name as ' + o.regNumber);
  });
  return flags.slice(0, 3);
}

/* ---- passport photo privacy (OPT-IN). Default "public" keeps today's behaviour (anyone with the link can view the photo).
 *      Set PASSPORT_PRIVACY = private in the Config tab, then run restrictExistingPassports() once: photos are no longer link-shared
 *      and the portal itself serves them to people allowed to see the student. ---- */
function passportPrivate_() { try { return String(getSetting_('PASSPORT_PRIVACY', 'public')).toLowerCase() === 'private'; } catch (e) { return false; } }
function api_getPhotos(token, ids) {
  var user = requireUser_(token), want = (ids || []).slice(0, 8).map(String), allowed = {};
  readTable_('Students').forEach(function (st) {
    if (!st.passportFileId) return;
    var ok = user.role === 'Student' ? String(st.regNumber) === String(user.regNumber)
      : user.role === 'Staff' ? supOf_(user, st) : ['PG_Coordinator', 'HoD', 'SuperAdmin'].indexOf(user.role) > -1;
    if (ok) allowed[String(st.passportFileId)] = 1;
  });
  var out = {}, cache = CacheService.getScriptCache();
  want.forEach(function (id) {
    if (!allowed[id]) return;
    var hit = cache.get('ph_' + id); if (hit) { out[id] = hit; return; }
    try {
      var blob = DriveApp.getFileById(id).getBlob(), data = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
      out[id] = data; if (data.length < 95000) cache.put('ph_' + id, data, 21600);
    } catch (e) { Logger.log('photo ' + id + ': ' + e); }
  });
  return out;
}
/** RUN ONCE after setting PASSPORT_PRIVACY = private: removes link sharing from every existing passport photo. */
function restrictExistingPassports() {
  var n = 0, t0 = Date.now();
  readTable_('Students').forEach(function (st) {
    if (!st.passportFileId || Date.now() - t0 > 270000) return;
    try { DriveApp.getFileById(st.passportFileId).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); n++; } catch (e) { Logger.log('restrict ' + st.regNumber + ': ' + e); }
  });
  Logger.log('Passport photos made private: ' + n);
  return n;
}
/** RUN ONCE before go-live: removes the seeded demo accounts from the sheet.
 *  Accounts are matched on the EMAIL only (demo.*@…), never on the password:
 *  real logins can still sit on the default password, and deleting those would
 *  destroy live accounts.
 *    removeDemoAccounts()              -> DRY RUN, nothing is written (default)
 *    removeDemoAccounts(false)         -> deletes the logins + demo students
 *    removeDemoAccounts(false, false)  -> deletes the logins only
 *  The demo student rows (Students tab) go with the accounts; the Staff tab is
 *  never touched (its rows carry real @uniabuja.edu.ng addresses). Submissions,
 *  announcements and the other tabs are left alone — they are only reported. */
function removeDemoAccounts(dryRun, withStudents) {
  if (dryRun === undefined) dryRun = true;
  if (withStudents === undefined) withStudents = true;
  var isDemo = function (v) { return /^demo[._-]/i.test(String(v || '').trim().split('@')[0]); };

  var plan = [];
  (withStudents ? ['Users', 'Students'] : ['Users']).forEach(function (tab) {
    readTableSafe_(tab).forEach(function (r) {
      if (isDemo(r.email)) plan.push({ tab: tab, row: r._row, id: r.id, reg: String(r.regNumber || ''), email: String(r.email || ''), role: String(r.role || '') });
    });
  });
  var removedIds = {}, removedRegs = {};
  plan.forEach(function (p) { removedIds[p.id] = 1; if (p.reg) removedRegs[p.reg] = 1; });

  if (plan.length && !dryRun) {
    withScriptLock_(function () {
      plan.slice().sort(function (a, b) { return a.tab === b.tab ? b.row - a.row : (a.tab < b.tab ? -1 : 1); })
        .forEach(function (p) {
          getSheet_(p.tab).deleteRow(p.row);
          invalidateTable_(p.tab);
          logAudit_('', 'go-live', 'REMOVE_DEMO_ACCOUNT', p.reg || p.id, p.tab + ': ' + p.email);
        });
    }, 30000);
  }

  // anything else that still points at the removed accounts — reported, not deleted
  var others = [];
  Object.keys(HEADERS).forEach(function (tab) {
    if (plan.some(function (p) { return p.tab === tab; })) return;
    readTableSafe_(tab).forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (k === '_row') return;
        var v = String(r[k] === undefined || r[k] === null ? '' : r[k]);
        if (!v) return;
        if (removedIds[v] || (removedRegs[v] && /reg/i.test(k))) others.push(tab + '.' + k + '=' + v);
      });
    });
  });
  others = others.filter(function (o) { return o.indexOf('AuditLog.action=REMOVE_DEMO_ACCOUNT') === -1; });

  var msg = 'removeDemoAccounts' + (dryRun ? ' (DRY RUN — nothing written)' : '') + ': ' + plan.length + ' row(s) matched — ' +
    (plan.map(function (p) { return p.tab + ':' + p.email; }).join(', ') || 'none') +
    (others.length ? '. Still referencing them (left alone): ' + others.join(', ') : '. Nothing else references them.');
  Logger.log(msg);
  return { dryRun: !!dryRun, matched: plan.map(function (p) { return p.tab + ':' + p.email; }), stillReferenced: others };
}



function savePassportPhoto_(filePayload, regNumber) {
  var parts = String(filePayload.dataUrl).split(',');
  var mimeMatch = parts[0].match(/data:(.*?);/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  if (['image/jpeg', 'image/png'].indexOf(mime) === -1) throw new Error('Passport must be JPG or PNG.');
  var bytes = Utilities.base64Decode(parts[1]);
  if (bytes.length > CFG.UPLOAD_MAX_BYTES) throw new Error('Passport photo must be under 1 MB.');
  var ext = mime === 'image/png' ? 'png' : 'jpg';
  var blob = Utilities.newBlob(bytes, mime, regNumber.replace(/[\/\\]/g, '-') + '_passport_' + new Date().getTime() + '.' + ext);
  try {
    var folderId = getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID);
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    if (!passportPrivate_()) {
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
      catch (shareErr) { Logger.log('Passport sharing failed (file still saved): ' + shareErr); }
    }
    return { id: file.getId(), url: file.getUrl() };
  } catch (e) {
    Logger.log('savePassportPhoto_ failed: ' + e);
    var m = String((e && e.message) || e);
    if (/access denied|authori[sz]ation|permission/i.test(m)) {
      throw new Error('Passport upload is not available right now (the portal\u2019s Drive permission has not been authorised). ' +
        'Please contact ' + mailEnquiriesAddress_() + ' and try again later.');
    }
    throw new Error('Could not save the passport photo: ' + m);
  }
}

/* =========================== 7. STAFF & SUPERVISORS =========================== */

function api_listStaff(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD', 'Staff', 'Submission_Inspector'], 'You cannot view the staff list.');
  return filterWhere_('Staff', function (s) { return toBool_(s.active); })
    .map(function (s) { return { id: s.id, fullName: s.fullName, email: s.email, rank: s.rank, specialisation: s.specialisation }; });
}

function api_saveStaff_locked_(token, payload) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot manage staff.');
  if (!payload || !payload.fullName) throw new Error('Full name is required.');
  var staffEmail = cleanEmail_(payload.email);
  if (staffEmail && !validateEmail_(staffEmail)) throw new Error('Invalid email address. Use the form name@example.com.');
  var fields = {
    fullName: String(payload.fullName).trim(),
    email: staffEmail,
    rank: String(payload.rank || '').trim(),
    specialisation: String(payload.specialisation || '').trim(),
    active: payload.active !== false
  };
  if (payload.id) { updateRow_('Staff', payload.id, fields); return { id: payload.id }; }
  fields.createdAt = nowIso_();
  var row = appendRow_('Staff', fields);
  logAudit_(user.id, user.regNumber, 'ADD_STAFF', row.id, fields.fullName);
  return { id: row.id };
}
function api_saveStaff() { var a = arguments; return withScriptLock_(function () { return api_saveStaff_locked_.apply(null, a); }, 30000); }

/* ==================== 7b. COORDINATOR: ADD/REMOVE STAFF & STUDENTS + IMPORT ==================== */

/** Delete matching rows from a sheet (row-delete helper the coordinator removals need). */
function removeWhere_(name, predicate) {
  return withScriptLock_(function () {
    var sheet = getSheet_(name), headers = sheetHeaders_(name);
    var values = sheet.getDataRange().getValues();
    var removed = 0;
    for (var i = values.length - 1; i >= 1; i--) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = sheetCellValue_(values[i][c]);
      if (predicate(obj)) { sheet.deleteRow(i + 1); removed++; }
    }
    if (removed) invalidateTable_(name);
    return removed;
  }, 30000);
}

function api_removeStaff_locked_(token, staffId) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can remove staff.');
  var staff = findById_('Staff', staffId);
  if (!staff) throw new Error('Staff member not found.');
  if (String(staffId) === String(user.id)) throw new Error('You cannot remove your own staff record.');
  var affected = filterWhere_('Students', function (s) {
    return String(s.mainSupervisorId) === String(staffId) || String(s.coSupervisorId) === String(staffId);
  });
  affected.forEach(function (s) {
    updateRow_('Students', s.id, {
      mainSupervisorId: String(s.mainSupervisorId) === String(staffId) ? '' : s.mainSupervisorId,
      coSupervisorId: String(s.coSupervisorId) === String(staffId) ? '' : s.coSupervisorId,
      updatedAt: nowIso_()
    });
  });
  removeWhere_('Staff', function (r) { return String(r.id) === String(staffId); });
  var email = String(staff.email || '').toLowerCase();
  var deactivated = 0;
  if (email) {
    filterWhere_('Users', function (u) {
      return String(u.email || '').toLowerCase() === email && toBool_(u.active) &&
        String(u.id) !== String(user.id) && u.role !== 'PG_Coordinator' && u.role !== 'HoD';
    }).forEach(function (u) { updateRow_('Users', u.id, { active: false }); deactivated++; });
  }
  logAudit_(user.id, user.regNumber, 'REMOVE_STAFF', String(staffId),
    staff.fullName + (affected.length ? ' · unassigned from ' + affected.length + ' student(s)' : '') +
    (deactivated ? ' · login deactivated' : ''));
  return { ok: true, unassigned: affected.length, loginsDeactivated: deactivated };
}
function api_removeStaff() { var a = arguments; return withScriptLock_(function () { return api_removeStaff_locked_.apply(null, a); }, 30000); }

/** Validates one student record and creates the Students + Users rows. The account is Approved and gets a random one-time
 *  password. Shared by "Add Student" and the CSV import. Returns what is needed to email the student. */
function createStudentAccount_(actor, payload, auditNote) {
  if (!payload) throw new Error('Missing form data.');
  var reg = String(payload.regNumber || '').trim();
  if (!validateRegNumber_(reg)) throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
  payload.firstName = toTitleCase_(payload.firstName);
  payload.otherNames = toTitleCase_(payload.otherNames);
  if (!validateName_(payload.surname)) throw new Error('Surname must be at least 2 letters.');
  if (!validateName_(payload.firstName)) throw new Error('First name must be at least 2 letters (letters, hyphen and apostrophe only).');
  if (payload.otherNames && !validateName_(payload.otherNames)) throw new Error('Other names may contain letters, spaces, hyphens and apostrophes only.');
  var email = cleanEmail_(payload.email);
  if (!validateEmail_(email)) throw new Error('Invalid email address. Use the form name@example.com.');
  var phone = validatePhone_(payload.phoneNumber);
  if (!phone) throw new Error('Invalid phone number. Use a Nigerian mobile number such as 08012345678.');
  if (CFG.PROGRAMMES.indexOf(payload.programme) === -1) throw new Error('Invalid programme.');
  if (CFG.SPECIALISATIONS.indexOf(payload.specialisation) === -1) throw new Error('Invalid specialisation.');
  if (['Male', 'Female'].indexOf(payload.gender) === -1) throw new Error('Gender must be Male or Female.');
  var fd = resolveFacDep_(payload.faculty, payload.department);
  var year = academicYearFromReg_(reg) || new Date().getFullYear();   // always derived from the registration number
  if (findWhere_('Users', function (u) { return String(u.regNumber) === reg; })) throw new Error('Registration number already exists.');
  if (findWhere_('Users', function (u) { return String(u.email || '').toLowerCase() === email; })) throw new Error('That email address is already used by another account.');
  var pw = genTempPassword_(), salt = makeSalt_(), now = nowIso_();
  appendRow_('Students', {
    regNumber: reg, surname: String(payload.surname).trim(), firstName: String(payload.firstName).trim(), otherNames: String(payload.otherNames || '').trim(),
    gender: payload.gender, phoneNumber: phone, email: email, faculty: fd.faculty, department: fd.department,
    programme: payload.programme, specialisation: payload.specialisation, passportFileId: '', passportUrl: '',
    mainSupervisorId: '', coSupervisorId: '', currentStage: '1 - Admission', yearOfAdmission: year, createdAt: now, updatedAt: now
  });
  appendRow_('Users', {
    regNumber: reg, email: email, passwordHash: hashPassword_(pw, salt), salt: salt, role: 'Student',
    fullName: String(payload.firstName).trim() + ' ' + String(payload.surname).trim(), firstLogin: true, active: true, status: 'Approved', createdAt: now
  });
  logAudit_(actor.id, actor.regNumber, 'ADD_STUDENT', reg, (auditNote || 'Student added directly by coordinator') + ': ' + payload.firstName + ' ' + payload.surname);
  return { regNumber: reg, email: email, firstName: String(payload.firstName).trim(), surname: String(payload.surname).trim(), programme: payload.programme, password: pw };
}

function api_addStudent_locked_(token, payload) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can add students.');
  var made = createStudentAccount_(user, payload);
  var sent = false;
  try { sent = notifyStudentAccountCreated_(made); } catch (mailErr) { Logger.log('addStudent mail failed for ' + made.regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true, regNumber: made.regNumber, emailed: !!sent, message: sent ? 'Student added. Sign-in details sent to ' + made.email + '.' : 'Student added, but the email could not be sent. Use Reset PW to send sign-in details again.' };
}
function api_addStudent() { var a = arguments; return withScriptLock_(function () { return api_addStudent_locked_.apply(null, a); }, 30000); }

/* ---- CSV import of students (PG Coordinator) ---- */
var STUDENT_IMPORT_MAX = 60;
var STUDENT_IMPORT_ALIASES = {
  regNumber: ['reg', 'regnumber', 'regno', 'registrationnumber', 'matricnumber', 'matricno', 'regnum'], surname: ['surname', 'lastname', 'familyname'],
  firstName: ['firstname', 'givenname', 'forename'], otherNames: ['othernames', 'othername', 'middlename', 'middlenames'], gender: ['gender', 'sex'],
  phoneNumber: ['phonenumber', 'phone', 'mobile', 'phoneno', 'mobilenumber'], email: ['email', 'emailaddress', 'mail'],
  faculty: ['faculty'], department: ['department', 'dept'], programme: ['programme', 'program'], specialisation: ['specialisation', 'specialization']
};
function parseCsv_(text) {
  var s = String(text || '').replace(/^\uFEFF/, ''), first = s.split(/\r?\n/)[0] || '';
  var delim = ',', best = (first.match(/,/g) || []).length;
  [';', '\t'].forEach(function (d) { var n = first.split(d).length - 1; if (n > best) { best = n; delim = d; } });
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (q) { if (c === '"') { if (s.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s.charAt(i + 1) === '\n') i++; row.push(cur); cur = ''; if (row.join('').trim() !== '') rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.join('').trim() !== '') rows.push(row);
  return rows;
}
/** Default faculty/department for rows that leave them blank: Faculty of Physical Sciences / Physics. */
function defaultFacDep_() {
  var d = readFacDep_(), f = FACULTY_PHYSICAL_SCIENCES, depts = d.map[f] || [], dep = '';
  depts.forEach(function (x) { if (!dep && /^physics$/i.test(x)) dep = x; });
  depts.forEach(function (x) { if (!dep && /physics/i.test(x)) dep = x; });
  return { faculty: f, department: dep };
}
function matchList_(list, v) { var k = String(v || '').trim().toLowerCase(), hit = ''; list.forEach(function (x) { if (x.toLowerCase() === k) hit = x; }); return hit; }
function api_importStudents_l(token, csvText) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can import students.');
  var table = parseCsv_(csvText);
  if (table.length < 2) throw new Error('The file needs a header row and at least one student row.');
  var head = table[0].map(normKey_), map = {};
  Object.keys(STUDENT_IMPORT_ALIASES).forEach(function (f) {
    for (var c = 0; c < head.length; c++) if (STUDENT_IMPORT_ALIASES[f].indexOf(head[c]) !== -1) { map[f] = c; return; }
  });
  ['regNumber', 'surname', 'firstName', 'gender', 'phoneNumber', 'email', 'programme', 'specialisation'].forEach(function (f) {
    if (map[f] === undefined) throw new Error('Column missing from the file: ' + f + '. Download the template to see the expected columns.');
  });
  var rows = table.slice(1);
  if (rows.length > STUDENT_IMPORT_MAX) throw new Error('Import at most ' + STUDENT_IMPORT_MAX + ' students at a time (this file has ' + rows.length + '). Split it into smaller files.');
  var dflt = defaultFacDep_(), added = [], failed = [], emailed = 0;
  rows.forEach(function (r, i) {
    var cell = function (f) { return map[f] === undefined ? '' : String(r[map[f]] === undefined ? '' : r[map[f]]).trim(); };
    var line = i + 2, reg = cell('regNumber').replace(/^UA\/PG/i, 'UA/pg');
    try {
      var g = cell('gender').toLowerCase();
      var made = createStudentAccount_(user, {
        regNumber: reg, surname: cell('surname'), firstName: cell('firstName'), otherNames: cell('otherNames'),
        gender: g === 'male' || g === 'm' ? 'Male' : (g === 'female' || g === 'f' ? 'Female' : cell('gender')),
        phoneNumber: cell('phoneNumber'), email: cell('email'),
        faculty: cell('faculty') || dflt.faculty, department: cell('department') || dflt.department,
        programme: matchList_(CFG.PROGRAMMES, cell('programme')) || cell('programme'),
        specialisation: matchList_(CFG.SPECIALISATIONS, cell('specialisation')) || cell('specialisation')
      }, 'Imported from CSV');
      added.push({ regNumber: made.regNumber, name: made.firstName + ' ' + made.surname });
      try { if (notifyStudentAccountCreated_(made)) emailed++; } catch (e) { Logger.log('import mail ' + made.regNumber + ': ' + e); }
    } catch (e) { failed.push({ row: line, regNumber: reg, error: String((e && e.message) || e) }); }
  });
  logAudit_(user.id, user.regNumber, 'IMPORT_STUDENTS', 'Students', added.length + ' added, ' + failed.length + ' failed');
  return { ok: true, added: added, failed: failed, emailed: emailed };
}
function api_importStudents() { return L_(api_importStudents_l, arguments); }

function api_removeStudent_locked_(token, regNumber) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can remove students.');
  var reg = String(regNumber || '').trim();
  if (String(reg) === String(user.regNumber)) throw new Error('You cannot remove your own record.');
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === reg; });
  var account = findWhere_('Users', function (u) { return String(u.regNumber) === reg; });
  if (!student && !account) throw new Error('Student not found.');
  var removedSubs = removeWhere_('Submissions', function (r) { return String(r.regNumber) === reg; });
  if (student) removeWhere_('Students', function (r) { return String(r.regNumber) === reg; });
  if (account) removeWhere_('Users', function (r) { return String(r.regNumber) === reg; });
  var name = student ? fullNameOf_(student) : (account ? account.fullName : reg);
  logAudit_(user.id, user.regNumber, 'REMOVE_STUDENT', reg,
    'Removed ' + name + (removedSubs ? ' · ' + removedSubs + ' submission(s) removed' : ''));
  return { ok: true, message: name + ' removed.' };
}
function api_removeStudent() { var a = arguments; return withScriptLock_(function () { return api_removeStudent_locked_.apply(null, a); }, 30000); }

/* ---- Sheet-driven staff import — the Staff tab is the source of truth ----
 * Paste the roster (e.g. an exported staff list) into the Staff tab and run
 * importStaff() from the Apps Script editor. Column headers are matched
 * fuzzily and renamed to the canonical Staff fields; roles are normalised;
 * ACA staff get portal logins with a random one-time password that is emailed to them
 * (firstLogin forces a change at sign-in). */

var STAFF_HEADER_ALIASES = {
  id: ['id', 'staff id', 'staff code', 'staff no', 'staff number', 'aca no', 'aca number'],
  fullName: ['name', 'full name', 'staff name', 'fullname', 'name of staff'],
  email: ['email', 'email address', 'e mail', 'mail', 'official email'],
  rank: ['rank', 'title', 'position', 'designation', 'grade'],
  specialisation: ['specialisation', 'specialization', 'speciality', 'specialty', 'research area', 'area of specialisation', 'area of specialization'],
  role: ['role', 'portal role', 'user role', 'access role'],
  active: ['active', 'is active', 'status', 'enabled'],
  createdAt: ['created at', 'created', 'date created', 'date added', 'date joined', 'joined']
};
var STAFF_ROLE_ALIASES = {
  'pg coordinator': 'PG_Coordinator', 'coordinator': 'PG_Coordinator',
  'hod': 'HoD', 'head of department': 'HoD', 'head department': 'HoD',
  'submission inspector': 'Submission_Inspector', 'compliance inspector': 'Submission_Inspector',
  'compliance': 'Submission_Inspector', 'inspector': 'Submission_Inspector',
  'staff': 'Staff', 'lecturer': 'Staff', 'supervisor': 'Staff', 'academic': 'Staff',
  'student': 'Student'
};
/** Lowercase + strip punctuation: "e-mail ", "Full_Name" → "e mail" / "full name". */
function normHeader_(v) {
  return String(v === undefined || v === null ? '' : v).toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Header-matching key: normHeader_ without spaces, so "createdAt", "created at"
 *  and "Created-At" all collapse to "createdat" and hit the same alias. */
function normKey_(v) { return normHeader_(v).replace(/ /g, ''); }
/** Map a free-text role note ("PG Coordinator", "Compliance Inspector", "HoD")
 *  onto CFG.ROLES; null when the value is not a role at all (e.g. "Dr.", a
 *  specialisation, a phone number). Exact alias table first, then substrings. */
function normalizeRole_(v) {
  var n = normHeader_(v);
  if (!n) return null;
  if (STAFF_ROLE_ALIASES[n]) return STAFF_ROLE_ALIASES[n];
  if (n.indexOf('coordinator') !== -1) return 'PG_Coordinator';
  if (n.indexOf('head of dep') !== -1 || n.indexOf('head dept') !== -1 || n === 'hod') return 'HoD';
  if (n.indexOf('inspector') !== -1) return 'Submission_Inspector';
  if (n.indexOf('academic') !== -1 || n.indexOf('lecturer') !== -1 || n.indexOf('supervisor') !== -1) return 'Staff';
  return null;
}
/** Derive a Staff.rank from the person's name when the tab has no rank column:
 *  "Prof. A.D.A Buba" → Professor; "Dr. …" → Dr.; "Mr./Mrs./Ms./Engr. …" kept. */
function staffRankFromName_(name) {
  var n = String(name || '').trim();
  if (/^(professor|prof)\.?\b/i.test(n)) return 'Professor';
  if (/^dr\.?\b/i.test(n)) return 'Dr.';
  if (/^engr\.?\b/i.test(n)) return 'Engr.';
  var m = /^(mr|mrs|ms|miss)\.?\b/i.exec(n);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + '.';
  return '';
}
/** Parse an "active" cell: true/false/'yes'/'no'/'inactive'…; null = blank
 *  (the importer treats blank as ACTIVE — a freshly pasted roster is live). */
function staffActiveValue_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (v === true || v === false) return v;
  if (typeof v === 'number') return v !== 0;
  var n = normHeader_(v);
  if (n === 'false' || n === '0' || n === 'no' || n === 'inactive' || n === 'disabled') return false;
  if (n === 'true' || n === '1' || n === 'yes' || n === 'active' || n === 'enabled') return true;
  return null;
}
function colLetter_(i) { return String.fromCharCode(65 + Math.max(0, Math.min(25, i))); }

/** Match the Staff tab's header row (and, by values, its role column) onto the
 *  canonical Staff fields. Non-destructive: renames happen later in importStaff.
 *  Returns { map, warnings, demoteCi? } — demoteCi is a header cell to blank
 *  because its column lost the "role" name to a value-detected role column. */
function detectStaffColumns_(headersRaw, values) {
  var canon = ['id', 'fullName', 'email', 'rank', 'specialisation', 'role', 'active', 'createdAt'];
  var map = {}, used = {}, warnings = [], demoteCi;
  if (headersRaw.some(function (c) { return validateStaffId_(String(c || '').trim().toUpperCase()); })) {
    throw new Error('The Staff tab\u2019s FIRST ROW looks like data (an ACA staff ID), not headers. ' +
      'Insert a header row on top — e.g. id, fullName, email, role — so the column names survive the paste, then re-run importStaff().');
  }
  var aliasNorm = {};
  canon.forEach(function (f) { aliasNorm[f] = (STAFF_HEADER_ALIASES[f] || []).map(normKey_); });
  headersRaw.forEach(function (h, ci) {
    var nk = normKey_(h);
    if (!nk) return;
    for (var i = 0; i < canon.length; i++) {
      var f = canon[i];
      if (map[f] === undefined && aliasNorm[f].indexOf(nk) !== -1) { map[f] = ci; used[ci] = f; return; }
    }
  });
  // Positional fallback (A=id, B=fullName, C=email) — only into EMPTY-header columns.
  [['id', 0], ['fullName', 1], ['email', 2]].forEach(function (pair) {
    var f = pair[0], ci = pair[1];
    if (map[f] !== undefined || used[ci] || ci >= headersRaw.length) return;
    if (String(headersRaw[ci] || '').trim() !== '') return;
    map[f] = ci; used[ci] = f;
    warnings.push('Unnamed column ' + colLetter_(ci) + ' treated as ' + f + '.');
  });
  // Role column by values (>=75% of non-empty cells map to a known role). Runs when
  // there is NO role header, or when the role column exists but is EMPTY - a pasted
  // role note that landed in a free-text column (e.g. specialisation) then wins.
  var roleHeaderCi = map.role, headerRoleEmpty = true;
  if (roleHeaderCi !== undefined) {
    for (var r = 1; r < values.length; r++) {
      var rv = values[r][roleHeaderCi];
      if (rv !== '' && rv !== null && rv !== undefined) { headerRoleEmpty = false; break; }
    }
  }
  if (headerRoleEmpty) {
    var best = -1, bestCi = -1;
    for (var ci = 0; ci < headersRaw.length; ci++) {
      if (used[ci] && used[ci] !== 'rank' && used[ci] !== 'specialisation') continue;
      var nonEmpty = 0, roleish = 0;
      for (var r = 1; r < values.length; r++) {
        var v = values[r][ci];
        if (v === '' || v === null || v === undefined) continue;
        nonEmpty++;
        if (normalizeRole_(v)) roleish++;
      }
      if (nonEmpty && roleish / nonEmpty >= 0.75 && roleish / nonEmpty > best) { best = roleish / nonEmpty; bestCi = ci; }
    }
    if (bestCi !== -1) {
      var was = used[bestCi];
      if (was) { delete map[was]; warnings.push('Column ' + colLetter_(bestCi) + ' contains roles \u2014 used as the role column instead of "' + was + '".'); }
      else warnings.push('Column ' + colLetter_(bestCi) + ' (' + (String(headersRaw[bestCi] || '').trim() || 'blank header') + ') treated as role.');
      if (roleHeaderCi !== undefined && roleHeaderCi !== bestCi) demoteCi = roleHeaderCi;   // old empty role column loses its header
      map.role = bestCi; used[bestCi] = 'role';
    }
  }
  // A "rank" column that actually holds phone numbers (pasted phone column landing
  // on rank) → unmap it; rank is then derived from each name.
  if (map.rank !== undefined) {
    var nonEmpty = 0, phoneish = 0;
    for (var r = 1; r < values.length; r++) {
      var cell = values[r][map.rank];
      if (cell === '' || cell === null || cell === undefined) continue;
      nonEmpty++;
      var digits = String(cell).replace(/[^0-9]/g, '');
      if (digits.length >= 7 && digits.length <= 15 && String(cell).indexOf('@') === -1) phoneish++;
    }
    if (nonEmpty && phoneish / nonEmpty >= 0.75) {
      var rankCi = map.rank;
      delete map.rank;
      warnings.push('Column ' + colLetter_(rankCi) + ' holds phone numbers \u2014 not stored; rank is derived from names.');
    }
  }
  headersRaw.forEach(function (h, ci) {
    if (!used[ci]) warnings.push('Column ' + colLetter_(ci) + ' (' + (String(h || '').trim() || 'blank header') + ') is not stored \u2014 no matching Staff field.');
  });
  return { map: map, warnings: warnings, demoteCi: demoteCi };
}

/**
 * SHEET-DRIVEN STAFF IMPORT — the Staff tab is the source of truth. Run from
 * the Apps Script editor (no arguments): importStaff()
 *
 * 1. Matches the tab's headers fuzzily onto the Staff fields (id, fullName,
 *    email, rank, specialisation, role, active, createdAt) and renames the
 *    matched cells to those canonical names — so a straight paste of an
 *    exported roster (Id | name | email | Phone | role-note) just works.
 * 2. Normalises each row: rank derived from the name when missing, active
 *    blank → TRUE, role notes ("PG Coordinator", "HoD", "Compliance
 *    Inspector") mapped onto CFG.ROLES.
 * 3. Reconciles Users logins for every ACA staff ID: creates missing logins
 *    with a random one-time password that is emailed (firstLogin forces a
 *    password change), syncs fullName/email/role, reactivates, and finally
 *    deactivates ACA logins that the Staff tab no longer backs (PG_Coordinator
 *    / HoD accounts are NEVER deactivated — a warning is raised instead).
 *
 * Idempotent: re-running against an unchanged tab makes no writes.
 */
function importStaff() {
  return withScriptLock_(function () { return importStaff_locked_(); }, 60000);
}
function importStaff_locked_() {
  var now = nowIso_();
  var sheet = getSheet_('Staff');
  var values = sheet.getDataRange().getValues();
  var headersRaw = (values[0] || []).map(function (h) { return String(h); });
  var summary = {
    ok: true, rows: 0, staffRowsCreated: 0, staffRowsUpdated: 0,
    loginsCreated: 0, loginsEmailed: 0, loginsSynced: 0, loginsReactivated: 0, loginsDeactivated: 0,
    skipped: [], warnings: []
  };
  var hasData = values.length >= 2 && values.slice(1).some(function (r) {
    return r.join('').toString().replace(/\s/g, '') !== '';
  });
  if (!hasData) {
    summary.warnings.push('The Staff tab has no data rows \u2014 nothing imported.');
    logImportSummary_(summary);
    return summary;
  }

  var det = detectStaffColumns_(headersRaw, values);   // throws if row 1 is data
  var map = det.map;
  summary.warnings = det.warnings;

  // 1. Rename matched header cells to the canonical field names.
  Object.keys(map).forEach(function (f) {
    var ci = map[f];
    if (String(sheet.getRange(1, ci + 1).getValue()) !== f) sheet.getRange(1, ci + 1).setValue(f);
  });
  if (det.demoteCi !== undefined && String(sheet.getRange(1, det.demoteCi + 1).getValue()) !== '') {
    sheet.getRange(1, det.demoteCi + 1).setValue('');   // vacated role header; sheetHeaders_ recycles the column
  }
  invalidateTable_('Staff');
  var headers = sheetHeaders_('Staff');   // appends any missing canonical columns (incl. role)
  var rows = readTable_('Staff');
  summary.rows = rows.length;

  var roleColFound = map.role !== undefined;
  if (!roleColFound) summary.warnings.push('No role column found \u2014 every row defaults to role "Staff".');
  var warnedOnce = {};
  var warnOnce = function (msg) { if (!warnedOnce[msg]) { warnedOnce[msg] = 1; summary.warnings.push(msg); } };
  // Field accessor reads ONLY mapped columns — an unmapped canonical field (e.g. a
  // "rank" column that turned out to hold phone numbers) contributes nothing.
  var presentAca = {};

  // 2. Normalise + upsert every roster row in place (by physical row number).
  rows.forEach(function (row) {
    var fld = function (f) {
      if (map[f] === undefined) return '';
      var v = row[f];
      return String(v === undefined || v === null ? '' : v).trim();
    };
    var rawId = fld('id');
    var id = rawId.toUpperCase();
    var name = fld('fullName');
    var email = fld('email');
    var role = roleColFound ? (normalizeRole_(fld('role')) || 'Staff') : 'Staff';
    if (roleColFound && fld('role') && !normalizeRole_(fld('role'))) {
      warnOnce('Unrecognised role "' + fld('role') + '" (row ' + row._row + ') \u2014 defaults to Staff.');
    }
    var activeVal = staffActiveValue_(map.active === undefined ? '' : row.active);
    var active = activeVal === null ? true : activeVal;
    var idIsAca = validateStaffId_(id);
    if (idIsAca) presentAca[id] = active;   // even for rows skipped below (never deactivate on a bad name)

    if (name.length < 2) { summary.skipped.push({ row: row._row, id: id || '(blank)', reason: 'Missing name' }); return; }
    if (id && !idIsAca && !/^Stf\d+$/.test(id)) {
      summary.skipped.push({ row: row._row, id: id, reason: 'Bad staff ID (expected ACA + 3\u20134 digits, or Stf##)' });
      return;
    }
    var hadId = rawId !== '';
    if (!hadId) {
      id = nextId_('Staff');
      summary.warnings.push('Row ' + row._row + ' (' + name + ') has no staff ID \u2014 assigned ' + id + '; portal logins need an ACA ID.');
    }

    var want = {
      id: id,
      fullName: name,
      email: email,
      rank: fld('rank') || staffRankFromName_(name),
      specialisation: fld('specialisation'),
      active: active,
      createdAt: fld('createdAt') || now,
      role: role
    };
    var patch = {};
    Object.keys(want).forEach(function (f) {
      var cur = row[f];
      var same = f === 'active'
        ? !(cur === '' || cur === undefined || cur === null) && toBool_(cur) === active
        : String(cur === undefined || cur === null ? '' : cur).trim() === String(want[f]);
      if (!same) patch[f] = want[f];
    });
    if (Object.keys(patch).length) {
      writeRowPatch_(sheet, headers, row._row, patch);
      invalidateTable_('Staff');
      if (patch.id && !hadId) summary.staffRowsCreated++; else summary.staffRowsUpdated++;
    }
    if (idIsAca) {
      row.__importId = id;
      row.__importName = name;
      row.__importEmail = email;
      row.__importRole = role;
    }
  });

  // 3. Reconcile portal logins for every valid ACA roster row.
  rows.forEach(function (row) {
    var id = row.__importId;
    if (!id) return;
    var name = row.__importName, email = row.__importEmail, role = row.__importRole;
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === id; });
    if (!u) {
      if (!validateEmail_(email)) { summary.skipped.push({ id: id, reason: 'No login created \u2014 missing/invalid email' }); return; }
      if (findWhere_('Users', function (x) { return String(x.email || '').toLowerCase() === email.toLowerCase(); })) {
        summary.warnings.push('No login for ' + id + ' \u2014 email ' + email + ' already belongs to another account.');
        return;
      }
      var salt = makeSalt_(), tempPw = genTempPassword_();
      appendRow_('Users', {
        regNumber: id, email: email,
        passwordHash: hashPassword_(tempPw, salt), salt: salt,
        role: role, fullName: name, firstLogin: true, active: true, status: 'Approved', createdAt: now
      });
      summary.loginsCreated++;
      if (notifyStaffLogin_(email, name, id, role, tempPw)) summary.loginsEmailed++;
      else summary.warnings.push('Login created for ' + id + ' but the email with the one-time password was not sent \u2014 they can use Forgot password.');
      return;
    }
    var up = {};
    if (String(u.fullName || '').trim() !== name) up.fullName = name;
    if (validateEmail_(email) &&
        String(u.email || '').toLowerCase() !== email.toLowerCase() &&
        !findWhere_('Users', function (x) { return x !== u && String(x.email || '').toLowerCase() === email.toLowerCase(); })) {
      up.email = email;
    }
    var protectedRole = u.role === 'PG_Coordinator' || u.role === 'HoD';
    var targetRole = (protectedRole && role === 'Staff') ? String(u.role) : role;
    if (targetRole !== String(u.role || '')) up.role = targetRole;
    else if (protectedRole && role === 'Staff') {
      warnOnce('Login ' + id + ' keeps its ' + u.role + ' role (the roster row has no role note).');
    }
    if (String(u.status || '') !== 'Approved') up.status = 'Approved';
    if (!toBool_(u.active)) up.active = true;
    if (Object.keys(up).length) {
      updateRow_('Users', u.id, up);
      summary.loginsSynced++;
      if (up.active === true) summary.loginsReactivated++;
    }
  });

  // 4. Deactivate ACA logins the Staff tab no longer backs (missing or inactive row).
  if (Object.keys(presentAca).length) {
    filterWhere_('Users', function (u) { return validateStaffId_(String(u.regNumber || '').trim()); }).forEach(function (u) {
      var key = String(u.regNumber).trim();
      if (presentAca[key] === true) return;
      var r = String(u.role || '');
      if (r === 'PG_Coordinator' || r === 'HoD') {
        warnOnce('Login ' + key + ' (' + r + ') is ' + (presentAca[key] === false ? 'inactive in the Staff tab' : 'missing from the Staff tab') +
          ' but was NOT deactivated (protected role \u2014 review it manually).');
        return;
      }
      if (toBool_(u.active)) { updateRow_('Users', u.id, { active: false }); summary.loginsDeactivated++; }
    });
  } else {
    summary.warnings.push('No valid ACA rows found in the Staff tab \u2014 login deactivation skipped (re-run after fixing the roster).');
  }

  logImportSummary_(summary);
  return summary;
}
function logImportSummary_(s) {
  Logger.log('importStaff \u2192 rows: ' + s.rows +
    ' | staff rows created/updated: ' + s.staffRowsCreated + '/' + s.staffRowsUpdated +
    ' | logins created (emailed ' + s.loginsEmailed + ')/synced/reactivated/deactivated: ' + s.loginsCreated + '/' + s.loginsSynced + '/' + s.loginsReactivated + '/' + s.loginsDeactivated);
  s.warnings.forEach(function (w) { Logger.log('  ! ' + w); });
  s.skipped.forEach(function (x) { Logger.log('  - skipped: ' + JSON.stringify(x)); });
  try {
    logAudit_('system', 'import', 'IMPORT_STAFF', 'Staff',
      'rows=' + s.rows + ', staff created/updated=' + s.staffRowsCreated + '/' + s.staffRowsUpdated +
      ', logins created/synced/deactivated=' + s.loginsCreated + '/' + s.loginsSynced + '/' + s.loginsDeactivated);
  } catch (e) {}
}

/* =========================== 8. SUPERVISOR ASSIGNMENT =========================== */

function api_assignSupervisors_locked_(token, regNumber, mainSupervisorId, coSupervisorId) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'Only the PG Coordinator or HoD can assign supervisors.');
  if (!regNumber) throw new Error('Reg number required.');
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(regNumber); });
  if (!student) throw new Error('Student not found.');
  if (mainSupervisorId && !findById_('Staff', mainSupervisorId)) throw new Error('Main supervisor not found in Staff list.');
  if (coSupervisorId && !findById_('Staff', coSupervisorId)) throw new Error('Co-supervisor not found in Staff list.');
  if (mainSupervisorId && String(mainSupervisorId) === String(coSupervisorId)) throw new Error('Main supervisor and co-supervisor must be different people.');
  updateRow_('Students', student.id, { mainSupervisorId: mainSupervisorId || '', coSupervisorId: coSupervisorId || '', updatedAt: nowIso_() });
  var mainName = mainSupervisorId ? (findById_('Staff', mainSupervisorId) || {}).fullName || '' : 'None';
  var coName = coSupervisorId ? (findById_('Staff', coSupervisorId) || {}).fullName || '' : 'None';
  logAudit_(user.id, user.regNumber, 'ASSIGN_SUPERVISORS', regNumber, 'Main: ' + mainName + ', Co: ' + coName);
  notifyStudent_(regNumber, 'Supervisors assigned', 'Main supervisor: ' + supLabel_(mainSupervisorId) + '\nCo-supervisor: ' + supLabel_(coSupervisorId));
  notifySupervisors_(student, student.mainSupervisorId, student.coSupervisorId, mainSupervisorId, coSupervisorId);
  return { ok: true, _syncReg: String(regNumber), _oldEmails: supervisorEmails_([student.mainSupervisorId, student.coSupervisorId]) };
}
function api_assignSupervisors() {
  var a = arguments, res = withScriptLock_(function () { return api_assignSupervisors_locked_.apply(null, a); }, 30000);
  try { syncStudentFileAccess_(res._syncReg, res._oldEmails); } catch (e) { Logger.log('sync after assign: ' + e); }
  return { ok: true };
}

function api_updateStudentStage_locked_(token, regNumber, stage) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can update the stage.');
  if (CFG.JOURNEY_STAGES.indexOf(stage) === -1) throw new Error('Invalid stage.');
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(regNumber); });
  if (!student) throw new Error('Student not found.');
  updateRow_('Students', student.id, { currentStage: stage, updatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'UPDATE_STAGE', regNumber, stage);
  notifyStudent_(regNumber, 'Journey stage updated', 'Your postgraduate journey stage is now: ' + stage + '.');
  return { ok: true };
}

/* ---- bulk actions for the PG Coordinator ---- */
function api_bulkUpdateStage_l(token, regs, stage) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can update stages.');
  regs = (regs || []).map(String).slice(0, 200);
  if (!regs.length) throw new Error('Select at least one student.');
  if (CFG.JOURNEY_STAGES.indexOf(stage) === -1) throw new Error('Choose a valid stage.');
  var ok = 0, failed = [];
  regs.forEach(function (r) { try { api_updateStudentStage_locked_(token, r, stage); ok++; } catch (e) { failed.push({ regNumber: r, error: String((e && e.message) || e) }); } });
  logAudit_(user.id, user.regNumber, 'BULK_STAGE', 'Students', ok + ' students -> ' + stage);
  return { updated: ok, failed: failed };
}
function api_bulkUpdateStage() { return L_(api_bulkUpdateStage_l, arguments); }
/** Assigns the chosen supervisor(s) to many students. A blank choice keeps each student's existing supervisor in that role. */
function api_bulkAssignSupervisors_l(token, regs, mainId, coId) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'Only the PG Coordinator or HoD can assign supervisors.');
  regs = (regs || []).map(String).slice(0, 100);
  if (!regs.length) throw new Error('Select at least one student.');
  if (!mainId && !coId) throw new Error('Choose at least one supervisor.');
  var ok = [], failed = [], sync = [], names = {};
  BULK_QUIET_ = true;
  try {
    regs.forEach(function (r) {
      try {
        var stu = findWhere_('Students', function (x) { return String(x.regNumber) === r; });
        if (!stu) throw new Error('Student not found.');
        var res = api_assignSupervisors_locked_(token, r, mainId || stu.mainSupervisorId || '', coId || stu.coSupervisorId || '');
        ok.push(r); sync.push({ reg: res._syncReg, old: res._oldEmails }); names[r] = fullNameOf_(stu);
      } catch (e) { failed.push({ regNumber: r, error: String((e && e.message) || e) }); }
    });
  } finally { BULK_QUIET_ = false; }
  [[mainId, 'Main Supervisor'], [coId, 'Co-Supervisor']].forEach(function (p) {
    if (!p[0] || !ok.length) return;
    var st = findById_('Staff', p[0]), su = staffUserFor_(p[0]);
    if (su) addNote_(su.regNumber, 'Assigned as ' + p[1] + ' to ' + ok.length + ' student(s).');
    if (st && EMAIL_RE.test(String(st.email || ''))) { try { sendPortalMail_({ to: st.email, subject: 'You were assigned ' + ok.length + ' student(s) as ' + p[1], body: 'Dear ' + st.fullName + ',\n\nYou were assigned as ' + p[1] + ' to:\n\n' + ok.map(function (r) { return '- ' + names[r] + ' (' + r + ')'; }).join('\n') + '\n\nOpen My Students in the portal for details.' }); } catch (e) {} }
  });
  logAudit_(user.id, user.regNumber, 'BULK_ASSIGN', 'Students', ok.length + ' students');
  return { updated: ok.length, failed: failed, _sync: sync };
}
function api_bulkAssignSupervisors() {
  var a = arguments, res = L_(api_bulkAssignSupervisors_l, a), t0 = Date.now();
  (res._sync || []).forEach(function (x) { if (Date.now() - t0 > 200000) return; try { syncStudentFileAccess_(x.reg, x.old); } catch (e) { Logger.log('bulk sync: ' + e); } });
  delete res._sync;
  return res;
}
function api_updateStudentStage() { var a = arguments; return withScriptLock_(function () { return api_updateStudentStage_locked_.apply(null, a); }, 30000); }

/* =========================== 9. PROFILE / PHOTO UPDATE =========================== */

function api_updateProfilePhoto(token, filePayload) {
  var user = requireUser_(token);
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.regNumber); });
  if (!student) throw new Error('Student profile not found.');
  var fileInfo = savePassportPhoto_(filePayload, user.regNumber);
  // Trash old photo
  if (student.passportFileId) { try { DriveApp.getFileById(student.passportFileId).setTrashed(true); } catch (e) {} }
  updateRow_('Students', student.id, { passportFileId: fileInfo.id, passportUrl: fileInfo.url, updatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'UPDATE_PHOTO', user.regNumber, 'Profile photo updated');
  return { ok: true, url: fileInfo.url, id: fileInfo.id };
}

function api_updateProfile(token, payload) {
  var user = requireUser_(token);
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.regNumber); });
  if (!student) throw new Error('Student profile not found.');
  var phone = payload.phoneNumber ? validatePhone_(payload.phoneNumber) : student.phoneNumber;
  if (payload.phoneNumber && !phone) throw new Error('Phone must be exactly 11 digits.');
  updateRow_('Students', student.id, { phoneNumber: phone || student.phoneNumber, updatedAt: nowIso_() });
  return { ok: true };
}

/* =========================== 10. STUDENT DASHBOARD =========================== */

function api_getStudentDashboard(token) {
  var user = requireUser_(token);
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.regNumber); });
  if (!student) throw new Error('Student profile not found.');
  var mainSup = student.mainSupervisorId ? findById_('Staff', student.mainSupervisorId) : null;
  var coSup = student.coSupervisorId ? findById_('Staff', student.coSupervisorId) : null;
  var subs = filterWhere_('Submissions', function (s) { return String(s.regNumber) === String(user.regNumber); });
  subs.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  var anns = filterWhere_('Announcements', function (a) { return toBool_(a.active) && annVisibleTo_(a, 'Student'); });
  anns.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return {
    student: {
      regNumber: student.regNumber, surname: student.surname, firstName: student.firstName, otherNames: student.otherNames,
      gender: student.gender, phoneNumber: student.phoneNumber, email: student.email,
      faculty: normFaculty_(student.faculty), department: student.department, programme: student.programme,
      specialisation: student.specialisation, passportUrl: student.passportUrl, passportFileId: student.passportFileId,
      currentStage: student.currentStage, yearOfAdmission: academicYearFromReg_(student.regNumber) || student.yearOfAdmission,
      session: studentSession_(student), thesisTitle: student.thesisTitle || '', titleStatus: titleState_(student).status,
      titleOpen: titleState_(student).open, titleLocked: titleState_(student).locked,
      mainSupervisor: mainSup ? { id: mainSup.id, fullName: mainSup.fullName, email: mainSup.email, rank: mainSup.rank } : null,
      coSupervisor: coSup ? { id: coSup.id, fullName: coSup.fullName, email: coSup.email, rank: coSup.rank } : null
    },
    submissions: subs.map(function (s) { return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, inspectorComments: s.inspectorComments, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt }; }),
    announcements: anns.slice(0, 10).map(annItem_),
    meetings: filterWhere_('Meetings', function (m) { return String(m.regNumber) === String(user.regNumber); }).map(function (m) { var o = stripRow_(m); o.status = o.status || 'Logged'; return o; }).reverse(),
    deadlines: upcomingDeadlines_(),
    seminars: seminarList_(true, user.regNumber),
    requests: filterWhere_('Requests', function (r) { return String(r.regNumber) === String(user.regNumber); }).map(stripRow_).reverse(),
    templates: CFG.TEMPLATES,
    stages: CFG.JOURNEY_STAGES,
    timeInfo: timeInfo_(student)
  };
}

/* =========================== 11. SUBMISSIONS =========================== */

/** Stage policy for examiner documents. Stage 11 is the External Defence/final presentation stage. */
function validateSubmissionStage_(stu, type) {
  var idx = stu ? CFG.JOURNEY_STAGES.indexOf(String(stu.currentStage || '')) : -1;
  var presentationIdx = CFG.JOURNEY_STAGES.indexOf('11 - External Defence');
  var postPresentationIdx = CFG.JOURNEY_STAGES.indexOf('12 - Examiners Comments');
  if (idx < 0) throw new Error('Your current journey stage is not set. Ask the PG Coordinator to update it before submitting examiner documents.');
  if (type === 'Internal Examiner and Other Observations' && idx >= presentationIdx)
    throw new Error('Internal Examiner and Other Observations must be submitted before the final presentation. If your stage is incorrect, request a stage update and wait for PG Coordinator approval.');
  if ((type === 'Final Correction' || type === 'Comment-by-Comment Response (External Examiner)' || type === 'Comment-by-Comment Response (Internal Examiner)') && idx < postPresentationIdx)
    throw new Error('Final Correction and Comment-by-Comment Responses can be submitted after the final presentation, from stage 12 - Examiners Comments onward. Request a stage update if your stage is incorrect.');
}

function api_createSubmission_locked_(token, payload) {
  var user = requireUser_(token);
  assertRole_(user, ['Student'], 'Only students can submit documents.');
  if (!payload || !payload.type || CFG.SUBMISSION_TYPES.indexOf(payload.type) === -1) throw new Error('Invalid submission type.');
  var asDraft = payload.asDraft === true || String(payload.asDraft) === 'true';
  var stuForStage = findWhere_('Students', function (x) { return String(x.regNumber) === String(user.regNumber); });
  if (!asDraft) validateSubmissionStage_(stuForStage, payload.type);   // stage rules apply when the draft is submitted
  if (!payload.driveFileUrls) throw new Error('Drive file URL is required.');
  var now = nowIso_();
  var row = appendRow_('Submissions', {
    regNumber: user.regNumber,
    type: payload.type,
    driveFileUrls: String(payload.driveFileUrls).trim(),
    status: asDraft ? 'Draft' : 'Submitted',
    inspectorComments: '',
    supervisorNotes: '',
    createdBy: user.id,
    createdAt: now,
    updatedAt: now
  });
  logAudit_(user.id, user.regNumber, asDraft ? 'SAVE_DRAFT' : 'CREATE_SUBMISSION', row.id, 'Type: ' + payload.type);
  return { id: row.id, draft: asDraft };
}
function api_createSubmission() {
  var a = arguments, res = withScriptLock_(function () { return api_createSubmission_locked_.apply(null, a); }, 30000);
  try { var sub = findById_('Submissions', res.id); if (sub && !res.draft) shareSubmissionFiles_(sub); } catch (e) { Logger.log('share after create: ' + e); }
  return res;
}

function api_listSubmissions(token, filter) {
  var user = requireUser_(token);
  var list;
  if (user.role === 'Student') {
    list = filterWhere_('Submissions', function (s) { return String(s.regNumber) === String(user.regNumber); });
  } else if (user.role === 'Staff') {
    var myStudents = filterWhere_('Students', function (s) { return supOf_(user, s); });
    var regMap = {};
    myStudents.forEach(function (s) { regMap[s.regNumber] = 1; });
    list = filterWhere_('Submissions', function (s) { return regMap[s.regNumber]; });
  } else if (user.role === 'Submission_Inspector') {
    list = readTable_('Submissions').slice();
  } else {
    list = readTable_('Submissions');
  }
  if (user.role !== 'Student') list = list.filter(function (s) { return String(s.status) !== 'Draft'; });   // drafts stay private to the student
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return list.map(function (s) {
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(s.regNumber); });
    return {
      id: s.id, regNumber: s.regNumber, type: s.type, status: s.status,
      driveFileUrls: s.driveFileUrls, inspectorComments: s.inspectorComments,
      supervisorNotes: s.supervisorNotes, createdAt: s.createdAt, checklist: s.checklist || '', endorsedBy: s.endorsedBy || '', assignedTo: s.assignedTo || '', assignedName: assignedName_(s.assignedTo), history: parseHist_(s.history), overdue: overdue_(s), checklistItems: checklistFor_(s.type), reviewedBy: s.reviewedBy || '', reviewedAt: s.reviewedAt || '',
      compliance: user.role === 'Student' ? null : parseCompliance_(s.compliance),
      similarity: (user.role === 'Student' || s.similarity === '' || s.similarity === undefined) ? '' : s.similarity, similarityUrl: user.role === 'Student' ? '' : (s.similarityUrl || ''), similarityBy: user.role === 'Student' ? '' : (s.similarityBy || ''), similarityAt: user.role === 'Student' ? '' : (s.similarityAt || ''),
      similarityLimit: similarityLimit_(), similarityTracked: COMPLIANCE_TYPES.indexOf(s.type) !== -1, waitingDays: daysSince_(s.createdAt),
      studentName: stu ? fullNameOf_(stu) : '', programme: stu ? stu.programme : ''
    };
  });
}

function api_updateSubmissionStatus_locked_(token, submissionId, newStatus, comments, checklist) {
  var user = requireUser_(token);
  assertRole_(user, ['Submission_Inspector', 'PG_Coordinator'], 'You cannot update submission status.');
  if (CFG.SUBMISSION_STATUSES.indexOf(newStatus) === -1) throw new Error('Invalid status.');
  if ((newStatus === 'Rejected' || newStatus === 'Changes Requested') && !String(comments || '').trim()) throw new Error('Comments are required for Rejected / Changes Requested.');
  var sub = findById_('Submissions', submissionId);
  if (!sub) throw new Error('Submission not found.');
  if (String(sub.status) === 'Draft') throw new Error('This submission is still a draft and has not been sent for review.');
  if (newStatus === 'Approved' && sub.type === 'Final Thesis/Dissertation' && String(getSetting_('REQUIRE_SIMILARITY', 'no')).toLowerCase() === 'yes') {   // optional gate (Config: REQUIRE_SIMILARITY = yes)
    if (sub.similarity === '' || sub.similarity === undefined) throw new Error('Record the similarity result before approving the final thesis.');
    if (parseFloat(sub.similarity) > similarityLimit_()) throw new Error('The similarity (' + sub.similarity + '%) is above the allowed limit of ' + similarityLimit_() + '%. Request changes instead.');
  }
  if (newStatus === 'Rejected' || newStatus === 'Changes Requested') comments = numberIssues_(comments);
  var ticked = []; try { ticked = JSON.parse(checklist || '[]'); } catch (e) {}
  if (newStatus === 'Approved' && ticked.length < checklistFor_(sub.type).length) throw new Error('Tick every checklist item before approving.');
  updateRow_('Submissions', submissionId, { history: pushHistory_(sub, { at: nowIso_(), by: user.fullName, status: newStatus, comments: String(comments || '').trim() }), checklist: JSON.stringify(ticked), status: newStatus, inspectorComments: String(comments || '').trim(), updatedAt: nowIso_(), reviewedBy: user.fullName + ' (' + user.role + ')', reviewedAt: nowIso_() });
  if (newStatus === 'Approved') { try { autoAdvance_(sub); } catch (e) { Logger.log(e); } }
  try { notifyOversight_(sub, newStatus, comments, user); } catch (e) { Logger.log('Oversight mail failed: ' + e); }
  logAudit_(user.id, user.regNumber, 'SUBMISSION_STATUS', submissionId, newStatus + ': ' + (comments || ''));
  // Email the student
  var stuUser = findWhere_('Users', function (u) { return String(u.regNumber) === String(sub.regNumber); });
  if (stuUser && EMAIL_RE.test(stuUser.email)) {
    sendPortalMail_({
      to: stuUser.email,
      subject: 'Submission Update: ' + sub.type + ' — ' + newStatus,
      body: 'Dear ' + (stuUser.fullName || 'Student') + ',\n\nYour submission "' + sub.type + '" (ID: ' + submissionId + ') status has been updated to: ' + newStatus + '.\n\nComments: ' + (comments || 'None') + '\n\n' + CFG.APP_NAME,
      htmlBody: '<p style="margin:0 0 12px">Dear <strong>' + escHtml_(stuUser.fullName || 'Student') + '</strong>,</p>' +
        '<p>Your submission <strong>' + escHtml_(sub.type) + '</strong> (ID: <code>' + escHtml_(submissionId) + '</code>) status has been updated to:</p>' +
        '<p style="margin:0 0 12px"><span style="display:inline-block;padding:4px 12px;border-radius:6px;background:#d1fae5;color:#047857;font-weight:600">' + escHtml_(newStatus) + '</span></p>' +
        (comments ? '<p><strong>Comments:</strong> ' + escHtml_(comments) + '</p>' : '')
    });
  }
  return { ok: true };
}
/** Tell the PG Coordinator and HoD when a submission is approved / rejected / etc. */
function notifyOversight_(sub, status, comments, actor) {
  filterWhere_('Users', function (u) { return (u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active) && String(u.id) !== String(actor.id); })
    .forEach(function (u) { addNote_(u.regNumber, sub.type + ' (' + sub.regNumber + ') ' + status + ' by ' + actor.fullName); });
  var to = {};
  filterWhere_('Users', function (u) { return (u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')) && String(u.id) !== String(actor.id); })
    .forEach(function (u) { to[String(u.email).toLowerCase()] = 1; });
  var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(sub.regNumber); });
  var who = (stu ? fullNameOf_(stu) + ' ' : '') + '(' + sub.regNumber + ')';
  Object.keys(to).forEach(function (addr) {
    sendPortalMail_({ to: addr, subject: 'Submission ' + status + ': ' + sub.type + ' — ' + sub.regNumber,
      body: actor.fullName + ' (' + actor.role + ') set "' + sub.type + '" by ' + who + ' to ' + status + '.\nComments: ' + (comments || 'None') });
  });
}
function api_updateSubmissionStatus() { var a = arguments; return withScriptLock_(function () { return api_updateSubmissionStatus_locked_.apply(null, a); }, 30000); }

function api_addSupervisoryNote_locked_(token, submissionId, note) {
  var user = requireUser_(token);
  assertRole_(user, ['Staff', 'PG_Coordinator'], 'You cannot add supervisory notes.');
  if (!String(note || '').trim()) throw new Error('Note text is required.');
  var sub = findById_('Submissions', submissionId);
  if (!sub) throw new Error('Submission not found.');
  var existing = String(sub.supervisorNotes || '');
  var stamped = existing + (existing ? '\n' : '') + '[' + user.fullName + ', ' + nowIso_().slice(0, 10) + ']: ' + String(note).trim();
  updateRow_('Submissions', submissionId, { supervisorNotes: stamped, updatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'SUPERVISORY_NOTE', submissionId, String(note).substring(0, 100));
  return { ok: true };
}
function api_addSupervisoryNote() { var a = arguments; return withScriptLock_(function () { return api_addSupervisoryNote_locked_.apply(null, a); }, 30000); }


/** Once the Coordinator has confirmed a title it is locked until the external defence. A student who must change it sends a request;
 *  approving the request applies the new wording and keeps it confirmed. */
function api_requestTitleChange_l(token, newTitle, reason) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can request a title change.');
  var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(user.regNumber); });
  if (!stu) throw new Error('Student profile not found.');
  if (!titleState_(stu).locked) throw new Error('Your title is not locked, so you can edit it directly on your dashboard.');
  var t = String(newTitle || '').replace(/\s+/g, ' ').trim(), why = String(reason || '').trim();
  if (t.length < 10) throw new Error('Please enter the full new title (at least 10 characters).');
  if (t.length > 400) throw new Error('The title must be 400 characters or fewer.');
  if (t.toLowerCase() === String(stu.thesisTitle || '').trim().toLowerCase()) throw new Error('That is the same as your current title.');
  if (why.length < 10) throw new Error('Please explain why the title must change (at least 10 characters).');
  if (findWhere_('Requests', function (r) { return String(r.regNumber) === String(user.regNumber) && r.type === 'Title change' && r.status === 'Pending'; })) throw new Error('You already have a title change request awaiting the PG Coordinator.');
  var r = appendRow_('Requests', { regNumber: user.regNumber, type: 'Title change', reason: '[Title] ' + t + '\n[Reason] ' + why.slice(0, 1200), status: 'Pending', decisionNote: '', createdAt: nowIso_(), decidedBy: '', decidedAt: '' });
  logAudit_(user.id, user.regNumber, 'CREATE_REQUEST', r.id, 'Title change');
  notifyCoordinators_('Title change request — ' + user.regNumber, 'Title change request from ' + user.fullName,
    user.fullName + ' (' + user.regNumber + ') asks to change the confirmed title.\nCurrent: ' + stu.thesisTitle + '\nRequested: ' + t + '\nReason: ' + why + '\n\nDecide it on the Coordinator page.');
  return { id: r.id };
}
function api_requestTitleChange() { return L_(api_requestTitleChange_l, arguments); }
/** Bell + email for every active PG Coordinator (falls back to the enquiries address). */
function notifyCoordinators_(subject, note, mailBody) {
  var cs = filterWhere_('Users', function (u) { return u.role === 'PG_Coordinator' && toBool_(u.active) && String(u.status) === 'Approved'; }), to = {};
  cs.forEach(function (u) { addNote_(u.regNumber, note); if (EMAIL_RE.test(String(u.email || ''))) to[String(u.email).toLowerCase()] = 1; });
  if (!Object.keys(to).length) to[coordinatorEmail_()] = 1;
  Object.keys(to).forEach(function (a) { try { sendPortalMail_({ to: a, subject: subject, body: mailBody }); } catch (e) { Logger.log('notifyCoordinators_: ' + e); } });
}

/* ---- self-service email change (all roles; the new address must confirm with a code) ---- */
function api_requestEmailChange(token, newEmail) {
  var user = requireUser_(token);
  if (__actor) throw new Error('Email cannot be changed while signed in as another user.');
  var em = cleanEmail_(newEmail);
  if (!validateEmail_(em)) throw new Error('Invalid email address. Use the form name@example.com.');
  if (em === String(user.email || '').toLowerCase()) throw new Error('That is already your email address.');
  if (findWhere_('Users', function (x) { return String(x.email || '').toLowerCase() === em && String(x.id) !== String(user.id); })) throw new Error('That email address is already used by another account.');
  var cache = CacheService.getScriptCache(), n = parseInt(cache.get('emcn_' + user.id) || '0', 10);
  if (n >= 3) throw new Error('Too many requests. Please try again in an hour.');
  cache.put('emcn_' + user.id, String(n + 1), 3600);
  var code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('emc_' + user.id, JSON.stringify({ h: hashPassword_(code, user.id), email: em }), 1800); cache.remove('emca_' + user.id);
  sendPortalMail_({ to: em, subject: 'Confirm your new email address', body: 'Your confirmation code is ' + code + '. It expires in 30 minutes. If you did not request this change, ignore this email.' });
  return { message: 'A 6-digit code was sent to ' + em + '. Enter it to confirm the change.' };
}
function api_confirmEmailChange(token, code) {
  var user = requireUser_(token), cache = CacheService.getScriptCache(), raw = cache.get('emc_' + user.id), tries = parseInt(cache.get('emca_' + user.id) || '0', 10);
  if (!raw || tries >= 5) throw new Error('The code expired or there were too many attempts. Request a new code.');
  var st = JSON.parse(raw);
  if (hashPassword_(String(code || '').trim(), user.id) !== st.h) { cache.put('emca_' + user.id, String(tries + 1), 1800); throw new Error('Incorrect code.'); }
  if (findWhere_('Users', function (x) { return String(x.email || '').toLowerCase() === st.email && String(x.id) !== String(user.id); })) throw new Error('That email address is already used by another account.');
  var old = String(user.email || '');
  updateRow_('Users', user.id, { email: st.email });
  if (user.role === 'Student') { var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(user.regNumber); }); if (stu) updateRow_('Students', stu.id, { email: st.email, updatedAt: nowIso_() }); }
  else { var sf = findById_('Staff', user.regNumber) || findWhere_('Staff', function (x) { return old && String(x.email || '').toLowerCase() === old.toLowerCase(); }); if (sf) updateRow_('Staff', sf.id, { email: st.email }); }
  cache.remove('emc_' + user.id);
  logAudit_(user.id, user.regNumber, 'CHANGE_EMAIL', user.regNumber, old + ' -> ' + st.email);
  return { ok: true, email: st.email };
}

/* ---- saved templates (reply texts for inquiries/messages; comment snippets for inspectors) ---- */
var TEMPLATE_ROLES = ['Staff', 'PG_Coordinator', 'HoD', 'Submission_Inspector'];
var BUILTIN_TEMPLATES = {
  reply: [
    { title: 'Received', body: 'Thank you for your message. We have received it and will get back to you shortly.' },
    { title: 'More information needed', body: 'Please send us more details about your request, including your registration number and the stage or document concerned, so that we can help.' },
    { title: 'Visit the office', body: 'Please visit the PG Coordinator\u2019s office with the relevant documents so that this can be handled in person.' },
    { title: 'Resolved', body: 'This has been resolved. If you still need help, please send a new inquiry.' }
  ],
  comment: [
    { title: 'Margins', body: 'Page margins do not meet the requirement (left 4.0 cm; top, right and bottom 2.5 cm).' },
    { title: 'Citations missing from references', body: 'Some in-text citations have no matching entry in the reference list.' },
    { title: 'References never cited', body: 'Some entries in the reference list are not cited in the text.' },
    { title: 'Similarity too high', body: 'The similarity index is above the allowed limit. Please revise and attach the new similarity report.' },
    { title: 'Endorsement missing', body: 'The supervisor endorsement is missing. Please attach it.' },
    { title: 'Corrections', body: 'Please address the examiners\u2019 corrections point by point and indicate where each change was made.' }
  ]
};
function api_listTemplates(token) {
  var user = requireUser_(token); assertRole_(user, TEMPLATE_ROLES, 'Templates are not available for your role.');
  var mine = filterWhere_('Templates', function (t) { return String(t.owner) === String(user.regNumber); }).map(function (t) { return { id: t.id, kind: t.kind, title: t.title, body: t.body }; });
  return { builtin: BUILTIN_TEMPLATES, mine: mine };
}
function api_saveTemplate_l(token, kind, title, body) {
  var user = requireUser_(token); assertRole_(user, TEMPLATE_ROLES, 'Templates are not available for your role.');
  kind = String(kind || ''); if (['reply', 'comment'].indexOf(kind) === -1) throw new Error('Invalid template type.');
  var t = String(title || '').replace(/\s+/g, ' ').trim(), b = String(body || '').trim();
  if (t.length < 2 || t.length > 60) throw new Error('Give the template a short title (2\u201360 characters).');
  if (b.length < 5 || b.length > 1500) throw new Error('The template text must be 5\u20131500 characters.');
  var mine = filterWhere_('Templates', function (x) { return String(x.owner) === String(user.regNumber); });
  if (mine.length >= 40) throw new Error('You have 40 saved templates. Delete some before adding more.');
  var r = appendRow_('Templates', { owner: user.regNumber, kind: kind, title: t, body: b, createdAt: nowIso_() });
  return { id: r.id };
}
function api_saveTemplate() { return L_(api_saveTemplate_l, arguments); }
function api_deleteTemplate_l(token, id) {
  var user = requireUser_(token), t = findById_('Templates', id);
  if (!t || String(t.owner) !== String(user.regNumber)) throw new Error('Template not found.');
  removeWhere_('Templates', function (x) { return String(x.id) === String(id); });
  return { ok: true };
}
function api_deleteTemplate() { return L_(api_deleteTemplate_l, arguments); }

/* ---- draft submissions ---- */
function api_submitDraft_l(token, id, url) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can submit documents.');
  var sub = findById_('Submissions', id);
  if (!sub || String(sub.regNumber) !== String(user.regNumber)) throw new Error('Submission not found.');
  if (String(sub.status) !== 'Draft') throw new Error('Only drafts can be submitted this way.');
  validateSubmissionStage_(findWhere_('Students', function (x) { return String(x.regNumber) === String(user.regNumber); }), sub.type);
  var link = String(url || '').trim() || String(sub.driveFileUrls || '');
  if (!urlsFromText_(link).length) throw new Error('A valid file link is required.');
  var now = nowIso_();
  updateRow_('Submissions', id, { driveFileUrls: link, status: 'Submitted', createdAt: now, updatedAt: now, compliance: '', history: pushHistory_(sub, { at: now, by: user.fullName, status: 'Submitted', comments: 'Submitted from draft' }) });
  logAudit_(user.id, user.regNumber, 'CREATE_SUBMISSION', id, 'Type: ' + sub.type + ' (from draft)');
  return { ok: true, id: id };
}
function api_submitDraft() {
  var a = arguments, res = L_(api_submitDraft_l, a);
  try { var sub = findById_('Submissions', a[1]); if (sub) shareSubmissionFiles_(sub); } catch (e) { Logger.log('share after draft submit: ' + e); }
  return res;
}
function api_deleteDraft_l(token, id) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can delete their drafts.');
  var sub = findById_('Submissions', id);
  if (!sub || String(sub.regNumber) !== String(user.regNumber)) throw new Error('Submission not found.');
  if (String(sub.status) !== 'Draft') throw new Error('Only drafts can be deleted.');
  removeWhere_('Submissions', function (x) { return String(x.id) === String(id); });
  logAudit_(user.id, user.regNumber, 'DELETE_DRAFT', id, sub.type);
  return { ok: true };
}
function api_deleteDraft() { return L_(api_deleteDraft_l, arguments); }

/* =========================== 12. COORDINATOR =========================== */

function api_getCoordinatorDashboard(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'Access denied.');
  var users = readTable_('Users');
  var students = readTable_('Students');
  var pending = users.filter(function (u) { return u.role === 'Student' && String(u.status) === 'Pending'; }).map(function (u) {
    var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(u.regNumber); }) || {};
    return { regNumber: u.regNumber, fullName: u.fullName, email: u.email, programme: stu.programme || '', status: u.status,
      phoneNumber: stu.phoneNumber || '', admissionLetterUrl: stu.admissionLetterUrl || '', flags: dupFlags_(stu, students) };
  });
  var allStudents = students.map(function (s) {
    var main = s.mainSupervisorId ? findById_('Staff', s.mainSupervisorId) : null;
    var co = s.coSupervisorId ? findById_('Staff', s.coSupervisorId) : null;
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(s.regNumber); });
    return {
      regNumber: String(s.regNumber || '').trim(), fullName: fullNameOf_(s), firstName: s.firstName || '', surname: s.surname || '', programme: s.programme, specialisation: s.specialisation,
      gender: s.gender || '', yearOfAdmission: academicYearFromReg_(s.regNumber) || s.yearOfAdmission || '', email: s.email || (u && u.email) || '',
      phoneNumber: s.phoneNumber || '', faculty: normFaculty_(s.faculty), department: s.department || '',
      passportFileId: s.passportFileId || '', admissionLetterUrl: s.admissionLetterUrl || '', mainSupervisor: main ? main.fullName : '', coSupervisor: co ? co.fullName : '',
      mainSupervisorId: s.mainSupervisorId || '', coSupervisorId: s.coSupervisorId || '',
      currentStage: s.currentStage, status: u ? u.status : '',
      session: studentSession_(s), thesisTitle: s.thesisTitle || '', titleStatus: titleState_(s).status
    };
  });
  var staffList = filterWhere_('Staff', function (s) { return toBool_(s.active); }).map(function (s) { return { id: s.id, fullName: s.fullName, rank: s.rank, specialisation: s.specialisation, load: loadOf_(s.id) }; });
  var logins = readTable_('Users').filter(function (u) { return u.role !== 'Student'; }).map(function (u) { return { id: u.id, regNumber: u.regNumber, fullName: u.fullName, email: u.email, role: u.role, active: toBool_(u.active) }; });
  var stageRequests = readTable_('Requests').filter(function (r) { return r.type === 'Stage change' && r.status === 'Pending'; }).map(function (r) {
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(r.regNumber); });
    var m = String(r.reason || '').match(/^\[Stage: ([^\]]+)\]\s*([\s\S]*)$/);
    return { id: r.id, regNumber: r.regNumber, studentName: stu ? fullNameOf_(stu) : '', currentStage: stu ? stu.currentStage : '',
      requestedStage: m ? m[1] : '', note: m ? m[2] : String(r.reason || ''), createdAt: r.createdAt };
  }).reverse();
  var titleRequests = readTable_('Requests').filter(function (r) { return r.type === 'Title change' && r.status === 'Pending'; }).map(function (r) {
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(r.regNumber); });
    var m = String(r.reason || '').match(/^\[Title\] ([^\n]+)\n\[Reason\] ([\s\S]*)$/);
    return { id: r.id, regNumber: r.regNumber, studentName: stu ? fullNameOf_(stu) : '', currentTitle: stu ? stu.thesisTitle || '' : '', requestedTitle: m ? m[1] : '', reason: m ? m[2] : String(r.reason || ''), createdAt: r.createdAt };
  }).reverse();
  return { pending: pending, students: allStudents, staff: staffList, logins: logins, stages: CFG.JOURNEY_STAGES, stageRequests: stageRequests, titleRequests: titleRequests };
}

function api_approveStudent_locked_(token, regNumber) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can approve students.');
  var target = findWhere_('Users', function (u) { return String(u.regNumber) === String(regNumber) && u.role === 'Student'; });
  if (!target) throw new Error('Student account not found.');
  if (String(target.status) !== 'Pending') throw new Error('This student registration is no longer pending.');
  updateRow_('Users', target.id, { status: 'Approved' });
  var tempPw = issueTempPassword_(target);   // fresh random one-time password, emailed below
  logAudit_(user.id, user.regNumber, 'APPROVE_STUDENT', regNumber, 'Approved');
  try { notifyRegistrationDecision_(target, 'Approved', '', tempPw); } catch (mailErr) { Logger.log('Approve email failed for ' + regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true };
}
function api_approveStudent() { var a = arguments; return withScriptLock_(function () { return api_approveStudent_locked_.apply(null, a); }, 30000); }

/** Bulk-approve all registrations currently pending. Restricted to the PG Coordinator. */
function api_approvePendingStudents_locked_(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can bulk-approve students.');
  var pending = filterWhere_('Users', function (u) { return u.role === 'Student' && String(u.status) === 'Pending'; });
  var approved = 0, failedEmails = 0;
  pending.forEach(function (target) {
    updateRow_('Users', target.id, { status: 'Approved' });
    var tempPw = issueTempPassword_(target);
    logAudit_(user.id, user.regNumber, 'APPROVE_STUDENT', target.regNumber, 'Bulk approved');
    try { notifyRegistrationDecision_(target, 'Approved', '', tempPw); } catch (mailErr) { failedEmails++; Logger.log('Bulk approve email failed for ' + target.regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
    approved++;
  });
  return { ok: true, approved: approved, failedEmails: failedEmails };
}
function api_approvePendingStudents() { var a = arguments; return withScriptLock_(function () { return api_approvePendingStudents_locked_.apply(null, a); }, 30000); }

function api_rejectStudent_locked_(token, regNumber, reason) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can reject students.');
  var target = findWhere_('Users', function (u) { return String(u.regNumber) === String(regNumber) && u.role === 'Student'; });
  if (!target) throw new Error('Student account not found.');
  if (String(target.status) !== 'Pending') throw new Error('This student registration is no longer pending.');
  updateRow_('Users', target.id, { status: 'Rejected' });
  logAudit_(user.id, user.regNumber, 'REJECT_STUDENT', regNumber, reason || '');
  try { notifyRegistrationDecision_(target, 'Rejected', reason); } catch (mailErr) { Logger.log('Reject email failed for ' + regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true };
}
function api_rejectStudent() { var a = arguments; return withScriptLock_(function () { return api_rejectStudent_locked_.apply(null, a); }, 30000); }

var ANN_AUDIENCES = ['students', 'staff', 'all'];
/** Legacy rows (no audience) behave as "all". Students see students+all; every other role sees staff+all. */
function annAudienceOf_(a) { var v = String((a && a.audience) || '').toLowerCase(); return ANN_AUDIENCES.indexOf(v) === -1 ? 'all' : v; }
function annVisibleTo_(a, role) { var v = annAudienceOf_(a); return v === 'all' || (role === 'Student' ? v === 'students' : v === 'staff'); }
function annItem_(a) { return { id: a.id, title: String(a.title || ''), body: String(a.body || ''), createdAt: String(a.createdAt || ''), audience: annAudienceOf_(a) }; }
function announcementsFor_(role, limit) {
  var list = filterWhere_('Announcements', function (a) { return toBool_(a.active) && String(a.title || '').trim() !== '' && annVisibleTo_(a, role); });
  list.sort(function (x, y) { return String(y.createdAt).localeCompare(String(x.createdAt)); });
  return list.slice(0, limit || 10).map(annItem_);
}
function api_getMyAnnouncements(token) { var user = requireUser_(token); return announcementsFor_(user.role, 10); }

function api_addAnnouncement_locked_(token, title, body, audience, sendEmail, programme) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot post announcements.');
  if (!String(title || '').trim() || !String(body || '').trim()) throw new Error('Title and body are required.');
  audience = String(audience || '').toLowerCase();
  if (ANN_AUDIENCES.indexOf(audience) === -1) throw new Error('Choose who the announcement is for: Students only, Staff only or Every user.');
  var row = appendRow_('Announcements', { title: String(title).trim().slice(0, 200), body: String(body).slice(0, 5000), active: true, createdBy: user.id, createdAt: nowIso_(), audience: audience });
  logAudit_(user.id, user.regNumber, 'ADD_ANNOUNCEMENT', row.id, title + ' [' + audience + ']');
  var emailed = 0;
  if (sendEmail === true || String(sendEmail) === 'true') { try { emailed = broadcast_(String(title), String(body), audience, String(programme || 'all')); } catch (e) { Logger.log('Broadcast failed: ' + e); } }
  return { id: row.id, emailed: emailed };
}
function api_addAnnouncement() { var a = arguments; return withScriptLock_(function () { return api_addAnnouncement_locked_.apply(null, a); }, 30000); }

function api_exportData(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can export data.');
  var students = readTable_('Students');
  var users = readTable_('Users');
  var subs = readTable_('Submissions');
  var csv = 'RegNumber,Surname,FirstName,OtherNames,Gender,Phone,Programme,Specialisation,Session,MainSupervisor,CoSupervisor,ThesisTitle,TitleStatus,Stage,Status\n';
  students.forEach(function (s) {
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(s.regNumber); }) || {};
    var main = s.mainSupervisorId ? (findById_('Staff', s.mainSupervisorId) || {}).fullName || '' : '';
    var co = s.coSupervisorId ? (findById_('Staff', s.coSupervisorId) || {}).fullName || '' : '';
    csv += [s.regNumber, s.surname, s.firstName, s.otherNames, s.gender, s.phoneNumber, s.programme, s.specialisation, studentSession_(s), main, co, s.thesisTitle || '', titleState_(s).status, s.currentStage, u.status || ''].map(function (v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }).join(',') + '\n';
  });
  csv += '\n\nSubmissions:\nSubmissionID,RegNumber,Type,Status,CreatedAt\n';
  subs.forEach(function (s) {
    csv += [s.id, s.regNumber, s.type, s.status, s.createdAt].map(function (v) { return '"' + String(v || '') + '"'; }).join(',') + '\n';
  });
  return csv;
}

/* =========================== 12b. THESIS / DISSERTATION TITLE =========================== */

/** Student types / edits the title. Open from stage 6 (Proposal Defence) onward; locked once the PG Coordinator confirms it
 *  and until stage 11 (External Defence). Every save puts the title back to "Pending" for the Coordinator to confirm. */
function api_saveThesisTitle_l(token, title) {
  var user = requireUser_(token);
  assertRole_(user, ['Student'], 'Only students can enter a thesis/dissertation title.');
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.regNumber); });
  if (!stu) throw new Error('Student profile not found.');
  var st = titleState_(stu);
  if (!st.open) throw new Error('You can enter your title once you reach stage "' + TITLE_OPEN_STAGE + '".');
  if (st.locked) throw new Error('Your title has been confirmed by the PG Coordinator and cannot be changed before the external defence.');
  var t = String(title || '').replace(/\s+/g, ' ').trim();
  if (t.length < 10) throw new Error('Please enter the full title (at least 10 characters).');
  if (t.length > 400) throw new Error('The title must be 400 characters or fewer.');
  updateRow_('Students', stu.id, { thesisTitle: t, titleStatus: 'Pending', titleConfirmedBy: '', titleConfirmedAt: '', titleUpdatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'SAVE_THESIS_TITLE', user.regNumber, t.slice(0, 120));
  filterWhere_('Users', function (u) { return u.role === 'PG_Coordinator' && toBool_(u.active); })
    .forEach(function (u) { addNote_(u.regNumber, 'Thesis title awaiting confirmation: ' + fullNameOf_(stu) + ' (' + stu.regNumber + ')'); });
  return { ok: true };
}
function api_saveThesisTitle() { return L_(api_saveThesisTitle_l, arguments); }

function api_confirmThesisTitle_l(token, regNumber) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can confirm a thesis/dissertation title.');
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(regNumber); });
  if (!stu) throw new Error('Student not found.');
  if (!String(stu.thesisTitle || '').trim()) throw new Error('This student has not entered a title yet.');
  if (titleState_(stu).status === 'Confirmed') throw new Error('This title is already confirmed.');
  updateRow_('Students', stu.id, { titleStatus: 'Confirmed', titleConfirmedBy: user.fullName, titleConfirmedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'CONFIRM_THESIS_TITLE', stu.regNumber, String(stu.thesisTitle).slice(0, 120));
  notifyStudent_(stu.regNumber, 'Thesis title confirmed', 'Your thesis/dissertation title was confirmed by ' + user.fullName + ':\n' + stu.thesisTitle + '\nIt can no longer be changed before the external defence.');
  return { ok: true };
}
function api_confirmThesisTitle() { return L_(api_confirmThesisTitle_l, arguments); }

/* =========================== 13. HoD (read-only) =========================== */

function api_getHoDStats(token) {
  var user = requireUser_(token);
  assertRole_(user, ['HoD', 'PG_Coordinator'], 'Access denied.');
  var students = readTable_('Students'), users = readTable_('Users'), subs = readTable_('Submissions').filter(function (x) { return String(x.status) !== 'Draft'; });
  var count = function (o, k) { k = k || 'Unknown'; o[k] = (o[k] || 0) + 1; };
  var byProgramme = {}, byGender = {}, bySession = {}, byStage = {}, byStatus = {}, userByStatus = {};
  var staffById = {}, userByReg = {};
  var staffRecById = {};
  readTable_('Staff').forEach(function (s) { staffById[s.id] = s.fullName; staffRecById[s.id] = s; });
  users.forEach(function (u) { if (u.role === 'Student') userByReg[String(u.regNumber)] = u; });
  var stuByReg = {};
  var stuList = students.map(function (s) {
    var admissionYear = academicYearFromReg_(s.regNumber) || s.yearOfAdmission || '';
    count(byProgramme, s.programme); count(byGender, s.gender); count(bySession, sessionLabel_(admissionYear) || 'Unknown'); count(byStage, s.currentStage);
    stuByReg[s.regNumber] = s;
    return { regNumber: s.regNumber, fullName: fullNameOf_(s), gender: s.gender, programme: s.programme, specialisation: s.specialisation,
      yearOfAdmission: admissionYear, session: sessionLabel_(admissionYear), thesisTitle: s.thesisTitle || '', titleStatus: titleState_(s).status, currentStage: s.currentStage, email: s.email, phoneNumber: s.phoneNumber,
      status: userByReg[String(s.regNumber)] ? userByReg[String(s.regNumber)].status : '',
      faculty: normFaculty_(s.faculty), department: s.department, passportFileId: s.passportFileId || '', stalled: isStalled_(s),
      mainSupervisorId: s.mainSupervisorId || '', coSupervisorId: s.coSupervisorId || '',
      mainSupervisor: staffById[s.mainSupervisorId] || '', coSupervisor: staffById[s.coSupervisorId] || '',
      mainSupervisorLabel: supWithRank_(staffRecById[s.mainSupervisorId]), coSupervisorLabel: supWithRank_(staffRecById[s.coSupervisorId]) };
  });
  subs.forEach(function (s) { count(byStatus, s.status); });
  users.forEach(function (u) { if (u.role === 'Student') count(userByStatus, u.status); });
  var subList = subs.map(function (s) {
    var stu = stuByReg[s.regNumber];
    return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, studentName: stu ? fullNameOf_(stu) : '', createdAt: s.createdAt,
      inspectorComments: s.inspectorComments || '', reviewedBy: s.reviewedBy || '', reviewedAt: s.reviewedAt || '', driveFileUrls: s.driveFileUrls || '' };
  });
  var staff = filterWhere_('Staff', function (s) { return toBool_(s.active); }).map(function (s) { return { id: s.id, fullName: s.fullName, rank: s.rank, load: loadOf_(s.id) }; });
  return { totalStudents: students.length, byProgramme: byProgramme, byGender: byGender, bySession: bySession, byStage: byStage,
    bySubmissionStatus: byStatus, byUserStatus: userByStatus, students: stuList, submissions: subList, staff: staff,
    seminars: seminarList_(false), examiners: examinerList_(), graduation: graduation_(students), avgDays: avgStageDays_(), timeAlerts: timeAlerts_(students),
    requests: requestList_(), role: user.role, generatedAt: nowIso_() };
}

/* =========================== 14. STAFF DASHBOARD =========================== */

function api_getStaffDashboard(token) {
  var user = requireUser_(token); assertRole_(user, ['Staff'], 'Access denied.');
  var my = filterWhere_('Students', function (s) { return supOf_(user, s); }), regMap = {};
  my.forEach(function (s) { regMap[s.regNumber] = 1; });
  var ids = [String(user.id), String(user.regNumber)];
  var lab = function (id) { var st = id && findById_('Staff', id); return st ? { name: st.fullName, email: st.email || '' } : null; };
  var subs = filterWhere_('Submissions', function (s) { return regMap[s.regNumber] && String(s.status) !== 'Draft'; });
  return {
    announcements: announcementsFor_('Staff', 10),
    meetings: filterWhere_('Meetings', function (m) { return regMap[m.regNumber]; }).map(function (m) {
      var o = stripRow_(m), stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(m.regNumber); });
      o.status = o.status || 'Logged'; o.studentName = stu ? fullNameOf_(stu) : String(m.regNumber); return o;
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 40),
    students: my.map(function (s) {
      var main = ids.indexOf(String(s.mainSupervisorId)) > -1;
      return { regNumber: s.regNumber, fullName: fullNameOf_(s), programme: s.programme, specialisation: s.specialisation, currentStage: s.currentStage,
        passportFileId: s.passportFileId || '', email: s.email, phoneNumber: s.phoneNumber, stalled: isStalled_(s),
        myRole: main ? 'Main Supervisor' : 'Co-Supervisor', other: lab(main ? s.coSupervisorId : s.mainSupervisorId) };
    }),
    submissions: subs.map(function (s) {
      var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(s.regNumber); });
      return { id: s.id, regNumber: s.regNumber, studentName: stu ? fullNameOf_(stu) : '', type: s.type, status: s.status, supervisorNotes: s.supervisorNotes,
        inspectorComments: s.inspectorComments || '', driveFileUrls: s.driveFileUrls || '', endorsedBy: s.endorsedBy || '', createdAt: s.createdAt, needsEndorsement: needsEndorsement_(s), waitingDays: daysSince_(s.createdAt) };
    })
  };
}

/* =========================== 15. PUBLIC (NO AUTH) =========================== */
/* Used by the public landing pages (index / register / contact).            */

/** Active announcements for the public Home page. */
function api_publicAnnouncements() {
  var list = filterWhere_('Announcements', function (a) { return toBool_(a.active) && String(a.title || '').trim() !== '' && annAudienceOf_(a) === 'all'; });
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return {
    items: list.slice(0, 12).map(function (a) {
      return { id: a.id, title: String(a.title || ''), body: String(a.body || ''), createdAt: String(a.createdAt || '') };
    })
  };
}

/** Status check on the public Register page: Pending / Approved / Rejected / Not Found. */
function api_checkRegistrationStatus(regNumber) {
  var reg = String(regNumber || '').trim();
  if (!validateRegNumber_(reg)) throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
  var user = findWhere_('Users', function (u) { return String(u.regNumber) === reg && u.role === 'Student'; });
  if (!user) return { status: 'Not Found', message: 'No registration found with that number. Please check and try again.' };
  var st = String(user.status || 'Pending');
  var msg = st === 'Approved' ? 'Your registration has been approved. You can now log in.'
    : st === 'Rejected' ? 'Your registration was rejected. Please contact the PG Coordinator.'
    : 'Your registration is awaiting PG Coordinator approval.';
  return { status: st, message: msg };
}

/** The active PG Coordinator's email (falls back to enquiries address). */
function coordinatorEmail_() {
  var u = filterWhere_('Users', function (x) {
    return x.role === 'PG_Coordinator' && toBool_(x.active) && EMAIL_RE.test(String(x.email || ''));
  })[0];
  if (u) return String(u.email);
  return mailEnquiriesAddress_();
}

/** Enquiry from the public Contact page — emailed to the PG Coordinator. */
function api_publicEnquiry(name, email, message) {
  var n = String(name || '').trim();
  var em = cleanEmail_(email);
  var msg = String(message || '').trim();
  if (!validateName_(n)) throw new Error('Please enter your name (at least 2 letters).');
  if (!validateEmail_(em)) throw new Error('Please enter a valid email address, e.g. name@example.com.');
  if (msg.length < 10 || msg.length > 2000) throw new Error('Message must be between 10 and 2000 characters.');
  var cache = CacheService.getScriptCache();
  var key = 'pg_enq_' + em.toLowerCase();
  var count = parseInt(cache.get(key) || '0', 10);
  if (count >= 3) throw new Error('Please wait a little before sending another enquiry.');
  cache.put(key, String(count + 1), 3600);
  sendPortalMail_({
    to: coordinatorEmail_(),
    subject: 'Postgraduate Journey Enquiry — ' + n,
    body: 'Name: ' + n + '\nEmail: ' + em + '\n\n' + msg + '\n\n(Sent from the public portal contact page)',
    htmlBody: '<h3 style="margin:0 0 8px;color:#14532d">New portal enquiry</h3>' +
      '<p style="margin:4px 0"><strong>Name:</strong> ' + escHtml_(n) + '</p>' +
      '<p style="margin:4px 0"><strong>Email:</strong> ' + escHtml_(em) + '</p>' +
      '<p style="margin:12px 0 0;white-space:pre-wrap">' + escHtml_(msg) + '</p>'
  });
  return { ok: true, message: 'Thank you. Your enquiry has been sent to the PG Coordinator.' };
}

/* =========================== 15b. EXTRA FEATURES =========================== */
function L_(fn, a) { return withScriptLock_(function () { return fn.apply(null, a); }, 30000); }
var STAGE_ON_APPROVAL = { 'Research Proposal': '5 - Proposal Defence Form', 'Progress Report': '9 - Compliance Inspection', 'Final Thesis/Dissertation': '14 - Signed Copies' };
function loadOf_(id) { return readTable_('Students').filter(function (s) { return String(s.mainSupervisorId) === String(id) || String(s.coSupervisorId) === String(id); }).length; }
function isStalled_(s) {
  var t = new Date(String(s.updatedAt || s.createdAt).replace(' ', 'T')).getTime();
  return !!t && s.currentStage !== '15 - Completion' && (Date.now() - t) / 864e5 > 90;
}
function notifyStudent_(reg, subject, text) {
  try {
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(reg); });
    addNote_(reg, subject + ': ' + String(text).slice(0, 200));
    if (u && (u.emailPref || 'instant') === 'instant' && EMAIL_RE.test(String(u.email || ''))) sendPortalMail_({ to: u.email, subject: subject + ' — ' + reg, body: 'Dear ' + (u.fullName || 'Student') + ',\n\n' + text + '\n\n' + CFG.APP_NAME });
  } catch (e) { Logger.log('notifyStudent_ failed: ' + e); }
}
function autoAdvance_(sub) {
  var target = STAGE_ON_APPROVAL[sub.type]; if (!target) return;
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(sub.regNumber); });
  if (!stu || CFG.JOURNEY_STAGES.indexOf(target) <= CFG.JOURNEY_STAGES.indexOf(stu.currentStage)) return;
  updateRow_('Students', stu.id, { currentStage: target, updatedAt: nowIso_() });
  logAudit_('system', 'auto', 'AUTO_STAGE', sub.regNumber, target);
  notifyStudent_(sub.regNumber, 'Journey stage updated', 'Your ' + sub.type + ' was approved. Your stage is now: ' + target + '.');
}
/** Emails an announcement to its audience (BCC, 50 per message). Returns the number of recipients. */
function broadcast_(title, body, audience, programme) {
  var wantStu = audience === 'students' || audience === 'all', wantStaff = audience === 'staff' || audience === 'all';
  var stuRegs = {};
  if (wantStu) readTable_('Students').forEach(function (s) { if (!programme || programme === 'all' || s.programme === programme) stuRegs[s.regNumber] = 1; });
  var seen = {}, list = [];
  readTable_('Users').forEach(function (u) {
    var em = String(u.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em) || seen[em] || String(u.status) !== 'Approved' || !toBool_(u.active)) return;
    var isStu = u.role === 'Student';
    if ((isStu && wantStu && stuRegs[u.regNumber]) || (!isStu && wantStaff)) { seen[em] = 1; list.push(em); }
  });
  for (var i = 0; i < list.length; i += 50) sendPortalMail_({ to: coordinatorEmail_(), bcc: list.slice(i, i + 50).join(','), subject: 'Announcement: ' + title, body: body });
  return list.length;
}
function upcomingDeadlines_() {
  var today = nowIso_().slice(0, 10);
  return filterWhere_('Deadlines', function (d) { return String(d.date) >= today; }).map(stripRow_).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
}
function api_addDeadline_l(token, title, date) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot add deadlines.');
  if (!String(title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Title and a valid date are required.');
  var r = appendRow_('Deadlines', { title: String(title).trim().slice(0, 200), date: date, createdBy: user.id, createdAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'ADD_DEADLINE', r.id, title + ' ' + date); return { id: r.id };
}
function api_addDeadline() { return L_(api_addDeadline_l, arguments); }
/** Run installReminderTrigger() once: emails students 7 days and 1 day before each deadline. */
function installReminderTrigger() { ScriptApp.newTrigger('sendDeadlineReminders').timeBased().everyDays(1).atHour(8).create(); }
function sendDeadlineReminders() {
  [7, 1].forEach(function (n) {
    var d = new Date(Date.now() + n * 864e5), key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    filterWhere_('Deadlines', function (x) { return String(x.date) === key; }).forEach(function (x) { broadcast_('Reminder: ' + x.title, x.title + ' is due on ' + x.date + ' (' + n + ' day(s) from now).', 'all'); });
  });
}
function api_addMeeting_l(token, reg, date, notes, actions) {
  var user = requireUser_(token); assertRole_(user, ['Staff', 'PG_Coordinator'], 'You cannot log meetings.');
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(reg); });
  if (!stu) throw new Error('Student not found.');
  if (user.role === 'Staff' && !supOf_(user, stu)) throw new Error('Not your student.');
  if (!String(notes || '').trim()) throw new Error('Meeting notes are required.');
  var r = appendRow_('Meetings', { regNumber: reg, date: String(date || nowIso_().slice(0, 10)), notes: String(notes).slice(0, 3000), actions: String(actions || '').slice(0, 2000), createdBy: user.fullName, createdAt: nowIso_(), status: 'Logged' });
  logAudit_(user.id, user.regNumber, 'LOG_MEETING', reg, String(notes).slice(0, 80));
  notifyStudent_(reg, 'Supervision meeting logged', 'A meeting on ' + date + ' was logged by ' + user.fullName + '.\nAction points: ' + (actions || 'None')); return { id: r.id };
}
function api_addMeeting() { return L_(api_addMeeting_l, arguments); }

/* ---- scheduled supervision meetings (with calendar file), recording notes, student acknowledgement ---- */
function meetingAccess_(user, m) {
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(m.regNumber); });
  if (!stu) throw new Error('Student not found.');
  if (user.role === 'Staff' && !supOf_(user, stu)) throw new Error('Not your student.');
  if (['Staff', 'PG_Coordinator'].indexOf(user.role) === -1) throw new Error('You cannot manage meetings.');
  return stu;
}
function icsEsc_(t) { return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function meetingIcs_(m, stuName) {
  var d = String(m.date).replace(/-/g, ''), t = String(m.time || '10:00').split(':'), h = parseInt(t[0], 10), mi = t[1] || '00';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var start = d + 'T' + pad(h) + mi + '00', end = d + 'T' + pad(Math.min(h + 1, 23)) + mi + '00';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + icsEsc_(CFG.APP_NAME) + '//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:meeting-' + m.id + '@pg-portal', 'DTSTAMP:' + Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"), 'DTSTART:' + start, 'DTEND:' + end,
    'SUMMARY:' + icsEsc_('Supervision meeting \u2014 ' + stuName), 'LOCATION:' + icsEsc_(m.venue), 'DESCRIPTION:' + icsEsc_(m.notes), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function api_scheduleMeeting_l(token, reg, date, time, venue, agenda) {
  var user = requireUser_(token); assertRole_(user, ['Staff', 'PG_Coordinator'], 'You cannot schedule meetings.');
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(reg); });
  if (!stu) throw new Error('Student not found.');
  if (user.role === 'Staff' && !supOf_(user, stu)) throw new Error('Not your student.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Choose the meeting date.');
  if (String(date) < nowIso_().slice(0, 10)) throw new Error('The meeting date cannot be in the past.');
  var tm = String(time || '10:00').trim(); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) throw new Error('Enter the time as HH:MM (24-hour).');
  var r = appendRow_('Meetings', { regNumber: reg, date: date, time: tm, venue: String(venue || '').trim().slice(0, 200), notes: String(agenda || '').trim().slice(0, 1000), actions: '', createdBy: user.fullName, createdAt: nowIso_(), status: 'Scheduled' });
  var name = fullNameOf_(stu), ics = meetingIcs_({ id: r.id, date: date, time: tm, venue: r.venue, notes: r.notes }, name);
  var to = {}; [stu.email, user.email].concat(supervisorEmails_([stu.mainSupervisorId, stu.coSupervisorId])).forEach(function (e) { e = String(e || '').trim().toLowerCase(); if (EMAIL_RE.test(e)) to[e] = 1; });
  var addrs = Object.keys(to);
  if (addrs.length) { try { sendPortalMail_({ to: addrs.join(','), subject: 'Supervision meeting ' + date + ' ' + tm + ' \u2014 ' + name,
    body: 'A supervision meeting has been scheduled.\n\nStudent: ' + name + ' (' + reg + ')\nDate: ' + date + '\nTime: ' + tm + '\nVenue: ' + (r.venue || 'To be confirmed') + (r.notes ? '\nAgenda: ' + r.notes : '') + '\nScheduled by: ' + user.fullName + '\n\nOpen the attached calendar file to add it to your calendar.',
    attachments: [Utilities.newBlob(ics, 'text/calendar', 'supervision-meeting.ics')] }); } catch (e) { Logger.log('meeting mail: ' + e); } }
  addNote_(reg, 'Meeting scheduled by ' + user.fullName + ': ' + date + ' ' + tm + (r.venue ? ' at ' + r.venue : ''));
  logAudit_(user.id, user.regNumber, 'SCHEDULE_MEETING', reg, date + ' ' + tm);
  return { id: r.id };
}
function api_scheduleMeeting() { return L_(api_scheduleMeeting_l, arguments); }
function api_completeMeeting_l(token, id, notes, actions) {
  var user = requireUser_(token), m = findById_('Meetings', id); if (!m) throw new Error('Meeting not found.');
  meetingAccess_(user, m);
  if ((m.status || 'Logged') !== 'Scheduled') throw new Error('Only scheduled meetings can be completed.');
  if (!String(notes || '').trim()) throw new Error('Meeting notes are required.');
  updateRow_('Meetings', id, { notes: String(notes).trim().slice(0, 3000), actions: String(actions || '').trim().slice(0, 2000), status: 'Logged', createdBy: user.fullName });
  logAudit_(user.id, user.regNumber, 'LOG_MEETING', m.regNumber, String(notes).slice(0, 80));
  notifyStudent_(m.regNumber, 'Meeting notes recorded', 'Notes for your meeting on ' + m.date + ' were recorded by ' + user.fullName + '.\nAction points: ' + (actions || 'None') + '\nPlease open your dashboard and acknowledge them.');
  return { ok: true };
}
function api_completeMeeting() { return L_(api_completeMeeting_l, arguments); }
function api_cancelMeeting_l(token, id) {
  var user = requireUser_(token), m = findById_('Meetings', id); if (!m) throw new Error('Meeting not found.');
  meetingAccess_(user, m);
  if ((m.status || 'Logged') !== 'Scheduled') throw new Error('Only scheduled meetings can be cancelled.');
  updateRow_('Meetings', id, { status: 'Cancelled' });
  notifyStudent_(m.regNumber, 'Meeting cancelled', 'The meeting on ' + m.date + (m.time ? ' ' + m.time : '') + ' was cancelled by ' + user.fullName + '.');
  logAudit_(user.id, user.regNumber, 'CANCEL_MEETING', m.regNumber, m.date);
  return { ok: true };
}
function api_cancelMeeting() { return L_(api_cancelMeeting_l, arguments); }
function api_ackMeeting_l(token, id) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can acknowledge meeting notes.');
  var m = findById_('Meetings', id);
  if (!m || String(m.regNumber) !== String(user.regNumber)) throw new Error('Meeting not found.');
  if ((m.status || 'Logged') !== 'Logged') throw new Error('There are no notes to acknowledge yet.');
  if (m.ackAt) throw new Error('You have already acknowledged these notes.');
  updateRow_('Meetings', id, { ackAt: nowIso_() });
  var by = findWhere_('Users', function (u) { return String(u.fullName) === String(m.createdBy) && u.role !== 'Student'; });
  if (by) addNote_(by.regNumber, user.fullName + ' acknowledged the notes of the meeting on ' + m.date);
  logAudit_(user.id, user.regNumber, 'ACK_MEETING', id, m.date);
  return { ok: true };
}
function api_ackMeeting() { return L_(api_ackMeeting_l, arguments); }
function api_resubmit_l(token, id, url) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can resubmit.');
  var sub = findById_('Submissions', id);
  if (!sub || String(sub.regNumber) !== String(user.regNumber)) throw new Error('Submission not found.');
  if (['Rejected', 'Changes Requested'].indexOf(sub.status) === -1) throw new Error('Only rejected or change-requested submissions can be resubmitted.');
  var stuForStage = findWhere_('Students', function (x) { return String(x.regNumber) === String(user.regNumber); });
  validateSubmissionStage_(stuForStage, sub.type);
  if (!urlsFromText_(url).length) throw new Error('A valid link is required.');
  updateRow_('Submissions', id, { history: pushHistory_(sub, { at: nowIso_(), by: user.fullName, status: 'Resubmitted', comments: 'New file: ' + String(url).trim() }), driveFileUrls: String(url).trim(), status: 'Submitted', supervisorNotes: String(sub.supervisorNotes || ''), updatedAt: nowIso_(), compliance: '' });
  logAudit_(user.id, user.regNumber, 'RESUBMIT', id, 'After: ' + sub.status + ' / ' + String(sub.inspectorComments || '').slice(0, 80)); return { ok: true };
}
function api_resubmit() {
  var res = L_(api_resubmit_l, arguments);
  try { var sub = findById_('Submissions', arguments[1]); if (sub) shareSubmissionFiles_(sub); } catch (e) { Logger.log('share after resubmit: ' + e); }
  return res;
}
function api_resetStudentPassword_l(token, reg) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can reset passwords.');
  var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(reg) && x.role === 'Student'; });
  if (!u) throw new Error('Student account not found.');
  var pw = issueTempPassword_(u), sent = false;
  logAudit_(user.id, user.regNumber, 'RESET_PASSWORD', reg, 'Reset to a new one-time password');
  addNote_(reg, 'Your password was reset by the PG Coordinator. Check your email for the one-time password.');
  try {
    sent = sendPortalMail_({ to: u.email, subject: 'Password reset — ' + reg, body: 'Dear ' + (u.fullName || 'Student') + ',\n\nYour password was reset by the PG Coordinator.\nOne-time password: ' + pw + '\n\nSign in with it and you will be asked to choose a new password.\n\n' + CFG.APP_NAME,
      htmlBody: '<p style="margin:0 0 12px">Dear <strong>' + escHtml_(u.fullName || 'Student') + '</strong>, your password was reset by the PG Coordinator.</p><p style="margin:0 0 12px">One-time password: <strong style="font-family:monospace">' + escHtml_(pw) + '</strong></p><p style="color:#66756f;font-size:13px">Sign in with it and you will be asked to choose a new password.</p>' });
  } catch (e) { Logger.log('reset mail failed: ' + e); }
  return sent ? { ok: true, emailed: true } : { ok: true, emailed: false, tempPassword: pw };   // only revealed to the Coordinator when the email could not be sent
}
function api_resetStudentPassword() { return L_(api_resetStudentPassword_l, arguments); }
function api_getAuditLog(token) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD', 'SuperAdmin'], 'Access denied.');
  return readTableTail_('AuditLog', 300).reverse().map(function (r) { return { at: r.at, actor: r.actorUsername, action: r.action, target: r.target, detail: r.detail }; });
}

/* =========================== 15c. RESET, UPLOAD, BELL, MESSAGES, CHECKLIST =========================== */
function supOf_(user, s) { var ids = [String(user.id), String(user.regNumber)]; return ids.indexOf(String(s.mainSupervisorId)) > -1 || ids.indexOf(String(s.coSupervisorId)) > -1; }
function checklistFor_(type) {
  if (type === 'Internal Examiner and Other Observations') return ['Document is complete and legible', 'Examiner(s) clearly identified'];
  if (type === 'Comment-by-Comment Response (External Examiner)' || type === 'Comment-by-Comment Response (Internal Examiner)')
    return ['Every examiner comment has a response', 'Each response states where the thesis was changed', 'Supervisor endorsement attached'];
  if (type === 'Final Correction')
    return ['Formatting meets departmental guidelines', 'References complete and consistent', 'Examiners\u2019 corrections addressed', 'Supervisor endorsement attached'];
  var l = ['Formatting meets departmental guidelines', 'References complete and consistent', 'Similarity / plagiarism within allowed limit', 'Supervisor endorsement attached'];
  if (type === 'Final Thesis/Dissertation') l.push('Examiners\u2019 corrections addressed');
  return l;
}
function addNote_(reg, text) { try { appendRow_('Notifications', { regNumber: reg, text: String(text).slice(0, 300), read: false, createdAt: nowIso_() }); } catch (e) { Logger.log('addNote_ ' + e); } }
function api_getNotifications(token) {
  var user = requireUser_(token);
  var mine = readTableTail_('Notifications', 1500).filter(function (n) { return String(n.regNumber) === String(user.regNumber); });
  return { unread: mine.filter(function (n) { return !toBool_(n.read); }).length, items: mine.slice(-30).reverse().map(function (n) { return { text: n.text, at: n.createdAt, read: toBool_(n.read) }; }) };
}
function api_markNotificationsRead(token) {
  var user = requireUser_(token);
  var unread = readTableTail_('Notifications', 1500).filter(function (n) { return String(n.regNumber) === String(user.regNumber) && !toBool_(n.read); });
  if (unread.length) withScriptLock_(function () {
    var sheet = getSheet_('Notifications'), headers = sheetHeaders_('Notifications');
    unread.forEach(function (n) { writeRowPatch_(sheet, headers, n._row, { read: true }); });
    invalidateTable_('Notifications');
  }, 30000);
  return { ok: true };
}
/* ---- self-service password reset (public) ---- */
function api_requestReset(regNumber) {
  var reg = String(regNumber || '').trim(), cache = CacheService.getScriptCache(), msg = { message: 'If that account exists, a 6-digit code has been emailed to the address on file. It expires in 30 minutes.' };
  if (!reg) throw new Error('Enter your registration number or staff ID.');
  var n = parseInt(cache.get('rstn_' + reg) || '0', 10);
  if (n >= 3) throw new Error('Too many requests. Please try again in an hour.');
  cache.put('rstn_' + reg, String(n + 1), 3600);
  var u = findWhere_('Users', function (x) { return String(x.regNumber) === reg && toBool_(x.active) && String(x.status) === 'Approved'; });
  if (u && EMAIL_RE.test(String(u.email || ''))) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('rst_' + reg, hashPassword_(code, reg), 1800); cache.remove('rsta_' + reg);
    sendPortalMail_({ to: u.email, subject: 'Password reset code', body: 'Your password reset code is ' + code + '. It expires in 30 minutes. If you did not request this, ignore this email.' });
  }
  return msg;
}
function api_resetWithCode(regNumber, code, newPassword) {
  var reg = String(regNumber || '').trim(), cache = CacheService.getScriptCache();
  var tries = parseInt(cache.get('rsta_' + reg) || '0', 10), stored = cache.get('rst_' + reg);
  if (!stored || tries >= 5) throw new Error('Code expired or too many attempts. Request a new code.');
  if (hashPassword_(String(code || '').trim(), reg) !== stored) { cache.put('rsta_' + reg, String(tries + 1), 1800); throw new Error('Incorrect code.'); }
  assertStrongPassword_(newPassword, reg);
  var u = findWhere_('Users', function (x) { return String(x.regNumber) === reg; });
  if (!u) throw new Error('Account not found.');
  var salt = makeSalt_();
  updateRow_('Users', u.id, { passwordHash: hashPassword_(newPassword, salt), salt: salt, firstLogin: false });
  bumpSessionEpoch_(u.id); cache.remove('rst_' + reg);
  logAudit_(u.id, reg, 'PASSWORD_RESET_SELF', reg, 'Via emailed code'); return { ok: true };
}
/* ---- submission file upload ---- */
var SUB_MIME_BY_EXT = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
function submissionsFolder_() {
  var root = DriveApp.getFolderById(getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID));
  var it = root.getFoldersByName('Submissions');
  return it.hasNext() ? it.next() : root.createFolder('Submissions');
}
function shareViewable_(file) { try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('Share failed: ' + e); } }

/** Small files (up to SMALL_UPLOAD_BYTES): one call. Larger files use api_beginLargeUpload / api_uploadLargeChunk. */
function api_uploadSubmissionFile(token, p) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can upload.');
  var parts = String((p && p.dataUrl) || '').split(','), mm = parts[0].match(/data:(.*?);/), mime = mm ? mm[1] : '';
  var ok = { 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
  if (!ok[mime]) throw new Error('Upload a PDF, DOC or DOCX file.');
  var bytes = Utilities.base64Decode(parts[1]);
  if (bytes.length > CFG.SMALL_UPLOAD_BYTES) throw new Error('Use the large-file upload for files over 10 MB.');
  var file = submissionsFolder_().createFile(Utilities.newBlob(bytes, mime, String(user.regNumber).replace(/[\/\\]/g, '-') + '_' + new Date().getTime() + '.' + ok[mime]));
  shareViewable_(file);
  return { url: file.getUrl(), id: file.getId() };
}

/** Large files (up to 50 MB): the browser sends the file in 3 MB pieces; the server relays each piece into a
 *  Drive resumable-upload session, so the whole file is never held in memory.
 *  Requires the Drive API service to be enabled for the script project (see notes in the deployment steps). */
function api_beginLargeUpload(token, meta) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can upload.');
  var name = String((meta && meta.name) || ''), ext = (name.split('.').pop() || '').toLowerCase(), mime = SUB_MIME_BY_EXT[ext];
  if (!mime) throw new Error('Upload a PDF, DOC or DOCX file.');
  var size = Number(meta && meta.size);
  if (!size || size < 1) throw new Error('That file is empty.');
  if (size > CFG.SUBMISSION_MAX_BYTES) throw new Error('File must be 50 MB or smaller.');
  var folder = submissionsFolder_();
  var fname = String(user.regNumber).replace(/[\/\\]/g, '-') + '_' + new Date().getTime() + '.' + ext;
  var resp = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: fname, mimeType: mime, parents: [folder.getId()] })
  });
  var h = resp.getAllHeaders ? resp.getAllHeaders() : resp.getHeaders();
  var loc = h['Location'] || h['location'];
  if (resp.getResponseCode() !== 200 || !loc) {
    Logger.log('beginLargeUpload failed: ' + resp.getResponseCode() + ' ' + String(resp.getContentText()).slice(0, 300));
    throw new Error('Large-file upload is not available right now. Please upload a file under 10 MB, or contact ' + mailEnquiriesAddress_() + '.');
  }
  var uploadId = uuid_();
  CacheService.getScriptCache().put('upl_' + uploadId, JSON.stringify({ reg: String(user.regNumber), loc: String(loc), size: size, mime: mime, next: 0 }), 21600);
  return { uploadId: uploadId, chunkBytes: 3 * 1024 * 1024 };
}
function api_uploadLargeChunk(token, uploadId, start, b64) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can upload.');
  var cache = CacheService.getScriptCache(), raw = cache.get('upl_' + String(uploadId));
  if (!raw) throw new Error('This upload expired. Please start it again.');
  var st = JSON.parse(raw);
  if (st.reg !== String(user.regNumber)) throw new Error('This upload does not belong to you.');
  start = Number(start);
  if (start !== st.next) throw new Error('The upload got out of sequence. Please start it again.');
  var bytes = Utilities.base64Decode(String(b64 || ''));
  if (!bytes.length) throw new Error('Empty upload piece.');
  var end = start + bytes.length - 1;
  if (end >= st.size) throw new Error('Upload is larger than declared.');
  var last = end === st.size - 1;
  if (!last && bytes.length % 262144 !== 0) throw new Error('Invalid upload piece size.');
  var r = UrlFetchApp.fetch(st.loc, { method: 'put', contentType: st.mime, muteHttpExceptions: true, payload: bytes,
    headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size } });
  var code = r.getResponseCode();
  if (code === 308) { st.next = end + 1; cache.put('upl_' + String(uploadId), JSON.stringify(st), 21600); return { done: false, next: st.next }; }
  if (code === 200 || code === 201) {
    cache.remove('upl_' + String(uploadId));
    var id = JSON.parse(r.getContentText()).id, file = DriveApp.getFileById(id);
    shareViewable_(file);
    return { done: true, url: file.getUrl(), id: id };
  }
  Logger.log('uploadLargeChunk failed: ' + code + ' ' + String(r.getContentText()).slice(0, 300));
  throw new Error('Upload failed (' + code + '). Please try again.');
}
/* ---- student <-> supervisor messages ---- */
function canThread_(user, stu) {
  if (user.role === 'Student') return String(stu.regNumber) === String(user.regNumber);
  if (user.role === 'Staff') return supOf_(user, stu);
  return user.role === 'PG_Coordinator' || user.role === 'HoD';
}
function threadStudent_(user, reg) {
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.role === 'Student' ? user.regNumber : reg); });
  if (!stu || !canThread_(user, stu)) throw new Error('You cannot access this conversation.');
  return stu;
}
function api_listMessages(token, reg) {
  var user = requireUser_(token), stu = threadStudent_(user, reg), sheet = null, headers = null, wrote = false;
  var out = readTable_('Messages').filter(function (m) { return String(m.regNumber) === String(stu.regNumber); }).map(function (m) {
    var rb = String(m.readBy || '').split('|').filter(Boolean);
    if (m.fromName !== user.fullName && rb.indexOf(user.fullName) === -1) {
      rb.push(user.fullName);
      try { if (!sheet) { sheet = getSheet_('Messages'); headers = sheetHeaders_('Messages'); } writeRowPatch_(sheet, headers, m._row, { readBy: rb.join('|') }); wrote = true; } catch (e) { Logger.log('mark message read: ' + e); }
    }
    return { from: m.fromName, role: m.fromRole, text: m.text, at: m.createdAt, readBy: rb.filter(function (n) { return n !== m.fromName; }) };
  });
  if (wrote) invalidateTable_('Messages');
  return out;
}
function api_sendMessage_l(token, reg, text) {
  var user = requireUser_(token), stu = threadStudent_(user, reg), t = String(text || '').trim();
  if (!t) throw new Error('Message cannot be empty.');
  appendRow_('Messages', { regNumber: stu.regNumber, fromName: user.fullName, fromRole: user.role, text: t.slice(0, 2000), createdAt: nowIso_() });
  if (user.role === 'Student') {
    [stu.mainSupervisorId, stu.coSupervisorId].forEach(function (id) {
      var st = id && findById_('Staff', id); if (!st) return;
      var su = findWhere_('Users', function (u) { return String(u.regNumber) === String(id) || (st.email && String(u.email).toLowerCase() === String(st.email).toLowerCase()); });
      if (su) addNote_(su.regNumber, 'Message from ' + user.fullName + ': ' + t.slice(0, 80));
      if (st.email && EMAIL_RE.test(String(st.email))) { try { sendPortalMail_({ to: st.email, subject: 'New message from ' + user.fullName, body: t + '\n\nReply in the portal (Messages).' }); } catch (e) {} }
    });
  } else notifyStudent_(stu.regNumber, 'New message from ' + user.fullName, t.slice(0, 200));
  return { ok: true };
}
function api_sendMessage() { return L_(api_sendMessage_l, arguments); }


/* =========================== 15c-2. INQUIRIES (student -> PG Coordinator / HoD) ===========================
 *  Ticket-style: subject + category + status (Open / Answered / Closed) with a reply thread.
 *  A student sees only their own tickets; PG Coordinator and HoD see and answer all of them.
 *  This is separate from the student<->supervisor chat (Messages) and the Requests form. */
var INQUIRY_CATEGORIES = ['Registration / Records', 'Supervision / Supervisor', 'Journey Stage / Progression', 'Submissions / Documents', 'Thesis / Dissertation Title', 'Seminar / Defence / Examination', 'Fees / Administration', 'Other'];
var INQUIRY_STATUSES = ['Open', 'Answered', 'Closed'];
var INQUIRY_MAX_OPEN = 10;
function inquiryItem_(q) {
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(q.regNumber); });
  return { id: q.id, regNumber: q.regNumber, studentName: stu ? fullNameOf_(stu) : String(q.regNumber), programme: stu ? stu.programme : '',
    subject: String(q.subject || ''), category: String(q.category || ''), status: String(q.status || 'Open'),
    createdAt: String(q.createdAt || ''), updatedAt: String(q.updatedAt || q.createdAt || ''), lastBy: String(q.lastBy || ''),
    closedBy: String(q.closedBy || ''), closedAt: String(q.closedAt || ''), thread: parseHist_(q.thread) };
}
/** Active PG Coordinator + HoD users (the people who handle inquiries). */
function inquiryHandlers_(exceptId) {
  return filterWhere_('Users', function (u) { return (u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active) && String(u.status) === 'Approved' && String(u.id) !== String(exceptId || ''); });
}
function notifyInquiryHandlers_(subject, text, mailBody, exceptId) {
  var hs = inquiryHandlers_(exceptId), to = {};
  hs.forEach(function (u) { addNote_(u.regNumber, text); if (EMAIL_RE.test(String(u.email || ''))) to[String(u.email).toLowerCase()] = 1; });
  if (!Object.keys(to).length) to[coordinatorEmail_()] = 1;
  Object.keys(to).forEach(function (addr) { try { sendPortalMail_({ to: addr, subject: subject, body: mailBody }); } catch (e) { Logger.log('inquiry mail: ' + e); } });
}
function inquiryFor_(user, id) {
  var q = findById_('Inquiries', id);
  if (!q) throw new Error('Inquiry not found.');
  var staff = hasRole_(user, ['PG_Coordinator', 'HoD']);
  if (!staff && !(user.role === 'Student' && String(q.regNumber) === String(user.regNumber))) throw new Error('You cannot open this inquiry.');
  return q;
}
function inquiryStats_(items) {
  var by = {}, tot = { count: 0, open: 0, answered: 0, closed: 0, hrs: [] };
  var ms = function (t) { return new Date(String(t).replace(' ', 'T')).getTime(); };
  items.forEach(function (q) {
    var c = by[q.category] = by[q.category] || { category: q.category, count: 0, open: 0, hrs: [] };
    c.count++; tot.count++;
    if (q.status === 'Open') { c.open++; tot.open++; } else if (q.status === 'Answered') tot.answered++; else tot.closed++;
    var first = q.thread.filter(function (m) { return m.role !== 'Student' && m.role !== 'System'; })[0];
    if (first && q.thread[0] && ms(first.at) && ms(q.thread[0].at)) { var h = (ms(first.at) - ms(q.thread[0].at)) / 36e5; if (h >= 0) { c.hrs.push(h); tot.hrs.push(h); } }
  });
  var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 10) / 10 : null; };
  return { overall: { count: tot.count, open: tot.open, answered: tot.answered, closed: tot.closed, avgFirstReplyHours: avg(tot.hrs) },
    byCategory: Object.keys(by).sort().map(function (k) { return { category: k, count: by[k].count, open: by[k].open, avgFirstReplyHours: avg(by[k].hrs) }; }) };
}
function api_listInquiries(token) {
  var user = requireUser_(token);
  assertRole_(user, ['Student', 'PG_Coordinator', 'HoD'], 'You cannot view inquiries.');
  var rows = readTable_('Inquiries');
  if (user.role === 'Student') rows = rows.filter(function (q) { return String(q.regNumber) === String(user.regNumber); });
  var items = rows.map(inquiryItem_);
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return { categories: INQUIRY_CATEGORIES, items: items, stats: user.role === 'Student' ? null : inquiryStats_(items) };
}
/** Only Google Drive / Docs links produced by the portal's own upload are accepted as attachments. */
function cleanAttachUrl_(u) { u = String(u || '').trim(); return /^https:\/\/(drive|docs)\.google\.com\/[^\s]+$/.test(u) ? u : ''; }
function api_uploadInquiryFile(token, p) {
  var user = requireUser_(token); assertRole_(user, ['Student', 'PG_Coordinator', 'HoD'], 'You cannot attach files here.');
  var parts = String((p && p.dataUrl) || '').split(','), mm = parts[0].match(/data:(.*?);/), mime = mm ? mm[1] : '';
  var ok = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
  if (!ok[mime]) throw new Error('Attach a PDF, Word document, PNG or JPG.');
  var bytes = Utilities.base64Decode(parts[1] || ''); if (bytes.length > 5 * 1024 * 1024) throw new Error('Attachment must be under 5 MB.');
  var root = DriveApp.getFolderById(getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID)), it = root.getFoldersByName('Attachments'), folder = it.hasNext() ? it.next() : root.createFolder('Attachments');
  var file = folder.createFile(Utilities.newBlob(bytes, mime, 'inq_' + new Date().getTime() + '.' + ok[mime]));
  shareViewable_(file);
  return { url: file.getUrl() };
}
function api_createInquiry_l(token, category, subject, text, attachUrl) {
  var user = requireUser_(token);
  assertRole_(user, ['Student'], 'Only students can send inquiries.');
  if (INQUIRY_CATEGORIES.indexOf(String(category)) === -1) throw new Error('Choose a category.');
  var subj = String(subject || '').replace(/\s+/g, ' ').trim(), body = String(text || '').trim(), att = cleanAttachUrl_(attachUrl);
  if (subj.length < 5) throw new Error('Please enter a subject (at least 5 characters).');
  if (subj.length > 150) throw new Error('The subject must be 150 characters or fewer.');
  if (body.length < 10) throw new Error('Please describe your inquiry (at least 10 characters).');
  if (body.length > 2000) throw new Error('The message must be 2000 characters or fewer.');
  var openCount = filterWhere_('Inquiries', function (q) { return String(q.regNumber) === String(user.regNumber) && String(q.status) !== 'Closed'; }).length;
  if (openCount >= INQUIRY_MAX_OPEN) throw new Error('You have ' + openCount + ' unresolved inquiries. Please close the ones that are settled before opening a new one.');
  var now = nowIso_();
  var row = appendRow_('Inquiries', { regNumber: user.regNumber, subject: subj, category: category, status: 'Open',
    thread: JSON.stringify([{ from: user.fullName, role: 'Student', text: body + (att ? '\n' + att : ''), at: now }]), createdAt: now, updatedAt: now, lastBy: 'Student', closedBy: '', closedAt: '' });
  logAudit_(user.id, user.regNumber, 'CREATE_INQUIRY', row.id, category + ': ' + subj);
  notifyInquiryHandlers_('New inquiry (' + category + ') — ' + user.regNumber,
    'New inquiry from ' + user.fullName + ' (' + category + '): ' + subj,
    user.fullName + ' (' + user.regNumber + ') sent an inquiry.\nCategory: ' + category + '\nSubject: ' + subj + '\n\n' + body + '\n\nReply in the portal (Inquiries).', null);
  return { id: row.id };
}
function api_createInquiry() { return L_(api_createInquiry_l, arguments); }
function api_replyInquiry_l(token, id, text, attachUrl) {
  var user = requireUser_(token), q = inquiryFor_(user, id), body = String(text || '').trim(), att = cleanAttachUrl_(attachUrl);
  if (!body && !att) throw new Error('Message cannot be empty.');
  if (body.length > 2000) throw new Error('The message must be 2000 characters or fewer.');
  if (String(q.status) === 'Closed') throw new Error(user.role === 'Student' ? 'This inquiry is closed. Please open a new inquiry.' : 'This inquiry is closed. Reopen it before replying.');
  var full = (body + (att ? (body ? '\n' : '') + att : '')).trim();
  var student = user.role === 'Student', now = nowIso_(), thread = parseHist_(q.thread);
  thread.push({ from: user.fullName, role: user.role, text: full, at: now });
  updateRow_('Inquiries', q.id, { thread: JSON.stringify(thread.slice(-40)), status: student ? 'Open' : 'Answered', updatedAt: now, lastBy: student ? 'Student' : user.role });
  logAudit_(user.id, user.regNumber, student ? 'INQUIRY_FOLLOWUP' : 'INQUIRY_REPLY', q.id, String(q.subject).slice(0, 80));
  if (student) {
    notifyInquiryHandlers_('Inquiry follow-up — ' + user.regNumber, 'Follow-up from ' + user.fullName + ': ' + q.subject,
      user.fullName + ' (' + user.regNumber + ') replied on "' + q.subject + '":\n\n' + full + '\n\nReply in the portal (Inquiries).', null);
  } else {
    notifyStudent_(q.regNumber, 'Reply to your inquiry "' + String(q.subject).slice(0, 60) + '"', user.fullName + ' (' + (ROLE_NAMES_[user.role] || user.role) + ') replied:\n\n' + full + '\n\nOpen the portal (Inquiries) to see the full conversation.');
    inquiryHandlers_(user.id).forEach(function (u) { addNote_(u.regNumber, user.fullName + ' replied to inquiry: ' + q.subject + ' (' + q.regNumber + ')'); });
  }
  return { ok: true };
}
function api_replyInquiry() { return L_(api_replyInquiry_l, arguments); }
/** PG Coordinator / HoD asks a supervisor for input on an inquiry. The student sees only that it was forwarded. */
function api_forwardInquiry_l(token, id, staffId, note) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot forward inquiries.');
  var q = inquiryFor_(user, id), st = findById_('Staff', staffId);
  if (!st || !toBool_(st.active)) throw new Error('Choose a supervisor from the list.');
  var item = inquiryItem_(q), thread = item.thread, now = nowIso_(), n = String(note || '').trim().slice(0, 500);
  thread.push({ from: user.fullName, role: 'System', text: 'Forwarded to ' + st.fullName + ' for input.', at: now });
  updateRow_('Inquiries', q.id, { thread: JSON.stringify(thread.slice(-40)), updatedAt: now });
  var convo = thread.filter(function (m) { return m.role !== 'System'; }).slice(-4).map(function (m) { return '[' + (ROLE_NAMES_[m.role] || m.role) + '] ' + m.from + ': ' + m.text; }).join('\n\n');
  var su = staffUserFor_(staffId);
  if (su) addNote_(su.regNumber, 'Inquiry forwarded to you: ' + q.subject + ' (' + item.studentName + ')');
  if (EMAIL_RE.test(String(st.email || ''))) {
    try { sendPortalMail_({ to: st.email, subject: 'Inquiry forwarded for your input — ' + q.regNumber, replyTo: EMAIL_RE.test(String(user.email || '')) ? user.email : '',
      body: user.fullName + ' (' + (ROLE_NAMES_[user.role] || user.role) + ') forwarded a student inquiry to you.\n\nStudent: ' + item.studentName + ' (' + q.regNumber + ')\nCategory: ' + q.category + '\nSubject: ' + q.subject + '\n\n' + convo + (n ? '\n\nNote from ' + user.fullName + ': ' + n : '') + '\n\nPlease reply to the student through Messages in the portal, or let the PG Coordinator know your advice.' }); } catch (e) { Logger.log('forward mail: ' + e); }
  }
  logAudit_(user.id, user.regNumber, 'FORWARD_INQUIRY', q.id, 'To ' + st.fullName);
  return { ok: true };
}
function api_forwardInquiry() { return L_(api_forwardInquiry_l, arguments); }

function api_setInquiryStatus_l(token, id, status) {
  var user = requireUser_(token), q = inquiryFor_(user, id), student = user.role === 'Student';
  status = String(status || '');
  if (['Open', 'Closed'].indexOf(status) === -1) throw new Error('Invalid status.');
  if (student && status !== 'Closed') throw new Error('Only the PG Coordinator or HoD can reopen an inquiry.');
  if (String(q.status) === status) throw new Error('This inquiry is already ' + status.toLowerCase() + '.');
  var now = nowIso_();
  updateRow_('Inquiries', q.id, { status: status, updatedAt: now, lastBy: student ? 'Student' : user.role, closedBy: status === 'Closed' ? user.fullName : '', closedAt: status === 'Closed' ? now : '' });
  logAudit_(user.id, user.regNumber, status === 'Closed' ? 'CLOSE_INQUIRY' : 'REOPEN_INQUIRY', q.id, String(q.subject).slice(0, 80));
  if (!student) notifyStudent_(q.regNumber, 'Inquiry ' + status.toLowerCase(), 'Your inquiry "' + q.subject + '" was ' + (status === 'Closed' ? 'closed' : 'reopened') + ' by ' + user.fullName + '.');
  return { ok: true };
}
function api_setInquiryStatus() { return L_(api_setInquiryStatus_l, arguments); }

/* ---- direct & bulk messages (PG Coordinator, HoD, Staff) ----
 *  PG Coordinator / HoD : individual user | all students | all staff | every user
 *  Staff                : an individual assigned student | all assigned students            */
var MSG_SCOPES = ['individual', 'students', 'staff', 'all', 'myStudents'];
function msgActiveUsers_() {
  return readTable_('Users').filter(function (u) { return String(u.status) === 'Approved' && toBool_(u.active); });
}
function assignedRegs_(user) {
  var mine = {};
  readTable_('Students').forEach(function (s) { if (supOf_(user, s)) mine[String(s.regNumber)] = 1; });
  return mine;
}
/** People the signed-in sender may pick as an individual recipient. */
function api_listMessageRecipients(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD', 'Staff'], 'You cannot send messages.');
  var admin = hasRole_(user, ['PG_Coordinator', 'HoD']), mine = admin ? null : assignedRegs_(user);
  var list = msgActiveUsers_().filter(function (u) {
    if (String(u.regNumber) === String(user.regNumber)) return false;
    return admin ? true : (u.role === 'Student' && mine[String(u.regNumber)]);
  }).map(function (u) { return { regNumber: u.regNumber, fullName: u.fullName || u.regNumber, role: u.role }; });
  list.sort(function (a, b) { return (a.role === 'Student' ? 1 : 0) - (b.role === 'Student' ? 1 : 0) || String(a.fullName).localeCompare(String(b.fullName)); });
  return list;
}
function api_sendDirectMessage_l(token, scope, target, subject, text) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD', 'Staff'], 'You cannot send messages.');
  var admin = hasRole_(user, ['PG_Coordinator', 'HoD']);
  scope = String(scope || '').trim();
  if (MSG_SCOPES.indexOf(scope) === -1) throw new Error('Choose who to send the message to.');
  if (admin && scope === 'myStudents') throw new Error('Choose individual, students, staff or every user.');
  if (!admin && scope !== 'individual' && scope !== 'myStudents') throw new Error('Staff can message only the students assigned to them.');
  var body = String(text || '').trim();
  if (!body) throw new Error('Message cannot be empty.');
  if (body.length > 2000) throw new Error('Message must be 2000 characters or fewer.');
  var subj = String(subject || '').trim().slice(0, 150) || ('Message from ' + user.fullName);
  var users = msgActiveUsers_(), me = String(user.regNumber), recips = [];
  if (scope === 'individual') {
    var t = String(target || '').trim();
    if (!t) throw new Error('Choose a recipient.');
    var u = users.filter(function (x) { return String(x.regNumber) === t; })[0];
    if (!u) throw new Error('Recipient not found or not active.');
    if (String(u.regNumber) === me) throw new Error('You cannot message yourself.');
    if (!admin && !(u.role === 'Student' && assignedRegs_(user)[String(u.regNumber)])) throw new Error('You can message only students assigned to you.');
    recips = [u];
  } else if (scope === 'myStudents') {
    var mine = assignedRegs_(user);
    recips = users.filter(function (x) { return x.role === 'Student' && mine[String(x.regNumber)]; });
    if (!recips.length) throw new Error('No students are assigned to you yet.');
  } else {
    recips = users.filter(function (x) {
      if (String(x.regNumber) === me) return false;
      if (scope === 'students') return x.role === 'Student';
      if (scope === 'staff') return x.role !== 'Student';
      return true;   // all
    });
    if (!recips.length) throw new Error('There are no recipients in that group.');
  }
  var threadToo = scope === 'individual' || scope === 'myStudents', now = nowIso_();
  recips.forEach(function (u) {
    addNote_(u.regNumber, 'Message from ' + user.fullName + ' — ' + subj + ': ' + body.slice(0, 160));
    if (threadToo && u.role === 'Student') appendRow_('Messages', { regNumber: u.regNumber, fromName: user.fullName, fromRole: user.role, text: (scope === 'individual' && subj.indexOf('Message from ') !== 0 ? subj + ': ' : '') + body, createdAt: now });
  });
  var emails = [], seen = {};
  recips.forEach(function (u) {
    var em = String(u.email || '').trim().toLowerCase();
    if (EMAIL_RE.test(em) && !seen[em]) { seen[em] = 1; emails.push(em); }
  });
  var emailed = 0, mailBody = body + '\n\n— ' + user.fullName + ' (' + (ROLE_NAMES_[user.role] || user.role) + ')\nYou can also see this in the portal.';
  try {
    if (scope === 'individual' && emails.length) { sendPortalMail_({ to: emails[0], subject: subj, body: mailBody, replyTo: EMAIL_RE.test(String(user.email || '')) ? user.email : '' }); emailed = 1; }
    else for (var i = 0; i < emails.length; i += 50) { var chunk = emails.slice(i, i + 50); sendPortalMail_({ to: coordinatorEmail_(), bcc: chunk.join(','), subject: subj, body: mailBody }); emailed += chunk.length; }
  } catch (e) { Logger.log('Direct message email failed: ' + e); }
  logAudit_(user.id, user.regNumber, 'SEND_MESSAGE', scope + (scope === 'individual' ? ':' + String(target) : ''), subj + ' -> ' + recips.length + ' recipient(s)');
  return { ok: true, sent: recips.length, emailed: emailed };
}
var ROLE_NAMES_ = { SuperAdmin: 'Super Admin', Student: 'Student', PG_Coordinator: 'PG Coordinator', HoD: 'Head of Department', Staff: 'Staff', Submission_Inspector: 'Submission Inspector' };
function api_sendDirectMessage() { return L_(api_sendDirectMessage_l, arguments); }

/* =========================== 15d. SUPERVISOR TOOLS & REQUESTS =========================== */
function supLabel_(id) { var st = id && findById_('Staff', id); return st ? st.fullName + (st.email ? ' <' + st.email + '>' : '') : 'None'; }
function staffUserFor_(id) {
  var st = findById_('Staff', id); if (!st) return null;
  return findWhere_('Users', function (u) { return String(u.regNumber) === String(id) || (st.email && String(u.email).toLowerCase() === String(st.email).toLowerCase()); });
}
var BULK_QUIET_ = false;   // set during bulk assignment so supervisors get one summary email instead of one per student
function notifySupervisors_(stu, oldMain, oldCo, newMain, newCo) {
  if (BULK_QUIET_) return;
  var info = fullNameOf_(stu) + ' (' + stu.regNumber + ') — ' + stu.programme + ', ' + stu.specialisation + '. Student email: ' + stu.email + '.';
  var noteFor = function (role, otherId) {
    return 'Assigned as ' + role + ': ' + fullNameOf_(stu) + ' (' + stu.regNumber + ') \u2014 ' +
      stu.programme + ', ' + stu.specialisation + '. Student email: ' + stu.email +
      '. Other supervisor: ' + supLabel_(otherId);
  };
  var send = function (id, subject, body, note) {
    var st = id && findById_('Staff', id); if (!st) return;
    var u = staffUserFor_(id); if (u) addNote_(u.regNumber, note);
    if (EMAIL_RE.test(String(st.email || ''))) { try { sendPortalMail_({ to: st.email, subject: subject, body: body }); } catch (e) {} }
  };
  if (newMain) send(newMain, 'Supervision assignment: ' + stu.regNumber, 'You are the Main Supervisor of ' + info + '\nCo-supervisor: ' + supLabel_(newCo), noteFor('Main Supervisor', newCo));
  if (newCo) send(newCo, 'Supervision assignment: ' + stu.regNumber, 'You are the Co-Supervisor of ' + info + '\nMain supervisor: ' + supLabel_(newMain), noteFor('Co-Supervisor', newMain));
  [oldMain, oldCo].forEach(function (id) {
    if (id && String(id) !== String(newMain) && String(id) !== String(newCo)) send(id, 'Supervision update: ' + stu.regNumber, 'You are no longer a supervisor of ' + fullNameOf_(stu) + ' (' + stu.regNumber + ').', 'Removed from supervising ' + fullNameOf_(stu));
  });
}
function api_endorseSubmission_l(token, id) {
  var user = requireUser_(token); assertRole_(user, ['Staff'], 'Only supervisors can endorse.');
  var sub = findById_('Submissions', id), stu = sub && findWhere_('Students', function (s) { return String(s.regNumber) === String(sub.regNumber); });
  if (!stu || !supOf_(user, stu)) throw new Error('Not your student.');
  var ex = String(sub.supervisorNotes || '');
  updateRow_('Submissions', id, { endorsedBy: user.fullName, supervisorNotes: ex + (ex ? '\n' : '') + '[' + user.fullName + ', ' + nowIso_().slice(0, 10) + ']: ENDORSED', updatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'ENDORSE_SUBMISSION', id, sub.type);
  notifyStudent_(sub.regNumber, 'Submission endorsed', user.fullName + ' endorsed your ' + sub.type + '.'); return { ok: true };
}
function api_endorseSubmission() { return L_(api_endorseSubmission_l, arguments); }
function requestList_() {
  return readTable_('Requests').slice().reverse().map(function (r) {
    var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(r.regNumber); });
    var o = stripRow_(r); o.studentName = stu ? fullNameOf_(stu) : ''; return o;
  });
}
function api_createRequest_l(token, type, reason) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can make requests.');
  if (['Supervisor change', 'Stage extension'].indexOf(type) === -1) throw new Error('Invalid request type.');
  if (String(reason || '').trim().length < 10) throw new Error('Please explain your reason (at least 10 characters).');
  var r = appendRow_('Requests', { regNumber: user.regNumber, type: type, reason: String(reason).trim().slice(0, 2000), status: 'Pending', decisionNote: '', createdAt: nowIso_(), decidedBy: '', decidedAt: '' });
  logAudit_(user.id, user.regNumber, 'CREATE_REQUEST', r.id, type);
  filterWhere_('Users', function (u) { return (u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active); }).forEach(function (u) { addNote_(u.regNumber, type + ' request from ' + user.fullName); });
  try {
    var to = {};
    filterWhere_('Users', function (u) { return (u.role === 'PG_Coordinator' || u.role === 'HoD') && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')); })
      .forEach(function (u) { to[String(u.email).toLowerCase()] = 1; });
    if (!Object.keys(to).length) to[coordinatorEmail_()] = 1;   // no active Coordinator/HoD login: fall back to the enquiries address
    Object.keys(to).forEach(function (addr) {
      sendPortalMail_({ to: addr, subject: type + ' request — ' + user.regNumber, body: user.fullName + ' (' + user.regNumber + ') requests: ' + type + '.\nReason: ' + reason });
    });
  } catch (e) {}
  return { id: r.id };
}
function api_createRequest() { return L_(api_createRequest_l, arguments); }
/** A student picks the stage they believe they are at; the PG Coordinator approves it from the dashboard. */
function api_requestStageChange_l(token, stage, note) {
  var user = requireUser_(token); assertRole_(user, ['Student'], 'Only students can request a stage update.');
  stage = String(stage || '');
  if (CFG.JOURNEY_STAGES.indexOf(stage) === -1) throw new Error('Choose a valid stage.');
  var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(user.regNumber); });
  if (!stu) throw new Error('Student profile not found.');
  if (stu.currentStage === stage) throw new Error('That is already your current stage.');
  if (findWhere_('Requests', function (r) { return String(r.regNumber) === String(user.regNumber) && r.type === 'Stage change' && r.status === 'Pending'; }))
    throw new Error('You already have a stage update awaiting the PG Coordinator.');
  var reason = '[Stage: ' + stage + '] ' + String(note || '').trim().slice(0, 1500);
  var r = appendRow_('Requests', { regNumber: user.regNumber, type: 'Stage change', reason: reason, status: 'Pending', decisionNote: '', createdAt: nowIso_(), decidedBy: '', decidedAt: '' });
  logAudit_(user.id, user.regNumber, 'CREATE_REQUEST', r.id, 'Stage change to ' + stage);
  filterWhere_('Users', function (u) { return u.role === 'PG_Coordinator' && toBool_(u.active); }).forEach(function (u) { addNote_(u.regNumber, 'Stage update request from ' + user.fullName + ' (' + stage + ')'); });
  try {
    var to = {};
    filterWhere_('Users', function (u) { return u.role === 'PG_Coordinator' && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')); }).forEach(function (u) { to[String(u.email).toLowerCase()] = 1; });
    if (!Object.keys(to).length) to[coordinatorEmail_()] = 1;
    Object.keys(to).forEach(function (addr) { sendPortalMail_({ to: addr, subject: 'Stage update request — ' + user.regNumber, body: user.fullName + ' (' + user.regNumber + ') asks to move from "' + stu.currentStage + '" to "' + stage + '".\n' + (note ? 'Note: ' + note : '') }); });
  } catch (e) {}
  return { id: r.id };
}
function api_requestStageChange() { return L_(api_requestStageChange_l, arguments); }
function api_decideRequest_l(token, id, decision, note) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot decide requests.');
  if (['Approved', 'Declined'].indexOf(decision) === -1) throw new Error('Invalid decision.');
  if (decision === 'Declined' && !String(note || '').trim()) throw new Error('A note is required when declining.');
  var r = findById_('Requests', id); if (!r) throw new Error('Request not found.');
  if (r.status !== 'Pending') throw new Error('This request was already decided.');
  if (r.type === 'Stage change') assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can decide stage update requests.');
  if (r.type === 'Title change') {
    assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can decide title change requests.');
    if (decision === 'Approved') {
      var tm = String(r.reason || '').match(/^\[Title\] ([^\n]+)\n/);
      if (!tm) throw new Error('The requested title could not be read.');
      var stuT = findWhere_('Students', function (x) { return String(x.regNumber) === String(r.regNumber); });
      if (!stuT) throw new Error('Student not found.');
      updateRow_('Students', stuT.id, { thesisTitle: tm[1], titleStatus: 'Confirmed', titleConfirmedBy: user.fullName, titleConfirmedAt: nowIso_(), titleUpdatedAt: nowIso_() });
      logAudit_(user.id, user.regNumber, 'CONFIRM_THESIS_TITLE', r.regNumber, tm[1].slice(0, 120) + ' (approved title change request)');
    }
  }
  var newStage = '';
  if (r.type === 'Stage change' && decision === 'Approved') {
    var sm = String(r.reason || '').match(/^\[Stage: ([^\]]+)\]/); newStage = sm ? sm[1] : '';
    if (CFG.JOURNEY_STAGES.indexOf(newStage) === -1) throw new Error('The requested stage is not valid.');
    var stuRow = findWhere_('Students', function (s) { return String(s.regNumber) === String(r.regNumber); });
    if (!stuRow) throw new Error('Student not found.');
    updateRow_('Students', stuRow.id, { currentStage: newStage, updatedAt: nowIso_() });
    logAudit_(user.id, user.regNumber, 'UPDATE_STAGE', r.regNumber, newStage + ' (approved student request)');
  }
  updateRow_('Requests', id, { status: decision, decisionNote: String(note || '').trim(), decidedBy: user.fullName, decidedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'DECIDE_REQUEST', id, decision);
  notifyStudent_(r.regNumber, r.type + ' request ' + decision.toLowerCase(), 'Your ' + r.type + ' request was ' + decision.toLowerCase() + ' by ' + user.fullName + '.\nNote: ' + (note || 'None')); return { ok: true };
}
function api_decideRequest() { return L_(api_decideRequest_l, arguments); }

/* =========================== 15e. ADVANCED FEATURES =========================== */
function parseHist_(v) { try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function pushHistory_(sub, e) { var a = parseHist_(sub.history); a.push(e); return JSON.stringify(a.slice(-20)); }
function numberIssues_(c) { return String(c || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l, i) { return (i + 1) + '. ' + l.replace(/^\d+[.)]\s*/, ''); }).join('\n'); }
function overdue_(s) {
  if (['Submitted', 'Under Review'].indexOf(s.status) === -1) return false;
  var t = new Date(String(s.updatedAt || s.createdAt).replace(' ', 'T')).getTime(); return !!t && (Date.now() - t) / 864e5 > 7;
}
function assignedName_(reg) { if (!reg) return ''; var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(reg); }); return u ? u.fullName : String(reg); }
function api_listInspectors(token) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'Access denied.');
  return filterWhere_('Users', function (u) { return u.role === 'Submission_Inspector' && toBool_(u.active); }).map(function (u) { return { regNumber: u.regNumber, fullName: u.fullName }; });
}
function api_assignInspector_l(token, subId, insReg) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot assign inspectors.');
  var sub = findById_('Submissions', subId), ins = findWhere_('Users', function (u) { return String(u.regNumber) === String(insReg) && u.role === 'Submission_Inspector'; });
  if (!sub || !ins) throw new Error('Submission or inspector not found.');
  updateRow_('Submissions', subId, { assignedTo: insReg, updatedAt: nowIso_() });
  addNote_(insReg, 'Assigned: ' + sub.type + ' (' + sub.regNumber + ')');
  if (EMAIL_RE.test(String(ins.email || ''))) { try { sendPortalMail_({ to: ins.email, subject: 'Submission assigned: ' + sub.type + ' — ' + sub.regNumber, body: 'You have been assigned to review "' + sub.type + '" from ' + sub.regNumber + '.' }); } catch (e) {} }
  logAudit_(user.id, user.regNumber, 'ASSIGN_INSPECTOR', subId, insReg); return { ok: true };
}
function api_assignInspector() { return L_(api_assignInspector_l, arguments); }
function api_getTimeline(token, reg) {
  var user = requireUser_(token), stu = threadStudent_(user, reg), r = String(stu.regNumber), ev = [];
  readTable_('AuditLog').forEach(function (a) { if (String(a.target) === r) ev.push({ at: String(a.at), text: String(a.action).replace(/_/g, ' ').toLowerCase() + (a.detail ? ': ' + String(a.detail).slice(0, 100) : '') }); });
  readTable_('Submissions').forEach(function (s) { if (String(s.regNumber) === r) ev.push({ at: String(s.createdAt), text: 'Submitted ' + s.type + ' (now ' + s.status + ')' }); });
  readTable_('Meetings').forEach(function (m) { if (String(m.regNumber) === r) ev.push({ at: String(m.createdAt), text: 'Meeting ' + m.date + ': ' + String(m.notes).slice(0, 100) }); });
  readTable_('Requests').forEach(function (q) { if (String(q.regNumber) === r) ev.push({ at: String(q.createdAt), text: q.type + ' request (' + q.status + ')' }); });
  ev.push({ at: String(stu.createdAt), text: 'Registered' });
  return ev.sort(function (a, b) { return b.at.localeCompare(a.at); }).slice(0, 120);
}
function api_setEmailPref(token, pref) {
  var user = requireUser_(token); if (['instant', 'digest', 'off'].indexOf(pref) === -1) throw new Error('Invalid preference.');
  updateRow_('Users', user.id, { emailPref: pref }); return { ok: true };
}
function api_uploadMessageFile(token, p, reg) {
  var user = requireUser_(token); threadStudent_(user, reg);
  var parts = String((p && p.dataUrl) || '').split(','), mm = parts[0].match(/data:(.*?);/), mime = mm ? mm[1] : '';
  var ok = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
  if (!ok[mime]) throw new Error('Attach a PDF, Word document, PNG or JPG.');
  var bytes = Utilities.base64Decode(parts[1]); if (bytes.length > 5 * 1024 * 1024) throw new Error('Attachment must be under 5 MB.');
  var root = DriveApp.getFolderById(getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID)), it = root.getFoldersByName('Attachments'), folder = it.hasNext() ? it.next() : root.createFolder('Attachments');
  var file = folder.createFile(Utilities.newBlob(bytes, mime, 'msg_' + new Date().getTime() + '.' + ok[mime]));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { url: file.getUrl() };
}
/* ---- seminars ---- */
function regList_(v) { return String(v || '').split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
function seminarList_(upcomingOnly, reg) {
  var today = nowIso_().slice(0, 10);
  return readTable_('Seminars').filter(function (s) { return !upcomingOnly || String(s.date) >= today; }).map(function (s) {
    return { id: s.id, title: s.title, date: String(s.date), venue: s.venue, presenters: String(s.presenters || ''), attendees: String(s.attendees || ''), presenting: !!reg && regList_(s.presenters).indexOf(reg) > -1 };
  }).sort(function (a, b) { return upcomingOnly ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date); });
}
function api_addSeminar_l(token, title, date, venue, presenters) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot schedule seminars.');
  if (!String(title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Title and a valid date are required.');
  var regs = regList_(presenters);
  regs.forEach(function (r) { if (!findWhere_('Students', function (s) { return String(s.regNumber) === r; })) throw new Error('Unknown presenter: ' + r); });
  var row = appendRow_('Seminars', { title: String(title).trim().slice(0, 200), date: date, venue: String(venue || '').slice(0, 200), presenters: regs.join(','), attendees: '', createdBy: user.id, createdAt: nowIso_() });
  regs.forEach(function (r) { notifyStudent_(r, 'You are scheduled to present', title + ' on ' + date + (venue ? ' at ' + venue : '') + '.'); });
  logAudit_(user.id, user.regNumber, 'ADD_SEMINAR', row.id, title + ' ' + date); return { id: row.id };
}
function api_addSeminar() { return L_(api_addSeminar_l, arguments); }
function api_markAttendance_l(token, id, regs) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot record attendance.');
  if (!findById_('Seminars', id)) throw new Error('Seminar not found.');
  updateRow_('Seminars', id, { attendees: regList_(regs).join(',') }); logAudit_(user.id, user.regNumber, 'SEMINAR_ATTENDANCE', id, regList_(regs).length + ' attendees'); return { ok: true };
}
function api_markAttendance() { return L_(api_markAttendance_l, arguments); }
/* ---- examiners ---- */
function examinerList_() {
  return readTable_('Examiners').slice().reverse().map(function (x) {
    var s = findWhere_('Students', function (y) { return String(y.regNumber) === String(x.regNumber); }); var o = stripRow_(x); o.studentName = s ? fullNameOf_(s) : ''; return o;
  });
}
function finalizeExaminerAppointment_(ex, user) {
  if (ex.email) { try { sendPortalMail_({ to: ex.email, subject: 'Examiner appointment — ' + ex.regNumber, body: 'You have been appointed ' + ex.type + ' examiner for ' + ex.regNumber + '. The department will contact you with the thesis and defence details.' }); } catch (e) {} }
  notifyStudent_(ex.regNumber, 'Examiner assigned', ex.type + ' examiner: ' + ex.examinerName + '.');
  logAudit_(user.id, user.regNumber, 'ADD_EXAMINER', ex.regNumber, ex.type + ': ' + ex.examinerName);
}
/** When EXAMINER_APPROVAL_REQUIRED is "yes" in the Config tab, examiners proposed by the PG Coordinator wait for HoD approval. */
function api_addExaminer_l(token, reg, name, type, email) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot assign examiners.');
  if (!findWhere_('Students', function (s) { return String(s.regNumber) === String(reg); })) throw new Error('Student not found.');
  if (!validateName_(name)) throw new Error('Enter the examiner\u2019s name.'); if (['Internal', 'External'].indexOf(type) === -1) throw new Error('Invalid examiner type.');
  var em = cleanEmail_(email); if (em && !validateEmail_(em)) throw new Error('Invalid examiner email.');
  var needsApproval = user.role === 'PG_Coordinator' && String(getSetting_('EXAMINER_APPROVAL_REQUIRED', 'no')).toLowerCase() === 'yes';
  var r = appendRow_('Examiners', { regNumber: reg, examinerName: String(name).trim(), type: type, email: em, score: '', comments: '', status: needsApproval ? 'Proposed' : 'Assigned', createdAt: nowIso_() });
  if (needsApproval) {
    logAudit_(user.id, user.regNumber, 'PROPOSE_EXAMINER', reg, type + ': ' + name);
    filterWhere_('Users', function (u) { return u.role === 'HoD' && toBool_(u.active) && String(u.status) === 'Approved'; }).forEach(function (u) {
      addNote_(u.regNumber, 'Examiner proposed for HoD approval: ' + type + ' examiner ' + name + ' for ' + reg);
      if (EMAIL_RE.test(String(u.email || ''))) { try { sendPortalMail_({ to: u.email, subject: 'Examiner awaiting your approval — ' + reg, body: user.fullName + ' proposed ' + name + ' as ' + type + ' examiner for ' + reg + '.\nApprove or decline it in Overview & Reports \u2192 Examiners.' }); } catch (e) {} }
    });
    return { id: r.id, proposed: true };
  }
  finalizeExaminerAppointment_(r, user);
  return { id: r.id };
}
function api_decideExaminer_l(token, id, decision) {
  var user = requireUser_(token); assertRole_(user, ['HoD'], 'Only the HoD can approve proposed examiners.');
  var ex = findById_('Examiners', id); if (!ex) throw new Error('Examiner record not found.');
  if (String(ex.status) !== 'Proposed') throw new Error('This examiner is not awaiting approval.');
  if (decision === 'Approve') { updateRow_('Examiners', id, { status: 'Assigned' }); finalizeExaminerAppointment_(ex, user); }
  else if (decision === 'Decline') { updateRow_('Examiners', id, { status: 'Declined' }); logAudit_(user.id, user.regNumber, 'DECLINE_EXAMINER', ex.regNumber, ex.examinerName); notifyCoordinators_('Examiner declined — ' + ex.regNumber, 'The HoD declined examiner ' + ex.examinerName + ' for ' + ex.regNumber, 'The HoD declined ' + ex.examinerName + ' as ' + ex.type + ' examiner for ' + ex.regNumber + '. Please propose another examiner.'); }
  else throw new Error('Choose Approve or Decline.');
  return { ok: true };
}
function api_decideExaminer() { return L_(api_decideExaminer_l, arguments); }
function api_addExaminer() { return L_(api_addExaminer_l, arguments); }
function api_recordExaminerResult_l(token, id, score, comments) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot record results.');
  var n = parseFloat(score); if (isNaN(n) || n < 0 || n > 100) throw new Error('Score must be between 0 and 100.');
  var exr = findById_('Examiners', id); if (!exr) throw new Error('Examiner record not found.');
  if (['Proposed', 'Declined'].indexOf(String(exr.status)) > -1) throw new Error('This examiner has not been approved yet.');
  updateRow_('Examiners', id, { score: n, comments: String(comments || '').slice(0, 3000), status: 'Scored' }); logAudit_(user.id, user.regNumber, 'EXAMINER_RESULT', id, String(n)); return { ok: true };
}
function api_recordExaminerResult() { return L_(api_recordExaminerResult_l, arguments); }
/* ---- targets ---- */
function graduation_(students) {
  var o = {}; students.forEach(function (s) { var p = s.programme || 'Unknown'; o[p] = o[p] || { total: 0, completed: 0 }; o[p].total++; if (s.currentStage === '15 - Completion') o[p].completed++; }); return o;
}
function avgStageDays_() {
  var by = {}, last = {};
  readTable_('Students').forEach(function (s) { last[s.regNumber] = new Date(String(s.createdAt).replace(' ', 'T')).getTime(); });
  readTable_('AuditLog').filter(function (r) { return r.action === 'UPDATE_STAGE' || r.action === 'AUTO_STAGE'; }).forEach(function (r) {
    var t = new Date(String(r.at).replace(' ', 'T')).getTime(), prev = last[r.target]; if (!prev || !t) return;
    var st = String(r.detail); (by[st] = by[st] || []).push((t - prev) / 864e5); last[r.target] = t;
  });
  var out = {}; Object.keys(by).forEach(function (k) { out[k] = Math.round(by[k].reduce(function (a, b) { return a + b; }, 0) / by[k].length); }); return out;
}
/* ---- staff logins (role management) ---- */
function api_saveStaffLogin_l(token, p) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can manage logins.');
  var id = String(p.regNumber || '').trim().toUpperCase(), role = p.role, em = cleanEmail_(p.email), name = String(p.fullName || '').trim();
  if (!validateStaffId_(id)) throw new Error('Staff ID must look like ACA1234.'); if (['Staff', 'HoD', 'PG_Coordinator', 'Submission_Inspector'].indexOf(role) === -1) throw new Error('Invalid role.');
  if (name.length < 2 || !validateEmail_(em)) throw new Error('A name and valid email are required.');
  if (!findById_('Staff', id)) appendRow_('Staff', { id: id, fullName: name, email: em, rank: staffRankFromName_(name), specialisation: '', active: true, createdAt: nowIso_(), role: role });
  var u = findWhere_('Users', function (x) { return String(x.regNumber) === id; });
  if (u && u.role === 'SuperAdmin') throw new Error('Super Admin accounts cannot be changed here.');
  if (u) { updateRow_('Users', u.id, { fullName: name, email: em, role: role, active: true, status: 'Approved' }); bumpSessionEpoch_(u.id); }
  else {
    var salt = makeSalt_(), tempPw = genTempPassword_();
    appendRow_('Users', { regNumber: id, email: em, passwordHash: hashPassword_(tempPw, salt), salt: salt, role: role, fullName: name, firstLogin: true, active: true, status: 'Approved', createdAt: nowIso_() });
    notifyStaffLogin_(em, name, id, role, tempPw);
  }
  logAudit_(user.id, user.regNumber, 'SAVE_STAFF_LOGIN', id, role); return { ok: true };
}
function api_saveStaffLogin() { return L_(api_saveStaffLogin_l, arguments); }
function api_setLoginActive_l(token, userId, active) {
  var user = requireUser_(token); assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can manage logins.');
  if (String(userId) === String(user.id)) throw new Error('You cannot change your own login.');
  var u = findById_('Users', userId); if (!u || u.role === 'Student') throw new Error('Login not found.');
  updateRow_('Users', userId, { active: !!active }); if (!active) bumpSessionEpoch_(userId);
  logAudit_(user.id, user.regNumber, active ? 'ACTIVATE_LOGIN' : 'DEACTIVATE_LOGIN', u.regNumber, u.role); return { ok: true };
}
function api_setLoginActive() { return L_(api_setLoginActive_l, arguments); }
/* ---- digests & backups ---- */
function sendWeeklyDigest() {
  var subs = readTable_('Submissions'), open = subs.filter(function (s) { return s.status === 'Submitted' || s.status === 'Under Review'; }).length;
  var body = 'Weekly summary\n\nSubmissions awaiting review: ' + open + ' (overdue: ' + subs.filter(overdue_).length + ')\nStalled students: ' + readTable_('Students').filter(isStalled_).length +
    '\nPending requests: ' + readTable_('Requests').filter(function (r) { return r.status === 'Pending'; }).length + '\nPending registrations: ' + readTable_('Users').filter(function (u) { return u.status === 'Pending'; }).length +
    '\n\nUpcoming deadlines:\n' + (upcomingDeadlines_().slice(0, 5).map(function (d) { return '- ' + d.date + ' ' + d.title; }).join('\n') || '- none') +
    '\n\nUpcoming seminars:\n' + (seminarList_(true).slice(0, 5).map(function (s) { return '- ' + s.date + ' ' + s.title; }).join('\n') || '- none');
  var seen = {}; filterWhere_('Users', function (u) { return (u.role === 'HoD' || u.role === 'PG_Coordinator') && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')); }).forEach(function (u) {
    if (!seen[u.email]) { seen[u.email] = 1; try { sendPortalMail_({ to: u.email, subject: 'Weekly postgraduate digest', body: body }); } catch (e) {} } });
}
function sendDailyDigest() {
  filterWhere_('Users', function (u) { return u.emailPref === 'digest' && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')); }).forEach(function (u) {
    var items = readTable_('Notifications').filter(function (n) { return String(n.regNumber) === String(u.regNumber) && !toBool_(n.read); }).slice(-20);
    if (items.length) { try { sendPortalMail_({ to: u.email, subject: 'Your daily portal digest (' + items.length + ')', body: items.map(function (n) { return '- ' + n.text; }).join('\n') }); } catch (e) {} }
  });
}
function backupCore_() {
  var root = DriveApp.getFolderById(getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID)), it = root.getFoldersByName('Backups'), folder = it.hasNext() ? it.next() : root.createFolder('Backups');
  return DriveApp.getFileById(getSpreadsheet_().getId()).makeCopy('PG Backup ' + nowIso_().slice(0, 16), folder).getUrl();
}
function autoBackup() { backupCore_(); }
function api_backupNow(token) { var user = requireUser_(token); assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can back up.'); logAudit_(user.id, user.regNumber, 'BACKUP', 'Spreadsheet', 'Manual'); return { url: backupCore_() }; }
/** Run once: weekly HoD digest (Mon 7am), daily user digest (5pm), weekly backup (Sun 2am). */
function installDigestTriggers() {
  ScriptApp.newTrigger('sendWeeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(17).create();
  ScriptApp.newTrigger('autoBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
}


/* =========================== 14b. SIMILARITY, ASSIGNMENT, TIME LIMITS, REMINDERS =========================== */
function daysSince_(t) { var ms = new Date(String(t || '').replace(' ', 'T')).getTime(); return ms ? Math.max(0, Math.floor((Date.now() - ms) / 864e5)) : 0; }
function needsEndorsement_(sub) { return checklistFor_(sub.type).indexOf('Supervisor endorsement attached') !== -1; }
function similarityLimit_() { var n = parseFloat(getSetting_('SIMILARITY_LIMIT', '20')); return isNaN(n) ? 20 : n; }
/** Stage 10 (plagiarism check): the inspector records the similarity percentage and, optionally, a link to the report. */
function api_recordSimilarity_l(token, id, percent, reportUrl) {
  var user = requireUser_(token); assertRole_(user, ['Submission_Inspector', 'PG_Coordinator'], 'You cannot record similarity results.');
  var sub = findById_('Submissions', id);
  if (!sub || String(sub.status) === 'Draft') throw new Error('Submission not found.');
  if (COMPLIANCE_TYPES.indexOf(sub.type) === -1) throw new Error('Similarity is recorded for proposals, progress reports, theses and final corrections only.');
  var n = parseFloat(percent); if (isNaN(n) || n < 0 || n > 100) throw new Error('Enter the similarity percentage (0\u2013100).');
  n = Math.round(n * 10) / 10;
  var url = String(reportUrl || '').trim(); if (url && !/^https?:\/\/\S+$/.test(url)) throw new Error('The report link must start with http:// or https://');
  var now = nowIso_(), limit = similarityLimit_(), above = n > limit;
  updateRow_('Submissions', id, { similarity: n, similarityUrl: url, similarityBy: user.fullName, similarityAt: now, updatedAt: now,
    history: pushHistory_(sub, { at: now, by: user.fullName, status: 'Similarity recorded', comments: n + '%' + (above ? ' (above the ' + limit + '% limit)' : '') }) });
  logAudit_(user.id, user.regNumber, 'RECORD_SIMILARITY', id, n + '%');
  return { similarity: n, limit: limit, above: above };
}
function api_recordSimilarity() { return L_(api_recordSimilarity_l, arguments); }
/** An inspector who cannot take an assigned submission hands it back with a reason. */
function api_declineAssignment_l(token, id, reason) {
  var user = requireUser_(token); assertRole_(user, ['Submission_Inspector'], 'Only inspectors can decline an assignment.');
  var sub = findById_('Submissions', id);
  if (!sub) throw new Error('Submission not found.');
  if ([String(user.regNumber), String(user.id)].indexOf(String(sub.assignedTo)) === -1) throw new Error('This submission is not assigned to you.');
  var why = String(reason || '').trim(); if (why.length < 5) throw new Error('Please give a short reason (at least 5 characters).');
  var now = nowIso_();
  updateRow_('Submissions', id, { assignedTo: '', updatedAt: now, history: pushHistory_(sub, { at: now, by: user.fullName, status: 'Assignment declined', comments: why.slice(0, 500) }) });
  logAudit_(user.id, user.regNumber, 'DECLINE_ASSIGNMENT', id, why.slice(0, 120));
  notifyInquiryHandlers_('Inspector declined an assignment — ' + sub.regNumber, user.fullName + ' declined ' + sub.type + ' (' + sub.regNumber + ')',
    user.fullName + ' declined the assignment of "' + sub.type + '" from ' + sub.regNumber + '.\nReason: ' + why + '\n\nAssign another inspector in Submissions Review.', null);
  return { ok: true };
}
function api_declineAssignment() { return L_(api_declineAssignment_l, arguments); }

/* ---- programme time limits (months from the start of the admission session). Off until TIME_LIMITS_ENABLED = yes. The limits below are PLACEHOLDERS:
 *      set LIMIT_MONTHS_MSc / LIMIT_MONTHS_MPhil / LIMIT_MONTHS_PhD (and TIME_ALERT_MONTHS) in the Config tab. ---- */
var DEFAULT_LIMIT_MONTHS = { MSc: 24, MPhil: 36, PhD: 60 };
function programmeLimitMonths_(prog) {
  var n = parseInt(getSetting_('LIMIT_MONTHS_' + String(prog || '').replace(/\s+/g, ''), ''), 10);
  return n > 0 ? n : (DEFAULT_LIMIT_MONTHS[prog] || 0);
}
function sessionStartDate_(stu) {
  var y = academicYearFromReg_(stu.regNumber) || parseInt(stu.yearOfAdmission, 10);
  return y ? new Date(y - 1, 9, 1) : null;   // a 2026 admission belongs to session 2025/2026, which starts 1 October 2025
}
function timeInfo_(stu) {
  if (String(getSetting_('TIME_LIMITS_ENABLED', 'no')).toLowerCase() !== 'yes') return null;   // off until the real limits are entered in the Config tab
  var lim = programmeLimitMonths_(stu.programme), st = sessionStartDate_(stu);
  if (!lim || !st) return null;
  var el = Math.max(0, Math.floor((Date.now() - st.getTime()) / (30.4375 * 864e5)));
  return { limitMonths: lim, monthsElapsed: el, monthsLeft: lim - el };
}
function timeAlerts_(students) {
  var within = parseInt(getSetting_('TIME_ALERT_MONTHS', '6'), 10); if (isNaN(within)) within = 6;
  var out = [];
  students.forEach(function (stu) {
    if (String(stu.currentStage) === '15 - Completion') return;
    var ti = timeInfo_(stu); if (!ti || ti.monthsLeft > within) return;
    out.push({ regNumber: stu.regNumber, fullName: fullNameOf_(stu), programme: stu.programme, session: studentSession_(stu), stage: stu.currentStage,
      monthsElapsed: ti.monthsElapsed, limitMonths: ti.limitMonths, monthsLeft: ti.monthsLeft, status: ti.monthsLeft < 0 ? 'Overdue' : 'Due soon' });
  });
  out.sort(function (a, b) { return a.monthsLeft - b.monthsLeft; });
  return out;
}
/** Weekly email to the HoD and PG Coordinator listing students close to, or past, their programme time limit. */
function sendTimeLimitAlerts() {
  var list = timeAlerts_(readTable_('Students'));
  if (!list.length) return;
  var body = 'Students close to or past the programme time limit (limits are set in the Config tab):\n\n' + list.slice(0, 60).map(function (a) {
    return '- ' + a.fullName + ' (' + a.regNumber + ', ' + a.programme + ', ' + a.session + ') \u2014 ' + (a.monthsLeft < 0 ? 'overdue by ' + (-a.monthsLeft) + ' month(s)' : a.monthsLeft + ' month(s) left') + '; stage ' + a.stage;
  }).join('\n');
  var seen = {};
  filterWhere_('Users', function (u) { return (u.role === 'HoD' || u.role === 'PG_Coordinator') && toBool_(u.active) && EMAIL_RE.test(String(u.email || '')); }).forEach(function (u) {
    if (!seen[u.email]) { seen[u.email] = 1; try { sendPortalMail_({ to: u.email, subject: 'Time-limit alerts: ' + list.length + ' student(s)', body: body }); } catch (e) {} } });
}

/* ---- daily reminders ---- */
/** Supervisors are reminded about submissions waiting for their endorsement (every ENDORSE_REMIND_DAYS days, default 3). */
function sendSupervisorReminders() {
  var every = parseInt(getSetting_('ENDORSE_REMIND_DAYS', '3'), 10); if (!(every > 0)) every = 3;
  var perStaff = {}, t0 = Date.now();
  readTable_('Submissions').forEach(function (sub) {
    if (['Submitted', 'Under Review'].indexOf(String(sub.status)) === -1 || !needsEndorsement_(sub) || String(sub.endorsedBy || '').trim()) return;
    if (daysSince_(sub.createdAt) < every) return;
    if (sub.lastRemindedAt && daysSince_(sub.lastRemindedAt) < every) return;
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(sub.regNumber); });
    if (!stu) return;
    [stu.mainSupervisorId, stu.coSupervisorId].forEach(function (sid) {
      if (!sid) return;
      (perStaff[sid] = perStaff[sid] || []).push('- ' + fullNameOf_(stu) + ' (' + stu.regNumber + '): ' + sub.type + ', waiting ' + daysSince_(sub.createdAt) + ' day(s)');
    });
    updateRow_('Submissions', sub.id, { lastRemindedAt: nowIso_() });
  });
  Object.keys(perStaff).forEach(function (sid) {
    if (Date.now() - t0 > 240000) return;
    var st = findById_('Staff', sid), su = staffUserFor_(sid);
    if (su) addNote_(su.regNumber, perStaff[sid].length + ' submission(s) are waiting for your endorsement.');
    if (st && EMAIL_RE.test(String(st.email || ''))) { try { sendPortalMail_({ to: st.email, subject: 'Submissions waiting for your endorsement (' + perStaff[sid].length + ')', body: 'Dear ' + st.fullName + ',\n\nThese submissions are waiting for your endorsement:\n\n' + perStaff[sid].join('\n') + '\n\nOpen the portal (My Students \u2192 Submissions) to read and endorse them.' }); } catch (e) {} }
  });
}
/** Students with no progress for 90+ days get a gentle reminder (at most once every NUDGE_DAYS days, default 30). */
function sendStalledNudges() {
  var every = parseInt(getSetting_('NUDGE_DAYS', '30'), 10); if (!(every > 0)) every = 30;
  var sent = 0;
  readTable_('Students').forEach(function (stu) {
    if (sent >= 40 || !isStalled_(stu) || !EMAIL_RE.test(String(stu.email || ''))) return;
    if (stu.lastNudgeAt && daysSince_(stu.lastNudgeAt) < every) return;
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(stu.regNumber); });
    if (!u || String(u.status) !== 'Approved' || !toBool_(u.active)) return;
    var days = daysSince_(stu.updatedAt || stu.createdAt);
    try {
      sendPortalMail_({ to: stu.email, subject: 'Checking in on your postgraduate progress', body: 'Dear ' + stu.firstName + ',\n\nThere has been no recorded progress on your postgraduate journey for about ' + days + ' days (current stage: ' + stu.currentStage + ').\n\nPlease meet your supervisor, submit your next document, or send an inquiry to the PG Coordinator in the portal if you need help.' });
      addNote_(stu.regNumber, 'Reminder: no progress recorded for about ' + days + ' days. Please contact your supervisor or send an inquiry if you need help.');
      updateRow_('Students', stu.id, { lastNudgeAt: nowIso_() }); sent++;
    } catch (e) { Logger.log('nudge ' + stu.regNumber + ': ' + e); }
  });
}

/* ---- numbers shown on the menu tabs ---- */
function api_getNavCounts(token) {
  var user = requireUser_(token), c = {}, subs = readTable_('Submissions');
  var open = function (st) { return st === 'Submitted' || st === 'Under Review'; };
  if (user.role === 'Student') {
    c.inbox = readTable_('Inquiries').filter(function (q) { return String(q.regNumber) === String(user.regNumber) && q.status === 'Answered'; }).length;
    c.submissions = subs.filter(function (x) { return String(x.regNumber) === String(user.regNumber) && ['Rejected', 'Changes Requested'].indexOf(String(x.status)) > -1; }).length;
  } else if (user.role === 'PG_Coordinator' || user.role === 'HoD') {
    var reqs = readTable_('Requests').filter(function (r) { return r.status === 'Pending'; });
    c.inbox = readTable_('Inquiries').filter(function (q) { return q.status === 'Open'; }).length;
    c.hod = reqs.filter(function (r) { return r.type !== 'Stage change' && r.type !== 'Title change'; }).length + readTable_('Examiners').filter(function (x) { return x.status === 'Proposed'; }).length * (user.role === 'HoD' ? 1 : 0);
    if (user.role === 'PG_Coordinator') {
      c.coordinator = readTable_('Users').filter(function (u) { return u.role === 'Student' && String(u.status) === 'Pending'; }).length +
        reqs.filter(function (r) { return r.type === 'Stage change' || r.type === 'Title change'; }).length +
        readTable_('Students').filter(function (x) { return String(x.thesisTitle || '').trim() && String(x.titleStatus) === 'Pending'; }).length;
      c.inspector = subs.filter(function (x) { return open(String(x.status)); }).length;
    }
  } else if (user.role === 'Submission_Inspector') {
    c.inspector = subs.filter(function (x) { return open(String(x.status)) && (!x.assignedTo || [String(user.regNumber), String(user.id)].indexOf(String(x.assignedTo)) > -1); }).length;
  } else if (user.role === 'Staff') {
    var mine = readTable_('Students').filter(function (x) { return supOf_(user, x); }), rm = {};
    mine.forEach(function (x) { rm[x.regNumber] = 1; });
    c.staffdash = mine.filter(isStalled_).length + subs.filter(function (x) {
      return rm[x.regNumber] && String(x.status) !== 'Draft' && (['Rejected', 'Changes Requested'].indexOf(String(x.status)) > -1 || (open(String(x.status)) && needsEndorsement_(x) && !String(x.endorsedBy || '').trim()));
    }).length;
  }
  return c;
}

/* ---- scheduled housekeeping: keep the big log sheets small ---- */
/** Moves AuditLog rows older than 24 months to AuditLog_Archive and deletes read notifications older than 90 days. */
function archiveOldRecords() {
  return withScriptLock_(function () {
    var ss = getSpreadsheet_(), out = { audit: 0, notes: 0 };
    var cut = function (days) { return Utilities.formatDate(new Date(Date.now() - days * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd'); };
    var audit = ss.getSheetByName('AuditLog');
    if (audit && audit.getLastRow() > 1) {
      var vals = audit.getDataRange().getValues(), head = vals[0], ai = head.indexOf('at'), c = cut(730), keep = [head], old = [];
      vals.slice(1).forEach(function (r) { (String(r[ai]).slice(0, 10) < c ? old : keep).push(r); });
      if (old.length) {
        var arch = ss.getSheetByName('AuditLog_Archive') || ss.insertSheet('AuditLog_Archive');
        if (arch.getLastRow() === 0) arch.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
        arch.getRange(arch.getLastRow() + 1, 1, old.length, head.length).setValues(old);
        audit.clearContents(); audit.getRange(1, 1, keep.length, head.length).setValues(keep);
        invalidateTable_('AuditLog'); out.audit = old.length;
      }
    }
    var notes = ss.getSheetByName('Notifications');
    if (notes && notes.getLastRow() > 1) {
      var nv = notes.getDataRange().getValues(), nh = nv[0], ci = nh.indexOf('createdAt'), ri = nh.indexOf('read'), nc = cut(90), nk = [nh];
      nv.slice(1).forEach(function (r) { var read = r[ri] === true || String(r[ri]).toLowerCase() === 'true'; if (!(read && String(r[ci]).slice(0, 10) < nc)) nk.push(r); else out.notes++; });
      if (out.notes) { notes.clearContents(); notes.getRange(1, 1, nk.length, nh.length).setValues(nk); invalidateTable_('Notifications'); }
    }
    return out;
  }, 60000);
}

/** RUN ONCE from the editor (or from the spreadsheet menu): installs every scheduled job exactly once; safe to run again. */
var PORTAL_TRIGGERS = [
  { fn: 'sendDeadlineReminders', every: 'day', hour: 8 }, { fn: 'sendSupervisorReminders', every: 'day', hour: 9 }, { fn: 'sendStalledNudges', every: 'day', hour: 10 },
  { fn: 'sendDailyDigest', every: 'day', hour: 17 }, { fn: 'sendWeeklyDigest', every: 'week', day: 'MONDAY', hour: 7 }, { fn: 'sendTimeLimitAlerts', every: 'week', day: 'MONDAY', hour: 8 },
  { fn: 'autoBackup', every: 'week', day: 'SUNDAY', hour: 2 }, { fn: 'archiveOldRecords', every: 'month', hour: 3 }, { fn: 'checkPendingSubmissions', every: 'minutes', n: 10 }
];
function installAllTriggers() {
  try { ensureSettings_(); } catch (e) { Logger.log('ensureSettings_: ' + e); }
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  var added = [];
  PORTAL_TRIGGERS.forEach(function (j) {
    if (have[j.fn]) return;
    var b = ScriptApp.newTrigger(j.fn).timeBased();
    if (j.every === 'day') b.everyDays(1).atHour(j.hour);
    else if (j.every === 'week') b.onWeekDay(ScriptApp.WeekDay[j.day]).atHour(j.hour);
    else if (j.every === 'month') b.onMonthDay(1).atHour(j.hour);
    else b.everyMinutes(j.n);
    b.create(); added.push(j.fn);
  });
  Logger.log('Triggers added: ' + (added.join(', ') || 'none (all were already installed)'));
  return added;
}

/* =========================== 16. WEB ENTRY =========================== */

/* =========================== 16. FILE ACCESS, IN-PORTAL READER & FORMAT CHECK =========================== */

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var COMPLIANCE_TYPES = ['Research Proposal', 'Progress Report', 'Final Thesis/Dissertation', 'Final Correction'];
var REQ_MARGIN_CM = { left: 4.0, right: 2.5, top: 2.5, bottom: 2.5 };
var MARGIN_TOL_CM = 0.1;

/* ---- Drive ids and sharing ---- */
function fileIdsFromUrls_(urls) {
  var out = [], seen = {};
  String(urls || '').split(/[\s,]+/).forEach(function (u) {
    if (!/^https?:\/\//i.test(u)) return;
    var m = /\/d\/([\w-]{15,})|[?&]id=([\w-]{15,})/.exec(u), id = m && (m[1] || m[2]);
    if (id && !seen[id]) { seen[id] = 1; out.push(id); }
  });
  return out;
}
function driveApi_(method, path, body) {
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/' + path, opt), txt = r.getContentText(), j = null;
  try { j = JSON.parse(txt); } catch (e) {}
  return { code: r.getResponseCode(), json: j, text: txt };
}
/** role: 'writer' | 'commenter' | 'reader'. Uses the Drive API so no "shared with you" e-mail is sent;
 *  falls back to DriveApp (which does send one) for addresses that are not Google accounts. */
function grantFileRole_(fileId, email, role) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return false;
  var r = driveApi_('post', 'files/' + fileId + '/permissions?sendNotificationEmail=false&supportsAllDrives=true', { type: 'user', role: role, emailAddress: email });
  if (r.code === 200) return true;
  if (r.code === 403 || r.code === 404) { Logger.log('grantFileRole_ ' + fileId + ': ' + r.code + ' (portal cannot change sharing on this file)'); return false; }
  try {
    var f = DriveApp.getFileById(fileId);
    if (role === 'writer') f.addEditor(email); else if (role === 'commenter') f.addCommenter(email); else f.addViewer(email);
    return true;
  } catch (e) { Logger.log('grantFileRole_ ' + fileId + ' ' + email + ': ' + r.code + ' ' + String(r.text).slice(0, 140) + ' / ' + e); return false; }
}
function revokeFileEmails_(fileId, emails) {
  var want = {}; (emails || []).forEach(function (e) { want[String(e).toLowerCase()] = 1; });
  if (!Object.keys(want).length) return;
  var r = driveApi_('get', 'files/' + fileId + '/permissions?fields=permissions(id,emailAddress,role)&supportsAllDrives=true');
  if (r.code !== 200 || !r.json) return;
  (r.json.permissions || []).forEach(function (p) {
    if (p.role !== 'owner' && p.emailAddress && want[String(p.emailAddress).toLowerCase()]) driveApi_('delete', 'files/' + fileId + '/permissions/' + p.id + '?supportsAllDrives=true');
  });
}
function supervisorEmails_(staffIds) {
  var out = [];
  staffIds.forEach(function (id) {
    if (!id) return;
    var st = findById_('Staff', id); if (st && st.email) out.push(String(st.email).trim().toLowerCase());
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(id); }); if (u && u.email) out.push(String(u.email).trim().toLowerCase());
  });
  return out.filter(function (e, i) { return EMAIL_RE.test(e) && out.indexOf(e) === i; });
}
/** Who may touch a student's files in Drive: Main + Co-Supervisor and PG Coordinator(s) edit, Inspectors comment, HoD reads. */
function accessPlanFor_(reg) {
  var plan = {}, rank = { reader: 1, commenter: 2, writer: 3 };
  var add = function (email, role) { email = String(email || '').trim().toLowerCase(); if (EMAIL_RE.test(email) && (!plan[email] || rank[role] > rank[plan[email]])) plan[email] = role; };
  var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(reg); });
  if (stu) supervisorEmails_([stu.mainSupervisorId, stu.coSupervisorId]).forEach(function (e) { add(e, 'writer'); });
  readTable_('Users').forEach(function (u) {
    if (!toBool_(u.active) || String(u.status) !== 'Approved') return;
    if (u.role === 'PG_Coordinator') add(u.email, 'writer');
    else if (u.role === 'Submission_Inspector') add(u.email, 'commenter');
    else if (u.role === 'HoD') add(u.email, 'reader');
  });
  return plan;
}
function shareSubmissionFiles_(sub) {
  var ids = fileIdsFromUrls_(sub.driveFileUrls), plan = accessPlanFor_(sub.regNumber), n = 0;
  ids.forEach(function (id) { Object.keys(plan).forEach(function (em) { if (grantFileRole_(id, em, plan[em])) n++; }); });
  return n;
}
function syncStudentFileAccess_(reg, oldEmails) {
  var plan = accessPlanFor_(reg), revoke = (oldEmails || []).filter(function (e) { return !plan[e]; });
  filterWhere_('Submissions', function (x) { return String(x.regNumber) === String(reg); }).forEach(function (sub) {
    fileIdsFromUrls_(sub.driveFileUrls).forEach(function (id) {
      Object.keys(plan).forEach(function (em) { grantFileRole_(id, em, plan[em]); });
      revokeFileEmails_(id, revoke);
    });
  });
}
/** RUN ONCE from the Apps Script editor to give the right people access to EXISTING submissions (re-run if it stops at the time limit). */
function syncAllSubmissionAccess() {
  var t0 = Date.now(), done = 0, left = 0;
  readTable_('Submissions').forEach(function (sub) {
    if (Date.now() - t0 > 300000) { left++; return; }
    try { shareSubmissionFiles_(sub); done++; } catch (e) { Logger.log('sync ' + sub.id + ': ' + e); }
  });
  Logger.log('syncAllSubmissionAccess: ' + done + ' submissions synced, ' + left + ' left (run again if > 0).');
}

/* ---- who can open what ---- */
function canSeeSubmission_(user, sub) {
  if (String(sub.status) === 'Draft') return user.role === 'Student' && String(sub.regNumber) === String(user.regNumber);
  if (user.role === 'Student') return String(sub.regNumber) === String(user.regNumber);
  if (user.role === 'Staff') { var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(sub.regNumber); }); return !!stu && supOf_(user, stu); }
  return ['PG_Coordinator', 'HoD', 'Submission_Inspector'].indexOf(user.role) !== -1;
}
function canEditSubmission_(user, sub) { return user.role === 'PG_Coordinator' || (user.role === 'Staff' && canSeeSubmission_(user, sub)); }

/** Details + read/edit/download links for every file of a submission, after an access check.
 *  Also makes sure the person opening it really has the matching permission in Drive. */
function api_getSubmissionFiles(token, subId) {
  var user = requireUser_(token), sub = findById_('Submissions', subId);
  if (!sub) throw new Error('Submission not found.');
  if (!canSeeSubmission_(user, sub)) throw new Error('You cannot open this submission.');
  var canEdit = canEditSubmission_(user, sub), ids = fileIdsFromUrls_(sub.driveFileUrls), files = [], cache = CacheService.getScriptCache();
  var myRole = canEdit ? 'writer' : (user.role === 'Submission_Inspector' ? 'commenter' : (user.role === 'HoD' ? 'reader' : ''));
  ids.forEach(function (id) {
    var o = { id: id, name: 'File', mime: '', size: 0, error: '', canEdit: false, edit: '',
      preview: 'https://drive.google.com/file/d/' + id + '/preview', open: 'https://drive.google.com/file/d/' + id + '/view',
      download: 'https://drive.google.com/uc?export=download&id=' + id };
    try {
      var f = DriveApp.getFileById(id); o.name = f.getName(); o.mime = f.getMimeType(); o.size = f.getSize();
      if (canEdit && (o.mime === DOCX_MIME || o.mime === 'application/msword' || o.mime === 'application/vnd.google-apps.document')) { o.canEdit = true; o.edit = 'https://docs.google.com/document/d/' + id + '/edit'; }
    } catch (e) { o.error = 'File details unavailable (it may not be shared with the portal).'; }
    if (myRole && user.email) {
      var ck = 'acc_' + id + '_' + String(user.email).toLowerCase();
      if (!cache.get(ck)) { try { if (grantFileRole_(id, user.email, myRole)) cache.put(ck, '1', 21600); } catch (e2) {} }
    }
    files.push(o);
  });
  var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(sub.regNumber); });
  return { id: sub.id, type: sub.type, regNumber: sub.regNumber, studentName: stu ? fullNameOf_(stu) : '', files: files, compliance: user.role === 'Student' ? null : parseCompliance_(sub.compliance) };
}

/* ---- format & citation check (Word files) ---- */
function parseCompliance_(v) { try { var o = JSON.parse(String(v || '')); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function unescapeXml_(t) { return String(t).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
function docxParagraphs_(xml) {
  var out = [], re = /<w:p[ >][\s\S]*?<\/w:p>/g, m;
  while ((m = re.exec(xml))) {
    var t = '', tr = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g, x;
    while ((x = tr.exec(m[0]))) t += x[1] !== undefined ? unescapeXml_(x[1]) : ' ';
    out.push(t.replace(/\s+/g, ' ').trim());
  }
  return out;
}
function docxMargins_(xml) {
  var res = [], re = /<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g, m, n = 0;
  while ((m = re.exec(xml))) {
    n++;
    var pm = /<w:pgMar\b[^>]*>/.exec(m[0]), o = { section: n, defaulted: !pm };
    ['top', 'right', 'bottom', 'left', 'gutter'].forEach(function (k) {
      var a = pm && new RegExp('w:' + k + '="(-?\\d+)"').exec(pm[0]);
      o[k] = a ? Math.abs(parseInt(a[1], 10)) / 566.929 : (k === 'gutter' ? 0 : 2.54);   // Word default is 1 inch
    });
    res.push(o);
  }
  return res;
}
function marginIssues_(sections) {
  var issues = [];
  if (!sections.length) return [{ severity: 'medium', message: 'Page margins could not be read from this document.' }];
  var groups = {}, order = [];
  sections.forEach(function (sc) {
    var bad = [];
    ['left', 'right', 'top', 'bottom'].forEach(function (k) { if (Math.abs(sc[k] - REQ_MARGIN_CM[k]) > MARGIN_TOL_CM) bad.push(k + ' ' + sc[k].toFixed(2) + ' cm (needs ' + REQ_MARGIN_CM[k].toFixed(1) + ')'); });
    if (sc.gutter > MARGIN_TOL_CM) bad.push('binding gutter ' + sc.gutter.toFixed(2) + ' cm added on top of the left margin');
    if (!bad.length) return;
    var key = bad.join('; ');
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(sc.section);
  });
  order.forEach(function (key) {
    var secs = groups[key];
    issues.push({ severity: 'high', message: 'Margins: ' + (sections.length > 1 ? (secs.length > 1 ? 'sections ' : 'section ') + secs.join(', ') + ' \u2014 ' : '') + key + '.' });
  });
  return issues;
}

var NAME_PAT = "[A-Z\\u00C0-\\u00DE][A-Za-z\\u00C0-\\u024F'\\u2019\\-]+";
var YEAR_PAT = "(?:19|20)\\d{2}[a-z]?";
var NON_AUTHOR_RE = /^(?:in|on|at|by|from|since|until|during|after|before|between|around|circa|about|and|the|of|for|to|see|also|figure|fig|table|eq|equation|section|chapter|year|years|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i;
function citeKey_(surname, year) { return String(surname).toLowerCase().replace(/[^a-z\u00c0-\u024f]/g, '') + '|' + String(year).replace(/[a-z]$/, ''); }
function refHeadingIndex_(paras) {
  var idx = -1;
  for (var i = 0; i < paras.length; i++) if (/^\s*(?:\d+(?:\.\d+)*\.?\s*)?(?:references|reference list|list of references|bibliography|works cited|literature cited)\s*:?\s*$/i.test(paras[i])) idx = i;
  return idx;
}
function extractAuthorYearCites_(text) {
  var cites = [], m;
  var partRe = new RegExp('^(' + NAME_PAT + ')[^0-9]{0,120}?[,\\s]+(' + YEAR_PAT + '(?:\\s*[,&]\\s*' + YEAR_PAT + ')*)(?![0-9])');
  var parenRe = /\(([^()]{3,400})\)/g;
  while ((m = parenRe.exec(text))) {
    if (!new RegExp('(?:^|[^0-9])' + YEAR_PAT).test(m[1])) continue;
    m[1].split(';').forEach(function (part) {
      part = part.replace(/^\s*(?:see|e\.g\.,?|cf\.|also|compare|i\.e\.,?)\s+/i, '');
      var pm = partRe.exec(part.trim());
      if (!pm || NON_AUTHOR_RE.test(pm[1])) return;
      pm[2].split(/[,&\s]+/).filter(Boolean).forEach(function (y) { cites.push({ surname: pm[1], year: y }); });
    });
  }
  var narr = new RegExp('(' + NAME_PAT + ')(?:\\s+(?:and|&)\\s+' + NAME_PAT + '|\\s+et\\s+al\\.?)?\\s*\\((' + YEAR_PAT + ')\\)', 'g');
  while ((m = narr.exec(text))) if (!NON_AUTHOR_RE.test(m[1])) cites.push({ surname: m[1], year: m[2] });
  return cites;
}
function extractNumericCites_(text) {
  var nums = [], occ = 0, m, re = /\[\s*(\d{1,3}(?:\s*[\u2013\-,]\s*\d{1,3})*)\s*\]/g;
  while ((m = re.exec(text))) {
    occ++;
    m[1].split(',').forEach(function (part) {
      var r = part.split(/[\u2013\-]/).map(function (x) { return parseInt(x, 10); });
      if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] <= 200) for (var k = r[0]; k <= r[1]; k++) nums.push(k);
      else if (!isNaN(r[0])) nums.push(r[0]);
    });
  }
  return { nums: nums, occurrences: occ };
}
function listLimited_(arr, max) { return arr.slice(0, max).join('; ') + (arr.length > max ? '; \u2026 +' + (arr.length - max) + ' more' : ''); }
function citationIssues_(paras) {
  var idx = refHeadingIndex_(paras), issues = [], stats = { references: 0, citations: 0 };
  if (idx < 0) return { issues: [{ severity: 'high', message: 'No "References" section was found, so in-text citations could not be checked against a reference list.' }], style: '', stats: stats };
  var body = paras.slice(0, idx).join('\n'), refs = [];
  for (var i = idx + 1; i < paras.length; i++) {
    if (/^\s*appendi(?:x|ces)\b/i.test(paras[i])) break;
    if (paras[i].length >= 15) refs.push(paras[i]);
  }
  stats.references = refs.length;
  var ay = extractAuthorYearCites_(body), nc = extractNumericCites_(body);
  if (!refs.length) { issues.push({ severity: 'high', message: 'The References section is empty.' }); return { issues: issues, style: '', stats: stats }; }
  if (!ay.length && !nc.occurrences) { issues.push({ severity: 'medium', message: 'No in-text citations were detected, but the reference list has ' + refs.length + ' entries.' }); return { issues: issues, style: 'none', stats: stats }; }
  var style = ay.length >= nc.occurrences ? 'author-year' : 'numeric', short = function (t) { t = t.replace(/[.\s]+$/, ''); return t.length > 70 ? t.slice(0, 70) + '\u2026' : t; };
  if (style === 'author-year') {
    var refKeys = {}, list = [];
    refs.forEach(function (t) {
      var nm = new RegExp('^\\s*(?:\\[\\d+\\]\\s*|\\(?\\d+[.)]\\s+)?(' + NAME_PAT + ')').exec(t), ym = /(?:^|[^0-9])((?:19|20)\d{2})[a-z]?(?![0-9])/.exec(t);
      var k = nm && ym ? citeKey_(nm[1], ym[1]) : ''; list.push({ text: t, key: k }); if (k) refKeys[k] = 1;
    });
    var cited = {}, missing = {};
    ay.forEach(function (c) { var k = citeKey_(c.surname, c.year); cited[k] = 1; if (!refKeys[k]) missing[c.surname + ' ' + c.year] = 1; });
    stats.citations = Object.keys(cited).length;
    var mk = Object.keys(missing), unc = list.filter(function (e) { return e.key && !cited[e.key]; }).map(function (e) { return short(e.text); });
    if (mk.length) issues.push({ severity: 'high', message: 'Cited in the text but missing from the reference list (' + mk.length + '): ' + listLimited_(mk, 15) + '.' });
    if (unc.length) issues.push({ severity: 'medium', message: 'In the reference list but never cited in the text (' + unc.length + '): ' + listLimited_(unc, 10) + '.' });
  } else {
    var explicit = refs.map(function (t) { var m = /^\s*\[?(\d{1,3})[\].)]\s+/.exec(t); return m ? parseInt(m[1], 10) : null; });
    var have = {}, nums = explicit.every(function (n) { return n !== null; }) ? explicit : refs.map(function (_, i) { return i + 1; });
    nums.forEach(function (n) { have[n] = 1; });
    var set = {}; nc.nums.forEach(function (n) { set[n] = 1; });
    var miss = Object.keys(set).map(Number).filter(function (n) { return !have[n]; }).sort(function (a, b) { return a - b; }).map(function (n) { return '[' + n + ']'; });
    var unc2 = nums.filter(function (n) { return !set[n]; }).map(function (n) { return '[' + n + ']'; });
    stats.citations = Object.keys(set).length;
    if (miss.length) issues.push({ severity: 'high', message: 'Numbered citations with no matching reference (' + miss.length + '): ' + listLimited_(miss, 20) + '.' });
    if (unc2.length) issues.push({ severity: 'medium', message: 'Numbered references never cited in the text (' + unc2.length + '): ' + listLimited_(unc2, 20) + '.' });
  }
  return { issues: issues, style: style, stats: stats };
}
/** Pure analysis of word/document.xml — margins + citations. */
function analyseDocxXml_(xml) {
  var paras = docxParagraphs_(xml), c = citationIssues_(paras);
  return { issues: marginIssues_(docxMargins_(xml)).concat(c.issues), style: c.style, stats: c.stats };
}
function analyseDriveFile_(id) {
  var f = DriveApp.getFileById(id), mime = f.getMimeType(), out = { name: f.getName(), analysed: false, issues: [], style: '', stats: {} }, blob;
  if (mime === 'application/vnd.google-apps.document') blob = f.getAs(DOCX_MIME);
  else if (mime === DOCX_MIME) {
    if (f.getSize() > 25 * 1024 * 1024) { out.issues.push({ severity: 'info', message: 'File is over 25 MB, so it was not analysed automatically \u2014 read it in the portal.' }); return out; }
    blob = f.getBlob();
  } else if (mime === 'application/pdf') { out.issues.push({ severity: 'info', message: 'PDF: margins and citations cannot be checked automatically. Read it in the portal, or ask for the Word version.' }); return out; }
  else if (mime === 'application/msword') { out.issues.push({ severity: 'info', message: 'Old .doc format cannot be checked automatically. Ask the student to save it as .docx.' }); return out; }
  else { out.issues.push({ severity: 'info', message: 'This file type cannot be checked automatically.' }); return out; }
  var parts = Utilities.unzip(blob.setContentType('application/zip')), xml = '';
  for (var i = 0; i < parts.length; i++) if (parts[i].getName() === 'word/document.xml') { xml = parts[i].getDataAsString('UTF-8'); break; }
  if (!xml) throw new Error('word/document.xml not found');
  var r = analyseDocxXml_(xml);
  out.analysed = true; out.issues = r.issues; out.style = r.style; out.stats = r.stats;
  return out;
}
function runComplianceFor_(sub) {
  var res = { checkedAt: nowIso_(), status: 'Not applicable', style: '', issues: [], stats: {} };
  if (COMPLIANCE_TYPES.indexOf(sub.type) === -1) return res;
  var ids = fileIdsFromUrls_(sub.driveFileUrls), analysed = 0;
  if (!ids.length) { res.status = 'Not checked'; res.issues.push({ severity: 'info', message: 'No Google Drive file link to check.' }); return res; }
  ids.forEach(function (id) {
    try {
      var info = analyseDriveFile_(id), label = ids.length > 1 ? '[' + info.name + '] ' : '';
      info.issues.forEach(function (i) { res.issues.push({ severity: i.severity, message: label + i.message }); });
      if (info.analysed) { analysed++; res.style = res.style || info.style; res.stats = info.stats; }
    } catch (e) { res.issues.push({ severity: 'info', message: 'A file could not be opened or analysed automatically (' + String((e && e.message) || e).slice(0, 120) + ').' }); }
  });
  res.issues = res.issues.slice(0, 40);
  var flagged = res.issues.some(function (i) { return i.severity === 'high' || i.severity === 'medium'; });
  res.status = !analysed ? 'Not checked' : (flagged ? 'Flagged' : 'Pass');
  return res;
}
function notifyInspectorsOfFlags_(sub, res) {
  var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(sub.regNumber); });
  var n = res.issues.filter(function (i) { return i.severity !== 'info'; }).length, targets = {};
  if (sub.assignedTo) targets[String(sub.assignedTo)] = 1;
  else filterWhere_('Users', function (u) { return u.role === 'Submission_Inspector' && toBool_(u.active); }).forEach(function (u) { targets[String(u.regNumber)] = 1; });
  Object.keys(targets).forEach(function (reg) { addNote_(reg, 'Format check flagged ' + n + ' issue(s): ' + (stu ? fullNameOf_(stu) : sub.regNumber) + ' \u2014 ' + sub.type); });
}
function processCompliance_(sub) {
  var before = parseCompliance_(sub.compliance), res = runComplianceFor_(sub);
  updateRow_('Submissions', sub.id, { compliance: JSON.stringify(res) });
  if (res.status === 'Flagged' && (!before || before.status !== 'Flagged')) { try { notifyInspectorsOfFlags_(sub, res); } catch (e) { Logger.log('notify flags: ' + e); } }
  return res;
}
function api_runComplianceCheck(token, subId) {
  var user = requireUser_(token), sub = findById_('Submissions', subId);
  if (!sub) throw new Error('Submission not found.');
  if (!canSeeSubmission_(user, sub)) throw new Error('You cannot check this submission.');
  var res = processCompliance_(sub);
  return user.role === 'Student' ? { ok: true } : res;
}
/** Safety net: checks submissions whose check has not run (e.g. the student closed the page too early). */
function checkPendingSubmissions() {
  var t0 = Date.now(), n = 0;
  readTable_('Submissions').forEach(function (sub) {
    if (n >= 5 || Date.now() - t0 > 240000) return;
    if (COMPLIANCE_TYPES.indexOf(sub.type) === -1 || String(sub.compliance || '').trim() !== '') return;
    if (['Submitted', 'Under Review', 'Changes Requested'].indexOf(sub.status) === -1) return;
    try { processCompliance_(sub); n++; } catch (e) { Logger.log('checkPending ' + sub.id + ': ' + e); }
  });
}
function installComplianceTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkPendingSubmissions') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkPendingSubmissions').timeBased().everyMinutes(10).create();
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (String(p.public) === 'announcements') return publicAnnouncementsJsonp_(p);
  if (String(p.public) === 'enquiry') return publicEnquiryJsonp_(p);
  if (String(p.public) === 'facdep') return publicFacDepJsonp_(p);
  var view = /^[A-Za-z0-9_-]{0,40}$/.test(String(p.view || '')) ? String(p.view || '') : '';
  var embed = p.embed === '1' || p.embed === 'true';
  var name = publicPageName_(p);
  var tpl = template_();
  tpl.page = name;   // single index.html branches its markup/script on this
  var brand = brand_();
  brand.execUrl = ScriptApp.getService().getUrl();   // absolute ?page= links (shared interceptor)
  tpl.brandJson = safeJson_(brand);
  tpl.initialViewJson = safeJson_(view);
  tpl.embedJson = safeJson_(embed);
  tpl.initialPageJson = safeJson_(name === 'login' ? 'home' : name);
  tpl.backJson = safeJson_(safeBackPath_(p.back));   // index.html view switcher
  var titles = {
    home: CFG.APP_NAME,
    about: 'About — ' + CFG.APP_NAME,
    programmes: 'Programmes — ' + CFG.APP_NAME,
    register: 'Register — ' + CFG.APP_NAME,
    contact: 'Contact — ' + CFG.APP_NAME,
    login: 'Login — ' + CFG.APP_NAME
  };
  return tpl.evaluate()
    .setTitle(titles[name] || CFG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(embed ? HtmlService.XFrameOptionsMode.ALLOWALL : HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Allowed public page names: '', home, about, programmes, register, contact, login. */
function publicPageName_(p) {
  if (p.login === '1' || p.login === 'true') return 'login';
  var page = /^[a-z_]{0,20}$/.test(String(p.page || '')) ? String(p.page || '') : '';
  var allowed = { '': 1, home: 1, about: 1, programmes: 1, register: 1, contact: 1, login: 1 };
  return allowed[page] ? (page || 'home') : 'home';
}

/** "Back to the public site" target, passed by the static site's iframe wrapper
 *  as ?back=/ (the public site's home). Same-origin paths only — a full URL,
 *  a protocol-relative "//host" or anything with a query is rejected, so the
 *  portal can never be bounced off to a third party. */
function safeBackPath_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  if (s.charAt(0) !== '/') return '';
  if (s.indexOf('//') === 0) return '';
  if (!/^\/[A-Za-z0-9\-._~\/]*$/.test(s)) return '';
  return s;
}

/** ONE combined template. GAS_Files/index.html holds the head + styles, the
 *  login view and the public-site views (branched on the `page` binding) and
 *  one shared common block — there are no include() files, so scriptlets only
 *  ever evaluate in a file GAS can see. Resolve case-insensitively; fail with
 *  an actionable message. */
function template_() {
  var candidates = ['index', 'Index', 'index.html'];
  for (var i = 0; i < candidates.length; i++) {
    try { return HtmlService.createTemplateFromFile(candidates[i]); } catch (err) {}
  }
  var fb = { msg: 'No HTML file found for "index". In the Apps Script editor: File → New → HTML file, name it exactly "index", then paste PG_Portal/GAS_Files/index.html.' };
  return {
    evaluate: function () {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;max-width:560px;margin:auto">' +
        '<h2 style="color:#14532d">Setup needed</h2><p>' + fb.msg + '</p></div>'
      ).setTitle('Postgraduate Journey — Setup');
    }
  };
}

function publicAnnouncementsJsonp_(p) {
  var cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(String((p && p.callback) || '')) ? String(p.callback) : '';
  var list = filterWhere_('Announcements', function (a) { return toBool_(a.active) && String(a.title || '').trim() !== '' && annAudienceOf_(a) === 'all'; });
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  var items = list.slice(0, 12).map(function (a) { return { id: a.id, title: String(a.title || ''), body: String(a.body || ''), createdAt: String(a.createdAt || '') }; });
  var payload = JSON.stringify({ ok: true, items: items, updatedAt: nowIso_() });
  var out = cb ? (cb + '(' + payload + ');') : payload;
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** JSONP wrapper of the faculty/department list for the static copy of the registration page. */
function publicFacDepJsonp_(p) {
  var cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(String((p && p.callback) || '')) ? String(p.callback) : '';
  var payload;
  try { var d = readFacDep_(); payload = { ok: true, faculties: d.faculties, map: d.map }; }
  catch (err) { payload = { ok: false, error: String((err && err.message) || err) }; }
  var json = JSON.stringify(payload);
  return ContentService.createTextOutput(cb ? (cb + '(' + json + ');') : json).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** JSONP wrapper of api_publicEnquiry — lets the static (Cloudflare) copy of the
 *  public Contact page send enquiries cross-origin. Same validation, rate limit
 *  and branded email; returns {ok:true,message} or {ok:false,error} in the callback. */
function publicEnquiryJsonp_(p) {
  var cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(String((p && p.callback) || '')) ? String(p.callback) : '';
  var payload;
  try {
    payload = api_publicEnquiry(p.name, p.email, p.message);
  } catch (err) {
    payload = { ok: false, error: String((err && err.message) || err) };
  }
  var json = JSON.stringify(payload);
  var out = cb ? (cb + '(' + json + ');') : json;
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function onOpen() {
  try {
    var eff = Session.getEffectiveUser().getEmail(), act = Session.getActiveUser().getEmail();
    if (!eff || eff !== act) return;
    SpreadsheetApp.getUi().createMenu('Postgraduate Journey')
      .addItem('Set up tabs & seed', 'setUp')
      .addItem('Install scheduled jobs (reminders, digests, backup)', 'installAllTriggers')
      .addToUi();
  } catch (e) { /* not container-bound */ }
}