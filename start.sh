#!/bin/ash

set -eu

export NODE_ENV=production
export ATTACHMENT_DIR=/app/data/storage

mkdir -p "$ATTACHMENT_DIR"

echo "=> Start meemo"
exec node /app/code/app.js
