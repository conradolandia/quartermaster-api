#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations
# Commented out to use direct table creation instead
# alembic upgrade head

# Create initial data in DB
python app/initial_data.py
