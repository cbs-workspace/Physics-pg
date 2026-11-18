/**
 * Local preview server for the Department of Physics Postgraduate Journey (GAS).
 *
 * The Apps Script project is TWO files in GAS_Files/:
 *   Code.gs        server (mocked below — the deployed sheet API is not used)
 *   index.html     one combined template: the public site
 *                  (?page=home|register|contact) AND the
 *                  portal SPA (?page=login), selected server-side by the
 *                  `page` scriptlet branch
 *
 * Serves any page with:
 *  - the template scriptlets rendered exactly like doGet (tools/pg-template.js)
 *  - a mocked google.script.run backed by in-memory demo data
 *    (the demo accounts below, password PhysicsPG2026!)
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
const PAGES = ["", "home", "register", "contact", "login"];

/** Retired page names still accepted for old links — they fall back to Home
 *  (the template's showView also coerces anything unknown to home). */
const LEGACY = { about: "home", programmes: "home" };

const BRAND = {
  schoolName: "Department of Physics Postgraduate Journey",
  subtitle: "University of Abuja",
  footerText: "© 2026 Capacity Building and Support. All rights reserved.",
  logoUrl: "https://drive.google.com/thumbnail?id=1LDjsF_70W2BpttMyLxfmltABCyUSPeHl",
  cbsLogoUrl: "https://drive.google.com/thumbnail?id=1rovoohmsc10VxMnig2NbrDv5_aaH9ukJ",
  heroBgUrl: "/images/Phy_Complex.png",
  journeyImgUrl: "/images/PG_Journey_Animated.svg",
};

const STAGES = [
  "1 - Admission", "2 - Lecture Attendance", "3 - Supervisor Allocation",
  "4 - Proposal Submission", "5 - Proposal Defence Form", "6 - Proposal Defence",
  "7 - Progression Clearance", "8 - Progress Report", "9 - Compliance Inspection",
  "10 - Plagiarism Check", "10b - Internal Examination II (PhD)", "11 - Final Examination Intent", "12 - External Examination",
  "13 - Final Compliance", "14 - Signed Copies", "15 - Completion",
];
/** PhD-only gate between the shared first internal examination and stage 11. */
const SECOND_INTERNAL_STAGE = "10b - Internal Examination II (PhD)";

/** Stage given to every newly registered / added student, matching Code.gs START_STAGE_. */
const START_STAGE = "3 - Supervisor Allocation";

/** Document rules mirrored from Code.gs so local preview rejects the same bad uploads as the portal. */
const SECOND_INTERNAL_TYPES = [
  "Progress Report (Second Internal)", "Progress Presentation (PPTX) (Second Internal)",
  "Internal Examiner and Other Observations (Second Internal)",
  "Comment-by-Comment Response (Internal Examiner) (Second Internal)",
  "Corrected Clean Copy (Internal Examiner) (Second Internal)",
];
const UPLOAD_EXTS_BY_TYPE = {
  "Research Proposal": ["doc", "docx"], "Progress Report": ["doc", "docx"],
  "Progress Report (Second Internal)": ["doc", "docx"], "Final Thesis/Dissertation": ["doc", "docx"],
  "Internal Examiner and Other Observations": ["doc", "docx"],
  "Internal Examiner and Other Observations (Second Internal)": ["doc", "docx"],
  "Comment-by-Comment Response (External Examiner)": ["doc", "docx"],
  "Comment-by-Comment Response (Internal Examiner)": ["doc", "docx"],
  "Comment-by-Comment Response (Internal Examiner) (Second Internal)": ["doc", "docx"],
  "Corrected Clean Copy (Internal Examiner)": ["doc", "docx"],
  "Corrected Clean Copy (Internal Examiner) (Second Internal)": ["doc", "docx"],
  "External Examiner Comments": ["doc", "docx"], "Final Correction": ["doc", "docx"],
  "Proposal Defence Presentation (PPTX)": ["pptx"], "Progress Presentation (PPTX)": ["pptx"],
  "Progress Presentation (PPTX) (Second Internal)": ["pptx"],
  "Receipt of Fees": ["pdf"], "Evidence of Payment for Examination": ["pdf"], "Plagiarism Certificate": ["pdf"],
};
const SUBMISSION_TYPES = [
  "Research Proposal", "Progress Report", "Final Thesis/Dissertation", "Final Correction",
  "Comment-by-Comment Response (External Examiner)", "Comment-by-Comment Response (Internal Examiner)",
  "Signed Proposal Defence Form", "Proposal Defence Presentation (PPTX)", "Progress Presentation (PPTX)",
  "Receipt of Fees", "Evidence of Payment for Examination", "Plagiarism Certificate",
  "Progress Report (Second Internal)", "Progress Presentation (PPTX) (Second Internal)",
  "Comment-by-Comment Response (Internal Examiner) (Second Internal)",
  "Corrected Clean Copy (Internal Examiner)", "Corrected Clean Copy (Internal Examiner) (Second Internal)",
];

const TEMPLATES = {
  "Research Plan Form": "18LZ-3c0rrMPrpuJbrGgngJp9ALzpPetS",
  "PG Journey Roadmap": "1ToBmrpIYu-5hvRHy3SVTxxgHSOnIMBp1",
  "Seminar Template": "1e1Ep8-LvFlxXP8VBLPiWnP-lVqCq_lFH",
  "Progress Presentation Template": "1e1Ep8-LvFlxXP8VBLPiWnP-lVqCq_lFH",
  "Proposal Defence Form": "1ProposalForm0000000000000000000000",
};

/** Mirrors Code.gs DOCUMENT_CONFIG. Stage labels use the mock's older STAGES list;
 *  availability is still computed server-side from these labels, so the client never guesses. */
