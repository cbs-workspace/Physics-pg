/**
 * Local preview server for the Department of Physics Postgraduate Journey (GAS).
 *
 * The Apps Script project is TWO files in GAS_Files/:
 *   Code.gs        server (mocked below — the deployed sheet API is not used)
 *   index.html     one combined template: the public site
 *                  (?page=home|about|programmes|register|contact) AND the
 *                  portal SPA (?page=login), selected server-side by the
 *                  `page` scriptlet branch
 *
 * Serves any page with:
 *  - the template scriptlets rendered exactly like doGet (tools/pg-template.js)
 *  - a mocked google.script.run backed by in-memory demo data
 *    (same accounts as SeedData.md, password PhysicsPG2026!)
 *  - /images/* served from images/ (hero background) and the repo root
 *
 * Usage: npm run pg   →   http://localhost:8081  (home)
 *                         http://localhost:8081/?page=register  etc.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { renderTemplate } = require("./pg-template");

const GAS_DIR = path.resolve(__dirname, "..", "GAS_Files");
const IMG_DIR = path.resolve(__dirname, "..", "images");
const port = Number(process.env.PORT || process.argv[2] || 8081);

/** ?page= name (or path) → allowed keys. Whitelisted. All views render the
 *  single combined index.html with that page name as the `page` context. */
const PAGES = ["", "home", "about", "programmes", "register", "contact", "login"];

const BRAND = {
  schoolName: "Department of Physics Postgraduate Journey",
  subtitle: "University of Abuja",
  footerText: "© 2026 Capacity Building and Support. All rights reserved.",
  logoUrl: "https://drive.google.com/thumbnail?id=1LDjsF_70W2BpttMyLxfmltABCyUSPeHl",
  cbsLogoUrl: "https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ",
  heroBgUrl: "/images/Phy_Complex.png",
};

const STAGES = [
  "1 - Admission", "2 - Lecture Attendance", "3 - Supervisor Allocation",
  "4 - Proposal Submission", "5 - Proposal Defence Form", "6 - Proposal Defence",
  "7 - Progression Clearance", "8 - Progress Report", "9 - Compliance Inspection",
  "10 - Plagiarism Check", "11 - External Defence", "12 - Examiners Comments",
  "13 - Final Compliance", "14 - Signed Copies", "15 - Completion",
];

const TEMPLATES = {
  "Research Plan Form": "18LZ-3c0rrMPrpuJbrGgngJp9ALzpPetS",
  "PG Journey Roadmap": "1ToBmrpIYu-5hvRHy3SVTxxgHSOnIMBp1",
  "Seminar Template": "1e1Ep8-LvFlxXP8VBLPiWnP-lVqCq_lFH",
};

