# Launchpad

This repository holds two related things:

| | |
| --- | --- |
| **`contracts/`** | A Foundry + OpenZeppelin project targeting **Ethereum Sepolia**: `LaunchpadToken` (ERC-20), a guarded deployment script, 29 tests, and [`ARCHITECTURE.md`](contracts/ARCHITECTURE.md) specifying the sale, vesting and factory contracts to come. |
| **everything else** | A working memecoin launchpad front end for **Robinhood Chain**, with its own bonding-curve contracts in `src/contracts/`. |

They share a front end: `npm run compile:foundry` exports the Foundry ABIs into
`src/contracts/` as typed modules, and the app's network layer knows about
Sepolia alongside both Robinhood networks.

## 📚 Documentation

Full docs live in [`docs/`](docs/README.md):

| | Page | |
| --- | --- | --- |
| 1 | [Getting started](docs/01-getting-started.md) | Install, build, test, run |
| 2 | [Deployment](docs/02-deployment.md) | Sepolia and both Robinhood networks, with verification |
| 3 | [Airdrop](docs/03-airdrop.md) | Merkle airdrops end to end |
| 4 | [Contracts](docs/04-contracts.md) | Reference for every contract |
| 5 | [Configuration](docs/05-configuration.md) | Every environment variable |
| 6 | [Operations](docs/06-operations.md) | Runbook and troubleshooting |

Design: [`contracts/ARCHITECTURE.md`](contracts/ARCHITECTURE.md) — the sale,
vesting and factory contracts still to be built.

---

# Hoodpad

A memecoin launchpad for **Robinhood Chain** — the public Arbitrum Orbit network
that uses ETH for gas (mainnet `4663`, testnet `46630`).

Create an ERC-20 from the browser, trade it against a bonding curve from the
very first block, and watch it graduate into a Uniswap V2 pool with the LP
tokens burned. There is no server, no database and no indexer: the contracts are
the back end, and the UI reads them directly.

```
npm install
npm run compile        # solc -> typed ABI modules
npm test               # 66 checks against an in-process EVM
npm run dev            # http://localhost:3000
```

It runs with no configuration at all, on testnet, out of the box.

---

## How a launch works

Each coin is **one contract** — `MemeToken` — that is both the ERC-20 and its
market. Two launch shapes come out of the same code.

### Bonding curve (default)

Most of the supply sits on a constant-product curve with a virtual ETH reserve,
so there is a real price before anyone has traded:

```
k = virtualEth × curveSupply                    (fixed at deploy)

buy:   tokensOut = tokenReserve − ⌈k / (virtualEth + ethReserve + ethIn)⌉
sell:  ethOut    = (virtualEth + ethReserve) − ⌊k / (tokenReserve + tokensIn)⌋
```

Rounding always favours the pool, and a small fee is taken on both sides, so a
buy-and-sell round trip can never come out ahead. Both directions work
immediately — no pool to seed, no empty order book.

When the curve has taken in `graduationTarget` ETH it **graduates** on the buy
that crosses the line: the contract calls a Uniswap V2 router itself, deposits
every token still on the curve plus the entire raise, and sends the LP tokens to
`0x…dEaD`. Nobody holds them, so that liquidity can never be pulled. If the
router call fails, the curve simply stays open and tradable rather than
stranding anyone's funds.

With defaults of 1.2 ETH virtual reserve, a 3.4 ETH target and 80% of a 1B
supply on the curve, a coin opens around a 1.5 ETH market cap and graduates near
22 ETH.

### Fixed supply

Set the curve share to zero and every token is minted to the creator, who opens
and manages a pool themselves on the **Liquidity** page. This mirrors the
classic launch shape.

## Launch protections

All optional, all fixed at deploy, and all written so they can throttle buying
but **never block a sell**:

| Guard | What it does |
| --- | --- |
| 🤖 Anti-bot | One buy per wallet per block. Sells are never rate-limited. |
| 🐋 Anti-whale | Caps how much a wallet may hold. Checked when tokens arrive, never when they leave. |
| 💸 Custom tax | Up to 10% on transfers, to an address of the creator's choosing. Locked at launch; `MAX_TAX_BPS` makes raising it impossible. |
| 🔑 Renounce | Drops the owner role. Supply is fixed and there is no mint function either way, so this only removes the ability to edit metadata and exemptions. |

The launchpad's own transfer tax is capped at 2.5% by `MAX_PLATFORM_TAX_BPS` in
the contract, so no factory owner can raise it beyond that.

## Discovery

`MemeFactory` is the registry. Deploy it once and every launch is visible to
everyone; without it, launches still work and still trade, but the board only
lists what the current browser created or imported. The UI says which of the two
it is rather than pretending the list is global.

```bash
DEPLOYER_KEY=0x… npm run deploy:factory -- --chain testnet
# then put the printed address in .env.local as NEXT_PUBLIC_FACTORY_ADDRESS
```

Optional flags: `--treasury 0x…` (fee recipient, defaults to the deployer) and
`--router 0x…` (the Uniswap V2 router new coins graduate into).

## Configuration

