#!/bin/sh
set -e

echo "[entrypoint] Initialising database schema..."
cd /app/server && /app/node_modules/.bin/prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] Seeding connection masters..."
cd /app && node server/scripts/seed-connection-masters.js

echo "[entrypoint] Starting services..."
cd /app
exec pm2-runtime /app/ecosystem.config.js