/* ---- In-memory demo database ---- */
function seedDb() {
  const now = "2026-10-01 08:00:00";
  const users = [
    { id: "Usr01", regNumber: "UA/pg2026/000001", email: "demo.student1@gmail.com", role: "Student", fullName: "Chinedu Okafor", firstLogin: false, active: true, status: "Approved", createdAt: now },
    { id: "Usr02", regNumber: "UA/pg2026/000002", email: "demo.student2@gmail.com", role: "Student", fullName: "Fatima Adamu", firstLogin: true, active: true, status: "Pending", createdAt: now },
    { id: "Usr03", regNumber: "26/408PHYX/040", email: "demo.student4@gmail.com", role: "Student", fullName: "Blessing Eze", firstLogin: false, active: true, status: "Approved", createdAt: now },
    { id: "Usr04", regNumber: "UA/pg2026/000010", email: "demo.coordinator@gmail.com", role: "PG_Coordinator", fullName: "Amina Bala", firstLogin: false, active: true, status: "Approved", createdAt: now },
    { id: "Usr05", regNumber: "UA/pg2026/000011", email: "demo.hod@gmail.com", role: "HoD", fullName: "Prof. Musa Aliyu", firstLogin: false, active: true, status: "Approved", createdAt: now },
    { id: "Usr06", regNumber: "UA/pg2026/000012", email: "demo.staff@gmail.com", role: "Staff", fullName: "Dr. Grace Obi", firstLogin: false, active: true, status: "Approved", createdAt: now },
    { id: "Usr07", regNumber: "UA/pg2026/000013", email: "demo.inspector@gmail.com", role: "Submission_Inspector", fullName: "Dr. Samuel Eze", firstLogin: false, active: true, status: "Approved", createdAt: now },
  ];
  const students = [
    { id: "Stu01", regNumber: "UA/pg2026/000001", surname: "Okafor", firstName: "Chinedu", otherNames: "Emeka", gender: "Male", phoneNumber: "08012345678", email: "demo.student1@gmail.com", faculty: "Faculty of Science", department: "Physics", programme: "MSc", specialisation: "Experimental Solid-State Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "Stf01", coSupervisorId: "Stf02", currentStage: "4 - Proposal Submission", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
    { id: "Stu02", regNumber: "UA/pg2026/000002", surname: "Adamu", firstName: "Fatima", otherNames: "Yusuf", gender: "Female", phoneNumber: "08098765432", email: "demo.student2@gmail.com", faculty: "Faculty of Science", department: "Physics", programme: "PhD", specialisation: "Nuclear Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "", coSupervisorId: "", currentStage: "1 - Admission", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
    { id: "Stu03", regNumber: "26/408PHYX/040", surname: "Eze", firstName: "Blessing", otherNames: "Chidi", gender: "Female", phoneNumber: "08055556666", email: "demo.student4@gmail.com", faculty: "Faculty of Science", department: "Physics", programme: "PhD", specialisation: "Solar Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "Stf01", coSupervisorId: "", currentStage: "8 - Progress Report", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
  ];
  const staff = [
    { id: "Stf01", fullName: "Dr. Bala Ahmed", email: "bala.ahmed@uniabuja.edu.ng", rank: "Senior Lecturer", specialisation: "Solid-State Physics", active: true, createdAt: now },
    { id: "Stf02", fullName: "Dr. Grace Obi", email: "grace.obi@uniabuja.edu.ng", rank: "Lecturer I", specialisation: "Nuclear Physics", active: true, createdAt: now },
    { id: "Stf03", fullName: "Prof. Musa Aliyu", email: "musa.aliyu@uniabuja.edu.ng", rank: "Professor", specialisation: "Solar Physics", active: true, createdAt: now },
    { id: "Stf04", fullName: "Dr. Samuel Eze", email: "samuel.eze@uniabuja.edu.ng", rank: "Lecturer II", specialisation: "Applied Geophysics", active: true, createdAt: now },
  ];
  const submissions = [
    { id: "Sub01", regNumber: "UA/pg2026/000001", type: "Research Proposal", driveFileUrls: "https://drive.google.com/file/d/EXAMPLE1", status: "Approved", inspectorComments: "Good work", supervisorNotes: "Reviewed by Dr. Bala", createdBy: "Usr01", createdAt: "2026-06-15 10:00:00", updatedAt: "2026-06-20 14:00:00" },
    { id: "Sub02", regNumber: "UA/pg2026/000001", type: "Progress Report", driveFileUrls: "https://drive.google.com/file/d/EXAMPLE2", status: "Submitted", inspectorComments: "", supervisorNotes: "", createdBy: "Usr01", createdAt: "2026-09-20 14:30:00", updatedAt: "2026-09-20 14:30:00" },
    { id: "Sub03", regNumber: "26/408PHYX/040", type: "Seminar Presentation", driveFileUrls: "https://drive.google.com/file/d/EXAMPLE3", status: "Changes Requested", inspectorComments: "Please expand section 3", supervisorNotes: "", createdBy: "Usr03", createdAt: "2026-07-01 09:15:00", updatedAt: "2026-07-02 10:00:00" },
  ];
  const announcements = [
    { id: "Ann01", title: "Welcome to 2026/2027 Session", body: "Department of Physics Postgraduate Journey is now live. Register and await approval.", active: true, createdBy: "Usr04", createdAt: "2026-10-01 08:00:00" },
    { id: "Ann02", title: "Monthly Seminar Schedule", body: "Next seminar holds on the last Thursday of every month at 2PM, Physics Seminar Room.", active: true, createdBy: "Usr04", createdAt: "2026-10-15 10:00:00" },
  ];
  return { users, students, staff, submissions, announcements, sessions: {}, seq: 100 };
}

const DB = seedDb();
const DEFAULT_PASSWORD = "PhysicsPG2026!";

/* ---- Mock helpers ---- */
function fullNameOf(s) { return [s.firstName, s.otherNames, s.surname].filter(Boolean).join(" "); }
function publicUser(u) { return { id: u.id, regNumber: u.regNumber, role: u.role, fullName: u.fullName, email: u.email, status: u.status, firstLogin: !!u.firstLogin }; }
function requireUser(token) {
  const id = DB.sessions[token];
  if (!id) throw new Error("Session expired. Please sign in again.");
  const u = DB.users.find((x) => x.id === id);
  if (!u || !u.active) throw new Error("Session expired. Please sign in again.");
  return u;
}
function assertRole(user, roles) {
  if (roles.indexOf(user.role) === -1) throw new Error("Access denied.");
}
function nextId(prefix) { DB.seq += 1; return prefix + DB.seq; }
function now() { return new Date().toISOString().slice(0, 19).replace("T", " "); }

/* ---- Mock API ---- */
const API = {
  api_login(regNumber, password) {
    if (!regNumber || !password) throw new Error("Enter your registration number and password.");
    const key = String(regNumber).trim();
    const user = DB.users.find((u) => u.regNumber === key);
    if (!user || !user.active) throw new Error("Invalid registration number or password.");
    if (user.status === "Pending") throw new Error("Awaiting PG Coordinator approval. You cannot log in yet.");
    if (user.status === "Rejected") throw new Error("Your registration was rejected. Please contact the PG Coordinator.");
    if (String(password) !== DEFAULT_PASSWORD) throw new Error("Invalid registration number or password.");
    const token = "demo-" + user.id + "-" + Date.now();
    DB.sessions[token] = user.id;
    return { token, user: publicUser(user) };
  },
  api_logout(token) { if (token) delete DB.sessions[token]; return true; },
  api_me(token) { return publicUser(requireUser(token)); },
  api_changePassword(token, oldPassword, newPassword) {
    const user = requireUser(token);
    if (String(oldPassword) !== DEFAULT_PASSWORD) throw new Error("Old password is incorrect.");
    const s = String(newPassword || "");
    if (s.length < 8 || s.length > 128) throw new Error("Password must be 8-128 characters.");
    if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) throw new Error("Password must contain at least one letter and one number.");
    const banned = ["password", "qwerty", "12345678", "abcd1234", "demo@1234", "physicspg2026!"];
    if (banned.indexOf(s.toLowerCase()) !== -1) throw new Error("That password is too common. Choose something unique.");
    user.firstLogin = false;
    return true;
  },
  api_register(payload) {
    if (!payload || !payload.regNumber) throw new Error("Missing form data.");
    const reg = String(payload.regNumber).trim();
    if (DB.users.some((u) => u.regNumber === reg)) throw new Error("Registration number already registered.");
    const nowStr = now();
    DB.students.push({
      id: nextId("Stu"), regNumber: reg,
      surname: payload.surname || "", firstName: payload.firstName || "", otherNames: payload.otherNames || "",
      gender: payload.gender || "", phoneNumber: payload.phoneNumber || "", email: payload.email || "",
      faculty: payload.faculty || "Faculty of Science", department: payload.department || "Physics",
      programme: payload.programme || "MSc", specialisation: payload.specialisation || "",
      passportFileId: "local", passportUrl: (payload.passportPhoto && payload.passportPhoto.dataUrl) || "",
      mainSupervisorId: "", coSupervisorId: "", currentStage: "1 - Admission",
      yearOfAdmission: new Date().getFullYear(), createdAt: nowStr, updatedAt: nowStr,
    });
    DB.users.push({
      id: nextId("Usr"), regNumber: reg, email: payload.email || "", role: "Student",
      fullName: (payload.firstName || "") + " " + (payload.surname || ""), firstLogin: true, active: true, status: "Pending", createdAt: nowStr,
    });
    return { ok: true, message: "Registration submitted. Awaiting PG Coordinator approval." };
  },
  api_updateProfilePhoto(token, filePayload) {
    const user = requireUser(token);
    const stu = DB.students.find((s) => s.regNumber === user.regNumber);
    if (!stu) throw new Error("Student profile not found.");
    stu.passportUrl = (filePayload && filePayload.dataUrl) || stu.passportUrl;
    stu.updatedAt = now();
    return { ok: true, url: stu.passportUrl };
  },
  api_getStudentDashboard(token) {
    const user = requireUser(token);
    const stu = DB.students.find((s) => s.regNumber === user.regNumber);
    if (!stu) throw new Error("Student profile not found.");
    const mainSup = stu.mainSupervisorId ? DB.staff.find((x) => x.id === stu.mainSupervisorId) : null;
    const coSup = stu.coSupervisorId ? DB.staff.find((x) => x.id === stu.coSupervisorId) : null;
    const subs = DB.submissions.filter((s) => s.regNumber === user.regNumber)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const anns = DB.announcements.filter((a) => a.active)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return {
      student: {
        regNumber: stu.regNumber, surname: stu.surname, firstName: stu.firstName, otherNames: stu.otherNames,
        gender: stu.gender, phoneNumber: stu.phoneNumber, email: stu.email,
        faculty: stu.faculty, department: stu.department, programme: stu.programme,
        specialisation: stu.specialisation, passportUrl: stu.passportUrl, passportFileId: stu.passportFileId,
        currentStage: stu.currentStage, yearOfAdmission: stu.yearOfAdmission,
        mainSupervisor: mainSup ? { id: mainSup.id, fullName: mainSup.fullName, email: mainSup.email, rank: mainSup.rank } : null,
        coSupervisor: coSup ? { id: coSup.id, fullName: coSup.fullName, email: coSup.email, rank: coSup.rank } : null,
      },
      submissions: subs,
      announcements: anns.slice(0, 10),
      templates: TEMPLATES,
      stages: STAGES,
    };
  },
  api_listSubmissions(token) {
    const user = requireUser(token);
    let list;
    if (user.role === "Student") list = DB.submissions.filter((s) => s.regNumber === user.regNumber);
    else if (user.role === "Staff") {
      const regs = DB.students.filter((s) => s.mainSupervisorId === user.id || s.coSupervisorId === user.id).map((s) => s.regNumber);
      list = DB.submissions.filter((s) => regs.indexOf(s.regNumber) !== -1);
    } else if (user.role === "Submission_Inspector") {
      list = DB.submissions.filter((s) => s.status === "Submitted" || s.status === "Changes Requested");
    } else list = DB.submissions.slice();
    return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((s) => {
      const stu = DB.students.find((x) => x.regNumber === s.regNumber);
      return Object.assign({}, s, { studentName: stu ? fullNameOf(stu) : "", programme: stu ? stu.programme : "" });
    });
  },
  api_createSubmission(token, payload) {
    const user = requireUser(token);
    assertRole(user, ["Student"]);
    if (!payload || !payload.type) throw new Error("Invalid submission type.");
    if (!payload.driveFileUrls) throw new Error("Drive file URL is required.");
    const nowStr = now();
    const row = { id: nextId("Sub"), regNumber: user.regNumber, type: payload.type, driveFileUrls: String(payload.driveFileUrls).trim(), status: "Submitted", inspectorComments: "", supervisorNotes: "", createdBy: user.id, createdAt: nowStr, updatedAt: nowStr };
    DB.submissions.push(row);
    return { id: row.id };
  },
  api_getCoordinatorDashboard(token) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator", "HoD"]);
    const pending = DB.users.filter((u) => u.status === "Pending").map((u) => {
      const stu = DB.students.find((s) => s.regNumber === u.regNumber) || {};
      return { regNumber: u.regNumber, fullName: u.fullName, email: u.email, programme: stu.programme || "", status: u.status };
    });
    const allStudents = DB.students.map((s) => {
      const main = s.mainSupervisorId ? DB.staff.find((x) => x.id === s.mainSupervisorId) : null;
      const co = s.coSupervisorId ? DB.staff.find((x) => x.id === s.coSupervisorId) : null;
      const u = DB.users.find((x) => x.regNumber === s.regNumber);
      return { regNumber: s.regNumber, fullName: fullNameOf(s), programme: s.programme, specialisation: s.specialisation, mainSupervisor: main ? main.fullName : "", coSupervisor: co ? co.fullName : "", currentStage: s.currentStage, status: u ? u.status : "" };
    });
    const staffList = DB.staff.filter((s) => s.active).map((s) => ({ id: s.id, fullName: s.fullName, rank: s.rank, specialisation: s.specialisation }));
    return { pending, students: allStudents, staff: staffList, stages: STAGES };
  },
  api_approveStudent(token, regNumber) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const u = DB.users.find((x) => x.regNumber === regNumber);
    if (!u) throw new Error("Student not found.");
    u.status = "Approved";
    return true;
  },
  api_rejectStudent(token, regNumber) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const u = DB.users.find((x) => x.regNumber === regNumber);
    if (!u) throw new Error("Student not found.");
    u.status = "Rejected";
    return true;
  },
  api_saveStaff(token, payload) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    if (!payload || !payload.fullName) throw new Error("Full name is required.");
    DB.staff.push({ id: nextId("Stf"), fullName: payload.fullName, email: payload.email || "", rank: payload.rank || "", specialisation: payload.specialisation || "", active: true, createdAt: now() });
    return { id: DB.staff[DB.staff.length - 1].id };
  },
  api_removeStaff(token, staffId) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const staff = DB.staff.find((s) => String(s.id) === String(staffId));
    if (!staff) throw new Error("Staff member not found.");
    if (String(staffId) === String(user.id)) throw new Error("You cannot remove your own staff record.");
    let unassigned = 0;
    DB.students.forEach((s) => {
      let hit = false;
      if (String(s.mainSupervisorId) === String(staffId)) { s.mainSupervisorId = ""; hit = true; }
      if (String(s.coSupervisorId) === String(staffId)) { s.coSupervisorId = ""; hit = true; }
      if (hit) { unassigned++; s.updatedAt = now(); }
    });
    staff.active = false;
    let deactivated = 0;
    const email = String(staff.email || "").toLowerCase();
    if (email) {
      DB.users.forEach((u) => {
        if (String(u.email || "").toLowerCase() === email && u.active && String(u.id) !== String(user.id) && u.role !== "PG_Coordinator" && u.role !== "HoD") { u.active = false; deactivated++; }
      });
    }
    return { ok: true, unassigned: unassigned, loginsDeactivated: deactivated };
  },
  api_addStudent(token, payload) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    if (!payload) throw new Error("Missing form data.");
    const reg = String(payload.regNumber || "").trim();
    if (!/^UA\/pg20\d{2}\/\d{6}$/.test(reg) && !/^\d{2}\/\d{3}[A-Z]{3,4}\/\d{3,4}$/.test(reg)) throw new Error("Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.");
    if (!payload.surname || String(payload.surname).trim().length < 2) throw new Error("Surname must be at least 2 letters.");
    if (!payload.firstName || String(payload.firstName).trim().length < 2) throw new Error("First name must be at least 2 letters.");
    if (DB.users.find((u) => String(u.regNumber) === reg)) throw new Error("Registration number already exists.");
    const nowStr = now();
    DB.students.push({
      id: nextId("Stu"), regNumber: reg,
      surname: payload.surname || "", firstName: payload.firstName || "", otherNames: payload.otherNames || "",
      gender: payload.gender || "", phoneNumber: payload.phoneNumber || "", email: payload.email || "",
      faculty: payload.faculty || "Faculty of Science", department: payload.department || "Physics",
      programme: payload.programme || "MSc", specialisation: payload.specialisation || "",
      passportFileId: "", passportUrl: "",
      mainSupervisorId: "", coSupervisorId: "", currentStage: "1 - Admission",
      yearOfAdmission: parseInt(payload.yearOfAdmission, 10) || new Date().getFullYear(), createdAt: nowStr, updatedAt: nowStr
    });
    DB.users.push({
      id: nextId("Usr"), regNumber: reg, email: payload.email || "", role: "Student",
      fullName: (payload.firstName || "") + " " + (payload.surname || ""), firstLogin: true, active: true, status: "Approved", createdAt: nowStr
    });
    return { ok: true, regNumber: reg, message: "Student added. Sign-in details sent to " + (payload.email || "") + "." };
  },
  api_removeStudent(token, regNumber) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const reg = String(regNumber || "").trim();
    if (String(reg) === String(user.regNumber)) throw new Error("You cannot remove your own record.");
    const student = DB.students.find((s) => String(s.regNumber) === reg);
    const account = DB.users.find((u) => String(u.regNumber) === reg);
    if (!student && !account) throw new Error("Student not found.");
    const before = DB.submissions.length;
    DB.submissions = DB.submissions.filter((r) => String(r.regNumber) !== reg);
    const removedSubs = before - DB.submissions.length;
    if (student) DB.students = DB.students.filter((s) => String(s.regNumber) !== reg);
    if (account) DB.users = DB.users.filter((u) => String(u.regNumber) !== reg);
    const name = student ? fullNameOf(student) : (account ? account.fullName : reg);
    return { ok: true, message: name + " removed." + (removedSubs ? " " + removedSubs + " submission(s) removed." : "") };
  },
  api_assignSupervisors(token, regNumber, mainId, coId) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const stu = DB.students.find((s) => s.regNumber === regNumber);
    if (!stu) throw new Error("Student not found.");
    stu.mainSupervisorId = mainId || "";
    stu.coSupervisorId = coId || "";
    if (!stu.mainSupervisorId && String(stu.currentStage).indexOf("1 -") === 0) stu.currentStage = "1 - Admission";
    else if (stu.mainSupervisorId && String(stu.currentStage).indexOf("2 -") === 0) stu.currentStage = "3 - Supervisor Allocation";
    stu.updatedAt = now();
    return true;
  },
  api_updateStudentStage(token, regNumber, stage) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const stu = DB.students.find((s) => s.regNumber === regNumber);
    if (!stu) throw new Error("Student not found.");
    if (STAGES.indexOf(stage) === -1) throw new Error("Invalid stage.");
    stu.currentStage = stage;
    stu.updatedAt = now();
    return true;
  },
  api_addAnnouncement(token, title, body) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    if (!title) throw new Error("Title is required.");
    DB.announcements.push({ id: nextId("Ann"), title: String(title), body: String(body || ""), active: true, createdBy: user.id, createdAt: now() });
    return { id: DB.announcements[DB.announcements.length - 1].id };
  },
  api_updateSubmissionStatus(token, submissionId, newStatus, comments) {
    const user = requireUser(token);
    assertRole(user, ["Submission_Inspector"]);
    const sub = DB.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new Error("Submission not found.");
    sub.status = newStatus;
    sub.inspectorComments = comments || sub.inspectorComments;
    sub.updatedAt = now();
    return true;
  },
  api_addSupervisoryNote(token, submissionId, note) {
    const user = requireUser(token);
    assertRole(user, ["Staff", "PG_Coordinator"]);
    const sub = DB.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new Error("Submission not found.");
    sub.supervisorNotes = (sub.supervisorNotes ? sub.supervisorNotes + " | " : "") + note;
    sub.updatedAt = now();
    return true;
  },
  api_getHoDStats(token) {
    const user = requireUser(token);
    assertRole(user, ["HoD", "PG_Coordinator"]);
    const byProgramme = {}, byStatus = {}, byUserStatus = {};
    DB.students.forEach((s) => { byProgramme[s.programme] = (byProgramme[s.programme] || 0) + 1; });
    DB.submissions.forEach((s) => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
    DB.users.forEach((u) => { byUserStatus[u.status] = (byUserStatus[u.status] || 0) + 1; });
    const subList = DB.submissions.map((s) => {
      const stu = DB.students.find((x) => x.regNumber === s.regNumber);
      return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, studentName: stu ? fullNameOf(stu) : "", createdAt: s.createdAt };
    });
    return { totalStudents: DB.students.length, byProgramme, bySubmissionStatus: byStatus, byUserStatus, submissions: subList };
  },
  api_getStaffDashboard(token) {
    const user = requireUser(token);
    assertRole(user, ["Staff"]);
    const mine = DB.students.filter((s) => s.mainSupervisorId === user.id || s.coSupervisorId === user.id);
    const regs = mine.map((s) => s.regNumber);
    return {
      students: mine.map((s) => ({ regNumber: s.regNumber, fullName: fullNameOf(s), programme: s.programme, specialisation: s.specialisation, currentStage: s.currentStage, passportUrl: s.passportUrl })),
      submissions: DB.submissions.filter((s) => regs.indexOf(s.regNumber) !== -1).map((s) => {
        const stu = DB.students.find((x) => x.regNumber === s.regNumber);
        return { id: s.id, regNumber: s.regNumber, studentName: stu ? fullNameOf(stu) : "", type: s.type, status: s.status, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt };
      }),
    };
  },
  api_exportData(token) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    let csv = "RegNumber,Surname,FirstName,OtherNames,Gender,Phone,Programme,Specialisation,MainSupervisor,CoSupervisor,Stage,Status\n";
    DB.students.forEach((s) => {
      const u = DB.users.find((x) => x.regNumber === s.regNumber) || {};
      const main = s.mainSupervisorId ? (DB.staff.find((x) => x.id === s.mainSupervisorId) || {}).fullName || "" : "";
      const co = s.coSupervisorId ? (DB.staff.find((x) => x.id === s.coSupervisorId) || {}).fullName || "" : "";
      csv += [s.regNumber, s.surname, s.firstName, s.otherNames, s.gender, s.phoneNumber, s.programme, s.specialisation, main, co, s.currentStage, u.status || ""].join(",") + "\n";
    });
    return csv;
  },
  api_updateProfile() { return true; },
  api_listStaff(token) {
    requireUser(token);
    return DB.staff.filter((s) => s.active);
  },
};

