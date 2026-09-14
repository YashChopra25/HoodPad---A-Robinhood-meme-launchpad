# Launchpad architecture

What exists today is the asset and the deployment foundation: `LaunchpadToken`,
a deploy script with chain guards, and a test suite. This document specifies the
contracts that will sit on top, how they interact, and — because the front end
in this repository is what consumes them — which UI surface each one feeds.

Nothing described below the "Implemented today" section is written yet. It is a
design, deliberately settled before any sale mechanics are coded.

---

## 1. Implemented today

| Contract | Purpose |
| --- | --- |
| `src/LaunchpadToken.sol` | Fixed-supply ERC-20 (`Launchpad Token` / `LPT`, 18 decimals). Whole supply minted to the deployer at construction. No owner, no mint path, no transfer hooks. |

`LaunchpadToken` is intentionally the least interesting contract in the system.
Everything the launchpad does — escrow, caps, timing, vesting, refunds — happens
in contracts that hold the token, never in the token itself. That separation is
what keeps the asset something a buyer can reason about in one screen, and it is
why the sale contracts below can treat their allocation as final: `_mint` is
unreachable after construction, so `totalSupply()` cannot move.

---

## 2. Contract topology

```
                         ┌──────────────────────────┐
                         │    LaunchpadFactory      │  Ownable2Step, Pausable
                         │                          │
   platform operator ───►│  • createSale(...)       │
                         │  • platform fee config   │
                         │  • sale registry         │
                         │  • global pause          │
                         └────────────┬─────────────┘
                                      │ Clones.clone(saleImplementation)
                                      │ records address, emits SaleCreated
                                      ▼
    ┌───────────────────────────────────────────────────────────┐
    │                        TokenSale                          │  one per project
    │                                                           │
    │  escrow:   project's token allocation (pulled on init)    │
    │  intake:   ETH or a payment ERC-20                        │
    │  rules:    start/end, soft cap, hard cap, wallet limit    │
    │  state:    Pending → Live → Succeeded | Failed → Finalized│
    │                                                           │
    │  buyer  ──contribute()──►  accounted, funds held          │
    │  buyer  ──claim()──────►  tokens, or a Vesting position   │
    │  buyer  ──refund()─────►  contribution back, if Failed    │
    │  project──finalize()───►  proceeds minus platform fee     │
    └──────────────────┬────────────────────────────────────────┘
                       │ on finalize, when a schedule was configured
                       ▼
            ┌────────────────────────┐
            │      Vesting           │  one per sale, or one per buyer position
            │  cliff + linear release│
            │  buyer ──release()──►  │
            └────────────────────────┘
                       ▲
                       │ holds
            ┌──────────┴─────────────┐
            │    LaunchpadToken      │  ← implemented
            └────────────────────────┘
```

### Why a factory plus clones