Copy `.env.example` to `.env.local`. Every value has a working default, so set
only what you need to change.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CHAIN` | `testnet` (default) or `mainnet` |
| `NEXT_PUBLIC_{MAINNET,TESTNET}_CHAIN_ID` | Chain ids |
| `NEXT_PUBLIC_{MAINNET,TESTNET}_RPC_URL` | RPC endpoints |
| `NEXT_PUBLIC_{MAINNET,TESTNET}_EXPLORER_URL` | Explorer links |
| `NEXT_PUBLIC_{MAINNET,TESTNET}_NAME` | Display names |
| `NEXT_PUBLIC_NATIVE_SYMBOL` / `_NAME` | Gas token |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Registry; enables the global board |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | Uniswap V2 router for graduation and the liquidity page |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Fee recipient for direct deploys |
| `NEXT_PUBLIC_RPC_BATCH_SIZE` | Calls per batched JSON-RPC request |
| `NEXT_PUBLIC_LOG_CHUNK` | Blocks per `eth_getLogs` window — lower it if the trade feed comes back empty |
| `NEXT_PUBLIC_TRADE_LOOKBACK` | How far back to scan for trades |
| `NEXT_PUBLIC_ETH_USD` | Optional rate; USD figures are hidden when unset |
| `NEXT_PUBLIC_SITE_NAME` | Branding |
| `DEPLOYER_KEY` | Server-side only, used by `deploy:factory` |

## Design notes

**No aggregator contract.** Reads are batched at the JSON-RPC transport layer,
not through an on-chain multicall, so nothing the UI displays depends on a
third-party deployment. The contracts help: `getState()` returns a whole coin in
one call and `getMeta()` its images and links.

**No indexer.** The price chart and trade feed are built from the coin's own
`Trade` logs, scanned backwards in chunks from the head so a busy coin stays
cheap and a quiet one stays bounded. Launch times come from the factory's
`Launched` events.

**Images live on-chain.** An upload is squared off and compressed in the browser
until the data URI fits a ~12KB budget, then written into the contract, so there
is no pinning service to go down. Pasting a URL instead is offered and cheaper.

**Quotes are computed twice.** `src/lib/curve.ts` mirrors the contract's maths so
the trade panel can quote on every keystroke, and the trade is then simulated
against the contract before it is signed. `npm test` asserts the two agree
exactly.

## Layout

```
contracts/       Foundry: LaunchpadToken, MerkleAirdrop, deploy scripts, 58 tests
docs/            Full documentation
airdrop/         Generated Merkle trees and claim files
src/contracts/   MemeToken.sol, MemeFactory.sol + generated typed ABIs
src/lib/         chain config, contract reads/writes, curve maths, formatting
src/hooks/       wallet, coin board, one coin, trades, pools
src/components/  UI, grouped by the page that owns it
src/app/         landing, /create, /coins, /coin/[address], /portfolio, /liquidity
scripts/         compile, test, deploy the factory
```

Wallets are discovered through EIP-6963, so the user picks which installed
wallet to use rather than whichever one won the race for `window.ethereum`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run compile` | Compile the Robinhood Chain contracts to typed ABI modules |
| `npm run compile:foundry` | Export the Foundry ABIs in `contracts/` into `src/contracts/` |
| `npm run compile:all` | Both of the above |
| `npm test` | Contract + curve-parity checks against an in-process EVM |
| `npm run test:airdrop` | Merkle tree ↔ Solidity parity, against the real compiled contract |
| `npm run test:foundry` | `forge test` in `contracts/` |
| `npm run test:all` | All three suites |
| `npm run airdrop:build` | Build a Merkle tree from a CSV of recipients |
| `npm run lint` | ESLint |
| `npm run deploy:factory` | Deploy `MemeFactory` to a Robinhood network |

## Deploying

Short version:

```bash
# Ethereum Sepolia — LaunchpadToken
cd contracts && cp .env.example .env       # fill in PRIVATE_KEY, SEPOLIA_RPC_URL
forge script script/DeployToken.s.sol:DeployToken --rpc-url sepolia --broadcast --verify

# Robinhood Chain testnet — LaunchpadToken
EXPECTED_CHAIN_ID=46630 forge script script/DeployToken.s.sol:DeployToken \
  --rpc-url robinhood_testnet --broadcast

# Robinhood Chain testnet — the memecoin factory
DEPLOYER_KEY=0x… npm run deploy:factory -- --chain testnet --write-env
```

The deployment scripts refuse to broadcast unless the chain matches
`EXPECTED_CHAIN_ID`, the deployer holds gas, and — for Ethereum mainnet —
`ALLOW_MAINNET=true` is set explicitly. All three are checked in simulation,
before anything is signed.

Full walkthroughs, including Blockscout and Etherscan verification, are in
[docs/02-deployment.md](docs/02-deployment.md).

## Airdrops

```bash
npm run airdrop:build -- --input airdrop/recipients.csv --name season-one
cd contracts && AIRDROP_TOKEN=0x… AIRDROP_MERKLE_ROOT=0x… AIRDROP_TOTAL=… AIRDROP_FUND=true \
  forge script script/DeployAirdrop.s.sol:DeployAirdrop --rpc-url sepolia --broadcast
```

`MerkleAirdrop` puts only the root of the recipient list on-chain, so cost is
independent of list size and each recipient pays for their own claim. The owner
can never take the funds before the deadline, and never at all if none was set.

See [docs/03-airdrop.md](docs/03-airdrop.md).

## Disclaimer

Not affiliated with Robinhood Markets, Inc. "Robinhood Chain" refers to the
public Arbitrum Orbit network. This is an independent, non-custodial launchpad:
every transaction is signed by your own wallet and no funds are ever held by the
app. Launching and trading tokens is high-risk — most tokens go to zero. Nothing
here is financial advice.

The contracts in this repository have **not** been audited.
