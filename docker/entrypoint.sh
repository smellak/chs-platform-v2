#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/db && npx tsx src/migrate.ts

echo "Checking if seed is needed..."
cd /app/packages/db && npx tsx src/seed.ts

echo "Starting Aleph Platform..."
cd /app
exec node apps/platform/server.js