/* ---- google.script.run mock (browser-side, injected) ---- */
const MOCK_JS = `
<script>
(function () {
  var DB = ${JSON.stringify({ users: DB.users, students: DB.students, staff: DB.staff, submissions: DB.submissions, announcements: DB.announcements })};
  window.__PG_MOCK_DB__ = DB;
})();
window.google = { script: { run: (function () {
  var success = null, failure = null;
  var runner = {};
  var proxy = new Proxy(runner, {
    get: function (t, prop) {
      if (prop in t) return t[prop];
      return function () {
        var args = Array.prototype.slice.call(arguments);
        setTimeout(function () {
          try {
            var fn = window.__PG_MOCK_API__ && window.__PG_MOCK_API__[prop];
            if (!fn) throw new Error('Mock backend has no function: ' + prop);
            var r = fn.apply(null, args);
            if (success) success(r);
          } catch (e) {
            if (failure) failure(e); else console.error(e);
          }
        }, 150);
      };
    }
  });
  runner.withSuccessHandler = function (fn) { success = fn; return proxy; };
  runner.withFailureHandler = function (fn) { failure = fn; return proxy; };
  return proxy;
})() } };
</script>
`;

/* The heavy API functions run browser-side against the seeded object above.
   Keep them in one serialisable blob rather than re-implementing per request. */
