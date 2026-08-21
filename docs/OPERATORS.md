# Operator guide

1. Open the web app → Operator installer
2. Connect clean wallet on BlockDAG 1404
   - RPC: https://rpc.east.bdag-us.org or https://rpc.west.bdag-us.org
   - Explorer: https://explorer.east.bdag-us.org or https://explorer.west.bdag-us.org
   - Site: https://bdag-us.org
   - Do not use bdagscan RPC
3. Deploy vault or paste existing address
4. Fund vault with BDAG
5. Paste CSV of miners, set min payout / fee if needed
6. Parse → Dry run → Set next batch (wait for each confirmation)
7. Copy share message for miners

If gap > 0 on your wallet, stop and use another clean key.

## Safety
- Use a new clean wallet only (not a stuck payout wallet)
- Confirm each operator transaction before sending the next
- One vault per pool — do not mix funds with other pools
- Batch size about 20–40 max for setClaimable
