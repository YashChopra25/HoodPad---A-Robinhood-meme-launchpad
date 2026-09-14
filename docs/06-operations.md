# Operations

Running the thing after it is deployed.

---

## Keys

| Key | Holds | Rotation |
| --- | --- | --- |
| Factory owner | Fee configuration, treasury, default router | `transferOwnership` on `MemeFactory` |
| Airdrop owner | The `sweep` right, after the deadline | `Ownable2Step`: `transferOwnership` then `acceptOwnership` from the new address |
| Deployer | Nothing after deployment | Not privileged; can be discarded |

`MemeFactory` uses one-step `transferOwnership`. `MerkleAirdrop` uses
`Ownable2Step`, so a transfer to a wrong address cannot strand the sweep right —
the new owner must accept before anything changes.

**The deployer key is not special.** Once contracts are deployed it holds no
role, which is deliberate: nothing needs a hot key to stay online.

### If a key is compromised

| Contract | Exposure | Action |
| --- | --- | --- |
| `MemeFactory` | Fees, treasury and default router can be changed. **Existing coins are untouched** — each is its own contract and the factory holds none of their funds. | `transferOwnership` to a safe address immediately. |
| `MerkleAirdrop` | The remainder can be swept, but **only after the deadline**. Before then, nothing can be taken. | Transfer ownership; if the deadline is close, warn recipients to claim. |
| A launched `MemeToken` | Metadata and exemptions, nothing more. Supply is fixed and there is no mint function. | Renounce ownership. |

No key anywhere can mint supply, move a holder's tokens, or block a sell.

---

## Fees and treasury

The factory takes a flat fee per launch and a percentage of every curve trade,
both forwarded to `treasury` as they are collected — the factory does not
accumulate a balance.

```bash
cast call <FACTORY> "treasury()(address)"       --rpc-url robinhood_testnet
cast call <FACTORY> "baseFee()(uint256)"        --rpc-url robinhood_testnet
cast call <FACTORY> "tradeFeeBps()(uint256)"    --rpc-url robinhood_testnet
cast call <FACTORY> "platformTaxBps()(uint256)" --rpc-url robinhood_testnet
```

Change them:

```bash
DEPLOYER_KEY=0x<owner key> \
npm run deploy:factory -- --chain testnet --update 0x<factory>
```

That rewrites `setFees` and `setCurveParams` from `src/lib/presets.ts`. Edit the
preset, then run the update — the UI reads the factory, so the two cannot drift.

`sweep()` on the factory only moves ETH that arrived some other way; fees are
already forwarded.

### Ceilings

Some limits are in the contract, not the interface, so no operator can exceed
them:

| Limit | Value | Where |
| --- | --- | --- |
| Platform transfer tax | 2.5% | `MemeToken.MAX_PLATFORM_TAX_BPS` |
| Creator tax | 10% | `MemeToken.MAX_TAX_BPS` |
| Curve trade fee | 5% | `MemeFactory.setCurveParams` |

A launched coin's taxes are immutable, so raising the factory's figures only
affects coins launched afterwards.

---

## Monitoring

Everything is on-chain; there is no service to watch.

```bash
# How many coins have launched
cast call <FACTORY> "tokenCount()(uint256)" --rpc-url robinhood_testnet

# One coin, in a single call
cast call <COIN> "getState()" --rpc-url robinhood_testnet

# Airdrop progress
cast call <AIRDROP> "getState()" --rpc-url sepolia
cast call <AIRDROP> "underfundedBy()(uint256)" --rpc-url sepolia   # want 0
```

Worth alerting on:

| Signal | Why |
| --- | --- |
| `underfundedBy() != 0` | Later claims will revert once the balance runs out |
| A curve at `progressBps() == 10000` with `graduated() == false` | The target is met but the pool has not opened — usually a missing or broken router |
| Treasury balance flat while launches continue | Fee forwarding is failing |

---

