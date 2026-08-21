# BDAG Pool Claim Vault App

Step-by-step operator installer + miner claim page for BlockDAG (chain 1404).

## Features included

### Operator installer
- Connect wallet + chain 1404 check
- Community RPC only (`https://rpc.east.bdag-us.org`, `https://rpc.west.bdag-us.org`) — not bdagscan
- Nonce gap warning before operator actions
- Deploy `PoolPayoutVault` from browser
- Or paste existing vault address
- Fund guidance + vault balance refresh
- CSV import of unpaid miners
- Minimum payout filter
- Pool fee % deduction
- Parse / preview table
- Dry run (no tx)
- Set claimable in batches with confirm-before-next
- Solvency note (total after fee)
- Pause / unpause
- Withdraw (owner)
- Add operator
- Event history (ClaimableSet / Claimed)
- Export preview CSV
- Share message for miners
- localStorage last vault
- `?vault=0x...` prefill

### Miner claim
- Connect wallet
- Paste vault address
- Security checkboxes before claim enabled
- Refresh claimable + vault balance
- Claim

## Network
- Chain ID: 1404
- RPC: https://rpc.east.bdag-us.org , https://rpc.west.bdag-us.org
- Explorer: https://explorer.east.bdag-us.org , https://explorer.west.bdag-us.org
- Website: https://bdag-us.org
- Do not use bdagscan RPC

## Deploy site
GitHub Pages from `/web` folder.

## Security
- One vault per pool
- Official site only
- Never seed phrases
- Confirm each operator tx before the next
