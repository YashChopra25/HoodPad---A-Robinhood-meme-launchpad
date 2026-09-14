# Airdrop

Distributing a token to a list of addresses, using `MerkleAirdrop`.

## How it works, and why

The naive airdrop loops over recipients and pushes tokens at them. It has three
problems: the project pays gas for everyone including the majority who never
look; the cost grows with the list until it will not fit in a block; and one
recipient that reverts on receipt can wedge the whole batch.

`MerkleAirdrop` inverts it. Only the *root* of the recipient list goes on-chain —
a single 32-byte hash. Each recipient proves membership when they claim, and
pays their own gas.

```
recipients.csv          scripts/build-merkle.mjs         on-chain
┌──────────────┐        ┌────────────────────┐        ┌──────────────┐
│ 0xabc…, 1000 │        │ leaf per recipient │        │ merkleRoot   │
│ 0xdef…, 2500 │  ───►  │   pair and hash    │  ───►  │  (32 bytes)  │
│ 0x123…,  500 │        │   up to one root   │        └──────┬───────┘
└──────────────┘        └─────────┬──────────┘               │
                                  │                          │
                        airdrop/<name>.json                  │
                        proofs for every address             │
                                  │                          │
                                  ▼                          ▼
                        recipient loads proof ──► claim(index, account,
                                                        amount, proof)
                                                          │
                                                  verify against root
                                                          │
                                                     tokens sent
```

Consequences worth knowing before you commit to it:

- **Cost is independent of list size.** Ten recipients and a hundred thousand
  deploy identically.
- **Recipients pay to claim.** Some never will. That is what `sweep` and the
  deadline are for.
- **The list is public.** The root is on-chain, but the proofs must be published
  for anyone to claim — the recipient list is effectively public either way.
- **The tree is immutable.** `merkleRoot` is `immutable`. Adding a recipient
  means a new airdrop contract.

---

## 1. Prepare the recipient list

CSV, one `address,amount` per line. A header row is detected and skipped, and
`#` comments are ignored.

```csv
address,amount
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,1000
0x70997970C51812dc3A010C7d01b50e0d17dc79C8,2500
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,500
```

Amounts are **whole tokens**, scaled by `--decimals` (18 by default). There is
an example at `airdrop/recipients.example.csv`.

The builder refuses to produce a tree if anything is wrong, listing every
problem at once rather than failing on the first: invalid addresses, missing or
non-numeric amounts, zero or negative allocations, and duplicate addresses.
Duplicates are an error because two indices for one address is almost always a
mistake in list assembly; pass `--allow-duplicates` if you meant it.

## 2. Build the tree

```bash
npm run airdrop:build -- --input airdrop/recipients.csv --name season-one
```

```
recipients   3
total        4000 tokens (4000000000000000000000 base units)
merkle root  0x59a8b62ffc47f215505b3734ba72b8e377f866c85883e00b85d932c04f1ce5f2

wrote airdrop/season-one.json
      airdrop/season-one.tree.json
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--input` | required | CSV path |
| `--name` | `airdrop` | Output filename |
| `--decimals` | `18` | Token decimals |
| `--base-units` | off | Take amounts as raw base units |
| `--allow-duplicates` | off | Permit an address more than once |

**`airdrop/<name>.json`** is what a claim page loads: the root, the total, and
every entry with its proof, keyed by lowercased address.

```json
{
  "merkleRoot": "0x59a8…",
  "total": "4000000000000000000000",
  "recipients": 3,
  "claims": {
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
      "index": 0,
      "account": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "amount": "1000000000000000000000",
      "proof": ["0x…", "0x…"]
    }
  }
}
```

**`airdrop/<name>.tree.json`** is the full tree, needed only to regenerate
proofs later without the original CSV. Keep it.

### Leaf encoding

```
leaf = keccak256( keccak256( abi.encode(uint256 index, address account, uint256 amount) ) )
```

The inner hash is ABI-encoded rather than packed, so no two distinct tuples can
collide. The outer hash is a second-preimage guard: it makes it impossible for a
leaf to be mistaken for an internal node, which is what would otherwise let
someone forge a proof from a partial path.

`index` is the position in the input CSV, assigned before the tree sorts its
leaves internally. The contract's claimed-bitmap keys on it, so it must be
stable and independent of tree layout.

