"use client";

import { useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface KycFlowProps {
  onDone: () => void;
}

type DocStatus = "ok" | "pending";

interface DocItem {
  id: string;
  label: string;
  st: DocStatus;
}

const docs: DocItem[] = [
  { id: "contrato", label: "Contrato social", st: "ok" },
  { id: "cnh", label: "Documento do responsável", st: "ok" },
  { id: "endereco", label: "Comprovante de endereço", st: "pending" },
  { id: "balanco", label: "Último balanço", st: "pending" },
];

export function KycFlow({ onDone }: KycFlowProps) {
  const { t } = useTranslation("pt");
  const [step, setStep] = useState(0);

  const stepKeys = ["kyc_step_1", "kyc_step_2", "kyc_step_3", "kyc_step_4"] as const;
  type StepKey = (typeof stepKeys)[number];
  const steps = stepKeys.map((k) => t(k as StepKey));

  return (
    <div>
      {/* Stepper */}
      <div className="row" style={{ gap: 0, marginBottom: 28 }}>
        {steps.map((s, i) => (
          <div key={stepKeys[i]} style={{ display: "contents" }}>
            <div className="row" style={{ gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: i <= step ? "var(--blue)" : "var(--surface)",
                  border: `1px solid ${i <= step ? "var(--blue)" : "var(--line-2)"}`,
                  color: i <= step ? "#04101A" : "var(--fg-2)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {i < step ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: i <= step ? "var(--fg)" : "var(--fg-3)",
                  fontFamily: "var(--sans)",
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: i < step ? "var(--blue)" : "var(--line)",
                  margin: "0 10px",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24 }}>
        {step === 0 && (
          <div className="col" style={{ gap: 14 }}>
            <div>
              <label className="field-label">Nome completo</label>
              <input
                className="input"
                placeholder="Luciana Martins Ribeiro"
                defaultValue="Luciana Martins Ribeiro"
              />
            </div>
            <div>
              <label className="field-label">CPF</label>
              <input
                className="input"
                placeholder="000.000.000-00"
                defaultValue="318.442.907-55"
              />
            </div>
            <div>
              <label className="field-label">Telefone</label>
              <input
                className="input"
                placeholder="+55 (11) 00000-0000"
                defaultValue="+55 (11) 98421-7720"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="col" style={{ gap: 14 }}>
            <div>
              <label className="field-label">Razão social</label>
              <input
                className="input"
                defaultValue="Tecelagem Ribeiro Indústria Ltda."
              />
            </div>
            <div>
              <label className="field-label">CNPJ</label>
              <input className="input" defaultValue="42.317.854/0001-28" />
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div>
                <label className="field-label">Faturamento mensal</label>
                <select className="input">
                  <option>R$ 500k – 2M</option>
                  <option>R$ 2M – 10M</option>
                </select>
              </div>
              <div>
                <label className="field-label">Setor</label>
                <select className="input">
                  <option>Indústria</option>
                  <option>Comércio</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="col" style={{ gap: 12 }}>
            {docs.map((d) => (
              <div
                key={d.id}
                className="row between"
                style={{
                  padding: "14px 16px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <Icon name="doc" size={18} className="t-2" />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{d.label}</span>
                </div>
                {d.st === "ok" && (
                  <span className="badge completed">Enviado</span>
                )}
                {d.st === "pending" && (
                  <button className="btn btn-ghost btn-sm">
                    <Icon name="upload" size={12} /> Enviar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--green-soft)",
                color: "var(--green)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Icon name="check" size={36} />
            </div>
            <h3>Análise aprovada</h3>
            <p
              className="t-2"
              style={{
                marginTop: 8,
                fontSize: 13.5,
                maxWidth: 340,
                marginInline: "auto",
              }}
            >
              Sua empresa foi aprovada. Você já pode antecipar suas primeiras
              NF-e.
            </p>
          </div>
        )}
      </div>

      <div className="row between" style={{ marginTop: 20 }}>
        <button
          className="btn btn-ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          style={{ opacity: step === 0 ? 0.4 : 1 }}
        >
          Voltar
        </button>
        {step < steps.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setStep(step + 1)}
          >
            Continuar <Icon name="arrow_right" size={14} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onDone}>
            Ir para painel <Icon name="arrow_right" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
