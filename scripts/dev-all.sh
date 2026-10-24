#!/usr/bin/env bash
#
# Starts the hexagonal backend (:3000) and the Angular microfrontends
# (shell :4200, patients :4203, users :4201, dashboard :4202, admin :4204,
# quotes :4205, agenda :4206) for local development.
#
# The supervisor waits for the backend and every remoteEntry.json before it
# starts the shell, because the shell loads all remotes during bootstrap.
#
# Usage:
#   ./scripts/dev-all.sh              # builds the backend, then starts everything
#   ./scripts/dev-all.sh --skip-build # skips the backend build (dist/ must exist)
#   ./scripts/dev-all.sh --force      # takes over ports held by another process
#
# Stop everything with `pnpm run dev:stop` (or Ctrl+C in this terminal).
#
set -euo pipefail

cd "$(dirname "$0")/.."
exec node scripts/dev.mjs start "$@"
