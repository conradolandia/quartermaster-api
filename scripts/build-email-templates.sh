#! /usr/bin/env bash

set -e

cd "$(dirname "$0")/../backend/app/email-templates"
npx --yes mjml -o build/ src/*.mjml
python patch_booking_confirmation.py
