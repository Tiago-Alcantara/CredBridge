"use client";

import { LoginBG } from "@/components/auth/LoginBG";
import { PrivyLoginPanel } from "@/components/auth/PrivyLoginPanel";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function LoginPage() {
  const { t } = useTranslation("en");

  return (
    <div className="grid-auth-split">
      <div
        className="auth-aside"
        style={{
          position: "relative",
          padding: "40px 48px",
          borderRight: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        <LoginBG />
        <div style={{ position: "relative" }}>
          <Logo />
        </div>
        <div
          style={{
            marginTop: "auto",
            position: "relative",
            maxWidth: 480,
          }}
        >
          <div className="chip" style={{ marginBottom: 24 }}>
            <span className="dot-live" />
            <span>Stellar mainnet</span>
          </div>
          <h2 style={{ fontSize: 42, letterSpacing: "-0.03em" }}>
            {t("login_aside_pre")}
            <span className="t-blue glow-blue">{t("login_aside_highlight_pme")}</span>
            {t("login_aside_post")}
          </h2>
          <div
            className="row"
            style={{
              gap: 14,
              marginTop: 32,
              flexWrap: "wrap",
              color: "var(--fg-2)",
              fontSize: 13,
            }}
          >
            <span className="row" style={{ gap: 8 }}>
              <Icon name="shield" size={14} /> ISO 27001
            </span>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="check" size={14} /> CVM 88
            </span>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="chain" size={14} /> Soroban audited
            </span>
          </div>
        </div>
      </div>

      {/* Coluna Direita - Login com Privy para PME */}
      <div
        style={{
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          overflow: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          <PrivyLoginPanel targetRole="pme" />
        </div>
      </div>
    </div>
  );
}

