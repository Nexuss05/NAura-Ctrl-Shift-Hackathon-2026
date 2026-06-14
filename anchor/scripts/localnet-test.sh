#!/usr/bin/env bash
#
# Reproducibly run `anchor test` on localnet.
#
# Background (two environment gotchas this script works around):
#   1. Anchor 1.0 defaults to surfpool as the local validator; not installed here -> use the legacy solana-test-validator;
#   2. solana-test-validator's default gossip port 8000 is occupied here -> pass an explicit free --gossip-port.
# Approach: start the legacy validator manually (program preloaded into genesis), then run the test suite
# with anchor test --skip-local-validator.
#
set -euo pipefail

PROGRAM_ID="6WngBHVPBX2y27UxP6epeY1LkkYR7afM4MiYoCCa13MF"
SO="target/deploy/naura.so"
LEDGER="/tmp/naura-ledger"
RPC_PORT="${RPC_PORT:-8899}"
GOSSIP_PORT="${GOSSIP_PORT:-9210}"

# Toolchain PATH (adjust if needed)
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

cd "$(dirname "$0")/.."

if [ ! -f "$SO" ]; then
  echo "[build] $SO not found, running anchor build ..."
  anchor build --ignore-keys
fi

echo "[1/3] Stopping any old validator ..."
pkill -f solana-test-validator 2>/dev/null || true
sleep 2
rm -rf "$LEDGER"

echo "[2/3] Starting localnet validator (RPC :$RPC_PORT / gossip :$GOSSIP_PORT), program preloaded ..."
solana-test-validator --reset --quiet \
  --ledger "$LEDGER" \
  --rpc-port "$RPC_PORT" --gossip-port "$GOSSIP_PORT" \
  --bpf-program "$PROGRAM_ID" "$SO" &
VALIDATOR_PID=$!
trap 'kill $VALIDATOR_PID 2>/dev/null || true' EXIT

for i in $(seq 1 60); do
  if solana cluster-version --url "http://localhost:$RPC_PORT" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[3/3] Running anchor test (skip built-in validator/deploy/build) ..."
anchor test --skip-local-validator --skip-deploy --skip-build
