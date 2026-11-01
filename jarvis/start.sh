#!/usr/bin/env bash
# Start the Encourt command deck. Uses the local Node install (no PATH setup needed).
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"
exec node server.js