The contract exposes `leafFor(index, account, amount)` so tooling never has to
re-implement this.

> This is the one thing that can break an airdrop silently. If the off-chain and
> on-chain encodings differ by a byte, every claim reverts with `InvalidProof` —
> after the tokens have been sent and the announcement made. `npm run
> test:airdrop` deploys the real compiled contract to an in-process EVM, builds
> a tree with the same library the CLI uses, computes each leaf a third time
> directly from the specification with viem, and claims through all of it. Run
> it after any change to either side.

## 3. Deploy

### One command, from scratch

If the token does not exist yet, `DeployDemo` deploys the token and the airdrop
and funds it in a single broadcast — no copying an address between two commands:

```bash
cd contracts
AIRDROP_MERKLE_ROOT=0x<root> \
AIRDROP_TOTAL=<total in base units> \
INITIAL_SUPPLY=1000000 \
forge script script/DeployDemo.s.sol:DeployDemo \
  --rpc-url sepolia --broadcast --verify
```

It prints both addresses and the `.env.local` lines to paste.

### Against an existing token

```bash
cd contracts
AIRDROP_TOKEN=0x<token address> \
AIRDROP_MERKLE_ROOT=0x<root from step 2> \
AIRDROP_TOTAL=<total in base units from step 2> \
AIRDROP_DEADLINE=$(( $(date +%s) + 60*60*24*90 )) \
AIRDROP_FUND=true \
forge script script/DeployAirdrop.s.sol:DeployAirdrop \
  --rpc-url sepolia --broadcast --verify
```

The build step prints this command with the values already filled in.

| Variable | Required | Meaning |
| --- | --- | --- |
| `AIRDROP_TOKEN` | yes | ERC-20 being distributed |
| `AIRDROP_MERKLE_ROOT` | yes | From step 2 |
| `AIRDROP_TOTAL` | yes | Sum of allocations, in base units |
| `AIRDROP_DEADLINE` | no (`0`) | Unix seconds; `0` means claiming never closes |
| `AIRDROP_FUND` | no (`false`) | Transfer `AIRDROP_TOTAL` in during the same run |

The same chain guards as `DeployToken` apply — the script reuses
`assertSafeToDeploy` rather than restating them.

### Choosing a deadline

`AIRDROP_DEADLINE=0` means nobody can ever reclaim the unclaimed remainder:
`sweep` reverts with `NoDeadlineSet`. That is a legitimate choice — it is the
strongest possible commitment that the tokens belong to the recipients — but it
is permanent. A deadline of 60–90 days is the common middle ground.

## 4. Fund it

With `AIRDROP_FUND=true` this already happened. Otherwise:

```bash
cast send <TOKEN> "transfer(address,uint256)" <AIRDROP> <TOTAL> \
  --rpc-url sepolia --private-key $PRIVATE_KEY
```

Check for a shortfall before announcing anything:

```bash
cast call <AIRDROP> "underfundedBy()(uint256)" --rpc-url sepolia   # want 0
```

Non-zero means some claims will revert once the balance runs out. Fix it before
publishing.

## 5. Publish the proofs

Recipients need their proof. Anywhere works — the repository, a gist, IPFS, the
claim page's own bundle. The data is not secret; a proof is only useful to the
address it names.

## 6. Claiming

Anyone may submit a proof, and the tokens always go to `account`. That is
deliberate: it lets a relayer cover gas for users with an empty wallet, with no
way to redirect the tokens.

```bash
cast send <AIRDROP> "claim(uint256,address,uint256,bytes32[])" \
  0 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1000000000000000000000 \
  "[0xabc…,0xdef…]" \
  --rpc-url sepolia --private-key $PRIVATE_KEY
```

Check eligibility first, for free:

```bash
cast call <AIRDROP> "canClaim(uint256,address,uint256,bytes32[])(bool)" ...
cast call <AIRDROP> "isClaimed(uint256)(bool)" 0 --rpc-url sepolia
```

### From a front end

`npm run compile:foundry` writes `src/contracts/MerkleAirdrop.ts`, so viem
infers the types:

```ts
import { MERKLE_AIRDROP_ABI } from "@/contracts/MerkleAirdrop";
import claims from "../../airdrop/season-one.json";

const entry = claims.claims[account.toLowerCase()];
if (!entry) return; // not eligible

const { request } = await publicClient.simulateContract({
  address: AIRDROP_ADDRESS,
  abi: MERKLE_AIRDROP_ABI,
  functionName: "claim",
  args: [BigInt(entry.index), entry.account, BigInt(entry.amount), entry.proof],
  account,
});
await walletClient.writeContract(request);
```

