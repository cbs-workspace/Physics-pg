# Seed Data for Physics_PG_Portal_DB

Sheet ID: `1cybEF_Fjhyazj4SIH5HnSht6KD31UWftT5fQyGi29uc`

Paste the rows below into the Google Sheet after the `setUp()` function creates the tabs.

> **PasswordHash note:** The hashes below are SHA-256 of `PhysicsPG2026!:<salt>`.
> To generate them, paste this into the Apps Script editor and run `generateSeedHashes()`:
> ```js
> function generateSeedHashes() {
>   var pw = 'PhysicsPG2026!';
>   var salts = ['abc123def456', 'xyz789ghi012', 'stu345vwx678', 'yza901bcd234',
>                'efg567hij890', 'klm123nop456', 'qrs789tuv012', 'wxy345zab678'];
>   salts.forEach(function(s) {
>     var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw + ':' + s, Utilities.Charset.UTF_8)
>       .map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
>     Logger.log(s + ' => ' + hash);
>   });
> }
> ```
> Then copy each hash into the matching `PasswordHash` cell below.

---

## Config sheet

| Key | Value |
|-----|-------|
| DEFAULT_PASSWORD | PhysicsPG2026! |
| PASSPORT_FOLDER_ID | 1Bz3EtP8euZF3W2L4oLY_EoHHXxLLZl2Y |
| ADMIN_EMAIL | abel.osagie@uniabuja.edu.ng |

---

## Users sheet

All demo accounts share the password **`PhysicsPG2026!`**.

| id | regNumber | email | passwordHash | salt | role | fullName | firstLogin | active | status | createdAt |
|----|-----------|-------|--------------|------|------|----------|------------|--------|--------|-----------|
| Usr01 | UA/pg2026/000001 | demo.student1@gmail.com | *(generated)* | abc123def456 | Student | Chinedu Okafor | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr02 | UA/pg2026/000002 | demo.student2@gmail.com | *(generated)* | xyz789ghi012 | Student | Fatima Adamu | TRUE | TRUE | Pending | 2026-10-01 08:00:00 |
| Usr03 | 26/408PHYX/040 | demo.student4@gmail.com | *(generated)* | stu345vwx678 | Student | Blessing Eze | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr04 | UA/pg2026/000010 | demo.coordinator@gmail.com | *(generated)* | yza901bcd234 | PG_Coordinator | Amina Bala | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr05 | UA/pg2026/000011 | demo.hod@gmail.com | *(generated)* | efg567hij890 | HoD | Prof. Musa Aliyu | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr06 | UA/pg2026/000012 | demo.staff@gmail.com | *(generated)* | klm123nop456 | Staff | Dr. Grace Obi | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |
| Usr07 | UA/pg2026/000013 | demo.inspector@gmail.com | *(generated)* | qrs789tuv012 | Submission_Inspector | Dr. Samuel Eze | FALSE | TRUE | Approved | 2026-10-01 08:00:00 |

> **Deactivate all demo accounts before go-live.**

---

## Students sheet

| id | regNumber | surname | firstName | otherNames | gender | phoneNumber | email | faculty | department | programme | specialisation | passportFileId | passportUrl | mainSupervisorId | coSupervisorId | currentStage | yearOfAdmission | createdAt | updatedAt |
|----|-----------|---------|-----------|------------|--------|-------------|-------|---------|------------|-----------|----------------|----------------|-------------|-----------------|----------------|--------------|-----------------|-----------|-----------|
| Stu01 | UA/pg2026/000001 | Okafor | Chinedu | Emeka | Male | 08012345678 | demo.student1@gmail.com | Faculty of Physical Sciences | Physics | MSc | Experimental Solid-State Physics | | | Stf01 | Stf02 | 4 - Proposal Submission | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |
| Stu02 | UA/pg2026/000002 | Adamu | Fatima | Yusuf | Female | 08098765432 | demo.student2@gmail.com | Faculty of Physical Sciences | Physics | PhD | Nuclear Physics | | | | | 1 - Admission | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |
| Stu03 | 26/408PHYX/040 | Eze | Blessing | Chidi | Female | 08055556666 | demo.student4@gmail.com | Faculty of Physical Sciences | Physics | PhD | Solar Physics | | | Stf01 | | 8 - Progress Report | 2026 | 2026-10-01 08:00:00 | 2026-10-01 08:00:00 |

