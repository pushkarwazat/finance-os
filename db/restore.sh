#!/bin/bash
# Restore the FinanceOS database from seed.sql
# Usage: DATABASE_URL=your_postgres_url bash db/restore.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

echo "Restoring database..."
psql "$DATABASE_URL" -f "$(dirname "$0")/seed.sql"
echo "Database restored successfully."
