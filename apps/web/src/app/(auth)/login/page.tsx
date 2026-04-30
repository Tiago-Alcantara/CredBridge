"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LoginBG } from "@/components/auth/LoginBG";
import { StellarAuth } from "@/components/auth/StellarAuth";
import { KycFlow } from "@/components/auth/KycFlow";

type RoleKey = "pme" | "investor" | "partner";
type Step = "role" | "credentials" | "stellar" | "kyc" | "done";

interface RoleOption {
  k: RoleKey;
  c: string;
  icon: IconName;
  label: string;
  desc: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation("pt");
  const [role, setRole] = useState<RoleKey>("pme");
  const [step, setStep] = useState<Step>("role");

  const handleStellarDone = useCallback(
    () => setStep(role === "pme" ? "kyc" : "done"),
    [role]
  );

  const roles: RoleOption[] = [
    {
      k: "pme",
      c: "#00D4FF",
      icon: "box",
      label: t("role_pme"),
      desc: t("role_pme_desc"),
    },
    {
      k: "investor",
      c: "#7B2FFF",
      icon: "chart",
      label: t("role_inv"),
      desc: t("role_inv_desc"),
    },
    {
      k: "partner",
      c: "#00FF94",
      icon: "code",
      label: t("role_partner"),
      desc: t("role_partner_desc"),
    },
  ];

  function dashFor(r: RoleKey): void {
    if (r === "pme") router.push("/pme/dashboard");
    else if (r === "investor") router.push("/investor/dashboard");
    else router.push("/partner/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
      }}
    >
      {/* Left: marketing panel */}
      <div
        style={{
          position: "relative",
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
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
            A ponte entre seus{" "}
            <span className="t-blue glow-blue">recebíveis</span> e o mundo
            on-chain.
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

      {/* Right: auth panel */}
      <div
        style={{
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div className="row between">
          <span className="t-3" style={{ fontSize: 13 }}>
            Novo na CredBridge?{" "}
            <a href="#" className="t-blue" style={{ textDecoration: "none" }}>
              Criar conta
            </a>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push("/")}
          >
            Voltar
          </button>
        </div>

        <div
          style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}
        >
          <h2 style={{ fontSize: 32, marginBottom: 8 }}>{t("login_title")}</h2>
          <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
            {t("login_sub")}
          </p>

          {step === "role" && (
            <>
              <div className="col" style={{ gap: 10, marginBottom: 24 }}>
                {roles.map((r) => (
                  <button
                    key={r.k}
                    onClick={() => setRole(r.k)}
                    style={{
                      textAlign: "left",
                      padding: 16,
                      border: `1px solid ${role === r.k ? r.c : "var(--line)"}`,
                      borderRadius: 12,
                      background:
                        role === r.k ? `${r.c}12` : "var(--surface)",
                      cursor: "pointer",
                      transition: "all .15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `${r.c}20`,
                        color: r.c,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={r.icon} size={18} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "var(--sans)",
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                      >
                        {r.label}
                      </div>
                      <div className="t-2" style={{ fontSize: 12.5 }}>
                        {r.desc}
                      </div>
                    </span>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `1.5px solid ${
                          role === r.k ? r.c : "var(--line-2)"
                        }`,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {role === r.k && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: r.c,
                          }}
                        />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={() => setStep("credentials")}
              >
                {t("login_continue")} <Icon name="arrow_right" size={16} />
              </button>
            </>
          )}

          {step === "credentials" && (
            <>
              <div className="col" style={{ gap: 16, marginBottom: 20 }}>
                <div>
                  <label className="field-label">{t("login_email")}</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="fulano@empresa.com.br"
                  />
                </div>
                <div>
                  <label className="field-label">{t("login_password")}</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••••"
                  />
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={() => setStep("stellar")}
              >
                {t("login_continue")} <Icon name="arrow_right" size={16} />
              </button>
              <div
                className="row"
                style={{ margin: "24px 0", gap: 12, alignItems: "center" }}
              >
                <div
                  style={{ flex: 1, height: 1, background: "var(--line)" }}
                />
                <span
                  className="t-3"
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  {t("login_or")}
                </span>
                <div
                  style={{ flex: 1, height: 1, background: "var(--line)" }}
                />
              </div>
              <button
                className="btn btn-ghost btn-lg"
                style={{ width: "100%" }}
                onClick={() => setStep("stellar")}
              >
                <Icon name="chain" size={16} /> {t("login_stellar")}
              </button>
              <button
                className="appnav-link"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => setStep("role")}
              >
                ← Trocar perfil
              </button>
            </>
          )}

          {step === "stellar" && (
            <StellarAuth
              onDone={handleStellarDone}
              onBack={() => setStep("credentials")}
            />
          )}

          {step === "kyc" && <KycFlow onDone={() => dashFor(role)} />}

          {step === "done" && (
            <div
              className="card hi"
              style={{ textAlign: "center", padding: 40 }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--green-soft)",
                  color: "var(--green)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Icon name="check" size={32} />
              </div>
              <h3>Autenticação concluída</h3>
              <p className="t-2" style={{ marginTop: 8, marginBottom: 24 }}>
                Autenticação concluída. Clique abaixo para continuar.
              </p>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={() => dashFor(role)}
              >
                Ir para o painel <Icon name="arrow_right" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
