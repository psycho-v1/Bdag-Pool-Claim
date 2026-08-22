# BDAG Pool Claim App

Multi-page operator + miner interface for BlockDAG (chain 1404) payout vaults.

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Home — choose Operator or Miner |
| `deploy.html` | Deploy simple vault or save existing / proxy address |
| `fund.html` | Send BDAG to the vault (no redeploy needed) |
| `manage.html` | CSV setClaimable, pause, withdraw, operators, events |
| `upgrade.html` | **Owner-only** — point proxy at a new implementation |
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
├── upgrade.html
├── claim.html
├── css/styles.css
├── js/
│   ├── app.js
│   └── embed.js          # simple vault ABI + bytecode
└── contracts/
    ├── PoolPayoutVault.sol                 # simple (immutable)
    ├── PoolPayoutVaultUpgradeable.sol      # UUPS-style logic
    └── VaultProxy.sol                      # ERC1967 proxy
```

## Two vault modes

### 1. Simple (default on Deploy page)

- One contract, fixed logic
- Browser deploy works out of the box (`embed.js` bytecode)
- To change logic → deploy a **new** vault and migrate

### 2. Upgradeable (proxy + implementation)

- Miners always use the **proxy** address (never changes)
- Owner can push new logic via **Upgrade contract** page
- Deploy with Remix (or Foundry/Hardhat):

**Remix steps**

1. Open https://remix.ethereum.org
2. Add `PoolPayoutVaultUpgradeable.sol` and `VaultProxy.sol`
3. Compile with Solidity 0.8.20+
4. Deploy **PoolPayoutVaultUpgradeable** (implementation) on chain 1404  
   RPC: `https://rpc.blockdag.engineering`
5. Encode `initialize(owner, operator)` with your wallet as owner
6. Deploy **VaultProxy** with:
   - `implementation_` = address from step 4
   - `initData` = the encoded `initialize(...)` bytes
7. **Share the VaultProxy address** with miners (this is the vault)
8. Fund / Manage / Claim use that proxy address as usual
9. When you need a fix: deploy a new implementation → open **Upgrade contract** → `upgradeTo(newImpl)`

## Operator flow

1. Deploy (simple) **or** deploy upgradeable via Remix and paste proxy on Deploy page
2. **Fund** — top up BDAG anytime
3. **Manage** — set claimable from CSV
4. Share `claim.html?vault=0xPROXY`
5. (Upgradeable only) **Upgrade** when logic must change

## Miner flow

1. Open claim page with vault in URL or paste it
2. Connect wallet on chain 1404
3. Refresh claimable → Claim

## Notes

- Outer claim tx **Value is always 0** — transfer is internal
- Confirm each operator tx before the next (nonce gap guard)
- Storage layout of upgradeable implementations must stay compatible
- Never share seed phrases

## Deploy site

Host the folder on GitHub Pages / Netlify / any static host.
Keep relative paths (`./css`, `./js`) intact.
