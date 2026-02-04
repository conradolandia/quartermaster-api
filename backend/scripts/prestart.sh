#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations (or create schema + stamp head on fresh DB)
python app/run_migrations.py

# Create initial data in DB
python app/initial_data.py
