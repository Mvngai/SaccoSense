# SaccoSense – Project Guide

## 1. Project Overview

SaccoSense is my final-year BSc Computer Science project at Dedan Kimathi University of Technology (DeKUT). Its official project title is **"Intelligent Web-Based Savings and Credit Cooperative Management System for Small and Medium-Sized SACCOs in Kenya."**

The goal is to develop a functional, intelligent and mobile-responsive web application that simplifies SACCO operations, improves financial record management and supports informed decision-making. It targets small and medium-sized Kenyan SACCOs that may not have access to complex or expensive management systems.

The project should eventually meet professional industry standards, with potential for further development and scaling for commercial use. However, the immediate priority is completing a functional, well-structured MVP.

## 2. What SaccoSense Is and Its Tech Stack

SaccoSense is a web-based SACCO management system.

**Planned technology stack:**
- HTML – Page structure.
- CSS – Styling, layouts and responsiveness.
- JavaScript – Client-side functionality and interaction.
- Supabase – Backend services, authentication and database management. (i'll move from this when scaling)
- PostgreSQL – Database (provided through Supabase).
- GitHub – Version control and project repository.
- Vercel – Website deployment and hosting. (i would like to move to other services when scaling)
- Figma – UI/UX planning and design. (When necessary)
- On scaling (after MVP completion), I might choose to move from Supabase to Django & PostgreSQL for backend

Do not introduce additional frameworks, libraries or technologies without discussing their necessity first.

## 3. Core Features and Scope

The planned application modules are:

1. **Member Management:** Register members, update personal information and maintain member records.
2. **Savings Management:** Record deposits, monitor savings balances and track contributions.
3. **Loan Management:** Handle loan applications, approvals and disbursements.
4. **Guarantor Management:** Assign and manage loan guarantors.
5. **Repayment Tracking:** Monitor repayment schedules, outstanding balances and overdue payments.
6. **Financial Reporting:** Generate reports on savings, loans, repayments and other SACCO transactions.

**Potential intelligent features (to be considered after establishing the core system):**
- AI-assisted credit scoring.
- Personalized financial insights.
- Rule-based detection of unusual transactions or suspicious activity.
- QR-code-based member identification.

These features are part of the broader project vision but should not delay completion of the core MVP.

**Deferred features:** I'll handle these after completing the mvp
- Email and SMS notifications.
- M-Pesa integration.
- Advanced role-based access control.

Authentication and appropriate database access security are still necessary. Never compromise security simply because advanced access-control features are deferred.

## 4. Application Structure and User Roles

SaccoSense will use separate HTML pages rather than one large HTML file.

The application will serve two primary users:
- SACCO administrators.
- SACCO members.

Initially, development should focus on the administrator experience. The application should eventually identify the logged-in user's role and display the appropriate dashboard and functionality.

The agreed development order is:

1. Login page.
2. Administrator dashboard.
3. Member dashboard.
4. Member management.
5. Savings management.
6. Loan management.
7. Guarantor management.
8. Repayment tracking.
9. Financial reports.

Complete and test each major stage before moving to the next.

## 5. Design and UI Conventions

Maintain a consistent visual identity across the application, based on the existing SaccoSense landing page.

**colour palette:**
- Burgundy: `#5B0E2D`
- Oxford/Navy Blue: `#002147`
- Background: White / `#FDFBF7`

**Design principles:**
- Clean, professional and minimalistic layouts.
- Consistent typography, spacing and colour usage.
- Responsive layouts for desktop, tablets and mobile devices.
- Clear navigation and intuitive interfaces.
- Use statistic cards, tables, sidebars, navigation panels or other features where appropriate.
- Application pages should have both a top navigation bar and a sidebar.
- The landing page may retain its slightly different layout while maintaining the same branding.

Avoid unnecessary decorative elements and overly complicated interfaces.

## 6. Code Organisation

The agreed initial project structure is:

```text
SaccoSense/
│
├── index.html
│
├── css/
│   ├── style.css
│   └── login.css
│
├── js/
│   ├── script.js
│   └── login.js
│
├── pages/
│   └── login.html
│
└── images/
```

Additional files should be introduced as the application grows. 

**Conventions:**
- Keep `index.html` in the project root.
- Keep application pages inside `pages/`.
- Keep CSS inside `css/` and JavaScript inside `js/`.
- Use relative paths when linking files.
- Use separate CSS files where page-specific styling is necessary.
- Reuse shared styling where appropriate. To promote uniformity, consistency and simplicity
- Use descriptive class names and IDs.
- Keep code readable and properly indented. Use comments for me to be able to follow through and understand
- Keep credentials out of CLAUDE.md I'd rather create a separate .env file for those

## 7. How to Run and Test

**Local development:**
1. Open the SaccoSense project folder in VS Code.
2. Open `index.html` in a browser, preferably using the VS Code Live Server extension.
3. Navigate between pages using their relative links.
4. Check the browser's developer tools, especially the Console, when troubleshooting errors.

**Testing:**
- Check that all navigation links work.
- Check that CSS and JavaScript files load correctly.
- Test forms and interactive elements.
- Test layouts at desktop and mobile screen sizes.
- Check browser Console errors.
- Test Supabase operations when backend integration is introduced.

**Deployment:**
- Push project changes to the GitHub repository. Ask for my clearance when doing this.
- Test the deployed version independently of the local version.

## 8. Security and Sensitive Information

Passwords, API keys, access tokens, database credentials and other secrets are NOT ordinary application code.

Whenever introducing or discussing a credential or secret:
- Clearly identify it as a **SECRET / CREDENTIAL**, rather than ordinary code.
- Explain where it comes from and where it should be stored.
- Use obvious placeholders in examples, such as `YOUR_SUPABASE_ANON_KEY`.
- Never hardcode secret keys into publicly accessible frontend files.
- Never expose Supabase service-role keys in frontend JavaScript.
- Use environment variables and appropriate Supabase Row Level Security (RLS) policies.
- These can be instead stored in an env. file instead.

When showing a code example containing credentials, clearly distinguish the credential placeholders from normal code so I understand the difference.

## 9. Working and Communication Instructions

I am a university student learning programming. I understand the basics of HTML and CSS but am still developing my JavaScript and backend skills.

Your role is to help me build SaccoSense while ensuring I understand the implementation.

Follow these instructions:

1. **Do not overcomplicate things.** Prioritise a functional MVP before advanced features.
2. Explain important code sections, particularly JavaScript, database operations and frontend-backend communication.
3. Do not simply provide code for me to copy and paste. Explain what important changes do and why they are necessary.
4. Before implementing something, ask clarifying questions if the requirements are unclear.
5. Do not make major architectural or design changes without discussing them first.
6. When debugging, identify the likely cause of the problem before proposing a fix.
7. Prefer minimal changes to existing working code rather than unnecessary restructuring.
8. Be honest when uncertain. Do not invent functionality, technical details or successful test results.
9. Consider security, maintainability and scalability, but do not introduce unnecessary complexity into the MVP.
10. Help me understand the project well enough to explain and defend its implementation academically.

I will provide existing HTML and CSS files as design references. Use them to maintain consistency rather than introducing an entirely different design.

For pages I request you to build, provide complete HTML and CSS separately. JavaScript can be introduced and explained as functionality becomes necessary.

Before building anything ask questions (suggections are allowed) until a mutual understanding is reached for what should be built/implemented.

## 10. Current Status / Next Steps

**Last updated: 21 November 2026**

### Completed
- Created the SaccoSense landing page (`index.html` and `style.css`).
- Established the project folder structure.
- Created the login page using separate HTML and CSS files.
- Implemented the two-section login design with a centred SaccoSense wordmark and vertical divider.
- Login JavaScript (`js/login.js`): show/hide password, an Admin/Member role selector and "Remember me". On submit it saves a temporary session in the browser and redirects admins to the dashboard and members to the coming-soon page.
- Shared app layout (`css/app.css`, `js/app.js`), used by every logged-in page: collapsible sidebar (slides in on phones), top bar, notifications dropdown, profile dropdown with logout, a role guard that sends users who aren't logged in back to the login page, and shared helpers (`SaccoUI`: currency/date/phone formatting, HTML escaping, toast messages).
- Temporary data layer (`js/data.js`, exposed as `SaccoData`): sample members, transactions, loans and notifications stored in `localStorage`. Pages only get data through these functions, so they can later be switched to Supabase queries without changing the pages. Includes a "Reset sample data" option for testing.
- Administrator dashboard (`pages/admin/dashboard.html`, `css/dashboard.css`, `js/dashboard.js`):
  - Stat cards for total members, total savings and repayment rate.
  - Recent transactions table with type filter tabs, search (kept in sync with the top-bar search), date/amount sorting and 10 rows per page.
  - "Record Transaction" pop-up with validation that updates savings balances. Withdrawals can't exceed the member's savings.
  - Transaction details pop-up.
- Shared placeholder page (`pages/coming-soon.html?page=...`) for sidebar links whose pages aren't built yet.
- Member dashboard (`pages/member/dashboard.html`, `css/member-dashboard.css`, `js/member-dashboard.js`). It reuses `app.css` and `dashboard.css` so it matches the admin dashboard:
  - Member sidebar: Dashboard, My Savings, My Loans, Statements, Settings, Logout. The pages other than Dashboard point to coming-soon for now.
  - The profile shows the member number (e.g. SS-0011) under the name instead of "Admin".
  - Cards: My Savings; Outstanding Loan with a repayment progress bar; Next Repayment (amount and due date, highlighted when due within 7 days or overdue).
  - "My Recent Activity" table (newest first, 5 rows per page) with filter tabs, search synced with the top bar, and a read-only details pop-up. Members have no record or edit actions.
  - Notifications are scoped: admins see admin notifications, and each member sees only their own.
- Data layer changes (`js/data.js`, storage key bumped to `saccosense_db_v2`):
  - Loans gained `term_months`, `monthly_installment`, `installments_paid`, `amount_repaid` and `next_due_date`. Interest isn't included yet.
  - Notifications gained `member_id`.
  - New `getMyAccount()` returns only the logged-in member's data.
  - A completed repayment recorded by the admin now reduces the member's loan balance.
- Member login (superseded on 21 Nov by Supabase Auth, below). The example member is **Brian Odhiambo, `brian.odhiambo@example.com`, SS-0011**, with loan LN-0007 (80% repaid).
- **Supabase connected (20–21 November 2026, done as a fast "speed run"; not yet fully understood by me, see next steps):**
  - `supabase/schema.sql`: tables `members`, `transactions`, `loans`, `notifications`, `profiles` (holds each login's role: admin/member + `member_id`); helper functions `is_admin()` and `my_member_id()`; RLS policies (admins read everything, members read only their own rows, anon reads nothing); DB functions `record_transaction()` (validates, saves and updates balances/loan in one step) and `mark_notifications_read()`; the same sample data as before. Run once in the Supabase SQL Editor.
  - `supabase/link-users.sql`: gives Auth users a role (admin by email, members by matching `members.email`). Run after creating users.
  - `js/supabase-config.js`: Project URL + publishable key (public by design; the service_role key must never go here).
  - `js/data.js`: same `SaccoData` function names, now Supabase queries. Adds `SaccoData.ready` (Promise that resolves once the logged-in user and role are loaded) and `signIn()`. "Reset sample data" removed.
  - `js/login.js`: real email + password login; role comes from the `profiles` table, and the selected Admin/Member tab must match it.
  - `js/app.js`, `js/dashboard.js`, `js/member-dashboard.js`, `pages/coming-soon.html` wait for `SaccoData.ready` before running.
  - supabase-js 2.45.4 loaded from the jsDelivr CDN on each page.
  - Test accounts (created in Supabase Auth): `admin@example.com` (admin, Grace Wanjiku) and `brian.odhiambo@example.com` (member SS-0011). Passwords are known only to me, not stored in the project.
  - Tested in the browser: admin login and dashboard, recording a transaction (persists after refresh), member login showing only Brian's data, wrong-role and wrong-password errors.

### Current stage
Stages 1–3 (login, admin dashboard, member dashboard) now run on **Supabase** with real authentication and RLS. Data lives in the Supabase PostgreSQL database, not `localStorage`.

### Outstanding issues / notes
- **Understanding gap:** the Supabase connection was done quickly for a deadline. I still need a walkthrough of how it works (see next steps) before I can explain or rebuild it.
- New members can't get a login yet. Agreed plan for stage 4 (option A): admin adds the member record; the member activates their own account on an "Activate account" page (Supabase signUp); a DB trigger links the login to the member record only if the email matches. Keep "Allow new users to sign up" ON and email confirmation ON for this.
- Supabase project credentials: only the URL and publishable key are in the project (`js/supabase-config.js`). A `.env` file isn't usable without a build tool; revisit if a build step is added later.
- The repayment rate uses simple instalment counts stored on each loan record. It will need a proper repayment schedule table later.
- The project folder is not yet a Git repository, so nothing has been pushed to GitHub and nothing is deployed on Vercel.
- Recording a repayment doesn't yet move a loan's `next_due_date` forward or update instalment counts. That belongs to Repayment Tracking (stage 8).
- Sample due dates are fixed (e.g. Brian's is 20/11/2026), so the Next Repayment card will show "overdue" once those dates pass.
- Member dashboard mobile layout still to be checked in the browser.

### Next steps
1. **Immediate: learning session on the Supabase connection** (before building more): the client/server picture, tables and `profiles`, Supabase Auth, RLS policies, `SaccoData.ready`/async, `record_transaction()`. Goal: be able to explain and rebuild it.
2. Build member management (stage 4), including the account activation flow above.
3. Set up the Git repository and GitHub (with my clearance before pushing).
4. Continue with savings, loans, guarantors, repayments and reports in the agreed order.

**Update this section (10) at the end of every development session.** Record what was completed, the current state of the project, outstanding issues and the immediate next task. Do not assume a feature is complete merely because its frontend has been created.