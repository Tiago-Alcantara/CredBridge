"use client";

import { useState } from "react";
import type { Investment, Receivable } from "@credbridge/types";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { useBuyReceivable } from "@/lib/api/investments";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useFinancialAuthorization } from "@/lib/financial-actions/useFinancialAuthorization";
import { useTranslation } from "@/lib/i18n/useTranslation";

const DISCOUNT = 0.03;

type Step = "summary" | "settling" | "success";

interface BuyDrawerProps {
  receivable: Receivable | null;
  userEmail?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function BuyDrawer({ receivable, userEmail, onClose, onSuccess }: BuyDrawerProps) {
  const [step, setStep] = useState<Step>("summary");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Investment | null>(null);
  const buyMutation = useBuyReceivable();
  const { authorize, isAuthorizing } = useFinancialAuthorization(userEmail);
  const { t } = useTranslation("en");

  const open = receivable !== null;
  const faceValue = receivable?.value ?? 0;
  const amountPaid = Number((faceValue * (1 - DISCOUNT)).toFixed(2));
  const profit = faceValue - amountPaid;
  const days = receivable ? daysBetween(new Date(), new Date(receivable.dueDate)) : 0;

  const handleClose = () => {
    setStep("summary");
    setError(null);
    setResult(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!receivable) return;
    setError(null);
    setStep("settling");

    try {
      const authorizationId = await authorize({
        operation: "investment.purchase",
        resourceId: receivable.id,
        amount: amountPaid.toFixed(2),
      });
      const inv = await buyMutation.mutateAsync({
        receivableId: receivable.id,
        authorizationId,
      });
      setResult(inv);
      setStep("success");
    } catch (err) {
      const msg = extractApiErrorMessage(err) || t("bd_purchase_error");
      setStep("summary");
      if (msg.toLowerCase().includes("indispon")) {
        setError(t("bd_bought_first"));
        setTimeout(() => handleClose(), 1500);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <Drawer open={open} onClose={handleClose} title={t("bd_title")}>
      {receivable && step === "summary" && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{t("tbl_debtor")}</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{receivable.debtorName}</div>
            <div className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              {t("bd_due_in")} {days} {days === 1 ? t("bd_day") : t("bd_days")} ·{" "}
              {new Date(receivable.dueDate).toLocaleDateString("en-US")}
            </div>
          </div>

          <div className="col" style={{ gap: 10 }}>
            <div className="row between">
              <span className="t-2">{t("bd_face_value")}</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-2">{t("bd_discount_3")}</span>
              <span className="num t-3">−{fmtBRL(faceValue - amountPaid)}</span>
            </div>
            <div
              className="row between"
              style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}
            >
              <span style={{ fontWeight: 600 }}>{t("bd_you_pay")}</span>
              <span className="num kpi" style={{ fontSize: 22 }}>
                {amountPaid.toFixed(2)} XLM
              </span>
            </div>
            <div className="row between">
              <span className="t-2">{t("bd_receive_at_maturity")}</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-green" style={{ fontWeight: 600 }}>{t("bd_estimated_profit")}</span>
              <span className="num t-green" style={{ fontWeight: 600 }}>{fmtBRL(profit)}</span>
            </div>
          </div>

          <div
            className="card"
            style={{ padding: 14, background: "var(--surface-2)", fontSize: 12 }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("bd_how_it_works")}</div>
            <div className="t-3" style={{ lineHeight: 1.5 }}>
              {t("bd_how_desc_pre")}{amountPaid.toFixed(2)} XLM{t("bd_how_desc_post")}
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>
          )}

          <button
            className="btn btn-primary btn-lg"
            onClick={handleConfirm}
            disabled={buyMutation.isPending || isAuthorizing}
          >
            {t("bd_confirm_purchase")} <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "settling" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 32 }}
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
          <h3 style={{ fontSize: 18 }}>{t("bd_settling")}</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            {t("bd_settling_desc")}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "success" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 24 }}
        >
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
          <h3 style={{ fontSize: 22 }}>{t("bd_share_acquired")}</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            {t("bd_success_desc")}
          </p>

          {result?.paymentTxHash && (
            <div className="card" style={{ padding: 12, width: "100%", textAlign: "left" }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{t("bd_payment_xlm")}</div>
              <div className="mono" style={{ fontSize: 11 }}>
                {truncateHash(result.paymentTxHash)}
              </div>
            </div>
          )}
          {result?.nftTransferTxHash && (
            <div className="card" style={{ padding: 12, width: "100%", textAlign: "left" }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{t("bd_nft_transfer")}</div>
              <div className="mono" style={{ fontSize: 11 }}>
                {truncateHash(result.nftTransferTxHash)}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              handleClose();
              onSuccess();
            }}
          >
            {t("bd_view_my_shares")} <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}
    </Drawer>
  );
}
