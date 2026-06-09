"use client";

import { useState } from "react";
import { Icon } from "../primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { useNotifyDepositPayment, type InvestorTransaction } from "@/lib/api/investments";
import { useToast } from "@/providers/ToastProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: InvestorTransaction | null;
  onSuccess: () => void;
}

export function DepositModal({ isOpen, onClose, transaction, onSuccess }: DepositModalProps) {
  const { showToast } = useToast();
  const { t } = useTranslation("en");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const notifyPaymentMut = useNotifyDepositPayment();

  if (!isOpen || !transaction) return null;

  const pixKey = `00020126360014br.gov.bcb.pix0114credbridgepix0227Aporte de Investimento CB20005204000053039865407${transaction.amount.toFixed(2)}5802BR5910CredBridge6009Sao Paulo62070503***6304724E`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    showToast(t("dm_toast_copied"), "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = async () => {
    try {
      setSubmitting(true);
      await notifyPaymentMut.mutateAsync(transaction.id);
      showToast(t("dm_toast_notified"), "success");
      onSuccess();
      onClose();
    } catch (err) {
      showToast(t("dm_toast_error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 0,
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 32px 64px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "#00FF94", marginBottom: 4 }}>
              {t("dm_eyebrow")}
            </span>
            <h3 style={{ fontSize: 20 }}>{t("dm_title")}</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: 4 }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div className="t-3" style={{ fontSize: 13, marginBottom: 4 }}>{t("dm_amount")}</div>
            <div className="num" style={{ fontSize: 32, fontWeight: 700, color: "var(--fg)" }}>
              {fmtBRL(transaction.amount)}
            </div>
          </div>

          {/* Simulated QR Code SVG */}
          <div
            style={{
              padding: 16,
              background: "white",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <svg width="180" height="180" viewBox="0 0 100 100" fill="black">
              {/* Quieto e cantos do QR Code */}
              <rect x="0" y="0" width="100" height="100" fill="white" />
              {/* Canto superior esquerdo */}
              <rect x="10" y="10" width="30" height="30" fill="black" />
              <rect x="15" y="15" width="20" height="20" fill="white" />
              <rect x="20" y="20" width="10" height="10" fill="black" />
              {/* Canto superior direito */}
              <rect x="60" y="10" width="30" height="30" fill="black" />
              <rect x="65" y="15" width="20" height="20" fill="white" />
              <rect x="70" y="20" width="10" height="10" fill="black" />
              {/* Canto inferior esquerdo */}
              <rect x="10" y="60" width="30" height="30" fill="black" />
              <rect x="15" y="65" width="20" height="20" fill="white" />
              <rect x="20" y="70" width="10" height="10" fill="black" />
              {/* Bits aleatórios simulando QR Code */}
              <rect x="45" y="10" width="10" height="5" fill="black" />
              <rect x="50" y="20" width="5" height="10" fill="black" />
              <rect x="45" y="35" width="10" height="10" fill="black" />
              <rect x="10" y="45" width="15" height="5" fill="black" />
              <rect x="25" y="50" width="5" height="5" fill="black" />
              <rect x="60" y="45" width="10" height="10" fill="black" />
              <rect x="75" y="45" width="15" height="5" fill="black" />
              <rect x="70" y="55" width="5" height="20" fill="black" />
              <rect x="45" y="60" width="10" height="5" fill="black" />
              <rect x="50" y="70" width="15" height="10" fill="black" />
              <rect x="45" y="85" width="20" height="5" fill="black" />
              <rect x="70" y="80" width="20" height="10" fill="black" />
            </svg>
          </div>

          <p className="t-3" style={{ fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>
            {t("dm_scan_desc")}
          </p>

          {/* Copy and Paste Box */}
          <div
            onClick={handleCopy}
            style={{
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--line-2)",
              borderRadius: 12,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "border-color 0.2s ease, background 0.2s ease",
            }}
            className="hover-card"
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "85%", fontSize: 13, fontFamily: "monospace" }}>
              {pixKey}
            </div>
            <span style={{ color: copied ? "#00FF94" : "var(--accent)" }}>
              <Icon name={copied ? "check" : "copy"} size={16} />
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "24px 32px",
            background: "var(--bg)",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={onClose}
          >
            {t("dm_pay_later")}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmPayment}
            disabled={submitting}
          >
            {submitting ? t("dm_confirming") : t("dm_already_transferred")}
          </button>
        </div>
      </div>
    </div>
  );
}
