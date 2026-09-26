#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  if [ -d "/app/data" ]; then
    chown -R node:node /app/data
  fi
fi

if [ "$(id -u)" = "0" ]; then
  exec gosu node "$@"
fi

exec "$@"
