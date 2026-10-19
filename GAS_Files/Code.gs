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
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

var SENDER_DISPLAY_NAME = 'Physics Postgraduate Journey (No-Reply)';
var ENQUIRIES_EMAIL = 'abel.osagie@uniabuja.edu.ng';
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
  SHEETS: {
    USERS: 'Users', STUDENTS: 'Students', STAFF: 'Staff',
    SUBMISSIONS: 'Submissions', ANNOUNCEMENTS: 'Announcements',
    CONFIG: 'Config', AUDIT_LOG: 'AuditLog'
  },
  ROLES: ['Student', 'PG_Coordinator', 'HoD', 'Staff', 'Submission_Inspector'],
  PROGRAMMES: ['MPhil', 'MSc', 'PhD'],
  SPECIALISATIONS: ['Experimental Solid-State Physics', 'Theoretical Solid-State Physics', 'Nuclear Physics', 'Solar Physics', 'Applied Geophysics'],
  SUBMISSION_TYPES: ['Research Plan Form', 'Seminar Presentation', 'Research Proposal', 'Progress Report', 'Final Thesis/Dissertation'],
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
  Users: ['id', 'regNumber', 'email', 'passwordHash', 'salt', 'role', 'fullName', 'firstLogin', 'active', 'status', 'createdAt'],
  Students: ['id', 'regNumber', 'surname', 'firstName', 'otherNames', 'gender', 'phoneNumber', 'email', 'faculty', 'department', 'programme', 'specialisation', 'passportFileId', 'passportUrl', 'mainSupervisorId', 'coSupervisorId', 'currentStage', 'yearOfAdmission', 'createdAt', 'updatedAt'],
  Staff: ['id', 'fullName', 'email', 'rank', 'specialisation', 'active', 'createdAt'],
  Submissions: ['id', 'regNumber', 'type', 'driveFileUrls', 'status', 'inspectorComments', 'supervisorNotes', 'createdBy', 'createdAt', 'updatedAt'],
  Announcements: ['id', 'title', 'body', 'active', 'createdBy', 'createdAt'],
  Config: ['key', 'value', 'updatedAt'],
  AuditLog: ['id', 'at', 'actorId', 'actorUsername', 'action', 'target', 'detail']
};

var ID_PREFIXES = {
  Users: 'Usr', Students: 'Stu', Staff: 'Stf',
  Submissions: 'Sub', Announcements: 'Ann', AuditLog: 'Log'
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
  }
  return rows;
}
function sheetCellValue_(v) {
  if (Object.prototype.toString.call(v) !== '[object Date]') return v;
  var tz = Session.getScriptTimeZone();
  var hasTime = Utilities.formatDate(v, tz, 'HH:mm:ss') !== '00:00:00';
  return Utilities.formatDate(v, tz, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
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
    sheet.appendRow(headers.map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : cellSafe_(obj[h]); }));
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
    var cols = [];
    headers.forEach(function (h, ci) { if (Object.prototype.hasOwnProperty.call(patch, h)) cols.push(ci); });
    var run = null, runs = [];
    cols.forEach(function (ci) {
      if (run && ci === run.end + 1) run.end = ci; else { run = { start: ci, end: ci }; runs.push(run); }
    });
    runs.forEach(function (r) {
      var vals = [];
      for (var ci = r.start; ci <= r.end; ci++) { var v = patch[headers[ci]]; vals.push(v === null || v === undefined ? '' : cellSafe_(v)); }
      sheet.getRange(target._row, r.start + 1, 1, vals.length).setValues([vals]);
    });
    invalidateTable_(name);
    return true;
  }, 30000);
}
function updateRow_(name, id, patch) { return updateRowByField_(name, 'id', id, patch); }
function stripRow_(obj) { var c = {}; Object.keys(obj).forEach(function (k) { if (k !== '_row') c[k] = obj[k]; }); return c; }

