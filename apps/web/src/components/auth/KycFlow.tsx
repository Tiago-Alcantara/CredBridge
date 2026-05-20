"use client";

import { useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useUpdateProfile } from "@/lib/api/auth";
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useCreateWallet } from "@/lib/api/wallet";
import { useMe } from "@/lib/api/me";

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

const MONTHLY_REVENUE_MAP: Record<string, number> = {
  "500k-2m": 1_000_000,
  "2m-10m": 6_000_000,
};

export function KycFlow({ onDone }: KycFlowProps) {
  const { t } = useTranslation("pt");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [revenueKey, setRevenueKey] = useState("500k-2m");
  const [sector, setSector] = useState("industria");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateProfile = useUpdateProfile();
  const createWallet = useCreateWallet();
  const { data: me } = useMe();

  const stepKeys = ["kyc_step_1", "kyc_step_2", "kyc_step_3", "kyc_step_4"] as const;
  type StepKey = (typeof stepKeys)[number];
  const steps = stepKeys.map((k) => t(k as StepKey));

  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync({
        name: name || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        cnpj: cnpj || undefined,
        monthlyRevenue: MONTHLY_REVENUE_MAP[revenueKey],
        sector,
      });
    } catch {
      setError("Erro ao salvar perfil. Tente novamente.");
      setIsSubmitting(false);
      return;
    }

    if (me?.email) {
      try {
        const { contractId, keyId, publicKey } = await registerAndDeployWallet(me.email);
        await createWallet.mutateAsync({ contractId, keyId, publicKey });
      } catch (err) {
        if (!(err instanceof PasskeyAbortedError)) {
          setError("Erro ao criar carteira. Você pode configurar depois no painel.");
        }
        // PasskeyAbortedError or any other error: still proceed to dashboard
      }
    }

    setIsSubmitting(false);
    onDone();
  };

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
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Telefone</label>
              <input
                className="input"
                placeholder="+55 (11) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                placeholder="Empresa Ltda."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">CNPJ</label>
              <input
                className="input"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div>
                <label className="field-label">Faturamento mensal</label>
                <select
                  className="input"
                  value={revenueKey}
                  onChange={(e) => setRevenueKey(e.target.value)}
                >
                  <option value="500k-2m">R$ 500k – 2M</option>
                  <option value="2m-10m">R$ 2M – 10M</option>
                </select>
              </div>
              <div>
                <label className="field-label">Setor</label>
                <select
                  className="input"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="industria">Indústria</option>
                  <option value="varejo">Comércio/Varejo</option>
                  <option value="tecnologia">Tecnologia</option>
                  <option value="servicos">Serviços</option>
                  <option value="agronegocio">Agronegócio</option>
                  <option value="saude">Saúde</option>
                  <option value="construcao">Construção</option>
                  <option value="transporte">Transporte</option>
                  <option value="educacao">Educação</option>
                  <option value="financeiro">Financeiro</option>
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

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div className="row between" style={{ marginTop: 20 }}>
        <button
          className="btn btn-ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || updateProfile.isPending}
          style={{ opacity: step === 0 ? 0.4 : 1 }}
        >
          Voltar
        </button>
        {step < steps.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setStep(step + 1)}
            disabled={updateProfile.isPending}
          >
            Continuar <Icon name="arrow_right" size={14} />
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleFinish}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Aguarde…" : "Ir para painel"}{" "}
            {!isSubmitting && <Icon name="arrow_right" size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
