$ErrorActionPreference = 'Stop'

# Regenerates the eight role guides as DOCX only.
# Requires Windows + Word COM. Set PG_GUIDES_OUT to write somewhere other than docs/guides.

$out = if ($env:PG_GUIDES_OUT) { $env:PG_GUIDES_OUT } else { Join-Path $PSScriptRoot "..\docs\guides" }
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out -Force | Out-Null }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$wdStyleNormal = -1
$wdStyleTitle = -2
$wdStyleHeading1 = -3
$wdStyleHeading2 = -4

function New-Doc {
    $script:doc = $word.Documents.Add()
    $script:sel = $word.Selection
}
function Set-Title($t) { $script:sel.Style = $wdStyleTitle; $script:sel.TypeText($t); $script:sel.TypeParagraph() }
function Set-H1($t) { $script:sel.Style = $wdStyleHeading1; $script:sel.TypeText($t); $script:sel.TypeParagraph() }
function Set-H2($t) { $script:sel.Style = $wdStyleHeading2; $script:sel.TypeText($t); $script:sel.TypeParagraph() }
function Set-Normal($t) { $script:sel.Style = $wdStyleNormal; $script:sel.TypeText($t); $script:sel.TypeParagraph() }
function Set-Bullet($t) {
    try { $script:sel.Style = $script:doc.Styles.Item('List Paragraph') } catch { $script:sel.Style = $wdStyleNormal }
    $script:sel.Range.ListFormat.ApplyBulletDefault()
    $script:sel.TypeText($t)
    $script:sel.TypeParagraph()
}
function Add-Table([object[]]$Rows) {
    $r = $Rows.Count
    $c = 0
    foreach ($row in $Rows) { if ($row.Count -gt $c) { $c = $row.Count } }
    $script:sel.TypeParagraph()
    $tbl = $script:doc.Tables.Add($script:sel.Range, $r, $c)
    for ($i = 1; $i -le $r; $i++) {
        $row = $Rows[$i - 1]
        for ($j = 1; $j -le $c; $j++) {
            $v = if ($j -le $row.Count) { [string]$row[$j - 1] } else { '' }
            $tbl.Cell($i, $j).Range.Text = $v
        }
    }
    $script:sel.EndKey(6) | Out-Null
}
function Save-Doc($name) {
    $path = Join-Path $out $name
    $script:doc.SaveAs([string]$path, 16)
    $script:doc.Close($false)
    "saved $name"
}

# ============================================================
# PG_Portal_Guide_Student.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Student User Guide'
Set-Normal 'Your postgraduate journey, step by step'
Set-Normal 'This guide explains how to use the portal from registration to completion: how to read your dashboard, submit documents, work with your supervisors and know what to do at each of the 16 numbered stages and the PhD-only Step 10b.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the 16-stage/PhD 10b journey, publications and clearance, reports, notifications and security updates)'),
  @('Audience', 'Postgraduate students (MSc, MPhil, PhD)'),
  @('Portal address', 'The web-app link sent to you by the PG Coordinator (PGC)'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PGC')
)
Set-H2 'In this guide'
Set-Bullet 'About the portal and your journey'
Set-Bullet 'Signing in, passwords and notifications'
Set-Bullet 'Registering and getting approved'
Set-Bullet 'Your dashboard'
Set-Bullet 'Thesis title'
Set-Bullet 'Submitting documents'
Set-Bullet 'Format checks and format history'
Set-Bullet 'Requesting approvals'
Set-Bullet 'Working with your supervisors'
Set-Bullet 'Examiners and final stages'
Set-Bullet 'Publications and pre-defence clearance'
Set-Bullet 'Reports and printable records'
Set-Bullet 'Asking questions and making requests'
Set-Bullet 'Programme calendar'
Set-Bullet 'Troubleshooting and FAQ'
Set-Bullet 'Quick reference'
Set-H1 '1. About the portal and your journey'
Set-H2 'What the portal does'
Set-Normal 'The PG Journey Portal is where the Department of Physics tracks your postgraduate programme. It tells you which stage you are at, what you must do next, who must approve it, and keeps all your submissions, meetings, messages and examiner outcomes in one place.'
Set-H2 'The 16 numbered stages and 5 phases'
Set-Normal 'Your journey has 16 numbered stages grouped in 5 phases, plus a PhD-only Step 10b inserted after Step 10. Gates (marked ◆) are stages where an outcome decides what happens next. Stage 2 applies to MSc students only; Step 10b applies to PhD students only.'
Add-Table @(
  @('Phase', 'Stages', 'Name'),
  @('1', '1–3', 'Coursework & Research Preparation'),
  @('2', '4–7', 'Proposal Stage'),
  @('3', '8–10b', 'Research Execution & Progress'),
  @('4', '11–13', 'Thesis Verification & External Examination'),
  @('5', '14–16', 'Post-Defence Corrections & Completion')
)
Set-H2 'Stage reference'
Add-Table @(
  @('#', 'Stage', 'What happens', 'Who acts'),
  @('1', 'Admission', 'Registration and university orientation completed.', 'Student, PGC'),
  @('2', 'Lecture Attendance', 'Required lectures (MSc students only).', 'Student'),
  @('3', 'Supervisor Allocation', 'Main and Co-Supervisor assigned.', 'HoD / PGC'),
  @('4', 'Title Approval', 'Thesis title submitted and approved by both supervisors.', 'Student, supervisors'),
  @('5', 'Proposal Submission', 'Research Proposal uploaded, format-checked and approved.', 'Student, Inspector'),
  @('6', 'Defence Readiness', 'Signed Proposal Defence Form uploaded, or readiness approved in the system.', 'Student, supervisors, PGC'),
  @('7', 'Proposal Defence ◆', 'Defence at the monthly seminar; outcome recorded. Gate.', 'PGC'),
  @('8', 'Progress Report Intent', 'Approval to present the progress report.', 'Supervisors, PGC'),
  @('9', 'Internal Examiner Assignment', 'An Internal Examiner from another department is appointed.', 'HoD'),
  @('10', 'Progress Presentation ◆', 'Presentation (PPTX) checked and approved — the first internal examination. Satisfactory moves MSc/MPhil students to Step 11; PhD students go to Step 10b. Gate.', 'Student, Inspector'),
  @('10b', 'Second Internal Examination (PhD) ◆', 'PhD students only: the PG Coordinator records the second internal outcome. Passed or Passed with corrections moves you to Step 11; Not passed keeps you at Step 10b. Gate.', 'Student, PGC'),
  @('11', 'Final Examination Intent', 'Approval for the final examination.', 'Supervisors, PGC'),
  @('12', 'Thesis Submission ◆', 'Thesis uploaded; format and similarity checks; approval. Gate.', 'Student, Inspector'),
  @('13', 'External Examiner Assignment ◆', 'An External Examiner from another university is appointed. Gate.', 'HoD'),
  @('14', 'Examiners' + [char]0x2019 + ' Comments', 'Examiner comments, comment-by-comment response and final corrections.', 'Student'),
  @('15', 'Final Compliance ◆', 'Supervisors endorse; Inspector and PGC approve the final copy. Gate.', 'Supervisors, PGC, Inspector'),
  @('16', 'Signed Copies and Completion', 'Signed copies submitted to the PGC; journey complete.', 'Student, PGC')
)
Add-Table @(
  @('Tip  The Home page animation shows the same journey: each stage lights up in turn, and the banner at the bottom names the stage and phase.')
)
Set-H2 'How Step 10b works (PhD students)'
Set-Normal 'Step 10b is for PhD students only. After the shared first internal examination at Step 10, PhD students sit a second internal examination before everyone proceeds to Step 11.'
Set-Normal 'The PGC records the outcome as Passed, Passed with corrections or Not passed. Passed and Passed with corrections move you to Step 11; Not passed keeps you at Step 10b until a successful outcome is recorded.'
Set-Normal 'You do not request Step 10b yourself. The PGC records it on your behalf when the second examination has taken place.'
Set-H1 '2. Signing in, passwords and notifications'
Set-H2 'Sign in for the first time'
Set-Bullet 'Open the portal link and choose Login.'
Set-Bullet 'Enter your registration number then the one-time password sent to you by email.'
Set-Bullet 'You are asked to choose a new password. It must be 8–128 characters, contain at least one letter and one number, and must not be your registration number or a common password.'
Add-Table @(
  @('Good to know  After 5 wrong attempts the account is locked for 15 minutes. Your session ends automatically after about 6 hours; just sign in again.')
)
Set-H2 'Forgot your password'
Set-Bullet 'On the sign-in page choose Forgot password? enter your registration number and press Email me a code.'
Set-Bullet 'A 6-digit code is sent to the email address on your account. It expires after 30 minutes.'
Set-Bullet 'Enter the code and your new password. You can request a code up to 3 times per hour. If no email arrives, check your spam folder or contact the PGC.'
Set-Normal 'Note  For privacy, the reset form gives the same reply whether or not the registration number or staff ID exists, so it cannot be used to find registered accounts.'
Set-H2 'Notifications and email settings'
Set-Bullet 'The bell (top right) shows unread updates. Open it to see the history, switch between All and Unread, and mark items read one by one or with Mark all read. Opening the bell does not itself mark anything as read; the list shows the most recent 60 items.'
Set-Normal 'The PGC or HoD may also send group messages to students, their supervisors, or both. These arrive through the bell and/or email.'
Set-Bullet 'Red numbers on menu tabs show how many items are waiting for you.'
Set-Bullet 'On Help & FAQ, set Email notifications to Instant, Daily digest or Off (bell only). Account and security emails are always sent.'
Set-Bullet 'Use the moon icon to switch between light and dark theme, Change password to update your password, and Sign out when you finish, especially on a shared computer.'
Set-Bullet 'Emails come from a no-reply address. Do not reply to them; use Messages or Inquiries in the portal instead.'
Set-H2 'Change your email address'
Set-Bullet 'Open Help & FAQ and find the My account card.'
Set-Bullet 'Type the new address and press Send confirmation code. The 6-digit code goes to the NEW address, so the change only happens if you can open it.'
Set-Bullet 'Enter the code (valid for 30 minutes) and press Confirm new email.'
Add-Table @(
  @('Note  An address that another account already uses is refused. You can request a code up to 3 times per hour.')
)
Set-H1 '3. Registering and getting approved'
Set-H2 'Register as a new student'
Set-Bullet 'From the public site choose Register.'
Set-Bullet 'Enter your registration number (for example UA/pg2026/003531, 26/408PHYX/040, Phd/sci/16586006 or 1750806006), names, gender, phone, email, faculty, department, programme and specialisation. Names with accents are accepted. If the department has enabled the human check, complete it before submitting.'
Set-Bullet 'Upload a passport photograph (JPG, PNG, WEBP or HEIC; large photos are resized). You may also attach your admission letter (PDF, up to 3 MB). Only the PGC and HoD can open it.'
Set-Bullet 'Submit. Your registration waits for PGC approval. If the portal says it is very busy, wait and try again.'
Add-Table @(
  @('Note  Use an email address no other account uses. Register once; repeated submissions are limited. Check progress any time with Check Status and enter both your registration number and the email used to register. Check Status will not reveal a registration if the email does not match. You will be emailed the decision and a one-time password. Your academic session is set automatically from your registration number. If the department has enabled the human check, complete it on the Register and Contact forms.')
)
Set-H1 '4. Your dashboard'
Set-H2 'What you see'
Set-Bullet 'Your profile card, session, Main Supervisor and Co-Supervisor, and your thesis title with its status.'
Set-Bullet 'The PG Journey card: a progress bar and a visual tracker of the 16 numbered stages plus the PhD-only Step 10b. Completed stages are ticked, your current stage pulses, and gate stages carry a gold G badge.'
Set-Bullet 'A gate card appears when you reach a gate stage (7, 10, 10b for PhD students, 12, 13 or 15). It explains the possible outcomes and what each means for you.'
Set-Bullet 'To move on from this stage: a checklist of what you still need to do, with ticks for items the portal can verify (for example an approved Research Proposal).'
Set-Bullet 'Programme time limit (when switched on by the PGC): months used and months left.'
Set-Bullet 'Announcements, upcoming deadlines, seminars, supervision meetings, action items, monthly check-in and supervisor reviews.'
Set-H2 'Useful buttons'
Set-Bullet 'Add deadlines to calendar downloads deadlines to your calendar.'
Set-Bullet 'My timeline shows everything that has happened on your journey.'
Set-Bullet 'Download my card gives your student card.'
Set-Normal 'My publications records your journal articles, conference papers and other research outputs. My defence clearance shows how far you are from clearance to defend.'
Set-Normal 'My progress report (PDF) and Progress (CSV) download a summary of your stage, documents, submissions and meetings. Print beside a logged supervision meeting prints the meeting minutes.'
Set-Normal 'Check a file tests a Word file against the PG template before you submit. The file is checked privately and then deleted; it is not submitted and nothing is sent to a reviewer.'
Set-Bullet 'To change your passport photo, choose a JPG or PNG under 1 MB in your profile card and press Update Photo.'
Set-H2 'Ask for a stage update'
Set-Bullet 'If your stage is wrong, go to My Journey Stage, choose the stage you are at and add an optional note.'
Set-Bullet 'Press Request stage update. Only one request can wait at a time; the PGC approves or declines it and you are notified.'
Set-H1 '5. Thesis title'
Set-H2 'Enter and confirm your title'
Set-Bullet 'The title box opens once you reach stage 6 (if you are already past it, it is open now).'
Set-Bullet 'Type your full title (10–400 characters) and press Save title. It shows Awaiting confirmation. You can edit and save again; each save returns it to awaiting confirmation.'
Set-Bullet 'Once the PGC confirms it, it is locked until stage 11.'
Set-Bullet 'If it must change earlier, use Need to change the confirmed title? give the new wording and your reason, then Send title change request. If approved, the new wording replaces the old one and stays confirmed.'
Set-H2 'Title approval by supervisors'
Set-Normal 'Stage 4 (Title Approval) uses the approval request described under Requesting approvals below: both supervisors approve your proposed title before you can proceed to proposal submission.'
Set-H1 '6. Submitting documents'
Set-H2 'Submit a document'
Set-Bullet 'Under New Submission (Dashboard or My Submissions) choose the Type. Download the official templates first from Download Templates if needed.'
Set-Bullet 'Upload a PDFor DOCX file (up to 50 MB) or paste a Google Drive file link. Press Submit.'
Set-Bullet 'Not ready? Press Save as draft instead. A draft is private to you and not seen by reviewers.'
Add-Table @(
  @('Format check  For Research Proposal, Progress Report, Final Thesis/Dissertation and Final Correction, Word files get an automatic check: left margin 4.0 cm, other margins 2.5 cm, and in-text citations matched against the reference list. Submit Word (.docx) where you can; PDFs cannot be checked automatically. Use Check a file on the Dashboard to test a Word file before you submit; the file is checked privately and then deleted. Each saved check has a History button. The result shows what was fixed, what remains and any new problems since the previous check; the last six checks are kept.')
)
Set-H2 'Document types and stage rules'
Add-Table @(
  @('Document', 'When it can be submitted'),
  @('Research Proposal', 'Stage 5 (Proposal Submission)'),
  @('Signed Proposal Defence Form', 'Stage 6 (Route A for defence readiness)'),
  @('Progress Report / Progress Presentation (PPTX)', 'Stages 9–10'),
  @('Internal Examiner and Other Observations', 'Before stage 11 (must be submitted before the thesis goes for external examination)'),
  @('Final Thesis/Dissertation', 'Stage 12 (Thesis Submission)'),
  @('External Examiner Comments, Comment-by-Comment Responses, Final Correction', 'From stage 14 (Examiners' + [char]0x2019 + ' Comments)')
)
Set-H2 'Drafts'
Set-Bullet 'Open My Submissions. Drafts show the status Draft and a link to the saved file.'
Set-Bullet 'Press Submit for review when ready. Stage rules and the format check run at this moment, and your supervisors are given access.'
Set-Bullet 'Press Delete to remove a draft. Only drafts can be deleted.'
Set-H2 'Track a submission and resubmit'
Set-Bullet 'My Submissions lists each submission with its status: Submitted, Under Review, Changes Requested, Approved or Rejected, plus Inspector Comments and Supervisor Notes.'
Set-Bullet 'If it is Rejected or Changes Requested, read the numbered comments, fix your document and press Resubmit file (or Use a link). It returns to Submitted.'
Set-Bullet 'Approval of your Research Proposal, Progress Report or Final Thesis moves your stage forward automatically and you are notified.'
Set-H2 'Feedback thread on a submission'
Set-Normal 'Each submission has a Feedback button. It opens a written thread where you, your supervisors and reviewers can comment on that document. Posting a comment notifies the other side. Use it for specific questions about one document; use Messages for general conversation.'
Set-H1 '7. Requesting approvals'
Set-H2 'Approval requests'
Set-Normal 'Several stages need a formal approval before you can move on: Title Approval, Proposal Defence Readiness, Progress Report Presentation and Final Examination.'
Set-Bullet 'Open the relevant card on your dashboard and choose your preferred month; add an optional note.'
Set-Bullet 'Send the request. Your Main and Co-Supervisor each approve (or return it with a reason). For readiness, progress and final examination requests, the PGC then approves.'
Set-Bullet 'Track the status on the card. A Returned request can be corrected and resent; you can Withdraw a request that is still waiting.'
Set-Bullet 'When fully approved, your stage advances and you are notified.'
Add-Table @(
  @('Early requests  If you request before the usual stage, the portal warns you which stage is normal. You can still submit; the PGC will decide.')
)
Set-H1 '8. Working with your supervisors'
Set-H2 'Messages'
Set-Normal 'Replies appear in the same thread.'
Set-Bullet 'Press Message my supervisors on the Dashboard.'
Set-Bullet 'Type a message, optionally attach a PDF, Word, PNG or JPG file (under 5 MB), and press Send. Both supervisors are notified by bell and email.'
Set-H2 'Supervision meetings'
Set-Bullet 'When your supervisor schedules a meeting, you get a notification and an email with a calendar file. It also shows on your Dashboard with date, time and venue; press Add to calendar to download it.'
Set-Bullet 'Before the meeting, press Add my agenda points and list what you want to discuss. Your supervisors are notified.'
Set-Bullet 'After the meeting your supervisor records notes and action points. Read them under Supervision Meetings and press Acknowledge notes.'
Set-Bullet 'A cancelled meeting is shown crossed out and you are notified.'
Set-H2 'Action items'
Set-Normal 'Action items from meetings appear in the Action items card with who owns each one and its due date. Press Mark done on yours when complete. Overdue items are highlighted and you receive reminders. Items owned by your supervisor are shown so you can see what to expect from them.'
Set-H2 'Monthly check-in'
Set-Bullet 'Open the Monthly check-in card.'
Set-Bullet 'Choose On track, Slow or Blocked and add a note (required if slow or blocked).'
Set-Bullet 'Press Send check-in. You can update it during the month. You get a reminder on the 25th if you have not checked in.'
Add-Table @(
  @('Why it matters  Your supervisors are notified when you report Slow or Blocked, and the PGC is told when you report Blocked, so help can reach you early.')
)
Set-H2 'Supervisor progress reviews'
Set-Normal 'Your supervisors periodically record a review with a progress rating (Excellent, Good, Satisfactory, Unsatisfactory) and a recommendation (Continue, Concern, At risk) with comments. You are notified and can read them in the Supervisor progress reviews card.'
Set-H1 '9. Examiners and final stages'
Set-H2 'Examiners'
Set-Normal 'The HoD appoints an Internal Examiner (from another department, stage 9) and an External Examiner (from another university, stage 13). Supervisors cannot be your examiners. Examiner scores are recorded by the department; you receive the examiner' + [char]0x2019 + 's comments and report when available. Appointment letters are printed by the PGC/HoD from the examiner record.'
Set-Normal 'The portal sends automatic reminder emails to examiners with an active appointment, a valid due date and no submitted report: one reminder shortly before the due date (default 3 days), then reminders every 7 days once overdue. The PGC/HoD receive an overdue summary each Monday.'
Set-H2 'Corrections and completion'
Set-Bullet 'At stage 14 upload the External Examiner Comments file, your comment-by-comment response and your final corrected version.'
Set-Bullet 'At stage 15 your supervisors endorse; the Inspector approve the Final Correction.'
Set-Bullet 'At stage 16 submit the signed copies to the PGC. Your journey is then complete.'
Set-H2 'Publications and pre-defence clearance'
Set-Normal 'Your Dashboard has a Publications & defence clearance card. Use My publications to record journal articles, conference papers, book chapters, conference presentations/posters, patents and other outputs. For each item enter the type, status, title, authors, journal or conference, year, peer-reviewed answer, DOI or link, and an optional note.'
Set-Normal 'Your programme requirement is shown at the top of My publications. The counted item is a peer-reviewed Journal article with status Accepted or Published. It must also be verified unless the PGC has switched verification off. PhD students need one by default; MSc students do not, but you can still record all outputs.'
Set-Normal 'You can add, edit and delete your own unverified entries. Editing an entry clears its verification. A verified entry is locked to you; ask the PGC to remove it if it is wrong. Supervisors, the PGC and HoD can verify entries and can print or export a publications report.'
Set-Normal 'Use My defence clearance to see the checklist before the defence. Four items are worked out from portal records: Research proposal approved; Publication requirement met; Thesis / dissertation passes the format check; Internal and external examiners appointed.'
Set-Normal 'The remaining items are ticked by staff: Progress reports up to date; Required seminar presentations completed; Main supervisor sign-off; Co-supervisor sign-off; Fees and bursary clearance; Library clearance. Supervisors can tick only the supervisor sign-off items. The PGC or HoD ticks the rest. When every item is complete, you are notified; the PGC/HoD can print the clearance form.'
Set-H1 '10. Asking questions and making requests'
Set-H2 'Choosing the right channel'
Add-Table @(
  @('Use', 'For'),
  @('Messages', 'Day-to-day conversation with your supervisors'),
  @('Inquiries', 'General questions and requests to the PGC / HoD'),
  @('Requests', 'A formal supervisor change or a stage extension'),
  @('Feedback thread', 'Comments about one specific submission')
)
Set-H2 'Send an inquiry'
Set-Bullet 'Open Inquiries, choose a Category, write a short Subject and your Message (10–2000 characters).'
Set-Bullet 'Optionally attach one file (PDF, Word, PNG or JPG, up to 5 MB) and press Send inquiry.'
Set-Bullet 'When the PGC or HoD replies, the inquiry is marked Closed and you are notified by bell and email. It stays in the list under Closed, where you can read the whole conversation and send a follow-up; a follow-up returns it to Open. New replies appear with a New reply badge and the button changes to Read reply. Opening the reply marks it seen and clears the badge. Press Mark as resolved when a matter is settled without a staff reply.'
Add-Table @(
  @('Limit  You can have at most 10 unresolved inquiries at a time. A closed inquiry cannot be reopened by you; send a new one.')
)
Set-H2 'Make a formal request'
Set-Bullet 'In Requests on the Dashboard choose the Type (supervisor change or stage extension). For a supervisor change, give the reason clearly (at least 10 characters); the PGC/HoD records the reason when the assignment is changed.'
Set-Bullet 'Explain your reason (at least 10 characters) and press Send request.'
Set-Bullet 'The PGC or HoD decides; the decision and note appear in your Requests table.'
Set-H1 '11. Programme calendar'
Set-H2 'Programme Calendar'
Set-Normal 'The Programme Calendar page shows the monthly programme sessions (seminars and defences), deadlines and, where relevant to you, scheduled supervision meetings. Use the month arrows to move around and Today to return to the current month. The PGC publishes and updates the sessions; they can be cancelled or restored.'
Set-Bullet 'Click an event to see its date, time, venue and notes.'
Set-Bullet 'Use the calendar download button to add events to Google Calendar, Outlook or your phone (.ics file).'
Set-H1 '12. Troubleshooting and FAQ'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('I cannot resubmit a document.', 'Only Rejected, Changes Requested or Draft submissions can be resubmitted. Check the status in My Submissions.'),
  @('The portal says my stage rule blocks the submission.', 'Some documents are only accepted at certain stages. See the document table in chapter 6. If your stage is wrong, request a stage update.'),
  @('My Word file shows format problems.', 'Open the formatting result, fix the margins and citations, and resubmit. Left margin must be 4.0 cm and the others 2.5 cm.'),
  @('I did not get the sign-in email.', 'Check spam. Ask the PGC to reset your password; a new one-time password will be sent.'),
  @('My supervisor is not assigned yet.', 'The PGC assigns supervisors at stage 3. Send an Inquiry if you have waited too long.'),
  @('I want to change my supervisor or extend my stage.', 'Use a formal Request (not Messages).'),
  @('Can I check my formatting before submitting?', 'Yes. Use Check a file on the Dashboard. It accepts Word (.docx), is deleted after the check, and creates no submission or draft.'),
  @('What does the format-check History show?', 'It lists the recent checks and compares the latest one with the one before it: fixed, still to fix and new problems.'),
  @('Why has my inquiry moved to Closed?', 'A reply from the PGC or HoD closes the inquiry. Read it under Closed; sending a follow-up returns it to Open.'),
  @('Why did opening the bell not mark everything read?', 'Opening the bell does not mark items read. Use Mark read or Mark all read.')
)
Set-H1 '13. Quick reference'
Set-H2 'Where to find things'
Add-Table @(
  @('I want to…', 'Go to…'),
  @('See my stage and what is next', 'Dashboard → PG Journey and ' + [char]0x201C + 'To move on from this stage' + [char]0x201D),
  @('Upload a document', 'My Submissions → New Submission'),
  @('Message my supervisors', 'Dashboard → Message my supervisors'),
  @('Say how my month is going', 'Dashboard → Monthly check-in'),
  @('Add points to a meeting agenda', 'Dashboard → Supervision Meetings'),
  @('Ask the department a question', 'Inquiries'),
  @('See deadlines and seminars', 'Programme Calendar'),
  @('Change password or email', 'Help & FAQ → My account'),
  @('See my stage and the new PhD step', 'Dashboard → PG Journey; see Step 10b under Steps 10–11'),
  @('Record my publications', 'Dashboard → My publications'),
  @('See my defence clearance', 'Dashboard → My defence clearance'),
  @('Check a Word file before submitting', 'Dashboard → Check a file'),
  @('See format-check history', 'My Submissions → History'),
  @('Download my progress report', 'Dashboard → My progress report (PDF) or Progress (CSV)'),
  @('Print meeting minutes', 'Dashboard → Supervision Meetings → Print'),
  @('Read a reply to an inquiry', 'Inquiries → Closed → Read reply')
)
Save-Doc 'PG_Portal_Guide_Student.docx'