/* ---- Audit ---- */
function logAudit_(actorId, actorUsername, action, target, detail) {
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
  var text = String(opts.body || '');
  if (text.indexOf('automated message') === -1) text += mailTextFooter_();
  var html = opts.htmlBody || '';
  if (html && html.indexOf('generated automatically') === -1) {
    html = buildBrandedHtml_('<div style="background:#ffffff;border:1px solid #dbe5df;border-top:none;padding:24px;font-size:14px;line-height:1.5">' + html + '</div>');
  }
  var o = { to: opts.to, subject: opts.subject || CFG.APP_NAME, body: text };
  if (html) o.htmlBody = html;
  if (opts.attachments) o.attachments = opts.attachments;
  o.name = opts.name || mailSenderName_();
  var reply = opts.replyTo || mailEnquiriesAddress_();
  if (reply && EMAIL_RE.test(reply)) o.replyTo = reply;
  if (NOREPLY_FROM_ALIAS && EMAIL_RE.test(NOREPLY_FROM_ALIAS)) o.from = NOREPLY_FROM_ALIAS;
  MailApp.sendEmail(o);
  return true;
}

function publicUser_(u) {
  return { id: u.id, regNumber: u.regNumber, role: u.role, fullName: u.fullName, email: u.email, status: u.status, firstLogin: toBool_(u.firstLogin) };
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
  if (!token) throw new Error('Please sign in to continue.');
  var raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Your session has expired. Please sign in again.');
  var sess = {};
  try { sess = JSON.parse(raw); } catch (e) { sess = { id: raw }; }
  var user = findById_('Users', sess.id);
  if (!user || !toBool_(user.active)) throw new Error('Please sign in again.');
  if (sess.epoch && String(sess.epoch) !== String(sessionEpoch_(user.id))) throw new Error('Your session has expired. Please sign in again.');
  return user;
}
function hasRole_(user, roles) { if (!user) return false; return roles.indexOf(user.role) !== -1; }
function assertRole_(user, roles, message) { if (!hasRole_(user, roles)) throw new Error(message || 'You do not have permission to do that.'); }

function api_login(regNumber, password) {
  if (!regNumber || !password) throw new Error('Enter your registration number and password.');
  var key = String(regNumber).trim();
  if (isLoginLocked_(key)) throw new Error('Too many failed attempts. Please try again in 15 minutes.');
  var user = findWhere_('Users', function (u) { return String(u.regNumber) === key; });
  if (!user || !toBool_(user.active)) { recordLoginFailure_(key); throw new Error('Invalid registration number or password.'); }
  if (String(user.status) === 'Pending') throw new Error('Awaiting PG Coordinator approval. You cannot log in yet.');
  if (String(user.status) === 'Rejected') throw new Error('Your registration was rejected. Please contact the PG Coordinator.');
  if (hashPassword_(password, user.salt) !== String(user.passwordHash)) { recordLoginFailure_(key); throw new Error('Invalid registration number or password.'); }
  clearLoginFailures_(key);
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({ id: user.id, epoch: sessionEpoch_(user.id) }), CFG.SESSION_TTL_SECONDS);
  return { token: token, user: publicUser_(user) };
}
function api_logout(token) { if (token) CacheService.getScriptCache().remove('sess_' + token); return true; }
function api_me(token) { return publicUser_(requireUser_(token)); }

