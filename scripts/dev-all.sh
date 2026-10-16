#!/usr/bin/env bash
#
# Starts the hexagonal backend (:3000) and the three Angular microfrontends
# (shell :4200, users :4201, dashboard :4202) for local development.
#
# Usage:
#   ./scripts/dev-all.sh              # builds the backend, then starts everything
#   ./scripts/dev-all.sh --skip-build # skips the backend build (dist/ must exist)
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--skip-build" ]]; then
  npm run build
fi

PORT="${PORT:-3000}" node dist/main.js &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend API      → http://localhost:${PORT}"
echo "Swagger UI       → http://localhost:${PORT}/docs"
echo "Shell (open me)  → http://localhost:4200"
echo

npm --prefix frontend run start:all
