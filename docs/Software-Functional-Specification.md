# Miraya School Management — User Guide

**Dharsh School of Excellence · School Management Suite**

| | |
|---|---|
| **Version** | 1.2 |
| **Date** | 16 June 2026 |
| **Prepared by** | Miraya project team |

This guide explains what Miraya does and how to use it — written for school staff, parents, and anyone testing the system before go-live. Start with **Section 5 (Administrator)** if you are setting up the school for the first time.

---

## Table of contents

1. [What is Miraya?](#1-what-is-miraya)
2. [Who uses it?](#2-who-uses-it)
3. [How the system is built](#3-how-the-system-is-built)
4. [Before you sign in](#4-before-you-sign-in)
5. [Administrator — step by step](#5-administrator--step-by-step)
6. [Principal](#6-principal)
7. [Teacher](#7-teacher)
8. [Parent](#8-parent)
9. [Driver](#9-driver)
10. [Front office & coordinator](#10-front-office--coordinator)
11. [Full stories — when more than one person is involved](#11-full-stories--when-more-than-one-person-is-involved)
12. [Rules worth remembering](#12-rules-worth-remembering)
13. [Who can do what](#13-who-can-do-what)
14. [Common questions](#14-common-questions)
15. [Words we use](#15-words-we-use)
16. [Admin menu (quick list)](#16-admin-menu-quick-list)

---

# 1. What is Miraya?

Miraya is the school’s day-to-day portal. Instead of phone chains, paper registers, and scattered spreadsheets, staff run classes, notices, transport, visitors, and admission enquiries from one place. Parents read official messages, follow the school bus, and request parent–teacher meetings (PTM). Drivers run their routes from a map on their phone.

**What you can do here**

- Sign in, reset password, manage your profile  
- Manage classes, teachers, students, parents, and staff accounts  
- Send school notices — with approval before parents see them  
- Run transport: buses, drivers, routes, live tracking, trip history  
- Log visitors and track admission leads  
- Brand the portal (name, colours, login screen) and control who sees which menu  
- Install the app on phone or tablet (PWA)

Students are stored in the system and linked to parents and classes. **Students do not sign in** — parents act on their behalf.

---

# 2. Who uses it?

| Role | In plain words |
|------|----------------|
| **Admin** | Runs everything. Sets up the school, approves **administrative** notices, manages admin/principal accounts, full transport and settings. |
| **Principal** | Almost like admin, but cannot manage admin/principal accounts. Approves **academic** notices. |
| **Teacher** | Works with assigned classes and students. Creates notices (needs approval). Handles PTM requests and assigned leads. |
| **Parent** | Reads messages, tracks bus, requests PTM, views own children. |
| **Driver** | Starts and ends trips on the map, marks students at stops. |
| **Front office staff** | Reception-style role. Admin picks exactly which screens they see. |
| **Coordinator** | Same as front office — custom menu from admin. |

**Two approval rules to remember**

- **Administrative notice** → must be approved by **Admin** before parents get it.  
- **Academic notice** → must be approved by **Principal** before parents get it.

Until someone approves, the notice stays **Pending** and parents see nothing.

---

# 3. How the system is built

You do not need to be a developer to use Miraya. This is here so stakeholders know what powers the app.

| Layer | Technology | What it does |
|-------|------------|--------------|
| **Frontend** | React.js + Tailwind CSS | Every screen you click — login, dashboard, forms, maps. Works in the browser and as an installable app. |
| **Backend** | Node.js | Handles sign-in, saves data, runs approvals, sends email, pushes live bus updates. Checks permissions on the server. |
| **Hosting** | Hostinger | Where the live school site and database run. |

**What happens when you click “Save” or “Approve”**

1. The React app sends a request to the Node.js server.  
2. The server checks your role and applies the rules.  
3. Data is saved and the screen updates.

```
  You (browser or installed app)
           │
           ▼
  React.js + Tailwind  —  screens & buttons
           │
           ▼
  Node.js  —  login, notices, transport, email
           │
           ▼
  Hostinger  —  hosting & database
```

---

# 4. Before you sign in

### Opening the site

When someone opens the school URL, the app loads the school name and icon first so the login page does not flash a generic name. If you already have a valid session, you go straight to your dashboard. If you installed the app on your home screen, it opens the same way — just without the browser bar.

### Signing in

1. Enter email and password.  
2. The system reads your role and opens the right dashboard and sidebar.  
3. Wrong password → error on the login page, no access.

### Forgot password

1. Click **Forgot password** on the login page.  
2. Enter your registered email → you receive a one-time code (OTP) by email.  
3. Enter the code, set a new password, sign in again.  
*(Email must be configured under Admin → Settings → SMTP.)*

### Desktop vs phone

- **Desktop:** Sidebar on the left, notification bell in the header, settings for admin/principal.  
- **Phone/tablet:** Collapsible menu, icon bar at the bottom, option to install the app.

### How lists and forms work everywhere

Most screens follow the same pattern: a table with search and filters, **Add** at the top, **Edit / Delete** on each row. Long lists have pages at the bottom. Many directories support **Import CSV** and **Export CSV**. Forms show errors next to the field if something is missing.

### How academic data links together

Set things up in this order:

```
Classes  →  Teachers (assigned to classes)
         →  Parents (accounts)
         →  Students (class + parent)
```

A parent only sees their own children. A teacher only sees students in classes assigned to them.

---

# 5. Administrator — step by step

Admin is where school setup begins. Follow the phases below in order when going live.

### Admin sidebar (full menu)

1. Dashboard  
2. **Academics:** Classes, Teachers, Students, Parents, Admins, Principals, Front office staff, Coordinators  
3. **Transport:** Live buses, History of trip, Bus drivers, Create buses, Pick up points, Routes  
4. **Notices:** Create Category, Create Notice, Notice approvals  
5. **Operations:** Visitor log, Leads  
6. **PTM:** PTM request, PTM history  
7. **Settings** (top right)  
8. Profile · Log out  

---

## Phase 1 — Login and school appearance

### Sign in and open the dashboard

1. Open the school portal (browser or installed app).  
2. Enter admin email and password → **Sign in**.  
3. You should see the Dashboard: welcome message, **Admin** badge, count tiles (classes, students, pending notices, buses, etc.), quick icons, recent notices.

### Set school name and icon

1. **Settings** → **Site branding**.  
2. Enter school name, upload favicon (school icon).  
3. **Save** → browser tab and install app icon update.

### Set login page look

1. **Settings** → **Login appearance**.  
2. Set logo, title, subtitle, button colour → **Save**.

### Set up email (for password reset)

1. **Settings** → **SMTP email**.  
2. Enter mail server details.  
3. Optional: **Send test email**.  
4. **Save**.

### Set colours and sidebar

1. **Settings** → **Background theme** — sidebar and main area colours or images.  
2. **Settings** → **Sidebar menu appearance** — menu icons and label colours.  
3. **Save** — all users see changes after refresh.

---

## Phase 2 — Academics (in this order)

### Create a class

1. **Academics** → **Classes** → **Add class**.  
2. Enter name and grade level (required); section and room optional.  
3. Optionally assign teachers.  
4. **Save** → class appears in the list.

### Create a teacher

1. **Academics** → **Teachers** → **Add teacher**.  
2. Name, email, password (min 6 characters), phone, subject.  
3. Select **assigned classes**.  
4. **Save** → teacher can sign in.

### Create a parent

1. **Academics** → **Parents** → **Add parent**.  
2. Name, email, password, phone.  
3. **Save**.

### Create a student

1. **Academics** → **Students** → **Add student**.  
2. Name, select **class**, select **parent**.  
3. **Save** → parent sees the child when they sign in; teacher sees the student if the class is assigned to them.

**Bulk option:** Students → **Import CSV** with columns `fullName`, `room`, `parentEmail`. The system matches class by room and parent by email, then shows how many rows succeeded or were skipped.

### Edit or deactivate someone

Open Teachers, Parents, or Students → **Edit** → change details or set **Active** to No. Deactivated users cannot sign in. You cannot delete a class that still has students in it.

---

## Phase 3 — Staff accounts

### Create another admin

Only admin can open **Academics → Admins**. Add name, email, password → **Save**.

### Create a principal

**Academics → Principals** → add account. Principal gets almost the same menu as admin but **cannot** open Admins or Principals. Principal approves **academic** notices (see Section 6).

### Create front office or coordinator (custom menu)

1. **Academics → Front office staff** (or **Coordinators**) → **Add**.  
2. Enter name, email, password.  
3. In **Menu access**, tick only the screens this person needs (e.g. Visitor log, Live buses). At least one screen is required.  
4. **Save** → when they sign in, they only see those menu items.

---

## Phase 4 — Transport (in this order)

1. **Create buses** — name and number plate.  
2. **Bus drivers** — name, email, password (min 8), phone, license.  
3. **Pick up points** — address or pin on map, times, link students to the stop.  
4. **Routes** — pick bus, driver, route type (morning pick-up or evening drop), order of stops.  
5. **Assignments** — link parents/students to bus and driver where that screen is available.

After this, the driver can start trips (Section 9) and parents can track (Section 8).

---

## Phase 5 — Notices

### Create notice categories

**Notices → Create Category** → under **Administrative**, add sub-categories (e.g. “Fees reminder”, “Holiday”). Principal adds **Academic** categories on the same screen.

### Create a notice

1. **Notices → Create Notice**.  
2. Title, message, category (**Administrative** or **Academic**), optional banner image.  
3. Choose who receives it: whole class, a section, or named students.  
4. **Submit** → status is **Pending**. Parents do **not** see it yet.

### Approve an administrative notice ⭐

This is the step many flows depend on.

1. **Notices → Notice approvals** (or Notice history, filter Pending).  
2. Open the notice — check who submitted it and who it is sent to.  
3. **Approve** → status becomes Delivered; parents in the target group get the message.  
4. Or **Reject** with a reason → notice is not sent; submitter can see it was rejected.

Later: **Read report** on a delivered notice shows which parents opened it.

**Remember:** Admin approves **Administrative**. Principal approves **Academic** (not admin).

---

## Phase 6 — Day-to-day work

| Task | Where to go | What you do |
|------|-------------|-------------|
| Watch buses now | Transport → **Live buses** | See active trips and map (driver must have started a trip) |
| Past trips | Transport → **History of trip** | Open a date → see who was picked up / dropped / absent |
| Log a visitor | Operations → **Visitor log** | Name, phone, purpose, time. Delete needs a written reason (audit log) |
| Admission enquiry | Operations → **Leads** | Filter by stage, assign teacher, add notes, move stage |
| PTM overview | PTM → **PTM history** | See all requests (teacher usually approves — Section 7) |
| Export data | Any list e.g. Students | **Export CSV** — current page or all |
| Your own account | **Profile** | Change name, phone, password |

---

# 6. Principal

Principal works like admin on most screens but with three important differences:

- No **Admins** or **Principals** menu.  
- Does **not** approve administrative notices — that is admin’s job.  
- **Does** approve academic notices.

### Approve an academic notice ⭐

1. **Notices → Notice approvals**.  
2. Find a pending notice with category **Academic**.  
3. Read it, check the audience, **Approve** or **Reject**.  
4. After approval, parents receive it in School messages.

Principal can also manage academic categories, create front office/coordinator accounts, and use classes, transport, visitors, leads, PTM, and settings the same way admin does on those screens.

---

# 7. Teacher

### Dashboard

Shows assigned classes and students, notice status (pending / approved / rejected), PTM waiting for you, and assigned leads.

### Students

**Academics → Students** — only your assigned classes. You can add and edit students. You **cannot delete** students.

### Create a notice (approval required) ⭐

1. **Create Notice**.  
2. Title, message, pick **Administrative** or **Academic**.  
3. Target only your assigned classes, sections, or students.  
4. **Submit** → **Pending**. Parents see nothing until approved.

**What happens next**

- **Administrative** → Admin approves (Section 5, Phase 5).  
- **Academic** → Principal approves (Section 6).

Check your **Notifications** list to see pending / approved / rejected.

### PTM requests ⭐

1. **PTM → PTM requests** — open a parent’s request.  
2. **Approve** with meeting date, time, and note — or **Reject**.  
3. After the meeting, mark **Complete** with a short note.

Parent sees the status in PTM history.

### Leads

**Leads** — only enquiries assigned to you. Update stage and add notes. You can also **Create lead** (basic details) — admin sees it as New.

---

# 8. Parent

### Dashboard

Shows your children’s teachers, unread messages, bus status, recent notices and PTM.

### Read a school message ⭐

Only works **after** admin or principal approved the notice.

1. **School messages** (or tap a notice on the dashboard).  
2. Unread items stand out.  
3. Open the notice — text, banner, links.  
4. Closing it marks it as **read** (school can see that in read report).

### Bus tracking

1. **Bus tracking** or the bus card on the dashboard.  
2. If the driver started a trip → live position on the map.  
3. If no trip is running → **Assigned** or **Not active** — that is normal, not an error.

### Request a PTM ⭐

1. **PTM → PTM request**.  
2. Pick child, teacher, enter reason → **Submit**.  
3. Status **Requested** — wait for teacher to approve (Section 7).

### Children and enquiries

- **Students** — your children only, read-only.  
- **Create lead** — submit a basic admission enquiry; admin picks it up in Leads.

---

# 9. Driver

### Dashboard

Shortcuts to **Map** and **Routes** only. No school notices bell.

### Run a morning pick-up trip ⭐

1. Open **Map**.  
2. Select today’s route, mode **Pick up**.  
3. **Start trip** → GPS is shared; trip is **active**.  
4. At each stop, mark students **Picked up** or **Absent**.  
5. **End trip** at school → saved to trip history.

While the trip is active, parents on that route can see the bus (Section 8). Admin can watch under Live buses.

### Rules

- You cannot switch from Pick up to Drop mid-trip — end the trip first.  
- Drivers do not get the browser push-notification prompt.

---

# 10. Front office & coordinator

Admin created your account and ticked specific screens in **Menu access**. You only see those in the sidebar and dashboard.

1. Sign in with the email and password admin gave you.  
2. If you only have Visitor log — use the same steps as admin in Phase 6 (visitor table).  
3. If you only have Live buses — open Transport → Live buses during school run.  
4. Opening a screen you were not given → blocked or page not found.

Admin can grant **View / Edit / Create / Delete** per screen when setting up your account.

---

# 11. Full stories — when more than one person is involved

Use these to test the system end to end, in order.

---

### Story 1: Teacher notice → Admin approves → Parent reads

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Teacher | Creates notice, category **Administrative**, targets Class 10-A, submits |
| 2 | System | Status **Pending** — parents see **nothing** |
| 3 | Admin | Notice approvals → **Approve** |
| 4 | System | Status **Delivered** |
| 5 | Parent (child in 10-A) | School messages → opens notice → marked read |
| 6 | Admin | Read report shows parent read it |

**Pass test:** Parent must not see the notice before step 3.

---

### Story 2: Teacher notice → Principal approves → Parent reads

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Teacher | Creates notice, category **Academic**, submits |
| 2 | Principal | Notice approvals → **Approve** |
| 3 | Parent | Message appears in School messages |

Admin does not approve academic notices.

---

### Story 3: Admin notice → Admin approves → Parent reads

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Admin | Create Notice → Administrative → Submit |
| 2 | Admin | Notice approvals → Approve the same notice |
| 3 | Parent | Message in inbox |

Even admin’s own notice stays pending until someone approves it from the approvals screen.

---

### Story 4: Parent PTM → Teacher approves

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Parent | PTM request → child, teacher, reason → Submit |
| 2 | Teacher | PTM requests → Approve with date, time, note |
| 3 | Parent | PTM history shows **Approved** with meeting details |
| 4 | Teacher | After meeting → **Complete** |
| 5 | Parent | History shows **Completed** |

---

### Story 5: Transport from setup to live map

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Admin | Bus, driver, pick-up points, route, assign parent/student |
| 2 | Driver | Map → Start morning trip |
| 3 | Admin | Live buses → sees active bus |
| 4 | Parent | Bus tracking → live map |
| 5 | Driver | Marks pick-ups → Ends trip |
| 6 | Admin | History of trip → record saved |

---

### Story 6: Admission lead

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Parent | Create lead → Submit |
| 2 | Admin | Leads → assign teacher → stage **Contacted** |
| 3 | Teacher | Adds note → stage **Visit** |
| 4 | Admin | **Enrolled** or **Closed** |

---

### Story 7: Visitor delete leaves an audit trail

| Step | Who | What happens |
|------|-----|----------------|
| 1 | Staff | Logs visitor |
| 2 | Staff | Deletes entry → must type a reason |
| 3 | Admin | Visitor audit log shows deletion and reason |

---

### Story 8: Recommended go-live test order

| Order | Who | Task |
|-------|-----|------|
| 1 | Admin | Branding, login look, email (Phase 1) |
| 2 | Admin | Class, teacher, parent, student (Phase 2) |
| 3 | Admin | Principal account (Phase 3) |
| 4 | Admin | Transport setup (Phase 4) |
| 5 | Admin | Notice categories (Phase 5) |
| 6 | Teacher + Admin | Teacher submits notice → Admin approves |
| 7 | Parent | Reads message |
| 8 | Driver + Parent | Trip running → parent sees bus |
| 9 | Parent + Teacher | PTM request → teacher approves |
| 10 | Admin | Front office account with limited menu |

---

# 12. Rules worth remembering

**Sign-in and access**

- Each role has a fixed menu except front office and coordinator (admin picks screens).  
- Deactivated accounts cannot sign in.  
- Profile is available to everyone.  
- Only admin manages admin and principal accounts.

**Notices**

- Nothing reaches parents until approved.  
- Administrative → Admin. Academic → Principal.  
- Teachers only target their own classes/students.  
- Rejected notices are not delivered; reason can be recorded.

**Academics**

- Students need a class and a parent.  
- Only admin and principal can delete students.  
- Parents see children read-only.  
- Linking a student to a parent updates that link (removed from other parents if reassigned).

**Transport**

- Live map only while driver has an **active** trip.  
- Driver must end trip before switching pick-up / drop mode.  
- Route needs bus, driver, and at least one stop.

**PTM**

- Parent submits → teacher approves or rejects → teacher marks complete after the meeting.

**Leads**

- Stages: New → Contacted → Visit → Enrolled (or Not interested / Closed).  
- Teachers see only assigned leads.

**Visitors**

- Deleting a visitor record requires a reason; it is stored in the audit log.

**Lists and files**

- Most directories: search, filter, paginate, CSV import/export where shown.  
- Required fields show an error if left empty.  
- Duplicate email on create is blocked.

---

# 13. Who can do what

**Legend:** ✓ = yes by default · P = only if admin assigned that screen · — = no · R = read only

| Area | Admin | Principal | Teacher | Parent | Driver | Front office / Coordinator |
|------|-------|-----------|---------|--------|--------|----------------------------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | P |
| Classes — manage | ✓ | ✓ | view | — | — | P |
| Teachers — manage | ✓ | ✓ | view | — | — | P |
| Students — manage | ✓ | ✓ | ✓* | R | — | P |
| Students — delete | ✓ | ✓ | — | — | — | P |
| Parents — manage | ✓ | ✓ | — | — | — | P |
| Admins / Principals | ✓ | — | — | — | — | P |
| Front office / Coordinators — manage | ✓ | ✓ | — | — | — | — |
| Transport setup | ✓ | ✓ | — | — | — | P |
| Live buses / trip history | ✓ | ✓ | — | — | — | P |
| Create notice | ✓ | ✓ | ✓ | — | — | P |
| Approve administrative notice | ✓ | — | — | — | — | P |
| Approve academic notice | — | ✓ | — | — | — | P |
| School messages | — | — | — | ✓ | — | — |
| PTM — request | — | — | — | ✓ | — | — |
| PTM — teacher queue | — | — | ✓ | — | — | — |
| PTM — staff history | ✓ | ✓ | — | — | — | P |
| Leads | ✓ | ✓ | assigned | create | create | P |
| Visitor log | ✓ | ✓ | ✓ | — | — | P |
| Driver map / routes | — | — | — | — | ✓ | — |
| Parent bus tracking | — | — | — | ✓ | — | — |
| Settings | ✓ | ✓ | — | — | — | — |
| Profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Teacher can add/edit students in assigned classes, not delete.

---

# 14. Common questions

**Can a teacher delete a student?**  
No. Only admin and principal can.

**Can parents edit student details?**  
No. They can only view their own children.

**Why is my notice still pending?**  
It needs approval. Administrative → admin. Academic → principal.

**Can teachers message the whole school?**  
Only their assigned classes, sections, or students.

**Why can’t parents see the bus on the map?**  
The driver must have **started** the trip. No active trip = no live map.

**How does a parent book a PTM?**  
PTM request → pick child and teacher → submit. Teacher approves with date and time.

**What is front office staff?**  
A user who only sees menus admin ticked for them — often visitor log or live buses.

**How do I reset my password?**  
Login page → Forgot password → email OTP → new password.

**Can I install this on my phone?**  
Yes. Use the browser install option or Add to Home Screen, then sign in as usual.

**Can I import many students at once?**  
Yes. Students screen → Import CSV (`fullName`, `room`, `parentEmail`).

---

# 15. Words we use

| Term | Meaning |
|------|---------|
| **Administrative notice** | School message under admin category — admin must approve. |
| **Academic notice** | School message under academic category — principal must approve. |
| **Pending** | Submitted but not approved yet — parents do not see it. |
| **Delivered** | Approved and sent to the target audience. |
| **Read report** | Who opened a notice after it was delivered. |
| **Active trip** | Driver pressed Start — GPS may be live. |
| **Pick-up point** | Bus stop on the map with time and linked students. |
| **Route** | Bus + driver + ordered stops (morning or evening). |
| **PTM** | Parent–Teacher Meeting. |
| **Lead** | Admission enquiry moving through stages. |
| **Menu access** | Checklist of screens for front office / coordinator. |
| **PWA** | Installable web app from the browser. |

---

# 16. Admin menu (quick list)

1. Dashboard  
2. Academics — Classes, Teachers, Students, Parents, Admins, Principals, Front office staff, Coordinators  
3. Transport — Live buses, History of trip, Bus drivers, Create buses, Pick up points, Routes  
4. Notices — Create Category, Create Notice, Notice approvals  
5. Operations — Visitor log, Leads  
6. PTM — PTM request, PTM history  
7. Settings (header)  
8. Profile · Log out  

---

**Document history**

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 16 Jun 2026 | First version |
| 1.1 | 16 Jun 2026 | Added how-it-works section |
| 1.2 | 16 Jun 2026 | Single merged guide: role flows first (admin → others), React/Node/Hostinger stack, plain language |

*End of document.*
