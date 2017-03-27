#!/bin/bash

set -eu

export NODE_ENV=production
export ATTACHMENT_DIR=/app/data/storage

mkdir -p "$ATTACHMENT_DIR"

chown -R cloudron:cloudron /app/data

exec /usr/local/bin/gosu cloudron:cloudron node /app/code/app.js
