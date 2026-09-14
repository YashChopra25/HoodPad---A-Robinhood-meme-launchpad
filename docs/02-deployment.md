# Deployment

Three deployable things live here:

| What | Where | Chain |
| --- | --- | --- |
| `LaunchpadToken` | `contracts/` | Ethereum Sepolia |
| `MerkleAirdrop` | `contracts/` | any EVM chain — see [Airdrop](03-airdrop.md) |
| `MemeFactory` | `src/contracts/` | Robinhood Chain testnet or mainnet |

Three scripts deploy them:

| Script | Deploys |
| --- | --- |
| `DeployToken.s.sol` | `LaunchpadToken` alone |
| `DeployAirdrop.s.sol` | `MerkleAirdrop` against an existing token |
| `DeployDemo.s.sol` | Both at once, funded — one command from nothing |

---

## Before anything

Every deployment needs a funded key. Never reuse a key that holds real funds for
testnet work, and never commit one.

```bash
cast wallet new
```

Both `.env` and `.env.local` are gitignored; `.env.example` files are committed
and must stay empty of secrets.

---

## Deploying LaunchpadToken to Sepolia

### 1. Configure

```bash
cd contracts
cp .env.example .env
```

```bash
PRIVATE_KEY=0x<your key>
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
ETHERSCAN_API_KEY=<https://etherscan.io/myapikey>
INITIAL_SUPPLY=1000000
EXPECTED_CHAIN_ID=11155111
```

### 2. Rehearse locally

A local run costs nothing and catches everything except a bad RPC.

```bash
anvil                                    # terminal 1
```

```bash
cd contracts                             # terminal 2
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
EXPECTED_CHAIN_ID=31337 \
forge script script/DeployToken.s.sol:DeployToken \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

That key is Anvil's first well-known account. It is public. Never fund it.

### 3. Deploy

```bash
cd contracts
forge script script/DeployToken.s.sol:DeployToken \
  --rpc-url sepolia --broadcast --verify -vvvv
```

`--rpc-url sepolia` resolves through `[rpc_endpoints]` in `foundry.toml`, which
reads `SEPOLIA_RPC_URL` from `.env`. Output:

```
=========================================================
Network          Ethereum Sepolia
Chain id         11155111
Deployer         0x...
Gas balance      ...
Initial supply   1000000000000000000000000
=========================================================
LaunchpadToken deployed
  address        0x...
  name           Launchpad Token
  symbol         LPT
  decimals       18
  total supply   1000000000000000000000000
  deployer holds 1000000000000000000000000
  explorer       https://sepolia.etherscan.io/address/0x...
=========================================================
```

### Safety guards

The script refuses to broadcast unless all three hold:

| Guard | Failure |
| --- | --- |
| Not Ethereum mainnet, unless `ALLOW_MAINNET=true` | `MainnetDeploymentBlocked()` |
| `block.chainid == EXPECTED_CHAIN_ID` | `UnexpectedChain(expected, actual)` |
| Deployer holds gas | `DeployerHasNoGas(deployer, chainId)` |

All three run in the simulation forge performs *before* sending anything, so a
mistyped `--rpc-url` fails without signing a transaction. They live in
`DeployToken.assertSafeToDeploy`, which is `pure` and takes its inputs as
arguments — which is what lets `test/DeployToken.t.sol` exercise each one
directly rather than through environment variables.

Mainnet stays reachable when you mean it:

```bash
ALLOW_MAINNET=true EXPECTED_CHAIN_ID=1 forge script ... --rpc-url mainnet --broadcast
```

Do not do that with unaudited contracts.

---

## Verifying on Etherscan

`--verify` handles it during deployment. If it was skipped or failed:

```bash
cd contracts
forge verify-contract <TOKEN_ADDRESS> src/LaunchpadToken.sol:LaunchpadToken \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(uint256)" 1000000000000000000000000) \
  --watch
```

The constructor argument must match what was deployed exactly, or verification
fails with a bytecode mismatch. `INITIAL_SUPPLY=1000000` in `.env` means
`1000000000000000000000000` here.

### Confirming it is publicly readable

Anyone, from any Sepolia RPC:

```bash
export T=<TOKEN_ADDRESS>
export R=https://ethereum-sepolia-rpc.publicnode.com