`getState()` returns everything a claim page renders in one call — token, root,
deadline, total allocated, total claimed, balance, and whether claiming is open.
Set `NEXT_PUBLIC_AIRDROP_ADDRESS` in `.env.local`.

## 7. Sweep the remainder

Once the deadline has passed:

```bash
cast send <AIRDROP> "sweep(address)" <DESTINATION> \
  --rpc-url sepolia --private-key $OWNER_KEY
```

Only the owner, only after the deadline, and only if a deadline was set. There
is no path by which the owner can take the funds while recipients still have a
right to them — that is the whole point of the deadline, and
`test_RevertWhen_SweepingBeforeTheDeadline` pins it.

---

## Interface

| Function | Who | What |
| --- | --- | --- |
| `claim(index, account, amount, proof)` | anyone | Verifies and sends `amount` to `account` |
| `canClaim(index, account, amount, proof)` | view | Would the claim succeed right now |
| `isClaimed(index)` | view | Has this index been used |
| `leafFor(index, account, amount)` | pure | The leaf hash, for tooling |
| `getState()` | view | Everything a claim page renders |
| `underfundedBy()` | view | Shortfall between promised and funded |
| `sweep(to)` | owner, after deadline | Recover the remainder |

| Event | Emitted when |
| --- | --- |
| `Claimed(index, account, amount)` | A claim succeeds. `index` and `account` are indexed. |
| `Swept(to, amount)` | The remainder is recovered. |

| Error | Cause |
| --- | --- |
| `InvalidProof()` | Proof does not verify against the root |
| `AlreadyClaimed(index)` | That index is spent |
| `ClaimPeriodOver(deadline)` | Past the deadline |
| `ClaimPeriodNotOver(deadline)` | Sweeping too early |
| `NoDeadlineSet()` | Sweeping an open-ended airdrop |
| `NothingToSweep()` | Balance is zero |
| `EmptyMerkleRoot()` / `ZeroAddress()` / `ZeroAllocation()` | Bad constructor arguments |

---

## Security properties

- **Claims are single-use.** An `OpenZeppelin BitMaps` bit per index, set before
  the transfer, so a token with a transfer callback cannot re-enter into a
  second claim on the same index.
- **Checks-effects-interactions.** The bit is set and `totalClaimed` incremented
  before `safeTransfer`.
- **`SafeERC20` throughout.** A token that reports failure by returning `false`
  rather than reverting cannot leave the accounting wrong.
- **Substitution is impossible.** `account` and `amount` are inside the leaf, so
  altering either invalidates the proof. So is `index`, which stops one valid
  entry being drained through every unused index.
- **The owner cannot take the funds early.** `sweep` is gated on the deadline
  having passed, and is unreachable when no deadline was set.
- **`Ownable2Step`**, so a fat-fingered ownership transfer cannot strand the
  sweep right.

### Known limitations

- **Fee-on-transfer and rebasing tokens are unsupported.** The contract sends
  exactly the allocation; a token that takes a cut in transit will deliver less
  than the tree promises and run out before the last claim.
- **The recipient list is public.** Unavoidable: proofs must be published.
- **The tree is immutable.** Correcting a list means deploying again.
- **Not audited.**

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Every claim reverts `InvalidProof` | Root on-chain does not match the tree the proofs came from | `cast call <AIRDROP> "merkleRoot()(bytes32)"` and compare with `airdrop/<name>.json`. Redeploy against the right root. |
| One address reverts `InvalidProof` | Stale proof, or the address is not in the tree | Rebuild and re-publish; check the address is in the CSV. |
| Claims revert late in the run | Underfunded | `underfundedBy()`; send the difference. |
| `ClaimPeriodOver` | Past the deadline | Nothing to do; the window closed. |
| `sweep` reverts `NoDeadlineSet` | Deployed with `AIRDROP_DEADLINE=0` | By design — the tokens are permanently the recipients'. |
| Verification fails on Etherscan | Constructor arguments do not match | Re-encode with the exact deployed values. |

Reproduce any encoding suspicion locally before touching a chain:

```bash
npm run test:airdrop
```
