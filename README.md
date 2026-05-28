# Periyar University — PhD Management System

Enterprise-grade monorepo for the PhD Admission & Management platform at Periyar University.

## Architecture

```
phd-demo/                          ← monorepo root
│
├── .env                           ← SINGLE centralized env (all modules load this)
├── .env.example                   ← template — copy to .env and fill values
├── package.json                   ← root scripts to run all modules together
├── docker-compose.yml
│
├── shared/                        ← code shared across all modules
│   ├── config/
│   │   ├── db.js                  ← centralized MySQL pool
│   │   └── mail.js                ← centralized Nodemailer transporter
│   ├── middleware/
│   │   └── auth.js                ← shared JWT middleware
│   ├── utils/
│   │   └── emailLogger.js
│   ├── constants/
│   │   └── index.js
│   └── uploads/                   ← centralized file storage
│       ├── students/
│       ├── supervisors/
│       ├── centres/
│       ├── attendance/
│       └── settings/
│
├── database/
│   ├── migrations/                ← all .sql migration files
│   ├── schema/                    ← base schema snapshots
│   ├── seeders/                   ← seed data scripts
│   ├── backups/
│   └── ER-Diagram/                ← workflow PDFs and diagrams
│
├── student/                       ← Student Portal (port 5000 / 5173)
│   ├── backend/                   ← Express API — authentication, application, payments
│   └── frontend/                  ← React + Vite — student-facing portal
│
├── admin/                         ← Admin Panel (port 5001 / 5174)
│   ├── backend/                   ← Express API — full admin control
│   └── frontend/                  ← React + Vite + TailwindCSS — admin dashboard
│
├── supervisor/                    ← Supervisor Portal (port 5002 / 5175)
│   ├── backend/                   ← Express API — supervisor & master management
│   └── frontend/                  ← React + Vite — supervisor interface
│
├── center/                        ← Research Centre Portal (port 5003 / 5176)
│   ├── backend/                   ← Express API — centre management
│   └── frontend/                  ← React + Vite — centre interface
│
├── nginx/                         ← Nginx reverse-proxy config (production)
├── scripts/                       ← startup and maintenance shell scripts
└── logs/                          ← centralized application logs
```

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your MySQL credentials and SMTP settings
```

### 2. Install dependencies

```bash
npm install          # installs root dev tools (concurrently)
npm run install:all  # installs dependencies for all 4 modules
```

### 3. Database setup

Run migrations in order:
```bash
# In MySQL:
source database/migrations/database.sql
source database/migrations/features_migration.sql
source database/migrations/session_migration.sql
source database/migrations/phase_migration.sql
source database/migrations/enterprise_migration.sql
source database/migrations/upgrade_v3_migration.sql
source database/migrations/supervisor_centre_migration.sql
```

### 4. Start everything

```bash
# Start all backends
npm start

# Start all frontends  
npm run dev

# Start everything at once (backends + frontends)
npm run dev:all
```

### 5. Individual module startup

```bash
# Student module
npm run start:student-be    # http://localhost:5000
npm run dev:student-fe      # http://localhost:5173

# Admin module
npm run start:admin-be      # http://localhost:5001
npm run dev:admin-fe        # http://localhost:5174

# Supervisor module
npm run start:supervisor-be # http://localhost:5002
npm run dev:supervisor-fe   # http://localhost:5175

# Center module
npm run start:center-be     # http://localhost:5003
npm run dev:center-fe       # http://localhost:5176
```

## Port Map

| Module     | Backend | Frontend |
|------------|---------|----------|
| Student    | 5000    | 5173     |
| Admin      | 5001    | 5174     |
| Supervisor | 5002    | 5175     |
| Center     | 5003    | 5176     |

## Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS + React Router v7
- **Backend:** Node.js + Express
- **Database:** MySQL (single `rsm_db` database)
- **Auth:** JWT (per-module secrets)
- **Email:** Nodemailer (SMTP — Gmail/Hostinger compatible)
- **File Uploads:** Multer

## Key Business Rules

- ONE active admission session at a time
- Direct Pass: NET/SET/JRF/SLET holders who pay → skip entrance → go to counselling
- Hall tickets: issued only to APPROVED, non-direct-pass applicants
- Results published by admin button — stamped with `result_published_at`
- 9 master types for supervisor module (all dynamic — no hardcoded dropdowns)
