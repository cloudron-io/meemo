#!/bin/bash

set -eu

export NODE_ENV=production

/usr/local/bin/gosu cloudron:cloudron node /app/code/app.js