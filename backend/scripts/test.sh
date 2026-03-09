#!/usr/bin/env bash

set -e
set -x

coverage run -m pytest "$@"
coverage report
# Generate HTML report only when not in CI (avoids htmlcov dir issues in containers; run locally for coverage browsing)
if [ -z "${CI:-}" ]; then
  coverage html --title "Quartermaster Coverage"
fi
