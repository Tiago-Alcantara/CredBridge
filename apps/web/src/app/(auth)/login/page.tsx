"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LoginBG } from "@/components/auth/LoginBG";
import { KycFlow } from "@/components/auth/KycFlow";
import { useLogin, useRegister } from "@/lib/api/auth";

type RoleKey = "pme" | "investor" | "partner";
type Step = "role" | "credentials" | "kyc";
type Mode = "login" | "register";

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
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const dashFor = useCallback(
    (r: RoleKey) => {
      if (r === "pme") router.push("/pme/dashboard");
      else if (r === "investor") router.push("/investor/dashboard");
      else router.push("/partner/dashboard");
    },
    [router]
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (mode === "login") {
      loginMutation.mutate(
        { email, password },
        {
          onSuccess: () => dashFor(role),
          onError: (err: unknown) => {
            const msg =
              err instanceof Error ? err.message : "Credenciais inválidas";
            setError(msg);
          },
        }
      );
    } else {
      registerMutation.mutate(
        { email, password, role },
        {
          onSuccess: () => {
            if (role === "pme") {
              setStep("kyc");
            } else {
              dashFor(role);
            }
          },
          onError: (err: unknown) => {
            const msg =
              err instanceof Error ? err.message : "Erro ao criar conta";
            setError(msg);
          },
        }
      );
    }
  }, [mode, email, password, role, loginMutation, registerMutation, dashFor]);

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
            {mode === "login" ? (
              <>
                Novo na CredBridge?{" "}
                <button
                  className="appnav-link t-blue"
                  style={{ display: "inline", padding: 0 }}
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  className="appnav-link t-blue"
                  style={{ display: "inline", padding: 0 }}
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Entrar
                </button>
              </>
            )}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push("/")}
          >
            Voltar
          </button>
        </div>

        <div style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}>
          <h2 style={{ fontSize: 32, marginBottom: 8 }}>
            {mode === "login" ? t("login_title") : "Criar conta"}
          </h2>
          <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
            {mode === "login" ? t("login_sub") : "Escolha seu perfil para começar."}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className="field-label">{t("login_password")}</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                </div>
              </div>

              {error && (
                <p
                  style={{
                    color: "var(--red)",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={handleSubmit}
                disabled={isPending || !email || !password}
              >
                {isPending
                  ? "Aguarde…"
                  : (
                    <>
                      {mode === "login" ? t("login_continue") : "Criar conta"}{" "}
                      <Icon name="arrow_right" size={16} />
                    </>
                  )}
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

          {step === "kyc" && <KycFlow onDone={() => dashFor(role)} />}
        </div>
      </div>
    </div>
  );
}
