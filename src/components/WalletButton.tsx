"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useWalletContext } from "@/components/WalletProvider";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { formatEth, shortenAddress } from "@/lib/format";
import { NATIVE_SYMBOL } from "@/lib/env";

/**
 * Connect, network and account state in one control. Wrong-network is surfaced
 * here rather than buried in each form, so there is one place to fix it.
 */
export default function WalletButton() {
  const wallet = useWalletContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (!wallet.isConnected) {
    return (
      <>
        <Button variant="primary" onClick={() => setPickerOpen(true)} loading={wallet.status === "connecting"}>
          Connect Wallet
        </Button>
        <WalletPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    );
  }

  if (!wallet.isCorrectChain) {
    return (
      <Button variant="sell" onClick={() => void wallet.switchChain()} loading={wallet.status === "switching"}>
        Switch to {ACTIVE_CHAIN.name}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setAccountOpen(true)}>
        <span className="mono">{shortenAddress(wallet.account)}</span>
        <span className="whitespace-nowrap text-dim">
          {formatEth(wallet.balance, 4)} {NATIVE_SYMBOL}
        </span>
      </Button>

      <Modal open={accountOpen} title="Wallet" onClose={() => setAccountOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-title mb-2">{wallet.selectedWallet?.info.name ?? "Connected"}</div>
            <div className="mono text-[13.5px] wrap-anywhere">{wallet.account}</div>
            <div className="my-4 h-px bg-line" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Balance</span>
              <span className="mono">
                {formatEth(wallet.balance)} {NATIVE_SYMBOL}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="text-muted">Network</span>
              <span>{wallet.chainName}</span>
            </div>
          </div>

          <Button
            block
            onClick={() => {
              wallet.disconnect();
              setAccountOpen(false);
            }}
          >
            Disconnect
          </Button>
        </div>
      </Modal>
    </>
  );
}

function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallet = useWalletContext();

  return (
    <Modal open={open} title="Connect a wallet" onClose={onClose}>
      <div className="flex flex-col gap-[9px]">
        {wallet.wallets.length === 0 ? (
          <Notice tone="warn">
            No EVM wallet detected in this browser. Install MetaMask, Rabby or another injected
            wallet, then reload the page.
          </Notice>
        ) : (
          wallet.wallets.map((entry) => (
            <button
              key={entry.info.rdns}
              className="wallet-option"
              onClick={async () => {
                await wallet.connect(entry);
                onClose();
              }}
            >
              {entry.info.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.info.icon} alt="" />
              ) : (
                <span className="avatar size-[27px] text-xs">{entry.info.name.slice(0, 1)}</span>
              )}
              {entry.info.name}
            </button>
          ))
        )}

        {wallet.error ? <Notice tone="error">{wallet.error}</Notice> : null}

        <p className="field-hint">
          Connecting only shares your address. Every transaction is signed in your own wallet and
          nothing is ever custodied here.
        </p>
      </div>
    </Modal>
  );
}
