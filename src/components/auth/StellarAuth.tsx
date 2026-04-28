"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/primitives/Icon";

type Phase = "ready" | "signing" | "done";

interface StellarAuthProps {
  onDone: () => void;
  onBack: () => void;
}

export function StellarAuth({ onDone, onBack }: StellarAuthProps) {
  const [phase, setPhase] = useState<Phase>("ready");

  useEffect(() => {
    if (phase === "signing") {
      const id = setTimeout(() => setPhase("done"), 2200);
      return () => clearTimeout(id);
    }
    if (phase === "done") {
      const id = setTimeout(onDone, 900);
      return () => clearTimeout(id);
    }
  }, [phase, onDone]);

  return (
    <div>
      <div className="card violet-hi" style={{ padding: 28, textAlign: "center" }}>
        <div
          style={{
            margin: "8px auto 20px",
            width: 88,
            height: 88,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1px solid rgba(123,47,255,0.4)",
              animation:
                phase === "signing"
                  ? "glowPulse 1.4s ease-in-out infinite"
                  : "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: "50%",
              border: "1px dashed rgba(123,47,255,0.35)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--violet), var(--blue))",
              display: "grid",
              placeItems: "center",
              color: "#fff",
            }}
          >
            {phase === "done" ? (
              <Icon name="check" size={32} />
            ) : (
              <Icon name="chain" size={32} />
            )}
          </div>
        </div>

        <h3 style={{ fontSize: 22 }}>
          {phase === "ready" && "Assine com Stellar Auth"}
          {phase === "signing" && "Aguardando assinatura…"}
          {phase === "done" && "Assinatura confirmada"}
        </h3>
        <p
          className="t-2"
          style={{
            marginTop: 8,
            fontSize: 13.5,
            lineHeight: 1.5,
            maxWidth: 360,
            marginInline: "auto",
          }}
        >
          Sua carteira assinará um challenge SEP-10 para provar a titularidade
          da conta. Nenhum fundo sai da carteira.
        </p>

        <div
          className="card"
          style={{
            marginTop: 24,
            padding: 12,
            background: "var(--code-bg)",
            color: "#F5F6FB",
            textAlign: "left",
          }}
        >
          <div className="row between" style={{ fontSize: 11 }}>
            <span className="t-3">SEP-10 · Carteira</span>
            <span className="mono t-2">Freighter</span>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11.5,
              color: "var(--fg-2)",
              marginTop: 6,
              wordBreak: "break-all",
            }}
          >
            GDCH7Q4XJBZ...FQT9M4{" "}
            <span style={{ color: "var(--green)" }}>✓</span>
          </div>
        </div>
      </div>

      {phase === "ready" && (
        <div className="col" style={{ gap: 10, marginTop: 16 }}>
          <button
            className="btn btn-violet btn-lg"
            style={{ width: "100%" }}
            onClick={() => setPhase("signing")}
          >
            Assinar challenge <Icon name="chain" size={16} />
          </button>
          <button className="appnav-link" style={{ width: "100%" }} onClick={onBack}>
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
