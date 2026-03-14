# Quartermaster

Booking and management system for [Star Fleet Tours](https://star-fleet.tours), handling ticket sales for rocket launch viewing trips. Manages the customer journey from trip discovery through payment and check-in, and provides administrative tools for operations.

Originally scaffolded from the [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) by Sebastián Ramírez.

## Features

- **Mission and trip management** for rocket launch viewing events
- **Multi-step public booking flow** with Stripe payment integration
- **QR code tickets** for passenger check-in
- **Admin dashboard** for booking, trip, and fleet management
- **Refund processing** through Stripe
- **Transactional emails** (booking confirmations, launch updates) via SMTP/SendGrid
- **YAML-based import** for launches, missions, and trips
- **Reporting and CSV export** for passenger manifests

## Tech Stack

### Backend
- [FastAPI](https://fastapi.tiangolo.com) (Python 3.12)
- [SQLModel](https://sqlmodel.tiangolo.com) ORM + [PostgreSQL](https://www.postgresql.org)
- [Alembic](https://alembic.sqlalchemy.org) for database migrations
- [Stripe](https://stripe.com) for payment processing
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) for configuration
- JWT authentication

### Frontend
- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Chakra UI v3](https://chakra-ui.com) component library
- [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query)
- [Stripe Elements](https://stripe.com/docs/stripe-js) for payment forms
- Auto-generated API client from OpenAPI schema
- [Playwright](https://playwright.dev) for end-to-end testing

### Infrastructure
- [Docker Compose](https://docs.docker.com/compose/) for development and production
- [Traefik](https://traefik.io) as reverse proxy with automatic HTTPS (Let's Encrypt)
- [MailCatcher](https://mailcatcher.me) for local email testing

## Project Structure

```
quartermaster-api/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/routes/      # API endpoint handlers
│   │   ├── crud/            # Database operations
│   │   ├── alembic/         # Database migrations
│   │   ├── email-templates/ # MJML email templates (src/) and compiled HTML (build/)
│   │   ├── tests/           # Pytest test suite
│   │   ├── models.py        # SQLModel data models
│   │   ├── core/            # Config, security, database setup
│   │   └── main.py          # Application entry point
│   └── scripts/             # Maintenance scripts (QR regeneration, audits, etc.)
├── frontend/                # React SPA
│   ├── src/
│   │   ├── client/          # Auto-generated OpenAPI client
│   │   ├── components/      # UI components (Admin, Public booking, Common)
│   │   ├── routes/          # TanStack Router page definitions
│   │   └── hooks/           # Custom React hooks
│   └── tests/               # Playwright e2e tests
├── scripts/                 # Build, deploy, and utility scripts
├── examples/yaml/           # Sample YAML files for data import
├── docker-compose.yml           # Production compose configuration
├── docker-compose.override.yml  # Local development overrides
└── docker-compose.traefik.yml   # Traefik proxy for production
```

## Local Development

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) and Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python package manager, for backend development)
- [Node.js](https://nodejs.org/) (managed via `.nvmrc`; use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm))

### Quick Start

1. Copy `.env.example` to `.env` and fill in required values (see [Configuration](#configuration)).

2. Start the stack:

```bash
docker compose up -d backend adminer mailcatcher
```

3. Start the frontend dev server (with live reload):

```bash
cd frontend && npm install && npm run dev
```

4. Access the services:

| Service | URL |
|---|---|
| Frontend (public booking + admin) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API documentation (Swagger UI) | http://localhost:8000/docs |
| API documentation (ReDoc) | http://localhost:8000/redoc |
| Adminer (database UI) | http://localhost:8080 |
| MailCatcher (email testing) | http://localhost:1080 |

See [development.md](./development.md) for detailed local development workflows, Docker Compose usage, pre-commit hooks, and subdomain-based local testing with Traefik.

### Running Tests

Backend tests **must not** run against the production database: the test fixture wipes and reseeds data. Use a dedicated test database (e.g. `POSTGRES_DB=quartermaster_test` or set `POSTGRES_DB_TEST`) and do not set `ENVIRONMENT=production` when running tests; see [backend/README.md](./backend/README.md#test-database-and-production-safeguard).

Backend (Pytest):

```bash
docker compose exec backend bash scripts/tests-start.sh
```

Frontend (Playwright e2e):

```bash
docker compose up -d db backend mailcatcher
docker compose run --rm playwright
```

See [backend/README.md](./backend/README.md) and [frontend/README.md](./frontend/README.md) for more details.

### Regenerating the Frontend API Client

After backend schema changes:

```bash
source backend/.venv/bin/activate
./scripts/generate-client.sh
```

## Configuration

Configuration is managed through environment variables, loaded from `.env`. See `.env.example` for all available variables.

Key variables to set before deployment:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key |
| `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD` | Initial admin account |
| `POSTGRES_PASSWORD` | Database password |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payment integration |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email delivery (SendGrid or other SMTP provider) |
| `DOMAIN` | Production domain (e.g. `book.star-fleet.tours`) |
| `FRONTEND_HOST` | Public URL of the frontend |
| `QR_CODE_BASE_URL` | Base URL encoded in QR code tickets |

To generate secret keys:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Deployment

Deployment uses Docker Compose with Traefik for TLS termination and routing. See [deployment.md](./deployment.md) for step-by-step instructions covering:

- Traefik proxy setup with Let's Encrypt
- Environment variable configuration
- DNS and subdomain configuration
- GitHub Actions self-hosted runner for CD (planned)

### Production URLs

| Service | URL |
|---|---|
| Public booking | `https://book.star-fleet.tours` |
| Admin dashboard | `https://admin.book.star-fleet.tours` |
| Backend API | `https://api.book.star-fleet.tours` |
| API documentation | `https://api.book.star-fleet.tours/docs` |
| Adminer | `https://adminer.book.star-fleet.tours` |
| Traefik dashboard | `https://traefik.book.star-fleet.tours` |

### Staging URLs

| Service | URL |
|---|---|
| Public booking | `https://staging.book.star-fleet.tours` |
| Admin dashboard | `https://admin.staging.book.star-fleet.tours` |
| Backend API | `https://api.staging.book.star-fleet.tours` |
| API documentation | `https://api.staging.book.star-fleet.tours/docs` |
| Adminer | `https://adminer.staging.book.star-fleet.tours` |

## Further Documentation

- [Backend development](./backend/README.md) -- dependencies, migrations, tests, email templates, QR codes
- [Frontend development](./frontend/README.md) -- dev server, client generation, e2e tests
- [Deployment guide](./deployment.md) -- Traefik setup, Docker Compose production, CI/CD
- [Development workflows](./development.md) -- Docker Compose, local domains, pre-commit, env vars

## License

Copyright (c) 2025- Star Fleet Tours LLC.

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).

Portions of this codebase were adapted from the [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) by Sebastián Ramírez, originally licensed under the MIT License. See [NOTICE](./NOTICE) for details.