function api_changePassword(token, oldPassword, newPassword) {
  var user = requireUser_(token);
  if (hashPassword_(oldPassword, user.salt) !== String(user.passwordHash)) throw new Error('Old password is incorrect.');
  assertStrongPassword_(newPassword, user.regNumber);
  var salt = makeSalt_();
  updateRow_('Users', user.id, { passwordHash: hashPassword_(newPassword, salt), salt: salt, firstLogin: false });
  bumpSessionEpoch_(user.id);
  logAudit_(user.id, user.regNumber, 'PASSWORD_CHANGE', user.id, 'Password changed');
  return true;
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
  // Seed default config
  var cfgSheet = ss.getSheetByName('Config');
  if (cfgSheet.getLastRow() < 2) {
    cfgSheet.appendRow(['DEFAULT_PASSWORD', CFG.DEFAULT_PASSWORD, nowIso_()]);
    cfgSheet.appendRow(['PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID, nowIso_()]);
    cfgSheet.appendRow(['ADMIN_EMAIL', ENQUIRIES_EMAIL, nowIso_()]);
  }
  Logger.log('setUp complete. Tabs: ' + Object.keys(HEADERS).join(', '));
}

function getSetting_(key, def) {
  var row = findWhere_('Config', function (r) { return String(r.key) === String(key); });
  return row ? String(row.value) : def;
}

/* =========================== 6. PUBLIC REGISTRATION =========================== */

var REG_RE_1 = /^UA\/pg20\d{2}\/\d{6}$/;
var REG_RE_2 = /^\d{2}\/\d{3}[A-Z]{3,4}\/\d{3,4}$/;

function validateRegNumber_(reg) { return REG_RE_1.test(reg) || REG_RE_2.test(reg); }
function validateEmail_(email) { return EMAIL_RE.test(email); }
function validatePhone_(phone) {
  phone = String(phone || '').replace(/\D/g, '');
  if (phone.length === 10) phone = '0' + phone;
  return phone.length === 11 ? phone : null;
}
function validateName_(name) { var s = String(name || '').trim(); return s.length >= 2 && /^[A-Za-z\s'\-]+$/.test(s); }

/** Serialised wrapper: one writer at a time so read-check-write cannot interleave. */
function api_register_locked_(payload) {
  if (!payload) throw new Error('Missing form data.');
  var reg = String(payload.regNumber || '').trim();
  if (!validateRegNumber_(reg)) throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
  if (!validateName_(payload.surname)) throw new Error('Surname must be at least 2 letters.');
  if (!validateName_(payload.firstName)) throw new Error('First name must be at least 2 letters.');
  var email = String(payload.email || '').trim();
  if (!validateEmail_(email)) throw new Error('Invalid email address.');
  var phone = validatePhone_(payload.phoneNumber);
  if (!phone) throw new Error('Phone must be exactly 11 digits.');
  if (CFG.PROGRAMMES.indexOf(payload.programme) === -1) throw new Error('Invalid programme.');
  if (CFG.SPECIALISATIONS.indexOf(payload.specialisation) === -1) throw new Error('Invalid specialisation.');
  if (['Male', 'Female'].indexOf(payload.gender) === -1) throw new Error('Gender must be Male or Female.');

  if (findWhere_('Users', function (u) { return String(u.regNumber) === reg; })) throw new Error('Registration number already registered.');

  // Upload passport
  if (!payload.passportPhoto || !payload.passportPhoto.dataUrl) throw new Error('Passport photo is required.');
  var fileInfo = savePassportPhoto_(payload.passportPhoto, reg);

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
    faculty: String(payload.faculty || 'Faculty of Science').trim(),
    department: String(payload.department || 'Physics').trim(),
    programme: payload.programme,
    specialisation: payload.specialisation,
    passportFileId: fileInfo.id,
    passportUrl: fileInfo.url,
    mainSupervisorId: '',
    coSupervisorId: '',
    currentStage: '1 - Admission',
    yearOfAdmission: new Date().getFullYear(),
    createdAt: now,
    updatedAt: now
  });

  appendRow_('Users', {
    regNumber: reg,
    email: email,
    passwordHash: hashPassword_(CFG.DEFAULT_PASSWORD, salt),
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
      faculty: String(payload.faculty || 'Faculty of Science').trim(),
      department: String(payload.department || 'Physics').trim(),
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
function notifyRegistrationDecision_(target, status, reason) {
  if (!target || !target.email || !EMAIL_RE.test(String(target.email))) return;
  var approved = status === 'Approved';
  var name = String(target.fullName || target.regNumber);
  var head = approved ? 'Registration approved' : 'Registration not approved';
  var line1 = approved
    ? 'Your registration has been approved. You can now sign in with your registration number and your password.'
    : 'Your registration was not approved.';
  var text = [CFG.APP_NAME + ' — ' + head, '', 'Dear ' + name + ',', '', line1]
    .concat(approved ? [] : ['', 'Reason: ' + (String(reason || '').trim() || 'Not stated.')])
    .concat(['', approved ? 'Open the portal Login page to sign in.' : 'For clarification, contact ' + mailEnquiriesAddress_() + '.']).join('\n');
  var html = '<h2 style="color:#14532d;margin:0 0 4px;font-size:18px">' + escHtml_(CFG.APP_NAME) + '</h2>' +
    '<p style="color:#66756f;margin:0 0 16px;font-size:13px">' + escHtml_(head) + '</p>' +
    '<p style="margin:0 0 10px">Dear ' + escHtml_(name) + ', ' + escHtml_(line1) + '</p>' +
    (approved
      ? '<p style="margin:0 0 10px">Registration number: <strong>' + escHtml_(target.regNumber) + '</strong></p>'
      : '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:6px 8px;border:1px solid #e2e8e4;background:#f4f7f5;color:#14532d;white-space:nowrap"><strong>Reason</strong></td><td style="padding:6px 8px;border:1px solid #e2e8e4">' + escHtml_(String(reason || '').trim() || 'Not stated.') + '</td></tr></table>') +
    '<p style="color:#66756f;font-size:13px;margin-top:12px">' + (approved ? 'If this is your first sign-in you will be asked to change your password.' : 'For clarification, contact the PG Coordinator at ' + escHtml_(mailEnquiriesAddress_()) + '.') + '</p>';
  sendPortalMail_({ to: target.email, subject: head + ' — ' + target.regNumber + ' (' + CFG.APP_NAME + ')', body: text, htmlBody: html });
}

function savePassportPhoto_(filePayload, regNumber) {
  var folderId = getSetting_('PASSPORT_FOLDER_ID', DEFAULT_PASSPORT_FOLDER_ID);
  var folder = DriveApp.getFolderById(folderId);
  var parts = String(filePayload.dataUrl).split(',');
  var mimeMatch = parts[0].match(/data:(.*?);/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  if (['image/jpeg', 'image/png'].indexOf(mime) === -1) throw new Error('Passport must be JPG or PNG.');
  var bytes = Utilities.base64Decode(parts[1]);
  if (bytes.length > CFG.UPLOAD_MAX_BYTES) throw new Error('Passport photo must be under 1 MB.');
  var ext = mime === 'image/png' ? 'png' : 'jpg';
  var blob = Utilities.newBlob(bytes, mime, regNumber + '_passport_' + new Date().getTime() + '.' + ext);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: file.getUrl() };
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
  var fields = {
    fullName: String(payload.fullName).trim(),
    email: String(payload.email || '').trim(),
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

/* =========================== 8. SUPERVISOR ASSIGNMENT =========================== */

function api_assignSupervisors_locked_(token, regNumber, mainSupervisorId, coSupervisorId) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can assign supervisors.');
  if (!regNumber) throw new Error('Reg number required.');
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(regNumber); });
  if (!student) throw new Error('Student not found.');
  if (mainSupervisorId && !findById_('Staff', mainSupervisorId)) throw new Error('Main supervisor not found in Staff list.');
  if (coSupervisorId && !findById_('Staff', coSupervisorId)) throw new Error('Co-supervisor not found in Staff list.');
  updateRow_('Students', student.id, { mainSupervisorId: mainSupervisorId || '', coSupervisorId: coSupervisorId || '', updatedAt: nowIso_() });
  var mainName = mainSupervisorId ? (findById_('Staff', mainSupervisorId) || {}).fullName || '' : 'None';
  var coName = coSupervisorId ? (findById_('Staff', coSupervisorId) || {}).fullName || '' : 'None';
  logAudit_(user.id, user.regNumber, 'ASSIGN_SUPERVISORS', regNumber, 'Main: ' + mainName + ', Co: ' + coName);
  return { ok: true };
}
function api_assignSupervisors() { var a = arguments; return withScriptLock_(function () { return api_assignSupervisors_locked_.apply(null, a); }, 30000); }

function api_updateStudentStage_locked_(token, regNumber, stage) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can update the stage.');
  if (CFG.JOURNEY_STAGES.indexOf(stage) === -1) throw new Error('Invalid stage.');
  var student = findWhere_('Students', function (s) { return String(s.regNumber) === String(regNumber); });
  if (!student) throw new Error('Student not found.');
  updateRow_('Students', student.id, { currentStage: stage, updatedAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'UPDATE_STAGE', regNumber, stage);
  return { ok: true };
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
  return { ok: true, url: fileInfo.url };
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
  var anns = filterWhere_('Announcements', function (a) { return toBool_(a.active); });
  anns.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return {
    student: {
      regNumber: student.regNumber, surname: student.surname, firstName: student.firstName, otherNames: student.otherNames,
      gender: student.gender, phoneNumber: student.phoneNumber, email: student.email,
      faculty: student.faculty, department: student.department, programme: student.programme,
      specialisation: student.specialisation, passportUrl: student.passportUrl, passportFileId: student.passportFileId,
      currentStage: student.currentStage, yearOfAdmission: student.yearOfAdmission,
      mainSupervisor: mainSup ? { id: mainSup.id, fullName: mainSup.fullName, email: mainSup.email, rank: mainSup.rank } : null,
      coSupervisor: coSup ? { id: coSup.id, fullName: coSup.fullName, email: coSup.email, rank: coSup.rank } : null
    },
    submissions: subs.map(function (s) { return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, inspectorComments: s.inspectorComments, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt }; }),
    announcements: anns.slice(0, 10).map(function (a) { return { id: a.id, title: a.title, body: a.body, createdAt: a.createdAt }; }),
    templates: CFG.TEMPLATES,
    stages: CFG.JOURNEY_STAGES
  };
}

/* =========================== 11. SUBMISSIONS =========================== */

function api_createSubmission_locked_(token, payload) {
  var user = requireUser_(token);
  assertRole_(user, ['Student'], 'Only students can submit documents.');
  if (!payload || !payload.type || CFG.SUBMISSION_TYPES.indexOf(payload.type) === -1) throw new Error('Invalid submission type.');
  if (!payload.driveFileUrls) throw new Error('Drive file URL is required.');
  var now = nowIso_();
  var row = appendRow_('Submissions', {
    regNumber: user.regNumber,
    type: payload.type,
    driveFileUrls: String(payload.driveFileUrls).trim(),
    status: 'Submitted',
    inspectorComments: '',
    supervisorNotes: '',
    createdBy: user.id,
    createdAt: now,
    updatedAt: now
  });
  logAudit_(user.id, user.regNumber, 'CREATE_SUBMISSION', row.id, 'Type: ' + payload.type);
  return { id: row.id };
}
function api_createSubmission() { var a = arguments; return withScriptLock_(function () { return api_createSubmission_locked_.apply(null, a); }, 30000); }

function api_listSubmissions(token, filter) {
  var user = requireUser_(token);
  var list;
  if (user.role === 'Student') {
    list = filterWhere_('Submissions', function (s) { return String(s.regNumber) === String(user.regNumber); });
  } else if (user.role === 'Staff') {
    var myStudents = filterWhere_('Students', function (s) { return String(s.mainSupervisorId) === user.id || String(s.coSupervisorId) === user.id; });
    var regMap = {};
    myStudents.forEach(function (s) { regMap[s.regNumber] = 1; });
    list = filterWhere_('Submissions', function (s) { return regMap[s.regNumber]; });
  } else if (user.role === 'Submission_Inspector') {
    list = filterWhere_('Submissions', function (s) { return s.status === 'Submitted' || s.status === 'Changes Requested'; });
  } else {
    list = readTable_('Submissions');
  }
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return list.map(function (s) {
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(s.regNumber); });
    return {
      id: s.id, regNumber: s.regNumber, type: s.type, status: s.status,
      driveFileUrls: s.driveFileUrls, inspectorComments: s.inspectorComments,
      supervisorNotes: s.supervisorNotes, createdAt: s.createdAt,
      studentName: stu ? fullNameOf_(stu) : '', programme: stu ? stu.programme : ''
    };
  });
}

function api_updateSubmissionStatus_locked_(token, submissionId, newStatus, comments) {
  var user = requireUser_(token);
  assertRole_(user, ['Submission_Inspector', 'PG_Coordinator'], 'You cannot update submission status.');
  if (CFG.SUBMISSION_STATUSES.indexOf(newStatus) === -1) throw new Error('Invalid status.');
  if ((newStatus === 'Rejected' || newStatus === 'Changes Requested') && !String(comments || '').trim()) throw new Error('Comments are required for Rejected / Changes Requested.');
  var sub = findById_('Submissions', submissionId);
  if (!sub) throw new Error('Submission not found.');
  updateRow_('Submissions', submissionId, { status: newStatus, inspectorComments: String(comments || '').trim(), updatedAt: nowIso_() });
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

/* =========================== 12. COORDINATOR =========================== */

function api_getCoordinatorDashboard(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'Access denied.');
  var users = readTable_('Users');
  var students = readTable_('Students');
  var pending = users.filter(function (u) { return String(u.status) === 'Pending'; }).map(function (u) {
    var stu = findWhere_('Students', function (s) { return String(s.regNumber) === String(u.regNumber); }) || {};
    return { regNumber: u.regNumber, fullName: u.fullName, email: u.email, programme: stu.programme || '', status: u.status };
  });
  var allStudents = students.map(function (s) {
    var main = s.mainSupervisorId ? findById_('Staff', s.mainSupervisorId) : null;
    var co = s.coSupervisorId ? findById_('Staff', s.coSupervisorId) : null;
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(s.regNumber); });
    return {
      regNumber: s.regNumber, fullName: fullNameOf_(s), programme: s.programme, specialisation: s.specialisation,
      mainSupervisor: main ? main.fullName : '', coSupervisor: co ? co.fullName : '',
      currentStage: s.currentStage, status: u ? u.status : ''
    };
  });
  var staffList = filterWhere_('Staff', function (s) { return toBool_(s.active); }).map(function (s) { return { id: s.id, fullName: s.fullName, rank: s.rank, specialisation: s.specialisation }; });
  return { pending: pending, students: allStudents, staff: staffList, stages: CFG.JOURNEY_STAGES };
}

