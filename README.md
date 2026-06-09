# TUKLAS

A centralized missing- and unidentified-persons information system for Baguio
City — more than a public bulletin board. It unifies community reporting, proof
verification, a searchable case database, geo-mapping, and automated
missing-to-unidentified matching behind secure, role-based staff access, so no
credible lead is overlooked and every case is properly documented.

> **TUKLAS** — Filipino for *"to discover / to find."*

## Description

TUKLAS is a community-driven platform that connects the public, barangay and
police documentation, and authorized administrators around a single verified
record of missing and unidentified persons in Baguio City, Philippines. Anyone
can submit a report with photos and supporting proof and later track its status
by reference number; the public can browse and map verified cases; and trained
staff verify reports, manage cases, and review system-suggested matches behind
role-based logins — bridging the gap between public reporting and official
investigation.

## Problem

When someone goes missing in a city like Baguio, the search is fragmented across
disconnected channels, and that fragmentation costs time when time matters most:

- **Scattered reporting** — tips live in social-media posts, group chats, and
  barangay paperwork, with no single place to look or submit.
- **No verification** — unverified posts spread misinformation and erode trust,
  while genuine cases get buried.
- **Missing ↔ unidentified disconnect** — a missing-person report and a separate
  unidentified-person record are rarely cross-referenced, so obvious matches go
  unnoticed.
- **No spatial picture** — without mapping cases by location and date, patterns
  and clusters stay invisible.
- **No accountability or privacy control** — sensitive details (minors, reporter
  contacts, active investigations) get exposed, with no audit trail of who
  changed what.

## Solution

TUKLAS replaces those scattered channels with one verified, accountable system:

- **Public Reporting** — a guided multi-step form to submit missing- or
  unidentified-person reports with photos and supporting documents (police
  reports, barangay certifications, news links).
- **Status Tracking** — every submission gets a case reference number reporters
  can use to follow its progress (pending, verified, resolved, or rejected with a
  reason).
- **Verification Workflow** — staff review every report before it goes public;
  false or misleading submissions are rejected to protect credibility.
- **Searchable Database** — a public, filterable record of verified cases
  (by barangay, type, and gender) to maximize visibility.
- **Interactive Geo-Map** — cases plotted on a Leaflet/OpenStreetMap view to
  surface location patterns and connections.
- **Automated Case Matching** — a scoring engine suggests likely missing ↔
  unidentified pairs from gender, age, geographic proximity, and physical
  description, which staff confirm, flag, or dismiss.
- **Role-Based Admin Portal** — Super Admin, System Owner, Admin, and Moderator
  roles, each limited to the actions their responsibility requires.
- **Immutable Audit Trail** — every privileged action is logged to an
  append-only record that cannot be edited or deleted.

**Built with** Next.js 16 (App Router) and TypeScript on the frontend, an Express
API on the backend, and Supabase (PostgreSQL + PostGIS, Auth, and Storage) for
data, authentication, and file hosting — deployed on Vercel.

### Roles

| Role | Capabilities |
| --- | --- |
| **Super Admin** | Full system access; unrestricted management of all staff profiles. |
| **System Owner** | Create and update Admin and Moderator accounts. |
| **Admin** | Insert, update, delete, and verify cases; manage matches. |
| **Moderator** | Read and update cases (e.g. flag, annotate) — no delete. |

## Impact

- **Centralizes a fragmented search** into one place to report, verify, browse,
  and map every case.
- **Verification before publication** keeps the public record credible and curbs
  misinformation.
- **Automated matching surfaces connections** between missing and unidentified
  persons that manual review would miss — accelerating identification.
- **Geo-mapping turns scattered reports into spatial insight** for families,
  communities, and law enforcement.
- **Privacy-first handling** protects minors, reporter contacts, and active
  investigations through admin-controlled visibility.
- **Role-based access and an immutable audit log** make every privileged action
  accountable and traceable.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **UI & Maps:** Leaflet / React-Leaflet (OpenStreetMap), SWR, Montserrat
- **Backend:** Node.js, Express (ESM), Supabase JS client
- **Data:** Supabase — PostgreSQL 14+ with PostGIS (geospatial) and pgcrypto,
  Row-Level Security, Supabase Auth, Supabase Storage
- **Matching Engine:** in-house Node.js scorer (gender + age + haversine
  proximity + TF-IDF description similarity) — no external APIs
- **Security:** Helmet (CSP/HSTS), CORS allowlist, rate limiting, magic-byte file
  validation, httpOnly session cookies, append-only audit logs
- **Tooling & Deployment:** Vercel (frontend + serverless API), ESLint,
  XLSX import/export

## Project Structure

```
TUKLAS/
├── frontend/                 # Next.js 16 App Router — public site + admin portal
│   ├── src/app/              # Routes: home, report, track, cases, map, about, login, admin
│   ├── src/components/       # UI components (Hero, Map, ReportForm wizard, Admin tables…)
│   ├── src/context/          # AuthContext (session + role)
│   └── src/lib/api.ts        # Typed fetch client for the backend API
└── backend/                  # Express API (Supabase-backed)
    ├── src/routes/           # auth, cases, profiles, matches
    ├── src/lib/matcher.js    # Case-matching engine
    ├── src/middleware/       # requireAuth / requireRole (RBAC)
    └── sql/                  # schema.sql, migrations, barangay seed data
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project with the **PostGIS** and
  **pgcrypto** extensions enabled, plus `case-photos` and `case-proofs` Storage
  buckets

### Database

Run the schema (and any migrations) against your Supabase database, then seed the
barangay lookup table:

```bash
# in the Supabase SQL editor or via psql
backend/sql/schema.sql
backend/sql/seed_barangays.sql
backend/sql/migrations/*.sql
```

### Backend

```bash
cd backend
npm install
# create .env (see below)
npm run dev          # http://localhost:4000
```

`backend/.env`:

```ini
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only, never expose
FRONTEND_URL=http://localhost:3000             # comma-separated list allowed
SUPABASE_STORAGE_BUCKET=case-photos
SUPABASE_PROOF_BUCKET=case-proofs
NODE_ENV=development
PORT=4000
```

### Frontend

```bash
cd frontend
npm install
# create .env.local
npm run dev          # http://localhost:3000
```

`frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Credits

Developed by a team of researchers and developers from the **University of
Baguio**, applying technology for social good in partnership with the community
and local authorities: Lorden Xavier Alvaro, Fiona Alcantara, Elysha Margaret
Bianan, Luane Hernandez, Jomar Poclan, John Paulo Tasane, and Mary Joyce
Villanueva.
