"use client";

import { useRouter } from "next/navigation";
import { LoginBG } from "@/components/auth/LoginBG";
import { PrivyLoginPanel } from "@/components/auth/PrivyLoginPanel";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";

export default function OperatorLoginPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
      }}
    >
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
          <div className="chip" style={{ marginBottom: 24, background: "rgba(220, 38, 38, 0.1)", color: "rgb(239, 68, 68)" }}>
            <span className="dot-live" style={{ background: "rgb(239, 68, 68)" }} />
            <span>Painel Administrativo</span>
          </div>
          <h2 style={{ fontSize: 42, letterSpacing: "-0.03em" }}>
            Mesa de <span className="t-blue glow-blue">Operações</span> CredBridge.
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

      <div
        style={{
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div className="row between">
          <span className="t-3" style={{ fontSize: 13, color: "var(--red)" }}>
            Mesa de Controle do Operador
          </span>
        </div>
        <PrivyLoginPanel targetRole="operator" />
      </div>
    </div>
  );
}
