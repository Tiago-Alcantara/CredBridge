"use client";

import { useRouter } from "next/navigation";
import { LoginBG } from "@/components/auth/LoginBG";
import { PrivyLoginPanel } from "@/components/auth/PrivyLoginPanel";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";

export default function LoginPage() {
  const router = useRouter();

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
            Login e carteira protegidos pela Privy
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/")}>
            Voltar
          </button>
        </div>
        <PrivyLoginPanel />
      </div>
    </div>
  );
}
