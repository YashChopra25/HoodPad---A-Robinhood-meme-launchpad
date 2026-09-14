# Configuration

Every value is optional. The app runs on Robinhood Chain testnet with no `.env`
file at all, so nothing below is required to get started.

There are two environment files, for two different consumers:

| File | Read by | Committed |
| --- | --- | --- |
| `.env.local` | The Next.js front end and the Node scripts | No — `.env.example` is |
| `contracts/.env` | Foundry: `forge script`, `forge verify-contract` | No — `contracts/.env.example` is |

Both `.env` and `.env.local` are gitignored. `.env.example` files are committed
and must never contain a real key.

---

## Front end and Node tooling — `.env.local`

### Network selection

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN` | `testnet` | `testnet`, `mainnet` or `sepolia`. Anything else falls back to `testnet`, so a typo cannot silently point at real money. |

### Network definitions

Each network is defined independently, so pointing at a fork or a private RPC
needs no code change.

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_MAINNET_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_MAINNET_NAME` | `Robinhood Chain` |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `NEXT_PUBLIC_MAINNET_EXPLORER_NAME` | `Blockscout` |
| `NEXT_PUBLIC_MAINNET_EXPLORER_URL` | `https://robinhoodchain.blockscout.com` |
| `NEXT_PUBLIC_TESTNET_CHAIN_ID` | `46630` |
| `NEXT_PUBLIC_TESTNET_NAME` | `Robinhood Chain Testnet` |
| `NEXT_PUBLIC_TESTNET_RPC_URL` | `https://rpc.testnet.chain.robinhood.com` |
| `NEXT_PUBLIC_TESTNET_EXPLORER_NAME` | `Robinhood Testnet Explorer` |
| `NEXT_PUBLIC_TESTNET_EXPLORER_URL` | `https://explorer.testnet.chain.robinhood.com` |
| `NEXT_PUBLIC_SEPOLIA_CHAIN_ID` | `11155111` |
| `NEXT_PUBLIC_SEPOLIA_NAME` | `Ethereum Sepolia` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` |
| `NEXT_PUBLIC_SEPOLIA_EXPLORER_NAME` | `Etherscan` |
| `NEXT_PUBLIC_SEPOLIA_EXPLORER_URL` | `https://sepolia.etherscan.io` |
| `NEXT_PUBLIC_NATIVE_SYMBOL` | `ETH` |
| `NEXT_PUBLIC_NATIVE_NAME` | `Ether` |

### Contract addresses

| Variable | Unset behaviour |
| --- | --- |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | The coin board falls back to a per-browser registry. Launches still work; they are just not globally discoverable. The UI says which mode it is in rather than pretending the list is global. |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | Bonding curves keep trading past their graduation target instead of opening a pool. Nothing is stranded. The liquidity page explains that no router is configured. |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Launch fees for direct (factory-less) deploys go to the creator's own wallet. |
| `NEXT_PUBLIC_LAUNCHPAD_TOKEN_ADDRESS` | Nothing — informational, for a Sepolia deployment. |
| `NEXT_PUBLIC_AIRDROP_ADDRESS` | Nothing — set it to point a claim page at a deployed `MerkleAirdrop`. |

Malformed addresses and the zero address are treated as unset, so a half-filled
variable degrades to the safe path rather than producing calls to `0x0`.

### Indexing

There is no server and no indexer: the chart, the trade feed and launch times
are all read from event logs. These control that scan.

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_BATCH_SIZE` | `20` | Calls per batched JSON-RPC request. Batching happens at the transport layer, **not** through an on-chain aggregator, so nothing the UI shows depends on a third-party contract. |
| `NEXT_PUBLIC_LOG_CHUNK` | `9000` | Blocks per `eth_getLogs` window. **Lower this first if the trade feed comes back empty** — public RPCs cap the range and reject anything wider. |
| `NEXT_PUBLIC_TRADE_LOOKBACK` | `200000` | How far back to scan for a coin with no known launch block. |

### Display

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_NAME` | `RobinHood Launchpad` | Branding |
| `NEXT_PUBLIC_ETH_USD` | unset | Optional rate. USD figures are hidden entirely when unset, rather than showing a stale or invented number. |

### Scripts only

| Variable | Used by |
| --- | --- |
| `DEPLOYER_KEY` | `npm run deploy:factory`. Server-side only; never exposed to the browser. |

---

## Foundry — `contracts/.env`

| Variable | Required for | Notes |
| --- | --- | --- |
| `PRIVATE_KEY` | Any deployment | 0x-prefixed. Testnet keys only. |
| `SEPOLIA_RPC_URL` | `--rpc-url sepolia` | Resolved through `[rpc_endpoints]` |
| `ETHERSCAN_API_KEY` | Sepolia verification | Not needed on Robinhood Chain, which runs Blockscout |
| `INITIAL_SUPPLY` | `DeployToken` | Whole tokens; the script scales by 1e18. Default `1000000` |
| `EXPECTED_CHAIN_ID` | Every deployment | The guard. Default `11155111`; set `46630` for Robinhood testnet |
| `ALLOW_MAINNET` | Ethereum mainnet only | Must be `true` to deploy to chain 1. Leave unset. |
| `AIRDROP_TOKEN` | `DeployAirdrop` | ERC-20 to distribute |
| `AIRDROP_MERKLE_ROOT` | `DeployAirdrop` | From `npm run airdrop:build` |
| `AIRDROP_TOTAL` | `DeployAirdrop` | Base units, must equal the tree's total |
| `AIRDROP_DEADLINE` | `DeployAirdrop` | Unix seconds; `0` means claiming never closes and `sweep` is permanently unavailable |
| `AIRDROP_FUND` | `DeployAirdrop` | `true` transfers the total in during the same run |

`RH_RPC_URL` is *not* read from `foundry.toml` — the Robinhood aliases are
literal public endpoints, because `foundry.toml` has no fallback syntax. Pass a
private provider directly with `--rpc-url $RH_RPC_URL`.

---

## Launch economics

Fees and curve parameters are **not** environment variables. They live in
`src/lib/presets.ts` and are written into the factory at deployment, so the
contract is the source of truth and the UI quotes whatever it will actually
charge. See [Deployment](02-deployment.md#presets).

To change them on a deployed factory:

```bash
DEPLOYER_KEY=0x<owner key> \
npm run deploy:factory -- --chain testnet --update 0x<factory address>
```

---

## Precedence and pitfalls

**Next.js inlines `NEXT_PUBLIC_*` at build time.** They are read where they
appear as a literal `process.env.NEXT_PUBLIC_X` expression — which is why
`src/lib/env.ts` spells every one out rather than looking them up through a
helper. Two consequences:

- Changing a `NEXT_PUBLIC_*` value requires a **restart** in development and a
  **rebuild** in production.
- Never put a secret in one. They are compiled into the browser bundle.

`.env.local` overrides `.env`. Both are gitignored.

Foundry reads `contracts/.env` automatically for `${VAR}` substitution in
`foundry.toml` and for `vm.envUint` / `vm.envOr` in scripts.
