# BDAG Pool Claim App

Multi-page operator + miner interface for BlockDAG (chain 1404) payout vaults.

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Home — choose Operator or Miner |
| `deploy.html` | Deploy a new `PoolPayoutVault` or save an existing address |
| `fund.html` | Send BDAG to the vault (no redeploy needed) |
| `manage.html` | CSV setClaimable, pause, withdraw, operators, event history |
| `claim.html` | Miner claim page |

## Network

- **Chain ID:** 1404
- **RPC:** https://rpc.blockdag.engineering
- **Explorer:** https://explorer.blockdag.engineering
- Do **not** use bdagscan RPC

## Structure

```
bdag-pool-app/
├── index.html
├── deploy.html
├── fund.html
├── manage.html
├── claim.html
├── css/styles.css
├── js/
│   ├── app.js       # shared wallet / nav / vault helpers
│   └── embed.js     # VAULT_ABI + VAULT_BYTECODE
└── contracts/
    └── PoolPayoutVault.sol
```

## Operator flow

1. **Deploy** → create vault (or paste existing)
2. **Fund** → send BDAG to the vault address anytime
3. **Manage** → import unpaid miners CSV → setClaimable in batches
4. Share the claim link with miners (`claim.html?vault=0x...`)

## Miner flow

1. Open claim page (with vault in URL or paste it)
2. Connect wallet on chain 1404
3. Refresh claimable → Claim

## Notes

- Outer transaction **Value is always 0** on claim — the transfer is internal.
- Confirm each operator transaction before the next (nonce gap guard).
- One vault per pool. Never ask for seed phrases.

## Deploy site

Host the folder on GitHub Pages, Netlify, or any static host.
Keep relative paths (`./css`, `./js`) intact.