function api_approveStudent_locked_(token, regNumber) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can approve students.');
  var target = findWhere_('Users', function (u) { return String(u.regNumber) === String(regNumber); });
  if (!target) throw new Error('User not found.');
  updateRow_('Users', target.id, { status: 'Approved' });
  logAudit_(user.id, user.regNumber, 'APPROVE_STUDENT', regNumber, 'Approved');
  try { notifyRegistrationDecision_(target, 'Approved', ''); } catch (mailErr) { Logger.log('Approve email failed for ' + regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true };
}
function api_approveStudent() { var a = arguments; return withScriptLock_(function () { return api_approveStudent_locked_.apply(null, a); }, 30000); }

function api_rejectStudent_locked_(token, regNumber, reason) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can reject students.');
  var target = findWhere_('Users', function (u) { return String(u.regNumber) === String(regNumber); });
  if (!target) throw new Error('User not found.');
  updateRow_('Users', target.id, { status: 'Rejected' });
  logAudit_(user.id, user.regNumber, 'REJECT_STUDENT', regNumber, reason || '');
  try { notifyRegistrationDecision_(target, 'Rejected', reason); } catch (mailErr) { Logger.log('Reject email failed for ' + regNumber + ': ' + (mailErr && mailErr.message ? mailErr.message : mailErr)); }
  return { ok: true };
}
function api_rejectStudent() { var a = arguments; return withScriptLock_(function () { return api_rejectStudent_locked_.apply(null, a); }, 30000); }

