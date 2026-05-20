"use client";

import { useState, useCallback } from "react";
import { Icon } from "@/components/primitives/Icon";
import { useGetWallet, useCreateWallet } from "@/lib/api/wallet";
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useMe } from "@/lib/api/me";

export function WalletSetupBanner() {
  const { data: wallet, isLoading } = useGetWallet();
  const { data: me } = useMe();
  const createWallet = useCreateWallet();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('wallet-banner-dismissed') === '1',
  );
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = useCallback(async () => {
    if (!me?.email) return;
    setSetting(true);
    setError(null);
    try {
      const { contractId, keyId, publicKey } = await registerAndDeployWallet(me.email);
      await createWallet.mutateAsync({ contractId, keyId, publicKey });
    } catch (err) {
      if (err instanceof PasskeyAbortedError) {
        setDismissed(true);
        return;
      }
      setError("Erro ao configurar carteira. Tente novamente.");
    } finally {
      setSetting(false);
    }
  }, [me?.email, createWallet]);

  if (isLoading || wallet || dismissed) return null;

  return (
    <div style={{display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 24}}>
      <span style={{ color: "var(--blue)", flexShrink: 0 }}>
        <Icon name="wallet" size={18} />
      </span>
      <span style={{ flex: 1, fontSize: 13.5 }}>
        {error ?? "Carteira Stellar não configurada."}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleSetup}
        disabled={setting}
        style={{ flexShrink: 0 }}
      >
        {setting ? "Configurando…" : "Configurar agora"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => { sessionStorage.setItem('wallet-banner-dismissed', '1'); setDismissed(true); }}
        style={{ flexShrink: 0, padding: "4px 8px" }}
        aria-label="Fechar"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