# ============================================================
# PG_Portal_Guide_Supervisor.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Supervisor User Guide'
Set-Normal 'Supervising your postgraduate students in the portal'
Set-Normal 'This guide shows supervisors how to monitor their students, run supervision meetings, give feedback, endorse submissions, record progress reviews and raise concerns, using the My Students dashboard.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the 16-stage/PhD 10b journey, publications and clearance, reports, notifications and security updates)'),
  @('Audience', 'Academic staff acting as Main Supervisor or Co-Supervisor (role: Staff)'),
  @('Portal address', 'The web-app link sent to you by the PG Coordinator'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Your role in the journey'
Set-Bullet 'Step 10b, publications, clearance and reports'
Set-Bullet 'Signing in, passwords and notifications'
Set-Bullet 'The My Students dashboard'
Set-Bullet 'Supervision meetings'
Set-Bullet 'Action items, check-ins and reviews'
Set-Bullet 'Submissions and feedback'
Set-Bullet 'Messages and assignments'
Set-Bullet 'Troubleshooting and quick reference'
Set-H1 '1. Your role in the journey'
Set-H2 'What supervisors do'
Set-Normal 'As Main or Co-Supervisor you guide the student through the 16 numbered stages and the PhD-only Step 10b. The portal asks for your action at specific points and gives you tools to stay in touch with each student.'
Add-Table @(
  @('Stage', 'Your involvement'),
  @('4 Title Approval', 'Both supervisors approve the proposed thesis title.'),
  @('5 Proposal Submission', 'Review the proposal and endorse where the checklist requires it.'),
  @('6 Defence Readiness', 'Approve the readiness request (or sign the Proposal Defence Form).'),
  @('8 Progress Report Intent', 'Approve the request to present the progress report.'),
  @('10b Second Internal Examination (PhD)', 'PhD students sit a second internal examination after the shared first internal examination. The PG Coordinator records the outcome; you can see the student at this stage but do not record the result.'),
  @('11 Final Examination Intent', 'Approve the request for the final examination.'),
  @('12 Thesis Submission', 'Endorse the thesis before the Inspector reviews it.'),
  @('15 Final Compliance', 'Endorse the final corrected copy.')
)
Add-Table @(
  @('Access  You see only students for whom you are Main or Co-Supervisor.')
)
Set-H2 'Stage reference'
Add-Table @(
  @('#', 'Stage', 'What happens', 'Who acts'),
  @('1', 'Admission', 'Registration and university orientation completed.', 'Student, PG Coordinator'),
  @('2', 'Lecture Attendance', 'Required lectures (MSc students only).', 'Student'),
  @('3', 'Supervisor Allocation', 'Main and Co-Supervisor assigned.', 'PG Coordinator / HoD'),
  @('4', 'Title Approval', 'Thesis title submitted and approved by both supervisors.', 'Student, supervisors'),
  @('5', 'Proposal Submission', 'Research Proposal uploaded, format-checked and approved.', 'Student, Inspector, Coordinator'),
  @('6', 'Defence Readiness', 'Signed Proposal Defence Form uploaded, or readiness approved in the system.', 'Student, supervisors, Coordinator'),
  @('7', 'Proposal Defence ◆', 'Defence at the monthly seminar; outcome recorded. Gate.', 'Coordinator'),
  @('8', 'Progress Report Intent', 'Approval to present the progress report.', 'Supervisors, Coordinator'),
  @('9', 'Internal Examiner Assignment', 'An Internal Examiner from another department is appointed.', 'Coordinator / HoD'),
  @('10', 'Progress Presentation ◆', 'Presentation (PPTX) checked and approved — the first internal examination. Satisfactory moves MSc/MPhil students to Step 11; PhD students go to Step 10b. Gate.', 'Student, Coordinator, Inspector'),
  @('10b', 'Second Internal Examination (PhD) ◆', 'PhD students only: the PG Coordinator records the second internal outcome. Passed or Passed with corrections moves the student to Step 11; Not passed keeps the student at Step 10b. Gate.', 'Student, PG Coordinator'),
  @('11', 'Final Examination Intent', 'Approval for the final examination.', 'Supervisors, Coordinator'),
  @('12', 'Thesis Submission ◆', 'Thesis uploaded; format and similarity checks; approval. Gate.', 'Student, Inspector, Coordinator'),
  @('13', 'External Examiner Assignment ◆', 'An External Examiner from another university is appointed. Gate.', 'Coordinator / HoD'),
  @('14', 'Examiners' + [char]0x2019 + ' Comments', 'Examiner comments, comment-by-comment response and final corrections.', 'Student'),
  @('15', 'Final Compliance ◆', 'Supervisors endorse; Inspector and Coordinator approve the final copy. Gate.', 'Supervisors, Inspector, Coordinator'),
  @('16', 'Signed Copies and Completion', 'Signed copies submitted to the PG Coordinator; journey complete.', 'Student, Coordinator')
)
Set-H2 'How Step 10b affects supervision'
Set-Normal 'Step 10b appears in My Students and in the journey timeline for PhD students. It is recorded by the PG Coordinator, not by the supervisor.'
Set-Normal 'If the outcome is Passed or Passed with corrections, the student moves to Step 11. If the outcome is Not passed, the student remains at Step 10b until a successful outcome is recorded.'
Set-H1 '2. Signing in, passwords and notifications'
Set-H2 'Sign in for the first time'
Set-Bullet 'Open the portal link and choose Login.'
Set-Bullet 'Enter your registration number (students) or staff ID (for example ACA1234), then the one-time password sent to you by email or given by the PG Coordinator.'
Set-Bullet 'You are asked to choose a new password. It must be 8–128 characters, contain at least one letter and one number, and must not be your registration number or a common password.'
Add-Table @(
  @('Good to know  After 5 wrong attempts the account is locked for 15 minutes. Your session ends automatically after about 6 hours; just sign in again.')
)
Set-H2 'Forgot your password'
Set-Bullet 'On the sign-in page choose Forgot password? enter your registration number or staff ID and press Email me a code.'
Set-Bullet 'A 6-digit code is sent to the email address on your account. It expires after 30 minutes.'
Set-Bullet 'Enter the code and your new password. You can request a code up to 3 times per hour. If no email arrives, check your spam folder or contact the PG Coordinator.'
Set-Normal 'Note  For privacy, the reset form gives the same reply whether or not the registration number or staff ID exists, so it cannot be used to find registered accounts.'
Set-H2 'Notifications and email settings'
Set-Bullet 'The bell (top right) shows unread updates. Open it to see the history, switch between All and Unread, and mark items read one by one or with Mark all read. Opening the bell does not itself mark anything as read; the list shows the most recent 60 items.'
Set-Normal 'The PG Coordinator or HoD may send group messages to students, their supervisors, or both. These arrive through the bell and/or email.'
Set-Bullet 'Red numbers on menu tabs show how many items are waiting for you.'
Set-Bullet 'On Help & FAQ, set Email notifications to Instant, Daily digest or Off (bell only). Account and security emails are always sent.'
Set-Bullet 'Use the moon icon to switch between light and dark theme, Change password to update your password, and Sign out when you finish, especially on a shared computer.'
Set-Bullet 'Emails come from a no-reply address. Do not reply to them; use Messages or Inquiries in the portal instead.'
Set-H2 'Change your email address'
Set-Bullet 'Open Help & FAQ and find the My account card.'
Set-Bullet 'Type the new address and press Send confirmation code. The 6-digit code goes to the NEW address, so the change only happens if you can open it.'
Set-Bullet 'Enter the code (valid for 30 minutes) and press Confirm new email.'
Add-Table @(
  @('Note  An address that another account already uses is refused. You can request a code up to 3 times per hour.')
)
Set-H1 '3. The My Students dashboard'
Set-H2 'Summary tiles'
Set-Normal 'The top of My Students shows: students supervised, at risk / stalled, awaiting my endorsement (with overdue count), meetings this month and open action items (with overdue count). On the Staff Dashboard, Statistics report (PDF) and Statistics (CSV) produce a report about your own students; Publications opens their recorded outputs; Defence clearance opens their pre-defence checklist.'
Set-Normal 'The statistics PDF is titled My Students — Supervision Statistics. Meetings are those loaded on your dashboard (the 40 most recent).'
Set-Normal 'Print minutes is available on a logged supervision meeting.'
Set-H2 'Needs attention'
Set-Normal 'This list collects what needs you now, each with quick buttons:'
Set-Bullet 'Students stalled for over 90 days, or with no logged meeting for more than 30 days — Schedule meeting or Message.'
Set-Bullet 'Students who reported their month as Slow or Blocked — Reply or Schedule meeting.'
Set-Bullet 'Submissions that were Rejected or sent back with Changes Requested — Feedback.'
Set-Bullet 'Submissions awaiting your endorsement that are due soon or overdue — Endorse or Feedback.'
Set-Bullet 'Approval requests (title, readiness, progress, final examination) waiting for you.'
Set-Bullet 'Your own action items that are overdue — Mark done.'
Set-H2 'The student list'
Set-Normal 'Use the search box and the filters (stage, programme, status) and the sort menu (name, days at stage, longest since contact, needs attention first). Each row shows:'
Set-Bullet 'Status with a coloured dot: green (on track), amber (needs a check-in), red (at risk), grey (completed). Red means stalled, a review marked At risk or a Blocked check-in. Amber means more than 30 days without a logged meeting, a Slow check-in, a Concern review or overdue actions.'
Set-Bullet 'Stage and how many days the student has been at it, last meeting date, the latest check-in and review, and open action items.'
Set-Bullet 'Your role (Main or Co-Supervisor), the other supervisor, and contact details.'
Set-H2 'Row buttons'
Add-Table @(
  @('Button', 'What it does'),
  @('Schedule', 'Schedule a meeting with a calendar invitation.'),
  @('Log meeting', 'Record a meeting that already took place.'),
  @('Messages', 'Open the message thread with the student.'),
  @('Add action', 'Create an action item for the student or yourself.'),
  @('Review', 'Record a structured progress review.'),
  @('Handover', 'Open the supervision history — Date, Role, From, To, Reason and By. Useful for a new supervisor; printable.'),
  @('Timeline', 'See the student' + [char]0x2019 + 's journey timeline.'),
  @('Raise concern', 'Send a confidential concern to the PG Coordinator.')
)
Set-H2 'Capacity and calendar'
Set-Bullet 'My capacity shows your number of students against the recommended maximum (default 8), by programme and stage. It turns amber at the limit and red above it.'
Set-Bullet 'My upcoming calendar lists your scheduled meetings, deadlines, seminars and your own action due dates. Press Download .ics to add them to your calendar.'
Set-H1 '4. Supervision meetings'
Set-H2 'Schedule a meeting'
Set-Bullet 'Press Schedule beside the student.'
Set-Bullet 'Pick one of the Suggested slots (next four weekdays at 10:00 and 14:00) or choose the date and time yourself; add the venue and an optional agenda.'
Set-Bullet 'Press Schedule. The student, you and the other supervisor receive an email with a calendar file.'
Set-H2 'After the meeting'
Set-Bullet 'Under Supervision Meetings (bottom of the page) press Record notes. Enter the notes and action points.'
Set-Bullet 'The student is asked to acknowledge them; you can see who has.'
Set-Bullet 'Use Add action to turn agreed points into tracked action items with a due date.'
Add-Table @(
  @('Students can contribute  Students may add their own agenda points to a scheduled meeting. These appear under the meeting as ' + [char]0x201C + 'Student' + [char]0x2019 + 's agenda' + [char]0x201D + ', and you are notified when they add them.')
)
Set-H2 'Other options'
Set-Bullet 'Cancel a meeting that will not take place; the student is notified.'
Set-Bullet 'Log meeting records a meeting that has already happened.'
Set-Bullet 'When the other supervisor logs a meeting, press Mark seen so both supervisors know it has been read. The Seen by names appear on the meeting.'
Set-H1 '5. Action items, check-ins and reviews'
Set-H2 'Action items'
Set-Bullet 'Press Add action beside the student.'
Set-Bullet 'Write the action, choose who should do it (the student or you) and an optional due date.'
Set-Bullet 'The student is notified when the action is theirs. Anyone can press Mark done on their own items; you can also close a student' + [char]0x2019 + 's item.'
Add-Table @(
  @('Reminders  Overdue items trigger a reminder to the owner every few days. They also appear in your Needs attention list.')
)
Set-H2 'Monthly student check-ins'
Set-Normal 'Students report On track, Slow or Blocked each month with a note. You are notified of Slow or Blocked reports, and the latest check-in shows in the student row.'
Set-H2 'Progress reviews'
Set-Bullet 'Press Review beside the student.'
Set-Bullet 'Enter the period (for example 2025/2026 first semester), choose a progress rating (Excellent, Good, Satisfactory, Unsatisfactory) and a recommendation (Continue, Concern, At risk).'
Set-Bullet 'Add comments (required for Concern or At risk) and press Save review.'
Add-Table @(
  @('Visibility  The student and the PG Coordinator can see the review. If you choose Concern or At risk, the PG Coordinator is alerted.')
)
Set-H2 'Raise a confidential concern'
Set-Bullet 'Press Raise concern beside the student.'
Set-Bullet 'Choose a category (not responding, welfare, academic progress, funding, supervisor relationship, other) and describe the concern.'
Set-Bullet 'Press Send to coordinator.'
Add-Table @(
  @('Confidential  Concerns go only to the PG Coordinator and HoD. The student cannot see them.')
)
Set-H2 'Handover for a new supervisor'
Set-Normal 'When you are assigned to a student who had a previous supervisor, press Handover / History. It shows the current supervisors and the recorded supervision changes with Date, Role, From, To, Reason and By. It also brings together the student' + [char]0x2019 + 's stage and title, open actions, reviews, check-ins, recent meetings and submission notes, so no history is lost. The history can be printed.'
Set-H1 '6. Submissions and feedback'
Set-H2 'Read, comment on and endorse'
Set-Bullet 'Submissions from My Students lists documents with status, files and inspector comments.'
Set-Bullet 'Press Read / Edit to open files in the portal. Word files can be edited in Google Docs.'
Set-Bullet 'Press Feedback to open the written thread for that document; comments notify the student.'
Set-Bullet 'Press Add Note to record a supervisory note the student can see.'
Set-Bullet 'Press Endorse when satisfied. Several inspector checklists require Supervisor endorsement attached, so endorse before the inspector reviews.'
Set-H2 'Reply deadline'
Set-Normal 'Submissions awaiting your endorsement show reply due in N days (default 7) or N days overdue. The PG Coordinator can see feedback that has waited too long. You also receive a reminder email every 3 days until you endorse.'
Set-H2 'Approval requests'
Set-Normal 'Requests for title approval, defence readiness, progress presentation and final examination appear on your dashboard. Open the card and Approve or Return with a reason. The PG Coordinator then acts on those that need it.'
Set-H2 'Publications, clearance and reports'
Set-Normal 'Publications opens the outputs recorded by your assigned students. Verify an entry only after seeing the evidence, such as an acceptance letter, published paper or DOI. Verification can be undone. Verified entries are locked to the student, and you can print or download a CSV publications report.'
Set-Normal 'Defence clearance opens the checklist for your assigned students. Staff can tick only Main supervisor sign-off and Co-supervisor sign-off; the PG Coordinator or HoD ticks the remaining manual items. Automatic items are taken from portal records. When all items are complete the student is notified, and the clearance form can be printed.'
Set-Normal 'Statistics report (PDF) and Statistics (CSV) summarise your own students: student counts, stages, submissions and meeting counts. The PDF is titled My Students — Supervision Statistics; meetings are those loaded on your dashboard (the 40 most recent).'
Set-Normal 'Appointment letters for examiners are printed by the PG Coordinator/HoD from the examiner record. The portal sends automatic reminder emails to examiners with an active Assigned appointment, a valid due date and no submitted report: one reminder shortly before the due date (default 3 days), then reminders every 7 days once overdue. The PG Coordinator/HoD receive an overdue summary each Monday.'
Set-H1 '7. Messages and assignments'
Set-H2 'Message students'
Set-Bullet 'Press Messages beside a student, type, optionally attach a file (under 5 MB) and Send.'
Set-Bullet 'To write to one or all of your students, use the Send Message form and choose One of my assigned students or All my assigned students.'
Set-Bullet 'Insert saved text adds a ready-made or your own text; Save this text keeps one you reuse.'
Set-Normal 'Group messages are sent by the PG Coordinator or HoD, not by supervisors. They can be filtered by session, programme, stage, no progress for 90+ days, no main supervisor and no thesis title, and sent to students, their supervisors, or both. They arrive through the bell and/or email.'
Set-Normal 'Inquiries are handled by the PG Coordinator/HoD rather than supervisors. If you also hold one of those roles, note that sending a reply closes the inquiry; the student sees it under Closed with a New reply badge until they open it, when the button becomes Read reply.'
Set-H2 'When you are assigned or removed'
Set-Normal 'You receive a notification and an email whenever the PG Coordinator assigns you to, or removes you from, a student, with the student' + [char]0x2019 + 's details and the other supervisor. Your Drive access to the student' + [char]0x2019 + 's files is updated automatically. When a supervisor is replaced or removed, the PGC/HoD must enter a reason — shown as Reason for change (required when replacing or removing a supervisor), for example sabbatical, resignation, conflict of interest or student request — and the change is added to the supervision history.'
Set-H1 '8. Troubleshooting and quick reference'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('A student is missing from My Students.', 'You are not assigned to them. Ask the PG Coordinator to check the assignment.'),
  @('I cannot endorse a submission.', 'It may already be endorsed, or its status is not Submitted / Under Review.'),
  @('Why is a student red?', 'Stalled 90+ days, a review marked At risk, or a Blocked check-in. Open the row to see which.'),
  @('Can the student see my concern?', 'No. Concerns are confidential to the PG Coordinator and HoD.'),
  @('I am at capacity.', 'The limit is a recommendation (default 8). The PG Coordinator can change it in the Config tab (SUPERVISOR_MAX_STUDENTS).'),
  @('Who records Step 10b?', 'The PG Coordinator records the PhD second internal outcome. Supervisors can see it but do not record it.'),
  @('Can I see why a supervisor was changed?', 'Yes. Open Handover / History for the dated list of supervisor changes and reasons. It is available to Staff, PG Coordinator and HoD.'),
  @('Can I tick every clearance item?', 'No. Supervisors can tick only Main supervisor sign-off and Co-supervisor sign-off; the PG Coordinator or HoD ticks the remaining manual items.'),
  @('Who sends group messages?', 'The PG Coordinator or HoD. Supervisors receive them when they are included in the audience.'),
  @('Who prints examiner appointment letters?', 'The PG Coordinator or HoD. Supervisors do not print them from the Staff Dashboard.')
)
Set-H2 'Quick reference'
Add-Table @(
  @('I want to…', 'Go to…'),
  @('See who needs attention', 'My Students → Needs attention'),
  @('Schedule a meeting', 'Row button: Schedule'),
  @('Record a review', 'Row button: Review'),
  @('Endorse a document', 'Submissions from My Students → Endorse'),
  @('Flag a worry confidentially', 'Row button: Raise concern'),
  @('Brief a new supervisor', 'Row button: Handover'),
  @('See a PhD student' + [char]0x2019 + 's Step 10b outcome', 'My Students → Journey / Stage'),
  @('See supervisor changes and reasons', 'Row button: Handover / History'),
  @('Verify a student' + [char]0x2019 + 's publication', 'Staff Dashboard → Publications → Verify'),
  @('Open defence clearance', 'Staff Dashboard → Defence clearance'),
  @('Print a clearance form', 'Defence clearance → Print clearance form'),
  @('Generate my supervision statistics', 'Staff Dashboard → Statistics report (PDF) or Statistics (CSV)'),
  @('Print supervision meeting minutes', 'Supervision Meetings → Print minutes')
)
Save-Doc 'PG_Portal_Guide_Supervisor.docx'