## Graduation problems

A curve that reaches its target but does not graduate has one of two causes.

**No router configured.** `router()` returns the zero address. The curve keeps
trading, which is the deliberate fallback — better than freezing a raise. Fix it
on the coin, if ownership has not been renounced:

```bash
cast send <COIN> "setRouter(address)" <ROUTER> --rpc-url robinhood_testnet --private-key $KEY
cast send <COIN> "graduate()" --rpc-url robinhood_testnet --private-key $KEY
```

Set `defaultRouter` on the factory so future launches get it automatically.

**The router call reverted.** `_graduate` wraps it in `try/catch` and leaves the
curve open rather than reverting the buyer's transaction. Check the router
actually exists at that address and has a factory and WETH:

```bash
cast code <ROUTER> --rpc-url robinhood_testnet | head -c 20   # not "0x"
cast call <ROUTER> "factory()(address)" --rpc-url robinhood_testnet
cast call <ROUTER> "WETH()(address)"    --rpc-url robinhood_testnet
```

Anyone may call `graduate()` once the target is met and a router is set; it is
not owner-gated.

---

## Front end

The app is a static Next.js build with no server-side secrets.

```bash
npm run build
npm run start
```

Because `NEXT_PUBLIC_*` values are inlined at build time, **changing any of them
requires a rebuild**, not a restart.

### Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Board is empty on a network with coins | `NEXT_PUBLIC_FACTORY_ADDRESS` unset or wrong | Set it and rebuild |
| Trade feed and chart are empty, coin data loads | RPC rejects the `eth_getLogs` range | Lower `NEXT_PUBLIC_LOG_CHUNK` to 2000 or 1000 |
| Everything is slow | Public RPC rate limits | Point `NEXT_PUBLIC_*_RPC_URL` at a provider |
| "Switch network" will not go away | Wallet is on another chain | The button adds the network via `wallet_addEthereumChain` if the wallet does not know it |
| Prices look wrong by orders of magnitude | Preset mismatch between UI and factory | The UI reads the factory when one is configured; check `NEXT_PUBLIC_FACTORY_ADDRESS` |

---

## Incident response

**A launched coin is malicious.** Nothing on-chain can be done — each coin is an
independent contract and the factory has no power over it. The board reads the
registry directly. Filtering would be a front-end change.

**The factory is misconfigured.** `--update` fixes fees and curve parameters.
Coins already launched keep the parameters they were created with; that is
immutability working, not a bug.

**An airdrop is underfunded.** Send the difference before the shortfall is
reached:

```bash
cast send <TOKEN> "transfer(address,uint256)" <AIRDROP> <SHORTFALL> \
  --rpc-url sepolia --private-key $KEY
```

**Airdrop claims all revert `InvalidProof`.** The deployed root does not match
the published proofs. Compare:

```bash
cast call <AIRDROP> "merkleRoot()(bytes32)" --rpc-url sepolia
```

against `airdrop/<name>.json`. `merkleRoot` is immutable, so a mismatch means
redeploying against the correct root and re-funding. Run `npm run test:airdrop`
before you do, to confirm the tree itself is sound.

---

## Before a mainnet deployment

- [ ] `npm run test:all` green
- [ ] `forge lint` clean in `contracts/`
- [ ] Contracts **audited** — they are not, today
- [ ] Deployer key is not reused from testnet
- [ ] Treasury is a multisig, not an EOA
- [ ] Factory ownership transferred off the deploying key
- [ ] Presets reviewed: `src/lib/presets.ts` mainnet block
- [ ] `NEXT_PUBLIC_CHAIN=mainnet` and a rebuild, not just a restart
- [ ] Contracts verified on the explorer
- [ ] A full dress rehearsal on testnet: launch, buy, sell, graduate, airdrop, claim, sweep

The audit item is not a formality. `MemeToken` and `MemeFactory` hold user funds
and have never been independently reviewed.
