# Multi-Tenant Operational & Task Management Platform (Phase 1)
**KOart Solutions — Digital Engineering Practice**  
*Document Reference: KO-OPS-2026-PH1 · Date: November 7, 2026*

---

## 1. Executive Summary & Purpose
This platform is a cloud-native, multi-tenant operational SaaS web application built on a decoupled Client-Server architecture. It enforces strict workspace isolation between **Company Accounts** (single-organization limit) and **Individual Controller Accounts** (multi-organization umbrella), backed by relational persistence for financial/task valuation and an automated WhatsApp dispatch pipeline.

---

## 2. Directory Structure (`koart project 1`)

```
koart project 1/
├── server.js                      # High-speed HTTP Server & Static SPA Dispatcher
├── package.json                   # Project Manifest & Metadata
├── start-platform.bat             # 1-Click Launch Script (starts server & opens browser)
├── README.md                      # Comprehensive Architecture & API Documentation
├── server/
│   ├── db.js                      # Relational Database Engine (PostgreSQL 16 Schema & Triggers)
│   ├── routes.js                  # REST API Route Controllers
│   ├── analytics.js               # Mathematical Scoring Engine & 5 Core Reports
│   ├── whatsapp.js                # WhatsApp Job Card & Follow-Up Serializer
│   └── data/
│       └── platform-db.json       # Auto-persisted JSON Database
└── public/
    ├── index.html                 # Single Page Application (Dashboard, Calendar, Jobs, Reports)
    └── assets/
        └── koart-logo.png         # KOart Official Brand Logo
```

---

## 3. Technology Stack & Architectural Justification

