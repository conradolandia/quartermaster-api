# GitHub Actions workflows

Overview of the workflows in this directory. Trigger events use the branches defined in each file.

## Active workflows

| File | Trigger | Purpose |
|------|---------|---------|
| **ci.yml** | Push/PR to `master`, `staging` | CI: backend lint (ruff), backend tests in Docker (`cp .env.ci .env` then db + prestart + backend via `docker-compose.ci.yml`), frontend lint (Biome), frontend build. Backend mypy is optional via `backend/scripts/typecheck.sh` (not CI-gated). No GitHub secrets required for test env. |

## Optional workflows (not enabled by default)

These files ship from the FastAPI template but are not part of minimal CI. Enable them when you need the feature and have the required secrets/runners.

| File | Trigger | Purpose |
|------|---------|---------|
| **deploy-staging.yml** | Push to `master` | Deploy to self-hosted runner with label `staging`. Requires repo secrets and a self-hosted runner. |
| **deploy-production.yml** | Release published | Deploy to self-hosted runner with label `production`. |
| **generate-client.yml** | `workflow_dispatch` only | Regenerate frontend API client from OpenAPI (disabled for automatic PR runs). |
| **labeler.yml** | `pull_request_target` | Apply labels from `.github/labeler.yml`; require one category label on PRs. |
| **latest-changes.yml** | PR closed to `master`, or `workflow_dispatch` | Update `release-notes.md` (requires `LATEST_CHANGES` PAT). |
