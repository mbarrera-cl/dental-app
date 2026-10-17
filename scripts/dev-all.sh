#!/usr/bin/env bash
#
# Starts the hexagonal backend (:3000) and the Angular microfrontends
# (shell :4200, patients :4203, users :4201, dashboard :4202, admin :4204,
# quotes :4205) for local development.
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

# `PORT` is honored by the backend *and* by the Angular dev servers (they
# let it override their angular.json ports). Keep it local to the backend
# process so a PORT override cannot move the microfrontends.
backend_port="${PORT:-3000}"
PORT="$backend_port" node --env-file-if-exists=.env dist/main.js &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend API      → http://localhost:${backend_port}"
echo "Swagger UI       → http://localhost:${backend_port}/docs"
echo "Shell (open me)  → http://localhost:4200"
echo "Patients remote  → http://localhost:4203"
echo "Users remote     → http://localhost:4201"
echo "Dashboard remote → http://localhost:4202"
echo "Admin remote     → http://localhost:4204"
echo "Quotes remote    → http://localhost:4205"
echo

# Never leak the backend's PORT into the frontends (see above).
unset PORT
npm --prefix frontend run start:all
