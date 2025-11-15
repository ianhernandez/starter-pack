#!/bin/sh
set -e

echo "Running database migrations..."
pnpm tsx node_modules/.bin/drizzle-kit migrate

echo "Starting application..."
exec "$@"