function api_addAnnouncement_locked_(token, title, body) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator', 'HoD'], 'You cannot post announcements.');
  if (!String(title || '').trim() || !String(body || '').trim()) throw new Error('Title and body are required.');
  var row = appendRow_('Announcements', { title: String(title).trim().slice(0, 200), body: String(body).slice(0, 5000), active: true, createdBy: user.id, createdAt: nowIso_() });
  logAudit_(user.id, user.regNumber, 'ADD_ANNOUNCEMENT', row.id, title);
  return { id: row.id };
}
function api_addAnnouncement() { var a = arguments; return withScriptLock_(function () { return api_addAnnouncement_locked_.apply(null, a); }, 30000); }

function api_exportData(token) {
  var user = requireUser_(token);
  assertRole_(user, ['PG_Coordinator'], 'Only the PG Coordinator can export data.');
  var students = readTable_('Students');
  var users = readTable_('Users');
  var subs = readTable_('Submissions');
  var csv = 'RegNumber,Surname,FirstName,OtherNames,Gender,Phone,Programme,Specialisation,MainSupervisor,CoSupervisor,Stage,Status\n';
  students.forEach(function (s) {
    var u = findWhere_('Users', function (x) { return String(x.regNumber) === String(s.regNumber); }) || {};
    var main = s.mainSupervisorId ? (findById_('Staff', s.mainSupervisorId) || {}).fullName || '' : '';
    var co = s.coSupervisorId ? (findById_('Staff', s.coSupervisorId) || {}).fullName || '' : '';
    csv += [s.regNumber, s.surname, s.firstName, s.otherNames, s.gender, s.phoneNumber, s.programme, s.specialisation, main, co, s.currentStage, u.status || ''].map(function (v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }).join(',') + '\n';
  });
  csv += '\n\nSubmissions:\nSubmissionID,RegNumber,Type,Status,CreatedAt\n';
  subs.forEach(function (s) {
    csv += [s.id, s.regNumber, s.type, s.status, s.createdAt].map(function (v) { return '"' + String(v || '') + '"'; }).join(',') + '\n';
  });
  return csv;
}

