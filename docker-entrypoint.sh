#!/bin/sh
set -e

echo "==> Fixing any failed/renamed migrations..."
# Use node to run the fix SQL via Prisma's underlying connection
node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  try {
    await p.\$executeRawUnsafe(fs.readFileSync('./prisma/fix-failed-migration.sql', 'utf8'));
    console.log('Migration fix applied');
  } catch(e) {
    console.log('Migration fix skipped (table may not exist yet):', e.message);
  } finally {
    await p.\$disconnect();
  }
})();
"

echo "==> Running prisma migrate deploy..."
npx prisma migrate deploy

echo "==> Starting server..."
exec node dist/index.js