---

## Staff sheet

| id | fullName | email | rank | specialisation | active | createdAt |
|----|----------|-------|------|----------------|--------|-----------|
| Stf01 | Dr. Bala Ahmed | bala.ahmed@uniabuja.edu.ng | Senior Lecturer | Solid-State Physics | TRUE | 2026-10-01 08:00:00 |
| Stf02 | Dr. Grace Obi | grace.obi@uniabuja.edu.ng | Lecturer I | Nuclear Physics | TRUE | 2026-10-01 08:00:00 |
| Stf03 | Prof. Musa Aliyu | musa.aliyu@uniabuja.edu.ng | Professor | Solar Physics | TRUE | 2026-10-01 08:00:00 |
| Stf04 | Dr. Samuel Eze | samuel.eze@uniabuja.edu.ng | Lecturer II | Applied Geophysics | TRUE | 2026-10-01 08:00:00 |

---

## Submissions sheet

| id | regNumber | type | driveFileUrls | status | inspectorComments | supervisorNotes | createdBy | createdAt | updatedAt |
|----|-----------|------|---------------|--------|-------------------|-----------------|-----------|-----------|-----------|
| Sub01 | UA/pg2026/000001 | Research Proposal | https://drive.google.com/file/d/EXAMPLE1 | Approved | Good work | Reviewed by Dr. Bala | Usr01 | 2026-06-15 10:00:00 | 2026-06-20 14:00:00 |
| Sub02 | UA/pg2026/000001 | Progress Report | https://drive.google.com/file/d/EXAMPLE2 | Submitted | | | Usr01 | 2026-09-20 14:30:00 | 2026-09-20 14:30:00 |
| Sub03 | 26/408PHYX/040 | Seminar Presentation | https://drive.google.com/file/d/EXAMPLE3 | Changes Requested | Please expand section 3 | | Usr03 | 2026-07-01 09:15:00 | 2026-07-02 10:00:00 |

---

## Announcements sheet

| id | title | body | active | createdBy | createdAt |
|----|-------|------|--------|-----------|-----------|
| Ann01 | Welcome to 2026/2027 Session | Department of Physics Postgraduate Journey is now live. Register and await approval. | TRUE | Usr04 | 2026-10-01 08:00:00 |
| Ann02 | Monthly Seminar Schedule | Next seminar holds on the last Thursday of every month at 2PM, Physics Seminar Room. | TRUE | Usr04 | 2026-10-15 10:00:00 |

---

## AuditLog sheet

Leave empty — the system writes to it automatically.

---

## Test login quick-reference

| Account | Reg Number | Password | Expected behaviour |
|---------|------------|----------|--------------------|
| Student 1 (approved) | `UA/pg2026/000001` | `PhysicsPG2026!` | Dashboard — shows supervisors Dr. Bala + Dr. Grace |
| Student 2 (pending) | `UA/pg2026/000002` | `PhysicsPG2026!` | Blocked: "Awaiting PG Coordinator approval" |
| Student 4 (approved, pattern 2) | `26/408PHYX/040` | `PhysicsPG2026!` | Dashboard — shows Dr. Bala as main, no co-supervisor |
| PG Coordinator | `UA/pg2026/000010` | `PhysicsPG2026!` | Coordinator dashboard — approve, assign supervisors, announce |
| HoD | `UA/pg2026/000011` | `PhysicsPG2026!` | Read-only stats and all submissions |
| Staff (Dr. Grace Obi) | `UA/pg2026/000012` | `PhysicsPG2026!` | Sees Chinedu Okafor (co-supervised) |
| Submission Inspector | `UA/pg2026/000013` | `PhysicsPG2026!` | Review queue — approve/reject/request changes |