# ============================================================
# PG_Portal_Guide_HoD.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Head of Department User Guide'
Set-Normal 'Oversight, approvals and reports'
Set-Normal 'The HoD has read access to student records and takes part in decisions on requests, supervisors and examiners. This guide covers the Overview & Reports page, publications and defence clearance, reports, search and group messages, supervision oversight, approvals, inquiries and the audit trail.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the second internal stage, publications, clearance, reports, search, data quality, group messaging and examiner-reminder updates)'),
  @('Audience', 'Head of Department (role: HoD)'),
  @('Portal address', 'The web-app /exec link sent to you by the PG Coordinator (Google Apps Script deployment). Deploy as Web app (Execute as Me, Access Anyone). Always create a New version on the existing deployment: Deploy → Manage deployments → Edit → Version: New version → Deploy. Never create a new deployment.'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Your role'
Set-Bullet 'Signing in, passwords and notifications'
Set-Bullet 'Overview & Reports'
Set-Bullet 'Publications, clearance and reports'
Set-Bullet 'Search, group messages and data quality'
Set-Bullet 'Decisions and approvals'
Set-Bullet 'Communication, review and audit'
Set-Bullet 'Troubleshooting and quick reference'
Set-H1 '1. Your role'
Set-H2 'What the HoD does'
Set-Normal 'You monitor the whole postgraduate programme, assign supervisors, decide supervisor-change and stage-extension requests, appoint or approve examiners, answer inquiries, verify publications, tick manual defence-clearance items, run searches and data-quality checks, message groups and review submissions and the audit trail. Registrations, adding or removing students, stages, second internal examination outcomes, title confirmation and password resets are handled by the PG Coordinator.'
Set-H2 'Your menu'
Add-Table @(
  @('Menu item', 'Use it for'),
  @('Overview & Reports', 'Statistics, supervision overview, requests, examiners, reports, publications, defence clearance, search, group messages and data quality.'),
  @('Inquiries', 'Student questions you can answer.'),
  @('Programme Calendar', 'Monthly seminars, defences and deadlines.'),
  @('Audit Log', 'Who did what and when.'),
  @('Help & FAQ', 'In-portal how-to and account settings.')
)
Set-H2 'Stage reference'
Add-Table @(
  @('#', 'Stage', 'What happens', 'Who acts'),
  @('1', 'Admission', 'Registration and university orientation completed.', 'Student, PG Coordinator'),
  @('2', 'Lecture Attendance', 'Required lectures (MSc students only).', 'Student'),
  @('3', 'Supervisor Allocation', 'Main and Co-Supervisor assigned.', 'PG Coordinator / HoD'),
  @('4', 'Title Approval', 'Thesis title submitted and approved by both supervisors.', 'Student, supervisors'),
  @('5', 'Proposal Submission', 'Research Proposal uploaded, format-checked and approved.', 'Student, Inspector, Coordinator'),
  @('6', 'Defence Readiness', 'Signed Proposal Defence Form uploaded, or readiness approved in the system.', 'Student, supervisors, Coordinator'),
  @('7', 'Proposal Defence ◆', 'Defence at the monthly seminar; outcome recorded. Gate.', 'Coordinator'),
  @('8', 'Progress Report Intent', 'Approval to present the progress report.', 'Supervisors, Coordinator'),
  @('9', 'Internal Examiner Assignment', 'An Internal Examiner from another department is appointed.', 'Coordinator / HoD'),
  @('10', 'Progress Presentation ◆', 'Presentation (PPTX) checked and approved. Gate.', 'Student, Coordinator, Inspector'),
  @('10b', 'Second Internal Examination (PhD)', 'PhD-only second internal examination. The PG Coordinator records Passed, Passed with corrections or Not passed. Gate.', 'PG Coordinator'),
  @('11', 'Final Examination Intent', 'Approval for the final examination.', 'Supervisors, Coordinator'),
  @('12', 'Thesis Submission ◆', 'Thesis uploaded; format and similarity checks; approval. Gate.', 'Student, Inspector, Coordinator'),
  @('13', 'External Examiner Assignment ◆', 'An External Examiner from another university is appointed. Gate.', 'Coordinator / HoD'),
  @('14', 'Examiners' + [char]0x2019 + ' Comments', 'Examiner comments, comment-by-comment response and final corrections.', 'Student'),
  @('15', 'Final Compliance ◆', 'Supervisors endorse; Inspector and Coordinator approve the final copy. Gate.', 'Supervisors, Inspector, Coordinator'),
  @('16', 'Signed Copies and Completion', 'Signed copies submitted to the PG Coordinator; journey complete.', 'Student, Coordinator')
)
Set-Normal 'Stage 10b is PhD-only. You can see it in a student' + [char]0x2019 + 's journey, but only the PG Coordinator can record the outcome. Passed and Passed with corrections move the student to stage 11 (Final Examination Intent); Not passed keeps the student at 10b.'
Set-H1 '2. Signing in, passwords and notifications'
Set-H2 'Sign in for the first time'
Set-Bullet 'Open the portal link and choose Login.'
Set-Bullet 'Enter your registration number (students) or staff ID (for example ACA1234), then the one-time password sent to you by email or given by the PG Coordinator.'
Set-Bullet 'You are asked to choose a new password. It must be 8–128 characters, contain at least one letter and one number, and must not be your registration number or a common password.'
Add-Table @(
  @('Good to know  After 5 wrong attempts the account is locked for 15 minutes. Your session ends automatically after about 6 hours; just sign in again.')
)
Set-H2 'Forgot your password'
Set-Bullet 'On the sign-in page choose Forgot password?, enter your registration number or staff ID and press Email me a code.'
Set-Bullet 'A 6-digit code is sent to the email address on your account. It expires after 30 minutes.'
Set-Bullet 'Enter the code and your new password. You can request a code up to 3 times per hour. If no email arrives, check your spam folder or contact the PG Coordinator.'
Set-H2 'Notifications and email settings'
Set-Bullet 'The bell (top right) shows unread updates. Opening it shows the history, with All and Unread tabs; use Mark read on an item or Mark all read. Opening the bell no longer marks anything read, and the unread count refreshes while you are signed in.'
Set-Bullet 'Red numbers on menu tabs show how many items are waiting for you.'
Set-Bullet 'On Help & FAQ, set Email notifications to Instant, Daily digest or Off (bell only). Account and security emails are always sent.'
Set-Bullet 'Use the moon icon to switch between light and dark theme, Change password to update your password, and Sign out when you finish, especially on a shared computer.'
Set-Bullet 'Emails come from a no-reply address. Do not reply to them; use Messages or Inquiries in the portal instead.'
Set-H2 'Change your email address'
Set-Bullet 'Open Help & FAQ and find the My account card.'
Set-Bullet 'Type the new address and press Send confirmation code. The 6-digit code goes to the NEW address, so the change only happens if you can open it.'
Set-Bullet 'Enter the code (valid for 30 minutes) and press Confirm new email.'
Add-Table @(
  @('Note  An address that another account already uses is refused. You can request a code up to 3 times per hour.')
)
Set-H1 '3. Overview & Reports'
Set-H2 'Reading the page'
Set-Bullet 'Top cards show total, approved and pending students and total submissions.'
Set-Bullet 'Charts break students down by programme, gender, session and journey stage, and submissions by status.'
Set-Bullet 'All Students lists every student with session, stage, supervisors and thesis title. Buttons open the student' + [char]0x2019 + 's Print record, Messages thread and Journey timeline.'
Set-Normal 'Search students searches name, registration number, supervisor, thesis title, email, stage, programme, specialisation, session and phone number. It shows the first 25 matches; narrow the search if the list is long. Row actions open Print record, Message, Clearance and Supervisors.'
Set-Normal 'Data quality check lists records that need attention: no main supervisor, no title past stage 4, invalid or missing email, phone, gender, specialisation or passport, main and co-supervisor the same, pending registration, duplicate email/phone/name, examiner email or due-date problems, and students with no progress for 90+ days. Print / PDF and Download CSV produce a Data Quality Report.'
Set-Bullet 'Below the tables: Time-limit alerts (once the PG Coordinator switches limits on), Students at risk (no progress for 90 days), Supervisor workload (students per supervisor) and Average days to reach each stage.'
Set-H2 'Supervision overview'
Set-Normal 'The Supervision overview section gives you oversight of how supervision is going:'
Set-Bullet 'Open confidential concerns raised by supervisors, which you can read and Resolve with a note.'
Set-Bullet 'Submissions waiting too long for a supervisor' + [char]0x2019 + 's endorsement, with the supervisor named.'
Set-Bullet 'Students reporting a slow or blocked month in their check-in.'
Set-Bullet 'Latest supervisor reviews marked Concern or At risk.'
Set-Bullet 'Supervisor capacity against the recommended maximum.'
Set-H2 'Examiner workload'
Set-Normal 'The Examiner workload table lists each examiner' + [char]0x2019 + 's open and completed assessments and any overdue ones. Examiners with a due date receive one reminder three days before it is due, then a reminder every seven days once overdue; only assigned assessments with no submission are reminded. On Mondays the PG Coordinator and HoD also get the overdue list by bell and email. Use Appointment letter on an examiner row for a printable letter with reference PHY/PG/EXM/<reg>/<id suffix>, the candidate details, due date, login ID and signature lines.'
Set-H2 'Print the supervisor list and reports'
Set-Bullet 'Press Supervisor List for HoD, choose a session and programme (or All) and press Generate.'
Set-Bullet 'Print it or save it as PDF. It lists S/N, Reg No, Full Names, Programme, Session, Main Supervisor, Co-Supervisor and Title; titles awaiting confirmation are marked.'
Set-Bullet 'Statistics Report (PDF / CSV) opens a chooser: choose a session and programme, then Print / PDF or Download CSV. Export CSV downloads the student list. Examiner & Defence Summary and Graduation List each offer Print / PDF and Download CSV. Print Student Records (bulk) prints a cover page with an index and one A4 record per student; the record includes sections A–E, supervisor history in section C, signature lines and a privately fetched passport. Press Print record on a student row for one record. Supervisor List for HoD still prints the supervisor list.'
Set-H2 'Publications and defence clearance'
Set-Normal 'Open Publications from Overview & Reports to see every student' + [char]0x2019 + 's papers and outputs. Types are Journal article, Conference paper, Book chapter, Conference presentation / poster, Patent and Other; statuses are In preparation, Submitted, Under review, Accepted and Published. Verify an entry only after you have seen the evidence (acceptance letter, published paper or DOI); use Unverify if you need to withdraw confirmation. Any edit by the student clears verification, and a verified publication cannot be deleted by the student. By default, PhD students need one accepted or published peer-reviewed journal article and MSc students need none; the PG Coordinator can change this in Config. Print / PDF and Download CSV produce a Publications Report.'
Set-Normal 'Open Defence clearance from Overview & Reports to see the checklist for each student. Ten items are shown: research proposal approved, publication requirement met, format-check pass, internal and external examiners appointed, progress reports, seminar presentations, main and co-supervisor sign-off, fees/bursary clearance and library clearance. Four are checked automatically from portal records; the PG Coordinator and HoD can tick or undo the manual items. The student is notified when every item is complete. Use Print clearance form for a signed form.'
Set-H1 '4. Decisions and approvals'
Set-H2 'Assign supervisors'
Set-Normal 'Press Assign supervisors beside a student, choose Main and Co-Supervisor (different people); PhD students can also have a Second Co-Supervisor, then save. You are warned if someone already supervises 8 or more students. Replacing or removing a supervisor needs a reason of at least 5 characters (for example, sabbatical, resignation, conflict of interest or student request). The student and supervisors are notified, and History opens the supervision-change record (Date, Role, From, To, Reason, By).'
Set-H2 'Decide requests'
Set-Normal 'In Requests you will see Supervisor change and Stage extension requests. Press Approve or Decline; a note is required to decline. Stage update requests are decided by the PG Coordinator.'
Set-H2 'Examiners'
Set-Normal 'You can appoint Internal or External examiners and record each score and comments. If your department uses HoD approval for examiners, those proposed by the PG Coordinator appear as awaiting HoD approval: press Approve (the examiner and student are notified) or Decline (the PG Coordinator is told to propose another). Internal examiners must be from another department; external ones from another university; supervisors cannot be examiners.'
Set-H2 'Deadlines and seminars'
Set-Normal 'Add Deadline publishes a deadline to students. Seminars lets you schedule a seminar with presenters and record attendance afterwards.'
Set-H1 '5. Communication, review and audit'
Set-H2 'Answer student inquiries'
Set-Normal 'When you reply, the inquiry closes in the same action and the student is notified. The PG Coordinator sees your reply and may also answer. Legacy Answered rows are shown as Closed. The Response time card shows how quickly inquiries get a first reply. Saved replies and attachments work as for the PG Coordinator.'
Set-Bullet 'Open Inquiries. It starts on Open; use the All, Open and Closed filters.'
Set-Bullet 'Press Reply, read the conversation, write your answer and press Send reply.'
Set-Normal 'The student sees a New reply badge and a Read reply button until they open the reply; opening it marks the reply seen and clears the menu badge.'
Set-Bullet 'You can still use Close inquiry when settled, or Reopen for a closed one. A closed inquiry must be reopened before anyone can reply.'
Set-H2 'Announcements and messages'
Set-Normal 'Post Announcement to Students only, Staff only or Every user, with an optional email. Send Message to an individual, all students, all staff or every user. Message a group also lets the PG Coordinator and HoD filter by session, programme, stage, stalled status, no main supervisor or no thesis title, and choose students, their supervisors or both. You can send a portal notification, an email or both; one message covers at most 300 recipients, subjects are 3–150 characters, messages 5–5000, and emails are sent in BCC batches of 50 within the daily mail quota.'
Set-H2 'Submissions and audit trail'
Set-Bullet 'All Submissions & Review Decisions shows every submission, its status, who reviewed it, their comments and the files (read-only for you).'
Set-Bullet 'You are notified when submissions are approved or rejected.'
Set-Bullet 'Audit Log shows who did what and when.'
Set-H1 '6. Troubleshooting and quick reference'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('I cannot change a student' + [char]0x2019 + 's stage.', 'Stage changes are the PG Coordinator' + [char]0x2019 + 's responsibility.'),
  @('Time-limit alerts are empty.', 'They appear only after the PG Coordinator enables time limits.'),
  @('I do not see examiners awaiting approval.', 'HoD approval is only active if EXAMINER_APPROVAL_REQUIRED is set to yes.'),
  @('I need to record a PhD second internal outcome.', 'Only the PG Coordinator can do this at stage 10b. You can view the student' + [char]0x2019 + 's journey.'),
  @('A student says ' + [char]0x201C + 'New reply' + [char]0x201D + ' on an inquiry.', 'A PG Coordinator or HoD reply closed the inquiry and the student has not opened it yet.'),
  @('I cannot send to a selected group.', 'Check the filters and the 300-recipient limit; emails are sent in BCC batches and stop at the daily quota.')
)
Set-H2 'Quick reference'
Add-Table @(
  @('I want to…', 'Go to…'),
  @('See programme statistics', 'Overview & Reports'),
  @('See concerns and overdue feedback', 'Overview & Reports → Supervision overview'),
  @('Decide a request', 'Overview & Reports → Requests'),
  @('Print the supervisor list', 'Supervisor List for HoD'),
  @('Record a PhD 2nd internal outcome', 'Only the PG Coordinator can do this at stage 10b'),
  @('Search for a student', 'Overview & Reports → Search students'),
  @('Message a group', 'Overview & Reports → Message a group'),
  @('Check data quality', 'Overview & Reports → Data quality check'),
  @('Verify publications / clear a student', 'Overview & Reports → Publications / Defence clearance'),
  @('Print student records in bulk', 'Overview & Reports → Print Student Records (bulk)'),
  @('Review what happened', 'Audit Log')
)
Save-Doc 'PG_Portal_Guide_HoD.docx'

# ============================================================
# PG_Portal_Guide_PG_Coordinator.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'PG Coordinator User Guide'
Set-Normal 'Running the postgraduate programme in the portal'
Set-Normal 'The PG Coordinator has the widest access in the portal. This guide covers registration approvals, student and staff management, stages, titles, submissions, examiners, inquiries, publications, defence clearance, reports, search, data quality, group messages, announcements, supervision oversight and system settings.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the second internal stage, publications, clearance, reports, search, data quality, group messaging, bulk locks and public-endpoint security updates)'),
  @('Audience', 'The Postgraduate Coordinator (role: PG_Coordinator)'),
  @('Portal address', 'The web-app /exec link sent to you by the PG Coordinator (Google Apps Script deployment). Deploy as Web app (Execute as Me, Access Anyone). Always create a New version on the existing deployment: Deploy → Manage deployments → Edit → Version: New version → Deploy. Never create a new deployment.'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Your role and menu'
Set-Bullet 'Signing in, passwords and notifications'
Set-Bullet 'Students: registrations and records'
Set-Bullet 'Publications, clearance and reports'
Set-Bullet 'Supervisors, stages and titles'
Set-Bullet 'Submissions and examiners'
Set-Bullet 'Search, messages and data quality'
Set-Bullet 'Supervision oversight'
Set-Bullet 'Communication'
Set-Bullet 'Staff, reports and system settings'
Set-Bullet 'Troubleshooting and quick reference'
Set-H1 '1. Your role and menu'
Set-H2 'What the coordinator does'
Set-Normal 'You admit and manage students, assign supervisors, move students through the 17 stages (including the PhD-only stage 10b), confirm titles, record defence and second internal outcomes, oversee submissions with the inspectors, appoint examiners with the HoD, answer inquiries, verify publications and clearance, run reports, searches and data-quality checks, message groups and keep the programme calendar. You also look after staff logins, reports, backups and settings.'
Set-H2 'Your menu'
Add-Table @(
  @('Menu item', 'Use it for'),
  @('Coordinator', 'Approvals, students, supervisors, stage and title requests, staff, export and backup.'),
  @('Overview & Reports', 'Charts, supervision overview, deadlines, seminars, examiners, requests, reports, publications, defence clearance, search, group messages and data quality.'),
  @('Submissions Review', 'All submissions; approve, reject or assign inspectors.'),
  @('Inquiries', 'Student questions and replies.'),
  @('Programme Calendar', 'Monthly seminars, defences, deadlines.'),
  @('Audit Log', 'Who did what and when.'),
  @('Help & FAQ', 'In-portal how-to and account settings.')
)
Add-Table @(
  @('Red numbers  Red numbers on menu tabs show how many items are waiting for you.')
)
Set-H2 'Stage reference'
Add-Table @(
  @('#', 'Stage', 'What happens', 'Who acts'),
  @('1', 'Admission', 'Registration and university orientation completed.', 'Student, PG Coordinator'),
  @('2', 'Lecture Attendance', 'Required lectures (MSc students only).', 'Student'),
  @('3', 'Supervisor Allocation', 'Main and Co-Supervisor assigned.', 'PG Coordinator / HoD'),
  @('4', 'Title Approval', 'Thesis title submitted and approved by both supervisors.', 'Student, supervisors'),
  @('5', 'Proposal Submission', 'Research Proposal uploaded, format-checked and approved.', 'Student, Inspector, Coordinator'),
  @('6', 'Defence Readiness', 'Signed Proposal Defence Form uploaded, or readiness approved in the system.', 'Student, supervisors, Coordinator'),
  @('7', 'Proposal Defence ◆', 'Defence at the monthly seminar; outcome recorded. Gate.', 'Coordinator'),
  @('8', 'Progress Report Intent', 'Approval to present the progress report.', 'Supervisors, Coordinator'),
  @('9', 'Internal Examiner Assignment', 'An Internal Examiner from another department is appointed.', 'Coordinator / HoD'),
  @('10', 'Progress Presentation ◆', 'Presentation (PPTX) checked and approved. Gate.', 'Student, Coordinator, Inspector'),
  @('10b', 'Second Internal Examination (PhD)', 'PhD-only second internal examination. The PG Coordinator records Passed, Passed with corrections or Not passed. Gate.', 'PG Coordinator'),
  @('11', 'Final Examination Intent', 'Approval for the final examination.', 'Supervisors, Coordinator'),
  @('12', 'Thesis Submission ◆', 'Thesis uploaded; format and similarity checks; approval. Gate.', 'Student, Inspector, Coordinator'),
  @('13', 'External Examiner Assignment ◆', 'An External Examiner from another university is appointed. Gate.', 'Coordinator / HoD'),
  @('14', 'Examiners' + [char]0x2019 + ' Comments', 'Examiner comments, comment-by-comment response and final corrections.', 'Student'),
  @('15', 'Final Compliance ◆', 'Supervisors endorse; Inspector and Coordinator approve the final copy. Gate.', 'Supervisors, Inspector, Coordinator'),
  @('16', 'Signed Copies and Completion', 'Signed copies submitted to the PG Coordinator; journey complete.', 'Student, Coordinator')
)
Set-Normal 'Stage 10b is PhD-only and sits between stage 10 and stage 11. MSc and MPhil students move straight from stage 10 to stage 11. You record the second internal outcome from the student row; a pass moves the student to Final Examination Intent, while Not passed keeps them at 10b.'
Set-H1 '2. Signing in, passwords and notifications'
Set-H2 'Sign in for the first time'
Set-Bullet 'Open the portal link and choose Login.'
Set-Bullet 'Enter your registration number (students) or staff ID (for example ACA1234), then the one-time password sent to you by email or given by the PG Coordinator.'
Set-Bullet 'You are asked to choose a new password. It must be 8–128 characters, contain at least one letter and one number, and must not be your registration number or a common password.'
Add-Table @(
  @('Good to know  After 5 wrong attempts the account is locked for 15 minutes. Your session ends automatically after about 6 hours; just sign in again.')
)
Set-H2 'Forgot your password'
Set-Bullet 'On the sign-in page choose Forgot password?, enter your registration number or staff ID and press Email me a code.'
Set-Bullet 'A 6-digit code is sent to the email address on your account. It expires after 30 minutes.'
Set-Bullet 'Enter the code and your new password. You can request a code up to 3 times per hour. If no email arrives, check your spam folder or contact the PG Coordinator.'
Set-H2 'Notifications and email settings'
Set-Bullet 'The bell (top right) shows unread updates. Opening it shows the history, with All and Unread tabs; use Mark read on an item or Mark all read. Opening the bell no longer marks anything read, and the unread count refreshes while you are signed in.'
Set-Bullet 'Red numbers on menu tabs show how many items are waiting for you.'
Set-Bullet 'On Help & FAQ, set Email notifications to Instant, Daily digest or Off (bell only). Account and security emails are always sent.'
Set-Bullet 'Use the moon icon to switch between light and dark theme, Change password to update your password, and Sign out when you finish, especially on a shared computer.'
Set-Bullet 'Emails come from a no-reply address. Do not reply to them; use Messages or Inquiries in the portal instead.'
Set-H2 'Change your email address'
Set-Bullet 'Open Help & FAQ and find the My account card.'
Set-Bullet 'Type the new address and press Send confirmation code. The 6-digit code goes to the NEW address, so the change only happens if you can open it.'
Set-Bullet 'Enter the code (valid for 30 minutes) and press Confirm new email.'
Add-Table @(
  @('Note  An address that another account already uses is refused. You can request a code up to 3 times per hour.')
)
Set-H1 '3. Students: registrations and records'
Set-H2 'Approve or reject new registrations'
Set-Bullet 'Open Coordinator. Pending Approvals lists new registrations.'
Set-Bullet 'Read the Checks column: it warns about possible duplicates (same phone number or name as another student) and links to the admission letter if attached. On the public Register page, Check Status now also requires the email used to register; if either value does not match, the page says No registration found with that number and email address. Please check both and try again.'
Set-Bullet 'Press Approve, or Reject and give a reason. The student is emailed either way; approvals include a one-time password.'
Add-Table @(
  @('Caution  Approve all pending approves everything waiting in one step. Use it only after checking the list. Bulk approval holds the lock for one student at a time and sends each one-time-password email after the lock is released. If the portal is busy, some registrations are skipped and remain Pending; the result reports them so you can press Approve all again.')
)
Set-Normal 'Public registration, status checks, enquiries and password-reset requests are rate-limited. Registration allows 20 per hour and 60 per day by default; status checks allow 120 per hour globally and 10 per hour for each registration number; enquiries allow 10 per hour and 30 per day globally plus 3 per hour per address; reset requests allow 3 per hour for an ID and 60 per hour globally. Reset replies stay generic so they cannot reveal whether an account exists. If TURNSTILE_SITE_KEY and TURNSTILE_SECRET are set as Script Properties, registration and enquiry also require a Cloudflare Turnstile human check.'
Set-H2 'Add or remove a student'
Set-Bullet 'Add Student registers a student directly. The session is set from the registration number and the student is emailed a one-time password. An email already used by another account is refused.'
Set-Bullet 'Remove deletes the student account and their submissions. It cannot be undone.'
Set-H2 'Import many students from a CSV file'
Set-Bullet 'In Import Students from CSV press Download template and fill it in (Excel can save as CSV).'
Set-Bullet 'Choose the file and press Import.'
Set-Bullet 'Required columns: Reg Number, Surname, First Name, Gender, Phone, Email, Programme, Specialisation. Optional: Other Names, Faculty, Department (blank means Faculty of Physical Sciences / Physics).'
Set-Bullet 'At most 60 students per file. The file is parsed and checked under one short lock; then each account is created under its own short lock and its one-time-password email is sent after that lock is released, so a large import does not block other users. Each valid row creates an approved student and emails a one-time password.'
Set-Bullet 'A summary lists failed rows and why, so you can fix and import only those.'
Set-H2 'Find and filter students'
Set-Normal 'Filter by registration number, first name, last name, session, programme, specialisation, stage or main supervisor, then Apply filters. Clear filters resets. Switch between Cards view and Table view. Search students searches name, registration number, supervisor, thesis title, email, stage, programme, specialisation, session and phone number; it shows the first 25 matches, so narrow the search if needed. Row actions open Print record, Message, Clearance and Supervisors.'
Set-H2 'Reset a student' + [char]0x2019 + 's password'
Set-Normal 'Press Reset PW beside the student. A new one-time password is emailed; if email fails, the page shows it so you can give it to the student. They must choose their own password at next sign-in.'
Set-H1 '4. Supervisors, stages and titles'
Set-H2 'Assign supervisors'
Set-Normal 'The list shows each supervisor' + [char]0x2019 + 's current number of students, and you are warned before assigning someone at or above the recommended maximum. The student and both supervisors are notified, Drive access is updated, and the new supervisor can open Handover to see the student' + [char]0x2019 + 's history.'
Set-Bullet 'Press Assign supervisors beside a student.'
Set-Bullet 'Choose the Main and Co-Supervisor (they must be different people); PhD students can also take a Second Co-Supervisor, then save.'
Set-Normal 'When you replace or remove a Main, Co- or Second Co-Supervisor, enter a reason of at least 5 characters (for example, sabbatical, resignation, conflict of interest or student request); bulk assignments use the reason ' + [char]0x201C + 'Bulk assignment' + [char]0x201D + '. Each change is recorded in Supervision history with Date, Role, From, To, Reason and By, opened with History on the assign form. The printed student record shows that history in section C.'
Set-H2 'Bulk actions'
Set-Bullet 'Tick the box beside each student (cards or table). Select all shown ticks everyone matching the filters; Clear unticks all.'
Set-Bullet 'Set stage changes the stage for everyone selected and notifies each student.'
Set-Bullet 'Assign supervisors sets the Main and/or Co-Supervisor; leave a role on Keep to change only the other. Each supervisor gets one summary email.'
Add-Table @(
  @('Result window  A result window lists any student the action could not be applied to. Bulk assignments use short locks and one summary email per supervisor; emails are sent in BCC batches of 50 and respect the daily mail quota.')
)
Set-H2 'Update stages and handle stage requests'
Set-Bullet 'Change a stage with the Update journey stage drop-down on the student' + [char]0x2019 + 's card or row; the student is notified.'
Set-Bullet 'Stage Update Requests lists students who asked for a change. Approve moves them to the requested stage; Decline needs a reason.'
Set-H2 'Confirm thesis titles'
Set-Bullet 'Titles typed by students show as Awaiting confirmation; you get a notification. Press Confirm title once checked. The student cannot change it before stage 11.'
Set-Bullet 'Title Change Requests shows the current title, the requested title and the reason. Approve replaces the title (it stays confirmed) or Decline with a reason.'
Set-H2 'Record the proposal defence outcome'
Set-Normal 'At stage 7, record the outcome (Passed, Passed with corrections, Not passed). A note is required unless the student passed. Passed and Passed with corrections advance the student to stage 8; Not passed keeps them at stage 7 and notifies them.'
Set-H2 'Record the PhD second internal examination outcome'
Set-Normal 'At stage 10b, PhD students have a second internal examination. Open the student from Overview & Reports or the Coordinator list and press Record 2nd internal. Choose Passed, Passed with corrections or Not passed; a note is required unless the outcome is Passed. Passed and Passed with corrections move the student to stage 11 (Final Examination Intent); Not passed keeps the student at 10b and notifies them. MSc and MPhil students do not enter this stage.'
Set-H2 'Approval requests'
Set-Normal 'Requests for defence readiness, progress presentation and final examination reach you after both supervisors approve. Approve or return them; approval advances the stage.'
Set-H1 '5. Submissions and examiners'
Set-H2 'Review submissions and assign inspectors'
Set-Bullet 'Submissions Review shows all submissions. You can approve, reject or request changes exactly as an inspector (see the Inspector Guide).'
Set-Bullet 'Assign inspector gives a submission to a specific inspector, who is notified. If an inspector declines, you and the HoD are told to reassign.'
Set-Bullet 'Read / Edit opens a submission' + [char]0x2019 + 's files, with edit access to Word documents.'
Set-Bullet 'Use the Feedback thread on a submission for written comments with the student and supervisors.'
Set-H2 'Appoint examiners'
Set-Bullet 'At stage 9 (Internal) or when a thesis is approved (External), open Overview & Reports → Examiners & Defence Scores (or the examiner queue).'
Set-Bullet 'Enter the examiner' + [char]0x2019 + 's name, email, rank and department (and for External: university and a link to the institutional profile page). Set an optional due date.'
Set-Bullet 'Press assign. The examiner receives login details by email and sees only their own assignments.'
Set-Bullet 'Internal examiners must come from a department other than Physics.'
Set-Bullet 'External examiners must be academic staff of another university.'
Set-Bullet 'A supervisor of the student cannot be an examiner. Only one active examiner of each type per student; Revoke an examiner before assigning another (not possible once they have submitted).'
Add-Table @(
  @('Optional HoD approval  If your department wants the HoD to approve examiners, set EXAMINER_APPROVAL_REQUIRED to yes in the Config tab. Examiners then show as awaiting HoD approval and nobody is emailed until the HoD approves.')
)
Set-Normal 'Use Appointment letter on an examiner row to print a formal letter with reference PHY/PG/EXM/<reg>/<id suffix>, the candidate details, thesis or dissertation title, due date, examiner login ID and PG Coordinator/HoD signature lines. It is available for active appointments and is not shown for Proposed, Declined or Revoked rows.'
Set-H2 'Examiner workload'
Set-Normal 'On Overview & Reports, the Examiner workload table lists each examiner with open and completed assessments and any overdue ones, to help you spread the load and chase late assessments. Examiners with a due date receive one reminder three days before it is due, then a reminder every seven days once overdue; only Assigned appointments with no submitted report are reminded. On Mondays you and the HoD also get the overdue list by bell and email, pointing to Examiner & Defence Summary.'
Set-H2 'Publications and defence clearance'
Set-Normal 'Open Publications from Overview & Reports to see every student' + [char]0x2019 + 's papers and outputs. Types are Journal article, Conference paper, Book chapter, Conference presentation / poster, Patent and Other; statuses are In preparation, Submitted, Under review, Accepted and Published. Students add and edit their own entries; any edit clears verification. Verify an entry only after you have seen the evidence (acceptance letter, published paper or DOI), and use Unverify if you need to withdraw confirmation. A verified publication cannot be deleted by the student. By default, PhD students need one accepted or published peer-reviewed journal article and MSc students need none; verified entries count only when PUB_REQUIRE_VERIFIED is yes. Print / PDF and Download CSV produce a Publications Report.'
Set-Normal 'Open Defence clearance from Overview & Reports to see the checklist for each student. Ten items are shown: research proposal approved, publication requirement met, format-check pass, internal and external examiners appointed, progress reports, seminar presentations, main and co-supervisor sign-off, fees/bursary clearance and library clearance. Four are checked automatically from portal records; you and the HoD can tick or undo the manual items. Staff can tick only supervisor sign-off. The student is notified when every item is complete. Use Print clearance form for a signed form.'
Set-H1 '6. Supervision oversight'
Set-H2 'Supervision overview'
Set-Normal 'On Overview & Reports, scroll to Supervision overview. It shows tiles for open concerns, feedback overdue, students reporting slow/blocked months and overdue action items, followed by:'
Set-Bullet 'Confidential concerns raised by supervisors, with category, text and who raised it. Press Resolve and add a resolution note when handled. Students cannot see these.'
Set-Bullet 'Feedback waiting too long — documents awaiting a supervisor' + [char]0x2019 + 's endorsement beyond the reply deadline (default 7 days), with the main supervisor named.'
Set-Bullet 'Slow or blocked students from the monthly check-in, with their notes.'
Set-Bullet 'At-risk reviews — the latest supervisor reviews marked Concern or At risk.'
Set-Bullet 'Supervisor capacity — active students per supervisor against the recommended maximum, flagging those over it.'
Set-H2 'Alerts you receive'
Set-Bullet 'A supervisor raises a concern.'
Set-Bullet 'A supervisor records a review marked Concern or At risk.'
Set-Bullet 'A student reports being Blocked.'
Set-H1 '7. Communication'
Set-H2 'Answer student inquiries'
Set-Bullet 'Open Inquiries. It starts on Open; use the filter buttons for All, Open or Closed. Legacy Answered inquiries appear under Closed.'
Set-Bullet 'Press Reply, read the conversation, type your answer and press Send reply. Your reply closes the inquiry in the same action and the student is notified. The HoD can see and answer it too.'
Set-Bullet 'A closed inquiry shows the reply that closed it. You can still use Close inquiry when settled, or Reopen a closed one. A closed inquiry must be reopened before anyone can reply.'
Set-Normal 'The student sees a New reply badge and a Read reply button until they open the reply; opening it marks the reply seen and clears the menu badge.'
Set-Bullet 'Insert saved text adds a ready-made reply; Save this text keeps your own. You can attach a file (up to 5 MB).'
Set-Bullet 'Forward to supervisor sends the conversation to a supervisor; the student only sees that it was forwarded.'
Set-Bullet 'The Response time card shows average time to first reply, overall and by category.'
Set-H2 'Announcements and messages'
Set-Bullet 'Post Announcement: title and body, audience (Students only, Staff only or Every user), optional email and programme.'
Set-Bullet 'Send Message: Individual, All students, All staff or Every user, with subject and message. Message a group is for targeted groups: filter by session, programme, stage, stalled status (no progress for 90+ days), no main supervisor or no thesis title, or target selected students from Search students. Send to the students, their supervisors or both, by portal notification, email or both. One message covers at most 300 recipients; subjects are 3–150 characters and messages 5–5000. Emails are sent after the lock is released, in BCC batches of 50, and stop at the daily mail quota.'
Set-H2 'Deadlines, seminars and the calendar'
Set-Bullet 'Add Deadline publishes a deadline students see and can add to their calendar.'
Set-Bullet 'Seminars: schedule a seminar with presenters, then use Attendance to record who attended.'
Set-Bullet 'Programme Calendar: add, edit, cancel or restore monthly sessions. Everyone sees the calendar.'
Set-H2 'Requests'
Set-Normal 'Requests lists Supervisor change and Stage extension requests. Approve, or Decline with a note. Stage update requests are decided on the Coordinator page.'
Set-H1 '8. Staff, reports and system settings'
Set-H2 'Manage staff and logins'
Set-Bullet 'Staff List (Supervisors) shows rank and specialisation. Add Staff Member adds a supervisor; Remove takes one off (their students become unassigned). If the removed staff member was a supervisor, each affected student gets a supervision-history entry with the reason ' + [char]0x201C + 'Supervisor record removed from the portal' + [char]0x201D + '.'
Set-Bullet 'Staff Logins & Roles creates or changes a login. The staff ID must look like ACA1234. Roles: Staff, HoD, PG Coordinator, Submission Inspector. The person is emailed an initial password.'
Set-Bullet 'Use the toggle to deactivate or reactivate a login.'
Set-H2 'Reports, export, backup and audit'
Set-Bullet 'Overview & Reports has charts by programme, gender, session, stage and submission status. Statistics Report (PDF / CSV) opens a chooser: choose a session and programme, then Print / PDF or Download CSV; Generate Report has been renamed. Print record replaces the old Print card. Export CSV downloads the student list. Examiner & Defence Summary and Graduation List each produce a printable A4 report and a CSV, filtered by session and programme (and examiner type for the summary). Print Student Records (bulk) prints a cover page with an index and one A4 record per student; the record includes sections A–E, supervisor history in section C, signature lines and a privately fetched passport. Publications opens the Publications Report with Print / PDF and Download CSV. Defence clearance opens the checklist list and Print clearance form. Data quality check lists no supervisor, no title past stage 4, invalid or missing email/phone/gender/specialisation/passport, main = co-supervisor, pending registration, duplicate email/phone/name, examiner email or due-date problems, and stalled students; it also has Print / PDF and Download CSV. Appointment letter is available on an examiner row and Print minutes on a logged supervision meeting. Staff dashboards have Statistics report (PDF) / Statistics (CSV); students have My progress report (PDF) / Progress (CSV).'
Set-Bullet 'Supervisor List for HoD: choose a session and programme, press Generate, then print or save as PDF.'
Set-Bullet 'Export Data (Coordinator page) downloads students and submissions as CSV. CSV downloads use a UTF-8 BOM and formula-safe cells, so accented names and values beginning with =, +, - or @ open correctly in Excel. Back up all data now copies the spreadsheet into the Backups folder.'
Set-Bullet 'Audit Log lists who did what and when.'
Set-H2 'Settings and scheduled jobs (Config tab)'
Set-Normal 'Run installAllTriggers once from the Apps Script editor (or the spreadsheet menu). It schedules the daily reminders, 12:00 coordinator reminders, 13:00 examiner reminders, daily and weekly digests, the 09:00 Monday stalled-supervisor digest, weekly time-limit alert, nightly 02:00 backup and monthly housekeeping, and adds new settings to the Config tab. It is safe to run again; after a schedule change run reinstallAllTriggers instead so the old trigger times are replaced.'
Add-Table @(
  @('Setting', 'Meaning (default)'),
  @('SIMILARITY_LIMIT / REQUIRE_SIMILARITY', 'Allowed similarity percentage (20) and whether a within-limit result is required to approve a thesis (no).'),
  @('EXAMINER_APPROVAL_REQUIRED', 'Whether the HoD must approve examiners (no).'),
  @('ENDORSE_REMIND_DAYS', 'Days between reminders to supervisors who have not endorsed (3).'),
  @('EXAMINER_DUE_SOON_DAYS', 'Days before an examiner assessment is due when the first reminder is sent (3).'),
  @('EXAMINER_REMIND_DAYS', 'Days between reminders once an examiner assessment is overdue (7).'),
  @('NUDGE_DAYS', 'Days between gentle reminders to stalled students (30).'),
  @('TIME_LIMITS_ENABLED, LIMIT_MONTHS_MSc / MPhil / PhD', 'Enter your real limits, then set TIME_LIMITS_ENABLED to yes. Until then no time-limit information is shown.'),
  @('TIME_ALERT_MONTHS', 'Months before the limit at which alerts begin (6).'),
  @('SUPERVISOR_MAX_STUDENTS', 'Recommended maximum students per supervisor (8).'),
  @('FEEDBACK_DAYS', 'Days a supervisor has to reply to a submission before it is flagged overdue (7).'),
  @('PUB_REQUIRED_PHD / PUB_REQUIRED_MSC', 'Number of accepted or published peer-reviewed journal articles required for PhD (1) and MSc (0).'),
  @('PUB_REQUIRE_VERIFIED', 'Whether only verified publications count towards the requirement (yes).'),
  @('Private uploads', 'Passport photos are always private and are served through the portal. Printed student records fetch the thumbnail privately; the old PASSPORT_PRIVACY setting is retained for older sheets but no longer changes anything. Run restrictExistingPassports once to remove old link sharing.'),
  @('REGISTER_HOURLY_MAX / REGISTER_DAILY_MAX', 'Public registration limits per hour (20) and per day (60).'),
  @('ENQUIRY_HOURLY_MAX / ENQUIRY_DAILY_MAX', 'Public enquiry limits per hour (10) and per day (30); each address is also limited to 3 enquiries per hour.')
)
Add-Table @(
  @('Housekeeping  Old audit log rows (24 months) and read notifications (90 days) are tidied automatically every month. Optionally run rotateLegacyDefaultPasswords (try dryRun = true first) to replace the old shared default password on accounts that never changed it, and restrictExistingPassports or lockdownPrivateFiles for older private uploads.')
)
Set-Normal 'Optional abuse protection uses Script Properties, not the Config tab: set TURNSTILE_SITE_KEY and TURNSTILE_SECRET to require Cloudflare Turnstile on registration and enquiry, and set EMBED_ENABLED to no to stop all iframe embedding. Do not put TURNSTILE_SECRET in the Config tab or in this guide.'
Set-H1 '9. Troubleshooting and quick reference'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('A student cannot move to the next stage.', 'Check their approvals: documents Approved, intent requests approved by both supervisors and you. Or set the stage manually.'),
  @('An examiner cannot be assigned.', 'The thesis must be Approved (External), the Internal examiner' + [char]0x2019 + 's department must not be Physics, and the examiner cannot be a supervisor.'),
  @('Reminders are not being sent.', 'Run installAllTriggers and check the Apps Script Triggers list.'),
  @('Time-limit information is missing.', 'Set TIME_LIMITS_ENABLED to yes and enter the real month limits.'),
  @('A PhD student is stuck at stage 10b.', 'Record the second internal examination outcome from the student row. Passed or Passed with corrections moves them to stage 11; Not passed keeps them at 10b.'),
  @('A bulk action skipped students.', 'The portal was busy; the affected students are unchanged. Press the bulk action again.'),
  @('A publication does not count towards clearance.', 'Check that it is a peer-reviewed Journal article with status Accepted or Published, and that it is verified if PUB_REQUIRE_VERIFIED is yes.'),
  @('An examiner has not been reminded.', 'Only Assigned appointments with a valid due date and no submission are reminded; check EXAMINER_REMIND_DAYS, EXAMINER_DUE_SOON_DAYS and the Triggers list.'),
  @('Public registration or enquiry is refused as busy.', 'The public rate limits have been reached. Check REGISTER_HOURLY_MAX / REGISTER_DAILY_MAX and ENQUIRY_HOURLY_MAX / ENQUIRY_DAILY_MAX.')
)
Set-H2 'Quick reference'
Add-Table @(
  @('I want to…', 'Go to…'),
  @('Approve registrations', 'Coordinator → Pending Approvals'),
  @('Assign supervisors', 'Student row → Assign supervisors'),
  @('Record defence outcome', 'Student at stage 7'),
  @('Appoint an examiner', 'Overview & Reports → Examiners'),
  @('Record a 2nd internal outcome', 'Student at stage 10b (PhD)'),
  @('Search for a student', 'Overview & Reports → Search students'),
  @('Message a group', 'Overview & Reports → Message a group'),
  @('Run a data quality check', 'Overview & Reports → Data quality check'),
  @('Verify publications / open clearance', 'Overview & Reports → Publications / Defence clearance'),
  @('Print student records in bulk', 'Overview & Reports → Print Student Records (bulk)'),
  @('Print an examiner appointment letter', 'Overview & Reports → Examiners → Appointment letter'),
  @('See concerns and overdue feedback', 'Overview & Reports → Supervision overview'),
  @('Back up', 'Coordinator → Back up all data now')
)
Save-Doc 'PG_Portal_Guide_PG_Coordinator.docx'

