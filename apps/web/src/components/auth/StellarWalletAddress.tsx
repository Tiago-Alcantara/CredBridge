"use client";

import { useState } from "react";
import { useMe } from "@/lib/api/me";
import { Icon } from "@/components/primitives/Icon";

const EXPLORER = "https://stellar.expert/explorer/testnet/account";

function truncate(key: string) {
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

export function StellarWalletAddress() {
  const { data: me } = useMe();
  const [copied, setCopied] = useState(false);

  const walletId = me?.privyStellarWalletAddress ?? me?.stellarWalletId;
  if (!walletId) return null;

  function handleCopy() {
    navigator.clipboard.writeText(walletId!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 16, fontSize: 13}}>
      <Icon name="wallet" size={15} />
      <span style={{color: "var(--fg-muted)"}}>Wallet Stellar:</span>
      <code style={{fontFamily: "monospace", letterSpacing: "0.02em"}}>{truncate(walletId)}</code>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleCopy}
        style={{padding: "2px 8px", fontSize: 12}}
        title="Copiar endereço completo"
      >
        {copied ? "Copiado!" : <Icon name="copy" size={13} />}
      </button>
      <a
        href={`${EXPLORER}/${walletId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm"
        style={{padding: "2px 8px", fontSize: 12}}
        title="Ver no Stellar Expert"
      >
        <Icon name="arrow_up_right" size={13} />
      </a>
    </div>
  );
}
