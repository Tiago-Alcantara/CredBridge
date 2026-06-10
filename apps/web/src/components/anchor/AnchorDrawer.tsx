"use client";

import { useState, useRef, useCallback } from "react";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { extractApiErrorMessage, apiFetch } from "@/lib/api/client";
import {
  useAnchorOnrampStart,
  useAnchorOfframpStart,
  type OnboardingStatusResponse,
  type PaymentInstructions,
} from "@/lib/api/anchor";
import { KycModal } from "./KycModal";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Step = "amount" | "checking" | "kyc" | "ramp-loading" | "pix" | "error";

interface AnchorDrawerProps {
  mode: "onramp" | "offramp";
  open: boolean;
  onClose: () => void;
}

export function AnchorDrawer({ mode, open, onClose }: AnchorDrawerProps) {
  const { t } = useTranslation("en");
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] =
    useState<PaymentInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const processingAmount = useRef(0);
  const kycUrlRef = useRef<string | null>(null);
  const tcRetryCount = useRef(0);
  const onrampMutation = useAnchorOnrampStart();
  const offrampMutation = useAnchorOfframpStart();

  const isOnramp = mode === "onramp";
  const title = isOnramp ? t("inv_deposit_brl") : t("ad_title_offramp");

  const handleClose = () => {
    setStep("amount");
    setAmount("");
    setKycUrl(null);
    setPaymentInstructions(null);
    setError(null);
    setCopied(false);
    processingAmount.current = 0;
    kycUrlRef.current = null;
    tcRetryCount.current = 0;
    onClose();
  };

  const doStartRamp = useCallback(
    (parsedAmount: number) => {
      setStep("ramp-loading");
      const mutation = isOnramp ? onrampMutation : offrampMutation;
      mutation.mutate(
        { amount: parsedAmount },
        {
          onSuccess: (data) => {
            if (data.paymentInstructions) {
              setPaymentInstructions(data.paymentInstructions);
              setStep("pix");
            } else {
              setError(t("ad_no_instructions"));
              setStep("error");
            }
          },
          onError: (err) => {
            const msg = extractApiErrorMessage(err);
            const isTcError =
              msg.toLowerCase().includes("terms") ||
              msg.toLowerCase().includes("conditions") ||
              msg.toLowerCase().includes("agreement") ||
              msg.toLowerCase().includes("kyc_incomplete");
            if (isTcError && kycUrlRef.current && tcRetryCount.current === 0) {
              tcRetryCount.current += 1;
              setKycUrl(kycUrlRef.current);
              setStep("kyc");
            } else {
              setError(
                isTcError
                  ? t("ad_tc_error")
                  : msg,
              );
              setStep("error");
            }
          },
        },
      );
    },
    [isOnramp, onrampMutation, offrampMutation, t],
  );

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!(parsed > 0)) return;
    processingAmount.current = parsed;
    tcRetryCount.current = 0;
    setError(null);
    setStep("checking");

    try {
      const status = await apiFetch<OnboardingStatusResponse>(
        "/anchor/onboarding-status",
      );
      setKycUrl(status.kycUrl);
      kycUrlRef.current = status.kycUrl; // ref for stale-closure-safe access in callbacks
      if (!status.onboarded) {
        setStep("kyc");
      } else {
        doStartRamp(parsed);
      }
    } catch (err) {
      setError(extractApiErrorMessage(err));
      setStep("error");
    }
  };

  const handleKycComplete = useCallback(() => {
    doStartRamp(processingAmount.current);
  }, [doStartRamp]);

  const handleKycDismiss = () => {
    setStep("amount");
    setKycUrl(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const pix =
    paymentInstructions?.type === "pix" ? paymentInstructions : null;

  return (
    <Drawer open={open} onClose={handleClose} title={title} width={560}>
      {step === "amount" && (
        <div className="col" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 14, fontSize: 13 }}>
            <span className="t-2">
              {isOnramp ? t("ad_flow_onramp") : t("ad_flow_offramp")}
            </span>
            <p className="t-3" style={{ marginTop: 4, lineHeight: 1.5 }}>
              {isOnramp ? t("ad_desc_onramp") : t("ad_desc_offramp")}
            </p>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">{t("ad_value_brl")}</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input"
              placeholder="0.00"
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
            {t("login_continue")} <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "checking" && (
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
          <h3 style={{ fontSize: 18 }}>{t("ad_checking")}</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            {t("ad_checking_desc")}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "kyc" && kycUrl && (
        <KycModal
          kycUrl={kycUrl}
          onComplete={handleKycComplete}
          onDismiss={handleKycDismiss}
        />
      )}

      {step === "ramp-loading" && (
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
          <h3 style={{ fontSize: 18 }}>{t("ad_generating")}</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            {t("ad_generating_desc")}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "pix" && pix && (
        <div className="col" style={{ gap: 20 }}>
          <div
            className="card"
            style={{ padding: 14, background: "rgba(var(--accent-rgb),0.06)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}
          >
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              {t("ad_pay_via_pix")}
            </span>
            <p className="t-3" style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>
              {t("ad_pay_desc")}
            </p>
          </div>

          {pix.amount && (
            <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
              <span className="t-2" style={{ fontSize: 13 }}>{t("tbl_value")}</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                {parseFloat(pix.amount).toLocaleString("en-US", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}

          {pix.beneficiary && (
            <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
              <span className="t-2" style={{ fontSize: 13 }}>{t("ad_beneficiary")}</span>
              <span style={{ fontSize: 13 }}>{pix.beneficiary}</span>
            </div>
          )}

          {pix.pixKey && (
            <div className="col" style={{ gap: 6 }}>
              <span className="eyebrow">{t("ad_pix_key")}</span>
              <div
                className="row"
                style={{ gap: 8, alignItems: "center", background: "var(--surface-2)", borderRadius: 6, padding: "8px 12px" }}
              >
                <span
                  style={{ flex: 1, fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}
                >
                  {pix.pixKey}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "4px 10px", flexShrink: 0 }}
                  onClick={() => handleCopy(pix.pixKey!)}
                >
                  {copied ? t("ad_copied") : t("ad_copy")}
                </button>
              </div>
            </div>
          )}

          {pix.pixCode && (
            <div className="col" style={{ gap: 6 }}>
              <span className="eyebrow">{t("ad_pix_code")}</span>
              <div
                className="col"
                style={{ gap: 8, background: "var(--surface-2)", borderRadius: 6, padding: 12 }}
              >
                <span
                  style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6, color: "var(--t-2)" }}
                >
                  {pix.pixCode}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => handleCopy(pix.pixCode!)}
                >
                  <Icon name="copy" size={14} />
                  {copied ? t("ad_copied") : t("ad_copy_pix_code")}
                </button>
              </div>
            </div>
          )}

          <p className="t-3" style={{ fontSize: 11, textAlign: "center" }}>
            {t("ad_pix_footer")}
          </p>
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
          <h3 style={{ fontSize: 18 }}>{t("ad_something_wrong")}</h3>
          <p className="t-2" style={{ fontSize: 13 }}>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => { setError(null); setStep("amount"); }}
          >
            {t("ad_try_again")}
          </button>
        </div>
      )}
    </Drawer>
  );
}