/* =========================== 13. HoD (read-only) =========================== */

function api_getHoDStats(token) {
  var user = requireUser_(token);
  assertRole_(user, ['HoD', 'PG_Coordinator'], 'Access denied.');
  var students = readTable_('Students');
  var users = readTable_('Users');
  var subs = readTable_('Submissions');
  var byProgramme = {};
  students.forEach(function (s) { byProgramme[s.programme] = (byProgramme[s.programme] || 0) + 1; });
  var byStatus = {};
  subs.forEach(function (s) { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
  var userByStatus = {};
  users.forEach(function (u) { userByStatus[u.status] = (userByStatus[u.status] || 0) + 1; });
  var subList = subs.map(function (s) {
    var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(s.regNumber); });
    return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, studentName: stu ? fullNameOf_(stu) : '', createdAt: s.createdAt };
  });
  return {
    totalStudents: students.length,
    byProgramme: byProgramme,
    bySubmissionStatus: byStatus,
    byUserStatus: userByStatus,
    submissions: subList
  };
}

/* =========================== 14. STAFF DASHBOARD =========================== */

function api_getStaffDashboard(token) {
  var user = requireUser_(token);
  assertRole_(user, ['Staff'], 'Access denied.');
  var myStudents = filterWhere_('Students', function (s) { return String(s.mainSupervisorId) === user.id || String(s.coSupervisorId) === user.id; });
  var regMap = {};
  myStudents.forEach(function (s) { regMap[s.regNumber] = 1; });
  var subs = filterWhere_('Submissions', function (s) { return regMap[s.regNumber]; });
  return {
    students: myStudents.map(function (s) {
      return { regNumber: s.regNumber, fullName: fullNameOf_(s), programme: s.programme, specialisation: s.specialisation, currentStage: s.currentStage, passportUrl: s.passportUrl };
    }),
    submissions: subs.map(function (s) {
      var stu = findWhere_('Students', function (x) { return String(x.regNumber) === String(s.regNumber); });
      return { id: s.id, regNumber: s.regNumber, studentName: stu ? fullNameOf_(stu) : '', type: s.type, status: s.status, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt };
    })
  };
}

