"use client";

import { useState } from "react";
import { useUser } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { Icon } from "../primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { type InvestorTransaction } from "@/lib/api/investments";
import { useToast } from "@/providers/ToastProvider";
import { useGetWallet } from "@/lib/api/wallet";
import { runOnChainDeposit } from "@/lib/stellar/sign-deposit";
import {
  type LinkedAccount,
  findPrivyStellarWalletAddress,
} from "@/lib/stellar/wallet-address";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface FinalizeAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: InvestorTransaction | null;
  onSuccess: () => void;
  userEmail?: string | null;
}

type SigningStep = "idle" | "approve_brlt" | "deposit_pool" | "success" | "error";

export function FinalizeAssignmentModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
  userEmail,
}: FinalizeAssignmentModalProps) {
  const { showToast } = useToast();
  const { t } = useTranslation("en");
  const [signingStep, setSigningStep] = useState<SigningStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: wallet } = useGetWallet();
  const { user } = useUser();
  const { signRawHash } = useSignRawHash();

  if (!isOpen || !transaction) return null;

  const resolvePrivyAddress = (): string => {
    const privyAddress =
      wallet?.walletType === "privy_stellar"
        ? wallet.contractId
        : findPrivyStellarWalletAddress(
            user?.linkedAccounts as LinkedAccount[] | undefined,
          );

    if (!privyAddress) {
      throw new Error(t("fa_no_wallet"));
    }

    return privyAddress;
  };

  const handleFinalize = async () => {
    try {
      setErrorMessage(null);
      setSigningStep("approve_brlt");
      const privyAddress = resolvePrivyAddress();
      await runOnChainDeposit({
        transactionId: transaction.id,
        privyAddress,
        signRawHash,
        onStage: (stage) => setSigningStep(stage === "approve" ? "approve_brlt" : "deposit_pool"),
      });
      setSigningStep("success");
      showToast(t("fa_toast_success"), "success");
    } catch (err: any) {
      setSigningStep("error");
      setErrorMessage(err?.message || t("fa_error_default"));
      showToast(t("fa_toast_fail"), "error");
    }
  };

  const handleClose = () => {
    setSigningStep("idle");
    setErrorMessage(null);
    onClose();
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
            <span className="eyebrow" style={{ color: "var(--accent)", marginBottom: 4 }}>
              {t("fa_eyebrow")}
            </span>
            <h3 style={{ fontSize: 20 }}>{t("inv_finalize_contribution")}</h3>
          </div>
          {signingStep !== "approve_brlt" && signingStep !== "deposit_pool" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClose}
              style={{ padding: 4 }}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
          {signingStep === "idle" && (
            <>
              <div style={{ textAlign: "center" }}>
                <div className="t-3" style={{ fontSize: 13, marginBottom: 4 }}>{t("fa_brlt_available")}</div>
                <div className="num" style={{ fontSize: 32, fontWeight: 700, color: "var(--accent)" }}>
                  {fmtBRL(transaction.amount)}
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("fa_how_step")}</div>
                <p className="t-3">
                  {t("fa_how_p")}
                </p>
                <ul className="t-3" style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  <li>{t("fa_bullet1")}</li>
                  <li>{t("fa_bullet2")}</li>
                  <li>{t("fa_bullet3")}</li>
                </ul>
              </div>

              <div className="row end" style={{ gap: 12 }}>
                <button className="btn btn-ghost" onClick={handleClose}>
                  {t("op_cancel")}
                </button>
                <button className="btn btn-primary" onClick={handleFinalize}>
                  {t("fa_sign_issue")} <Icon name="arrow_right" size={14} />
                </button>
              </div>
            </>
          )}

          {(signingStep === "approve_brlt" || signingStep === "deposit_pool") && (
            <div className="col" style={{ alignItems: "center", gap: 20, padding: "20px 0", textAlign: "center" }}>
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
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>
                  {signingStep === "approve_brlt"
                    ? t("fa_step1")
                    : t("fa_step2")}
                </h3>
                <p className="t-2" style={{ fontSize: 13 }}>
                  {signingStep === "approve_brlt"
                    ? t("fa_step1_desc")
                    : t("fa_step2_desc")}
                </p>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {signingStep === "success" && (
            <div className="col" style={{ alignItems: "center", gap: 20, textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(0, 255, 148, 0.1)",
                  color: "#00FF94",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="check" size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: 22, marginBottom: 6 }}>{t("fa_success_title")}</h3>
                <p className="t-2" style={{ fontSize: 13 }}>
                  {t("fa_success_desc")}
                </p>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => {
                  onSuccess();
                  handleClose();
                }}
              >
                {t("fa_view_portfolio")} <Icon name="arrow_right" size={14} />
              </button>
            </div>
          )}

          {signingStep === "error" && (
            <div className="col" style={{ alignItems: "center", gap: 20, textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(255, 68, 68, 0.1)",
                  color: "var(--red)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="close" size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 6, color: "var(--red)" }}>{t("fa_fail_title")}</h3>
                <p className="t-2" style={{ fontSize: 13, wordBreak: "break-word" }}>
                  {errorMessage || t("fa_fail_default")}
                </p>
              </div>
              <div className="row" style={{ width: "100%", gap: 12, marginTop: 12 }}>
                <button className="btn btn-ghost grow" onClick={handleClose}>
                  {t("cm_close")}
                </button>
                <button className="btn btn-primary grow" onClick={handleFinalize}>
                  {t("fa_retry")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