Every sale is a separate contract, so one project's failure, pause or refund
cannot touch another's escrow. Deploying a full `TokenSale` per project would be
expensive, so the factory deploys one implementation once and stamps out
[EIP-1167 minimal proxies](https://eips.ethereum.org/EIPS/eip-1167) with
OpenZeppelin's `Clones`. Each clone is initialised exactly once, guarded by
`Initializable`.

The factory is also the only global index. That matters more than it sounds: the
front end has no server and no database, so `SaleCreated` events and the
factory's `allSales()` array *are* the discovery layer.

---

## 3. Contract responsibilities

### 3.1 `LaunchpadFactory`

Owns nothing but configuration and the registry. It never holds a project's
tokens or a buyer's funds.

| Responsibility | Notes |
| --- | --- |
| `createSale(SaleParams)` | Validates parameters, clones the implementation, initialises it, records it. |
| Registry | `allSales()`, `salesOf(address creator)`, `isSale(address)` — the last one lets the UI reject a pasted address that is not a real sale. |
| Platform fee | `feeBps` (capped by a hard `MAX_FEE_BPS` constant so it can never be raised past a published ceiling) and `treasury`. |
| Creation fee | Optional flat fee in ETH per sale, forwarded to the treasury. |
| Global pause | `Pausable`; blocks new sale creation. It deliberately does **not** freeze existing sales — see §6. |
| Access control | `Ownable2Step`, so a fat-fingered ownership transfer cannot brick the platform. |

`SaleParams` is a struct rather than a long argument list — it crosses an ABI
boundary the front end builds, and a named struct is what keeps the create form
and the contract from drifting apart.

```solidity
struct SaleParams {
    address token;           // asset being sold
    address paymentToken;    // address(0) == native ETH
    uint256 tokensForSale;   // base units, pulled into escrow on init
    uint256 price;           // payment units per 1e18 tokens
    uint256 softCap;         // in payment units
    uint256 hardCap;         // in payment units
    uint64  startTime;
    uint64  endTime;
    uint256 minContribution;
    uint256 maxContribution; // per-wallet allocation limit
    VestingParams vesting;   // zeroed struct == claim in full at finalize
}
```

### 3.2 `TokenSale`

The only contract that holds value. One per project, cloned from a single
implementation.

**State machine.** Every external function is gated on this, and the UI renders
straight off it:

```
Pending ──(block.timestamp >= startTime)──► Live
   │                                          │
   │                        ┌─────────────────┴──────────────────┐
   │                        │                                    │
   │           raised >= hardCap                    endTime reached
   │           or endTime reached                                │
   │           with raised >= softCap                            │
   │                        ▼                                    ▼
   │                   Succeeded                              Failed
   │                        │                          (raised < softCap)
   │                        │                                    │
   │            finalize() by project                   refund() by buyers
   │                        ▼                                    │
   │                   Finalized ──► claim() / vesting           │
   └──── cancel() by project, before startTime ──────────────────┘
```

`status()` is a single view returning the derived state, so the front end never
has to reimplement this comparison chain — the same mistake that produces a UI
saying "Live" over a contract that will revert.

**Payment.** `paymentToken == address(0)` means native ETH and `contribute()` is
payable; otherwise it is `contribute(uint256 amount)` pulling via
`SafeERC20.safeTransferFrom`. The amount actually credited is measured as the
balance delta, so a fee-on-transfer payment token cannot leave the accounting
overstated. Rebasing payment tokens stay out of scope, documented rather than
half-supported.

**Per-wallet limits.** `contributed[msg.sender] + amount <= maxContribution`,
checked before state is written. `minContribution` filters dust that would cost
more to refund than it is worth.

**Caps.** `hardCap` is enforced on the way in. The last contribution that would
cross it is accepted up to the remainder and the excess returned in the same
transaction, rather than reverting — a revert there is the single most common
source of failed transactions in live sales.

**Fees.** The platform fee is taken once, from the raise, at `finalize()` — not
per contribution. That keeps the hot path cheap and means a failed sale refunds
buyers in full, because nothing was ever skimmed.

**Claiming.** Pull, never push. `finalize()` moves proceeds to the project and
the fee to the treasury; buyers then call `claim()` themselves. A loop paying out
hundreds of buyers is a gas bomb and one reverting recipient would block
everyone.

### 3.3 `Vesting`

Created at finalisation only when `VestingParams` is non-zero.

```solidity
struct VestingParams {
    uint64 cliffDuration;    // seconds after finalize before anything releases
    uint64 vestingDuration;  // seconds over which the remainder unlocks linearly
    uint16 initialUnlockBps; // released immediately at claim
}
```

`releasable(account)` is a view so the UI can render a live countdown without
simulating a transaction, and `release()` transfers whatever has accrued.
Linear-after-cliff is the whole feature set on purpose: every additional curve
shape is another thing to get wrong.

---

## 4. How the front end consumes this

The app in this repository has no back end. Its data layer is
`src/lib/*.ts` reading contracts and logs directly, which puts a hard
requirement on the contracts: **anything a screen renders must be reachable in
one view call or one event.**

| UI surface (existing) | Reads |
| --- | --- |
| `/coins` board — `useCoins` | `factory.allSales()` for the list; one `sale.getState()` per card. |
| Coin card — `CoinCard` | `getState()`: name, symbol, raised, hardCap, softCap, status, endTime. |
| `/coin/[address]` header — `CoinHeader` | `getState()` + `getMeta()`. |
| Progress bar — `Progress` | `raised` / `hardCap` from `getState()`. |
| Buy panel — `TradePanel` | `quoteContribution(amount)` view, then `contribute()`. |
| Contribution feed — `TradeFeed` | `Contributed` logs, scanned backwards in chunks. |
| Chart — `PriceChart` | `Contributed` logs; cumulative raise over time. |
| Facts panel — `CoinFacts` | `getState()` + `getParams()`: caps, wallet limit, fee, vesting terms. |
| Claim / refund | `claimable(account)` and `refundable(account)` views. |
| `/portfolio` | `factory.salesOf(user)` for created sales; `Contributed` logs filtered by the indexed buyer for positions. |
| Creator tools — `CreatorTools` | `finalize()`, `cancel()`, `withdrawUnsold()`, all owner-gated. |

### Required views

Two aggregate views carry almost every screen. They exist so a card costs one
call rather than fifteen — the same reason `MemeToken.getState()` exists in the
Robinhood Chain app in this repo.

```solidity
struct SaleState {
    Status  status;
    uint256 raised;
    uint256 tokensSold;
    uint256 participants;
    uint64  startTime;
    uint64  endTime;
    bool    finalized;
}

function getState()  external view returns (SaleState memory);
function getParams() external view returns (SaleParams memory);
function claimable(address account)  external view returns (uint256);
function refundable(address account) external view returns (uint256);
```

### Required events

Indexed fields are chosen for how the UI filters, not for how the contract
reads. `buyer` is indexed because the portfolio page filters by it; `sale` is
indexed on factory events because a coin page filters by it.

```solidity
// LaunchpadFactory
event SaleCreated(
    address indexed sale,
    address indexed creator,
    address indexed token,
    address paymentToken,
    uint256 timestamp
);
event PlatformFeeUpdated(uint16 feeBps, address treasury);

// TokenSale
event Contributed(address indexed buyer, uint256 amount, uint256 tokens, uint256 raisedAfter);
event Claimed(address indexed buyer, uint256 tokens);
event Refunded(address indexed buyer, uint256 amount);
event Finalized(uint256 raised, uint256 platformFee, address vesting);
event Cancelled();

// Vesting
event Released(address indexed beneficiary, uint256 amount);
```

`raisedAfter` on `Contributed` is there so the chart can be drawn from logs
alone, without replaying every prior event to compute a running total. It costs
one extra word per contribution and removes an entire class of front-end bug.

### Wiring the ABI into the app

`npm run compile:foundry` (repository root) reads `contracts/out/**` and writes
typed ABI modules into `src/contracts/`, in the same `as const` form the app
already uses, so viem infers argument and return types from the Solidity rather
than from a hand-written interface. Re-run it after any contract change.

---

## 5. Security posture

Applied to `LaunchpadToken` today, and required of everything above:

- **Checks-effects-interactions** everywhere value moves. Balances and status
  update before any external call.
- **`ReentrancyGuard`** on `contribute`, `claim`, `refund`, `finalize` — every
  function that both writes state and calls out.
- **`SafeERC20`** for all ERC-20 movement; never a bare `transfer` whose return
  value can be a silent `false`.
- **Pull payments** for claims and refunds. Nothing iterates a list of
  recipients.
- **Custom errors with parameters** rather than revert strings, so a failure
  tells the front end what was expected and what was found.
- **`Ownable2Step`** for privileged roles; a one-step transfer to a wrong
  address is unrecoverable.
- **Immutable where possible.** Sale parameters are set once at initialisation
  and never editable, so a buyer's read cannot be invalidated between reading
  and signing.
- **Bounded loops only.** No unbounded iteration over participants.
- **`Initializable`** on the clone, so a proxy cannot be re-initialised.

### Deliberate non-goals

- Rebasing payment tokens.
- Cross-chain sales.
- On-chain KYC or allowlists beyond a simple Merkle root, which would be a
  separate, optional module rather than a branch inside `TokenSale`.

---

## 6. Emergency mechanics

Pausing a launchpad is where good intentions produce trapped funds, so the
levels are separated:

| Level | Who | Effect |
| --- | --- | --- |
| Factory pause | Platform owner | Blocks *new* sale creation. Existing sales are untouched. |
| Sale pause | Sale owner (project) | Blocks `contribute()` only. `refund()` and `claim()` stay open. |
| Cancel | Sale owner, before `startTime` | Moves straight to `Failed`; the token allocation returns to the project. |
| Emergency refund | Sale owner, any time before `finalize()` | Forces `Failed`; every contributor can withdraw in full. |

The rule underneath all four: **no privileged action may ever prevent a
contributor from withdrawing what they are owed.** `refund()` and `claim()` are
never gated on `whenNotPaused`. This is the same principle the Robinhood Chain
contracts in this repo follow, where the launch guards can throttle buying but
never block a sell.

---

## 7. Build order

1. ~~`LaunchpadToken` + deploy script + tests~~ — done.
2. `TokenSale` for native ETH only: caps, timing, wallet limits, contribute,
   refund, claim, finalize. No vesting, no clones. Tested against Anvil.
3. `LaunchpadFactory` with the registry, `SaleCreated`, and platform fees.
4. ERC-20 payment path, with balance-delta accounting.
5. `Clones` for cheap sale deployment.
6. `Vesting`.
7. Pause and emergency refund.
8. Front-end integration at each step, since the views and events above are the
   contract's real interface.

Every step lands with tests before the next begins. Steps 2 and 3 are where the
value is; the rest are refinements.

---

## 8. Audit status

**These contracts have not been audited.** `LaunchpadToken` is thin and leans
entirely on OpenZeppelin's audited `ERC20`, but the sale, vesting and factory
contracts described here will hold user funds and must be independently reviewed
before any mainnet deployment. Nothing in this repository should be treated as
production-safe on that basis alone.