const DOCUMENT_CONFIG = [
  { id: "passport", name: "Passport Photograph", section: "Registration and Admission", stage: "registration",
    description: "A recent passport photograph. JPG, JPEG or PNG; resized automatically if large.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Student account creation / admission registration", uploader: "Student", formats: ["jpg", "jpeg", "png"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD"], resubmit: true, type: "__passport__" },
  { id: "admission", name: "Admission Letter", section: "Registration and Admission", stage: "registration",
    description: "Your official admission letter, uploaded as a PDF.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Student account creation / admission registration", uploader: "Student", formats: ["pdf"],
    required: false, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD"], resubmit: true, type: "__admission__" },
  { id: "research-proposal", name: "Research Proposal", section: "Supervisor Allocation and Title Approval", stage: "4 - Proposal Submission",
    description: "The full research proposal, approved for submission by your supervisors. MS Word only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Supervisor allocation and title approval", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Research Proposal" },
  { id: "defence-form", name: "Signed Proposal Defence Form", section: "Supervisor Allocation and Title Approval", stage: "5 - Proposal Defence Form",
    description: "Route A: the proposal defence form signed by both supervisors, as a PDF.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Defence readiness", uploader: "Student", formats: ["pdf"],
    required: false, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Signed Proposal Defence Form" },
  { id: "defence-slides", name: "Proposal Defence Presentation", section: "Supervisor Allocation and Title Approval", stage: "4 - Proposal Submission",
    description: "Your proposal defence slides. PowerPoint (.pptx) only; use the official template from Downloads.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Defence readiness", uploader: "Student", formats: ["pptx"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Submission_Inspector"], resubmit: true, type: "Proposal Defence Presentation (PPTX)" },
  { id: "progress-report", name: "Progress Report", section: "Progress Report Intent", stage: "8 - Progress Report",
    description: "The first progress report. MS Word only. Your assigned Internal Examiner can open it before the Internal Defence.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Progress Report Intent approved", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Examiner"], resubmit: true, type: "Progress Report" },
  { id: "progress-slides", name: "Progress Report Presentation", section: "Progress Report Intent", stage: "10 - Plagiarism Check",
    description: "The first progress presentation slides. PowerPoint (.pptx) only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Internal Examiner assigned / stage 10", uploader: "Student", formats: ["pptx"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Submission_Inspector"], resubmit: true, type: "Progress Presentation (PPTX)" },
  { id: "internal-report", name: "Internal Examiner’s Report / Comments", section: "After first Progress Presentation", stage: "10 - Plagiarism Check",
    description: "The Internal Examiner may upload a Word report; entering comments in the assessment field is an alternative.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "First progress presentation completed", uploader: "Internal Examiner", formats: ["doc", "docx"],
    required: false, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Examiner"], resubmit: false, type: "__internal1__" },
  { id: "internal-response", name: "Response to Internal Examiner’s Comments", section: "After first Progress Presentation", stage: "10 - Plagiarism Check",
    description: "A point-by-point response to every Internal Examiner comment. MS Word only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Internal Examiner feedback received", unlock: "feedback", feedbackCycle: "internal", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Comment-by-Comment Response (Internal Examiner)" },
  { id: "internal-clean", name: "Corrected Clean Copy after Internal Comments", section: "After first Progress Presentation", stage: "10 - Plagiarism Check",
    description: "The clean corrected version following the Internal Examiner’s comments. MS Word only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Internal Examiner feedback received", unlock: "feedback", feedbackCycle: "internal", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Corrected Clean Copy (Internal Examiner)" },
  { id: "progress-report-2", name: "Second Progress Report", section: "Second Progress Presentation (PhD only)", stage: SECOND_INTERNAL_STAGE,
    description: "The second progress report for the PhD-only internal examination. MS Word only.", programmes: ["PhD"],
    trigger: "PhD student reaches stage 10b", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Examiner"], resubmit: true, type: "Progress Report (Second Internal)" },
  { id: "progress-slides-2", name: "Second Progress Report Presentation", section: "Second Progress Presentation (PhD only)", stage: SECOND_INTERNAL_STAGE,
    description: "The second progress presentation slides. PowerPoint (.pptx) only.", programmes: ["PhD"],
    trigger: "PhD student reaches stage 10b", uploader: "Student", formats: ["pptx"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Submission_Inspector"], resubmit: true, type: "Progress Presentation (PPTX) (Second Internal)" },
  { id: "internal-report-2", name: "Second Internal Examiner’s Report / Comments", section: "Second Progress Presentation (PhD only)", stage: SECOND_INTERNAL_STAGE,
    description: "The second-cycle Internal Examiner report (Word upload) or the comments entered in the second assessment.", programmes: ["PhD"],
    trigger: "Second internal examination", uploader: "Internal Examiner (Second)", formats: ["doc", "docx"],
    required: false, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Examiner"], resubmit: false, type: "__internal2__" },
  { id: "internal-response-2", name: "Second Response to Internal Examiner’s Comments", section: "Second Progress Presentation (PhD only)", stage: SECOND_INTERNAL_STAGE,
    description: "Point-by-point response to the second internal comments. MS Word only.", programmes: ["PhD"],
    trigger: "Second internal feedback received", unlock: "feedback", feedbackCycle: "internal2", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Comment-by-Comment Response (Internal Examiner) (Second Internal)" },
  { id: "internal-clean-2", name: "Second Corrected Clean Copy after Internal Comments", section: "Second Progress Presentation (PhD only)", stage: SECOND_INTERNAL_STAGE,
    description: "Clean corrected version following the second internal comments. MS Word only.", programmes: ["PhD"],
    trigger: "Second internal feedback received", unlock: "feedback", feedbackCycle: "internal2", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Corrected Clean Copy (Internal Examiner) (Second Internal)" },
  { id: "fee-receipt", name: "School Fees Payment Receipt", section: "Final Examination Intent", stage: "11 - Final Examination Intent",
    description: "Proof of school fees payment. PDF only; visible to authorised postgraduate administrators.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Final Examination Intent submitted", closesAt: "12 - External Examination", uploader: "Student", formats: ["pdf"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD"], resubmit: true, type: "Receipt of Fees" },
  { id: "exam-fee", name: "External Examination Fee Payment Receipt", section: "Final Examination Intent", stage: "11 - Final Examination Intent",
    description: "Proof of payment for the external examination. PDF only; authorised administrators only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Final Examination Intent submitted", closesAt: "12 - External Examination", uploader: "Student", formats: ["pdf"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD"], resubmit: true, type: "Evidence of Payment for Examination" },
  { id: "plagiarism", name: "Plagiarism Certificate / Report", section: "Final Examination Intent", stage: "11 - Final Examination Intent",
    description: "The similarity / plagiarism report. PDF only; visible to authorised postgraduate administrators.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Final Examination Intent submitted", closesAt: "12 - External Examination", uploader: "Student", formats: ["pdf"],
    required: true, requiresExaminer: false, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Submission_Inspector"], resubmit: true, type: "Plagiarism Certificate" },
  { id: "thesis", name: "Final Dissertation / Thesis", section: "Final Examination Intent", stage: "12 - External Examination",
    description: "The final dissertation/thesis. MS Word only. The assigned External Examiner can open it before the External Defence.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "Thesis Submission stage", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Submission_Inspector", "Examiner"], resubmit: true, type: "Final Thesis/Dissertation" },
  { id: "external-report", name: "External Examiner’s Report / Comments", section: "After External Defence", stage: "12 - External Examination",
    description: "The External Examiner may upload a Word report or enter comments directly in the assessment field.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "External examination completed", uploader: "External Examiner", formats: ["doc", "docx"],
    required: false, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff", "Examiner"], resubmit: false, type: "__external__" },
  { id: "external-response", name: "Response to External Examiner’s Comments", section: "After External Defence", stage: "12 - External Examination",
    description: "A point-by-point response to every External Examiner comment. MS Word only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "External Examiner feedback received", unlock: "feedback", feedbackCycle: "external", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Comment-by-Comment Response (External Examiner)" },
  { id: "external-clean", name: "Corrected Clean Copy after External Comments", section: "After External Defence", stage: "12 - External Examination",
    description: "The final corrected clean copy following the External Examiner’s comments. MS Word only.", programmes: ["MPhil", "MSc", "PhD"],
    trigger: "External Examiner feedback received", unlock: "feedback", feedbackCycle: "external", uploader: "Student", formats: ["doc", "docx"],
    required: true, requiresExaminer: true, viewers: ["Student", "PG_Coordinator", "HoD", "Staff"], resubmit: true, type: "Final Correction" }
];

const DOWNLOAD_CONFIG = [
  { id: "pg-presentation-template", name: "Postgraduate Presentation Template",
    description: "Official departmental PowerPoint template for proposal and progress presentations.",
    format: "PPTX", configKey: "TEMPLATE_PROGRESS_PPTX" },
  { id: "proposal-defence-form", name: "Proposal Defence Form",
    description: "Official form for Route A: signed by both supervisors and uploaded as a PDF.",
    format: "PDF", configKey: "TEMPLATE_PROPOSAL_DEFENCE_FORM" }
];

const DOCUMENT_STATUS_LABELS = {
  unavailable: "Not Yet Available", pending: "Pending Submission", submitted: "Submitted",
  review: "Under Review", correction: "Correction Required", approved: "Approved/Accepted",
  awaitingExaminer: "Awaiting examiner feedback", feedback: "Feedback received"
};

/** Mirror of the catalogue's inspector checklists, keyed by document id. */
const DOCUMENT_CHECKLISTS = {
  passport: ["Recent photograph", "Face and shoulders visible", "Plain background"],
  admission: ["Letter is legible", "Student name and registration number are shown", "Issued by the University of Abuja"],
  "research-proposal": ["Formatting meets the SFRRP template", "References complete and consistent (APA 6th)", "Similarity / plagiarism within allowed limit", "Supervisor endorsement attached"],
  "defence-form": ["Signed by the Main Supervisor", "Signed by the Co-Supervisor where applicable", "Registration number and title are shown"],
  "defence-slides": ["Official PowerPoint template used", "Problem, objectives, methodology and timeline are clear", "References and slide numbers are present"],
  "progress-report": ["Formatting meets the SFRRP template", "Progress against objectives is clear", "References complete and consistent (APA 6th)", "Supervisor endorsement attached"],
  "progress-slides": ["Official PowerPoint template used", "Progress and results to date are clear", "References and slide numbers are present"],
  "internal-report": ["Report is legible", "Findings and recommendation are stated", "Examiner and date are identified"],
  "internal-response": ["Every examiner comment has a response", "Each response states where the work was changed", "Supervisor endorsement attached"],
  "internal-clean": ["Formatting meets the SFRRP template", "Preliminary pages and abstract meet the template", "Every internal correction has been applied", "Supervisor endorsement attached"],
  "progress-report-2": ["Second-cycle report is complete and legible", "Progress since the first internal examination is clear", "References complete and consistent (APA 6th)", "Supervisor endorsement attached"],
  "progress-slides-2": ["Official PowerPoint template used", "Second-cycle progress and results are clear", "References and slide numbers are present"],
  "internal-report-2": ["Second-cycle report is legible", "Findings and recommendation are stated", "Examiner and date are identified"],
  "internal-response-2": ["Every second internal comment has a separate response", "Each response states where the work was changed", "Supervisor endorsement attached"],
  "internal-clean-2": ["Formatting meets the SFRRP template", "Every second internal correction has been applied", "Supervisor endorsement attached"],
  "fee-receipt": ["Receipt is complete and legible", "Student name / registration number and amount are shown"],
  "exam-fee": ["Receipt is complete and legible", "Student name / registration number and amount are shown"],
  plagiarism: ["Certificate is complete and legible", "Student name and similarity percentage are shown", "Similarity is within the allowed limit"],
  thesis: ["Formatting meets the SFRRP template", "Preliminary pages and abstract meet the template", "References complete and consistent (APA 6th)", "Similarity / plagiarism within allowed limit", "Supervisor endorsement attached"],
  "external-report": ["Report is legible", "Findings and recommendation are stated", "Examiner and date are identified"],
  "external-response": ["Every examiner comment has a response", "Each response states where the work was changed", "Supervisor endorsement attached"],
  "external-clean": ["Formatting meets the SFRRP template", "Preliminary pages and abstract meet the template", "References complete and consistent (APA 6th)", "Examiners’ corrections addressed", "Supervisor endorsement attached"]
};

function allowedUploadExts_(type) { return UPLOAD_EXTS_BY_TYPE[type] || ["pdf", "doc", "docx"]; }
function validateSubmissionStage_(stu, type) {
  const idx = STAGES.indexOf(String((stu && stu.currentStage) || ""));
  if (idx < 0) throw new Error("Your current journey stage is not set.");
  if (SECOND_INTERNAL_TYPES.indexOf(type) !== -1) {
    if (!/phd/i.test(String((stu && stu.programme) || ""))) throw new Error("“" + type + "” is required for PhD students only.");
    if (idx < STAGES.indexOf(SECOND_INTERNAL_STAGE)) throw new Error("“" + type + "” opens at stage “" + SECOND_INTERNAL_STAGE + "”.");
    return;
  }
  const min = {
    "Research Proposal": 4, "Signed Proposal Defence Form": 5, "Proposal Defence Presentation (PPTX)": 5, "Progress Report": 8,
    "Progress Presentation (PPTX)": 10, "Receipt of Fees": 11, "Evidence of Payment for Examination": 11,
    "Plagiarism Certificate": 11, "Comment-by-Comment Response (Internal Examiner)": 10,
    "Corrected Clean Copy (Internal Examiner)": 10, "Final Thesis/Dissertation": 12,
    "External Examiner Comments": 14, "Comment-by-Comment Response (External Examiner)": 14, "Final Correction": 14,
  }[type];
  if (min !== undefined && idx < min) throw new Error("“" + type + "” is not available at your current stage.");
}
function assertUploadLinkKind_(type, url) {
  const m = /\.([a-z0-9]+)(?:[?#/]|$)/i.exec(String(url || "").replace(/^https?:\/\/[^/]+/i, ""));
  if (m && allowedUploadExts_(type).indexOf(m[1].toLowerCase()) === -1) throw new Error("Wrong file format for " + type + ".");
}

function programmeDemoSessions() {
  const plan = [
    [1, "2026-11-12", "2026-11-26", false, "MS Word I: page setup, margins, fonts, spacing and section breaks", "Postgraduate orientation: PG regulations, supervision and milestones", ""],
    [2, "2026-12-10", "2026-12-17", false, "Academic searching: Google Scholar, databases, keywords and Boolean operators", "Developing a researchable topic: gaps, problem statement and objectives", ""],
    [3, "2027-01-14", "2027-01-28", true, "EndNote I: importing, organising and managing references and PDFs", "Critical literature review: synthesis, comparison and research gaps", "Understanding the publishing landscape"],
    [4, "2027-02-11", "2027-02-25", false, "MS Word II: styles, heading hierarchy, contents and cross-references", "Research proposal structure: background, problem, aim and methodology", ""],
    [5, "2027-03-11", "2027-03-25", true, "Research data workflows: file organisation, metadata and version control", "Research methodology and reproducibility in physics", "Indexing and journal rankings: Web of Science, Scopus and metrics"],
    [6, "2027-04-08", "2027-04-29", true, "EndNote II: citations, bibliographies and citation styles", "Academic integrity: plagiarism, responsible AI, ethics and authorship", "Spotting predatory and hijacked journals"],
    [7, "2027-05-13", "2027-05-27", false, "MS Word III: equations, numbering, symbols and cross-references", "Scientific writing and reporting results, figures, tables and units", ""],
    [8, "2027-06-10", "2027-06-24", true, "Scientific figures and tables: plotting, labels, scales and uncertainty", "Data interpretation and discussion: evidence, inference and conclusions", "Selecting the right journal: scope, guidelines and open access"],
    [9, "2027-07-08", "2027-07-29", true, "LaTeX/Overleaf: structure, equations, references and cross-referencing", "Dissertation and thesis preparation: coherence and requirements", "Preparing a manuscript for submission"],
    [10, "2027-08-12", "2027-08-26", true, "Similarity checking: interpreting reports and ethical paraphrasing", "Research publication: journal articles, peer review and predatory publishing", "Online submission systems: Editorial Manager hands-on"],
    [11, "2027-09-09", "2027-09-30", true, "Scientific presentation: slides, equations, plots and timing", "Proposal and thesis defence: presenting methods and answering questions", "Peer review and revision: responding to editors and reviewers"],
    [12, "2027-10-14", "2027-10-28", true, "Final document audit: formatting, citations, references and compliance", "Annual progress review: milestones, challenges and next-year plans", "Post-acceptance and visibility: proofs, licences and profiles"],
  ];
  const rows = [];
  plan.forEach((p) => {
    const [m, practical, seminar, workshop, pracTitle, semTitle, workTitle] = p;
    rows.push({ id: "PgsM" + m + "P", month: m, kind: "Practical Training", title: "Month " + m + ": " + pracTitle, date: practical, startTime: "10:00", endTime: "13:00", venue: "PG Class", notes: "Practical training session.", status: "Scheduled", createdBy: "system" });
    rows.push({ id: "PgsM" + m + "S", month: m, kind: "Programme Seminar", title: "Month " + m + ": " + semTitle, date: seminar, startTime: "10:00", endTime: "12:00", venue: "PG Class", notes: "Monthly programme seminar.", status: "Scheduled", createdBy: "system" });
    if (workshop) rows.push({ id: "PgsM" + m + "W", month: m, kind: "Publication Workshop", title: "Month " + m + ": " + workTitle, date: practical, startTime: "14:00", endTime: "17:00", venue: "PG Class", notes: "Publication skills workshop.", status: "Scheduled", createdBy: "system" });
    rows.push({ id: "PgsM" + m + "O", month: m, kind: "Output Due", title: "Month " + m + ": outputs due", date: seminar, startTime: "10:00", endTime: "12:00", venue: "PG Class", notes: "Submit the month's required output at the seminar.", status: "Scheduled", createdBy: "system" });
  });
  return rows;
}

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
    { id: "Usr08", regNumber: "UA/pg2026/000003", email: "demo.phd2@gmail.com", role: "Student", fullName: "Ngozi Obi", firstLogin: false, active: true, status: "Approved", createdAt: now },
  ];
  const students = [
    { id: "Stu01", regNumber: "UA/pg2026/000001", surname: "Okafor", firstName: "Chinedu", otherNames: "Emeka", gender: "Male", phoneNumber: "08012345678", email: "demo.student1@gmail.com", faculty: "Faculty of Physical Sciences", department: "Physics", programme: "MSc", specialisation: "Experimental Solid-State Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "Stf01", coSupervisorId: "Stf02", currentStage: "4 - Proposal Submission", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
    { id: "Stu02", regNumber: "UA/pg2026/000002", surname: "Adamu", firstName: "Fatima", otherNames: "Yusuf", gender: "Female", phoneNumber: "08098765432", email: "demo.student2@gmail.com", faculty: "Faculty of Physical Sciences", department: "Physics", programme: "PhD", specialisation: "Nuclear Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "", coSupervisorId: "", currentStage: "1 - Admission", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
    { id: "Stu03", regNumber: "26/408PHYX/040", surname: "Eze", firstName: "Blessing", otherNames: "Chidi", gender: "Female", phoneNumber: "08055556666", email: "demo.student4@gmail.com", faculty: "Faculty of Physical Sciences", department: "Physics", programme: "PhD", specialisation: "Solar Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "Stf01", coSupervisorId: "", currentStage: "8 - Progress Report", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
    { id: "Stu04", regNumber: "UA/pg2026/000003", surname: "Obi", firstName: "Ngozi", otherNames: "Nneka", gender: "Female", phoneNumber: "08011112222", email: "demo.phd2@gmail.com", faculty: "Faculty of Physical Sciences", department: "Physics", programme: "PhD", specialisation: "Nuclear Physics", passportFileId: "", passportUrl: "", mainSupervisorId: "Stf01", coSupervisorId: "", currentStage: "10b - Internal Examination II (PhD)", yearOfAdmission: 2026, createdAt: now, updatedAt: now },
  ];
  const staff = [
    { id: "Stf01", fullName: "Dr. Bala Ahmed", email: "bala.ahmed@uniabuja.edu.ng", rank: "Senior Lecturer", specialisation: "Solid-State Physics", active: true, createdAt: now },
    { id: "Stf02", fullName: "Dr. Grace Obi", email: "grace.obi@uniabuja.edu.ng", rank: "Lecturer I", specialisation: "Nuclear Physics", active: true, createdAt: now },
    { id: "Stf03", fullName: "Prof. Musa Aliyu", email: "musa.aliyu@uniabuja.edu.ng", rank: "Professor", specialisation: "Solar Physics", active: true, createdAt: now },
    { id: "Stf04", fullName: "Dr. Samuel Eze", email: "samuel.eze@uniabuja.edu.ng", rank: "Lecturer II", specialisation: "Applied Geophysics", active: true, createdAt: now },
  ];
  const examiners = [
    { id: "Exm01", regNumber: "UA/pg2026/000003", examinerName: "Dr. Helen Adebayo", type: "Internal", email: "helen.adebayo@example.edu", examLogin: "EXAM/0001", institution: "University of Abuja", department: "Chemistry", rank: "Senior Lecturer", status: "Assigned", createdAt: now, reportUrl: "", comments: "", recommendation: "", scores: "", submittedAt: "" },
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
  const programmeSessions = programmeDemoSessions();
  const deadlines = [
    { id: "Ddl01", title: "Research Plan Form", date: "2026-11-26", notes: "Submit via the portal." },
    { id: "Ddl02", title: "Progress Report", date: "2027-02-25", notes: "Signed by supervisor." },
    { id: "Ddl03", title: "Final Thesis/Dissertation", date: "2027-10-28", notes: "Four bound copies." },
  ];
  const seminars = [
    { id: "Sem01", title: "Solar Physics and Space Weather", date: "2026-11-26", venue: "Physics Seminar Room", presenters: "UA/pg2026/000001" },
    { id: "Sem02", title: "Nuclear Techniques in Materials Analysis", date: "2027-01-28", venue: "Physics Seminar Room", presenters: "26/408PHYX/040" },
  ];
  const meetings = [
    { id: "Mtg01", regNumber: "UA/pg2026/000001", date: "2026-11-05", time: "11:00", venue: "Supervisor's office", notes: "Progress discussion.", status: "Scheduled" },
    { id: "Mtg02", regNumber: "UA/pg2026/000001", date: "2026-12-03", time: "11:00", venue: "Supervisor's office", notes: "Draft proposal review.", status: "Scheduled" },
    { id: "Mtg03", regNumber: "26/408PHYX/040", date: "2026-11-10", time: "14:00", venue: "Physics Seminar Room", notes: "Chapter review.", status: "Scheduled" },
  ];
  const presentationIntents = [
    { id: "Pin01", regNumber: "UA/pg2026/000001", kind: "Proposal Presentation", preferredMonth: "2026-11", note: "Draft proposal is ready for departmental defence.", status: "Pending Supervisors",
      mainStatus: "Approved", mainBy: "Dr. Bala Ahmed", mainAt: "2026-10-22 10:00:00", mainNote: "",
      coStatus: "Pending", coBy: "", coAt: "", coNote: "",
      coordinatorStatus: "Pending", coordinatorBy: "", coordinatorAt: "", coordinatorNote: "", stageApplied: "",
      history: JSON.stringify([{ at: "2026-10-20 09:00:00", by: "Chinedu Emeka Okafor", role: "Student", action: "Submitted", note: "Proposal Presentation / 2026-11" }, { at: "2026-10-22 10:00:00", by: "Dr. Bala Ahmed", role: "Main Supervisor", action: "Approved", note: "" }]),
      createdAt: "2026-10-20 09:00:00", updatedAt: "2026-10-22 10:00:00" },
    { id: "Pin02", regNumber: "26/408PHYX/040", kind: "Progress Report Presentation", preferredMonth: "2026-12", note: "Annual progress report submitted for compliance review.", status: "Pending Coordinator",
      mainStatus: "Approved", mainBy: "Dr. Bala Ahmed", mainAt: "2026-10-23 12:00:00", mainNote: "",
      coStatus: "Not Required", coBy: "", coAt: "", coNote: "",
      coordinatorStatus: "Pending", coordinatorBy: "", coordinatorAt: "", coordinatorNote: "", stageApplied: "",
      history: JSON.stringify([{ at: "2026-10-21 08:30:00", by: "Blessing Chidi Eze", role: "Student", action: "Submitted", note: "Progress Report Presentation / 2026-12" }, { at: "2026-10-23 12:00:00", by: "Dr. Bala Ahmed", role: "Main Supervisor", action: "Approved", note: "" }]),
      createdAt: "2026-10-21 08:30:00", updatedAt: "2026-10-23 12:00:00" },
  ];
  return { users, students, staff, examiners, submissions, announcements, programmeSessions, deadlines, seminars, meetings, presentationIntents, sessions: {}, seq: 100 };
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

/* Local mirror of Code.gs changeRegNumber(). Injected into the browser-side mock below with toString() so the
 * regular expressions keep their backslashes (a literal template string would eat them). */
function changeRegNumberMock(oldReg, newReg) {
  function norm(v) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, '').toUpperCase(); }
  function valid(reg) {
    return /^UA\/pg20\d{2}\/\d{6}$/.test(reg) || /^\d{2}\/\d{3}[A-Z]{3,4}\/\d{3,4}$/.test(reg) ||
      /^(PHD|MSC|MPHIL)\/[A-Z]{2,6}\/\d{5,10}$/i.test(reg) || /^\d{9,10}$/.test(reg);
  }
  var oldIn = String(oldReg || '').trim(), nw = String(newReg || '').trim();
  var acct = find(DB.users, function (u) { return norm(u.regNumber) === norm(oldIn); });
  var stu = find(DB.students, function (s) { return norm(s.regNumber) === norm(oldIn); });
  if (!acct || !stu) throw new Error('No registered student with number "' + oldIn + '".');
  if (acct.role !== 'Student') throw new Error(oldIn + ' is not a student login. Only student numbers can be changed here.');
  if (!valid(nw)) throw new Error('"' + nw + '" is not a valid registration number format.');
  if (norm(nw) === norm(oldIn) && nw === String(acct.regNumber).trim()) throw new Error('The new number is the same as the old one.');
  var clash = find(DB.users, function (u) { return norm(u.regNumber) === norm(nw); }) ||
    find(DB.students, function (s) { return norm(s.regNumber) === norm(nw); });
  if (clash && norm(nw) !== norm(oldIn)) throw new Error('"' + nw + '" is already registered to another account. Nothing was changed.');
  var from = String(acct.regNumber).trim(), key = norm(oldIn), total = 0, cells = {};
  var listCols = { seenBy: 1, readBy: 1, presenters: 1, attendees: 1 };
  var tabs = { users: DB.users, students: DB.students, submissions: DB.submissions, meetings: DB.meetings, presentationIntents: DB.presentationIntents, seminars: DB.seminars };
  Object.keys(tabs).forEach(function (name) {
    var hits = 0;
    tabs[name].forEach(function (row) {
      Object.keys(row).forEach(function (k) {
        var v = row[k];
        if (v === '' || v === null || v === undefined) return;
        if (listCols[k]) {
          var out = String(v).split(/([,|]\s*)/).map(function (t) { return norm(t) === key ? nw : t; }).join('');
          if (out !== String(v)) { row[k] = out; hits++; }
        } else if (k === 'regNumber' && norm(v) === key) { row[k] = nw; hits++; }
      });
    });
    if (hits) { cells[name] = hits; total += hits; }
  });
  var m = nw.match(/^UA\/pg(\d{4})\//i) || nw.match(/^(\d{2})\/\d{3}[A-Z]{3,4}\/\d{3,4}$/i);
  if (m) stu.yearOfAdmission = m[1].length === 4 ? parseInt(m[1], 10) : 2000 + parseInt(m[1], 10);
  Object.keys(DB.sessions).forEach(function (t) { if (DB.sessions[t] === acct.id) delete DB.sessions[t]; });
  return { ok: true, from: from, to: nw, total: total, cells: cells };
}

function publicFeedItems() {
  const today = new Date().toISOString().slice(0, 10);
  const events = DB.programmeSessions.filter((s) => s.date >= today && s.status !== "Cancelled")
    .sort((a, b) => String(a.date + " " + a.startTime).localeCompare(String(b.date + " " + b.startTime)))
    .slice(0, 8)
    .map((s) => ({ id: s.id, type: "programme", title: s.title, body: "", createdAt: "", date: s.date, startTime: s.startTime, endTime: s.endTime, kind: s.kind, venue: s.venue }));
  const announcements = DB.announcements.filter((a) => a.active).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, events.length ? 8 : 12)
    .map((a) => ({ id: a.id, type: "announcement", title: a.title, body: a.body, createdAt: a.createdAt }));
  return events.concat(announcements);
}

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
      faculty: payload.faculty || "Faculty of Physical Sciences", department: payload.department || "Physics",
      programme: payload.programme || "MSc", specialisation: payload.specialisation || "",
      passportFileId: "local", passportUrl: (payload.passportPhoto && payload.passportPhoto.dataUrl) || "",
      mainSupervisorId: "", coSupervisorId: "", currentStage: START_STAGE,
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
  api_getProgrammeCalendar(token) {
    const user = requireUser(token);
    let meetings = [];
    if (user.role === "Student") {
      meetings = DB.meetings.filter((m) => m.regNumber === user.regNumber);
    } else if (user.role === "Staff") {
      const regs = DB.students.filter((s) => s.mainSupervisorId === user.id || s.coSupervisorId === user.id).map((s) => s.regNumber);
      meetings = DB.meetings.filter((m) => regs.indexOf(m.regNumber) !== -1);
    }
    return {
      timezone: "Africa/Lagos",
      startMonth: "2026-11",
      sessions: DB.programmeSessions.slice().sort((a, b) => String(a.date + " " + a.startTime).localeCompare(String(b.date + " " + b.startTime))),
      deadlines: DB.deadlines.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))),
      seminars: DB.seminars.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))),
      meetings: meetings.slice().sort((a, b) => String(a.date + " " + a.time).localeCompare(String(b.date + " " + b.time))),
      canEdit: user.role === "PG_Coordinator",
    };
  },
  api_saveProgrammeSession(token, payload) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    payload = payload || {};
    const title = String(payload.title || "").trim();
    const date = String(payload.date || "").trim();
    const kind = String(payload.kind || "").trim();
    const status = String(payload.status || "Scheduled").trim();
    let month = String(payload.month || "").trim();
    const monthNum = parseInt(month, 10);
    if (/^\d{1,2}$/.test(month)) {
      if (!(monthNum >= 1 && monthNum <= 12)) throw new Error("A valid month is required.");
      month = monthNum;
    } else if (!/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(month)) {
      throw new Error("A valid month is required.");
    }
    if (!title) throw new Error("Title is required.");
    if (title.length > 200) throw new Error("Title must be 200 characters or fewer.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("A valid date is required.");
    if (["Practical Training", "Programme Seminar", "Publication Workshop", "Output Due"].indexOf(kind) === -1) throw new Error("Invalid session type.");
    if (["Scheduled", "Cancelled"].indexOf(status) === -1) throw new Error("Invalid status.");
    const startTime = String(payload.startTime || "").trim();
    const endTime = String(payload.endTime || "").trim();
    if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error("Start time must be HH:mm.");
    if (endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) throw new Error("End time must be HH:mm.");
    if (startTime && endTime && endTime < startTime) throw new Error("End time must be after the start time.");
    const row = { month, kind, title, date, startTime, endTime, venue: String(payload.venue || "").trim(), notes: String(payload.notes || ""), status, updatedAt: now() };
    if (payload.id) {
      const existing = DB.programmeSessions.find((x) => x.id === payload.id);
      if (!existing) throw new Error("Programme session not found.");
      Object.assign(existing, row);
      return { ok: true, id: existing.id };
    }
    row.id = nextId("Pgs");
    row.createdBy = user.id;
    row.createdAt = now();
    DB.programmeSessions.push(row);
    return { ok: true, id: row.id };
  },
  api_deleteProgrammeSession(token, id) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"]);
    const idx = DB.programmeSessions.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error("Programme session not found.");
    DB.programmeSessions.splice(idx, 1);
    return { ok: true };
  },
  api_listSubmissions(token) {    const user = requireUser(token);
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
    if (!payload || SUBMISSION_TYPES.indexOf(payload.type) === -1) throw new Error("Invalid submission type.");
    if (!payload.driveFileUrls) throw new Error("Drive file URL is required.");
    if (!payload.asDraft) {
      validateSubmissionStage(DB.students.find((s) => s.regNumber === user.regNumber), payload.type);
      assertUploadLinkKind_(payload.type, payload.driveFileUrls);
    }
    const nowStr = now();
    const row = { id: nextId("Sub"), regNumber: user.regNumber, type: payload.type, driveFileUrls: String(payload.driveFileUrls).trim(), status: payload.asDraft ? "Draft" : "Submitted", inspectorComments: "", supervisorNotes: "", createdBy: user.id, createdAt: nowStr, updatedAt: nowStr };
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
      faculty: payload.faculty || "Faculty of Physical Sciences", department: payload.department || "Physics",
      programme: payload.programme || "MSc", specialisation: payload.specialisation || "",
      passportFileId: "", passportUrl: "",
      mainSupervisorId: "", coSupervisorId: "", currentStage: START_STAGE,
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
    if (stage === SECOND_INTERNAL_STAGE && !/phd/i.test(stu.programme || ""))
      throw new Error("Internal Examination II is a PhD-only stage.");
    stu.currentStage = stage;
    stu.updatedAt = now();
    return true;
  },
  api_recordSecondInternal(token, reg, outcome, note) {
    const user = requireUser(token);
    assertRole(user, ["PG_Coordinator"], "Access denied.");
    if (["Passed", "Passed with corrections", "Not passed"].indexOf(outcome) === -1) throw new Error("Choose an outcome.");
    const stu = DB.students.find((s) => s.regNumber === reg);
    if (!stu) throw new Error("Student not found.");
    if (!/phd/i.test(stu.programme || "")) throw new Error("Internal Examination II is a PhD-only stage.");
    if (stu.currentStage !== SECOND_INTERNAL_STAGE) throw new Error("This student is not at Internal Examination II.");
    note = String(note || "").trim().slice(0, 800);
    if (outcome !== "Passed" && !note) throw new Error("Add a note (corrections required, or reason).");
    const moved = outcome === "Not passed" ? "" : "11 - Final Examination Intent";
    if (moved) stu.currentStage = moved;
    stu.updatedAt = now();
    return { ok: true, stage: moved || stu.currentStage };
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
  var DB = ${JSON.stringify({ users: DB.users, students: DB.students, staff: DB.staff, examiners: DB.examiners, submissions: DB.submissions, announcements: DB.announcements, programmeSessions: DB.programmeSessions, deadlines: DB.deadlines, seminars: DB.seminars, meetings: DB.meetings, presentationIntents: DB.presentationIntents })};
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
  var SECOND_INTERNAL_STAGE = ${JSON.stringify(SECOND_INTERNAL_STAGE)};
  var TEMPLATES = ${JSON.stringify(TEMPLATES)};
  var SUBMISSION_TYPES = ${JSON.stringify(SUBMISSION_TYPES)};
  var SECOND_INTERNAL_TYPES = ${JSON.stringify(SECOND_INTERNAL_TYPES)};
  var UPLOAD_EXTS_BY_TYPE = ${JSON.stringify(UPLOAD_EXTS_BY_TYPE)};
  var DOCUMENT_CONFIG = ${JSON.stringify(DOCUMENT_CONFIG)};
  var DOWNLOAD_CONFIG = ${JSON.stringify(DOWNLOAD_CONFIG)};
  var DOCUMENT_STATUS_LABELS = ${JSON.stringify(DOCUMENT_STATUS_LABELS)};
  var DOCUMENT_CHECKLISTS = ${JSON.stringify(DOCUMENT_CHECKLISTS)};
  var ASSESSMENT_CRITERIA = {
    Internal: ['Clarity of research problem and objectives', 'Progress and results to date', 'Methodology and analysis', 'Quality of the presentation', 'Response to questions'],
    'Internal (Second)': ['Clarity of research problem and objectives', 'Progress and results to date', 'Methodology and analysis', 'Quality of the presentation', 'Response to questions'],
    External: ['Originality and contribution to knowledge', 'Literature review', 'Methodology and rigour', 'Results, analysis and conclusions', 'Presentation and referencing']
  };
  var RECOMMENDATIONS = ['Accept as submitted', 'Accept with minor corrections', 'Major corrections required', 'Re-examination required', 'Reject'];
  var INTERNAL_RECS = ['Satisfactory', 'Satisfactory with recommendations', 'Needs improvement before proceeding', 'Unsatisfactory'];
  function allowedUploadExts_ (type) { return UPLOAD_EXTS_BY_TYPE[type] || ['pdf', 'doc', 'docx']; }
  function validateSubmissionStage_ (stu, type) {
    var idx = STAGES.indexOf(String((stu && stu.currentStage) || ''));
    if (idx < 0) throw new Error('Your current journey stage is not set.');
    if (SECOND_INTERNAL_TYPES.indexOf(type) !== -1) {
      if (!/phd/i.test(String((stu && stu.programme) || ''))) throw new Error('“' + type + '” is required for PhD students only.');
      if (idx < STAGES.indexOf(SECOND_INTERNAL_STAGE)) throw new Error('“' + type + '” opens at stage “' + SECOND_INTERNAL_STAGE + '”.');
      return;
    }
    var min = {
      'Research Proposal': 4, 'Signed Proposal Defence Form': 5, 'Proposal Defence Presentation (PPTX)': 5, 'Progress Report': 8,
      'Progress Presentation (PPTX)': 10, 'Receipt of Fees': 11, 'Evidence of Payment for Examination': 11,
      'Plagiarism Certificate': 11, 'Comment-by-Comment Response (Internal Examiner)': 10,
      'Corrected Clean Copy (Internal Examiner)': 10, 'Final Thesis/Dissertation': 12,
      'External Examiner Comments': 14, 'Comment-by-Comment Response (External Examiner)': 14, 'Final Correction': 14
    }[type];
    if (min !== undefined && idx < min) throw new Error('“' + type + '” is not available at your current stage.');
  }
  function assertUploadLinkKind_ (type, url) {
    var m = /\\.([a-z0-9]+)(?:[?#/]|$)/i.exec(String(url || '').replace(/^https?:\\/\\/[^/]+/i, ''));
    if (m && allowedUploadExts_(type).indexOf(m[1].toLowerCase()) === -1) throw new Error('Wrong file format for ' + type + '.');
  }
  function fileIdsFromUrls_ (urls) {
    var out = [], seen = {};
    String(urls || '').split(/[\\s,]+/).forEach(function (u) {
      if (!/^https?:\\/\\//i.test(u)) return;
      var m = /\\/d\\/([\\w-]{15,})|[?&]id=([\\w-]{15,})/.exec(u), id = m && (m[1] || m[2]);
      if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }
  /* Catalogue-driven helpers. These declarations follow the older mock helpers on purpose: they are the
     local mirror of Code.gs and win over the legacy hard-coded versions above. */
  var DOCUMENT_BY_TYPE_ = (function () { var m = {}; DOCUMENT_CONFIG.forEach(function (d) { if (d.type && String(d.type).charAt(0) !== '_') m[d.type] = d; }); return m; })();
  function documentByType_ (type) { return DOCUMENT_BY_TYPE_[String(type || '')] || null; }
  function allowedUploadExts_ (type) {
    var doc = documentByType_(type);
    return doc && doc.formats && doc.formats.length ? doc.formats.slice() : ['pdf', 'doc', 'docx'];
  }
  function checklistFor_ (type) {
    var doc = documentByType_(type);
    return doc && DOCUMENT_CHECKLISTS[doc.id] ? DOCUMENT_CHECKLISTS[doc.id].slice() : ['Document is complete and legible'];
  }
  function documentFeedbackKey_ (doc) { return doc && doc.unlock === 'feedback' ? String(doc.feedbackCycle || '') : ''; }
  function feedbackReceived_ (fb, key) {
    if (!key || !fb || !fb[key]) return false;
    return !!(fb[key].submittedAt || fb[key].status === 'Feedback received');
  }
  function docAvailableForStudent_ (doc, stu, fb) {
    if (!doc) return true;
    if (!docAppliesTo_(doc, stu)) return false;
    if (doc.stage === 'registration') return true;
    var idx = STAGES.indexOf(String((stu && stu.currentStage) || '')), need = STAGES.indexOf(String(doc.stage || ''));
    if (idx < 0 || need < 0 || idx < need) return false;
    var key = documentFeedbackKey_(doc);
    if (key && !feedbackReceived_(fb, key)) return false;
    if (doc.closesAt) { var end = STAGES.indexOf(String(doc.closesAt)); if (end >= 0 && idx >= end) return false; }
    return true;
  }
  function validateSubmissionStage_ (stu, type) {
    var doc = documentByType_(type);
    if (!doc || doc.uploader !== 'Student' || SUBMISSION_TYPES.indexOf(type) === -1) throw new Error('Invalid submission type.');
    if (STAGES.indexOf(String((stu && stu.currentStage) || '')) < 0) throw new Error('Your current journey stage is not set.');
    if (!docAppliesTo_(doc, stu)) throw new Error('“' + doc.name + '” is required for PhD students only.');
    var fb = examinerFeedbackForStudent_(stu && stu.regNumber);
    if (docAvailableForStudent_(doc, stu, fb)) return;
    var key = documentFeedbackKey_(doc);
    if (key && !feedbackReceived_(fb, key)) throw new Error('“' + doc.name + '” opens when examiner feedback has been received.');
    if (doc.closesAt) throw new Error('“' + doc.name + '” must be uploaded before stage “' + doc.closesAt + '”.');
    throw new Error('“' + doc.name + '” opens at stage “' + doc.stage + '”.');
  }
  function parseDriveFileId_ (url) {
    var u = String(url || '').trim();
    if (u.indexOf('https://drive.google.com/') !== 0 && u.indexOf('https://docs.google.com/') !== 0) return '';
    var i = u.indexOf('/d/'), raw = i > -1 ? u.slice(i + 3) : '';
    if (!raw) { i = u.indexOf('?id='); raw = i > -1 ? u.slice(i + 4) : ''; }
    if (!raw) { i = u.indexOf('&id='); raw = i > -1 ? u.slice(i + 4) : ''; }
    raw = raw.split(/[\\s,?#&/.]/)[0];
    return /^[\\w-]{15,}$/.test(raw) ? raw : '';
  }
  function assertUploadLinkKind_ (type, url) {
    if (!parseDriveFileId_(url)) throw new Error('Paste a Google Drive file link (drive.google.com or docs.google.com).');
    var u = String(url || ''), hostEnd = u.indexOf('//') + 2, path = u.indexOf('/', hostEnd), dot = u.lastIndexOf('.');
    if (dot > path) {
      var ext = u.slice(dot + 1).split(/[\\s,?#/]/)[0].toLowerCase();
      if (ext && allowedUploadExts_(type).indexOf(ext) === -1) throw new Error('Wrong file format for ' + type + '.');
    }
  }
  function fileIdsFromUrls_ (urls) {
    var out = [], seen = {};
    String(urls || '').split(/[\\s,]+/).forEach(function (u) {
      var id = parseDriveFileId_(u);
      if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }
  /** The browser mock has no file bytes, so it checks the base64 prefix instead of decoding the upload. */
  function assertMagicBytes_ (ext, dataUrl) {
    var heads = { pdf: 'JVBER', doc: '0OMR4AE', docx: 'UEsDBA', pptx: 'UEsDBA', jpg: '/9j/', jpeg: '/9j/', png: 'iVBOR' };
    var b64 = String(dataUrl || '').split(',').pop() || '', head = heads[String(ext || '').toLowerCase()];
    if (head && b64.indexOf(head) !== 0) throw new Error('That file does not match its extension. Upload a genuine ' + ext.toUpperCase() + ' file.');
  }
  function parseHist_ (v) { try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function pushFileHistory_ (sub, status, url, fileName, comments, by) {
    var e = { at: now(), by: by || '', status: status, comments: comments || '',
      previousUrl: String((sub && sub.driveFileUrls) || ''), fileUrl: String(url || '').trim() };
    if (fileName) e.fileName = fileName;
    var a = parseHist_(sub && sub.history); a.push(e);
    return JSON.stringify(a.slice(-20));
  }
  function submissionFileName_ (sub) {
    var a = parseHist_(sub && sub.history);
    for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].fileName) return String(a[i].fileName);
    return '';
  }
  function urlFileName_ (url) {
    var raw = String(url || ''), m = /\\/d\\/([^/?#]+)/.exec(raw);
    if (m) return m[1].split('/')[0].replace(/[^A-Za-z0-9._-]/g, '_');
    var s = raw.split('?')[0].split('#')[0].split('/').pop();
    return s ? s.replace(/[^A-Za-z0-9._-]/g, '_') : 'Uploaded file';
  }
  function mockFileUrl_ (label) {
    DB.seq = (DB.seq || 100) + 1;
    return 'https://drive.google.com/file/d/MOCK' + String(label || 'FILE').replace(/[^A-Z0-9]/gi, '').slice(0, 10) + DB.seq + '0000000000/view';
  }
  function documentCatalogPayload_ () { return { documents: DOCUMENT_CONFIG, downloads: DOWNLOAD_CONFIG, statuses: DOCUMENT_STATUS_LABELS }; }
  function docProgrammeOf_ (programme) {
    var p = String(programme || '');
    return /phd/i.test(p) ? 'PhD' : /mphil/i.test(p) ? 'MPhil' : 'MSc';
  }
  function docAppliesTo_ (doc, stu) { return (doc.programmes || []).indexOf(docProgrammeOf_(stu && stu.programme)) !== -1; }
  function docStatusKey_ (sub) {
    if (!sub) return 'pending';
    var s = String(sub.status || '');
    if (s === 'Draft') return 'pending';
    if (s === 'Under Review') return 'review';
    if (s === 'Changes Requested' || s === 'Rejected') return 'correction';
    if (s === 'Approved') return 'approved';
    return 'submitted';
  }
  function examinerFeedbackForStudent_ (reg) {
    DB.examiners = DB.examiners || [];
    var rows = filter(DB.examiners, function (x) { return String(x.regNumber) === String(reg) && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1; });
    function pick (type) {
      return rows.filter(function (x) { return String(x.type) === type; })
        .sort(function (a, b) { return String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)); })[0] || null;
    }
    function view (x) {
      return x ? { comments: x.comments || '', reportUrl: x.reportUrl || '', submittedAt: x.submittedAt || '',
        recommendation: x.recommendation || '', status: String(x.status || '') === 'Scored' ? 'Feedback received' : 'Assigned' } : null;
    }
    return { internal: view(pick('Internal')), internal2: view(pick('Internal (Second)')), external: view(pick('External')) };
  }
  function studentExaminersMock_ (reg) {
    DB.examiners = DB.examiners || [];
    return filter(DB.examiners, function (x) {
      return String(x.regNumber) === String(reg) && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1;
    }).map(function (x) {
      return { type: x.type === 'Internal (Second)' ? 'Internal' : x.type, cycle: x.type === 'Internal (Second)' ? 2 : 1,
        status: String(x.status) === 'Scored' ? 'Assessment received' : 'Assigned' };
    });
  }
  function documentsForStudent_ (user, stu) {
    var out = [];
    var subs = filter(DB.submissions, function (s) { return String(s.regNumber) === String(user.regNumber); })
      .sort(function (a, b) { return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)); });
    var fb = examinerFeedbackForStudent_(stu.regNumber);
    function latest (type) {
      var best = null, bestAt = '', bestIdx = -1;
      subs.forEach(function (s, i) {
        if (String(s.type) !== type) return;
        var at = String(s.updatedAt || s.createdAt || '');
        if (!best || at > bestAt || (at === bestAt && i > bestIdx)) { best = s; bestAt = at; bestIdx = i; }
      });
      return best;
    }
    function row (doc, available, sub, extra) {
      var key = sub ? docStatusKey_(sub) : (available ? 'pending' : 'unavailable');
      if (doc.requiresExaminer && sub && key === 'submitted') {
        var waiting = doc.id.indexOf('external') === 0 ? !fb.external : (doc.id.indexOf('-2') > -1 ? !fb.internal2 : !fb.internal);
        if (waiting) key = 'awaitingExaminer';
      }
      var o = {
        id: doc.id, name: doc.name, section: doc.section, description: doc.description, stage: doc.stage, type: doc.type,
        trigger: doc.trigger, uploader: doc.uploader, formats: doc.formats, required: !!doc.required,
        resubmit: !!doc.resubmit, viewers: doc.viewers, accept: '.' + (doc.formats || []).join(',.'),
        available: !!available, status: key, statusLabel: DOCUMENT_STATUS_LABELS[key],
        submissionId: sub ? sub.id : '', fileId: fileIdsFromUrls_(sub ? sub.driveFileUrls : '')[0] || '',
        fileName: submissionFileName_(sub), uploadedAt: sub ? (sub.updatedAt || sub.createdAt) : '',
        inspectorComments: sub ? (sub.inspectorComments || '') : '', canUpload: !!available && (!sub || !!doc.resubmit || key === 'pending'),
        canView: !!sub && String(sub.status) !== 'Draft', canReplace: !!sub && !!doc.resubmit && !!available
      };
      if (extra) { o.fileName = extra.fileName; o.uploadedAt = extra.uploadedAt; o.canUpload = !!available; o.canView = !!extra.fileId; o.submissionId = ''; o.fileId = extra.fileId || o.fileId; }
      return o;
    }
    DOCUMENT_CONFIG.forEach(function (doc) {
      if (doc.uploader !== 'Student' || !docAppliesTo_(doc, stu)) return;
      var available = docAvailableForStudent_(doc, stu, fb);
      if (doc.type === '__passport__' || doc.type === '__admission__') {
        var isPass = doc.type === '__passport__';
        var url = isPass ? stu.passportUrl : stu.admissionLetterUrl;
        var id = isPass ? stu.passportFileId : (fileIdsFromUrls_(url)[0] || '');
        out.push(row(doc, available, null, { fileName: isPass ? 'Passport photograph' : 'Admission letter', uploadedAt: stu.updatedAt || '', fileId: id }));
        return;
      }
      out.push(row(doc, available, latest(doc.type)));
    });
    return out;
  }
  function downloadFileId_ (d) {
    var key = d.configKey === 'TEMPLATE_PROGRESS_PPTX' ? 'Progress Presentation Template' : 'Proposal Defence Form';
    return String(TEMPLATES[key] || '').trim();
  }
  function downloadsForStudent_ () {
    return DOWNLOAD_CONFIG.map(function (d) {
      var id = downloadFileId_(d);
      return { id: d.id, name: d.name, description: d.description, format: d.format,
        available: !!id, fileId: id, url: '', configKey: d.configKey };
    });
  }
  function downloadForFileId_ (id) {
    for (var i = 0; i < DOWNLOAD_CONFIG.length; i++) if (downloadFileId_(DOWNLOAD_CONFIG[i]) === String(id)) return DOWNLOAD_CONFIG[i];
    return null;
  }
  function finalPackageStatus_ (reg) {
    var subs = filter(DB.submissions, function (s) { return String(s.regNumber) === String(reg) && ['Draft', 'Rejected'].indexOf(String(s.status)) === -1; });
    var done = {};
    ['Comment-by-Comment Response (External Examiner)', 'Final Correction'].forEach(function (t) { done[t] = subs.some(function (s) { return s.type === t; }); });
    var fb = examinerFeedbackForStudent_(reg);
    done['External Examiner Assessment'] = !!(fb.external && fb.external.submittedAt);
    return { done: done, complete: Object.keys(done).every(function (k) { return done[k]; }) };
  }
  function checkFinalPackage_ (reg) {
    var stu = find(DB.students, function (s) { return String(s.regNumber) === String(reg); });
    if (!stu || String(stu.currentStage) !== '12 - External Examination' || !finalPackageStatus_(reg).complete) return;
    stu.currentStage = '13 - Final Compliance';
    stu.updatedAt = now();
    addNote_(reg, 'Final compliance check started. All external assessment and correction files are in.');
  }
  function addNote_ (reg, text) {
    DB.notifications = DB.notifications || [];
    DB.notifications.push({ id: nextId('Note'), regNumber: reg, text: text, read: false, createdAt: now() });
  }
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
  ${changeRegNumberMock.toString()}
  var PRESENTATION_INTENTS = {
    'Proposal Presentation': { label: 'Proposal presentation', stage: '5 - Proposal Defence Form', warn: '4 - Proposal Submission' },
    'Progress Report Presentation': { label: 'Progress report presentation', stage: '9 - Compliance Inspection', warn: '8 - Progress Report' },
    'Final Examination': { label: 'Final examination', stage: '11 - Final Examination Intent', warn: '11 - Final Examination Intent' }
  };
  var PRESENTATION_ACTIVE = ['Pending Supervisors', 'Pending Coordinator', 'Returned'];
  function presentationMeta(kind) { return PRESENTATION_INTENTS[kind] || null; }
  function presentationStaffId(user) {
    if (!user || user.role !== 'Staff') return '';
    if (find(DB.staff, function (x) { return String(x.id) === String(user.id); })) return String(user.id);
    if (find(DB.staff, function (x) { return String(x.id) === String(user.regNumber); })) return String(user.regNumber);
    var em = String(user.email || '').toLowerCase();
    var st = em && find(DB.staff, function (x) { return String(x.email || '').toLowerCase() === em; });
    if (st) return String(st.id);
    var fn = String(user.fullName || '').trim().toLowerCase();
    st = fn && find(DB.staff, function (x) { return String(x.fullName || '').trim().toLowerCase() === fn; });
    return st ? String(st.id) : '';
  }
  function presentationWarn(stu, kind) {
    var meta = presentationMeta(kind);
    if (!stu || !meta) return '';
    var idx = STAGES.indexOf(String(stu.currentStage || '')), wi = STAGES.indexOf(meta.warn);
    if (idx < 0 || wi < 0 || idx >= wi) return '';
    return 'This is earlier than the usual stage (' + meta.warn + '). You can still submit; the PG Coordinator will decide.';
  }
  function presentationView(r, viewer) {
    var stu = find(DB.students, function (s) { return String(s.regNumber) === String(r.regNumber); });
    var main = stu && stu.mainSupervisorId ? find(DB.staff, function (x) { return String(x.id) === String(stu.mainSupervisorId); }) : null;
    var co = stu && stu.coSupervisorId ? find(DB.staff, function (x) { return String(x.id) === String(stu.coSupervisorId); }) : null;
    var meta = presentationMeta(r.kind), hist = [];
    try { hist = JSON.parse(r.history || '[]'); } catch (e) { hist = []; }
    var v = {
      id: r.id, regNumber: String(r.regNumber || ''), studentName: stu ? fullNameOf(stu) : '',
      programme: stu ? stu.programme : '', currentStage: stu ? stu.currentStage : '',
      kind: String(r.kind || ''), preferredMonth: String(r.preferredMonth || ''), note: String(r.note || ''), status: String(r.status || ''),
      mainStatus: String(r.mainStatus || 'Pending'), mainBy: String(r.mainBy || ''), mainAt: String(r.mainAt || ''), mainNote: String(r.mainNote || ''),
      coStatus: String(r.coStatus || (co ? 'Pending' : 'Not Required')), coBy: String(r.coBy || ''), coAt: String(r.coAt || ''), coNote: String(r.coNote || ''),
      coordinatorStatus: String(r.coordinatorStatus || 'Pending'), coordinatorBy: String(r.coordinatorBy || ''), coordinatorAt: String(r.coordinatorAt || ''), coordinatorNote: String(r.coordinatorNote || ''),
      stageApplied: String(r.stageApplied || ''), targetStage: meta ? meta.stage : '',
      mainSupervisorName: main ? main.fullName : '', coSupervisorName: co ? co.fullName : '',
      warning: presentationWarn(stu, r.kind), history: hist, createdAt: String(r.createdAt || ''), updatedAt: String(r.updatedAt || ''),
      canEdit: false, canWithdraw: false, canAct: false, myRole: '', myStatus: ''
    };
    if (viewer && viewer.role === 'Student') {
      v.canEdit = ['Pending Supervisors', 'Returned'].indexOf(v.status) > -1;
      v.canWithdraw = PRESENTATION_ACTIVE.indexOf(v.status) > -1;
    } else if (viewer && viewer.role === 'Staff' && stu) {
      var sid = presentationStaffId(viewer);
      var isMain = sid && String(stu.mainSupervisorId) === sid;
      var isCo = sid && String(stu.coSupervisorId) === sid;
      v.myRole = isMain ? 'Main Supervisor' : (isCo ? 'Co-Supervisor' : '');
      v.myStatus = isMain ? v.mainStatus : (isCo ? v.coStatus : '');
      v.canAct = !!v.myRole && v.status === 'Pending Supervisors' && v.myStatus === 'Pending';
    } else if (viewer && viewer.role === 'PG_Coordinator') {
      v.canAct = v.status === 'Pending Coordinator';
    }
    return v;
  }
  function presentationIntentsForStudent(user) {
    return filter(DB.presentationIntents, function (r) { return String(r.regNumber) === String(user.regNumber); })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
      .map(function (r) { return presentationView(r, user); });
  }
  function presentationIntentsForStaff(user) {
    var sid = presentationStaffId(user), regs = [];
    if (!sid) return [];
    regs = filter(DB.students, function (s) { return String(s.mainSupervisorId) === sid || String(s.coSupervisorId) === sid; }).map(function (s) { return s.regNumber; });
    return filter(DB.presentationIntents, function (r) { return regs.indexOf(r.regNumber) !== -1; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
      .map(function (r) { return presentationView(r, user); });
  }
  function presentationIntentsForCoordinator(user) {
    return DB.presentationIntents.filter(function (r) { return r.status !== 'Withdrawn'; })
      .sort(function (a, b) {
        var ap = a.status === 'Pending Coordinator' ? 0 : 1, bp = b.status === 'Pending Coordinator' ? 0 : 1;
        return ap - bp || String(b.createdAt).localeCompare(String(a.createdAt));
      })
      .map(function (r) { return presentationView(r, user); });
  }
  function presentationPush(r, ev) {
    var a = [];
    try { a = JSON.parse(r.history || '[]'); } catch (e) { a = []; }
    a.push(ev);
    return JSON.stringify(a.slice(-20));
  }

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
        faculty: payload.faculty || 'Faculty of Physical Sciences', department: payload.department || 'Physics',
        programme: payload.programme || 'MSc', specialisation: payload.specialisation || '',
        passportFileId: 'local', passportUrl: (payload.passportPhoto && payload.passportPhoto.dataUrl) || '',
        mainSupervisorId: '', coSupervisorId: '', currentStage: START_STAGE,
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
      var url = mockFileUrl_('PASSPORT');
      stu.passportUrl = url;
      stu.passportFileId = fileIdsFromUrls_(url)[0];
      stu.updatedAt = now();
      return { ok: true, url: url, id: stu.passportFileId };
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
        presentationIntents: presentationIntentsForStudent(user),
        templates: TEMPLATES,
        stages: STAGES,
        documents: documentsForStudent_(user, stu),
        downloads: downloadsForStudent_(),
        documentCatalog: documentCatalogPayload_(),
        examinerFeedback: examinerFeedbackForStudent_(stu.regNumber),
        examiners: studentExaminersMock_(stu.regNumber)
      };
    },
    api_getDocumentCatalog: function (token) {
      requireUser(token);
      return documentCatalogPayload_();
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
        copy.checklistItems = checklistFor_(s.type);
        copy.fileName = submissionFileName_(s);
        return copy;
      });
    },
    api_createSubmission: function (token, payload) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      var doc = payload && documentByType_(payload.type);
      if (!doc || doc.uploader !== 'Student' || SUBMISSION_TYPES.indexOf(payload.type) === -1) throw new Error('Invalid submission type.');
      if (!payload.driveFileUrls) throw new Error('Drive file URL is required.');
      var stuForSub = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      if (!payload.asDraft) validateSubmissionStage_(stuForSub, payload.type);
      assertUploadLinkKind_(payload.type, payload.driveFileUrls);
      var nowStr = now(), url = String(payload.driveFileUrls).trim();
      var row = { id: nextId('Sub'), regNumber: user.regNumber, type: payload.type, driveFileUrls: url,
        status: payload.asDraft ? 'Draft' : 'Submitted', inspectorComments: '', supervisorNotes: '',
        createdBy: user.id, createdAt: nowStr, updatedAt: nowStr,
        history: pushFileHistory_(null, payload.asDraft ? 'Draft saved' : 'Uploaded', url, payload.fileName || urlFileName_(url), '', user.fullName) };
      DB.submissions.push(row);
      checkFinalPackage_(user.regNumber);
      return { id: row.id };
    },
    api_submitDraft: function (token, id, url) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      var sub = find(DB.submissions, function (s) { return s.id === id; });
      if (!sub || String(sub.regNumber) !== String(user.regNumber) || String(sub.status) !== 'Draft') throw new Error('Draft not found.');
      var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      validateSubmissionStage_(stu, sub.type);
      assertUploadLinkKind_(sub.type, url);
      var link = String(url || sub.driveFileUrls).trim(), nowStr = now();
      sub.history = pushFileHistory_(sub, 'Submitted from draft', link, urlFileName_(link), '', user.fullName);
      sub.driveFileUrls = link; sub.status = 'Submitted'; sub.createdAt = nowStr; sub.updatedAt = nowStr; sub.compliance = '';
      checkFinalPackage_(user.regNumber);
      return { ok: true };
    },
    api_resubmit: function (token, id, url) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      var sub = find(DB.submissions, function (s) { return s.id === id; });
      if (!sub || String(sub.regNumber) !== String(user.regNumber)) throw new Error('Submission not found.');
      if (['Rejected', 'Changes Requested'].indexOf(String(sub.status)) === -1) throw new Error('Only rejected or change-requested submissions can be resubmitted.');
      var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      validateSubmissionStage_(stu, sub.type);
      assertUploadLinkKind_(sub.type, url);
      if (!fileIdsFromUrls_(url).length) throw new Error('A valid link is required.');
      sub.history = pushFileHistory_(sub, 'Resubmitted', url, urlFileName_(url), 'After: ' + String(sub.status), user.fullName);
      sub.driveFileUrls = String(url).trim();
      sub.status = 'Submitted';
      sub.inspectorComments = '';
      sub.updatedAt = now();
      checkFinalPackage_(user.regNumber);
      return { ok: true };
    },
    api_replaceSubmission: function (token, id, url) {
      var user = requireUser(token);
      assertRole(user, ['Student'], 'Only students can replace their documents.');
      var sub = find(DB.submissions, function (s) { return s.id === id; });
      if (!sub || String(sub.regNumber) !== String(user.regNumber)) throw new Error('Submission not found.');
      var doc = documentByType_(sub.type);
      if (!doc || !doc.resubmit || doc.uploader !== 'Student') throw new Error('This document cannot be replaced.');
      var wasDraft = String(sub.status) === 'Draft', wasApproved = String(sub.status) === 'Approved';
      if (!wasDraft) validateSubmissionStage_(find(DB.students, function (s) { return s.regNumber === user.regNumber; }), sub.type);
      assertUploadLinkKind_(sub.type, url);
      if (!fileIdsFromUrls_(url).length) throw new Error('A valid file link is required.');
      var note = wasDraft ? 'Draft file replaced' : 'Replacement uploaded', reverted = '';
      if (wasApproved) {
        var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
        if (stu && doc.stage !== 'registration' && STAGES.indexOf(String(stu.currentStage)) > STAGES.indexOf(String(doc.stage))) {
          stu.currentStage = doc.stage; stu.updatedAt = now(); reverted = doc.stage;
          note += '; stage reverted to ' + doc.stage;
        }
      }
      sub.history = pushFileHistory_(sub, 'Replaced', url, urlFileName_(url), note, user.fullName);
      sub.driveFileUrls = String(url).trim();
      sub.status = wasDraft ? 'Draft' : 'Submitted';
      sub.inspectorComments = '';
      sub.updatedAt = now();
      checkFinalPackage_(user.regNumber);
      return { ok: true, draft: wasDraft, stageReverted: reverted };
    },
    api_uploadAdmissionLetter: function (token, p) {
      var user = requireUser(token);
      assertRole(user, ['Student'], 'Only students can upload an admission letter.');
      var stu = find(DB.students, function (s) { return s.regNumber === user.regNumber; });
      if (!stu) throw new Error('Student profile not found.');
      var parts = String((p && p.dataUrl) || '').split(','), mm = /data:(.*?);/.exec(parts[0] || '');
      if (!mm || mm[1] !== 'application/pdf') throw new Error('The admission letter must be a PDF file.');
      assertMagicBytes_('pdf', String((p && p.dataUrl) || ''));
      if (Math.floor((parts[1] || '').length * 3 / 4) > 3 * 1024 * 1024) throw new Error('The admission letter must be under 3 MB.');
      var url = mockFileUrl_('ADMISSION');
      stu.admissionLetterUrl = url;
      stu.updatedAt = now();
      addNote_(user.regNumber, 'Admission letter saved.');
      return { url: url, id: fileIdsFromUrls_(url)[0] };
    },
    api_uploadExaminerReport: function (token, p) {
      var user = requireUser(token);
      assertRole(user, ['Examiner'], 'Only examiners can upload a report.');
      p = p || {};
      var ex = find(DB.examiners, function (x) { return x.id === p.assignmentId; });
      if (!ex || String(ex.examLogin) !== String(user.regNumber)) throw new Error('Assignment not found.');
      if (String(ex.status) !== 'Assigned') throw new Error('This assessment has already been submitted or withdrawn.');
      var parts = String(p.dataUrl || '').split(','), mm = /data:(.*?);/.exec(parts[0] || '');
      var ok = { 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
      if (!ok[mm && mm[1]]) throw new Error('Upload a Word (.doc or .docx) report.');
      assertMagicBytes_(ok[mm[1]], String(p.dataUrl || ''));
      if (Math.floor((parts[1] || '').length * 3 / 4) > 10 * 1024 * 1024) throw new Error('The report must be under 10 MB.');
      var url = mockFileUrl_('REPORT');
      ex.reportUrl = url;
      return { url: url, id: fileIdsFromUrls_(url)[0], name: 'Examiner report.' + ok[mm[1]] };
    },
    api_assignSecondInternal: function (token, reg) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator'], 'Only the PG Coordinator can open Internal Examination II.');
      var stu = find(DB.students, function (s) { return String(s.regNumber) === String(reg); });
      if (!stu) throw new Error('Student not found.');
      if (!/phd/i.test(String(stu.programme || ''))) throw new Error('Internal Examination II is PhD-only.');
      if (String(stu.currentStage) !== SECOND_INTERNAL_STAGE) throw new Error('This student is not at Internal Examination II.');
      DB.examiners = DB.examiners || [];
      if (find(DB.examiners, function (x) { return String(x.regNumber) === String(stu.regNumber) && x.type === 'Internal (Second)' && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1; }))
        throw new Error('The second internal examiner has already been assigned.');
      var first = filter(DB.examiners, function (x) { return String(x.regNumber) === String(stu.regNumber) && x.type === 'Internal' && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1; })
        .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0];
      if (!first) throw new Error('Assign the first Internal Examiner before opening the second cycle.');
      var row = { id: nextId('Exm'), regNumber: stu.regNumber, examinerName: first.examinerName, type: 'Internal (Second)', email: first.email,
        examLogin: first.examLogin, institution: first.institution, department: first.department, rank: first.rank,
        status: 'Assigned', createdAt: now(), reportUrl: '', comments: '', recommendation: '', scores: '', submittedAt: '' };
      DB.examiners.push(row);
      addNote_(stu.regNumber, 'Second internal examiner assigned. Examiner identities are kept confidential.');
      addNote_(first.examLogin, 'You have been assigned PhD Internal Examination II. Open My Assignments to submit your assessment.');
      return { id: row.id, loginId: first.examLogin };
    },
    /** One locked-style action: revoke the old assignment and appoint the replacement in the same call. */
    api_replaceExaminer: function (token, id, p) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator', 'HoD'], 'Only the PG Coordinator or HoD can replace examiners.');
      var old = find(DB.examiners, function (x) { return x.id === id; });
      if (!old) throw new Error('Examiner record not found.');
      if (String(old.status) === 'Scored') throw new Error('A submitted assessment cannot be replaced.');
      p = p || {};
      if (!String(p.fullName || '').trim() || !String(p.email || '').trim()) throw new Error('Enter the replacement examiner’s name and email.');
      old.status = 'Revoked';
      var row = { id: nextId('Exm'), regNumber: old.regNumber, examinerName: String(p.fullName).trim(),
        type: old.type, email: String(p.email).trim(), examLogin: String(p.email).trim(),
        institution: p.institution || old.institution || '', department: p.department || old.department || '',
        rank: p.rank || '', status: 'Assigned', createdAt: now(), dueDate: p.dueDate || '',
        reportUrl: '', comments: '', recommendation: '', scores: '', score: '', submittedAt: '' };
      DB.examiners.push(row);
      addNote_(old.regNumber, old.type + ' examiner replaced. The new examiner has been appointed.');
      return { id: row.id, loginId: row.examLogin, replaced: old.id };
    },
    api_getExaminerDashboard: function (token) {
      var user = requireUser(token);
      assertRole(user, ['Examiner']);
      DB.examiners = DB.examiners || [];
      return {
        criteria: ASSESSMENT_CRITERIA, recommendations: RECOMMENDATIONS, internalRecommendations: INTERNAL_RECS,
        documentCatalog: documentCatalogPayload_(),
        assignments: filter(DB.examiners, function (x) {
          return String(x.examLogin) === String(user.regNumber) && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1;
        }).map(function (x) {
          var stu = find(DB.students, function (s) { return s.regNumber === x.regNumber; });
          var docs = filter(DB.submissions, function (s) {
            if (String(s.regNumber) !== String(x.regNumber) || String(s.status) === 'Draft') return false;
            if (x.type === 'External') return s.type === 'Final Thesis/Dissertation';
            return s.type === (x.type === 'Internal (Second)' ? 'Progress Report (Second Internal)' : 'Progress Report');
          });
          return { id: x.id, type: x.type, status: x.status, dueDate: x.dueDate || '', submittedAt: x.submittedAt || '',
            submissionId: docs.length ? docs[0].id : '', student: stu ? fullNameOf(stu) : x.regNumber,
            programme: stu ? stu.programme : '', thesisTitle: stu ? (stu.thesisTitle || '') : '',
            document: x.type === 'External' ? 'Thesis / Dissertation' : x.type === 'Internal (Second)' ? 'Second Progress Report (PhD second internal cycle)' : 'Progress Report',
            recommendation: x.recommendation || '', score: x.score || '', comments: x.comments || '', reportUrl: x.reportUrl || '' };
        })
      };
    },
    api_submitExaminerAssessment: function (token, id, a) {
      var user = requireUser(token);
      assertRole(user, ['Examiner']);
      var ex = find(DB.examiners, function (x) { return x.id === id; });
      if (!ex || String(ex.examLogin) !== String(user.regNumber)) throw new Error('Assignment not found.');
      if (String(ex.status) !== 'Assigned') throw new Error('This assessment has already been submitted or withdrawn.');
      a = a || {};
      var crit = ASSESSMENT_CRITERIA[ex.type] || ASSESSMENT_CRITERIA.Internal || [], scores = {}, total = 0;
      crit.forEach(function (c) {
        var n = parseFloat((a.scores || {})[c]);
        if (isNaN(n) || n < 0 || n > 100) throw new Error('Enter a score (0–100) for: ' + c);
        scores[c] = n; total += n;
      });
      var recs = ex.type === 'External' ? RECOMMENDATIONS : INTERNAL_RECS;
      if (recs.indexOf(a.recommendation) === -1) throw new Error('Choose a recommendation.');
      var rep = String(a.reportUrl || '').trim(), comments = String(a.comments || '').trim();
      if (!rep && !comments) throw new Error('Enter your comments in the text field, or link to your Word report (or both).');
      ex.scores = JSON.stringify(scores);
      ex.score = Math.round((total / crit.length) * 10) / 10;
      ex.recommendation = a.recommendation;
      ex.comments = comments;
      ex.reportUrl = rep;
      ex.submittedAt = now();
      ex.status = 'Scored';
      addNote_(ex.regNumber, (ex.type === 'Internal (Second)' ? 'Second internal' : ex.type) + ' examiner feedback is available.');
      if (ex.type === 'External') checkFinalPackage_(ex.regNumber);
      return { ok: true };
    },
    api_getPipeline: function (token) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator', 'HoD']);
      return filter(DB.students, function (s) { return String(s.currentStage) !== '15 - Completion'; }).map(function (s) {
        DB.examiners = DB.examiners || [];
        var mine = filter(DB.examiners, function (x) { return String(x.regNumber) === String(s.regNumber) && ['Declined', 'Revoked'].indexOf(String(x.status)) === -1; });
        var main = s.mainSupervisorId ? find(DB.staff, function (x) { return x.id === s.mainSupervisorId; }) : null;
        return { regNumber: s.regNumber, studentName: fullNameOf(s), programme: s.programme, stage: s.currentStage,
          title: s.thesisTitle || '', titleStatus: s.titleStatus || 'Not Submitted', mainSupervisor: main ? main.fullName : '',
          waitingOn: String(s.currentStage) === SECOND_INTERNAL_STAGE ? (mine.some(function (e) { return e.type === 'Internal (Second)'; }) ? 'PG Coordinator: record Internal Examination II outcome' : 'PG Coordinator: assign second internal examiner') : 'Student / examiner',
          waitingDays: 0, detail: [], secondInternal: mine.some(function (e) { return e.type === 'Internal (Second)'; }) };
      });
    },
    api_listExaminerQueue: function (token) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator', 'HoD']);
      DB.examiners = DB.examiners || [];
      function view (type) {
        return filter(DB.examiners, function (x) { return x.type === type && String(x.status) === 'Assigned'; }).map(function (x) {
          var stu = find(DB.students, function (s) { return s.regNumber === x.regNumber; });
          return { kind: type, regNumber: x.regNumber, studentName: stu ? fullNameOf(stu) : x.regNumber, programme: stu ? stu.programme : '',
            stage: stu ? stu.currentStage : '', examiner: { id: x.id, name: x.examinerName, email: x.email, department: x.department } };
        });
      }
      return { internal: view('Internal'), external: view('External'), secondExaminer: view('Internal (Second)') };
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
      return { pending: pending, students: allStudents, staff: staffList, stages: STAGES, presentationIntents: presentationIntentsForCoordinator(user) };
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
        faculty: payload.faculty || 'Faculty of Physical Sciences', department: payload.department || 'Physics',
        programme: payload.programme || 'MSc', specialisation: payload.specialisation || '',
        passportFileId: '', passportUrl: '',
        mainSupervisorId: '', coSupervisorId: '', currentStage: START_STAGE,
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
    api_changeStudentRegNumber: function (token, oldReg, newReg) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      return changeRegNumberMock(oldReg, newReg);
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
      if (stage === SECOND_INTERNAL_STAGE && !/phd/i.test(String(stu.programme || ''))) throw new Error('Internal Examination II is a PhD-only stage.');
      stu.currentStage = stage;
      stu.updatedAt = now();
      return true;
    },
    api_recordSecondInternal: function (token, reg, outcome, note) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator'], 'Access denied.');
      if (['Passed', 'Passed with corrections', 'Not passed'].indexOf(outcome) === -1) throw new Error('Choose an outcome.');
      var stu = find(DB.students, function (s) { return String(s.regNumber) === String(reg); });
      if (!stu) throw new Error('Student not found.');
      if (!/phd/i.test(String(stu.programme || ''))) throw new Error('Internal Examination II is a PhD-only stage.');
      if (String(stu.currentStage) !== SECOND_INTERNAL_STAGE) throw new Error('This student is not at Internal Examination II.');
      note = String(note || '').trim().slice(0, 800);
      if (outcome !== 'Passed' && !note) throw new Error('Add a note (corrections required, or reason).');
      var moved = outcome === 'Not passed' ? '' : '11 - Final Examination Intent';
      if (moved) stu.currentStage = moved;
      stu.updatedAt = now();
      return { ok: true, stage: moved || stu.currentStage };
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
      var sid = presentationStaffId(user);
      var mine = filter(DB.students, function (s) { return String(s.mainSupervisorId) === sid || String(s.coSupervisorId) === sid; });
      var regs = mine.map(function (s) { return s.regNumber; });
      return {
        students: mine.map(function (s) { return { regNumber: s.regNumber, fullName: fullNameOf(s), programme: s.programme, specialisation: s.specialisation, currentStage: s.currentStage, passportUrl: s.passportUrl }; }),
        submissions: filter(DB.submissions, function (s) { return regs.indexOf(s.regNumber) !== -1; }).map(function (s) {
          var stu = find(DB.students, function (x) { return x.regNumber === s.regNumber; });
          return { id: s.id, regNumber: s.regNumber, studentName: stu ? fullNameOf(stu) : '', type: s.type, status: s.status, supervisorNotes: s.supervisorNotes, createdAt: s.createdAt };
        }),
        presentationIntents: presentationIntentsForStaff(user)
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
    api_savePresentationIntent: function (token, payload) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      var stu = find(DB.students, function (s) { return String(s.regNumber) === String(user.regNumber); });
      if (!stu) throw new Error('Student profile not found.');
      if (!stu.mainSupervisorId) throw new Error('Your Main Supervisor must be assigned before you can request a presentation.');
      payload = payload || {};
      var kind = String(payload.kind || '');
      if (!presentationMeta(kind)) throw new Error('Choose a valid presentation type.');
      var month = String(payload.preferredMonth || '').trim();
      if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid preferred month.');
      var note = String(payload.note || '').trim().slice(0, 1200);
      var coId = String(stu.coSupervisorId || '');
      if (coId && !find(DB.staff, function (x) { return String(x.id) === coId; })) coId = '';
      var nowStr = now(), id = String(payload.id || ''), r;
      if (id) {
        r = find(DB.presentationIntents, function (x) { return String(x.id) === id; });
        if (!r || String(r.regNumber) !== String(user.regNumber)) throw new Error('Presentation intent not found.');
        if (['Pending Supervisors', 'Returned'].indexOf(String(r.status)) === -1) throw new Error('This presentation intent can no longer be edited.');
        r.kind = kind; r.preferredMonth = month; r.note = note; r.status = 'Pending Supervisors';
        r.mainStatus = 'Pending'; r.mainBy = ''; r.mainAt = ''; r.mainNote = '';
        r.coStatus = coId ? 'Pending' : 'Not Required'; r.coBy = ''; r.coAt = ''; r.coNote = '';
        r.coordinatorStatus = 'Pending'; r.coordinatorBy = ''; r.coordinatorAt = ''; r.coordinatorNote = ''; r.stageApplied = '';
        r.history = presentationPush(r, { at: nowStr, by: user.fullName, role: 'Student', action: 'Resubmitted', note: kind + ' / ' + month });
        r.updatedAt = nowStr;
      } else {
        var existing = find(DB.presentationIntents, function (x) { return String(x.regNumber) === String(user.regNumber) && PRESENTATION_ACTIVE.indexOf(String(x.status)) > -1; });
        if (existing) throw new Error('You already have a presentation intent in progress. Edit and resubmit it, or withdraw it first.');
        r = { id: nextId('Pnt'), regNumber: user.regNumber, kind: kind, preferredMonth: month, note: note, status: 'Pending Supervisors',
          mainStatus: 'Pending', mainBy: '', mainAt: '', mainNote: '',
          coStatus: coId ? 'Pending' : 'Not Required', coBy: '', coAt: '', coNote: '',
          coordinatorStatus: 'Pending', coordinatorBy: '', coordinatorAt: '', coordinatorNote: '', stageApplied: '',
          history: JSON.stringify([{ at: nowStr, by: user.fullName, role: 'Student', action: 'Submitted', note: kind + ' / ' + month }]),
          createdAt: nowStr, updatedAt: nowStr };
        DB.presentationIntents.push(r);
        id = r.id;
      }
      return { id: id, status: 'Pending Supervisors', warning: presentationWarn(stu, kind) };
    },
    api_decidePresentationIntent: function (token, id, decision, note) {
      var user = requireUser(token);
      assertRole(user, ['Staff']);
      decision = String(decision || '');
      if (['Approved', 'Declined'].indexOf(decision) === -1) throw new Error('Invalid decision.');
      note = String(note || '').trim().slice(0, 1200);
      if (decision === 'Declined' && !note) throw new Error('A reason is required when declining.');
      var r = find(DB.presentationIntents, function (x) { return String(x.id) === String(id); });
      if (!r) throw new Error('Presentation intent not found.');
      if (r.status !== 'Pending Supervisors') throw new Error('This presentation intent is no longer awaiting supervisor approval.');
      var stu = find(DB.students, function (s) { return String(s.regNumber) === String(r.regNumber); });
      var sid = presentationStaffId(user);
      var isMain = sid && String(stu.mainSupervisorId) === sid;
      var isCo = sid && String(stu.coSupervisorId) === sid;
      if (!isMain && !isCo) throw new Error('This presentation intent is not from your student.');
      var field = isMain ? 'main' : 'co';
      if (String(r[field + 'Status'] || 'Pending') !== 'Pending') throw new Error('You have already decided on this presentation intent.');
      var nowStr = now();
      r[field + 'Status'] = decision; r[field + 'By'] = user.fullName; r[field + 'At'] = nowStr; r[field + 'Note'] = note;
      var mainStatus = isMain ? decision : String(r.mainStatus || 'Pending');
      var coStatus = isCo ? decision : String(r.coStatus || (stu.coSupervisorId ? 'Pending' : 'Not Required'));
      r.status = decision === 'Declined' ? 'Returned' : (mainStatus === 'Approved' && (!stu.coSupervisorId || coStatus === 'Approved') ? 'Pending Coordinator' : 'Pending Supervisors');
      r.history = presentationPush(r, { at: nowStr, by: user.fullName, role: isMain ? 'Main Supervisor' : 'Co-Supervisor', action: decision, note: note });
      r.updatedAt = nowStr;
      return { ok: true, status: r.status };
    },
    api_decidePresentationIntentCoordinator: function (token, id, decision, note) {
      var user = requireUser(token);
      assertRole(user, ['PG_Coordinator']);
      decision = String(decision || '');
      if (['Approved', 'Returned'].indexOf(decision) === -1) throw new Error('Invalid decision.');
      note = String(note || '').trim().slice(0, 1200);
      if (decision === 'Returned' && !note) throw new Error('A reason is required when returning a presentation intent.');
      var r = find(DB.presentationIntents, function (x) { return String(x.id) === String(id); });
      if (!r) throw new Error('Presentation intent not found.');
      if (r.status !== 'Pending Coordinator') throw new Error('This presentation intent is not awaiting PG Coordinator approval.');
      var stu = find(DB.students, function (s) { return String(s.regNumber) === String(r.regNumber); });
      var nowStr = now(), applied = '';
      if (decision === 'Approved') {
        var meta = presentationMeta(r.kind), target = meta ? meta.stage : '';
        if (target && STAGES.indexOf(target) > STAGES.indexOf(stu.currentStage)) { stu.currentStage = target; stu.updatedAt = nowStr; applied = target; }
        r.status = 'Approved'; r.coordinatorStatus = 'Approved'; r.coordinatorBy = user.fullName; r.coordinatorAt = nowStr; r.coordinatorNote = note; r.stageApplied = applied;
      } else {
        r.status = 'Returned'; r.coordinatorStatus = 'Returned'; r.coordinatorBy = user.fullName; r.coordinatorAt = nowStr; r.coordinatorNote = note;
      }
      r.history = presentationPush(r, { at: nowStr, by: user.fullName, role: 'PG Coordinator', action: decision, note: note });
      r.updatedAt = nowStr;
      return { ok: true, status: decision, stageApplied: applied };
    },
    api_withdrawPresentationIntent: function (token, id) {
      var user = requireUser(token);
      assertRole(user, ['Student']);
      var r = find(DB.presentationIntents, function (x) { return String(x.id) === String(id); });
      if (!r || String(r.regNumber) !== String(user.regNumber)) throw new Error('Presentation intent not found.');
      if (PRESENTATION_ACTIVE.indexOf(String(r.status)) === -1) throw new Error('This presentation intent can no longer be withdrawn.');
      r.status = 'Withdrawn';
      r.history = presentationPush(r, { at: now(), by: user.fullName, role: 'Student', action: 'Withdrawn', note: '' });
      r.updatedAt = now();
      return { ok: true };
    },
    /* ---- public landing pages (no auth) ---- */
    api_publicAnnouncements: function () {
      return { items: publicFeedItems() };
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
    },
    /* ---- notification centre (Phase 3): kept in memory, no server rows locally ---- */
    api_getNotifications: function (token, which) {
      var user = requireUser(token);
      DB.notifications = DB.notifications || [];
      var mine = filter(DB.notifications, function (n) { return n.regNumber === user.regNumber; }).slice().reverse();
      var unread = filter(mine, function (n) { return !n.read; }).length;
      var shown = String(which) === 'unread' ? filter(mine, function (n) { return !n.read; }) : mine;
      return { unread: unread, total: mine.length, items: shown.slice(0, 60) };
    },
    api_markNotificationRead: function (token, id) {
      var user = requireUser(token);
      DB.notifications = DB.notifications || [];
      var n = find(DB.notifications, function (x) { return x.id === id && x.regNumber === user.regNumber; });
      if (!n) throw new Error('Notification not found.');
      n.read = true;
      return { ok: true };
    },
    api_markNotificationsRead: function (token) {
      var user = requireUser(token);
      DB.notifications = DB.notifications || [];
      filter(DB.notifications, function (n) { return n.regNumber === user.regNumber; }).forEach(function (n) { n.read = true; });
      return { ok: true };
    },
    /* Every real upload is private and served through this call; the local mock has no
       Drive files, so it returns the canonical Drive URL for the id. */
    api_getFileAccess: function (token, fileId) {
      var user = requireUser(token);
      var id = String(fileId || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (id.length < 10) throw new Error('File not found.');
      var mentions = function (text) { return String(text || '').indexOf('/d/' + id) > -1 || String(text || '').indexOf('id=' + id) > -1; };
      var sub = find(DB.submissions, function (s) { return fileIdsFromUrls_(s.driveFileUrls).indexOf(id) > -1; });
      if (sub && user.role === 'Student' && String(sub.regNumber) !== String(user.regNumber)) throw new Error('You cannot open this file.');
      var passport = find(DB.students, function (s) { return String(s.passportFileId) === id; });
      if (passport && user.role === 'Student' && String(passport.regNumber) !== String(user.regNumber)) throw new Error('You cannot open this file.');
      var admission = find(DB.students, function (s) { return mentions(s.admissionLetterUrl); });
      if (admission && user.role === 'Student' && String(admission.regNumber) !== String(user.regNumber)) throw new Error('You cannot open this file.');
      var report = find(DB.examiners, function (x) { return fileIdsFromUrls_(x.reportUrl).indexOf(id) > -1; });
      if (report && user.role === 'Student' && (String(report.regNumber) !== String(user.regNumber) || String(report.status) !== 'Scored')) throw new Error('You cannot open this file.');
      if (!sub && !passport && !admission && !report && !downloadForFileId_(id)) throw new Error('File not found.');
      return { url: 'https://drive.google.com/file/d/' + id + '/view', id: id, name: 'attachment' };
    },
    api_getPhotos: function (token) { requireUser(token); return {}; }
  };
})();
</script>
`;

/* ---- Server ---- */
const pageCache = new Map();

function readGas(name) {
  return fs.readFileSync(path.join(GAS_DIR, name + ".html"), "utf8");
}

function buildPage(pageName, embed, back) {
  const cacheKey = pageName + (embed ? "?embed=1" : "") + (back ? "?back=" + back : "");
  if (pageCache.has(cacheKey)) return pageCache.get(cacheKey);
  let html = renderTemplate(readGas("index"), {
    page: pageName,
    brandJson: JSON.stringify(BRAND),
    // mirrors doGet: the index view switcher must not point at the portal
    initialPageJson: JSON.stringify(pageName === "login" ? "home" : pageName),
    initialViewJson: JSON.stringify(""),
    embedJson: JSON.stringify(!!embed),
    backJson: JSON.stringify(back || ""),
  });
  if (html.match(/<\?/g)) console.warn("warning: unreplaced scriptlet(s) in index.html");
  // inject the mocks right after <body> so every page script can use them
  html = html.replace(/<body>/, function () { return "<body>\n" + MOCK_JS + "\n" + MOCK_API_JS; });
  pageCache.set(cacheKey, html);
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
        const type = /\.png$/i.test(fname) ? "image/png"
          : /\.jpe?g$/i.test(fname) ? "image/jpeg"
          : /\.svg$/i.test(fname) ? "image/svg+xml"
          : "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "max-age=3600" });
        return res.end(fs.readFileSync(fpath));
      }
      res.writeHead(404);
      return res.end("Not found");
    }

    // page name from ?page= or path (/about, /register, /login, …)
    const seg = urlPath.replace(/^\/+|\/+$/g, "").replace(/\.html$/i, "");
    let key = String(query.get("page") || seg || "").toLowerCase();
    if (LEGACY[key]) key = LEGACY[key]; // /about/ and /programmes/ → home
    if (PAGES.indexOf(key) !== -1) {
      const embed = query.get("embed") === "1" || query.get("embed") === "true";
      // mirrors doGet/safeBackPath_: same-origin paths only
      let back = String(query.get("back") || "").trim();
      if (!/^\/[A-Za-z0-9\-._~\/]*$/.test(back) || back.indexOf("//") === 0) back = "";
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(buildPage(key || "home", embed, back));
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found. Pages: / (home), /?page=register|contact|login");
  })
  .listen(port, () => {
    console.log("Postgraduate Journey local preview running at http://localhost:" + port);
    console.log("Pages: / (home), /?page=register, /?page=contact, /?page=login");
    console.log("(legacy /?page=about and /?page=programmes fall back to Home)");
    console.log("Demo logins (password PhysicsPG2026!):");
    console.log("  Student          UA/pg2026/000001");
    console.log("  Student (2nd pattern)  26/408PHYX/040");
    console.log("  PhD at Step 10b UA/pg2026/000003");
    console.log("  PG Coordinator   UA/pg2026/000010");
    console.log("  HoD              UA/pg2026/000011");
    console.log("  Staff            UA/pg2026/000012");
    console.log("  Inspector        UA/pg2026/000013");
  });
