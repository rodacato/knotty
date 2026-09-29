#!/usr/bin/env bash
# Re-runs on every rebuild: everything here must be idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

# The node-modules volume is created root-owned.
sudo chown "$(id -u):$(id -g)" node_modules

npm ci

echo ""
echo "  knotty ready. Run: npm run dev"
echo ""
