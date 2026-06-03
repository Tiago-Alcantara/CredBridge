"use client";

import { useState, useEffect } from "react";
import { useMe, useUpdateMe, useUpdatePassword } from "@/lib/api/me";
import type { UpdateProfileInput } from "@/lib/api/me";
import { getTokenRole } from "@/lib/api/auth-storage";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useToast } from "@/providers/ToastProvider";
import { Skeleton } from "@/components/primitives/Skeleton";

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const SECTORS = [
  { value: "tecnologia", label: "Tecnologia" },
  { value: "varejo", label: "Varejo" },
  { value: "industria", label: "Indústria" },
  { value: "servicos", label: "Serviços" },
  { value: "agronegocio", label: "Agronegócio" },
  { value: "saude", label: "Saúde" },
  { value: "construcao", label: "Construção" },
  { value: "transporte", label: "Transporte" },
  { value: "educacao", label: "Educação" },
  { value: "financeiro", label: "Financeiro" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--bg-2)",
  color: "var(--fg)",
  font: "inherit",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--fg-2)",
  marginBottom: 6,
  fontFamily: "var(--sans)",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 20,
  paddingBottom: 12,
  borderBottom: "1px solid var(--line)",
};

export function AccountSettings() {
  const { data: me, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const updatePassword = useUpdatePassword();
  const { showToast } = useToast();
  const role = getTokenRole();

  // Profile section state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // PME section state
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [sector, setSector] = useState("");

  // Investor section state
  const [investorType, setInvestorType] = useState("");
  const [riskProfile, setRiskProfile] = useState("");
  const [operationalLimit, setOperationalLimit] = useState("");

  // Password section state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Populate form from API data
  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setAddress(me.address ?? "");
    setCompanyName(me.companyName ?? "");
    setCnpj(me.cnpj ?? "");
    setMonthlyRevenue(me.monthlyRevenue != null ? String(me.monthlyRevenue) : "");
    setSector(me.sector ?? "");
    setInvestorType(me.investorType ?? "");
    setRiskProfile(me.riskProfile ?? "");
    setOperationalLimit(me.operationalLimit != null ? String(me.operationalLimit) : "");
  }, [me]);

  function buildProfilePayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (name.trim()) payload.name = name.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (address.trim()) payload.address = address.trim();
    return payload;
  }

  function buildPmePayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (companyName.trim()) payload.companyName = companyName.trim();
    if (cnpj.trim()) payload.cnpj = cnpj.trim();
    if (monthlyRevenue) payload.monthlyRevenue = parseFloat(monthlyRevenue);
    if (sector) payload.sector = sector;
    return payload;
  }

  function buildInvestorPayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (investorType) payload.investorType = investorType;
    if (riskProfile) payload.riskProfile = riskProfile;
    if (operationalLimit) payload.operationalLimit = parseFloat(operationalLimit);
    return payload;
  }

  function handleSaveProfile() {
    updateMe.mutate(buildProfilePayload(), {
      onSuccess: () => showToast("Perfil salvo", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleSavePme() {
    updateMe.mutate(buildPmePayload(), {
      onSuccess: () => showToast("Dados da empresa salvos", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleSaveInvestor() {
    updateMe.mutate(buildInvestorPayload(), {
      onSuccess: () => showToast("Perfil de investidor salvo", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleChangePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    updatePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          showToast("Senha atualizada", "success");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => {
          const msg = extractApiErrorMessage(err);
          setPasswordError(msg);
        },
      },
    );
  }

  async function handleCopyWalletInfo(fieldName: string, value: string | null | undefined) {
    if (!value?.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopiedWalletField(fieldName);
    setTimeout(() => setCopiedWalletField(null), 2000);
  }

  function renderWalletInfoRow(
    label: string,
    value: string,
    copyValue?: string | null,
  ) {
    const canCopy = Boolean(copyValue?.trim());
    return (
      <div
        key={label}
        className="grid-form-row"
        style={{
          padding: "12px 0",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{label}</span>
        <code style={walletInfoValueStyle}>{value}</code>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={!canCopy}
          onClick={() => handleCopyWalletInfo(label, copyValue)}
          style={{ justifySelf: "end", fontSize: 12 }}
        >
          {copiedWalletField === label ? "Copiado" : "Copiar"}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: 32 }}>
            <Skeleton height={20} width={160} style={{ marginBottom: 24 }} />
            <div className="grid-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j}>
                  <Skeleton height={12} width={80} style={{ marginBottom: 8 }} />
                  <Skeleton height={40} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: 28, marginBottom: 4 }}>Configurações</h2>
      <p className="t-2" style={{ fontSize: 13, marginTop: 0 }}>Gerencie suas informações de conta.</p>

      {/* Perfil */}
      <div className="card" style={{ padding: 32 }}>
        <p style={sectionTitleStyle}>Perfil</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-2">
            <div style={fieldStyle}>
              <label style={labelStyle}>Nome</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input style={disabledInputStyle} value={me?.email ?? ""} disabled />
            </div>
          </div>
          <div className="grid-2">
            <div style={fieldStyle}>
              <label style={labelStyle}>Telefone</label>
              <input
                style={inputStyle}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Endereço</label>
              <input
                style={inputStyle}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, cidade"
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={updateMe.isPending}
            >
              {updateMe.isPending ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </div>
      </div>

      {/* PME — Empresa */}
      {role === "pme" && (
        <div className="card" style={{ padding: 32 }}>
          <p style={sectionTitleStyle}>Empresa</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2">
              <div style={fieldStyle}>
                <label style={labelStyle}>Razão Social</label>
                <input
                  style={inputStyle}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>CNPJ</label>
                <input
                  style={inputStyle}
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>
            <div className="grid-2">
              <div style={fieldStyle}>
                <label style={labelStyle}>Faturamento Mensal (R$)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Setor</label>
                <select
                  style={inputStyle}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handleSavePme}
                disabled={updateMe.isPending}
              >
                {updateMe.isPending ? "Salvando…" : "Salvar empresa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investor */}
      {role === "investor" && (
        <div className="card" style={{ padding: 32 }}>
          <p style={sectionTitleStyle}>Perfil de Investidor</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2">
              <div style={fieldStyle}>
                <label style={labelStyle}>Tipo</label>
                <select
                  style={inputStyle}
                  value={investorType}
                  onChange={(e) => setInvestorType(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Perfil de Risco</label>
                <select
                  style={inputStyle}
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="conservador">Conservador</option>
                  <option value="moderado">Moderado</option>
                  <option value="arrojado">Arrojado</option>
                </select>
              </div>
            </div>
            <div style={{ maxWidth: "calc(50% - 8px)" }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Limite Operacional (R$)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={operationalLimit}
                  onChange={(e) => setOperationalLimit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveInvestor}
                disabled={updateMe.isPending}
              >
                {updateMe.isPending ? "Salvando…" : "Salvar perfil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segurança */}
      <div className="card" style={{ padding: 32 }}>
        <p style={sectionTitleStyle}>Segurança</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ maxWidth: "calc(50% - 8px)" }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Senha Atual</label>
              <input
                style={inputStyle}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="grid-2">
            <div style={fieldStyle}>
              <label style={labelStyle}>Nova Senha</label>
              <input
                style={inputStyle}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirmar Nova Senha</label>
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          {passwordError && (
            <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{passwordError}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={updatePassword.isPending}
            >
              {updatePassword.isPending ? "Alterando…" : "Alterar senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
