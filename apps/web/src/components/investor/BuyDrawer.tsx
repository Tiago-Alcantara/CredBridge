"use client";

import { useState } from "react";
import type { Receivable } from "@credbridge/types";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { useBuyReceivable } from "@/lib/api/investments";
import { extractApiErrorMessage } from "@/lib/api/client";

const DISCOUNT = 0.03;
const FAKE_PIX_STRING =
  "00020126360014BR.GOV.BCB.PIX0114credbridge-mock5204000053039865802BR5913CredBridge LT6009Sao Paulo62070503***6304";

type Step = "summary" | "pix" | "success";

interface BuyDrawerProps {
  receivable: Receivable | null;
  onClose: () => void;
  onSuccess: () => void;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function BuyDrawer({ receivable, onClose, onSuccess }: BuyDrawerProps) {
  const [step, setStep] = useState<Step>("summary");
  const [error, setError] = useState<string | null>(null);
  const buyMutation = useBuyReceivable();

  const open = receivable !== null;
  const faceValue = receivable?.value ?? 0;
  const amountPaid = Number((faceValue * (1 - DISCOUNT)).toFixed(2));
  const profit = faceValue - amountPaid;
  const days = receivable ? daysBetween(new Date(), new Date(receivable.dueDate)) : 0;

  const handleClose = () => {
    setStep("summary");
    setError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!receivable) return;
    setError(null);
    buyMutation.mutate(
      { receivableId: receivable.id, pixTxId: `mock-${Date.now()}` },
      {
        onSuccess: () => setStep("success"),
        onError: (err) => {
          const msg = extractApiErrorMessage(err) || "Erro ao processar compra";
          if (msg.toLowerCase().includes("indispon")) {
            setError("Outro investidor adquiriu primeiro.");
            setTimeout(() => handleClose(), 1500);
          } else {
            setError(msg);
          }
        },
      }
    );
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Comprar cota">
      {receivable && step === "summary" && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Sacado</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{receivable.debtorName}</div>
            <div className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              Vence em {days} {days === 1 ? "dia" : "dias"} ·{" "}
              {new Date(receivable.dueDate).toLocaleDateString("pt-BR")}
            </div>
          </div>

          <div className="col" style={{ gap: 10 }}>
            <div className="row between">
              <span className="t-2">Valor de face</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-2">Deságio (3%)</span>
              <span className="num t-3">−{fmtBRL(faceValue - amountPaid)}</span>
            </div>
            <div
              className="row between"
              style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}
            >
              <span style={{ fontWeight: 600 }}>Você paga</span>
              <span className="num kpi" style={{ fontSize: 22 }}>{fmtBRL(amountPaid)}</span>
            </div>
            <div className="row between">
              <span className="t-2">Recebe no vencimento</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-green" style={{ fontWeight: 600 }}>Lucro estimado</span>
              <span className="num t-green" style={{ fontWeight: 600 }}>{fmtBRL(profit)}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => setStep("pix")}>
            Continuar pagamento <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "pix" && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 22, textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Pagamento Pix</div>
            <div
              style={{
                width: 200,
                height: 200,
                margin: "0 auto",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                color: "var(--fg-3)",
                fontSize: 12,
              }}
            >
              QR mockado
            </div>
            <div className="kpi num" style={{ fontSize: 24, marginTop: 14 }}>
              {fmtBRL(amountPaid)}
            </div>
            <div className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              Aguardando pagamento
            </div>
          </div>

          <div>
            <div className="field-label">Copia e cola</div>
            <div
              className="mono"
              style={{
                padding: 12,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 11,
                wordBreak: "break-all",
              }}
            >
              {FAKE_PIX_STRING}
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>
          )}

          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn btn-ghost grow"
              onClick={() => setStep("summary")}
              disabled={buyMutation.isPending}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary grow"
              onClick={handleConfirm}
              disabled={buyMutation.isPending}
            >
              {buyMutation.isPending ? "Processando…" : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="col" style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--green)15",
              color: "var(--green)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="check" size={28} />
          </div>
          <h3 style={{ fontSize: 22 }}>Cota adquirida</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            Sua posição foi registrada. Acompanhe em "Minhas cotas".
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              handleClose();
              onSuccess();
            }}
          >
            Ver minhas cotas <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}
    </Drawer>
  );
}
