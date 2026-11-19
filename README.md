# Ascend 🚀

[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active%20Development-success.svg?style=flat-square)](#current-project-status)

> **Ascend** is a centralized, high-performance career-portal directory connecting candidates directly to the official, verified career pages of 140 leading global technology organizations — accompanied by an automated, scheduled health monitoring engine that tracks portal availability in real time.

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
- [Environment Variables](#environment-variables)
- [Automated Health Monitoring](#automated-health-monitoring)
- [Current Project Status](#current-project-status)
- [Future Development Roadmap](#future-development-roadmap)
- [Author & Acknowledgements](#author--acknowledgements)

---

## Project Overview

Finding legitimate career opportunities across premier global technology firms often involves navigating through third-party job boards, outdated aggregators, and spam listings. **Ascend** solves this by providing:

1. **Direct Access:** One-click navigation (`target="_blank"` with `rel="noopener noreferrer"`) directly to official company career systems (Workday, Greenhouse, Lever, Taleo, and custom enterprise portals).
2. **Visual Directory:** An obsidian-dark, browser-window container featuring authentic company brand assets and responsive grid cards.
3. **Automated Health Monitoring:** An autonomous background scheduler that verifies every careers portal every 60 minutes, recording uptime, latency, and status (`UP`, `DOWN`, or `UNKNOWN`).

---

## Screenshots & UI Reference

| Application Directory View | Dark Card Design Reference | Hand-Drawn Concept |
|:---:|:---:|:---:|
| ![Directory View](docs/screenshots/directory-browser-preview.png) | ![Card Reference](docs/screenshots/ui-design-reference.jpg) | ![Wireframe](docs/screenshots/hand-drawn-wireframe.png) |

---

## Key Features

- **140 Verified Companies:** Curated master dataset encompassing global enterprises, fast-growing tech companies, and multinational corporations.
- **Modern Browser-Window Container:** Sleek top-bar with macOS-inspired window controls, simulated secure address bar (`ascend.directory/companies`), and active status pill.
- **Responsive 5-Column Grid:** Adaptive layout transitioning seamlessly from 5 columns on desktop to 4, 3, and 1–2 columns on tablet and mobile devices.
- **Intelligent Brand Logo Engine:** Fetches 128px high-resolution official brand favicons with zero external layout shifts and automatically falls back to an elegant 2-letter gradient badge.
- **Automated Hourly Health Checks:** Built-in `node-cron` service automatically pings all registered URLs every 60 minutes with 15-second timeouts and controlled concurrency.
- **Real-Time Status Badges:** Dynamic `↑ UP` (green), `↓ DOWN` (red), and `● UNKNOWN` (neutral) badges accompanied by auto-refreshing human-readable relative timestamps (*"Checked just now"*, *"Checked 40 minutes ago"*).
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
- **Runtime:** Node.js (v18+ recommended)
- **Framework:** Express 5.2
- **Security:** Helmet, express-rate-limit, SSRF URL Validator, strict CORS, request body limits (10kb)
- **Scheduling:** node-cron 4.6 (requires persistent process; see hosting notes)
- **HTTP Client:** Axios (with timeout, redirect, and retry control)
- **Data Store:** Atomic persistent JSON storage (`backend/data/monitoringResults.json`)

---

## Architecture

```
                  +----------------------------------------------------+
                  |                    ASCEND FRONTEND                 |
                  |  - Browser Window Container                        |
                  |  - Responsive CSS Grid (5-col Desktop)             |
                  |  - High-Res Brand Favicon Cache                    |
                  |  - Relative Timestamp Refresh Engine (every 30s)   |
                  +-------------------------+--------------------------+
                                            |
                         GET /api/monitoring/status (every 60s)
                                            v
                  +----------------------------------------------------+
                  |                    EXPRESS BACKEND                 |
                  |  Port: 5000 (CORS Enabled)                         |
                  |  Endpoints:                                        |
                  |    - GET /api/monitoring/status                    |
                  |    - GET /jobs (Microsoft & Zoho Aggregator)       |
                  +-------------------------+--------------------------+
                                            |
                                            v
                  +----------------------------------------------------+
                  |             HEALTH MONITORING SERVICE              |
                  |  - node-cron (Executes every 60 minutes)           |
                  |  - Concurrency Limiter (5 simultaneous checks)     |
                  |  - 15s Timeout + Follow Redirects                  |
                  |  - 1x Auto-Retry on Transient Failures             |
                  |  - Bot Challenge Classification (403/429 -> UNKNOWN|
                  |  - Persistent Store: monitoringResults.json        |
                  +-------------------------+--------------------------+
                                            |
                                            v
                               [ 140 Official Career Portals ]
```

---

## Repository Structure

```text
Ascend/
├── README.md                      # Project documentation
├── docs/
│   └── screenshots/               # Application captures and design references
│       ├── directory-browser-preview.png
│       ├── ui-design-reference.jpg
│       └── hand-drawn-wireframe.png
├── backend/
│   ├── package.json               # Backend dependencies & test scripts
│   ├── server.js                  # Main Express entry point & scheduler boot
│   ├── cache/                     # Cached job aggregator data
│   │   ├── jobs.json
│   │   ├── microsoft.json
│   │   └── zoho.json
│   ├── data/                      # Persistent storage for monitoring
│   │   ├── companies.json         # Master registered companies dataset (141 entries)
│   │   └── monitoringResults.json # Persisted health check results & summary
│   ├── routes/
│   │   └── monitoring.js          # GET /api/monitoring/status route
│   ├── services/
│   │   ├── healthMonitor.js       # Core monitoring engine & status classifier
│   │   ├── fetchMicrosoftJobs.js  # Microsoft Careers collector
│   │   ├── fetchZohoJobs.js       # Zoho Recruit collector
│   │   └── updateJobs.js          # Aggregator cache updater
│   ├── utils/
│   │   └── ssrfValidator.js       # SSRF protection and IP/protocol validator
│   └── tests/
│       └── monitoring.test.js     # Health monitor test suite (100% pass)
└── frontend/
    ├── package.json               # Frontend dependencies & Vite scripts
    ├── vite.config.js             # Vite configuration
    ├── index.html                 # Main HTML document
    └── src/
        ├── App.jsx                # Main layout composition
        ├── main.jsx               # React DOM entry point
        ├── index.css              # Obsidian global theme & canvas
        ├── data/
        │   └── companyData.js     # Frontend static company definitions (141 entries)
        ├── utils/
        │   └── timeAgo.js         # Human-readable relative time formatter
        ├── components/
        │   ├── Navbar.jsx         # Ascend typography & header
        │   ├── CompanyDirectory.jsx # Browser container & grid coordinator
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
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

---

### Backend Setup

1. Open your terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the automated test suite to verify monitoring health logic:
   ```bash
   npm test
   ```

4. Start the Express server and scheduler:
   ```bash
   npm start
   ```
   *The server starts on `http://localhost:5000` and immediately executes an initial background health check.*

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

3. Launch the development server:
   ```bash
   npm run dev
   ```
   *Vite will start the client, accessible by default at `http://localhost:5173`.*

4. To generate a production build:
   ```bash
   npm run build
   ```

---

## Environment Variables

| Variable | Location | Default | Description |
|:---|:---|:---|:---|
| `PORT` | `backend` | `5000` | Port for the Express REST server |
| `NODE_ENV` | `backend` | `development` | Environment mode (`development` / `production`) |
| `CORS_ORIGIN` | `backend` | `http://localhost:5173,http://localhost:5000` | Comma-separated allowed CORS origins |
| `VITE_API_URL` | `frontend` | *(Empty string / same-origin)* | Base URL for API requests in production or custom CDN |

> **Important Deployment Note on Scheduled Monitoring:**
> The automated 60-minute health monitor utilizes `node-cron` inside the Express process. It requires a persistent runtime (such as Render Web Service, Railway, Fly.io, AWS ECS, or a VPS). Serverless platforms that scale down to zero (e.g. Vercel Serverless Functions, AWS Lambda) sleep between HTTP requests and cannot execute background cron intervals without external webhook pingers.

---

## Automated Health Monitoring

### Status Classification Rules

| Response / Error | Status | Description |
|:---|:---:|:---|
| **HTTP 2xx (200–299)** | `UP` | Career page returned successfully |
| **HTTP 3xx (301, 302, 307)** | `UP` | Portal redirected to secure or regional destination |
| **HTTP 5xx (500, 502, 503)** | `DOWN` | Server outage (confirmed after 1x retry) |
| **HTTP 404 / 410** | `DOWN` | Dead or decommissioned careers URL |
| **DNS (ENOTFOUND, EAI_AGAIN)** | `DOWN` | Domain resolution failure |
| **Timeout (ETIMEDOUT, 15s)** | `DOWN` | Connection timeout (confirmed after 1x retry) |
| **HTTP 403 / 429** | `UNKNOWN` | WAF / Cloudflare bot protection challenge (not an outage) |
| **HTTP 401** | `UNKNOWN` | Restricted corporate career portal |

### API Endpoint: `GET /api/monitoring/status`

**Sample Response:**
```json
{
  "summary": {
    "totalMonitored": 140,
    "up": 137,
    "down": 0,
    "unknown": 3,
    "lastRunAt": "2026-11-17T21:15:00.000Z",
    "isRunning": false
  },
  "results": [
    {
      "companyId": 1,
      "companyName": "Accenture",
      "careersUrl": "https://www.accenture.com/careers",
      "status": "UP",
      "httpStatusCode": 200,
      "responseTimeMs": 412,
      "lastCheckedAt": "2026-11-17T21:15:02.124Z",
      "errorMessage": null,
      "consecutiveFailures": 0
    }
  ]
}
```

---

## Current Project Status

- [x] **Phase 1: Company Directory Redesign**
  - [x] Hand-drawn wireframe transformed into sleek browser container.
  - [x] All 140 active companies integrated without duplicates.
  - [x] Responsive 5-column desktop CSS Grid with mobile adaptivity.
  - [x] High-res official brand logos with dynamic 2-letter fallback badges.
  - [x] KPIT Technologies temporarily excluded and flagged for URL update.
  - [x] Removed obsolete job search and yellow separator line.
- [x] **Phase 2: Health Monitoring Engine**
  - [x] Automated 60-minute scheduler using `node-cron`.
  - [x] 15-second timeout, redirect handling, and automatic failure retry.
  - [x] Persistent JSON storage across server restarts.
  - [x] `GET /api/monitoring/status` read-only summary API.
  - [x] Dynamic frontend card status indicators (`↑ UP`, `↓ DOWN`, `● UNKNOWN`).
  - [x] Real-time client-side relative timestamps (*"Checked just now"*).
  - [x] 100% test coverage on monitoring classification and retry logic.

---

## Future Development Roadmap

- [ ] **Database Migration:** Transition from JSON persistence to PostgreSQL with Prisma ORM.
- [ ] **Search & Industry Taxonomy:** Real-time client search and category filters (Fintech, AI/ML, Cloud, Semiconductor, Enterprise SaaS).
- [ ] **Playwright Browser Testing:** Automated browser testing to verify JavaScript-heavy applicant tracking systems.
- [ ] **Uptime Analytics & SLA:** Historical uptime charts and average response latency graphs per company.
- [ ] **Automated Career URL Verification:** Web hook alerts notifying administrators when career links break.
- [ ] **AI-Assisted Job Discovery:** Semantic job matching connecting candidate profiles with live job openings from monitored portals.

---

## Author & Acknowledgements

- **Author:** Developed for the **Ascend** platform.
- **Brand Assets:** Favicon resolution powered by Google's global CDN service.
- **Inspiration:** Hand-drawn wireframe and modern developer tool directories (AgentRunner, Stripe, Raycast).

---

<p align="center">
  <b>Your Gateway to Opportunities | Powered by Ascend</b>
</p>
