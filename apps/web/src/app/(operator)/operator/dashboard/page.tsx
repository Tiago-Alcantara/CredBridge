"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { fmtBRL } from "@/lib/format";
import type { Receivable } from "@credbridge/types";
import {
  usePendingReceivables,
  useApproveReceivable,
  useRejectReceivable,
  usePendingTransactions,
  useApproveTransaction,
  useAdminUsers,
  useCreateDeposit,
} from "@/lib/api/admin";
import { useToast } from "@/providers/ToastProvider";
import { usePoolStatus, useInvestorShares } from "@/lib/api/pool";
import { useActiveCollections } from "@/lib/api/collections";

interface AdminReceivable extends Receivable {
  user?: {
    id: string;
    companyName?: string;
    email?: string;
  };
}

const stellarExpertContractBaseUrl = "https://stellar.expert/explorer/testnet/contract";

export default function OperatorDashboardPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "dashboard";

  const poolTabActive = activeTab === "pool-status";
  const { data: poolStatus, isFetching: poolFetching, isError: poolError, refetch: refetchPool } = usePoolStatus(poolTabActive);
  const [investorAddress, setInvestorAddress] = useState("");
  const { data: investorShares, isFetching: sharesFetching, isError: sharesError, refetch: refetchShares } = useInvestorShares(investorAddress.trim());

  const { data: rawReceivables = [], isLoading: loadingReceivables } = usePendingReceivables();
  const receivables = rawReceivables as AdminReceivable[];
  const { data: transactions = [], isLoading: loadingTransactions } = usePendingTransactions();
  const { data: users = [] } = useAdminUsers();
  const { data: collections = [], isLoading: loadingCollections, refetch: refetchCollections } = useActiveCollections();

  const approveReceivableMut = useApproveReceivable();
  const rejectReceivableMut = useRejectReceivable();
  const approveTransactionMut = useApproveTransaction();
  const createDepositMut = useCreateDeposit();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingReceivable, setViewingReceivable] = useState<AdminReceivable | null>(null);
  const [createDepositOpen, setCreateDepositOpen] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [creatingDeposit, setCreatingDeposit] = useState(false);

  const handleApproveReceivable = async (id: string) => {
    try {
      setProcessingId(id);
      await approveReceivableMut.mutateAsync(id);
      showToast("NF-e validada e disponibilizada com sucesso!", "success");
      setViewingReceivable(null);
    } catch {
      showToast("Erro ao aprovar recebível.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectReceivable = async (id: string) => {
    try {
      setProcessingId(id);
      await rejectReceivableMut.mutateAsync(id);
      showToast("Recebível recusado com sucesso.", "success");
      setViewingReceivable(null);
    } catch {
      showToast("Erro ao recusar recebível.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveTransaction = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      setProcessingId(id);
      await approveTransactionMut.mutateAsync({ id, status });
      if (status === "APPROVED") {
        showToast("Transação aprovada e liquidada on-chain via Stellar!", "success");
      } else {
        showToast("Transação rejeitada com sucesso.", "success");
      }
    } catch {
      showToast("Falha ao processar ação de pool.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestorId || !depositAmount) {
      showToast("Selecione um investidor e defina o valor.", "error");
      return;
    }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Insira um valor numérico válido maior que zero.", "error");
      return;
    }

    try {
      setCreatingDeposit(true);
      await createDepositMut.mutateAsync({ userId: selectedInvestorId, amount });
      showToast("Ordem de depósito criada com sucesso para o investidor!", "success");
      setCreateDepositOpen(false);
      setSelectedInvestorId("");
      setDepositAmount("");
    } catch {
      showToast("Falha ao criar ordem de depósito.", "error");
    } finally {
      setCreatingDeposit(false);
    }
  };

  const setTab = (tab: string) => {
    router.push(`/operator/dashboard?tab=${tab}`);
  };

  return (
    <>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Mesa Operacional</div>
          <h2 style={{ fontSize: 32 }}>Painel de Operações</h2>
        </div>
      </div>

      {/* Overview tab */}
      {activeTab === "dashboard" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div className="card violet-hi" style={{ padding: 32 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Volume Pendente</div>
              <div className="kpi kpi-lg num">
                {fmtBRL(
                  receivables.reduce((acc, r) => acc + r.value, 0) +
                  transactions.reduce((acc, t) => acc + t.amount, 0)
                )}
              </div>
              <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12.5 }}>
                <span className="t-2">Aguardando ações manuais do operador</span>
              </div>
            </div>
            <MiniKpi
              label="NF-es Pendentes"
              value={receivables.length.toString()}
              sub="Aguardando validação SEFAZ"
              color="#00D4FF"
              icon="doc"
            />
            <MiniKpi
              label="Aprovações de Pool"
              value={transactions.length.toString()}
              sub="Aguardando liquidação on-chain"
              color="#00FF94"
              icon="zap"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Quick Actions Receivables */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>NF-es aguardando Validação</h3>
              <p className="t-3" style={{ marginBottom: 24 }}>
                Valide notas fiscais eletrônicas de recebíveis submetidos por PMEs para tokenização na plataforma.
              </p>
              <button className="btn btn-primary" onClick={() => setTab("receivables")}>
                Acessar Mesa de Validação <Icon name="arrow_right" size={14} />
              </button>
            </div>

            {/* Quick Actions Transactions */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Depósitos e Saques Pendentes</h3>
              <p className="t-3" style={{ marginBottom: 24 }}>
                Concilie e liquide transações financeiras on-chain diretamente no contrato de Liquidity Pool Stellar.
              </p>
              <button className="btn btn-violet" onClick={() => setTab("transactions")}>
                Acessar Conciliação On-Chain <Icon name="arrow_right" size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Receivables Tab */}
      {activeTab === "receivables" && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <h3>Validação de Recebíveis (NF-e)</h3>
            <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              {loadingReceivables ? "Carregando…" : `${receivables.length} recebíveis pendentes de validação`}
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                  <th style={{ padding: "12px 24px" }}>PME Solicitante</th>
                  <th style={{ padding: "12px 24px" }}>Sacado (Devedor)</th>
                  <th style={{ padding: "12px 24px" }}>Valor</th>
                  <th style={{ padding: "12px 24px" }}>Data de Vencimento</th>
                  <th style={{ padding: "12px 24px", textAlign: "right" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {receivables.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center" }} className="t-3">
                      Nenhum recebível aguardando validação no momento.
                    </td>
                  </tr>
                ) : (
                  receivables.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line-2)" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontWeight: 600 }}>{r.user?.companyName ?? "PME"}</div>
                        <div className="t-3" style={{ fontSize: 12 }}>{r.user?.email}</div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div>{r.debtorName}</div>
                        <div className="t-3" style={{ fontSize: 12 }}>CNPJ: {r.debtorDocument}</div>
                      </td>
                      <td style={{ padding: "16px 24px", fontWeight: 600 }}>
                        {fmtBRL(r.value)}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        {new Date(r.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setViewingReceivable(r)}
                        >
                          Ver nota
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3>Conciliação e Aprovações de Pool (On-Chain)</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
                {loadingTransactions ? "Carregando…" : `${transactions.length} transações aguardando assinatura e envio on-chain`}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setCreateDepositOpen(true)}
            >
              <Icon name="plus" size={14} /> Novo Depósito
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                  <th style={{ padding: "12px 24px" }}>Usuário</th>
                  <th style={{ padding: "12px 24px" }}>Tipo</th>
                  <th style={{ padding: "12px 24px" }}>Valor</th>
                  <th style={{ padding: "12px 24px" }}>Data</th>
                  <th style={{ padding: "12px 24px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center" }} className="t-3">
                      Nenhuma transação de pool aguardando aprovação no momento.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--line-2)" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontWeight: 600 }}>{t.user?.name}</div>
                        <div className="t-3" style={{ fontSize: 12 }}>{t.user?.email}</div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span
                          className="eyebrow"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            background: t.type === "DEPOSIT" ? "rgba(0, 255, 148, 0.1)" : "rgba(255, 68, 68, 0.1)",
                            color: t.type === "DEPOSIT" ? "#00FF94" : "var(--red)",
                          }}
                        >
                          {t.type === "DEPOSIT" ? "DEPÓSITO" : "SAQUE"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", fontWeight: 600 }}>
                        {fmtBRL(t.amount)}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div className="row end" style={{ gap: 8 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={processingId === t.id}
                            onClick={() => handleApproveTransaction(t.id, "REJECTED")}
                          >
                            Rejeitar
                          </button>
                          <button
                            className="btn btn-violet btn-sm"
                            disabled={processingId === t.id}
                            onClick={() => handleApproveTransaction(t.id, "APPROVED")}
                          >
                            {processingId === t.id ? "Enviando Stellar..." : "Aprovar Pool"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pool Status Tab */}
      {activeTab === "pool-status" && (
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 20 }}>
            <div>
              <h3>Situação da pool</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>Dados lidos diretamente do contrato na Stellar testnet.</p>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={poolFetching} onClick={() => refetchPool()}>
              <Icon name="zap" size={14} /> {poolFetching ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {poolError ? (
            <div className="t-3" style={{ padding: 24, textAlign: "center", color: "var(--red)" }}>Falha ao ler o estado da pool on-chain.</div>
          ) : !poolStatus ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
                <MiniKpi label="NAV (patrimônio)" value={fmtBRL(poolStatus.nav.value)} sub="Caixa + principal aplicado" color="#00D4FF" icon="wallet" />
                <MiniKpi label="Total de cotas" value={poolStatus.totalShares.value.toLocaleString("pt-BR")} sub="CBPOOL mintadas" color="#7B2FFF" icon="box" />
                <MiniKpi label="Preço da cota" value={`${poolStatus.sharePrice.value.toFixed(4)} BRLT`} sub="NAV / total de cotas" color="#00FF94" icon="chart" />
                <MiniKpi label="Caixa BRLT" value={fmtBRL(poolStatus.cashBalance.value)} sub="Disponível na pool" color="#00D4FF" icon="wallet" />
                <MiniKpi label="Principal aplicado" value={fmtBRL(poolStatus.totalPrincipal.value)} sub="Em invoices ativas" color="#FFB020" icon="doc" />
                <MiniKpi label="Status" value={poolStatus.paused ? "Pausada" : "Ativa"} sub={poolStatus.paused ? "Operações bloqueadas" : "Operando normalmente"} color={poolStatus.paused ? "#FF5577" : "#00FF94"} icon="shield" />
              </div>

              <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 20, marginBottom: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Cotas por investidor</div>
                <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <input type="text" className="input" placeholder="Endereço Stellar (G...)" value={investorAddress} onChange={(e) => setInvestorAddress(e.target.value)} style={{ flex: 1, minWidth: 280, padding: 10, background: "var(--surface)", border: "1px solid var(--line)", fontFamily: "monospace", fontSize: 13 }} />
                  <button className="btn btn-violet btn-sm" disabled={sharesFetching || investorAddress.trim().length < 56} onClick={() => refetchShares()}>{sharesFetching ? "Buscando..." : "Buscar"}</button>
                </div>
                {sharesError ? (
                  <div className="t-3" style={{ color: "var(--red)", fontSize: 13 }}>Falha ao buscar cotas (endereço válido?).</div>
                ) : investorShares ? (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Cotas</div>
                      <div className="kpi num" style={{ fontSize: 24 }}>{investorShares.shares.value.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Valor estimado</div>
                      <div className="kpi num" style={{ fontSize: 24 }}>{fmtBRL(investorShares.estimatedValueBrl)}</div>
                    </div>
                    <a className="btn btn-ghost btn-sm" href={`https://stellar.expert/explorer/testnet/account/${investorShares.address}`} rel="noreferrer" target="_blank" style={{ gridColumn: "1 / -1", justifySelf: "start" }}>Ver no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Contrato da Pool</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.poolContractId}</div>
                  <a className="btn btn-violet btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.poolContractId}`} rel="noreferrer" target="_blank">Ver Pool no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Token BRLT</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.brltTokenId}</div>
                  <a className="btn btn-ghost btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.brltTokenId}`} rel="noreferrer" target="_blank">Ver BRLT no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Token de cotas (CBPOOL)</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.shareTokenId}</div>
                  <a className="btn btn-ghost btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.shareTokenId}`} rel="noreferrer" target="_blank">Ver CBPOOL no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cobranças Tab */}
      {activeTab === "cobrancas" && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3>Cobranças de Sacados Ativas</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
                {loadingCollections ? "Carregando…" : `${collections.length} cobranças no sistema`}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => refetchCollections()} disabled={loadingCollections}>
              <Icon name="refresh" size={14} className={loadingCollections ? "spinning" : undefined} /> {loadingCollections ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                  <th style={{ padding: "12px 24px" }}>Sacado (Devedor)</th>
                  <th style={{ padding: "12px 24px" }}>Valor</th>
                  <th style={{ padding: "12px 24px" }}>Vencimento</th>
                  <th style={{ padding: "12px 24px" }}>Status</th>
                  <th style={{ padding: "12px 24px" }}>Dados Pix</th>
                </tr>
              </thead>
              <tbody>
                {collections.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center" }} className="t-3">
                      Nenhuma cobrança registrada no sistema.
                    </td>
                  </tr>
                ) : (
                  collections.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--line-2)" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontWeight: 600 }}>{c.debtorName}</div>
                        <div className="t-3" style={{ fontSize: 12 }}>CNPJ: {c.debtorDocument}</div>
                      </td>
                      <td style={{ padding: "16px 24px", fontWeight: 600 }}>
                        {fmtBRL(c.amount)}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        {new Date(c.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span
                          className="eyebrow"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            background:
                              c.status === "paid"
                                ? "rgba(0, 255, 148, 0.1)"
                                : c.status === "pending"
                                ? "rgba(255, 200, 87, 0.1)"
                                : "rgba(255, 255, 255, 0.1)",
                            color:
                              c.status === "paid"
                                ? "#00FF94"
                                : c.status === "pending"
                                ? "#FFC857"
                                : "var(--fg-2)",
                          }}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 12.5 }}>
                        {c.status === "paid" ? (
                          <div className="mono" style={{ wordBreak: "break-all", maxWidth: 300 }}>
                            <span className="t-3">TxHash:</span> {c.txHash || "N/A"}
                          </div>
                        ) : (
                          <div className="mono" style={{ wordBreak: "break-all", maxWidth: 300, color: "var(--fg-2)" }}>
                            <span className="t-3">Payload:</span> {c.pixQrCodePayload ? `${c.pixQrCodePayload.slice(0, 30)}...` : "Pendente"}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Configurações Operacionais</h3>
          <p className="t-3" style={{ marginBottom: 24 }}>
            Configurações e parâmetros administrativos da CredBridge.
          </p>
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Endereço do Contrato Liquidity Pool (Stellar)
              </label>
              <input
                type="text"
                className="input"
                style={{ width: "100%", padding: 10, background: "var(--surface)", border: "1px solid var(--line)" }}
                defaultValue="CACBR...LIQPOOL"
                readOnly
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Status Operacional da Rede
              </label>
              <div className="row" style={{ gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#00FF94",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 13 }}>Stellar Testnet Conectada e Estável</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Detalhes da Nota Fiscal */}
      {viewingReceivable && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              padding: 0,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span className="eyebrow" style={{ color: "#00D4FF", marginBottom: 4 }}>
                  Mesa de Validação SEFAZ
                </span>
                <h3 style={{ fontSize: 20 }}>Detalhes da NF-e</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setViewingReceivable(null)}
                style={{ padding: 4 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* PME info */}
              <div>
                <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>
                  Emitente (PME)
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {viewingReceivable.user?.companyName ?? "PME Solicitante"}
                </div>
                <div className="t-3" style={{ fontSize: 13, marginTop: 2 }}>
                  {viewingReceivable.user?.email}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Debtor info */}
                <div>
                  <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>
                    Sacado (Devedor)
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{viewingReceivable.debtorName}</div>
                  <div className="t-3" style={{ fontSize: 12.5, marginTop: 2 }}>
                    CNPJ: {viewingReceivable.debtorDocument}
                  </div>
                </div>

                {/* Financial values */}
                <div>
                  <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>
                    Valor e Vencimento
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg)" }}>
                    {fmtBRL(viewingReceivable.value)}
                  </div>
                  <div className="t-3" style={{ fontSize: 12.5, marginTop: 2 }}>
                    Vence em: {new Date(viewingReceivable.dueDate).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>

              {/* Hash and files */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8, opacity: 0.6 }}>
                  Dados de Segurança da Nota
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
                  <span className="t-3">Chave de Acesso / Hash:</span>{" "}
                  <span style={{ color: "#00FF94" }}>
                    {viewingReceivable.documentHash ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                  </span>
                </div>
                {viewingReceivable.txHash && (
                  <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all", marginTop: 8 }}>
                    <span className="t-3">Hash Stellar:</span> {viewingReceivable.txHash}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "24px 32px",
                background: "var(--bg)",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => handleRejectReceivable(viewingReceivable.id)}
                disabled={processingId === viewingReceivable.id}
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                {processingId === viewingReceivable.id ? "Processando..." : "Recusar"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleApproveReceivable(viewingReceivable.id)}
                disabled={processingId === viewingReceivable.id}
              >
                {processingId === viewingReceivable.id ? "Aprovando..." : "Confirmar Validação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Criar Ordem de Depósito */}
      {createDepositOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <form
            onSubmit={handleCreateDeposit}
            className="card"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 0,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span className="eyebrow" style={{ color: "var(--accent)", marginBottom: 4 }}>
                  Tesouraria CredBridge
                </span>
                <h3 style={{ fontSize: 20 }}>Nova Ordem de Depósito</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCreateDepositOpen(false)}
                style={{ padding: 4 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="col" style={{ gap: 6 }}>
                <label className="eyebrow">Investidor Destinatário</label>
                <select
                  className="input"
                  style={{ width: "100%" }}
                  value={selectedInvestorId}
                  onChange={(e) => setSelectedInvestorId(e.target.value)}
                  required
                >
                  <option value="">Selecione um investidor...</option>
                  {users.filter((u) => u.role === "investor").map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col" style={{ gap: 6 }}>
                <label className="eyebrow">Valor da Ordem (BRL)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="input"
                  placeholder="0,00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "24px 32px",
                background: "var(--bg)",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCreateDepositOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingDeposit || !selectedInvestorId || !depositAmount}
              >
                {creatingDeposit ? "Criando..." : "Criar Ordem"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
