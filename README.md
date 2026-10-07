# Route 53 Clone

A functional clone of the AWS Route 53 console: accounts with sign-up and sign-in, hosted zones, DNS records, persistent SQLite storage and a FastAPI backend. It reproduces the console's look and workflows; it does **not** perform real DNS.

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) + [Cloudscape Design System](https://cloudscape.design), the design system the AWS console is built with |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2 |
| Database | SQLite |

Demo login: **admin / admin123** (account `123456789012`). Anyone can also create their own account on the **Create a new AWS account** page; each account only sees its own hosted zones.

## Setup

```bash
# 1. API (http://localhost:8000, interactive docs at /docs)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000     # creates route53.db and seeds the demo account on first start

# 2. Web (http://localhost:3000)
cd frontend
npm install
npm run dev
```

Or run both with `docker compose up --build`.

Checks: `cd backend && pytest` (API tests) and `cd frontend && npm run typecheck && npm run build`.

Environment variables: `API_URL` (frontend build/start, default `http://localhost:8000`), `DATABASE_URL` (default `sqlite:///./route53.db`), `CORS_ORIGINS`, `COOKIE_SECURE=1` (HTTPS deployments).

If you have a `route53.db` from an earlier version, the API rebuilds it on start (zones now belong to an account, and there is no migration tool). Only demo data is lost.

## Features

- **Accounts:** sign up (user name, password, optional account alias; a 12-digit account ID is generated), sign in, sign out, 7-day sessions in an httpOnly cookie that survive reloads. Signing out ends only the current browser's session. An expired session sends the user back to the sign-in page.
- **Hosted zones:** list with a multi-token property filter (and/or), pagination and empty state; create public or private zones (private zones need a VPC ID and Region), with description and tags; edit the description; delete with type-to-confirm and the `HostedZoneNotEmpty` rule; details page with name servers, VPC and tags.
- **Records:** table with property filter, Type / Routing policy / Alias filters, pagination, column and page-size preferences, multi-select; Create record with *Add another record* (atomic batch, errors point at the offending record); Edit record side pane; delete modal (single or bulk); Alias records; all nine types (A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA) with per-type validation; *Test record*.
- **Route 53 chrome:** top bar with a working search box (Enter searches hosted zones), side navigation, breadcrumbs, flashbar notifications, help panel, footer. Dashboard, Health checks, Profiles, Traffic policies, Registered domains and Resolver pages are "Coming soon".
- **Bonus:** import BIND zone files, export JSON / BIND, dark mode, keyboard shortcuts (`?` lists them), bulk delete.

## Architecture

```
frontend/  Next.js. /api/* is rewritten to FastAPI, so the session cookie is same-origin (no CORS or cookie issues).
  app/login, app/signup           public pages
  app/route53/v2/...              home, getstarted, hostedzones (list, create, [id], [id]/create-record, [id]/import), placeholders
  components/                     Shell, RecordsTab, RecordForm, EditRecordPanel, TagsTab, ZoneModals, TestRecordModal, providers
  lib/                            api.ts (typed client), filters.ts (filter tokens -> API params), copy.ts, theme.ts
backend/   FastAPI. router -> service -> SQLAlchemy model; business rules live in services.
  app/routers/                    auth, zones, records, export
  app/services/                   zone_service, record_service, validators, filters, zone_file (BIND parser)
  tests/                          pytest
```

Errors share one shape, `{"error": {"code", "message", "field", "index"}}`: `field` is the form field to highlight and `index` is the item of a batch request that failed.

## Database schema

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ hosted_zones : owns
  hosted_zones ||--o{ dns_records : contains
  hosted_zones ||--o{ zone_tags : has
  users { int id PK string username UK string password_hash string account_name string account_id }
  sessions { string token PK int user_id FK datetime expires_at }
  hosted_zones { string id PK int owner_id FK string name string type string description string created_by datetime created_at string vpc_id string vpc_region }
  dns_records { int id PK string zone_id FK string name string type int ttl json values string routing_policy string alias_target datetime created_at datetime updated_at }
  zone_tags { int id PK string zone_id FK string key string value }
```

Constraints: unique (`hosted_zones.owner_id`, `name`, `type`); unique (`dns_records.zone_id`, `name`, `type`); `ON DELETE CASCADE` from users to zones and from zones to records and tags. Record count is computed, not stored. Record names are lowercase FQDNs without a trailing dot. Passwords are stored as salted PBKDF2-SHA256 hashes. Another account's zone ID answers 404, exactly like a missing one.

## API overview

All routes except sign-up, sign-in and health require the session cookie.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | `username`, `password`, `account_name?`; signs the new user in. 409 if the name is taken |
| POST | `/api/auth/login`, `/api/auth/logout` | login takes an optional `account` (ID or alias) that must match |
| GET | `/api/auth/me` | |
| GET | `/api/hosted-zones` | `f` (repeatable `property:text`; properties `name`, `type`, `id`, `description`, `all`), `op` (`and`/`or`), `page`, `page_size` |
| POST | `/api/hosted-zones` | creates NS + SOA automatically; private zones need `vpc_id` and `vpc_region` |
| GET / PATCH / DELETE | `/api/hosted-zones/{id}` | PATCH edits the description; DELETE fails if other records exist |
| GET / PUT | `/api/hosted-zones/{id}/tags` | keys must be unique and can't start with `aws:` |
| GET | `/api/hosted-zones/{id}/records` | `f` (properties `name`, `type`, `value`, `all`), `op`, `type`, `routing_policy`, `alias`, `page`, `page_size` |
| POST | `/api/hosted-zones/{id}/records` | one record or a list (atomic) |
| PUT / DELETE | `/api/hosted-zones/{id}/records/{rid}` | NS/SOA: TTL only, never deletable |
| POST | `/api/hosted-zones/{id}/records/bulk-delete` | `{ids: []}` |
| POST | `/api/hosted-zones/{id}/records/import` | `{zone_file}` BIND text, atomic |
| GET | `/api/hosted-zones/{id}/records/test` | `name`, `type` (answers from stored data) |
| GET | `/api/hosted-zones/{id}/export` | `format=json\|bind` |

## Validation rules

User names: 3 to 64 characters from letters, numbers and `+ = , . @ _ -`; passwords 8 to 128 characters. Record names must end with the zone name (blank = apex); CNAME can't sit at the apex or share a name with other types; A/AAAA must be valid IPs; MX `priority host`; SRV `priority weight port host`; CAA `flags tag "value"`; TXT is auto-quoted; TTL 0 to 2147483647 (default 300); NS/SOA can't be created or deleted; TLD zones (e.g. `com`) are rejected. Imported records must lie inside the zone.

## Known deviations

- Logo and tile illustrations are SVG recreations, not official AWS assets (swap `frontend/public/*.svg`).
- Only Simple routing is functional; other policies are listed but disabled. DNSSEC and query logging are informational stubs.
- The top-bar search covers hosted zones only; CloudShell, notifications, support and the account menu entries other than Sign out are decorative.
- On hosts with an ephemeral disk the database resets on restart and the demo account is re-seeded.

## Deployment

Backend: `render.yaml` (Docker) or any container host, with a volume at `/data` for persistence. Frontend: Vercel, root directory `frontend`, env `API_URL=https://<your-api-host>` set before the build.
