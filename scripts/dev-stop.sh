#!/usr/bin/env bash
#
# Stops the backend + Angular microfrontends started by ./scripts/dev-all.sh.
# It uses the supervisor's state file first and then falls back to the known
# dev ports, so it also cleans up sessions left behind by an older start.
#
# Usage:
#   ./scripts/dev-stop.sh          # stop dev processes and free the dev ports
#   ./scripts/dev-stop.sh --force  # also take over ports held by unknown processes
#
set -euo pipefail

cd "$(dirname "$0")/.."
exec node scripts/dev.mjs stop "$@"
