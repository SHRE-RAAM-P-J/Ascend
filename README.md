# Ascend 🚀

[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-339933.svg?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ecf8e.svg?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000.svg?style=flat-square&logo=vercel)](https://vercel.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg?style=flat-square)](#current-project-status)

> **Ascend** is a centralized, high-performance career-portal directory connecting candidates directly to the official, verified career pages of 140 leading global technology organizations — accompanied by an on-demand batch monitoring and automated health check engine that tracks portal availability in real time.

---

## 🌐 Live Deployment
* **Production URL:** `[Deployment Pending]` *(Will be updated upon final cloud deployment)*

---

## 📑 Table of Contents
- [Project Overview](#project-overview)
- [Screenshots & UI Reference](#screenshots--ui-reference)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Database Migration & Verification](#database-migration--verification)
- [Deployment on Vercel](#deployment-on-vercel)
  - [Environment Variables](#environment-variables)
  - [Vercel Deployment Steps](#vercel-deployment-steps)
- [Automated & On-Demand Health Monitoring](#automated--on-demand-health-monitoring)
  - [Status Classification Rules](#status-classification-rules)
  - [Monitoring REST Endpoints](#monitoring-rest-endpoints)
  - [Hourly Scheduled Monitoring (3 Strategies)](#hourly-scheduled-monitoring-3-strategies)
- [Current Project Status](#current-project-status)
- [Future Development Roadmap](#future-development-roadmap)
- [Author & Acknowledgements](#author--acknowledgements)

---

## Project Overview

Finding legitimate career opportunities across premier global technology firms often involves navigating through third-party job boards, outdated aggregators, and spam listings. **Ascend** solves this by providing:

1. **Direct Access:** One-click navigation (`target="_blank"` with `rel="noopener noreferrer"`) directly to official company career systems (Workday, Greenhouse, Lever, Taleo, and custom enterprise portals).
2. **Visual Directory:** An obsidian-dark, browser-window container featuring authentic company brand assets, live search filtering, and responsive grid cards.
3. **On-Demand & Automated Health Monitoring:** Tracks portal availability (`UP`, `DOWN`, or `UNKNOWN`) using database-backed batch leases that respect serverless timeouts and support manual one-click refresh with real-time progress.

---

## Screenshots & UI Reference

| Application Directory View | Dark Card Design Reference | Hand-Drawn Concept |
|:---:|:---:|:---:|
| ![Directory View](docs/screenshots/directory-browser-preview.png) | ![Card Reference](docs/screenshots/ui-design-reference.jpg) | ![Wireframe](docs/screenshots/hand-drawn-wireframe.png) |

---

## Key Features

- **140 Verified Companies:** Curated master dataset encompassing global enterprises, fast-growing tech companies, and multinational corporations.
- **Modern Browser-Window Container:** Sleek top-bar with window controls, simulated address bar (`ascend.directory/companies`), live search bar, and status pill.
- **Responsive Grid:** Adaptive layout transitioning seamlessly from 5 columns on desktop to 4, 3, and 1–2 columns on tablet and mobile devices.
- **Intelligent Brand Logo Engine:** Fetches 128px high-resolution official brand favicons with zero layout shifts and automatically falls back to an elegant 2-letter gradient badge.
- **On-Demand Batch Refresh:** Visitors can click **"Refresh Statuses"** to execute a controlled, serverless-compatible batch health check (10 portals per batch) with live progress tracking.
- **Resilient Database Storage:** Backed by PostgreSQL (Supabase transaction pooler on port 6543) with automatic fallback to local persistent JSON for local development.
- **Real-Time Status Badges:** Dynamic `UP` (green dot), `DOWN` (red dot), and `UNKNOWN` (neutral dot) badges with auto-refreshing human-readable relative timestamps (*"Checked just now"*, *"Checked 40 minutes ago"*).
- **Intelligent Outage Classification:** Distinguishes temporary bot protections (HTTP 403 / 429) from actual outages (5xx, DNS failures, connection timeouts) with single-retry verification before marking a portal as down.
- **Preserved Job Aggregators:** Microsoft Careers and Zoho Recruit collectors remain fully functional in the backend for upcoming aggregation phases.

---

## Technology Stack

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite 8.3
- **Networking:** Axios
- **Styling:** CSS Grid, Flexbox, Custom Properties, Glassmorphism (zero heavy CSS framework bloat)

### Backend
- **Runtime:** Node.js 24+
- **Framework:** Express 5.2
- **Database:** PostgreSQL (Supabase transaction pooling on port 6543) via `pg` pool
- **Security:** Helmet, express-rate-limit, SSRF URL Validator, reverse-proxy trust (`trust proxy 1`), strict CORS, request body limits (10kb)
- **HTTP Client:** Axios (with timeout, redirect, and retry control)
- **Deployment:** Vercel (unified static frontend + serverless backend via `vercel.json`)

---

## Architecture

```
                  +----------------------------------------------------+
                  |                    ASCEND FRONTEND                 |
                  |  - Browser Window Container                        |
                  |  - Responsive CSS Grid (5-col Desktop)             |
                  |  - Live Search Filter                              |
                  |  - On-Demand "Refresh Statuses" Orchestrator       |
                  |  - Relative Timestamp Refresh Engine (every 30s)   |
                  +-------------------------+--------------------------+
                                            |
         +----------------------------------+----------------------------------+
         | GET /api/monitoring/status                                          | POST /api/monitoring/refresh
         v (Read-only stored results)                                          v (Initiates batch job)
+---------------------------------------------------------------------------------------------------+
|                                       EXPRESS 5 BACKEND                                            |
|  Endpoints:                                                                                       |
|    - GET  /api/monitoring/status          (Fetch latest saved portal statuses)                     |
|    - POST /api/monitoring/refresh         (Create/retrieve active monitoring job)                 |
|    - POST /api/monitoring/refresh/:id/next (Process 10-company batch with lease lock)              |
|    - GET  /api/monitoring/refresh/:id     (Job progress & state inquiry)                          |
|    - POST /api/monitoring/refresh/:id/cancel (Cancel active job)                                  |
|    - GET  /api/monitoring/cron           (Scheduled runner with CRON_SECRET auth)                 |
|    - GET  /jobs                          (Microsoft & Zoho Aggregator)                           |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                   DATABASE & STORAGE LAYER                                        |
|  - PostgreSQL (Supabase via port 6543 transaction pooler)                                         |
|    ├── monitoring_results (140 portal uptime records, status, latencies, failure counters)       |
|    └── monitoring_jobs    (On-demand jobs, leases, batch offsets, concurrency lock)               |
|  - Local Fallback: backend/data/monitoringResults.json                                            |
+---------------------------------------------------------------------------------------------------+
```

---

## Repository Structure

```text
Ascend/
├── README.md                      # Comprehensive project documentation
├── vercel.json                    # Unified Vercel serverless + static routing configuration
├── .github/
│   └── workflows/
│       └── hourly-monitoring.yml  # Optional GitHub Actions hourly cron workflow
├── docs/
│   └── screenshots/               # Application captures and design references
│       ├── directory-browser-preview.png
│       ├── ui-design-reference.jpg
│       └── hand-drawn-wireframe.png
├── backend/
│   ├── package.json               # Backend dependencies, scripts & tests
│   ├── server.js                  # Main Express entry point, security middleware & routing
│   ├── .env.example               # Environment variable template
│   ├── db/
│   │   ├── client.js              # PostgreSQL client connection pool
│   │   ├── schema.sql             # Database schema (monitoring_results & monitoring_jobs)
│   │   ├── monitoringStore.js     # Storage abstraction (status, jobs, leases, fail-safe)
│   │   └── migrate.js             # Idempotent migration script (supports --dry-run)
│   ├── cache/                     # Cached job aggregator data
│   │   ├── jobs.json
│   │   ├── microsoft.json
│   │   └── zoho.json
│   ├── data/                      # Baseline seed data
│   │   ├── companies.json         # Master registered companies dataset (141 entries)
│   │   └── monitoringResults.json # Seed health check results (140 entries)
│   ├── routes/
│   │   └── monitoring.js          # REST endpoints for status, refresh, and cron
│   ├── services/
│   │   ├── healthMonitor.js       # Core monitoring engine, checkBatch, and retry logic
│   │   ├── fetchMicrosoftJobs.js  # Microsoft Careers collector
│   │   ├── fetchZohoJobs.js       # Zoho Recruit collector
│   │   └── updateJobs.js          # Aggregator cache updater
│   ├── utils/
│   │   └── ssrfValidator.js       # SSRF protection and IP/protocol validator
│   └── tests/
│       ├── monitoring.test.js     # Unit test suite for status classification & checkBatch
│       └── server.test.js         # Integration test suite for Express routes, CORS & cron
└── frontend/
    ├── package.json               # Frontend dependencies & Vite scripts
    ├── vite.config.js             # Vite configuration with /api proxy
    ├── index.html                 # Main HTML document
    └── src/
        ├── App.jsx                # Main layout composition
        ├── main.jsx               # React DOM entry point
        ├── index.css              # Obsidian global theme & canvas
        ├── data/
        │   └── companyData.js     # Frontend company definitions (141 entries)
        ├── utils/
        │   └── timeAgo.js         # Human-readable relative time formatter
        ├── components/
        │   ├── Navbar.jsx         # Ascend typography & header
        │   ├── CompanyDirectory.jsx # Browser container, search & refresh orchestrator
        │   └── CompanyCard.jsx    # Individual company tile with logo & status
        └── styles/
            ├── App.css
            ├── Navbar.css
            ├── CompanyDirectory.css
            └── CompanyCard.css
```

---

## Getting Started

### Prerequisites
- **Node.js** v24.0.0 or higher
- **npm** v10.0.0 or higher

---

### Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the automated test suites:
   ```bash
   npm test
   ```
   *Runs both `monitoring.test.js` and `server.test.js` in complete test isolation (100% pass).*

4. Start the development server:
   ```bash
   npm run dev
   ```
   *Starts on `http://localhost:5000` loading `.env` automatically via Node 24 native `--env-file`.*

---

### Frontend Setup

1. In a separate terminal tab, navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run linter and verify production build:
   ```bash
   npm run lint
   npm run build
   ```

4. Launch the development server:
   ```bash
   npm run dev
   ```
   *Vite starts on `http://localhost:5173` with automatic API proxy to `http://localhost:5000`.*

---

### Database Migration & Verification

Ascend includes an idempotent migration script that creates the necessary tables, indexes, and imports all 140 baseline monitoring results:

- **Dry-run simulation (offline, safe to run anytime):**
  ```bash
  npm run migrate:dry --prefix backend
  ```
- **Live migration (requires `DATABASE_URL` in `backend/.env`):**
  ```bash
  npm run migrate --prefix backend
  ```

---

## Deployment on Vercel

Ascend is configured for unified same-domain deployment on Vercel via [vercel.json](vercel.json).

### Environment Variables

Configure these environment variables in your **Vercel Project Settings → Environment Variables**:

| Variable | Required | Description | Example / Note |
|:---|:---:|:---|:---|
| `DATABASE_URL` | **Yes** | Supabase pooled connection string | `postgresql://postgres.[ref]:[password]@aws-1-[region].pooler.supabase.com:6543/postgres` |
| `CRON_SECRET` | Recommended | Secret token protecting the scheduled `/api/monitoring/cron` endpoint | Any random 32+ character string |
| `CORS_ORIGIN` | Optional | Custom production domain(s) if not using default `.vercel.app` | `https://ascend.directory` |
| `NODE_ENV` | Optional | Set to `production` in production environment | `production` |

> 🔒 **Security Notice:** `DATABASE_URL` is used strictly on the serverless backend. It is never exposed to client-side code.

---

### Vercel Deployment Steps

1. **Push your repository** to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** and import the repository.
3. Keep default build settings (Vercel automatically detects [vercel.json](vercel.json)).
4. Add the **Environment Variables** (`DATABASE_URL`, `CRON_SECRET`).
5. Click **"Deploy"**.
6. Run the initial database migration against your Supabase instance:
   ```bash
   npm run migrate --prefix backend
   ```
7. Open your deployed Ascend URL!

---

## Automated & On-Demand Health Monitoring

### Status Classification Rules

| Response / Error | Status | Description |
|:---|:---:|:---|
| **HTTP 2xx (200–299)** | `UP` | Career page returned successfully |
| **HTTP 3xx (301, 302, 307)** | `UP` | Portal redirected to secure or regional destination |
| **HTTP 5xx (500, 502, 503)** | `DOWN` | Server outage (confirmed after 1x retry) |
| **HTTP 404 / 410** | `DOWN` | Dead or decommissioned careers URL |
| **DNS (ENOTFOUND, EAI_AGAIN)** | `DOWN` | Domain resolution failure |
| **Timeout (ETIMEDOUT, 15s)** | `DOWN` | Connection timeout (confirmed after 1x retry) |
| **HTTP 403 / 429** | `UNKNOWN` | Bot challenge / Cloudflare protection (not an outage; preserves prior UP state) |
| **HTTP 401** | `UNKNOWN` | Restricted corporate career portal |

---

### Monitoring REST Endpoints

- `GET /api/monitoring/status`: Read-only. Returns current saved health statuses and aggregate summary. Never executes health checks on read.
- `POST /api/monitoring/refresh`: Starts or retrieves an on-demand refresh job (rate-limited to 2 requests per minute per IP).
- `POST /api/monitoring/refresh/:jobId/next`: Serverless-friendly batch check (processes 10 companies per call with lease concurrency lock).
- `GET /api/monitoring/refresh/:jobId`: Returns current job progress percentage and state.
- `POST /api/monitoring/refresh/:jobId/cancel`: Cancels an active job.
- `GET /api/monitoring/cron`: Scheduled hourly endpoint. Requires `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`.

---

### Hourly Scheduled Monitoring (3 Strategies)

1. **Vercel Cron Jobs (Built-in via `vercel.json`):**
   - Configured in [vercel.json](vercel.json) to trigger `/api/monitoring/cron`.
   - On Vercel Pro plans, executes hourly (`0 * * * *`). On Vercel Hobby plans, runs once daily.
2. **GitHub Actions Hourly Workflow (Free for Hobby users):**
   - Included at [.github/workflows/hourly-monitoring.yml](.github/workflows/hourly-monitoring.yml).
   - Set repository secrets `ASCEND_APP_URL` and `CRON_SECRET` to automatically trigger `/api/monitoring/cron` at minute 0 of every hour for free.
3. **Persistent Server Hosts (Docker, Render, VPS):**
   - Set `ENABLE_CRON=true` to utilize the built-in `node-cron` scheduler inside `healthMonitor.js`.

---

## Current Project Status

- [x] **Frontend Redesign & Directory UI**
  - [x] All 140 active companies displayed in responsive CSS Grid.
  - [x] Real-time client search filtering with live count.
  - [x] High-res official brand logos with dynamic 2-letter fallback badges.
  - [x] On-demand "Refresh Statuses" button with animated spinner and progress bar.
- [x] **Backend & Health Monitoring Engine**
  - [x] Controlled batch checking (10 companies per invocation) preventing serverless timeouts.
  - [x] 15-second timeout, redirect handling, and automatic failure retry.
  - [x] Bot protection preservation (HTTP 403/429 never marks known UP portals as false DOWN).
  - [x] SSRF URL validation blocking localhost, private subnets, and cloud metadata IPs.
  - [x] Reverse-proxy trust configuration (`trust proxy 1`) for accurate rate limiting.
- [x] **Database & Serverless Deployment Readiness**
  - [x] PostgreSQL schema with `monitoring_results` and `monitoring_jobs`.
  - [x] Partial unique index preventing duplicate concurrent monitoring jobs.
  - [x] Automatic 30-minute stale job cleanup and lease recovery.
  - [x] Idempotent data migration script with verified `--dry-run` simulation.
  - [x] Unified Vercel configuration (`vercel.json`) with 60-second function duration budget.
  - [x] 100% passing unit and integration test suite (15/15 tests).

---

## Future Development Roadmap

- [ ] **Industry Taxonomy & Filtering:** Filter companies by industry sector (Semiconductor, Enterprise SaaS, AI/ML, Fintech, Cloud Infrastructure).
- [ ] **Uptime Analytics & SLA:** Historical uptime charts and average response latency graphs per company.
- [ ] **Web Hook Outage Alerts:** Slack/Discord webhook alerts when monitored career portals experience outages.
- [ ] **Job Aggregation UI:** Display live job listings collected from Microsoft Careers and Zoho Recruit integrations.

---

## Author & Acknowledgements

- **Author:** Developed for the **Ascend** platform.
- **Brand Assets:** Favicon resolution powered by Google's global CDN service.

---

<p align="center">
  <b>Your Gateway to Opportunities | Powered by Ascend</b>
</p>
