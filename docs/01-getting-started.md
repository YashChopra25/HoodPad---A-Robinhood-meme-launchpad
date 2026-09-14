# Getting started

From a fresh clone to a running app and a green test suite.

## Prerequisites

| Tool | Why | Check |
| --- | --- | --- |
| Node 20+ | Front end, tooling, the EVM-backed tests | `node --version` |
| Foundry | Compiling, testing and deploying the Solidity | `forge --version` |
| Git | Solidity dependencies are submodules | `git --version` |

### Installing Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
export PATH="$PATH:$HOME/.foundry/bin"
```

That last line matters: `foundryup` installs to `~/.foundry/bin`, which is not on
a non-login shell's `PATH` by default. Add it to `~/.zshrc` or `~/.bashrc` so
`forge` is there next time.

## Install

```bash
git clone <this repository>
cd lauchpad

npm install                              # front end and Node tooling
git submodule update --init --recursive  # forge-std and openzeppelin-contracts
```

`forge install` inside `contracts/` does the same thing as the submodule
command, if you prefer.

Dependencies are pinned to exact tags — OpenZeppelin `v5.5.0`, forge-std
`v1.16.2` — so a clone builds the same bytecode this repository was developed
against.

## Build

```bash
cd contracts && forge build && cd ..     # Solidity
npm run compile:all                      # ABIs into src/contracts/
npm run build                            # Next.js production build
```

`npm run compile:all` runs two different pipelines, which is worth understanding:

- `npm run compile` uses the `solc` npm package to compile
  `src/contracts/*.sol` — the Robinhood Chain contracts, which the browser
  deploys itself and therefore needs creation bytecode for.
- `npm run compile:foundry` reads Foundry's artifacts from `contracts/out/` and
  re-emits them as TypeScript.

Both produce the same shape: a module exporting the ABI as a `const` assertion,
so viem infers argument and return types straight from the Solidity rather than
from a hand-written interface.

## Test

```bash
npm run test:all
```

Three suites, each covering something the others cannot:

| Suite | Command | What it proves |
| --- | --- | --- |
| Foundry | `npm run test:foundry` | 58 tests over the token, the airdrop, and the deployment guards. |
| Robinhood contracts | `npm test` | 66 checks against an in-process EVM, including that the client-side bonding-curve maths in `src/lib/curve.ts` matches the contract to the wei. |
| Airdrop parity | `npm run test:airdrop` | 22 checks that the JavaScript Merkle tree and the Solidity verifier agree — the one failure mode that would break an airdrop silently, after the tokens had been sent. |

## Run the front end

```bash
cp .env.example .env.local
npm run dev
```

It starts on Robinhood Chain testnet with no configuration, so a first run costs
nothing. The board will be empty until a factory is deployed — see
[Deployment](02-deployment.md).

Point it elsewhere by editing `.env.local`:

```bash
NEXT_PUBLIC_CHAIN=testnet     # Robinhood Chain testnet (default)
NEXT_PUBLIC_CHAIN=mainnet     # Robinhood Chain
NEXT_PUBLIC_CHAIN=sepolia     # Ethereum Sepolia
```

Full reference in [Configuration](05-configuration.md).

## Getting testnet funds

You will need a funded key to deploy anything.

```bash
cast wallet new
```

Fund the printed address:

| Network | Faucets |
| --- | --- |
| **Robinhood Chain testnet** | **[faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com/)** (first-party — use this), [QuickNode](https://faucet.quicknode.com/robinhood/testnet), [Chainlink](https://faucets.chain.link/robinhood-testnet) |
| Ethereum Sepolia | [Google Cloud](https://cloud.google.com/application/web3/faucet/ethereum/sepolia), [Alchemy](https://sepoliafaucet.com), [Infura](https://www.infura.io/faucet/sepolia) |

Robinhood's own faucet is not linked from their documentation, which makes it
easy to miss — it is the one to reach for first regardless. Most faucets allow
one claim per network every twelve hours.

The same address works on every EVM chain, so one claim per network is enough.
Use a key that will only ever hold testnet funds.

Check it arrived:

```bash
cast balance <ADDRESS> --rpc-url https://ethereum-sepolia-rpc.publicnode.com
cast balance <ADDRESS> --rpc-url https://rpc.testnet.chain.robinhood.com
```

---

## Robinhood Chain reference

Every link below was reachable at the time of writing.

### Network settings

```
Chain ID     46630  (0xb626)
RPC          https://rpc.testnet.chain.robinhood.com
Explorer     https://explorer.testnet.chain.robinhood.com
Currency     ETH
```

The RPC answers with or without a trailing `/rpc`. Mainnet is chain `4663` at
`https://rpc.mainnet.chain.robinhood.com`, explorer
[robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com).

### Official

| Link | For |
| --- | --- |
| [faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com/) | Testnet ETH |
| [explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com/) | Block explorer — Blockscout, used for contract verification |
| [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting) | Network parameters and supported RPC providers |
| [docs.robinhood.com/chain/deploy-smart-contracts](https://docs.robinhood.com/chain/deploy-smart-contracts) | Robinhood's own Foundry deployment guide |

### Adding the network to a wallet

One click, rather than typing the parameters by hand:

- [chainlist.org/chain/46630](https://chainlist.org/chain/46630)
- [thirdweb.com/robinhood-chain-testnet](https://thirdweb.com/robinhood-chain-testnet)
- [coinfactory.app/chainlist/46630](https://coinfactory.app/chainlist/46630)

The app does this itself: the network button calls `wallet_addEthereumChain`
when your wallet does not already know the chain.

### RPC providers

The public endpoint is rate-limited. If the coin board is slow or the trade feed
comes back empty, move to a dedicated endpoint and set
`NEXT_PUBLIC_TESTNET_RPC_URL`:

- [Alchemy](https://www.alchemy.com/rpc/robinhood-testnet) — Robinhood's
  recommended provider
- QuickNode, Blockdaemon, dRPC and Validation Cloud also support the chain

### Prior art

- [launchcoins.fun/robinhood](https://launchcoins.fun/robinhood/create) — the
  launchpad this project was modelled on

---

## Next

- [Deployment](02-deployment.md) — get contracts on a chain.
- [Airdrop](03-airdrop.md) — distribute the token.