/* =========================== 15. PUBLIC (NO AUTH) =========================== */
/* Used by the public landing pages (index / register / contact).            */

/** Active announcements for the public Home page. */
function api_publicAnnouncements() {
  var list = filterWhere_('Announcements', function (a) { return toBool_(a.active) && String(a.title || '').trim() !== ''; });
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
  var em = String(email || '').trim();
  var msg = String(message || '').trim();
  if (!validateName_(n)) throw new Error('Please enter your name (at least 2 letters).');
  if (!validateEmail_(em)) throw new Error('Please enter a valid email address.');
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

/* =========================== 16. WEB ENTRY =========================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (String(p.public) === 'announcements') return publicAnnouncementsJsonp_(p);
  if (String(p.public) === 'enquiry') return publicEnquiryJsonp_(p);
  var view = /^[A-Za-z0-9_-]{0,40}$/.test(String(p.view || '')) ? String(p.view || '') : '';
  var embed = p.embed === '1' || p.embed === 'true';
  var name = publicPageName_(p);
  var tpl = template_(name);
  tpl.brandJson = safeJson_(brand_());
  tpl.initialViewJson = safeJson_(view);
  tpl.embedJson = safeJson_(embed);
  tpl.initialPageJson = safeJson_(name === 'login' ? 'home' : name);   // index.html view switcher
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

/** Resolve an HTML file case-insensitively; fail with actionable message.
 *  All public pages (home/about/programmes/register/contact) live in ONE file:
 *  "index". Only the portal has its own file: "login". */
function template_(name) {
  var base = String(name || 'home');
  var file = base === 'login' ? 'login' : 'index';
  var candidates = [file, file.charAt(0).toUpperCase() + file.slice(1), file + '.html'];
  for (var i = 0; i < candidates.length; i++) {
    try { return HtmlService.createTemplateFromFile(candidates[i]); } catch (err) {}
  }
  var fb = { msg: 'No HTML file found for "' + file + '". In the Apps Script editor: File → New → HTML file, name it exactly "' + file + '", then paste PG_Portal/GAS_Files/' + file + '.html.' };
  return {
    evaluate: function () {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;max-width:560px;margin:auto">' +
        '<h2 style="color:#14532d">Setup needed</h2><p>' + fb.msg + '</p></div>'
      ).setTitle('Postgraduate Journey — Setup');
    }
  };
}

