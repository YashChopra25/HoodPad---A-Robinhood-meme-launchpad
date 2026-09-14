# Launchpad contracts

Solidity for the launchpad, built with [Foundry](https://getfoundry.sh) and
[OpenZeppelin v5](https://docs.openzeppelin.com/contracts/5.x/).

This project lives in `contracts/` rather than the repository root because the
root `src/` belongs to the Next.js front end. Foundry gets a clean layout of its
own: `src/`, `script/`, `test/`, `lib/`.

| Path | What it is |
| --- | --- |
| `src/LaunchpadToken.sol` | The example ERC-20: `Launchpad Token` / `LPT`, 18 decimals, configurable supply minted to the deployer. Extends OpenZeppelin's `ERC20`. |
| `script/DeployToken.s.sol` | Deployment script. Reads everything from the environment and refuses to run on the wrong chain. |
| `test/LaunchpadToken.t.sol` | Token behaviour: metadata, supply, transfers, approvals, `transferFrom`. |
| `test/DeployToken.t.sol` | The deployment guards themselves. |
| `ARCHITECTURE.md` | How the future sale, vesting and factory contracts fit together, and which UI surface each one feeds. |
| `foundry.toml` | Compiler pin (0.8.30), optimizer, remappings, RPC and Etherscan endpoints read from the environment. |

## Setup

Foundry installs to `~/.foundry/bin`, which is not on every shell's `PATH`:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
export PATH="$PATH:$HOME/.foundry/bin"     # add to ~/.zshrc to make it stick
```

Then, from the repository root:

```bash
cd contracts
forge install                              # restores lib/ from the lockfile
cp .env.example .env                       # then fill in PRIVATE_KEY and SEPOLIA_RPC_URL
```

`.env` is gitignored. `.env.example` is not, and must never contain a real key.

## Commands

| Command | What it does |
| --- | --- |
| `forge install` | Install dependencies (forge-std, openzeppelin-contracts). |
| `forge build` | Compile. |
| `forge test` | Run all tests. |
| `forge test -vvv` | Run with traces for failures. |
| `forge test --gas-report` | Compile, test, and print gas per function. |
| `forge fmt` | Format Solidity. |
| `forge coverage` | Coverage report. |
| `npm run compile:foundry` | *(repo root)* Export ABIs into `src/contracts/` for the front end. |

### Deploy locally

```bash
anvil                                       # terminal 1

# terminal 2
cd contracts
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export EXPECTED_CHAIN_ID=31337
forge script script/DeployToken.s.sol:DeployToken \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

That key is Anvil's first well-known account. It is public. Never fund it.

### Deploy to Sepolia

```bash
cd contracts
forge script script/DeployToken.s.sol:DeployToken \
  --rpc-url sepolia --broadcast --verify -vvvv
```

`--rpc-url sepolia` resolves through `[rpc_endpoints]` in `foundry.toml`, which
reads `SEPOLIA_RPC_URL` from `.env`. See the step-by-step guide in the root
`README.md`.

## Safety

The deploy script will not run unless all three hold:

1. The chain is not Ethereum mainnet, unless `ALLOW_MAINNET=true` is set.
2. `block.chainid` equals `EXPECTED_CHAIN_ID`.
3. The deployer holds gas.

All three are checked in the simulation forge runs *before* broadcasting, so a
wrong `--rpc-url` fails without signing anything. The guards live in
`assertSafeToDeploy`, which is `pure` and takes its inputs as arguments — that is
what lets `test/DeployToken.t.sol` exercise each one directly.

## Audit status

**Not audited.** `LaunchpadToken` is thin and leans on OpenZeppelin's audited
`ERC20`, but nothing here has been independently reviewed. The sale and vesting
contracts described in `ARCHITECTURE.md` will hold user funds and must be audited
before any mainnet deployment.
