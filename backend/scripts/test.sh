#!/usr/bin/env bash

set -e
set -x

# Collect pytest args; if --no-cov is present, run pytest without coverage
PYTEST_ARGS=()
NO_COV=
for arg in "$@"; do
  if [ "$arg" = "--no-cov" ]; then
    NO_COV=1
  else
    PYTEST_ARGS+=("$arg")
  fi
done

if [ -n "$NO_COV" ]; then
  pytest "${PYTEST_ARGS[@]}"
else
  coverage run -m pytest "${PYTEST_ARGS[@]}"
  coverage report
  # Generate HTML report only when not in CI (avoids htmlcov dir issues in containers; run locally for coverage browsing)
  if [ -z "${CI:-}" ]; then
    coverage html --title "Quartermaster Coverage"
  fi
fi
