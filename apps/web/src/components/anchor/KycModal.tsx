"use client";

import { useEffect, useRef } from "react";
import { useAnchorOnboardingStatus } from "@/lib/api/anchor";

interface KycModalProps {
  kycUrl: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export function KycModal({ kycUrl, onComplete, onDismiss }: KycModalProps) {
  const completedRef = useRef(false);
  const initialOnboarded = useRef<boolean | null>(null);
  const { data } = useAnchorOnboardingStatus(true);

  useEffect(() => {
    if (data === undefined) return;
    // Record the state at mount — only auto-advance on false→true transition
    if (initialOnboarded.current === null) {
      initialOnboarded.current = data.onboarded;
      return;
    }
    if (!initialOnboarded.current && data.onboarded && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [data?.onboarded, onComplete]);

  const handleManualComplete = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Verificação de identidade</span>
          <p className="t-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Complete o cadastro. O fluxo continua automaticamente quando concluído.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, flexShrink: 0, marginLeft: 12 }}
          onClick={onDismiss}
        >
          Fechar
        </button>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 500,
          borderRadius: 8,
          border: "1px solid var(--line)",
        }}
      >
        <iframe
          src={kycUrl}
          allow="camera; microphone; payment"
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Verificação Etherfuse"
        />
      </div>

      <div
        className="row"
        style={{ gap: 8, alignItems: "center", justifyContent: "center", paddingBottom: 4 }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "kycPulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span className="t-3" style={{ fontSize: 12 }}>
          Aguardando conclusão do cadastro…
        </span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, marginLeft: 8, padding: "2px 10px" }}
          onClick={handleManualComplete}
        >
          Já concluí →
        </button>
        <style>{`@keyframes kycPulse { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
      </div>
    </div>
  );
}
