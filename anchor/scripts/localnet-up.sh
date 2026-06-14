#!/usr/bin/env bash
#
# Start a local validator (foreground, program preloaded into genesis) for the demo and frontend.
# Usage: terminal A runs this script; terminal B runs `npm run demo` or `cd app && npm run dev`.
# Workarounds: Anchor 1.0 defaults to surfpool (not installed) -> use solana-test-validator directly;
#              local port 8000 is occupied -> pass an explicit free gossip port.
#
set -euo pipefail

PROGRAM_ID="6WngBHVPBX2y27UxP6epeY1LkkYR7afM4MiYoCCa13MF"
SO="target/deploy/naura.so"
RPC_PORT="${RPC_PORT:-8899}"
GOSSIP_PORT="${GOSSIP_PORT:-9210}"

export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

[ -f "$SO" ] || { echo "$SO not found, running anchor build"; anchor build --ignore-keys; }

pkill -f solana-test-validator 2>/dev/null || true
sleep 1
rm -rf /tmp/naura-ledger

echo "Starting localnet: RPC :$RPC_PORT / gossip :$GOSSIP_PORT, program $PROGRAM_ID preloaded. Ctrl+C to exit."
exec solana-test-validator --reset --quiet \
  --ledger /tmp/naura-ledger \
  --rpc-port "$RPC_PORT" --gossip-port "$GOSSIP_PORT" \
  --bpf-program "$PROGRAM_ID" "$SO"
