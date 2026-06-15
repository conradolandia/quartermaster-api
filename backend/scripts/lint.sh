#!/usr/bin/env bash

set -e
set -x

# Ruff is enforced in CI. Mypy (strict) has known backlog; run scripts/typecheck.sh locally.
ruff check app
ruff format app --check
