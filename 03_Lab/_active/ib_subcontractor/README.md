# Prequal — Subcontractor Compliance Watchdog

Automated OSHA violation tracking, certification expiry alerts, and compliance scoring for mid-sized general contractors.

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## First Steps

1. Register: `POST /api/auth/register` → `{org_name, email, password}`
2. Login: `POST /api/auth/login` → returns JWT
3. Create a project, add subcontractors, upload certs

## Architecture

```
frontend/   React 18 + Vite + TailwindCSS
backend/    FastAPI + SQLAlchemy 2.0 async + Alembic
            Celery + Redis (background jobs)
            OCR: AWS Textract (optional, falls back gracefully)
            Alerts: n8n webhook (set WEBHOOK_URL in .env)
```

## Pricing Tiers

| Plan    | Price       | Seats      |
|---------|-------------|------------|
| Starter | $29/seat/mo | 1–5        |
| Team    | $500/mo     | Up to 20   |
| Growth  | $2,000/mo   | Unlimited  |

## Key Features

- **OSHA watchdog** — pulls violation history via public OSHA API, calculates compliance score (0–100)
- **Cert portal** — subcontractors upload certs at `/portal/:sub_id`, OCR extracts expiry dates
- **Expiry alerts** — 30/14/7/1-day warnings via n8n webhook or console
- **Real-time monitoring** — daily OSHA re-check, immediate alert on new violation
- **Compliance dashboard** — per-project and per-sub risk view (green/yellow/red)

## Compliance Score

| Violation Type | Deduction |
|---------------|-----------|
| Willful       | −30       |
| Repeat        | −20       |
| Serious       | −15       |
| Other         | −5        |

Score floors at 0. Starts at 100.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL async URL |
| `REDIS_URL` | Yes | Redis URL for Celery |
| `SECRET_KEY` | Yes | JWT signing key |
| `WEBHOOK_URL` | No | n8n webhook for alerts |
| `AWS_ACCESS_KEY_ID` | No | For Textract OCR |
| `STRIPE_SECRET_KEY` | No | For billing |
