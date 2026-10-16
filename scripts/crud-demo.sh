#!/usr/bin/env bash
# Full CRUD walkthrough against a running API (npm run start:dev).
# Usage: ./scripts/crud-demo.sh [base-url]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

extract() { node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8'))$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1. POST /users — create Ada"
ada=$(curl -sS -X POST "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' \
  -w '\n%{http_code}')
printf '%s\n' "$ada"
ADA_ID=$(printf '%s\n' "$ada" | head -n 1 | extract '.id')

step "2. POST /users — create Grace"
curl -sS -X POST "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  -d '{"email":"grace@example.com","name":"Grace Hopper"}' \
  -w '\n%{http_code}\n'

step "3. GET /users — list"
curl -sS "$BASE_URL/users" -w '\n%{http_code}\n'

step "4. GET /users/$ADA_ID — read one"
curl -sS "$BASE_URL/users/$ADA_ID" -w '\n%{http_code}\n'

step "5. PATCH /users/$ADA_ID — update name and email"
curl -sS -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada King","email":"ada.king@example.com"}' \
  -w '\n%{http_code}\n'

step "6. PATCH /users/$ADA_ID — conflict with Grace's email (409)"
curl -sS -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{"email":"grace@example.com"}' \
  -w '\n%{http_code}\n'

step "7. PATCH /users/$ADA_ID — empty body (400)"
curl -sS -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -w '\n%{http_code}\n'

step "8. DELETE /users/:id — delete Grace (204)"
GRACE_ID=$(curl -sS "$BASE_URL/users" | extract ".find((u) => u.email === 'grace@example.com').id")
curl -sS -X DELETE "$BASE_URL/users/$GRACE_ID" -o /dev/null -w '%{http_code}\n'

step "9. GET /users/$GRACE_ID — gone (404)"
curl -sS "$BASE_URL/users/$GRACE_ID" -w '\n%{http_code}\n'

step "10. Inspect the SQLite file directly"
DB_PATH="${DATABASE_PATH:-data/hexa.sqlite}"
if command -v sqlite3 >/dev/null; then
  sqlite3 "$DB_PATH" 'SELECT id, email, name FROM users;'
else
  echo "(sqlite3 CLI not available — skipping)"
fi
