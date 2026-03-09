#!/usr/bin/env bash

set -e
set -x

coverage run -m pytest "$@"
coverage report
rm -rf htmlcov
coverage html --title "Quartermaster Coverage"