# ============================================================
# PG_Portal_Guide_Examiner.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Examiner User Guide'
Set-Normal 'Receiving and completing an examination assignment'
Set-Normal 'This guide explains how to sign in as an examiner, open your assignment, assess the student and submit your recommendation.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the supervision, journey-tracker, examiner-workload, publications/clearance, reporting and public-security updates)'),
  @('Audience', 'Internal and External Examiners (role: Examiner)'),
  @('Portal address', 'The web-app link sent to you by the Head of Department (HoD)'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator (PGC)')
)
Set-H1 '1. Your role'
Set-Bullet 'Notifications and due dates'
Set-H2 'What examiners do'
Set-Normal 'The HoD appoints you as an Internal Examiner (a member of another department at the University of Abuja, who assesses the progress presentation at the departmental seminar), an Internal (Second) Examiner for a PhD second internal cycle, or an External Examiner (academic staff of another university, who reads and assesses the thesis/dissertation).'
Set-H2 'What you can see'
Set-Bullet 'Only the students assigned to you, and only their name, programme and thesis title.'
Set-Bullet 'External Examiners can open the thesis/dissertation. Internal Examiners do not receive the slides; Internal (Second) Examiners open the second progress report instead.'
Set-Normal 'You cannot open the Publications or Defence clearance screens; those are for students, supervisors, the PG Coordinator and the HoD. The department' + [char]0x2019 + 's pre-defence clearance checklist includes the automatic item ' + [char]0x201C + 'Internal and external examiners appointed' + [char]0x201D + ', but Examiners do not open or tick that checklist.'
Set-H1 '2. Getting your login'
Set-H2 'Appointment email'
Set-Normal 'You receive an email with the portal link, your Login ID (for example EXM0001) and, for a new account, a temporary password. If you already have an examiner account, use your existing password.'
Set-H2 'Sign in'
Set-Bullet 'Open the portal and choose Login.'
Set-Bullet 'Enter your Login ID and password. At first sign-in you are asked to choose a new password (8–128 characters, at least one letter and one number).'
Set-Bullet 'Open My Assignments.'
Add-Table @(
  @('Locked out?  After 5 wrong attempts the account is locked for 15 minutes. Use Forgot password? to get a 6-digit code by email (valid 30 minutes).')
)
Set-H2 'Notifications and due dates'
Set-Bullet 'The bell (top right) shows unread updates. Open it to see the history, switch between All and Unread, and mark items read one by one or with Mark all read. Opening it does not mark anything read.'
Set-Bullet 'Red numbers on menu tabs show how many items are waiting for you.'
Set-Bullet 'Reminder emails are sent automatically to examiners with an active assignment, a valid due date and a valid email address. A due-soon reminder is sent within the last 3 days by default (EXAMINER_DUE_SOON_DAYS); overdue reminders repeat every 7 days by default (EXAMINER_REMIND_DAYS).'
Set-Bullet 'Reminder subjects are ' + [char]0x201C + 'Reminder: examiner assessment for <reg>' + [char]0x201D + ' and ' + [char]0x201C + 'Overdue: examiner assessment for <reg>' + [char]0x201D + '. Submitted, declined and revoked assessments are not reminded.'
Set-H1 '3. Completing an assessment'
Set-H2 'Your assignments'
Set-Normal 'Each assignment card shows the examination type (Internal, Internal (Second) or External), the student, the document, and the due date if one was set. For Internal (Second), the document is labelled ' + [char]0x201C + 'Second Progress Report (PhD second internal cycle)' + [char]0x201D + ' and the button reads Open the second progress report.'
Set-H2 'Open the document'
Set-Bullet 'Press Open the thesis / dissertation on an External assignment card, or Open the second progress report on an Internal (Second) assignment card.'
Set-Bullet 'Read the document in the in-portal reader, or download it. Treat the candidate' + [char]0x2019 + 's work and your assessment as strictly confidential.'
Set-H2 'Submit your assessment'
Set-Bullet 'Enter a score from 0 to 100 for each criterion.'
Set-Bullet 'Choose your Recommendation.'
Set-Bullet 'Write your Comments for the student and the department: strengths, required corrections and any concerns. If you do not provide a report, write at least 30 characters.'
Set-Bullet 'Optionally attach your marked-up report (DOC/DOCX, max 10 MB) or add a link to it (a Google Drive link).'
Set-Bullet 'Provide either comments or a report, then press Submit assessment.'
Add-Table @(
  @('Uploaded reports and assessment files are private in Drive. The portal grants access only where needed; do not replace a private upload with a public link.Final  You cannot edit an assessment after submitting. The average score is calculated and shown with your recommendation.')
)
Set-H2 'Assessment criteria'
Add-Table @(
  @('Examiner', 'Criteria (each scored 0–100)'),
  @('Internal', 'Clarity of research problem and objectives; Progress and results to date; Methodology and analysis; Quality of the presentation; Response to questions'),
  @('Internal (Second)', 'Clarity of research problem and objectives; Progress and results to date; Methodology and analysis; Quality of the presentation; Response to questions'),
  @('External', 'Originality and contribution to knowledge; Literature review; Methodology and rigour; Results, analysis and conclusions; Presentation and referencing')
)
Set-H2 'Recommendations'
Add-Table @(
  @('Examiner', 'Choices'),
  @('Internal', 'Satisfactory; Satisfactory with recommendations; Needs improvement before proceeding; Unsatisfactory'),
  @('Internal (Second)', 'Satisfactory; Satisfactory with recommendations; Needs improvement before proceeding; Unsatisfactory'),
  @('External', 'Accept as submitted; Accept with minor corrections; Major corrections required; Re-examination required; Reject')
)
Set-H1 '4. After you submit'
Set-H2 'What happens next'
Set-Bullet 'The assignment shows your recommendation and average score and is locked.'
Set-Bullet 'The PGC, the HoD and the student' + [char]0x2019 + 's supervisors are notified of your recommendation.'
Set-Bullet 'Your access to the thesis or report in Drive is withdrawn after submission unless an administrator grants continued access.'
Set-Bullet 'For an External Examiner, the student moves on to the Examiners' + [char]0x2019 + ' Comments stage (14) and is told their comments are available.'
Set-H2 'What the department sees (context only)'
Set-Normal 'The following outputs are not available to Examiners; they are shown here only so you know what the department can see from your assessment.'
Set-Normal 'The PG Coordinator or HoD can print an Appointment letter from the examiner record. It is an A4 letter with the University logo and reference PHY/PG/EXM/<reg>/<id suffix>. It lists the candidate, registration number, programme, thesis/dissertation title, main supervisor, due date and login ID, includes a confidentiality clause and signature lines, and is footed ' + [char]0x201C + 'Confidential — examiner appointment' + [char]0x201D + '. An Internal (Second) appointment is headed Internal (Second Cycle).'
Set-Normal 'The PG Coordinator or HoD can open Overview & Reports → Examiner & Defence Summary. It filters by Session, Programme and Examiner type (All types, Internal, Internal (Second), External), with Print / PDF and Download CSV outputs. It includes Active appointments, Assessments completed, Awaiting assessment, Overdue, Average defence score, Highest / lowest and Declined / revoked, plus Score summary by examiner type, Recommendations given, Score distribution (completed assessments), Defence score register, Awaiting assessment and Examiner workload. Declined, revoked and proposed appointments are excluded from the tables. It is marked ' + [char]0x201C + 'Confidential — for the PG Coordinator and Head of Department only' + [char]0x201D + '.'
Set-Normal 'On Mondays the PG Coordinator and HoD also receive an overdue-assessment list pointing to Overview & Reports → Examiner & Defence Summary.'
Set-Normal 'The PG Coordinator records the PhD second internal outcome at stage 10b - Second Internal Examination (PhD); this is not an Examiner action.'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('I cannot open the thesis.', 'Make sure you are signed in with the Login ID from your appointment email or letter. If access is still missing before you submit, contact the PG Coordinator.'),
  @('I need more time.', 'The portal sends automatic reminders when the due date is near and after it passes. Contact the PG Coordinator before the due date if you need more time.'),
  @('Why did I get an assessment reminder?', 'Reminder emails are sent automatically when an assessment is due soon (default: within 3 days) and when it is overdue (default: every 7 days). The subject is ' + [char]0x201C + 'Reminder: examiner assessment for <reg>' + [char]0x201D + ' or ' + [char]0x201C + 'Overdue: examiner assessment for <reg>' + [char]0x201D + '.'),
  @('I want to withdraw.', 'Contact the PG Coordinator, who can revoke the assignment (not possible after you have submitted).'),
  @('What is an Internal (Second) assignment?', 'For a PhD student at stage 10b - Second Internal Examination (PhD), the PG Coordinator opens a second internal cycle. You assess the second progress report using the internal criteria and recommendations.'),
  @('I made a mistake in my scores.', 'Contact the PG Coordinator; submitted assessments are locked.'),
  @('Can I print my appointment letter?', 'No. The PG Coordinator or HoD can print an A4 Appointment letter from the examiner record. It includes the reference PHY/PG/EXM/<reg>/<id suffix>, candidate details, due date and login ID, a confidentiality clause and signature lines. For Internal (Second), it is headed Internal (Second Cycle).'),
  @('Where can I see workload reports?', 'You do not have this report. The PG Coordinator or HoD can open Overview & Reports → Examiner & Defence Summary and print or export examiner appointments, scores and recommendations.')
)
Save-Doc 'PG_Portal_Guide_Examiner.docx'

