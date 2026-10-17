#!/usr/bin/env bash
# Full CRUD walkthrough against a running API (npm run start:dev).
# Usage: ./scripts/crud-demo.sh [base-url]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

extract() { node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8'))$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Every /users call needs a session now: sign in as the bootstrap admin first
# (override with ADMIN_EMAIL / ADMIN_PASSWORD).
TOKEN=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL:-admin@hexa.local}\",\"password\":\"${ADMIN_PASSWORD:-Admin123!}\"}" \
  | extract '.accessToken')

if [[ -z "$TOKEN" || "$TOKEN" == "undefined" ]]; then
  echo 'Login failed — is the API running and the bootstrap admin intact?' >&2
  exit 1
fi

curlj() { curl -sS -H "Authorization: Bearer $TOKEN" "$@"; }

step "0. POST /auth/login — signed in as ${ADMIN_EMAIL:-admin@hexa.local}"

step "1. POST /users — create Ada"
ada=$(curlj -X POST "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' \
  -w '\n%{http_code}')
printf '%s\n' "$ada"
ADA_ID=$(printf '%s\n' "$ada" | head -n 1 | extract '.id')

step "2. POST /users — create Grace"
curlj -X POST "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  -d '{"email":"grace@example.com","name":"Grace Hopper"}' \
  -w '\n%{http_code}\n'

step "3. GET /users — list"
curlj "$BASE_URL/users" -w '\n%{http_code}\n'

step "4. GET /users/$ADA_ID — read one"
curlj "$BASE_URL/users/$ADA_ID" -w '\n%{http_code}\n'

step "5. PATCH /users/$ADA_ID — update name and email"
curlj -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada King","email":"ada.king@example.com"}' \
  -w '\n%{http_code}\n'

step "6. PATCH /users/$ADA_ID — conflict with Grace's email (409)"
curlj -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{"email":"grace@example.com"}' \
  -w '\n%{http_code}\n'

step "7. PATCH /users/$ADA_ID — empty body (400)"
curlj -X PATCH "$BASE_URL/users/$ADA_ID" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -w '\n%{http_code}\n'

step "8. DELETE /users/:id — delete Grace (204)"
GRACE_ID=$(curlj "$BASE_URL/users" | extract ".find((u) => u.email === 'grace@example.com').id")
curlj -X DELETE "$BASE_URL/users/$GRACE_ID" -o /dev/null -w '%{http_code}\n'

step "9. GET /users/$GRACE_ID — gone (404)"
curlj "$BASE_URL/users/$GRACE_ID" -w '\n%{http_code}\n'

step "10. Inspect the SQLite file directly"
if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null; then
  psql "$DATABASE_URL" -c 'SELECT id, email, name FROM users;'
else
  echo "(DATABASE_URL/psql not available — skipping)"
fi
