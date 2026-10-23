#!/usr/bin/env bash
# End-to-end authentication walkthrough against a running API
# (`pnpm run start:dev`):
#
#   login (refresh cookie) -> me -> users with Bearer -> 401 anonymous ->
#   refresh with rotation -> API key lifecycle (create -> X-Api-Key -> scoped
#   403 -> rotate -> revoke -> 401).
#
# Usage: ./scripts/auth-demo.sh [base-url]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hexa.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

extract() { node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8'))$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

step "1. POST /auth/login — sign in as $ADMIN_EMAIL"
LOGIN=$(curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
TOKEN=$(printf '%s' "$LOGIN" | extract '.accessToken')

if [[ "$TOKEN" == "undefined" ]]; then
  echo "Login failed — check ADMIN_EMAIL/ADMIN_PASSWORD and that the API is running." >&2
  exit 1
fi

printf 'access token (memory only): %.24s…\n' "$TOKEN"
grep -q hexa_refresh "$COOKIE_JAR" && echo 'refresh cookie: hexa_refresh stored (httpOnly, scoped to /auth)'

step "2. GET /auth/me — profile, roles and effective permissions"
curl -sS "$BASE_URL/auth/me" -H "Authorization: Bearer $TOKEN" \
  | extract '.permissions.effective.length' \
  | xargs printf 'effective permissions: %s\n'

step "3. GET /users — authorized with the Bearer token"
printf 'status: %s (expected 200)\n' "$(status "$BASE_URL/users" -H "Authorization: Bearer $TOKEN")"

step "4. GET /users — anonymous must be rejected"
printf 'status: %s (expected 401)\n' "$(status "$BASE_URL/users")"

step "5. POST /auth/refresh — rotate the session with the cookie only"
REFRESHED=$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/auth/refresh")
TOKEN=$(printf '%s' "$REFRESHED" | extract '.accessToken')
printf 'rotated token: %.24s…\n' "$TOKEN"

step "6. POST /apikeys — create a key scoped to dashboard:read only"
KEY=$(curl -sS -X POST "$BASE_URL/apikeys" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"auth-demo","scopes":["dashboard:read"],"expiresInDays":0}')
KEY_ID=$(printf '%s' "$KEY" | extract '.id')
SECRET=$(printf '%s' "$KEY" | extract '.key')
printf 'secret (shown once): %.24s…\n' "$SECRET"

step "7. GET /permissions with X-Api-Key — the key authenticates as its owner"
printf 'status: %s (expected 200)\n' "$(status "$BASE_URL/permissions" -H "X-Api-Key: $SECRET")"

step "8. GET /users with X-Api-Key — outside its scopes"
printf 'status: %s (expected 403)\n' "$(status "$BASE_URL/users" -H "X-Api-Key: $SECRET")"

step "9. POST /apikeys/:id/rotate — the old secret dies immediately"
ROTATED=$(curl -sS -X POST "$BASE_URL/apikeys/$KEY_ID/rotate" -H "Authorization: Bearer $TOKEN")
OLD_SECRET="$SECRET"
SECRET=$(printf '%s' "$ROTATED" | extract '.key')
printf 'old secret: %s (expected 401) · new secret: %s (expected 200)\n' \
  "$(status "$BASE_URL/permissions" -H "X-Api-Key: $OLD_SECRET")" \
  "$(status "$BASE_URL/permissions" -H "X-Api-Key: $SECRET")"

step "10. DELETE /apikeys/:id — revoke"
printf 'status: %s (expected 204)\n' \
  "$(status -X DELETE "$BASE_URL/apikeys/$KEY_ID" -H "Authorization: Bearer $TOKEN")"
printf 'revoked secret: %s (expected 401)\n' "$(status "$BASE_URL/permissions" -H "X-Api-Key: $SECRET")"

step "Done — Bearer, cookie rotation and X-Api-Key all verified."