# ============================================================
# PG_Portal_Guide_Submission_Inspector.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Submission Inspector User Guide'
Set-Normal 'Reviewing and clearing student submissions'
Set-Normal 'This guide explains how to find submissions, read files, run the format check, record similarity results and approve, reject or request changes.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the supervision, journey-tracker, examiner-workload, publications/clearance, reporting and public-security updates)'),
  @('Audience', 'Submission Inspectors (role: Submission_Inspector)'),
  @('Portal address', 'The web-app link sent to you by the PG Coordinator (Google Apps Script deployment)'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Your role'
Set-Bullet 'Signing in, passwords and notifications'
Set-Bullet 'Finding submissions'
Set-Bullet 'Reading and checking files'
Set-Bullet 'Format history and student pre-checks'
Set-Bullet 'Similarity (plagiarism) results'
Set-Bullet 'Decisions'
Set-Bullet 'Troubleshooting and quick reference'
Set-H1 '1. Your role'
Set-H2 'What inspectors do'
Set-Normal 'Inspectors check that student documents meet departmental requirements before they progress. Your clearance is required at several stages: proposal, progress presentation, the PhD-only second internal cycle, thesis (twice in the process: before the plagiarism check and before final submission) and final compliance.'
Set-H2 'Stage reference'
Add-Table @(
  @('#', 'Stage', 'What happens', 'Who acts'),
  @('1', 'Admission', 'Registration and university orientation completed.', 'Student, PG Coordinator'),
  @('2', 'Lecture Attendance', 'Required lectures (MSc students only).', 'Student'),
  @('3', 'Supervisor Allocation', 'Main and Co-Supervisor assigned.', 'PG Coordinator / HoD'),
  @('4', 'Title Approval', 'Thesis title submitted and approved by both supervisors.', 'Student, supervisors'),
  @('5', 'Proposal Submission', 'Research Proposal uploaded, format-checked and approved.', 'Student, Inspector, Coordinator'),
  @('6', 'Defence Readiness', 'Signed Proposal Defence Form uploaded, or readiness approved in the system.', 'Student, supervisors, Coordinator'),
  @('7', 'Proposal Defence ◆', 'Defence at the monthly seminar; outcome recorded. Gate.', 'Coordinator'),
  @('8', 'Progress Report Intent', 'Approval to present the progress report.', 'Supervisors, Coordinator'),
  @('9', 'Internal Examiner Assignment', 'An Internal Examiner from another department is appointed.', 'Coordinator / HoD'),
  @('10', 'Progress Presentation ◆', 'Presentation (PPTX) checked and approved. Gate.', 'Student, Coordinator, Inspector'),
  @('10b', 'Second Internal Examination (PhD) ◆', 'PhD-only second internal cycle; the second progress report is assessed and the PG Coordinator records the outcome. Gate.', 'Student, Internal Examiner, Coordinator'),
  @('11', 'Final Examination Intent', 'Approval for the final examination.', 'Supervisors, Coordinator'),
  @('12', 'Thesis Submission ◆', 'Thesis uploaded; format and similarity checks; approval. Gate.', 'Student, Inspector, Coordinator'),
  @('13', 'External Examiner Assignment ◆', 'An External Examiner from another university is appointed. Gate.', 'Coordinator / HoD'),
  @('14', 'Examiners' + [char]0x2019 + ' Comments', 'Examiner comments, comment-by-comment response and final corrections.', 'Student'),
  @('15', 'Final Compliance ◆', 'Supervisors endorse; Inspector and Coordinator approve the final copy. Gate.', 'Supervisors, Inspector, Coordinator'),
  @('16', 'Signed Copies and Completion', 'Signed copies submitted to the PG Coordinator; journey complete.', 'Student, Coordinator')
)
Set-Normal 'Inspectors do not open or tick the pre-defence clearance checklist. Publications and Defence clearance are for students, supervisors, the PG Coordinator and the HoD; the clearance checklist includes an automatic item ' + [char]0x201C + 'Internal and external examiners appointed' + [char]0x201D + ', but that is department-side record-keeping, not an Inspector action.'
Set-H1 '2. Signing in, passwords and notifications'
Set-H2 'Sign in for the first time'
Set-Bullet 'Open the portal link and choose Login.'
Set-Bullet 'Enter your registration number (students) or staff ID (for example ACA1234), then the one-time password sent to you by email or given by the PG Coordinator.'
Set-Bullet 'You are asked to choose a new password. It must be 8–128 characters, contain at least one letter and one number, and must not be your registration number or a common password.'
Add-Table @(
  @('Good to know  After 5 wrong attempts the account is locked for 15 minutes. Your session ends automatically after about 6 hours; just sign in again.')
)
Set-H2 'Forgot your password'
Set-Bullet 'On the sign-in page choose Forgot password?, enter your registration number or staff ID and press Email me a code.'
Set-Bullet 'A 6-digit code is sent to the email address on your account. It expires after 30 minutes.'
Set-Bullet 'Enter the code and your new password. You can request a code up to 3 times per hour. If no email arrives, check your spam folder or contact the PG Coordinator.'
Set-H2 'Notifications and email settings'
Set-Bullet 'The bell (top right) shows unread updates. Open it to see the history, switch between All and Unread, and mark items read one by one or with Mark all read. Opening it does not mark anything read.'
Set-Bullet 'Red numbers on menu tabs (for example Inquiries, Coordinator or Submissions Review) show how many items are waiting for you.'
Set-Bullet 'On Help & FAQ, set Email notifications to Instant, Daily digest or Off (bell only). Account and security emails are always sent.'
Set-Bullet 'Use the moon icon to switch between light and dark theme, Change password to update your password, and Sign out when you finish, especially on a shared computer.'
Set-Bullet 'Emails come from a no-reply address. Do not reply to them; use Messages or Inquiries in the portal instead.'
Set-H2 'Change your email address'
Set-Bullet 'Open Help & FAQ and find the My account card.'
Set-Bullet 'Type the new address and press Send confirmation code. The 6-digit code goes to the NEW address, so the change only happens if you can open it.'
Set-Bullet 'Enter the code (valid for 30 minutes) and press Confirm new email.'
Add-Table @(
  @('Note  An address that another account already uses is refused. You can request a code up to 3 times per hour.')
)
Set-H1 '3. Finding submissions'
Set-H2 'Submissions Review'
Set-Bullet 'Open Submissions Review.'
Set-Bullet 'Awaiting review lists new and in-progress submissions, oldest first. Each card shows how long it has waited as waiting N day(s); the badge turns red at 7 days or more.'
Set-Bullet 'Reviewed history keeps your past decisions.'
Set-Bullet 'Use the search box to find a submission by student, registration number, document type or status.'
Set-Bullet 'If the PG Coordinator assigned a submission to you, you receive a notification.'
Set-H2 'Decline an assignment'
Set-Normal 'If a submission is assigned to you and you cannot take it, press Decline assignment and give a reason (at least 5 characters). It returns to the PG Coordinator and HoD, who assign another inspector.'
Set-H1 '4. Reading and checking files'
Set-H2 'Read the files'
Set-Normal 'Press Read files to open documents in the in-portal reader (you can also download them). The portal grants you comment access in Drive, not edit access, and uploads remain private. A Feedback thread is available on each submission for written comments with the student and supervisors.'
Set-H2 'Format check'
Set-Normal 'For Research Proposal, Progress Report, Final Thesis/Dissertation and Final Correction, Word files are checked automatically. Press Re-run format check to run it again, or History to compare recent checks.'
Set-Bullet 'The result is Pass or Flagged.'
Set-Bullet 'It checks margins (left 4.0 cm; top, right and bottom 2.5 cm) and compares in-text citations with the reference list.'
Set-Bullet 'PDFs and old .doc files cannot be checked automatically — read them yourself.'
Set-Bullet 'If the department switched on blocking, approval is blocked while must-fix format issues remain; request changes instead. Add issues to comments copies the issues into your comment box. When a non-draft check changes to Flagged, Inspectors are notified.'
Set-H2 'Format check history'
Set-Normal 'History keeps the last six checks. It shows a table of Checked, Result, Must fix and Should fix.'
Set-Normal 'When there are at least two checks, the portal shows ' + [char]0x201C + 'Latest check compared with the one before it' + [char]0x201D + ': Must fix: <prev> → <cur> · Should fix: <prev> → <cur>, with lists headed Fixed, Still to fix and New problems.'
Set-Normal 'A comparison appears once the file has been checked at least twice.'
Set-H2 'Student pre-checks (context only)'
Set-Normal 'Students can use Check a file before submitting for Word (.docx) files. The message in the portal says: ' + [char]0x201C + 'Word (.docx) files only. The file is checked privately and then deleted; it is not submitted.' + [char]0x201D + ' A pre-check creates no submission, draft or notification. If a student shows you a pre-check result, still read the file yourself and run the submission' + [char]0x2019 + 's format check as normal.'
Set-Normal 'A student result may include ' + [char]0x201C + 'Since your previous check (...):' + [char]0x201D + ' with items shown as fixed, still to fix and new. Treat that as context only.'
Set-H1 '5. Similarity (plagiarism) results'
Set-H2 'Record the result'
Set-Bullet 'On proposals, progress reports, theses and final corrections find the Similarity block.'
Set-Bullet 'Enter the percentage from your similarity report and optionally paste the report link.'
Set-Bullet 'Press Record.'
Add-Table @(
  @('Limit  A result above the allowed limit (20% unless the department changed it) is shown in red. If the department switched on the rule, a Final Thesis/Dissertation cannot be approved until a result within the limit is recorded.')
)
Set-H1 '6. Decisions'
Set-H2 'Approve, reject or request changes'
Set-Bullet 'Tick every checklist item for the submission. All must be ticked before you can Approve.'
Set-Bullet 'Use Under Review to show a student you have started.'
Set-Bullet 'To Reject or Request Changes, comments are required. Write one issue per line; the portal numbers them for the student.'
Set-Bullet 'Use Insert saved text for ready-made comments (for example about margins or missing references). Save this text keeps your own snippet.'
Add-Table @(
  @('Effect  Approving a Research Proposal, Progress Presentation (PPTX) or Final Thesis/Dissertation automatically advances the student' + [char]0x2019 + 's stage. For a PhD student, approving the Progress Presentation (PPTX) moves the student to stage 10b - Second Internal Examination (PhD). The student is emailed your decision and comments; the PG Coordinator and HoD are notified.')
)
Set-H2 'Supervisor endorsement'
Set-Normal 'Several checklists include Supervisor endorsement attached. If it is missing, request changes or wait for the supervisor to endorse; the portal reminds supervisors every 3 days.'
Set-H2 'After a resubmission'
Set-Normal 'When a student resubmits, the item returns to Awaiting review with the earlier history kept.'
Set-H2 'Track your work'
Set-Normal 'My reviews per week shows how many submissions you reviewed recently.'
Set-H1 '7. Troubleshooting and quick reference'
Set-H2 'Common questions'
Add-Table @(
  @('Question', 'Answer'),
  @('I cannot approve.', 'Tick every checklist item; check that must-fix format issues are resolved and, for a thesis, that a within-limit similarity result is recorded.'),
  @('I cannot check a PDF automatically.', 'PDFs are not machine-checked. Read them and record your findings in the comments.'),
  @('A file will not open.', 'The student' + [char]0x2019 + 's link may not be shared or may fail the portal' + [char]0x2019 + 's ownership check. A pasted Drive file must be readable by the portal and must be the student' + [char]0x2019 + 's file (the filename starts with their registration number, or the Drive owner matches their registered email). Request changes and ask for a file uploaded through the portal.'),
  @('How do I see what changed between format checks?', 'Format check → History. The last six checks are kept and the latest check is compared with the one before it.'),
  @('The student cannot resubmit.', 'Only Rejected / Changes Requested submissions can be resubmitted. Check the status you set.'),
  @('Why did a format check appear in my notifications?', 'When a non-draft check changes to Flagged, Inspectors are notified. Open the file and compare the latest result with History.')
)
Set-H2 'Quick reference'
Add-Table @(
  @('I want to…', 'Go to…'),
  @('See what is waiting', 'Submissions Review → Awaiting review'),
  @('Find a submission', 'Submissions Review → search by student, reg. no., type or status'),
  @('Open the documents', 'Read files'),
  @('Compare format checks', 'Format check → History'),
  @('Record plagiarism result', 'Similarity block → Record'),
  @('Send corrections back', 'Request Changes with comments'),
  @('Hand a submission back', 'Decline assignment'),
  @('Check why a file will not open', 'Ask for a portal upload; pasted Drive links must belong to the student')
)
Save-Doc 'PG_Portal_Guide_Submission_Inspector.docx'

# ============================================================
# PG_Portal_Guide_Super_Admin.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Super Admin User Guide'
Set-Normal 'Support access, set-up and system administration'
Set-Normal 'The Super Admin supports every other role. This guide explains the Super Admin page, signing in as another user or opening a read-only preview, the audit trail, the scheduled jobs and the one-off set-up and maintenance functions run from the Apps Script editor.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the supervision, journey-tracker, examiner-workload, publications/clearance, reporting and public-security updates)'),
  @('Audience', 'Super Administrators (role: SuperAdmin)'),
  @('Portal address', 'The web-app link sent to you by the PG Coordinator (Google Apps Script deployment)'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Your role'
Set-Bullet 'Read-only previews and reporting'
Set-Bullet 'Signing in as another user'
Set-Bullet 'Audit log'
Set-Bullet 'Set-up and maintenance (Apps Script editor)'
Set-Bullet 'Troubleshooting'
Set-H1 '1. Your role'
Set-H2 'What a Super Admin does'
Set-Normal 'A Super Admin can sign in as any other active, approved user with that user' + [char]0x2019 + 's full access, or open a short read-only preview to see their dashboard without changing data. The Super Admin sees the Programme Calendar and the Audit Log, and is the person who sets up and maintains the portal.'
Set-H2 'Your menu'
Add-Table @(
  @('Menu item', 'Use it for'),
  @('Super Admin', 'Find a user, sign in as them with their full access, or open a read-only preview.'),
  @('Programme Calendar', 'View the monthly programme.'),
  @('Audit Log', 'Review every action, including your own.')
)
Set-H1 '2. Signing in as another user'
Set-H2 'Support sign-in'
Set-Bullet 'Open Super Admin.'
Set-Bullet 'Type a name, ID, email or role in Find a user.'
Set-Bullet 'Press Sign in as beside the user to see the portal exactly as they do, with their full access. Press Preview (read-only) instead when you only need to inspect their dashboard; no sheet row can be changed during a preview.'
Set-Bullet 'When finished, use the banner button to return to Super Admin.'
Add-Table @(
  @('Rules  You cannot sign in as or preview another Super Admin, or an inactive or unapproved account. Full sign-ins are time-limited; read-only previews use a shorter PREVIEW_TTL. No data can be changed during a preview. You cannot start a second sign-in or preview until you return to Super Admin.')
)
Set-H2 'Everything is audited'
Set-Normal 'Every impersonation start and end is written to the Audit Log under your name (for example [SuperAdmin 123 Name] …), as are all actions taken during a full sign-in. A read-only preview is logged separately as PREVIEW_START and PREVIEW_END; it remains auditable even though it cannot change data.'
Set-H1 '3. Audit log'
Set-H2 'Reading the audit log'
Set-Normal 'The Audit Log lists who did what, when and to whom. Newer actions include ADD_PUBLICATION, EDIT_PUBLICATION, DELETE_PUBLICATION, VERIFY_PUBLICATION, UNVERIFY_PUBLICATION, CLEARANCE_TICK, CLEARANCE_UNTICK, GROUP_MESSAGE, IMPORT_STUDENTS, APPROVE_STUDENT, SEND_MESSAGE, PREVIEW_START and PREVIEW_END. Full impersonation actions keep the IMPERSONATE_START / IMPERSONATE_END trail.'
Set-H1 '4. Set-up and maintenance (Apps Script editor)'
Set-H2 'One-off set-up functions'
Add-Table @(
  @('Function', 'Purpose'),
  @('setUp()', 'Creates the sheet tabs and default settings.'),
  @('createSuperAdmin(reg, name, email, password)', 'Creates a Super Admin account.'),
  @('authorizeServices()', 'Grants the Drive, Mail and other permissions the portal needs.'),
  @('importStaff()', 'Imports the staff roster from the Staff tab.'),
  @('installAllTriggers()', 'Installs missing scheduled jobs only; it does not change an existing time or day. Use reinstallAllTriggers() after a trigger schedule change.'),
  @('formatLinkColumns()', 'Makes upload link columns show clickable labels.'),
  @('reinstallAllTriggers()', 'Deletes the portal' + [char]0x2019 + 's own trigger jobs and installs PORTAL_TRIGGERS again. Run this after changing a trigger schedule.')
)
Set-H2 'Optional and go-live functions'
Add-Table @(
  @('Function', 'Purpose'),
  @('rotateLegacyDefaultPasswords(dryRun)', 'Replaces the old shared default password on accounts that never changed it. Try with dryRun = true first.'),
  @('restrictExistingPassports()', 'Legacy clean-up for older uploads. PASSPORT_PRIVACY is no longer read: passport photos are always private and are served through api_getPhotos.'),
  @('removeDemoAccounts(dryRun, withStudents)', 'Removes demo accounts before go-live. Use dryRun first.'),
  @('archiveOldRecords()', 'Moves old audit rows and clears old read notifications (runs monthly).'),
  @('fixAcademicYears()', 'Recalculates student sessions from registration numbers.'),
  @('auditPublicFiles()', 'Reports Drive files that are publicly shared.'),
  @('auditPublicFiles(false)', 'Removes link sharing from public files; does not re-grant access.'),
  @('syncAllSubmissionAccess()', 'Re-grants the correct reader/writer access after link sharing has been removed.'),
  @('lockdownPrivateFiles()', 'Optional clean-up that removes public access from older private uploads.')
)
Add-Table @(
  @('Caution  Run destructive or bulk functions with dryRun = true first and take a backup (Coordinator page → Back up all data now). auditPublicFiles(false) only removes link sharing: always follow it with syncAllSubmissionAccess() when submissions must remain readable.')
)
Set-H2 'Scheduled jobs'
Add-Table @(
  @('Job', 'When', 'What it does'),
  @('sendDeadlineReminders', 'Daily 08:00', 'Reminds students about upcoming deadlines.'),
  @('sendSupervisorReminders', 'Daily 09:00', 'Reminds supervisors of submissions awaiting endorsement.'),
  @('sendStalledNudges', 'Daily 10:00', 'Gentle reminder to stalled students.'),
  @('sendSupervisionReminders', 'Daily 11:00', 'Reminds owners of overdue action items; on the 25th reminds students to do their monthly check-in.'),
  @('sendDailyDigest / sendWeeklyDigest', 'Daily 17:00 / Mondays 07:00', 'Digest emails for users who chose them.'),
  @('sendTimeLimitAlerts', 'Mondays 08:00', 'Time-limit alerts when limits are enabled.'),
  @('autoBackup', 'Daily 02:00', 'Copies the spreadsheet into the Backups folder and keeps BACKUP_KEEP (30) copies.'),
  @('archiveOldRecords', 'Monthly 03:00', 'Housekeeping of audit rows and old read notifications.'),
  @('syncStaffEmails', 'Daily 06:00', 'Keeps staff e-mail addresses aligned between login accounts and the Staff roster.'),
  @('sendCoordinatorReminders', 'Daily 12:00', 'Emails the PG Coordinator and HoD about submissions waiting too long and seminars in the next seven days.'),
  @('sendExaminerReminders', 'Daily 13:00', 'Reminds examiners near or past the due date and sends a Monday overdue summary to the Coordinator and HoD.'),
  @('sendStalledSupervisorDigest', 'Mondays 09:00', 'Sends each supervisor one list of their students with no progress for 90+ days.'),
  @('checkPendingSubmissions', 'Every 10 minutes', 'Runs format compliance for submissions not yet processed (max 5 per run, 4-minute budget).')
)
Set-H2 'Configuration keys'
Set-Normal 'Settings live on the Config tab (key / value). Edit the value, not the key. Key settings are described in the PG Coordinator guide. New in this release: SUPERVISOR_MAX_STUDENTS (default 8) and FEEDBACK_DAYS (default 7).'
Set-Normal 'Script Property traps: DRIVE_FOLDER_ID is defined in Code.gs but is never read; upload folders come from the Config sheet key PASSPORT_FOLDER_ID. TURNSTILE_SECRET and TURNSTILE_SITE_KEY enable the Cloudflare Turnstile human check on public forms. EMBED_ENABLED=no disables iframe framing of the portal. PASSPORT_PRIVACY remains seeded for older sheets but is no longer read: passports are always private and are served through api_getPhotos.'
Set-H2 'Deploying updates'
Set-Bullet 'Open the Apps Script project and replace Code.gs and index.html with the new versions.'
Set-Bullet 'Run reinstallAllTriggers() after any trigger schedule change. installAllTriggers() only adds missing jobs; it cannot change an existing trigger' + [char]0x2019 + 's hour or day.'
Set-Bullet 'Choose Deploy → Manage deployments, edit the web-app deployment and select New version. Keep the access settings unchanged.'
Set-Bullet 'Test with a student, a supervisor and the coordinator (use Sign in as).'
Add-Table @(
  @('New tabs  HEADERS now defines 26 sheet tabs, not the old 23. The Actions, Reviews, Concerns, CheckIns, SubComments, SupervisorHistory, Publications and Clearance tabs are created automatically the first time they are used. New columns: Submissions.formatHistory, Inquiries.studentSeenAt, Examiners.lastRemindedAt and the Meetings.studentAgenda / seenBy columns. New ID prefixes: Sph, Pub, Clr.')
)
Set-H2 'Animated journey image'
Set-Normal 'Apps Script cannot serve the static binaries. On the Cloudflare site the build serves /images/PG_Journey_Animated.svg directly. On the portal, JOURNEY_IMAGE_URL overrides the journey image; leave it empty to use the placeholder card. Do not publish private Drive thumbnails: brand/logo images use data-public-img so the private-photo rewriter leaves them alone.'
Set-H1 '5. Troubleshooting'
Set-H2 'Common situations'
Add-Table @(
  @('Problem', 'What to check'),
  @('A user cannot sign in.', 'Account active and approved? Locked for 15 minutes after 5 failures? Reset the password via the PG Coordinator. On public forms, check TURNSTILE_SECRET / TURNSTILE_SITE_KEY and the registration, status and enquiry rate limits.'),
  @('Emails are not arriving.', 'Run authorizeServices(); check the daily Apps Script mail quota and spam folders.'),
  @('Reminders are not running.', 'Check the Triggers list. If a schedule changed, run reinstallAllTriggers(); installAllTriggers() only adds missing jobs.'),
  @('Drive files will not open.', 'Files are private. Confirm api_getPhotos / api_getSubmissionFiles / api_getFileAccess granted the viewer reader or writer access. Do not fix this by link-sharing the file.'),
  @('The page shows an old version.', 'Create a New version in Manage deployments.'),
  @('Public form says ' + [char]0x201C + 'complete the human check' + [char]0x201D + '.', 'Set TURNSTILE_SITE_KEY and TURNSTILE_SECRET together; the widget is shown only when the site key is set.'),
  @('Registration status asks for the registered email.', 'By design: api_checkRegistrationStatus(regNumber, email) no longer reveals whether a number exists.'),
  @('A static /register/ or /login/ frame will not open.', 'Check EMBED_ENABLED (not no) and confirm the frame used embed=1; embedAllowed_() requires that flag for every framed page, including login.')
)
Save-Doc 'PG_Portal_Guide_Super_Admin.docx'

# ============================================================
# PG_Portal_Developer_Guide.docx
# ============================================================
New-Doc
Set-Normal 'UNIVERSITY OF ABUJA'
Set-Normal 'Department of Physics · Postgraduate Journey Portal'
Set-Title 'Developer Guide'
Set-Normal 'User and technical guide to the PG Journey Portal'
Set-Normal 'This guide describes the system end to end: what each feature does for its users, how it is built, how data is stored, how to deploy, configure, extend, test and operate it. It covers both deploy targets — the Apps Script portal and the static Cloudflare public site — and the single Google Sheet/Drive backend they share.'
Add-Table @(
  @('Document', 'Details'),
  @('Version', 'November 2026 (reflects the portal after the supervision, journey-tracker, examiner-workload, publications/clearance, reporting and public-security updates)'),
  @('Audience', 'Developers, maintainers and technical administrators'),
  @('Portal address', 'The web-app link sent to you by the PG Coordinator (Google Apps Script deployment)'),
  @('Help', 'Help & FAQ page inside the portal, or an Inquiry to the PG Coordinator')
)
Set-H2 'In this guide'
Set-Bullet 'Introduction'
Set-Bullet 'Portal and static-site split'
Set-Bullet 'Architecture'
Set-Bullet 'Code organisation'
Set-Bullet 'Installation and deployment'
Set-Bullet 'Data model'
Set-Bullet 'Backend internals'
Set-Bullet 'Security'
Set-Bullet 'Permission matrix'
Set-Bullet 'Feature reference'
Set-Bullet 'API reference'
Set-Bullet 'Frontend guide'
Set-Bullet 'Scheduled jobs and configuration'
Set-Bullet 'Extending the system'
Set-Bullet 'Testing, operations and troubleshooting'
Set-Bullet 'Appendices'
Set-H1 '1. Introduction'
Set-H2 'Purpose'
Set-Normal 'The PG Journey Portal is a Google Apps Script web application for the University of Abuja Department of Physics. It manages the complete life cycle of a postgraduate student through a 16-stage, 5-phase journey: registration, supervision, title and proposal approval, defence, progress presentation, thesis examination, corrections and completion.'
Set-H2 'Technology at a glance'
Add-Table @(
  @('Layer', 'Technology'),
  @('Runtime', 'Google Apps Script (V8) web app, deployed as ' + [char]0x201C + 'Execute as: Me, Access: Anyone' + [char]0x201D),
  @('Server code', 'Code.gs (single file, ES5-style functions)'),
  @('Client', 'index.html — one HtmlService template that holds all pages, CSS and JavaScript (no build step, no framework)'),
  @('Database', 'One Google Spreadsheet: one tab per table, header row defines the schema'),
  @('Files', 'Google Drive: every upload is private. Photos and files are returned through api_getPhotos, api_getSubmissionFiles and api_getFileAccess, which grant the viewer reader/writer access as appropriate.'),
  @('Sessions and rate limits', 'CacheService (script cache)'),
  @('Concurrency', 'LockService (script lock)'),
  @('Email', 'MailApp with a branded HTML template'),
  @('PDF analysis', 'pdf.js 3.11.174 loaded from cdnjs in the browser'),
  @('Scheduling', 'Time-driven triggers installed by installAllTriggers()'),
  @('Public static site', 'Cloudflare Pages built from project/dist; home and contact are pre-rendered, register and login are in-site iframe wrappers of the live /exec portal.'),
  @('Public bridge', 'JSONP endpoints ?public=announcements, ?public=enquiry and ?public=facdep. The static build exposes only announcements and enquiry.'),
  @('Human check', 'Cloudflare Turnstile via TURNSTILE_SECRET and TURNSTILE_SITE_KEY; optional, enabled only when the secret is set.'),
  @('Iframe policy', 'embedAllowed_() allows ALLOWALL framing for any request with embed=1 (including /login/ and /register/); EMBED_ENABLED=no disables it completely.')
)
Set-H2 'Roles'
Set-Normal 'Seven roles exist: Student, Staff (supervisor), PG_Coordinator, HoD, Submission_Inspector, Examiner and SuperAdmin. Role checks are enforced on the server in every api_* function; SuperAdmin additionally has api_impersonate for full support sign-in and api_previewAsUser for a read-only, write-blocked preview.'
Set-H2 'Feature overview'
Add-Table @(
  @('Area', 'Features'),
  @('Registration and accounts', 'Public registration with passport and admission letter, Turnstile human check, hourly/daily registration caps, status check by reg number plus registered email, coordinator approval with duplicate checks, direct add, CSV import (60 per file, one short lock per account), one-time passwords and rate-limited reset codes.'),
  @('Journey', '17 stages: the 16 numbered stages plus the PhD-only ' + [char]0x201C + '10b' + [char]0x201D + ' inserted stage. Automatic stage advancement on approvals, manual stage updates, student stage-change requests, bulk stage and supervisor actions, visual tracker and gate explainer.'),
  @('Supervision', 'Supervisor assignment with capacity warnings, scheduled/logged meetings with .ics invitations, acknowledgements, student agenda, co-supervisor ' + [char]0x201C + 'seen' + [char]0x201D + ' marks, action items, monthly check-ins, progress reviews, confidential concerns, submission feedback threads, handover summary, health status, filters, calendar.'),
  @('Submissions', 'Typed uploads (up to 50 MB, chunked), drafts, Drive links restricted to files owned/named for the student, in-portal reader, DOCX/PDF format compliance with six-check history and trend comparison, pre-submission Word pre-check, similarity recording, inspector checklists, approve/reject/changes.'),
  @('Approvals', 'Title approval, defence readiness, progress presentation and final-examination requests approved by supervisors then the coordinator.'),
  @('Examination', 'Internal/External examiner appointment (with HoD approval option), examiner login and dashboard, criteria scoring, recommendations, workload table, appointment-letter printout, examiner due-date reminders and confidential Examiner & Defence Score Summary.'),
  @('Communication', 'Messages, inquiries with threads and forwarding, inquiries closed by staff replies with legacy ' + [char]0x201C + 'Answered' + [char]0x201D + ' shown as Closed, ' + [char]0x201C + 'New reply' + [char]0x201D + ' unread badges via api_markInquirySeen, targeted group messaging, announcements, direct messages, bell notifications, email preferences, digests and reminders.'),
  @('Calendar and deadlines', 'Programme sessions, seminars with attendance, deadlines, calendar export.'),
  @('Oversight and operations', 'HoD statistics, supervision overview, time-limit alerts, pipeline, audit log, CSV export, nightly backups, Super Admin impersonation and read-only preview, printable student records, cohort/staff/student statistics, graduation list, data-quality report and global student search.'),
  @('Publications and clearance', 'Student publication register with supervisor/Coordinator verification, programme-specific publication counts, ten-item pre-defence clearance checklist, printable clearance form and publications report.'),
  @('History and print outputs', 'Supervisor change history with reason and approver, format-check history with fixed/remaining/new comparison, meeting minutes, appointment letters and bulk student record printing.')
)
Set-H1 '2. Architecture'
Set-H2 'System overview'
Set-Normal 'The Apps Script portal loads one combined template from doGet(); all later interaction uses google.script.run calls to api_* functions that return JSON. The static Cloudflare site is generated from the same template by tools/build-pg.js: home and contact are pre-rendered, register and login are iframe wrappers of the live /exec deployment, and a small JSONP bridge replaces google.script.run for announcements and enquiry only. Server code reads and writes the spreadsheet through the same Code.gs helpers in both cases.'
Set-Normal '/'
Set-H2 'Request life cycle'
Set-Normal 'Every authenticated call passes a session token as the first argument. The function validates the user, asserts the role, then performs its work. Writes run inside the script lock; lockAcquire_ clears __tables and __idx so stale reads cannot be trusted. Public calls perform Turnstile verification and rate-limit checks before doing work. Bulk mail is collected as res._mail during the lock and sent with finishBulkMail_/sendBcc_ after the lock is released.'
Set-Normal '/'
Set-H2 'Page serving'
Set-Normal 'doGet(e) handles ?public=announcements, ?public=enquiry and ?public=facdep as JSONP, then evaluates index.html with brandJson, initialViewJson, embedJson, initialPageJson and backJson. publicPageName_ allows '''', home, about, programmes, register, contact and login; about/programmes are retained only for old links and coerce to home on the static site. embedAllowed_() applies ALLOWALL framing to any request with embed=1 (including login) and honours EMBED_ENABLED=no.'
Set-H1 '3. Code organisation'
Set-H2 'Files'
Add-Table @(
  @('File', 'Role'),
  @('Code.gs', 'All server logic (8,615 lines, 242 public api_* functions).'),
  @('index.html', 'One Apps Script template holding portal SPA and public views, CSS and client JavaScript (6,285 lines); file name in Apps Script must be exactly index.'),
  @('PG_Journey_Animated.svg', 'Optional animated 16-stage journey image for the home page (generated by a Python script; see Appendix A).'),
  @('tools/build-pg.js', 'Produces project/dist for Cloudflare; VIEWS=["home","contact"], HREFS for /register/ and /login/, PUBLIC_PAGES rewritten to [''home'',''contact''], JSONP bridge for announcements/enquiry only.'),
  @('tools/serve-pg.js', 'Local preview using the same template renderer plus an in-memory mock; PAGES=["","home","register","contact","login"] and no SuperAdmin support.'),
  @('PG_Journey_Infographic.svg', 'Detailed illustrative poster shown directly below the animated image; the animated SVG is illustrative and need not match the 17 portal stage names.')
)
Set-H2 'Code.gs map'
Set-Normal 'Sections are marked with banner comments. Line numbers refer to the current file.'
Add-Table @(
  @('Lines', 'Section', 'Contents'),
  @('15–426', '1. CONFIG', 'Constants, CFG object, HEADERS (26 tabs), LINK_COLUMNS, ID prefixes including Sph/Pub/Clr, brand_() with turnstileSiteKey.'),
  @('427–611', '2. UTILITIES', 'IDs, time, booleans, escaping, cellSafe_, csvCell_, locking with cache invalidation, password hashing, rateLimitHit_, dailyCapHit_, capSetting_, verifyTurnstile_.'),
  @('612–670', '2b. FACULTY / DEPARTMENT LIST', 'University faculty/department list for registration and JSONP facdep feed.'),
  @('671–1019', '3. DATABASE', 'Sheet access layer, readTable cache, link-cell helpers, cached row indexes, audit log, mail helpers, sendBcc_ and finishBulkMail_.'),
  @('1020–1413', '4. AUTH', 'Sessions, login, lockout, impersonation, api_previewAsUser, read-only preview enforcement via assertWritable_, IMPERSONATE_ and PREVIEW_ audit trails.'),
  @('1414–1617', '5. SETUP / SEED', 'setUp, ensureSettings_, NEW_SETTINGS, createSuperAdmin/repairSuperAdmin, Drive folder setup.'),
  @('1618–2137', '6. PUBLIC REGISTRATION', 'Validation with Unicode-aware names, Turnstile, registration caps, photos/admission letters, status check by reg+email, registration JSONP.'),
  @('2138–3130', '7/7b. STAFF, STUDENTS, IMPORT', 'Staff CRUD, direct add, CSV import with short per-account locks, removal, supervisor-history entries on staff removal.'),
  @('3131–3242', '8. SUPERVISOR ASSIGNMENT', 'Assignment with required reason for replacement/removal, supervisor history via supHistoryAdd_, bulk assignment, stage advancement.'),
  @('3243–3313', '9/10. PROFILE AND DASHBOARD', 'Profile/photo update, student payload with publications/clearance/precheck hooks.'),
  @('3314–3604', '11. SUBMISSIONS', 'Create/list/status/drafts/templates; Drive-link ownership checks via assertUploadLinkKind_(type,url,user).'),
  @('3605–3941', '12. COORDINATOR', 'Approvals, group messaging, announcement BCC after lock release, publications tracker and pre-defence clearance endpoints.'),
  @('3942–4082', '12b/13/14. TITLE, HoD, STAFF', 'Title approval, HoD statistics, staff dashboard with report hooks.'),
  @('4083–4201', '15. PUBLIC (NO AUTH)', 'Public faculty/department, announcements, status and enquiry; enquiry Turnstile and rate limits.'),
  @('4202–4623', '15b. EXTRA FEATURES', 'Deadlines, programme calendar, ensureTrigger_, sendDeadlineReminders, seminars, meetings, resets.'),
  @('4624–5162', '15c. RESET, UPLOAD, BELL, MESSAGES, INQUIRIES', 'Password reset with generic response, uploads, notifications, messages, inquiries with Open/Closed, api_markInquirySeen, direct-message BCC after lock.'),
  @('5163–5613', '15d/15d2. SUPERVISOR TOOLS AND PRESENTATION INTENTS', 'Endorsement, requests, messages, intent workflow.'),
  @('5614–6203', '15e/14b. ADVANCED, REMINDERS, TRIGGERS', 'Timeline, digests, backups, examiner reminders, stalled-supervisor digest, coordinator reminders, PORTAL_TRIGGERS, installAllTriggers, reinstallAllTriggers.'),
  @('6204–7041', '16. WEB ENTRY, FILE ACCESS, READER', 'doGet, embedAllowed_, publicPageName_, JSONP entries, private Drive access ordering, format compliance.'),
  @('7042–7133', 'STUDENT SELF-CHECK AND PDF ANALYSIS', 'api_studentFormatCheck trend, browser PDF helpers, approval gate.'),
  @('7134–7344', 'FORMAT AND SUPERVISOR HISTORY', 'formatHistory JSON, nextFormatHistory_, fmtCompare_, trendOf_, api_getFormatHistory, SUP_ROLES_, supHistoryAdd_, api_getSupervisorHistory.'),
  @('7345–8004', '16. EXAMINATION WORKFLOW (v2)', 'Examiner assignment, assessments, due dates, reminders, pipeline, appointment-letter data.'),
  @('8005–8615', '17. SUPERVISION ENHANCEMENTS', 'Actions, check-ins, reviews, concerns, feedback threads, handover, dashboard extras.')
)
Set-H2 'Naming conventions'
Set-Bullet 'api_name — public function callable from the client. Everything else is private by convention.'
Set-Bullet 'Trailing underscore (name_) — internal helper that the client cannot call (Apps Script hides these from google.script.run).'
Set-Bullet 'api_name_l / api_name_locked_ — the implementation that runs under the script lock; api_name is a one-line wrapper return L_(api_name_l, arguments);.'
Set-Bullet 'api_nameBase_ — an original implementation that a newer api_name wraps to add fields (used for the staff, student and HoD dashboards).'
Set-Bullet 'Sheet, column and role names are case-sensitive strings.'
Set-H1 '4. Installation and deployment'
Set-H2 'Prerequisites'
Set-Bullet 'A Google account (a Workspace account is recommended for higher mail and Drive limits).'
Set-Bullet 'A Google Spreadsheet to act as the database and a Drive folder for files.'
Set-Bullet 'Optional: Node and clasp if you prefer local development.'
Set-H2 'First-time setup'
Set-Bullet 'Create a standalone or container-bound Apps Script project and add Code.gs and an HTML file named exactly index (index.html).'
Set-Bullet 'Set Script Properties: SPREADSHEET_ID, DRIVE_FOLDER_ID and optionally SCHOOL_NAME, SCHOOL_LOGO_URL, CBS_LOGO_URL, FOOTER_TEXT, HERO_IMAGE_URL, JOURNEY_IMAGE_URL. Defaults for the sheet and folder IDs are hard-coded at the top of Code.gs; replace them with your own.'
Set-Bullet 'Run setUp() once. It creates all tabs with headers and seeds default settings.'
Set-Bullet 'Run createSuperAdmin(regNumber, fullName, email, password) to create the first administrator.'
Set-Bullet 'Run authorizeServices() and accept the OAuth consent screen (Drive, Mail, Spreadsheet, external requests).'
Set-Bullet 'Run installAllTriggers() to schedule reminders, digests, backup and housekeeping.'
Set-Bullet 'Choose Deploy → New deployment → Web app, set Execute as: Me and Who has access: Anyone, and copy the URL.'
Set-Bullet 'Sign in as the Super Admin, create the PG Coordinator login in the Coordinator page (Staff Logins & Roles), then import staff and students.'
Set-H2 'Updating a live deployment'
Set-Bullet 'Paste the new Code.gs and index.html.'
Set-Bullet 'Run installAllTriggers() if scheduled jobs changed (it only adds missing triggers).'
Set-Bullet 'Choose Deploy → Manage deployments → Edit → New version. Without a new version, the public URL keeps serving the old code.'
Set-Bullet 'New tabs and columns appear automatically (see Schema evolution below). Run a smoke test as each role using Sign in as.'
Set-H2 'Optional go-live tasks'
Set-Bullet 'rotateLegacyDefaultPasswords(true) then false to replace the shared default password on untouched accounts.'
Set-Bullet 'removeDemoAccounts(true) then false to remove demo users.'
Set-Bullet 'Set PASSPORT_PRIVACY = private and run restrictExistingPassports().'
Set-Bullet 'Enter real time limits and set TIME_LIMITS_ENABLED = yes.'
Set-H1 '5. Data model'
Set-H2 'Spreadsheet as database'
Set-Normal 'Each tab is a table. Row 1 holds field names; HEADERS in Code.gs defines 26 tabs and the authoritative column order. Reads produce objects keyed by header name, but writes are made in header order, so do not rename, reorder casually or remove a column without changing HEADERS and the live sheet together. getSheet_ creates a missing known tab and sheetHeaders_ appends missing columns.'
Set-H2 'Relationships'
Set-Normal 'Tables are linked by value, not by foreign-key constraints, so the code is responsible for keeping them consistent (for example removeStudent also deletes the student' + [char]0x2019 + 's submissions).'
Add-Table @(
  @('From', 'To', 'Key'),
  @('Users', 'Students', 'regNumber'),
  @('Staff', 'Students', 'mainSupervisorId, coSupervisorId = Staff id'),
  @('Students', 'Submissions, Meetings, Actions, Reviews, Concerns, CheckIns, Examiners, PresentationIntents, Requests, Inquiries', 'regNumber'),
  @('Submissions', 'SubComments, Examiners (external)', 'submissionId'),
  @('Users', 'Notifications, Templates', 'regNumber / owner'),
  @('Users (Examiner)', 'Examiners', 'examLogin = Users regNumber (EXM####)'),
  @('Staff', 'SupervisorHistory', 'fromId / toId = Staff id'),
  @('Submissions', 'formatHistory', 'stored as JSON on the Submissions row'),
  @('Students', 'Publications, Clearance, SupervisorHistory', 'regNumber')
)
Set-H2 'Schema evolution'
Set-Normal 'getSheet_ creates a known tab if it is missing, and sheetHeaders_ appends any column defined in HEADERS that the sheet lacks. To add a field, add its name to the table' + [char]0x2019 + 's HEADERS entry and start using it; existing sheets are upgraded the first time the table is read.'
Add-Table @(
  @('Rule  Never rename a column in the sheet without changing HEADERS, because a renamed column looks like a missing one and an empty duplicate is created.')
)
Set-H2 'Data dictionary'
Add-Table @(
  @('Table', 'Purpose', 'Columns'),
  @('Users', 'Login accounts for every role (hashed password, role, status, email preference).', 'id, regNumber, email, passwordHash, salt, role, fullName, firstLogin, active, status, createdAt, emailPref'),
  @('Students', 'One row per student: profile, supervisors, stage, thesis title, file columns, timestamps.', 'id, regNumber, surname, firstName, otherNames, gender, phoneNumber, email, faculty, department, programme, specialisation, passportFileId, passportUrl, mainSupervisorId, coSupervisorId, currentStage, yearOfAdmission, createdAt, updatedAt, thesisTitle, titleStatus, titleConfirmedBy, titleConfirmedAt, titleUpdatedAt, admissionLetterUrl, lastNudgeAt, File - Research Plan Form, File - Seminar Presentation, File - Research Proposal, File - Progress Report, File - Final Thesis or Dissertation, File - Internal Examiner Observations, File - Final Correction, File - Response to External Examiner, File - Response to Internal Examiner, Latest Upload Date, Latest Upload Type'),
  @('Staff', 'Supervisor/staff roster (separate from login accounts).', 'id, fullName, email, rank, specialisation, active, createdAt, role'),
  @('Submissions', 'Documents submitted by students, with status, checklist, compliance, similarity, history and format-check history.', 'id, regNumber, type, driveFileUrls, status, inspectorComments, supervisorNotes, createdBy, createdAt, updatedAt, reviewedBy, reviewedAt, checklist, endorsedBy, assignedTo, history, compliance, similarity, similarityUrl, similarityBy, similarityAt, lastRemindedAt, formatHistory'),
  @('Announcements', 'Announcements and their audience.', 'id, title, body, active, createdBy, createdAt, audience'),
  @('Config', 'Key/value runtime settings (edited in the sheet).', 'key, value, updatedAt'),
  @('Meetings', 'Supervision meetings: scheduled or logged, notes, acknowledgement, student agenda, seen-by.', 'id, regNumber, date, notes, actions, createdBy, createdAt, time, venue, status, ackAt, studentAgenda, seenBy'),
  @('Deadlines', 'Published deadlines.', 'id, title, date, createdBy, createdAt'),
  @('Notifications', 'In-portal bell notifications.', 'id, regNumber, text, read, createdAt'),
  @('Messages', 'Supervisor–student message threads.', 'id, regNumber, fromName, fromRole, text, createdAt, readBy'),
  @('Templates', 'Saved reply and comment snippets per user.', 'id, owner, kind, title, body, createdAt'),
  @('Inquiries', 'Student inquiries with a JSON thread; staff replies close the ticket and students get an unread badge.', 'id, regNumber, subject, category, status, thread, createdAt, updatedAt, lastBy, closedBy, closedAt, studentSeenAt'),
  @('Requests', 'Formal requests (supervisor change, stage extension, title change, stage change).', 'id, regNumber, type, reason, status, decisionNote, createdAt, decidedBy, decidedAt'),
  @('Seminars', 'Departmental seminars and attendance.', 'id, title, date, venue, presenters, attendees, createdBy, createdAt'),
  @('ProgrammeSessions', 'Monthly programme calendar sessions.', 'id, month, kind, title, date, startTime, endTime, venue, notes, status, createdBy, createdAt, updatedAt'),
  @('Actions', 'Action items with owner, due date and status (new).', 'id, regNumber, text, owner, ownerName, ownerReg, dueDate, status, meetingId, createdBy, createdAt, doneAt, lastRemindedAt'),
  @('Reviews', 'Supervisor progress reviews (new).', 'id, regNumber, period, rating, recommendation, comments, createdBy, createdAt'),
  @('Concerns', 'Confidential concerns raised by supervisors (new).', 'id, regNumber, category, text, status, createdBy, createdByReg, createdAt, resolvedBy, resolvedAt, note'),
  @('CheckIns', 'Monthly student check-ins (new).', 'id, regNumber, month, status, note, createdAt'),
  @('SubComments', 'Feedback thread comments per submission (new).', 'id, submissionId, regNumber, byName, byRole, text, createdAt'),
  @('AuditLog', 'Append-only action log.', 'id, at, actorId, actorUsername, action, target, detail'),
  @('PresentationIntents', 'Approval requests: title, defence readiness, progress presentation, final examination.', 'id, regNumber, kind, preferredMonth, note, status, mainStatus, mainBy, mainAt, mainNote, coStatus, coBy, coAt, coNote, coordinatorStatus, coordinatorBy, coordinatorAt, coordinatorNote, stageApplied, history, createdAt, updatedAt, title'),
  @('Examiners', 'Internal/External examiner appointments and assessments, including reminder state.', 'id, regNumber, examinerName, type, email, score, comments, status, createdAt, submissionId, institution, department, rank, examLogin, assignedBy, dueDate, recommendation, scores, reportUrl, submittedAt, profileUrl, revokedAt, revokedBy, revokedByReg, replacedById, replacesId, extendedAccess, extendedBy, extendedByReg, extendedAt, extendedNote, extendedEndedAt, extendedEndedBy, lastRemindedAt'),
  @('SupervisorHistory', 'Audit-style log of supervisor assignment changes, with reason and approver.', 'id, regNumber, role, fromId, fromName, toId, toName, reason, changedBy, changedAt'),
  @('Publications', 'Student publication record used by pre-defence clearance.', 'id, regNumber, type, title, authors, venue, year, status, peerReviewed, doi, url, note, createdAt, updatedAt, verifiedBy, verifiedAt'),
  @('Clearance', 'Saved manual ticks for the pre-defence checklist; automatic items are derived from other tables.', 'id, regNumber, items, updatedAt, updatedBy')
)
Set-H2 'Conventions'
Set-Bullet 'Booleans are stored as TRUE/FALSE and read with toBool_.'
Set-Bullet 'Timestamps are yyyy-MM-ddTHH:mm:ss in the script time zone (nowIso_); dates are yyyy-MM-dd.'
Set-Bullet 'cellSafe_ prefixes values that start with =, +, - or @ with an apostrophe to prevent spreadsheet formula injection, and keeps leading zeros on phone numbers.'
Set-Bullet 'JSON columns hold serialised JSON: Inquiries.thread, Submissions.history, Submissions.compliance, Submissions.formatHistory, Examiners.scores and Clearance.items.'
Set-Bullet 'Stage names are the strings in CFG.JOURNEY_STAGES (' + [char]0x201C + '7 - Proposal Defence' + [char]0x201D + '); the shorthand S_ maps names to constants. Use stageIdx_ to compare stages.'
Set-H1 '6. Backend internals'
Set-H2 'Data-access layer'
Add-Table @(
  @('Helper', 'Behaviour'),
  @('readTable_(name)', 'Reads a whole tab into an array of objects (with _row), cached in __tables for the rest of the execution.'),
  @('findWhere_, filterWhere_, findById_', 'In-memory search on the cached table.'),
  @('appendRow_(name, obj)', 'Assigns an ID if the table has a prefix, writes cells in header order, sets link cells, invalidates the cache. Runs under the lock.'),
  @('updateRow_(name, id, patch) / updateRowByField_', 'Finds the row by key and writes only the patched columns.'),
  @('readTableTail_(name, n)', 'Reads only the last n rows (used for large log tables).'),
  @('removeWhere_, deleteRow_', 'Row deletion helpers.'),
  @('logAudit_', 'Appends to AuditLog; never throws.'),
  @('getSetting_, setSetting_', 'Read/write the Config tab.')
)
Set-H2 'Concurrency'
Set-Normal 'Apps Script runs executions in parallel, so any read-check-write must be serialised. withScriptLock_(fn, timeoutMs) acquires the script lock (re-entrant via a depth counter), clears __tables and __idx on acquisition, runs fn and releases the lock. Bulk jobs must not hold the lock across the whole batch: import, bulk approval and bulk mail use short per-item locks and send mail after release.'
Set-Normal 'function api_doThing_l(token, id, text) {'
Set-Normal 'var user = requireUser_(token); assertRole_(user, [''Staff''], ''You cannot do that.'');'
Set-Normal '/* validate, read, write, notify, audit */'
Set-Normal 'return { ok: true };'
Set-Normal '}'
Set-Normal 'function api_doThing() { return L_(api_doThing_l, arguments); }'
Set-H2 'Wrappers for extending payloads'
Set-Normal 'The dashboards were extended without editing the original functions: api_getStaffDashboard, api_getStudentDashboard and api_getHoDStats call their ...Base_ original, then merge extra fields inside a try/catch, so an error in an extra never breaks the page.'
Set-H2 'Stage engine'
Set-Bullet 'advanceStageTo_(stu, target, why) moves a student forward only (never backwards), writes updatedAt, logs AUTO_STAGE and calls stageEntered_ for side effects such as notifying the coordinator to assign an examiner.'
Set-Bullet 'STAGE_ON_APPROVAL maps an approved submission type to the stage the student moves to; presentation intents carry their own target stage (PRESENTATION_INTENTS).'
Set-Bullet 'Manual changes use api_updateStudentStage and bulk variants (coordinator only).'
Set-Bullet 'isStalled_(student) is true for a student not updated for more than 90 days and not complete.'
Set-H2 'Notifications and email'
Set-Bullet 'addNote_(reg, text) creates a bell notification.'
Set-Bullet 'notifyStudent_(reg, subject, text) adds a bell note and emails the student if their preference is instant.'
Set-Bullet 'notifyCoordinators_ and notifyHoDs_ notify all active holders of those roles.'
Set-Bullet 'sendPortalMail_(opts) wraps MailApp with the branded footer, reply-to, quota check and optional attachments; it returns false (not an exception) when the daily quota is exhausted.'
Set-Bullet 'Email preferences (instant, digest, off) are stored on the user (api_setEmailPref); sendDailyDigest mails users on digest, and off leaves only bell notifications and account/security emails.'
Set-H2 'Validation helpers'
Set-Bullet 'validateRegNumber_, validateStaffId_ (three letters + 3–4 digits), validateEmail_, validatePhone_ (Nigerian mobile), validateName_, toTitleCase_.'
Set-Bullet 'cleanText_(value, min, max, label) (supervision module) trims and enforces length with a clear message.'
Set-Bullet 'assertStrongPassword_ enforces 8–128 characters, a letter and a number, and rejects the registration number and common passwords.'
Set-H2 'Files and Drive'
Set-Bullet 'Passport photos (up to 1 MB) and admission letters (3 MB) are saved in the configured folder. Every upload is private; passportPrivate_() always returns true and PASSPORT_PRIVACY is no longer read. api_getPhotos, api_getSubmissionFiles and api_getFileAccess find the owning row, apply that section' + [char]0x2019 + 's access rule and grant the viewer reader/writer access with grantFileRole_. New upload paths must call lockFile_, never setSharing(ANYONE_WITH_LINK).'
Set-Bullet 'Submissions up to SMALL_UPLOAD_BYTES (10 MB) use api_uploadSubmissionFile; larger files use api_beginLargeUpload, which opens a Drive resumable-upload session, then api_uploadLargeChunk for each piece (base64, in multiples of 256 KB, in sequence, session state in CacheService for 6 hours), up to 50 MB.'
Set-Bullet 'grantFileRole_ and revokeFileEmails_ give or remove reader/commenter/editor access for supervisors, inspectors, coordinators and examiners as roles change.'
Set-Bullet 'Examiners get reader access only to the external thesis, removed when they submit or are revoked.'
Set-H1 '7. Security'
Set-H2 'Authentication and sessions'
Set-Bullet 'Login is by registration number or staff ID. hashPassword_ stores pbkdf2$<iterations>$<hex> using a HASH_ITERATIONS-round HMAC-SHA256 loop. verifyPassword_ also accepts the legacy single SHA-256 hex and api_login re-hashes old rows in place via needsRehash_. hashCode_ and safeEqual_ are used for e-mail/OTP codes; hashPassword_ is deliberately never used for those short codes.'
Set-Bullet 'A successful login creates a random token stored in CacheService (sess_<token>), valid 6 hours (SESSION_TTL_SECONDS). The client keeps it in sessionStorage (pgs_token).'
Set-Bullet 'A per-user session epoch (ue_<userId>) is compared on every request; bumpSessionEpoch_ on password change, deactivation or role change invalidates existing sessions immediately.'
Set-Bullet 'After 5 failed attempts (LOGIN_MAX_FAILURES) the login key is locked for 15 minutes (LOGIN_LOCKOUT_SECONDS).'
Set-Bullet 'First login forces a password change; temporary passwords are random (genTempPassword_).'
Set-Bullet 'Password reset and e-mail change use 6-digit codes with expiry (30 minutes), a per-ID hourly limit and a global rateLimitHit_(''reset_hour'', 60, 3600) cap. api_requestReset returns the same neutral message whether or not the account exists; account state and mail failures are logged, not revealed to the caller.'
Set-H2 'Authorisation'
Set-Bullet 'Every endpoint calls requireUser_(token) and then assertRole_ or an object-level check (threadStudent_, supOf_, meetingAccess_, subCommentAccess_).'
Set-Bullet 'Object-level checks matter: a Staff user may only act on students for whom they are Main or Co-Supervisor; a Student only on their own records; an Examiner only on their own assignments.'
Set-Bullet 'Examiners never receive passport, admission letter or supervisor data; isRestrictedType_ hides restricted submission types from staff payloads.'
Set-Bullet 'Confidential concerns are readable only through supervisionOverview_ (coordinator and HoD).'
Set-H2 'Impersonation'
Set-Normal 'api_impersonate lets a SuperAdmin obtain a one-hour full-access session as another active, approved, non-SuperAdmin user. api_previewAsUser opens a shorter PREVIEW_TTL session with readOnly=true; every write helper refuses it through assertWritable_. Both sessions store actorId, and both end with a separate audit action: IMPERSONATE_END or PREVIEW_END.'
Set-H2 'Input and output safety'
Set-Bullet 'The client escapes all dynamic text with esc() before inserting HTML, including attribute values. linkify() now escapes the URL itself as well as adding rel="noopener noreferrer", and the build' + [char]0x2019 + 's check-escape.js scanner fails on unescaped interpolations written to innerHTML, outerHTML or insertAdjacentHTML.'
Set-Bullet 'Spreadsheet formula injection is prevented by cellSafe_.'
Set-Bullet 'Attachment links are private Drive files served through api_getFileAccess. Pasted links are checked with assertUploadLinkKind_(type, url, user): every Drive URL must be a real readable file whose name starts with the student' + [char]0x2019 + 's normalised registration number or whose Google owner equals the student' + [char]0x2019 + 's registered email. api_precheckFile uses the same ownership rule and trashes the uploaded Word file in a finally block.'
Set-Bullet 'Public JSONP endpoints accept only whitelisted public values and validate parameters.'
Set-Bullet 'Uploads are type- and size-checked on both client and server.'
Set-Normal 'Public abuse protection: verifyTurnstile_(token) posts to https://challenges.cloudflare.com/turnstile/v0/siteverify when TURNSTILE_SECRET is set; TURNSTILE_SITE_KEY is exposed through brand_.turnstileSiteKey and mounts widgets in #ts-reg and #ts-enq. rateLimitHit_ uses CacheService fixed windows; dailyCapHit_ uses Script Properties because CacheService cannot hold a 24-hour value. Registration, status, enquiry and reset requests are capped. Framing is gated by embedAllowed_(), which requires embed=1 for every framed page (including login) and honours EMBED_ENABLED=no.'
Set-H2 'Known weaknesses and recommendations'
Add-Table @(
  @('Item', 'Risk', 'Recommendation'),
  @('Password hashing', 'Historical single-round SHA-256 rows are accepted only for legacy accounts and re-hashed on login.', 'Keep HASH_ITERATIONS high, restrict the sheet to administrators and rely on api_login needsRehash_ to upgrade old rows.'),
  @('CFG.DEFAULT_PASSWORD constant and legacy shared passwords', 'Untouched accounts share a known password.', 'Run rotateLegacyDefaultPasswords, then remove the constant.'),
  @('Hard-coded spreadsheet and folder IDs', 'Wrong environment on copy; IDs in source.', 'Rely on Script Properties and remove the defaults.'),
  @('Sessions in CacheService', 'Cache can be evicted early, signing users out.', 'Acceptable; tell users to sign in again. Move to a signed-token scheme if needed.'),
  @('Web app access ' + [char]0x201C + 'Anyone' + [char]0x201D, 'Public surface for all endpoints.', 'Keep strict role checks; consider Workspace domain-only access if all users are on the domain.'),
  @('Public unauthenticated forms', 'Registration, status, enquiry and reset can be abused.', 'Keep Turnstile enabled and tune REGISTER_HOURLY_MAX/DAILY_MAX, ENQUIRY_HOURLY_MAX/DAILY_MAX and the status/reset caps.'),
  @('Pasted Drive links', 'A requester can paste someone else' + [char]0x2019 + 's file ID into a thread.', 'Passport/admission/examiner files are decided before inquiry/message text in api_getFileAccess; assertDriveFileBelongsTo_ checks name prefix or owner email for pasted links.'),
  @('Iframe framing', 'Apps Script can only choose DEFAULT or ALLOWALL.', 'embedAllowed_() allows framing for any embed request, including login; EMBED_ENABLED=no disables it.')
)
Set-H1 '8. Permission matrix'
Set-H2 'Who can do what'
Add-Table @(
  @('Capability', 'Stu', 'Sup', 'Coord', 'HoD', 'Insp', 'Exam', 'SA'),
  @('Register / submit documents / requests', '✓', '', '', '', '', '', ''),
  @('Approve registrations, add/import/remove students', '', '', '✓', '', '', '', ''),
  @('Assign supervisors', '', '', '✓', '✓', '', '', ''),
  @('Change stages (manual, bulk)', '', '', '✓', '', '', '', ''),
  @('Endorse submissions, approve intents (supervisor step)', '', '✓', '', '', '', '', ''),
  @('Approve intents (coordinator step), record defence outcome', '', '', '✓', '', '', '', ''),
  @('Approve / reject / request changes on submissions', '', '', '✓', '', '✓', '', ''),
  @('Record similarity', '', '', '✓', '', '✓', '', ''),
  @('Assign / revoke examiners', '', '', '✓', '✓', '', '', ''),
  @('Approve examiner (when required)', '', '', '', '✓', '', '', ''),
  @('Submit examiner assessment', '', '', '', '', '', '✓', ''),
  @('Schedule/log meetings, actions, reviews, concerns', '', '✓', '✓*', '', '', '', ''),
  @('Resolve concerns, view supervision overview', '', '', '✓', '✓', '', '', ''),
  @('Monthly check-in, agenda points, acknowledge notes', '✓', '', '', '', '', '', ''),
  @('Read statistics and pipeline', '', '', '✓', '✓', '', '', ''),
  @('Export data, back up', '', '', '✓', '', '', '', ''),
  @('Audit log', '', '', '✓', '✓', '', '', '✓'),
  @('Staff logins and roles', '', '', '✓', '', '', '', ''),
  @('Sign in as another user', '', '', '', '', '', '', '✓'),
  @('Preview (read-only)', '', '', '', '', '', '', '✓'),
  @('Record/view own publications', '✓', '✓*', '✓', '✓', '', '', ''),
  @('Verify publications', '', '', '✓', '✓', '✓', '', ''),
  @('View/update pre-defence clearance', '✓ view', '✓ supervisor items', '✓', '✓', '', '', ''),
  @('Pre-check a Word file before submitting', '✓', '', '', '', '', '', ''),
  @('View format-check history', '✓ own', '✓ own students', '✓', '✓', '✓', '', ''),
  @('View supervisor change history', '', '✓ own students', '✓', '✓', '', '', ''),
  @('Send a targeted group message', '', '', '✓', '✓', '', '', ''),
  @('Mark inquiry reply as seen', '✓', '', '', '', '', '', ''),
  @('Download statistics / print reports', '✓ own', '✓ own students', '✓', '✓', '', '', '')
)
Add-Table @(
  @('* The coordinator can perform supervisor actions on any student; a supervisor only on their own. Supervisors see publications and clearance only for students they supervise; Coordinator/HoD see all.')
)
Set-H1 '9. Feature reference'
Set-H2 'Registration and onboarding'
Set-Normal 'User: a prospective student registers, uploads a photo and optional admission letter, completes the Turnstile human check when configured, and checks status by registration number plus the registered email. Technical: api_register verifies Turnstile, applies REGISTER_HOURLY_MAX/REGISTER_DAILY_MAX, then runs under the lock; api_checkRegistrationStatus(regNumber, email) applies status caps and returns Not Found unless both values match.'
Set-H2 'Student journey and tracker'
Set-Normal 'User: the dashboard shows a tracker of 17 stages — the 16 numbered stages plus the inserted PhD-only ' + [char]0x201C + '10b' + [char]0x201D + ' stage — the checklist for the current stage and a gate explainer. Technical: Code.gs CFG.JOURNEY_STAGES, S_ aliases and STAGE_ON_APPROVAL are authoritative; the client arrays JOURNEY_STAGES, STAGE_REQS, JT_PHASES and JT_GATES must agree with them. The animated SVG is illustrative only.'
Set-H2 'Submissions and compliance'
Set-Normal 'User: upload or link a document, run a private pre-submission Word format check, track review and compare later format checks with earlier ones. Technical: api_createSubmission/submitDraft/resubmit/replace call assertUploadLinkKind_(type,url,user), api_precheckFile checks ownership and trashes the file, and api_savePdfCheck/processCompliance_ write Submissions.formatHistory through nextFormatHistory_.'
Set-H2 'Approval requests (presentation intents)'
Set-Normal 'User: a student requests approval for title, defence readiness, progress presentation or final examination; supervisors approve, then the coordinator. Technical: one row in PresentationIntents with mainStatus, coStatus and coordinatorStatus, a history JSON and stageApplied. api_decidePresentationIntent (staff) and api_decidePresentationIntentCoordinator advance the overall status and, when complete, call advanceStageTo_. Early requests are allowed with a warning (PRESENTATION_INTENTS[kind].warn).'
Set-H2 'Examination workflow'
Set-Normal 'User: the coordinator or HoD appoints an Internal Examiner (another department) and External Examiner (another university); examiners sign in and assess. Technical: api_assignExaminer validates department/institution/email rules, creates or reuses an Examiner login (EXM####), grants file access and sends credentials. api_submitExaminerAssessment averages criterion scores, stores them as JSON, notifies coordinators, HoDs and supervisors, revokes file access and advances the student to stage 14 for external examiners. ASSESSMENT_CRITERIA, RECOMMENDATIONS and INTERNAL_RECS define the forms. The client' + [char]0x2019 + 's examinerWorkloadCard aggregates examiners from api_getHoDStats.'
Set-H2 'Meetings and supervision enhancements'
Add-Table @(
  @('Feature', 'Implementation'),
  @('Scheduled meetings with .ics', 'api_scheduleMeeting writes a Meetings row (status Scheduled) and emails an .ics blob built by meetingIcs_. api_completeMeeting records notes (status Logged); api_ackMeeting stamps ackAt.'),
  @('Student agenda; co-supervisor seen', 'api_saveMeetingAgenda (Meetings.studentAgenda) and api_markMeetingSeen (Meetings.seenBy).'),
  @('Action items', 'Actions table; api_addAction, api_completeAction; overdue computed as status=Open and dueDate<today; sendSupervisionReminders re-notifies every 3 days.'),
  @('Monthly check-in', 'CheckIns, one row per student per month (update replaces); Slow/Blocked notify supervisors, Blocked also notifies coordinators.'),
  @('Progress reviews', 'Reviews; recommendation Concern/At risk alerts coordinators.'),
  @('Confidential concerns', 'Concerns; created by Staff/Coordinator, resolved by Coordinator/HoD, never included in student or staff payloads.'),
  @('Feedback threads', 'SubComments keyed by submissionId; access via subCommentAccess_.'),
  @('Health status', 'studentHealth_: red = stalled, review At risk or check-in Blocked; amber = no meeting >30 days, Slow, Concern or overdue actions; else green; completed students are grey.'),
  @('Handover', 'api_getHandover composes student summary, last 15 logged meetings, open actions, reviews, check-ins and submissions.'),
  @('Publications and verificationPublications table; PUB_TYPES_, PUB_STATUSES_, pubRequired_, pubCounts_; endpoints api_listPublications, api_savePublication, api_deletePublication and api_verifyPublication. Any edit clears verifiedBy/verifiedAt, and a verified publication cannot be deleted by the student.Pre-defence clearanceCLEARANCE_ITEMS_ has 10 items. Auto items are proposal, publications, format and examiners; manual items are progress, seminar, main/co supervisor sign-off, fees and library. api_listClearance, api_getClearance and api_setClearanceItem save manual ticks; completion sends Defence clearance complete.Format and supervisor historySubmissions.formatHistory stores the last six checks; trendOf_ powers ' + [char]0x201C + 'Since your previous check' + [char]0x201D + '. SupervisorHistory records role, from/to, reason and changer for assignment changes and staff removal.Examiner and stalled-supervisor reminderssendExaminerReminders at 13:00 and Mondays overdue summary; sendStalledSupervisorDigest Mondays 09:00. Settings are EXAMINER_REMIND_DAYS, EXAMINER_DUE_SOON_DAYS and Examiners.lastRemindedAt.Capacity and supervision overview', 'SUPERVISOR_MAX_STUDENTS; supervisionOverview_ aggregates concerns, overdue feedback (FEEDBACK_DAYS), flagged check-ins, at-risk reviews and capacity.')
)
Set-H2 'Messaging, inquiries and announcements'
Set-Normal 'Messages are per-student threads readable by the student, supervisors, Coordinator and HoD (canThread_). Inquiries store a JSON thread and now use Open/Closed: a Coordinator/HoD reply closes the ticket in the same write, legacy Answered rows display as Closed, student follow-ups reopen it, and api_markInquirySeen clears the ' + [char]0x201C + 'New reply' + [char]0x201D + ' badge. api_addAnnouncement and api_sendDirectMessage return _mail and are sent after lock release through finishBulkMail_/sendBcc_. api_sendGroupMessage filters by session, programme, stage, stalled, no-supervisor, no-title or explicit regs and caps recipients at GROUP_MESSAGE_MAX_=300.'
Set-H2 'Calendar, seminars and deadlines'
Set-Normal 'ProgrammeSessions are seeded on first load (seedProgrammeSessions_, start month from PROGRAMME_START_MONTH). api_getProgrammeCalendar returns sessions, deadlines, seminars and, per role, meetings. Deadline reminders go out 7 and 1 days before (sendDeadlineReminders). The client builds .ics files from the same data.'
Set-H2 'Reporting, export and backup'
Set-Normal 'api_getHoDStats computes counts by programme, gender, session, stage and status, workload, time alerts, graduation and average stage durations. Client-side report builders produce printable A4 PDFs via window.print() and CSV downloads with BOM and csvCell_ formula protection: Postgraduate Statistics Report, My Students — Supervision Statistics, Postgraduate Progress Report, Examiner & Defence Score Summary, Graduation List, Data Quality Report, Publications Report, Pre-Defence Clearance Form, Supervision Change History, Student Record Form, bulk Student Records, appointment letters and meeting minutes. api_exportData also uses csvCell_. autoBackup runs nightly at 02:00 and keeps 30 copies.'
Set-H2 'Time limits'
Set-Normal 'timeInfo_ returns months elapsed and left from the session start when TIME_LIMITS_ENABLED=yes and LIMIT_MONTHS_<programme> are set; sendTimeLimitAlerts emails coordinators and HoDs weekly about students within TIME_ALERT_MONTHS of the limit.'
Set-H1 '10. API reference'
Set-H2 'How to read this chapter'
Set-Normal 'There are 242 public api_* functions.'
Add-Table @(
  @('Errors  Functions signal problems with throw new Error(message). google.script.run delivers the message to the client' + [char]0x2019 + 's failure handler, which setError shows to the user. Write messages for end users. Public abuse-protection errors must not reveal whether an account exists: api_requestReset always returns the same neutral message, and api_checkRegistrationStatus requires both regNumber and email.')
)
Set-H2 'Authentication and accounts (15)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_login', 'regNumber, password', 'public', ''),
  @('api_logout', '—', 'public', ''),
  @('api_me', '—', 'Any signed-in user', ''),
  @('api_changePassword', 'oldPassword, newPassword', 'Any signed-in user', ''),
  @('api_listImpersonatable', '—', 'SuperAdmin', ''),
  @('api_impersonate', 'regNumber', 'SuperAdmin', ''),
  @('api_stopImpersonating', '—', 'Impersonation session', ''),
  @('api_previewAsUser', 'regNumber', 'SuperAdmin', ''),
  @('api_requestEmailChange', 'newEmail', 'Any signed-in user', ''),
  @('api_confirmEmailChange', 'code', 'Any signed-in user', ''),
  @('api_resetStudentPassword', 'reg', 'PG_Coordinator', '✓'),
  @('api_requestReset', 'regNumber', 'public', ''),
  @('api_resetWithCode', 'regNumber, code, newPassword', 'public', ''),
  @('api_setEmailPref', 'pref', 'Any signed-in user', ''),
  @('api_saveStaffLogin', 'p', 'PG_Coordinator', '✓'),
  @('api_setLoginActive', 'userId, active', 'PG_Coordinator', '✓')
)
Set-H2 'Public (no sign-in) (5)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_getFacultyDepartments', '—', 'public', ''),
  @('api_register', 'payload', 'public', '✓'),
  @('api_publicAnnouncements', '—', 'public', ''),
  @('api_checkRegistrationStatus', 'regNumber, email', 'public', ''),
  @('api_publicEnquiry', 'name, email, message, captchaToken', 'public', '')
)
Set-H2 'Students, staff and stages (23)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_getPhotos', 'ids', 'Any signed-in user', ''),
  @('api_listStaff', '—', 'HoD, PG_Coordinator, Staff, Submission_Inspector', ''),
  @('api_saveStaff', 'payload', 'HoD, PG_Coordinator', '✓'),
  @('api_removeStaff', 'staffId', 'PG_Coordinator', '✓'),
  @('api_addStudent', 'payload', 'PG_Coordinator', '✓'),
  @('api_importStudents', 'csvText', 'PG_Coordinator', '✓'),
  @('api_removeStudent', 'regNumber', 'PG_Coordinator', '✓'),
  @('api_assignSupervisors', 'regNumber, mainSupervisorId, coSupervisorId, secondCoSupervisorId, reason', 'HoD, PG_Coordinator', '✓'),
  @('api_bulkUpdateStage', 'regs, stage', 'PG_Coordinator', '✓'),
  @('api_bulkAssignSupervisors', 'regs, mainId, coId', 'HoD, PG_Coordinator', '✓'),
  @('api_updateStudentStage', 'regNumber, stage', 'PG_Coordinator', '✓'),
  @('api_updateProfilePhoto', 'filePayload', 'Any signed-in user', ''),
  @('api_updateProfile', 'payload', 'Any signed-in user', ''),
  @('api_requestTitleChange', 'newTitle, reason', 'Student', '✓'),
  @('api_approveStudent', 'regNumber', 'PG_Coordinator', '✓'),
  @('api_approvePendingStudents', '—', 'PG_Coordinator', '✓'),
  @('api_rejectStudent', 'regNumber, reason', 'PG_Coordinator', '✓'),
  @('api_saveThesisTitle', 'title', 'Student', '✓'),
  @('api_confirmThesisTitle', 'regNumber', 'PG_Coordinator', '✓'),
  @('api_createRequest', 'type, reason', 'Student', '✓'),
  @('api_requestStageChange', 'stage, note', 'Student', '✓'),
  @('api_decideRequest', 'id, decision, note', 'HoD, PG_Coordinator', '✓'),
  @('api_recordProposalDefence', 'reg, outcome, note', 'PG_Coordinator', '✓'),
  @('api_getSupervisorHistory', 'reg', 'Staff, PG_Coordinator, HoD', '')
)
Set-H2 'Dashboards, reports and operations (10)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_getCoordinatorDashboard', '—', 'HoD, PG_Coordinator', ''),
  @('api_exportData', '—', 'PG_Coordinator', ''),
  @('api_getAuditLog', '—', 'HoD, PG_Coordinator, SuperAdmin', ''),
  @('api_backupNow', '—', 'PG_Coordinator', ''),
  @('api_getNavCounts', '—', 'Any signed-in user', ''),
  @('api_getExaminerDashboard', '—', 'Examiner', ''),
  @('api_getPipeline', '—', 'HoD, PG_Coordinator', ''),
  @('api_getStaffDashboard', '—', 'Staff', ''),
  @('api_getStudentDashboard', '—', 'Student', ''),
  @('api_getHoDStats', '—', 'HoD, PG_Coordinator', '')
)
Set-H2 'Submissions, files and review (25)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_createSubmission', 'payload', 'Student', '✓'),
  @('api_listSubmissions', 'filter', 'All roles, filtered by role', ''),
  @('api_updateSubmissionStatus', 'submissionId, newStatus, comments, checklist', 'PG_Coordinator, Submission_Inspector', '✓'),
  @('api_addSupervisoryNote', 'submissionId, note', 'PG_Coordinator, Staff', '✓'),
  @('api_listTemplates', '—', 'Staff, PG_Coordinator, HoD, Submission_Inspector', ''),
  @('api_saveTemplate', 'kind, title, body', 'Staff, PG_Coordinator, HoD, Submission_Inspector', '✓'),
  @('api_deleteTemplate', 'id', 'Staff, PG_Coordinator, HoD, Submission_Inspector', '✓'),
  @('api_submitDraft', 'id, url', 'Student', '✓'),
  @('api_deleteDraft', 'id', 'Student', '✓'),
  @('api_resubmit', 'id, url', 'Student', '✓'),
  @('api_uploadSubmissionFile', 'p', 'Student', ''),
  @('api_beginLargeUpload', 'meta', 'Student', ''),
  @('api_uploadLargeChunk', 'uploadId, start, b64', 'Student', ''),
  @('api_uploadInquiryFile', 'p', 'HoD, PG_Coordinator, Student', ''),
  @('api_endorseSubmission', 'id', 'Staff', '✓'),
  @('api_listInspectors', '—', 'HoD, PG_Coordinator', ''),
  @('api_assignInspector', 'subId, insReg', 'HoD, PG_Coordinator', '✓'),
  @('api_uploadMessageFile', 'p, reg', 'Thread participants', ''),
  @('api_recordSimilarity', 'id, percent, reportUrl', 'PG_Coordinator, Submission_Inspector', '✓'),
  @('api_declineAssignment', 'id, reason', 'Submission_Inspector', '✓'),
  @('api_getSubmissionFiles', 'subId', 'Role-checked per submission', ''),
  @('api_studentFormatCheck', 'subId', 'Student', ''),
  @('api_pdfChunk', 'subId, fileId, offset', 'Role-checked per submission', ''),
  @('api_savePdfCheck', 'subId, payloadJson, fileId', 'PG_Coordinator, Staff, Student, Submission_Inspector', ''),
  @('api_runComplianceCheck', 'subId', 'Role-checked per submission', ''),
  @('api_precheckFile', 'type, url', 'Student', ''),
  @('api_getFormatHistory', 'subId', 'Student (own), Staff (own students), PG_Coordinator, HoD, Submission_Inspector', '')
)
Set-H2 'Approval requests (presentation intents) (4)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_savePresentationIntent', 'payload', 'Student', '✓'),
  @('api_decidePresentationIntent', 'id, decision, note', 'Staff', '✓'),
  @('api_decidePresentationIntentCoordinator', 'id, decision, note', 'PG_Coordinator', '✓'),
  @('api_withdrawPresentationIntent', 'id', 'Student', '✓')
)
Set-H2 'Examination workflow (7)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_decideExaminer', 'id, decision', 'HoD', '✓'),
  @('api_addExaminer', 'reg, name, type, email', 'HoD, PG_Coordinator', '✓'),
  @('api_recordExaminerResult', 'id, score, comments', 'HoD, PG_Coordinator', '✓'),
  @('api_assignExaminer', 'p', 'HoD, PG_Coordinator', '✓'),
  @('api_revokeExaminer', 'id', 'HoD, PG_Coordinator', '✓'),
  @('api_listExaminerQueue', '—', 'HoD, PG_Coordinator', ''),
  @('api_submitExaminerAssessment', 'id, a', 'Examiner', '✓')
)
Set-H2 'Supervision (meetings, actions, reviews, concerns) (17)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_addMeeting', 'reg, date, notes, actions', 'PG_Coordinator, Staff', '✓'),
  @('api_scheduleMeeting', 'reg, date, time, venue, agenda', 'PG_Coordinator, Staff', '✓'),
  @('api_completeMeeting', 'id, notes, actions', 'Staff (own students), PG_Coordinator', '✓'),
  @('api_cancelMeeting', 'id', 'Staff (own students), PG_Coordinator', '✓'),
  @('api_ackMeeting', 'id', 'Student', '✓'),
  @('api_getTimeline', 'reg', 'Thread participants', ''),
  @('api_addAction', 'reg, text, owner, dueDate, meetingId', 'PG_Coordinator, Staff', '✓'),
  @('api_completeAction', 'id', 'Student (own), Staff (own students), PG_Coordinator', '✓'),
  @('api_saveMeetingAgenda', 'id, text', 'Student', '✓'),
  @('api_markMeetingSeen', 'id', 'Staff', '✓'),
  @('api_submitCheckIn', 'status, note', 'Student', '✓'),
  @('api_saveReview', 'reg, period, rating, recommendation, comments', 'PG_Coordinator, Staff', '✓'),
  @('api_raiseConcern', 'reg, category, text', 'PG_Coordinator, Staff', '✓'),
  @('api_resolveConcern', 'id, note', 'HoD, PG_Coordinator', '✓'),
  @('api_listSubComments', 'subId', 'Student (own), Staff (own students), PG_Coordinator, HoD, Submission_Inspector', ''),
  @('api_addSubComment', 'subId, text', 'Student (own), Staff (own students), PG_Coordinator, HoD, Submission_Inspector', '✓'),
  @('api_getHandover', 'reg', 'HoD, PG_Coordinator, Staff', '')
)
Set-H2 'Communication and calendar (19)'
Add-Table @(
  @('Function', 'Arguments (after token)', 'Roles / access', 'W'),
  @('api_getMyAnnouncements', '—', 'Any signed-in user', ''),
  @('api_addAnnouncement', 'title, body, audience, sendEmail, programme', 'HoD, PG_Coordinator', '✓'),
  @('api_addDeadline', 'title, date', 'HoD, PG_Coordinator', '✓'),
  @('api_getProgrammeCalendar', '—', 'Any signed-in user', ''),
  @('api_saveProgrammeSession', 'payload', 'PG_Coordinator', '✓'),
  @('api_deleteProgrammeSession', 'id', 'PG_Coordinator', '✓'),
  @('api_getNotifications', '—', 'Any signed-in user', ''),
  @('api_markNotificationsRead', '—', 'Any signed-in user', ''),
  @('api_listMessages', 'reg', 'Thread participants', ''),
  @('api_sendMessage', 'reg, text', 'Thread participants', '✓'),
  @('api_listInquiries', '—', 'HoD, PG_Coordinator, Student', ''),
  @('api_createInquiry', 'category, subject, text, attachUrl', 'Student', '✓'),
  @('api_replyInquiry', 'id, text, attachUrl', 'Student (own), HoD, PG_Coordinator', '✓'),
  @('api_forwardInquiry', 'id, staffId, note', 'HoD, PG_Coordinator', '✓'),
  @('api_setInquiryStatus', 'id, status', 'Student (own), HoD, PG_Coordinator', '✓'),
  @('api_listMessageRecipients', '—', 'HoD, PG_Coordinator, Staff', ''),
  @('api_sendDirectMessage', 'scope, target, subject, text', 'HoD, PG_Coordinator, Staff', '✓'),
  @('api_addSeminar', 'title, date, venue, presenters', 'HoD, PG_Coordinator', '✓'),
  @('api_markAttendance', 'id, regs', 'HoD, PG_Coordinator', '✓'),
  @('api_markInquirySeen', 'id', 'Student', '✓'),
  @('api_sendGroupMessage', 'filters, subject, body, viaPortal, viaEmail, audience', 'HoD, PG_Coordinator', '✓')
)
Set-H1 '11. Frontend guide'
Set-H2 'Structure of index.html'
Set-Bullet 'A <?!= ... ?> template header that injects BRAND, INITIAL_VIEW and related values.'
Set-Bullet 'CSS with theme variables (--bg, --surface, --primary, …) and a dark theme.'
Set-Bullet 'Public views home and contact as pre-rendered static sections, register and login as iframe wrappers built by tools/build-pg.js, and the login/portal SPA served by Apps Script. about and programmes are retired names retained only for old links.'
Set-Bullet 'The application script: shared helpers, constants, state, view functions (viewStudentDashboard, viewStaff, …), one render() and a delegated event system.'
Set-H2 'State and rendering'
Set-Bullet 'A single global state object holds the token, user, current view, and one slot per payload (state.dashboard, state.staff, state.hod, …).'
Set-Bullet 'navigate(view) sets the view and calls loadView(view), which fetches the payload for that view (showing a spinner), stores it and calls render().'
Set-Bullet 'render() rebuilds the page HTML from state by calling the matching view* function. View functions are pure string builders: they return HTML and never touch the network.'
Set-Bullet 'Re-render is cheap and complete, so after any change call loadView(state.view) to refresh data.'
Set-H2 'Calling the server'
Set-Normal 'call(fn, ...args) wraps google.script.run in a Promise. authed(fn, ...args) prepends state.token. act(promise, notice, reload) sets the busy flag, shows a notice on success, then runs the reload callback; on failure it shows the error.'
Set-Normal 'On the static Cloudflare build, google.script.run is replaced by a JSONP bridge generated by tools/build-pg.js. It permits only api_publicAnnouncements and api_publicEnquiry; any other call rejects with ' + [char]0x201C + 'runs on the official portal' + [char]0x201D + '. The Apps Script deployment also exposes ?public=facdep for the faculty/department list.'
Set-Normal 'act(authed(''api_addAction'', reg, text, owner, due, ''''),'
Set-Normal '''Action item added.'','
Set-Normal 'function () { closeModal(); loadView(state.view); });'
Set-H2 'Events'
Set-Normal 'All clicks are handled by one delegated listener that reads data-action and data-id from the clicked element and runs a large switch (action). New actions include preview, precheck-open/run, fmt-history, sup-hist/print, pub-open/add/edit/back/save/del/verify/unverify/print/csv, clr-list/open/back/print/toggle, stu-search, gm-open/one/check/send, dq-open/pdf/csv, bulk-print/go, exam-sum/pdf/csv, grad-list/pdf/csv, exm-letter, print-minutes and staff/student statistics PDF/CSV actions. To add a button, render it with data-action and add the case to that switch.'
Set-H2 'Modals and helpers'
Set-Bullet 'showModal(html) / closeModal() create and remove the overlay.'
Set-Bullet 'esc(v) HTML-escapes; use it on every dynamic value.'
Set-Bullet 'thumb(fileId), fileLinks(urls), statusBadge(status), barChart(obj, sorted), pieChart(obj) render common pieces.'
Set-Bullet 'NAV lists menu items with their allowed roles; roleAllowed(key) gates them; defaultView_() chooses the landing page.'
Set-Normal 'New printable helpers are recordFormHtml_/RECORD_CSS_, statReportWin_, formShell_, recordPrinter_, csvCell_/csvDownload_ and statsToCsvRows_. data-public-img marks brand thumbnails so the private-photo rewriter does not try to replace them with api_getPhotos URLs.'
Set-H2 'Adding a new page'
Set-Bullet 'For a portal view, add an entry to NAV with a key, label and roles; for a public page, add the name to PUBLIC_PAGES in index.html, VIEWS/HREFS and the PUBLIC_PAGES rewrite in tools/build-pg.js, and PAGES in tools/serve-pg.js.'
Set-Bullet 'Add a branch to loadView that calls your API and stores the result in state.<slot>, or add a public JSONP endpoint in doGet if the static site must call it cross-origin.'
Set-Bullet 'Write viewMyPage() returning HTML and register it in the render() view switch. For static public pages, verify npm --prefix project run build pre-renders the page and rewrites its links.'
Set-Bullet 'Add the API function to Code.gs with requireUser_(token), assertRole_ and object-level access checks; add it to tools/serve-pg.js mock if local preview must exercise it.'
Set-H2 'Accessibility and responsiveness'
Set-Normal 'Controls are real buttons and inputs with labels or aria-label, tables are wrapped in .table-wrap for horizontal scrolling, and the layout collapses on small screens. Animations respect prefers-reduced-motion where used (journey tracker, animated SVG).'
Set-Normal 'Publications and clearance API: api_listPublications(reg), api_savePublication(p), api_deletePublication(id), api_verifyPublication(id, verified), api_getClearance(reg), api_listClearance() and api_setClearanceItem(reg, key, done, note). Students list/save/delete their own unverified entries; Staff, PG_Coordinator and HoD verify; manual clearance ticks are limited to the appropriate role.'
Set-H1 '12. Scheduled jobs and configuration'
Set-H2 'Triggers'
Add-Table @(
  @('Function', 'Schedule', 'Purpose'),
  @('sendDeadlineReminders', 'Daily 08:00', 'Emails students 7 and 1 days before deadlines.'),
  @('sendSupervisorReminders', 'Daily 09:00', 'Reminds supervisors of submissions awaiting endorsement (every ENDORSE_REMIND_DAYS).'),
  @('sendStalledNudges', 'Daily 10:00', 'Gentle reminder to students stalled 90+ days (every NUDGE_DAYS).'),
  @('sendSupervisionReminders', 'Daily 11:00', 'Overdue action items; on the 25th, monthly check-in reminders.'),
  @('sendDailyDigest', 'Daily 17:00', 'Digest for users whose preference is digest.'),
  @('sendWeeklyDigest', 'Mondays 07:00', 'Weekly HoD / coordinator digest.'),
  @('sendTimeLimitAlerts', 'Mondays 08:00', 'Time-limit alerts when enabled.'),
  @('autoBackup', 'Daily 02:00', 'Copies the spreadsheet to the Backups folder and keeps BACKUP_KEEP (30) copies.'),
  @('archiveOldRecords', 'Monthly 03:00', 'Log and notification housekeeping.'),
  @('checkPendingSubmissions', 'Every 10 minutes', 'Runs format compliance for submissions not yet processed (max 5 per run, 4-minute budget).'),
  @('syncStaffEmails', 'Daily 06:00', 'Keeps staff logins and Staff roster e-mail addresses aligned.'),
  @('sendCoordinatorReminders', 'Daily 12:00', 'Emails Coordinator/HoD about slow submissions and upcoming seminars.'),
  @('sendExaminerReminders', 'Daily 13:00', 'Reminders near/past due date; Monday overdue summary to Coordinator/HoD.'),
  @('sendStalledSupervisorDigest', 'Mondays 09:00', 'One list per supervisor of stalled students.')
)
Add-Table @(
  @('Adding a job  Add { fn, every, hour } to PORTAL_TRIGGERS and run installAllTriggers() for new jobs; run reinstallAllTriggers() after schedule changes. Both are safe to re-run.')
)
Set-H2 'Config tab settings'
Add-Table @(
  @('Key', 'Default', 'Meaning'),
  @('SIMILARITY_LIMIT', '20', 'Maximum allowed similarity percentage.'),
  @('REQUIRE_SIMILARITY', 'no', 'Require a within-limit result before a thesis is approved.'),
  @('EXAMINER_APPROVAL_REQUIRED', 'no', 'HoD must approve examiners.'),
  @('PASSPORT_PRIVACY', 'private', 'Legacy key only: passportPrivate_() always returns true. Passports are always private and served through api_getPhotos.'),
  @('TIME_LIMITS_ENABLED', 'no', 'Turn on time-limit features.'),
  @('LIMIT_MONTHS_MSc / MPhil / PhD', '24 / 36 / 60', 'Programme limits in months (placeholders).'),
  @('TIME_ALERT_MONTHS', '6', 'Months before the limit at which alerts begin.'),
  @('ENDORSE_REMIND_DAYS', '3', 'Days between endorsement reminders.'),
  @('NUDGE_DAYS', '30', 'Days between stalled-student nudges.'),
  @('BLOCK_APPROVAL_ON_FORMAT', 'yes', 'Block approval while must-fix format issues remain.'),
  @('PROGRAMME_START_MONTH', '2026-11', 'First month for seeded programme sessions.'),
  @('PROGRAMME_TIMEZONE', 'Africa/Lagos', 'Time zone for reminders and the calendar.'),
  @('PROGRAMME_SEEDED', 'no', 'Set automatically after the calendar is seeded.'),
  @('SUPERVISOR_MAX_STUDENTS', '8', 'Recommended maximum students per supervisor.'),
  @('FEEDBACK_DAYS', '7', 'Days allowed to reply to a submission awaiting endorsement.'),
  @('TEMPLATE_PROPOSAL_DEFENCE_FORM / TEMPLATE_PROGRESS_PPTX', '(blank)', 'Drive file IDs for downloadable templates.'),
  @('EXAMINER_REMIND_DAYS', '7', 'Days between reminder emails after an examiner assessment is overdue.'),
  @('PUB_REQUIRED_PHD', '1', 'Required accepted/published peer-reviewed journal articles for PhD clearance.'),
  @('PUB_REQUIRED_MSC', '0', 'Required publications for MSc/MPhil programmes.'),
  @('PUB_REQUIRE_VERIFIED', 'yes', 'Whether publications must be verified before they count for clearance.'),
  @('EXAMINER_DUE_SOON_DAYS', '3', 'Days before due date when the first examiner reminder is sent.'),
  @('REGISTER_HOURLY_MAX', '20', 'Hourly cap for public registrations.'),
  @('REGISTER_DAILY_MAX', '60', 'Daily cap for public registrations.'),
  @('ENQUIRY_HOURLY_MAX', '10', 'Hourly cap for public enquiries.'),
  @('ENQUIRY_DAILY_MAX', '30', 'Daily cap for public enquiries.')
)
Set-H2 'Script properties'
Add-Table @(
  @('Property', 'Use'),
  @('SPREADSHEET_ID', 'Database spreadsheet.'),
  @('DRIVE_FOLDER_ID', 'Defined but never read. The upload/passport/attachment/backup folder comes from Config key PASSPORT_FOLDER_ID via getSetting_, with DEFAULT_PASSPORT_FOLDER_ID as fallback.'),
  @('SCHOOL_NAME, FOOTER_TEXT, SCHOOL_LOGO_URL, CBS_LOGO_URL, HERO_IMAGE_URL', 'Branding.'),
  @('JOURNEY_IMAGE_URL', 'Portal only; empty by default. The static Cloudflare build uses /images/PG_Journey_Animated.svg and cannot be changed by this property.'),
  @('SENDER_DISPLAY_NAME / ENQUIRIES_EMAIL', 'Email sender name and contact address (constants at the top of Code.gs).'),
  @('TURNSTILE_SECRET / TURNSTILE_SITE_KEY', 'Enables Cloudflare Turnstile on public registration and enquiry. The secret is server-only; the site key is exposed as brand_.turnstileSiteKey.'),
  @('EMBED_ENABLED', 'Set to no to disable iframe framing. embedAllowed_() allows ALLOWALL framing for any request with embed=1, including login.'),
  @('ENQUIRIES_EMAIL', 'Overrides both the mail reply-to and the enquiry recipient; keep it set to abel.osagie@uniabuja.edu.ng or delete it so code and contact page agree.')
)
Set-H1 '13. Extending the system'
Set-H2 'Recipe: add a new table'
Set-Bullet 'Add MyTable: [''id'', ''regNumber'', …] to HEADERS and a prefix in ID_PREFIXES.'
Set-Bullet 'Use appendRow_, readTable_, updateRow_ immediately; the tab is created on first use.'
Set-H2 'Recipe: add an endpoint'
Set-Normal 'function api_myFeature_l(token, reg, text) {'
Set-Normal 'var user = requireUser_(token);'
Set-Normal 'assertRole_(user, [''Staff'', ''PG_Coordinator''], ''You cannot do that.'');'
Set-Normal 'var stu = threadStudent_(user, reg);          // object-level access'
Set-Normal 'var t = cleanText_(text, 3, 500, ''The text'');'
Set-Normal 'var r = appendRow_(''MyTable'', { regNumber: stu.regNumber, text: t, createdAt: nowIso_() });'
Set-Normal 'notifyStudent_(stu.regNumber, ''Subject'', t);'
Set-Normal 'logAudit_(user.id, user.regNumber, ''MY_FEATURE'', stu.regNumber, t.slice(0, 80));'
Set-Normal 'return { id: r.id };'
Set-Normal '}'
Set-Normal 'function api_myFeature() { return L_(api_myFeature_l, arguments); }'
Set-Normal 'For bulk mail, return {..., _mail: job} from the locked function and wrap the public function with finishBulkMail_(L_(api_myFeature_l, arguments)) so BCC batches are sent after the script lock is released. sendBcc_ sends 50 recipients per message, counts every To/Cc/Bcc address against the daily quota and leaves one quota slot for the Coordinator copy.'
Set-H2 'Recipe: extend a dashboard payload'
Set-Normal 'Follow the existing pattern: rename the original to api_xBase_, create api_x that calls it and adds fields inside try/catch (see section 17 of Code.gs).'
Set-H2 'Recipe: add a stage or change the journey'
Set-Bullet 'Edit CFG.JOURNEY_STAGES and S_.'
Set-Bullet 'Update STAGE_ON_APPROVAL, PRESENTATION_INTENTS and any advanceStageTo_ calls.'
Set-Bullet 'Update the client arrays JOURNEY_STAGES, STAGE_REQS, JT_PHASES, JT_GATES.'
Set-Bullet 'Regenerate the animated SVG (Appendix A) and update guides.'
Add-Table @(
  @('Existing data  There are 17 stages: 16 numbered stages plus ' + [char]0x201C + '10b - …' + [char]0x201D + ' inserted for PhD. Students already at a renamed stage must be migrated because stage names are stored as text. Keep CFG.JOURNEY_STAGES, S_, the client JOURNEY_STAGES/STAGE_REQS/JT_PHASES/JT_GATES and the public phase cards in agreement. The animated SVG is illustrative only.')
)
Set-H2 'Recipe: add an email or notification'
Set-Normal 'Use notifyStudent_, addNote_, notifyCoordinators_ or sendPortalMail_. Keep bodies short, plain text; the branded footer is added automatically.'
Set-H1 '14. Testing, operations and troubleshooting'
Set-H2 'Testing approach'
Set-Bullet 'The project has no automated test suite. For quick checks, load Code.gs into a Node vm context with mocked Apps Script globals and in-memory tables (override readTable_, appendRow_, updateRow_, requireUser_, sendPortalMail_). This is how the supervision module was smoke-tested.'
Set-Bullet 'For the client, extract the main <script> block, replace template tags with null and run node --check for syntax; individual view* functions can be exercised with stub esc, state and sample payloads.'
Set-Bullet 'Test with a copy of the spreadsheet, Sign in as each role and use Preview (read-only) for SuperAdmin before deploying a new version. Local preview has no SuperAdmin, so preview paths must be tested on the portal with a non-live sheet.'
Set-Bullet 'Suggested regression checklist: public registration with Turnstile and status-by-email → approve/bulk approve including skipped-on-busy → assign supervisors with reason and supervisor history → pre-check a Word file → submit proposal → approve → request readiness → record defence → progress intent → assign internal examiner → examiner reminder → external examiner → publications add/verify → clearance auto/manual items and print → group message → inquiry reply/unread badge → bulk approval/CSV export/BOM → statistics PDF/CSV → print student record/bulk records → trigger install/reinstall check.'
Set-H2 'Quotas and limits'
Add-Table @(
  @('Limit', 'Effect and mitigation'),
  @('Execution time (6 minutes)', 'Large imports are capped (60 students); compliance runs are budgeted to 4 minutes and 5 items.'),
  @('Daily email quota', 'mailRecipientCount_ counts every To/Cc/Bcc address. sendBcc_ batches 50 BCC recipients after the lock is released and stops when quota is exhausted; res.emailAttempted and res.emailed show attempted vs actually handed to MailApp.'),
  @('Script lock wait', 'Writers queue up to 30 seconds, then users see ' + [char]0x201C + 'portal is busy' + [char]0x201D + '. Keep locked sections short.'),
  @('Spreadsheet size', 'Whole-tab reads grow with data. Archive logs (archiveOldRecords), keep tables lean, and consider migrating to a database if the system grows past tens of thousands of rows.'),
  @('Cache size/time', 'Sessions last 6 hours and may be evicted.'),
  @('Upload size', '50 MB per submission through chunked uploads.'),
  @('Public form abuse', 'Registration, status, enquiry and reset use CacheService windows and Script Properties daily caps; keep Turnstile configured for public forms.'),
  @('Group messages', 'GROUP_MESSAGE_MAX_=300 recipients per message; filters must be narrowed above that.')
)
Set-H2 'Logs and diagnostics'
Set-Bullet 'Use Executions and Logger.log in the Apps Script editor; helpers such as logAudit_ and notifyStudent_ swallow errors and log them instead of failing the user action.'
Set-Bullet 'The AuditLog tab records who did what; AUTO_STAGE entries show system-driven stage changes.'
Set-Bullet 'authorizeServices() logs whether link sharing and Drive access work in your Workspace domain.'
Set-H2 'Common problems'
Add-Table @(
  @('Symptom', 'Likely cause and fix'),
  @('Users see old behaviour after an update', 'Create a New version in Manage deployments.'),
  @([char]0x201C + 'Missing sheet tab' + [char]0x201D, 'A table has no HEADERS entry or setUp() was not run.'),
  @([char]0x201C + 'The portal is busy' + [char]0x201D, 'Lock contention; check for slow executions or a stuck trigger.'),
  @('Triggers not firing', 'Check the Triggers page and owner authorisation. Run installAllTriggers() for missing jobs; run reinstallAllTriggers() after a schedule change.'),
  @('Emails missing', 'Daily quota exhausted, Turnstile/registration cap rejecting earlier steps, or authorizeServices() not run. Bulk mail reports emailed vs emailAttempted; check spam.'),
  @('Drive files will not open', 'Files are private. Use api_getPhotos/api_getSubmissionFiles/api_getFileAccess to grant access. For pasted links, confirm the file name starts with the student' + [char]0x2019 + 's reg number or the owner matches the registered email.'),
  @('Duplicate empty column appears', 'A sheet column was renamed manually; rename it back to match HEADERS.'),
  @('Examiner cannot be assigned', 'Thesis not Approved, Internal examiner in Physics, or examiner is a supervisor.'),
  @('Public form asks for human check', 'Set both TURNSTILE_SECRET and TURNSTILE_SITE_KEY; the widget appears only when the site key is present.'),
  @('Registration status says Not Found', 'The registered email must also be supplied; this prevents reg-number probing.'),
  @('Inquiry shows Answered', 'Legacy row: the client displays it as Closed. Staff replies now close the ticket immediately.'),
  @('Static frame will not load', 'Check EMBED_ENABLED (not no) and that the frame URL carries embed=1; embedAllowed_() requires it, including for login.')
)
Set-H2 'Backup and recovery'
Set-Normal 'Nightly autoBackup at 02:00 copies the spreadsheet; api_backupNow does it on demand. BACKUP_KEEP (30) copies are retained. To recover, copy the backup spreadsheet, point SPREADSHEET_ID at it and redeploy. Drive files are not duplicated by backupCore_, so check Drive access separately.'
Set-H1 '15. Appendices'
Set-H2 'Appendix A: animated journey image'
Set-Normal 'The animated SVG (PG_Journey_Animated.svg) is a self-contained 24-second loop: stages appear in sequence along a serpentine path with a travelling marker, a live step/phase banner, gate badges and a reduced-motion fallback. It is generated by a Python script (gen_journey.py) that computes node positions and keyframes from the stage list. To change it, edit the stage and phase arrays and rerun the script. Host it in Drive and set JOURNEY_IMAGE_URL (for example https://drive.google.com/uc?export=view&id=FILE_ID); the home page replaces the image source at load. SVG inside an <img> supports CSS and SMIL animation but not script.'
Set-H2 'Appendix B: user guides'
Set-Normal 'Seven role guides accompany this document: Student, Supervisor, PG Coordinator, HoD, Submission Inspector, Examiner and Super Admin. They describe the user-facing behaviour summarised in the feature reference.'
Set-H2 'Appendix C: glossary'
Add-Table @(
  @('Term', 'Meaning'),
  @('Gate', 'A stage whose outcome decides the next step (7, 10, 12, 13, 15).'),
  @('Intent / approval request', 'A request that must be approved by supervisors and often the coordinator before a stage advances.'),
  @('Inspector', 'Role that checks submissions against departmental requirements.'),
  @('Epoch', 'A per-user counter used to invalidate all sessions at once.'),
  @('Base function', 'The original version of an API function wrapped to add fields.'),
  @('Lock', 'The script lock that serialises writes.'),
  @('Turnstile', 'Cloudflare human check for public registration and enquiry; enabled by TURNSTILE_SECRET and TURNSTILE_SITE_KEY.'),
  @('Rate limit', 'CacheService fixed-window counter or Script Properties calendar-day cap used to throttle public endpoints.'),
  @('Read-only preview', 'SuperAdmin session with readOnly=true; all write helpers refuse it and the start/end are audited separately.'),
  @('Clearance', 'Ten-item pre-defence checklist; four items are derived from portal records and six are manually ticked by supervisors or Coordinator/HoD.'),
  @('Format history', 'Last six format-check results on a Submissions row, used to show fixed, remaining and new issues.'),
  @('Embed gate', 'embedAllowed_() rule that permits ALLOWALL framing for any embed request (including login) unless EMBED_ENABLED=no.'),
  @('JSONP bridge', 'Static-build shim that exposes only announcements and enquiry from the live Apps Script deployment.')
)
Save-Doc 'PG_Portal_Developer_Guide.docx'

$word.Quit()
"done"