const MOCK_API_JS = `
<script>
window.__PG_MOCK_API__ = (function () {
  var DB = window.__PG_MOCK_DB__;
  DB.sessions = {};
  var DEFAULT_PASSWORD = ${JSON.stringify(DEFAULT_PASSWORD)};
  var STAGES = ${JSON.stringify(STAGES)};
  var TEMPLATES = ${JSON.stringify(TEMPLATES)};
  function fullNameOf(s) { return [s.firstName, s.otherNames, s.surname].filter(Boolean).join(' '); }
  function publicUser(u) { return { id: u.id, regNumber: u.regNumber, role: u.role, fullName: u.fullName, email: u.email, status: u.status, firstLogin: !!u.firstLogin }; }
  function requireUser(token) {
    var id = DB.sessions[token];
    if (!id) throw new Error('Session expired. Please sign in again.');
    var u = null;
    for (var i = 0; i < DB.users.length; i++) if (DB.users[i].id === id) u = DB.users[i];
    if (!u || !u.active) throw new Error('Session expired. Please sign in again.');
    return u;
  }
  function assertRole(user, roles) { if (roles.indexOf(user.role) === -1) throw new Error('Access denied.'); }
  function nextId(prefix) { DB.seq = (DB.seq || 100) + 1; return prefix + DB.seq; }
  function now() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
  function find(arr, fn) { for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i]; return null; }
  function filter(arr, fn) { var out = []; for (var i = 0; i < arr.length; i++) if (fn(arr[i])) out.push(arr[i]); return out; }

  return {
    api_login: function (regNumber, password) {
      if (!regNumber || !password) throw new Error('Enter your registration number and password.');
      var key = String(regNumber).trim();
      var user = find(DB.users, function (u) { return u.regNumber === key; });
      if (!user || !user.active) throw new Error('Invalid registration number or password.');
      if (user.status === 'Pending') throw new Error('Awaiting PG Coordinator approval. You cannot log in yet.');
      if (user.status === 'Rejected') throw new Error('Your registration was rejected. Please contact the PG Coordinator.');
      if (String(password) !== DEFAULT_PASSWORD) throw new Error('Invalid registration number or password.');
      var token = 'demo-' + user.id + '-' + Date.now();
      DB.sessions[token] = user.id;
      return { token: token, user: publicUser(user) };
    },
    api_logout: function (token) { if (token) delete DB.sessions[token]; return true; },
    api_me: function (token) { return publicUser(requireUser(token)); },
    api_changePassword: function (token, oldPassword, newPassword) {
      var user = requireUser(token);
      if (String(oldPassword) !== DEFAULT_PASSWORD) throw new Error('Old password is incorrect.');
      var s = String(newPassword || '');
      if (s.length < 8 || s.length > 128) throw new Error('Password must be 8-128 characters.');
      if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) throw new Error('Password must contain at least one letter and one number.');
      var banned = ['password', 'qwerty', '12345678', 'abcd1234', 'demo@1234', 'physicspg2026!'];
      if (banned.indexOf(s.toLowerCase()) !== -1) throw new Error('That password is too common. Choose something unique.');
      user.firstLogin = false;
      return true;
    },
    api_register: function (payload) {
      if (!payload || !payload.regNumber) throw new Error('Missing form data.');
      var reg = String(payload.regNumber).trim();
      if (find(DB.users, function (u) { return u.regNumber === reg; })) throw new Error('Registration number already registered.');
      var nowStr = now();
      DB.students.push({
        id: nextId('Stu'), regNumber: reg,
        surname: payload.surname || '', firstName: payload.firstName || '', otherNames: payload.otherNames || '',
        gender: payload.gender || '', phoneNumber: payload.phoneNumber || '', email: payload.email || '',
        faculty: payload.faculty || 'Faculty of Science', department: payload.department || 'Physics',
        programme: payload.programme || 'MSc', specialisation: payload.specialisation || '',
        passportFileId: 'local', passportUrl: (payload.passportPhoto && payload.passportPhoto.dataUrl) || '',
        mainSupervisorId: '', coSupervisorId: '', currentStage: '1 - Admission',
        yearOfAdmission: new Date().getFullYear(), createdAt: nowStr, updatedAt: nowStr
      });
      DB.users.push({
        id: nextId('Usr'), regNumber: reg, email: payload.email || '', role: 'Student',
        fullName: (payload.firstName || '') + ' ' + (payload.surname || ''), firstLogin: true, active: true, status: 'Pending', createdAt: nowStr
      });
      return { ok: true, message: 'Registration submitted. Awaiting PG Coordinator approval.' };
    },
    api_updateProfilePhoto: function (token, filePayload) {
      var user = requireUser(token);
      var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      if (!stu) throw new Error('Student profile not found.');
      stu.passportUrl = (filePayload && filePayload.dataUrl) || stu.passportUrl;
      stu.updatedAt = now();
      return { ok: true, url: stu.passportUrl };
    },
    api_getStudentDashboard: function (token) {
      var user = requireUser(token);
      var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      if (!stu) throw new Error('Student profile not found.');
      var mainSup = stu.mainSupervisorId ? find(DB.staff, function (x) { return x.id === stu.mainSupervisorId; }) : null;
      var coSup = stu.coSupervisorId ? find(DB.staff, function (x) { return x.id === stu.coSupervisorId; }) : null;
      var subs = filter(DB.submissions, function (s) { return s.regNumber === user.regNumber; });
      subs.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      var anns = filter(DB.announcements, function (a) { return a.active; });
      anns.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return {
        student: {
          regNumber: stu.regNumber, surname: stu.surname, firstName: stu.firstName, otherNames: stu.otherNames,
          gender: stu.gender, phoneNumber: stu.phoneNumber, email: stu.email,
          faculty: stu.faculty, department: stu.department, programme: stu.programme,
          specialisation: stu.specialisation, passportUrl: stu.passportUrl, passportFileId: stu.passportFileId,
          currentStage: stu.currentStage, yearOfAdmission: stu.yearOfAdmission,
          mainSupervisor: mainSup ? { id: mainSup.id, fullName: mainSup.fullName, email: mainSup.email, rank: mainSup.rank } : null,
          coSupervisor: coSup ? { id: coSup.id, fullName: coSup.fullName, email: coSup.email, rank: coSup.rank } : null
        },
        submissions: subs,
        announcements: anns.slice(0, 10),
        templates: TEMPLATES,
        stages: STAGES
      };
    },
    api_listSubmissions: function (token) {
      var user = requireUser(token);
      var list;
      if (user.role === 'Student') list = filter(DB.submissions, function (s) { return s.regNumber === user.regNumber; });
      else if (user.role === 'Staff') {
        var regs = filter(DB.students, function (s) { return s.mainSupervisorId === user.id || s.coSupervisorId === user.id; }).map(function (s) { return s.regNumber; });
        list = filter(DB.submissions, function (s) { return regs.indexOf(s.regNumber) !== -1; });
      } else if (user.role === 'Submission_Inspector') {
        list = filter(DB.submissions, function (s) { return s.status === 'Submitted' || s.status === 'Changes Requested'; });
      } else list = DB.submissions.slice();
      return list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).map(function (s) {
        var stu = find(DB.students, function (x) { return x.regNumber === s.regNumber; });
        var copy = {}; for (var k in s) copy[k] = s[k];
        copy.studentName = stu ? fullNameOf(stu) : '';
        copy.programme = stu ? stu.programme : '';
        return copy;
      });
    },
    api_createSubmission: function (token, payload) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      if (!payload || !payload.type) throw new Error('Invalid submission type.');
      if (!payload.driveFileUrls) throw new Error('Drive file URL is required.');
      var nowStr = now();
      var row = { id: nextId('Sub'), regNumber: user.regNumber, type: payload.type, driveFileUrls: String(payload.driveFileUrls).trim(), status: 'Submitted', inspectorComments: '', supervisorNotes: '', createdBy: user.id, createdAt: nowStr, updatedAt: nowStr };
      DB.submissions.push(row);
      return { id: row.id };
    },
    api_getCoordinatorDashboard: function (token) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator', 'HoD']);
      var pending = filter(DB.users, function (u) { return u.status === 'Pending'; }).map(function (u) {
        var stu = find(DB.students, function (s) { return s.regNumber === u.regNumber; }) || {};
        return { regNumber: u.regNumber, fullName: u.fullName, email: u.email, programme: stu.programme || '', status: u.status };
      });
      var allStudents = DB.students.map(function (s) {
        var main = s.mainSupervisorId ? find(DB.staff, function (x) { return x.id === s.mainSupervisorId; }) : null;
        var co = s.coSupervisorId ? find(DB.staff, function (x) { return x.id === s.coSupervisorId; }) : null;
        var u = find(DB.users, function (x) { return x.regNumber === s.regNumber; });
        return { regNumber: s.regNumber, fullName: fullNameOf(s), programme: s.programme, specialisation: s.specialisation, mainSupervisor: main ? main.fullName : '', coSupervisor: co ? co.fullName : '', currentStage: s.currentStage, status: u ? u.status : '' };
      });
      var staffList = filter(DB.staff, function (s) { return s.active; }).map(function (s) { return { id: s.id, fullName: s.fullName, rank: s.rank, specialisation: s.specialisation }; });
      return { pending: pending, students: allStudents, staff: staffList, stages: STAGES };
    },
    api_approveStudent: function (token, regNumber) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var u = find(DB.users, function (x) { return x.regNumber === regNumber; });
      if (!u) throw new Error('Student not found.');
      u.status = 'Approved';
      return true;
    },
    api_rejectStudent: function (token, regNumber) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var u = find(DB.users, function (x) { return x.regNumber === regNumber; });
      if (!u) throw new Error('Student not found.');
      u.status = 'Rejected';
      return true;
    },
    api_saveStaff: function (token, payload) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      if (!payload || !payload.fullName) throw new Error('Full name is required.');
      var row = { id: nextId('Stf'), fullName: payload.fullName, email: payload.email || '', rank: payload.rank || '', specialisation: payload.specialisation || '', active: true, createdAt: now() };
      DB.staff.push(row);
      return { id: row.id };
    },
    api_removeStaff: function (token, staffId) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var staff = find(DB.staff, function (s) { return String(s.id) === String(staffId); });
      if (!staff) throw new Error('Staff member not found.');
      if (String(staffId) === String(user.id)) throw new Error('You cannot remove your own staff record.');
      var unassigned = 0;
      DB.students.forEach(function (s) {
        var hit = false;
        if (String(s.mainSupervisorId) === String(staffId)) { s.mainSupervisorId = ''; hit = true; }
        if (String(s.coSupervisorId) === String(staffId)) { s.coSupervisorId = ''; hit = true; }
        if (hit) { unassigned++; s.updatedAt = now(); }
      });
      staff.active = false;
      var deactivated = 0;
      var email = String(staff.email || '').toLowerCase();
      if (email) {
        DB.users.forEach(function (u) {
          if (String(u.email || '').toLowerCase() === email && u.active && String(u.id) !== String(user.id) && u.role !== 'PG_Coordinator' && u.role !== 'HoD') { u.active = false; deactivated++; }
        });
      }
      return { ok: true, unassigned: unassigned, loginsDeactivated: deactivated };
    },
    api_addStudent: function (token, payload) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      if (!payload) throw new Error('Missing form data.');
      var reg = String(payload.regNumber || '').trim();
      if (!/^UA\\/pg20\\d{2}\\/\\d{6}$/.test(reg) && !/^\\d{2}\\/\\d{3}[A-Z]{3,4}\\/\\d{3,4}$/.test(reg)) throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
      if (!payload.surname || String(payload.surname).trim().length < 2) throw new Error('Surname must be at least 2 letters.');
      if (!payload.firstName || String(payload.firstName).trim().length < 2) throw new Error('First name must be at least 2 letters.');
      if (find(DB.users, function (u) { return String(u.regNumber) === reg; })) throw new Error('Registration number already exists.');
      var nowStr = now();
      DB.students.push({
        id: nextId('Stu'), regNumber: reg,
        surname: payload.surname || '', firstName: payload.firstName || '', otherNames: payload.otherNames || '',
        gender: payload.gender || '', phoneNumber: payload.phoneNumber || '', email: payload.email || '',
        faculty: payload.faculty || 'Faculty of Science', department: payload.department || 'Physics',
        programme: payload.programme || 'MSc', specialisation: payload.specialisation || '',
        passportFileId: '', passportUrl: '',
        mainSupervisorId: '', coSupervisorId: '', currentStage: '1 - Admission',
        yearOfAdmission: parseInt(payload.yearOfAdmission, 10) || new Date().getFullYear(), createdAt: nowStr, updatedAt: nowStr
      });
      DB.users.push({
        id: nextId('Usr'), regNumber: reg, email: payload.email || '', role: 'Student',
        fullName: (payload.firstName || '') + ' ' + (payload.surname || ''), firstLogin: true, active: true, status: 'Approved', createdAt: nowStr
      });
      return { ok: true, regNumber: reg, message: 'Student added. Sign-in details sent to ' + (payload.email || '') + '.' };
    },
    api_removeStudent: function (token, regNumber) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var reg = String(regNumber || '').trim();
      if (String(reg) === String(user.regNumber)) throw new Error('You cannot remove your own record.');
      var student = find(DB.students, function (s) { return String(s.regNumber) === reg; });
      var account = find(DB.users, function (u) { return String(u.regNumber) === reg; });
      if (!student && !account) throw new Error('Student not found.');
      var before = DB.submissions.length;
      DB.submissions = DB.submissions.filter(function (r) { return String(r.regNumber) !== reg; });
      var removedSubs = before - DB.submissions.length;
      if (student) DB.students = DB.students.filter(function (s) { return String(s.regNumber) !== reg; });
      if (account) DB.users = DB.users.filter(function (u) { return String(u.regNumber) !== reg; });
      var name = student ? fullNameOf(student) : (account ? account.fullName : reg);
      return { ok: true, message: name + ' removed.' + (removedSubs ? ' ' + removedSubs + ' submission(s) removed.' : '') };
    },
    api_assignSupervisors: function (token, regNumber, mainId, coId) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var stu = find(DB.students, function (s) { return s.regNumber === regNumber; });
      if (!stu) throw new Error('Student not found.');
      stu.mainSupervisorId = mainId || '';
      stu.coSupervisorId = coId || '';
      if (stu.mainSupervisorId && String(stu.currentStage).indexOf('2 -') === 0) stu.currentStage = '3 - Supervisor Allocation';
      stu.updatedAt = now();
      return true;
    },
    api_updateStudentStage: function (token, regNumber, stage) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var stu = find(DB.students, function (s) { return s.regNumber === regNumber; });
      if (!stu) throw new Error('Student not found.');
      if (STAGES.indexOf(stage) === -1) throw new Error('Invalid stage.');
      stu.currentStage = stage;
      stu.updatedAt = now();
      return true;
    },
    api_addAnnouncement: function (token, title, body) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      if (!title) throw new Error('Title is required.');
      var row = { id: nextId('Ann'), title: String(title), body: String(body || ''), active: true, createdBy: user.id, createdAt: now() };
      DB.announcements.push(row);
      return { id: row.id };
    },
    api_updateSubmissionStatus: function (token, submissionId, newStatus, comments) {
      var user = requireUser(token);
      assertRole(user, ['Submission_Inspector']);
      var sub = find(DB.submissions, function (s) { return s.id === submissionId; });
      if (!sub) throw new Error('Submission not found.');
      sub.status = newStatus;
      if (comments) sub.inspectorComments = comments;
      sub.updatedAt = now();
      return true;
    },
    api_addSupervisoryNote: function (token, submissionId, note) {
      var user = requireUser(token);
      assertRole(user, ['Staff', 'PG_Coordinator']);
      var sub = find(DB.submissions, function (s) { return s.id === submissionId; });
      if (!sub) throw new Error('Submission not found.');
      sub.supervisorNotes = (sub.supervisorNotes ? sub.supervisorNotes + ' | ' : '') + String(note);
      sub.updatedAt = now();
      return true;
    },
    api_getHoDStats: function (token) {
      var user = requireUser(token);
      assertRole(user, ['HoD', 'PG_Coordinator']);
      var byProgramme = {}, byStatus = {}, byUserStatus = {};
      DB.students.forEach(function (s) { byProgramme[s.programme] = (byProgramme[s.programme] || 0) + 1; });
      DB.submissions.forEach(function (s) { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
      DB.users.forEach(function (u) { byUserStatus[u.status] = (byUserStatus[u.status] || 0) + 1; });
      var subList = DB.submissions.map(function (s) {
        var stu = find(DB.students, function (x) { return x.regNumber === s.regNumber; });
        return { id: s.id, regNumber: s.regNumber, type: s.type, status: s.status, studentName: stu ? fullNameOf(stu) : '', createdAt: s.createdAt };
      });
      return { totalStudents: DB.students.length, byProgramme: byProgramme, bySubmissionStatus: byStatus, byUserStatus: byUserStatus, submissions: subList };
    },
    api_getStaffDashboard: function (token) {
      var user = requireUser(token);
      assertRole(user, ['Staff']);
      var mine = filter(DB.students, function (s) { return s.mainSupervisorId === user.id || s.coSupervisorId === user.id; });
      var regs = mine.map(function (s) { return s.regNumber; });
      return {
        students: mine.map(function (s) { return { regNumber: s.regNumber, fullName: fullNameOf(s), programme: s.programme, specialisation: s.specialisation, currentStage: s.currentStage, passportUrl: s.passportUrl }; }),
        submissions: filter(DB.submissions, function (s) { return regs.indexOf(s.regNumber) !== -1; }).map(function (s) {
          var stu = find(DB.students, function (x) { return x.regNumber === s.regNumber; });
          return { id: s.id, regNumber: s.regNumber, studentName: stu ? fullNameOf(stu) : '', type: s.type, status: s.status, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt };
        })
      };
    },
    api_exportData: function (token) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      var csv = 'RegNumber,Surname,FirstName,OtherNames,Gender,Phone,Programme,Specialisation,MainSupervisor,CoSupervisor,Stage,Status\\n';
      DB.students.forEach(function (s) {
        var u = find(DB.users, function (x) { return x.regNumber === s.regNumber; }) || {};
        var main = s.mainSupervisorId ? ((find(DB.staff, function (x) { return x.id === s.mainSupervisorId; }) || {}).fullName || '') : '';
        var co = s.coSupervisorId ? ((find(DB.staff, function (x) { return x.id === s.coSupervisorId; }) || {}).fullName || '') : '';
        csv += [s.regNumber, s.surname, s.firstName, s.otherNames, s.gender, s.phoneNumber, s.programme, s.specialisation, main, co, s.currentStage, u.status || ''].join(',') + '\\n';
      });
      return csv;
    },
    api_updateProfile: function () { return true; },
    api_listStaff: function (token) { requireUser(token); return filter(DB.staff, function (s) { return s.active; }); },
    /* ---- public landing pages (no auth) ---- */
    api_publicAnnouncements: function () {
      var list = filter(DB.announcements, function (a) { return a.active && String(a.title || '').trim() !== ''; });
      list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return { items: list.slice(0, 12).map(function (a) {
        return { id: a.id, title: String(a.title || ''), body: String(a.body || ''), createdAt: String(a.createdAt || '') };
      }) };
    },
    api_checkRegistrationStatus: function (regNumber) {
      var reg = String(regNumber || '').trim();
      if (!/^UA\\/pg20\\d{2}\\/\\d{6}$/.test(reg) && !/^\\d{2}\\/\\d{3}[A-Z]{3,4}\\/\\d{3,4}$/.test(reg)) {
        throw new Error('Invalid registration number. Use UA/pg2026/003531 or 26/408PHYX/040.');
      }
      var user = find(DB.users, function (u) { return String(u.regNumber) === reg && u.role === 'Student'; });
      if (!user) return { status: 'Not Found', message: 'No registration found with that number. Please check and try again.' };
      var st = String(user.status || 'Pending');
      var msg = st === 'Approved' ? 'Your registration has been approved. You can now log in.'
        : st === 'Rejected' ? 'Your registration was rejected. Please contact the PG Coordinator.'
        : 'Your registration is awaiting PG Coordinator approval.';
      return { status: st, message: msg };
    },
    api_publicEnquiry: function (name, email, message) {
      var n = String(name || '').trim(), em = String(email || '').trim(), msg = String(message || '').trim();
      if (n.length < 2) throw new Error('Please enter your name (at least 2 letters).');
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)) throw new Error('Please enter a valid email address.');
      if (msg.length < 10 || msg.length > 2000) throw new Error('Message must be between 10 and 2000 characters.');
      DB.enquiries = DB.enquiries || [];
      DB.enquiries.push({ name: n, email: em, message: msg, at: now() });
      return { ok: true, message: 'Thank you. Your enquiry has been sent to the PG Coordinator.' };
    }
  };
})();
</script>
`;

