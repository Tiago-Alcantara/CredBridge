"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LoginBG } from "@/components/auth/LoginBG";
import { KycFlow } from "@/components/auth/KycFlow";
import { useSetRole } from "@/lib/api/auth";
import { getAccessToken, getTokenRole } from "@/lib/api/auth-storage";
import { extractApiErrorMessage } from "@/lib/api/client";

type RoleKey = "pme" | "investor";
type Step = "role" | "kyc";

interface RoleOption {
  k: RoleKey;
  c: string;
  icon: IconName;
  label: string;
  desc: string;
}

export default function RoleSelectionPage() {
  const router = useRouter();
  const { t } = useTranslation("pt");
  const [role, setRole] = useState<RoleKey>("pme");
  const [step, setStep] = useState<Step>("role");
  const [error, setError] = useState<string | null>(null);
  const setRoleMutation = useSetRole();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const currentRole = getTokenRole();
    if (currentRole === "pme") router.replace("/pme/dashboard");
    else if (currentRole === "investor") router.replace("/investor/dashboard");
  }, [router]);

  const dashFor = useCallback(
    (r: RoleKey) => {
      if (r === "pme") router.push("/pme/dashboard");
      else router.push("/investor/dashboard");
    },
    [router]
  );

  const handleSubmit = useCallback(() => {
    setError(null);
    setRoleMutation.mutate(
      { role },
      {
        onSuccess: () => {
          if (role === "pme") setStep("kyc");
          else dashFor(role);
        },
        onError: (err: unknown) => {
          setError(extractApiErrorMessage(err) || "Erro ao definir perfil");
        },
      }
    );
  }, [role, setRoleMutation, dashFor]);

  const roles: RoleOption[] = [
    { k: "pme", c: "#00D4FF", icon: "box", label: t("role_pme"), desc: t("role_pme_desc") },
    { k: "investor", c: "#7B2FFF", icon: "chart", label: t("role_inv"), desc: t("role_inv_desc") },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr" }}>
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
        <div style={{ marginTop: "auto", position: "relative", maxWidth: 480 }}>
          <div className="chip" style={{ marginBottom: 24 }}>
            <span className="dot-live" />
            <span>Conta criada</span>
          </div>
          <h2 style={{ fontSize: 42, letterSpacing: "-0.03em" }}>
            Falta só escolher seu <span className="t-blue glow-blue">perfil</span>.
          </h2>
        </div>
      </div>

      <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", overflow: "auto" }}>
        <div style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}>
          <h2 style={{ fontSize: 32, marginBottom: 8 }}>Escolha seu perfil</h2>
          <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
            Selecione como você usará a CredBridge.
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
                      background: role === r.k ? `${r.c}12` : "var(--surface)",
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
                      <div style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 15 }}>{r.label}</div>
                      <div className="t-2" style={{ fontSize: 12.5 }}>
                        {r.desc}
                      </div>
                    </span>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `1.5px solid ${role === r.k ? r.c : "var(--line-2)"}`,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {role === r.k && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.c }} />
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={handleSubmit}
                disabled={setRoleMutation.isPending}
              >
                {setRoleMutation.isPending ? "Aguarde…" : (
                  <>
                    {t("login_continue")} <Icon name="arrow_right" size={16} />
                  </>
                )}
              </button>
            </>
          )}

          {step === "kyc" && <KycFlow onDone={() => dashFor(role)} />}
        </div>
      </div>
    </div>
  );
}
