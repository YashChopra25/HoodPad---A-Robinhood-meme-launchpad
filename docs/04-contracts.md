# Contracts

Reference for everything deployed from this repository.

| Contract | Source | Purpose |
| --- | --- | --- |
| [`LaunchpadToken`](#launchpadtoken) | `contracts/src/` | Fixed-supply ERC-20, the example asset |
| [`MerkleAirdrop`](#merkleairdrop) | `contracts/src/` | Claim-based distribution |
| [`MemeToken`](#memetoken) | `src/contracts/` | ERC-20 with a built-in bonding curve |
| [`MemeFactory`](#memefactory) | `src/contracts/` | Registry and fee collector for memecoin launches |

Still to be built — see [`contracts/ARCHITECTURE.md`](../contracts/ARCHITECTURE.md):
`LaunchpadFactory`, `TokenSale`, `Vesting`.

---

## LaunchpadToken

`contracts/src/LaunchpadToken.sol` · Solidity ^0.8.20 · OpenZeppelin `ERC20`

Deliberately the least interesting contract in the system.

```solidity
constructor(uint256 initialSupply)   // "Launchpad Token" / "LPT", 18 decimals
```

The whole supply is minted to the deployer. Everything else comes from
OpenZeppelin: balances, allowances, `transfer`, `approve`, `transferFrom`.

**Fixed supply is a property of the code, not a promise.** `_mint` is
unreachable after construction and there is no owner who could add a path to it,
so `totalSupply()` can never change. That is what lets sale and airdrop
contracts treat an allocation as final.

Reverts with `ZeroInitialSupply()` if constructed with zero.

---

## MerkleAirdrop

`contracts/src/MerkleAirdrop.sol` · `Ownable2Step`, `SafeERC20`, `MerkleProof`, `BitMaps`

Claim-based distribution against a Merkle root. Full guide:
[Airdrop](03-airdrop.md).

```solidity
constructor(
    IERC20  token,
    bytes32 merkleRoot,
    uint64  claimDeadline,   // 0 = never closes
    uint256 totalAllocated,
    address owner
)
```

| Function | Access | Notes |
| --- | --- | --- |
| `claim(index, account, amount, proof)` | anyone | Tokens always go to `account`, whoever pays the gas |
| `canClaim(...)` | view | Eligibility without spending gas |
| `isClaimed(index)` | view | Backed by a `BitMap`, one bit per index |
| `leafFor(index, account, amount)` | pure | The leaf hash, so tooling need not re-implement it |
| `getState()` | view | Everything a claim page renders, in one call |
| `underfundedBy()` | view | Shortfall between promised and funded |
| `sweep(to)` | owner | Only after the deadline; reverts if none was set |

Leaves are `keccak256(keccak256(abi.encode(index, account, amount)))` — ABI
encoding so distinct tuples cannot collide, double hashing so a leaf cannot be
mistaken for an internal node.

State is written before the transfer, so a token with a callback cannot re-enter
into a second claim on the same index.

---

## MemeToken

`src/contracts/MemeToken.sol`

One contract per memecoin launch: both the ERC-20 and its market. Deployed by
the browser, either through `MemeFactory` or directly.

### Two launch shapes

**Curve launch** (`curveBps > 0`) — most of the supply sits on a constant-product
curve with a virtual ETH reserve, so there is a price before anyone has traded:

```
k = virtualEth × curveSupply

buy:   tokensOut = tokenReserve − ⌈k / (virtualEth + ethReserve + ethIn)⌉
sell:  ethOut    = (virtualEth + ethReserve) − ⌊k / (tokenReserve + tokensIn)⌋
```

Rounding always favours the pool and a fee is taken both ways, so a round trip
can never come out ahead. `npm test` measures it: 1.99% for a buy and sell at 1%
each way.

At `graduationTarget` the curve closes on the buy that crosses it, deposits
everything left plus the whole raise into a Uniswap V2 pool, and burns the LP
tokens. If the router call fails, the curve stays open and tradable rather than
stranding the raise.

**Fixed-supply launch** (`curveBps == 0`) — everything is minted to the creator,
who opens a pool themselves.

### Launch guards

All optional, all fixed at deploy, and all written so they can throttle buying
but never block a sell.

| Guard | Effect |
| --- | --- |
| Anti-bot | One buy per wallet per block |
| Anti-whale | Maximum balance, checked when tokens arrive, never when they leave |
| Custom tax | Up to `MAX_TAX_BPS` (10%), locked at launch |
| Platform tax | Capped at `MAX_PLATFORM_TAX_BPS` (2.5%) by the contract |

### Views

`getState()` returns a whole coin in one call — the reason a board of cards
costs one request per coin rather than fifteen. `getMeta()` carries image,
description and socials separately, because the image can be a sizeable inline
data URI.

---

## MemeFactory

`src/contracts/MemeFactory.sol`

Registry, fee collector, and the reason launches are globally discoverable.

| Function | Access | Notes |
| --- | --- | --- |
| `launch(config)` | anyone | Deploys a `MemeToken`; anything above the fee becomes the creator's opening buy |
| `quoteFee(antiBot, antiWhale, customTax)` | view | What a launch will cost |
| `tokensLatest(offset, limit)` | view | Newest-first page for the board |
| `tokensOf(creator)` | view | One wallet's launches |
| `isLaunch(address)` | view | Rejects a pasted address that is not a real launch |
| `setFees` / `setCurveParams` / `setTreasury` / `setDefaultRouter` | owner | Configuration |

`setCurveParams` cannot raise the platform tax above 2.5% or the trade fee above
5%; the ceilings are in the contract, not the UI.

Emits `Launched(token, creator, name, symbol, hasCurve, timestamp)`. The app
scans these for launch times, and reads the registry array for the board itself.

---

## Testing

| Suite | Command | Covers |
| --- | --- | --- |
| Foundry | `npm run test:foundry` | 58 tests: the token, the airdrop, the deployment guards |
| Robinhood contracts | `npm test` | 66 checks against an in-process EVM |
| Airdrop parity | `npm run test:airdrop` | 22 checks that the JS tree and Solidity verifier agree |

Two of these exist because of specific failure modes that unit tests miss:

- **`npm test`** asserts that `getState()` returns exactly the field names the
  TypeScript types map, and that the client-side curve maths in
  `src/lib/curve.ts` matches `quoteBuy` to the wei. A renamed struct field would
  otherwise surface as `undefined` in the browser, and drifting maths would show
  users a price the contract will not honour.
- **`npm run test:airdrop`** proves the off-chain and on-chain leaf encodings
  agree, computing each leaf three independent ways.

## Conventions

- **Custom errors with parameters**, not revert strings — a failure says what
  was expected and what was found.
- **Checks-effects-interactions** wherever value moves.
- **`SafeERC20`** for every ERC-20 movement.
- **Pull payments.** Nothing iterates a list of recipients.
- **Public immutables in camelCase**, because their names are the external ABI
  and the ecosystem expects `token()`, not `TOKEN()`.
- **Aggregate views** (`getState()`) so a front end reads a whole object in one
  call.

## Audit status

**Not audited.** The tests are thorough and the contracts lean on OpenZeppelin's
audited primitives, but neither substitutes for review.