/* ---- Server ---- */
const pageCache = new Map();

function readGas(name) {
  return fs.readFileSync(path.join(GAS_DIR, name + ".html"), "utf8");
}

function buildPage(pageName) {
  if (pageCache.has(pageName)) return pageCache.get(pageName);
  let html = renderTemplate(readGas("index"), {
    page: pageName,
    brandJson: JSON.stringify(BRAND),
    // mirrors doGet: the index view switcher must not point at the portal
    initialPageJson: JSON.stringify(pageName === "login" ? "home" : pageName),
    initialViewJson: JSON.stringify(""),
    embedJson: JSON.stringify(false),
  });
  if (html.match(/<\?/g)) console.warn("warning: unreplaced scriptlet(s) in index.html");
  // inject the mocks right after <body> so every page script can use them
  html = html.replace(/<body>/, function () { return "<body>\n" + MOCK_JS + "\n" + MOCK_API_JS; });
  pageCache.set(pageName, html);
  return html;
}

http
  .createServer((req, res) => {
    const raw = req.url || "/";
    const qIndex = raw.indexOf("?");
    const urlPath = decodeURIComponent(qIndex === -1 ? raw : raw.slice(0, qIndex));
    const query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));

    // static files (hero background photo, journey infographic, …)
    // served from images/ first, then the repo root
    if (urlPath.indexOf("/images/") === 0) {
      const fname = path.basename(urlPath);
      const root = path.resolve(__dirname, "..");
      const candidates = [path.join(IMG_DIR, fname), path.join(root, fname)];
      const fpath = candidates.find((p) => p.indexOf(root) === 0 && fs.existsSync(p));
      if (fpath) {
        const type = /\.(png)$/i.test(fname) ? "image/png" : /\.(jpe?g)$/i.test(fname) ? "image/jpeg" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "max-age=3600" });
        return res.end(fs.readFileSync(fpath));
      }
      res.writeHead(404);
      return res.end("Not found");
    }

    // page name from ?page= or path (/about, /register, /login, …)
    const seg = urlPath.replace(/^\/+|\/+$/g, "").replace(/\.html$/i, "");
    const key = String(query.get("page") || seg || "").toLowerCase();
    if (PAGES.indexOf(key) !== -1) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(buildPage(key || "home"));
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found. Pages: / (home), /?page=about|programmes|register|contact|login");
  })
  .listen(port, () => {
    console.log("Postgraduate Journey local preview running at http://localhost:" + port);
    console.log("Pages: / (home), /?page=about, /?page=programmes, /?page=register, /?page=contact, /?page=login");
    console.log("Demo logins (password PhysicsPG2026!):");
    console.log("  Student          UA/pg2026/000001");
    console.log("  Student (2nd pattern)  26/408PHYX/040");
    console.log("  PG Coordinator   UA/pg2026/000010");
    console.log("  HoD              UA/pg2026/000011");
    console.log("  Staff            UA/pg2026/000012");
    console.log("  Inspector        UA/pg2026/000013");
  });
