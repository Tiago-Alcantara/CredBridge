// apps/web/src/components/anchor/AnchorDrawer.tsx
"use client";

import { useState } from "react";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useAnchorOnrampStart, useAnchorOfframpStart } from "@/lib/api/anchor";

type Step = "amount" | "loading" | "iframe" | "error";

interface AnchorDrawerProps {
  mode: "onramp" | "offramp";
  open: boolean;
  onClose: () => void;
}

export function AnchorDrawer({ mode, open, onClose }: AnchorDrawerProps) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onrampMutation = useAnchorOnrampStart();
  const offrampMutation = useAnchorOfframpStart();

  const isOnramp = mode === "onramp";
  const title = isOnramp ? "Depositar BRL" : "Sacar BRL";

  const handleClose = () => {
    setStep("amount");
    setAmount("");
    setInteractiveUrl(null);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const parsed = parseFloat(amount);
    if (!(parsed > 0)) return;
    setError(null);
    setStep("loading");

    const mutation = isOnramp ? onrampMutation : offrampMutation;
    mutation.mutate(
      { amount: parsed },
      {
        onSuccess: (data) => {
          if (data.interactiveUrl) {
            setInteractiveUrl(data.interactiveUrl);
            setStep("iframe");
          } else {
            setError(
              "Etherfuse não retornou URL interativa. Suporte PIX/Brasil está em sandbox — tente novamente mais tarde.",
            );
            setStep("error");
          }
        },
        onError: (err) => {
          setError(extractApiErrorMessage(err));
          setStep("error");
        },
      },
    );
  };

  return (
    <Drawer open={open} onClose={handleClose} title={title} width={560}>
      {step === "amount" && (
        <div className="col" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 14, fontSize: 13 }}>
            <span className="t-2">
              {isOnramp ? "BRL → TESOURO via PIX" : "TESOURO → BRL via PIX"}
            </span>
            <p className="t-3" style={{ marginTop: 4, lineHeight: 1.5 }}>
              {isOnramp
                ? "Deposite BRL via PIX e receba TESOURO na sua carteira Stellar para investir em recebíveis."
                : "Transfira TESOURO da sua carteira Stellar e receba BRL via PIX na sua conta bancária."}
            </p>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">Valor (BRL)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Continuar <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "loading" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 48 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "3px solid var(--line)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <h3 style={{ fontSize: 18 }}>Iniciando fluxo…</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            Conectando com Etherfuse via Stellar.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "iframe" && interactiveUrl && (
        <div className="col" style={{ gap: 12 }}>
          <p className="t-2" style={{ fontSize: 12 }}>
            Complete o fluxo abaixo. Feche o painel quando concluir.
          </p>
          <iframe
            src={interactiveUrl}
            allow="payment"
            style={{ width: "100%", height: 520, border: "none", borderRadius: 8 }}
            title="Etherfuse"
          />
        </div>
      )}

      {step === "error" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 32 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(255,85,119,0.1)",
              color: "var(--red)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="close" size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>Algo deu errado</h3>
          <p className="t-2" style={{ fontSize: 13 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => { setError(null); setStep("amount"); }}>
            Tentar novamente
          </button>
        </div>
      )}
    </Drawer>
  );
}