| Layer | Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Presentation Layer (SPA)** | Single Page Application (HTML5 / ES6 / CSS3 / KOart Design System) | High-speed SPA with zero server-rendering latency, dark obsidian / light theme support, and responsive layouts. |
| **Styling & UI Tokens** | CSS3 Custom Properties, Bricolage Grotesque, DM Sans, Space Mono | KOart agency branding with signature crimson (`#db0031`), sleek cards, and glowing badges. |
| **API Gateway** | Node.js REST API Layer | Stateless JSON REST endpoints enforcing multi-tenant isolation (`x-company-id`). |
| **Persistence & Triggers** | PostgreSQL 16 DDL Schema via Transactional Engine | Multi-table relational integrity, SQL triggers for account limits, and audit logs. |
| **Dispatch & Messaging** | WhatsApp Serializer (`wa.me` Deep Links + JSON Payloads) | Zero-friction employee adoption (staff don't need app downloads or passwords). |

---

## 4. Multi-Tenant Security & 3-Layer Isolation Model

1. **Layer 1 — Account Tier Provisioning**:
   - `account_type = 'company'` sets `max_companies = 1`.
   - `account_type = 'individual'` sets `max_companies = 999`.
2. **Layer 2 — Database Trigger Limit Enforcement**:
   - Simulated `BEFORE INSERT` trigger aborts company registration when current count exceeds `max_companies`.
3. **Layer 3 — Tenant Context Middleware (`x-company-id`)**:
   - Every workspace request requires `x-company-id` header to ensure complete data isolation.

---

## 5. Core Mathematical Analytics Specifications

The platform computes staff productivity, SLA compliance, and financial realization using the deterministic formulas from Section 6 of the technical proposal:

1. **Fair Target Denominator ($N_{valid}$)**:
   Excludes client-cancelled stopped jobs ($stop\_category = \text{'client\_cancelled'}$) so staff are never penalized for external cancellations:
   $$N_{valid} = N_{assigned} - N_{client\_stopped}$$

2. **Task Completion Rate ($R_{comp}$)**:
   $$R_{comp} = \min\left(100, \left[\frac{N_{completed}}{\max(1, N_{valid})}\right] \times 100\right)$$

3. **Two-Tier Punctuality ($R_{strict}$ vs $R_{ext}$)**:
   - **Strict First-Time On-Time**:
     $$R_{strict} = \left[\frac{\text{Count}(\text{Completed where } completed\_at \le original\_due\_date)}{\max(1, N_{completed})}\right] \times 100$$
   - **Extended On-Time**:
     $$R_{ext} = \left[\frac{\text{Count}(\text{Completed where } completed\_at \le current\_due\_date)}{\max(1, N_{completed})}\right] \times 100$$

4. **Follow-Up & Extension Efficiency Score ($E_{eff}$)**:
   Deducts 10% per WhatsApp follow-up ($F_j$) and 15% per staff-caused deadline extension ($S_j$):
   $$E_{eff} = \max\left(0, 100 - \left[\frac{\sum (10 \times F_j + 15 \times S_j)}{\max(1, N_{valid})}\right]\right)$$

5. **Composite Staff Productivity Score ($S_{prod}$)**:
   $$S_{prod} = \text{ROUND}((0.45 \times R_{comp}) + (0.35 \times R_{strict}) + (0.20 \times E_{eff}), 1)$$

---

## 6. The 4 Overdue Resolution Pathways

When any task exceeds its scheduled deadline, the system highlights it for 4 structured pathways:

- **Pathway 01 — Extend Until (+ Time)**: Sets a new deadline date/time while preserving the original deadline for SLA audit integrity. Segregates internal staff delays from client delays.
- **Pathway 02 — Stop Task (Halt Work)**: Immediately halts billing, categorizes reason (`client_cancelled`, `staff_issue`, `other`), and protects productivity quotas.
- **Pathway 03 — Reassign Job (Transfer)**: Reassigns the task to another staff member and generates a WhatsApp transfer dispatch.
- **Pathway 04 — Mark as Completed (Verified Delivery)**: Realizes 100% of stated value and records strict vs extended on-time metrics.

---

## 7. Authentication, Registration & Guided Onboarding Portals

The application provides dedicated, branded portals for account management, authentication, and workspace onboarding:

### A. Authentication Portal (Sign In)
- Located on initial load or via the top-bar profile menu (**"Switch Account / Sign In"**).
- Includes an instant **One-Click Autofill Pill** for rapid testing:
  - **Email**: `director@koart.lk`
  - **Password**: `admin123`

### B. Dual-Tier Registration Portal
- Allows creating new accounts with an interactive architectural tier choice:
  1. **🏢 Company Account (Single Org Limit)**:
     - Hard database limit of **1 workspace** (`max_companies = 1`).
     - Ideal for single agency studios, independent marketing firms, and standalone business entities.
     - Database triggers abort attempts to provision additional companies beyond 1.
  2. **👑 Individual Controller (Multi-Org Switcher)**:
     - Multi-business controller enabling up to **999 workspaces** (`max_companies = 999`).
     - Ideal for agency owners, group founders, and serial entrepreneurs managing multiple client brands or subsidiaries.
     - Features the **Top-Bar Company Switcher** for instantaneous switching between workspaces.

### C. Guided Workspace Onboarding Wizard (Workflow Step 1)
- Triggered automatically when a new user registers or when clicking **"+ Register Business Workspace"**:
  - **Step 1: Organization Blueprint**: Workspace Name, Category, and Valuation Currency (LKR, USD, EUR, GBP, AUD, AED).
  - **Step 2: Team Member & WhatsApp Channel Provisioning**: Primary Team Lead Name, Designation, and WhatsApp Phone Number (E.164 formatted for automated dispatch).

### D. User Profile & Navigation Controls
- Located in the top right of the navigation bar:
  - Displays user avatar initials, user name, and active tier tag (`Single Org` vs `Multi-Controller`).
  - Dropdown menu allows registering new workspaces, switching accounts, and signing out.

---

## 8. How to Launch & Run

1. **Option A (One-Click Launcher)**:
   - Double-click `start-platform.bat` inside this folder.
2. **Option B (Terminal)**:
   ```bash
   cd "E:\KOart-Digital-Agency-Website-main\KOart-Digital-Agency-Website-main\koart project 1"
   node server.js
   ```
3. Open your browser at **`http://localhost:3000`**.

