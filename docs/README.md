# Documentation

Everything in this repository, in the order you would actually need it.

| | Page | What it covers |
| --- | --- | --- |
| 1 | [Getting started](01-getting-started.md) | Install, build, test, run the app locally. Start here. |
| 2 | [Deployment](02-deployment.md) | Deploying to Sepolia and to both Robinhood Chain networks, plus verification. |
| 3 | [Airdrop](03-airdrop.md) | Running a Merkle airdrop end to end: build the tree, deploy, fund, claim, sweep. |
| 4 | [Contracts](04-contracts.md) | Reference for every contract: what it does, its interface, its guarantees. |
| 5 | [Configuration](05-configuration.md) | Every environment variable, what reads it, and what happens when it is unset. |
| 6 | [Operations](06-operations.md) | Runbook: fees, treasury, keys, troubleshooting, incident response. |

Design documents live next to the code they describe:

- [`contracts/ARCHITECTURE.md`](../contracts/ARCHITECTURE.md) — the sale, vesting
  and factory contracts still to be built, and how they map onto the front end.

## What is in this repository

Two related projects that share one front end:

```
contracts/            Foundry + OpenZeppelin, targeting Ethereum Sepolia
  src/                  LaunchpadToken (ERC-20), MerkleAirdrop
  script/               DeployToken, DeployAirdrop
  test/                 58 Solidity tests
  ARCHITECTURE.md       design for the sale/vesting/factory contracts

src/                  Next.js front end
  contracts/            MemeToken + MemeFactory (Robinhood Chain), and the
                        generated ABIs exported from contracts/
  lib/ hooks/ components/ app/

scripts/              Node tooling: compile, ABI export, Merkle builder,
                      EVM-backed tests, factory deployment
airdrop/              Generated Merkle trees and claim files
docs/                 You are here
```

## Quick reference

```bash
npm install                    # front end + tooling
cd contracts && forge install  # Solidity dependencies

npm run test:all               # every test suite
npm run dev                    # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Front end in development |
| `npm run build` | Production build |
| `npm run compile` | Compile the Robinhood Chain contracts to typed ABIs |
| `npm run compile:foundry` | Export the Foundry ABIs into `src/contracts/` |
| `npm run compile:all` | Both |
| `npm test` | Robinhood Chain contracts, in-process EVM |
| `npm run test:airdrop` | Merkle tree ↔ Solidity parity |
| `npm run test:foundry` | `forge test` |
| `npm run test:all` | All three |
| `npm run airdrop:build` | Build a Merkle tree from a CSV |
| `npm run deploy:factory` | Deploy `MemeFactory` to a Robinhood network |
| `npm run lint` | ESLint |

## A note on audits

**None of these contracts have been audited.** They lean on OpenZeppelin's
audited primitives where possible, and the test suites are thorough, but that is
not the same thing. Do not deploy them to a mainnet holding other people's money
without an independent review.