/** GAS include pattern: <?!= include('styles') ?> etc. */
function include(filename) {
  try { return HtmlService.createHtmlOutputFromFile(filename).getContent(); } catch (err) {
    return '<div style="font-family:sans-serif;padding:40px;max-width:560px;margin:auto">' +
      '<h2 style="color:#14532d">Setup needed</h2><p>No HTML file named "' + escHtml_(filename) + '". ' +
      'In the Apps Script editor: File → New → HTML file, name it exactly "' + escHtml_(filename) + '", ' +
      'then paste PG_Portal/GAS_Files/' + escHtml_(filename) + '.html.</p></div>';
  }
}

function publicAnnouncementsJsonp_(p) {
  var cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(String((p && p.callback) || '')) ? String(p.callback) : '';
  var list = filterWhere_('Announcements', function (a) { return toBool_(a.active) && String(a.title || '').trim() !== ''; });
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  var items = list.slice(0, 12).map(function (a) { return { id: a.id, title: String(a.title || ''), body: String(a.body || ''), createdAt: String(a.createdAt || '') }; });
  var payload = JSON.stringify({ ok: true, items: items, updatedAt: nowIso_() });
  var out = cb ? (cb + '(' + payload + ');') : payload;
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
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
      .addToUi();
  } catch (e) { /* not container-bound */ }
}