cast call $T "name()(string)"              --rpc-url $R   # "Launchpad Token"
cast call $T "symbol()(string)"            --rpc-url $R   # "LPT"
cast call $T "decimals()(uint8)"           --rpc-url $R   # 18
cast call $T "totalSupply()(uint256)"      --rpc-url $R
cast call $T "balanceOf(address)(uint256)" <YOUR_ADDRESS> --rpc-url $R
```

In a wallet: switch MetaMask to Sepolia → Import tokens → paste the address.
Name, symbol and balance should populate on their own.

In this app:

```bash
npm run compile:foundry
```

then in `.env.local`:

```bash
NEXT_PUBLIC_CHAIN=sepolia
NEXT_PUBLIC_LAUNCHPAD_TOKEN_ADDRESS=<TOKEN_ADDRESS>
```

---

## Deploying the Foundry contracts to Robinhood Chain

`LaunchpadToken` and `MerkleAirdrop` are plain EVM contracts, and Robinhood
Chain is a fully EVM-compatible Arbitrum Orbit network, so the same scripts
deploy there. Only the chain id and the verifier change.

Following [Robinhood's own Foundry guide](https://docs.robinhood.com/chain/deploy-smart-contracts).

### RPC aliases

`contracts/foundry.toml` defines `robinhood` and `robinhood_testnet`, so
`--rpc-url robinhood_testnet` just works:

```toml
[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
anvil = "http://127.0.0.1:8545"
robinhood = "https://rpc.mainnet.chain.robinhood.com"
robinhood_testnet = "https://rpc.testnet.chain.robinhood.com"
```

Those two are spelled out rather than defaulted from the environment because
`foundry.toml` has no syntax for a fallback — `${RH_RPC_URL:-https://…}` is read
as a variable literally named `RH_RPC_URL:-https://…` and fails at resolution.
To use a private provider such as Alchemy, pass the URL directly:

```bash
export RH_RPC_URL=https://robinhood-testnet.g.alchemy.com/v2/<API_KEY>
forge script ... --rpc-url $RH_RPC_URL
```

### Deploy

```bash
cd contracts
EXPECTED_CHAIN_ID=46630 forge script script/DeployToken.s.sol:DeployToken   --rpc-url robinhood_testnet --broadcast
```

`EXPECTED_CHAIN_ID` is what makes the guard target Robinhood instead of Sepolia;
without it the script refuses to run with `UnexpectedChain(11155111, 46630)`.
Set it in `contracts/.env` if you work on Robinhood Chain regularly.

For mainnet, `--rpc-url robinhood` and `EXPECTED_CHAIN_ID=4663`. The
`ALLOW_MAINNET` guard only covers *Ethereum* mainnet (chain 1), so it does not
apply here — the `EXPECTED_CHAIN_ID` check is what protects you.

### Verify on Blockscout

Robinhood Chain runs Blockscout, not Etherscan. **No API key is needed**, but
`--verifier blockscout` and `--verifier-url` must be passed explicitly:

```bash
# Testnet
forge verify-contract <ADDRESS> src/LaunchpadToken.sol:LaunchpadToken   --rpc-url robinhood_testnet   --verifier blockscout   --verifier-url https://explorer.testnet.chain.robinhood.com/api/   --constructor-args $(cast abi-encode "constructor(uint256)" 1000000000000000000000000)

# Mainnet
forge verify-contract <ADDRESS> src/LaunchpadToken.sol:LaunchpadToken   --rpc-url robinhood   --verifier blockscout   --verifier-url https://robinhoodchain.blockscout.com/api/   --constructor-args $(cast abi-encode "constructor(uint256)" 1000000000000000000000000)
```

You can also append `--verify --verifier blockscout --verifier-url …` to the
`forge script` command to verify during deployment.

> The testnet Blockscout API answers openly. The mainnet instance sits behind
> Cloudflare and may reject automated requests with a `403`; if verification
> fails that way, use the explorer's web form instead.

### Airdrops on Robinhood Chain

Identical, with the chain id changed:

```bash
cd contracts
EXPECTED_CHAIN_ID=46630 AIRDROP_TOKEN=0x… AIRDROP_MERKLE_ROOT=0x… AIRDROP_TOTAL=… AIRDROP_FUND=true forge script script/DeployAirdrop.s.sol:DeployAirdrop   --rpc-url robinhood_testnet --broadcast
```

`MerkleAirdrop` distributes any ERC-20, so it works on a `MemeToken` from the
memecoin launchpad just as well as on `LaunchpadToken`.

---

## Deploying MemeFactory to Robinhood Chain

`MemeFactory` is the registry that makes memecoin launches globally
discoverable. Without it the app still launches and trades coins, but the board
only lists what the current browser created.

### Testnet

```bash
# repository root
DEPLOYER_KEY=0x<funded testnet key> \
npm run deploy:factory -- --chain testnet --write-env
```

`--write-env` writes `NEXT_PUBLIC_FACTORY_ADDRESS` into `.env.local` for you.
Restart the dev server afterwards.

### Options

| Flag | Default | Purpose |
| --- | --- | --- |
| `--chain` | `NEXT_PUBLIC_CHAIN`, else `testnet` | Target network |
| `--preset` | matches `--chain` | Which economics to write in |
| `--treasury` | the deployer | Fee recipient |
| `--router` | `NEXT_PUBLIC_ROUTER_ADDRESS` | Uniswap V2 router used at graduation |
| `--update 0x…` | — | Reconfigure an existing factory instead of deploying |
| `--write-env` | off | Write the address into `.env.local` |

### Presets

The constructor ships mainnet figures; the script tunes the factory immediately
afterwards with `setFees` and `setCurveParams`. Testnet is scaled down roughly
100×, because a faucet hands out a fraction of an ETH and a 3.4 ETH graduation
target would make the most interesting part of the app impossible to exercise.

| | Mainnet | Testnet |
| --- | --- | --- |
| Launch fee | 0.01 ETH | 0.0001 ETH |
| Anti-bot / anti-whale | 0.005 ETH each | 0.00005 ETH each |
| Custom tax | 0.01 ETH | 0.0001 ETH |
| Virtual reserve | 1.2 ETH | 0.012 ETH |
| Graduates at | 3.4 ETH | 0.034 ETH |
| Curve trade fee | 1% | 1% |
| Transfer tax | 2.5% | 2.5% |

Percentages are identical on purpose: fees and taxes must behave the same under
test as in production. Only the absolute amounts shrink. The figures live in
`src/lib/presets.ts` and are shared by the app and the deploy script, so what
the UI quotes is what the factory charges.

### Mainnet

```bash
DEPLOYER_KEY=0x<funded key> \
npm run deploy:factory -- --chain mainnet --treasury 0x<your treasury>
```

Deploy the factory once and keep the address. Redeploying orphans every coin
already in the registry.

### Reconfiguring later

```bash
DEPLOYER_KEY=0x<factory owner key> \
npm run deploy:factory -- --chain testnet --update 0x<factory address>
```

Only the factory owner can do this; the script checks before spending gas.

---

## Networks

| | Robinhood Chain | Robinhood testnet | Ethereum Sepolia |
| --- | --- | --- | --- |
| Chain ID | 4663 | 46630 | 11155111 |
| RPC | `rpc.mainnet.chain.robinhood.com` | `rpc.testnet.chain.robinhood.com` | any provider |
| Explorer | [Blockscout](https://robinhoodchain.blockscout.com) | [explorer.testnet…](https://explorer.testnet.chain.robinhood.com) | [Etherscan](https://sepolia.etherscan.io) |
| Gas token | ETH | ETH | ETH |
| Faucet | — | [faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com/) | [Google Cloud](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |

More links — wallet one-click setup, RPC providers, alternative faucets — are in
[Getting started](01-getting-started.md#robinhood-chain-reference).

Robinhood Chain is a public Arbitrum Orbit network. Its documentation lists no
canonical Uniswap V2 router, which is why `NEXT_PUBLIC_ROUTER_ADDRESS` is blank
by default and bonding curves keep trading past their graduation target rather
than stranding a raise. Set it if a V2 deployment appears.

---

## Deployment records

Foundry writes every broadcast to
`contracts/broadcast/<Script>/<chainId>/run-latest.json` — transaction hashes,
addresses, constructor arguments. Worth committing for real deployments; local
Anvil runs (`31337/`) are gitignored, as is `contracts/cache/`, which holds
sensitive values.

---

## Next

- [Airdrop](03-airdrop.md) — distribute the token you just deployed.
- [Operations](06-operations.md) — running it afterwards.
