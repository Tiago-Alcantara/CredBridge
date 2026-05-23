"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { fmtBRL, fmtTxHash } from "@/lib/format";

type AuditTab = "PME" | "CredBridge" | "Investidor" | "Contract";
type AuditStatus = "Confirmado" | "Em monitoramento" | "Pendente";
type ContractLoadStatus = "idle" | "loading" | "success" | "error";

interface AuditRow {
  id: string;
  note: string;
  event: string;
  account: string;
  txHash: string;
  value: number;
  block: string;
  when: string;
  status: AuditStatus;
}

interface StellarContractEvent {
  id: string;
  type: "contract" | "system";
  ledger: number;
  ledgerClosedAt?: string;
  contractId?: string;
  topic: unknown[];
  value: unknown;
  txHash: string;
  cursor: string;
}

interface StellarContractResponse {
  contractId: string;
  network: string;
  rpcUrl: string;
  explorerUrl: string;
  latestLedger?: number;
  found: boolean;
  instance?: {
    lastModifiedLedgerSeq: number;
    liveUntilLedgerSeq?: number;
  } | null;
  events: StellarContractEvent[];
  eventError?: string | null;
  eventLedgerRange?: {
    from: number;
    to: number;
  };
  fetchedAt: string;
  error?: string;
}

const tabs: AuditTab[] = ["PME", "CredBridge", "Investidor", "Contract"];
const CONTRACT_ID = "CDIMUPT2SBPGBR5DHFVQ3HK74DHL4TMVCQIXINJYV2SRHXRYUYQRBVC7";

const auditRows: Record<AuditTab, AuditRow[]> = {
  PME: [
    {
      id: "pme-001",
      note: "NF-2409-018",
      event: "Nota enviada para validacao",
      account: "GCPME7GHTM4D2S8QF6NR9VXL2A4WZBRL77K9M2HDPXQ4S9P2Q7HY",
      txHash: "0x7f2a3b91c8d44f21b7a03d98c551e90ac44e24fd6b9c18a5586f4c91e3a7d204",
      value: 184200,
      block: "5,913,204",
      when: "18 mai 2026, 09:42",
      status: "Confirmado",
    },
    {
      id: "pme-002",
      note: "NF-2409-021",
      event: "Documento fiscal vinculado",
      account: "GCPME5YQ8AR2K7MVD3PLK92NCB64TQWZRA8P2L5KHDM3VQ74FNA2",
      txHash: "0x912e73b601ca15da04bd30ee46a1c2b69871a0679f1f295d889a0f4e22b6cc18",
      value: 96750,
      block: "5,913,188",
      when: "18 mai 2026, 09:18",
      status: "Em monitoramento",
    },
    {
      id: "pme-003",
      note: "NF-2408-112",
      event: "Assinatura da PME registrada",
      account: "GCPME3LQPN3J9WV6XA2K8TNHR4EDYMFZC55V7P6ACJZQ4L2TRS91",
      txHash: "0xe10a451e51bc78ee8a6f271443c30952d77752080be6a216dbf0cc056087ab14",
      value: 242900,
      block: "5,912,944",
      when: "17 mai 2026, 16:07",
      status: "Confirmado",
    },
  ],
  CredBridge: [
    {
      id: "cb-001",
      note: "NF-2409-018",
      event: "Validacao antifraude aprovada",
      account: "GCBRIDGE8QW7PXF4R2Z7HE2ALMNP5G6KQYVSN3H9DLW8C4AE2TQF9",
      txHash: "0xad01659188f4c3e44a99ba3275c7eb0d05f3aa39b589a946a3b9cb5922c09872",
      value: 184200,
      block: "5,913,233",
      when: "18 mai 2026, 10:11",
      status: "Confirmado",
    },
    {
      id: "cb-002",
      note: "NF-2409-021",
      event: "Oraculo fiscal em verificacao",
      account: "GCBRIDGE2WMS9N6C84TJLQ7ZVY4N2PBXRS5DHKQG3LV9A7FN4E2",
      txHash: "0x694fbd7456a45a7b81d6ed41233d120f0470e109b86c0d343af6328f638ae7c5",
      value: 96750,
      block: "5,913,196",
      when: "18 mai 2026, 09:27",
      status: "Em monitoramento",
    },
    {
      id: "cb-003",
      note: "NF-2408-112",
      event: "Pool de recebiveis atualizado",
      account: "GCBRIDGEM8K54TAE3RZ9PHQX7N2CVLDY8Q4WSK6AFJ3YB9PV2H",
      txHash: "0x4439d5723c114be1022d3dd14b8cccd9c00fc73de8350cf2cb5a10444be61aa0",
      value: 242900,
      block: "5,912,990",
      when: "17 mai 2026, 16:51",
      status: "Confirmado",
    },
  ],
  Investidor: [
    {
      id: "inv-001",
      note: "NF-2409-018",
      event: "Cota reservada pelo investidor",
      account: "GCINVEST9A5RDK72P4JX8TYF3WQ6BLHNEZCVD2MS9KQ4AP7R6U",
      txHash: "0x604d88e8e3203ff101f987c9463477b55d6919824c8e5f1929504d72dc59d140",
      value: 52000,
      block: "5,913,261",
      when: "18 mai 2026, 10:32",
      status: "Confirmado",
    },
    {
      id: "inv-002",
      note: "NF-2409-018",
      event: "Liquidacao D+2 programada",
      account: "GCINVEST3UPN9V8D2CRK5QWL7Z4BHEYSMXA6FTQ2J4PDR97AL",
      txHash: "0x147afdc70aac023c74548275900f01cc30f0938534ff9b2fc6e3104cde65a5bf",
      value: 84000,
      block: "5,913,289",
      when: "18 mai 2026, 10:58",
      status: "Em monitoramento",
    },
    {
      id: "inv-003",
      note: "NF-2408-112",
      event: "Pagamento de rendimento confirmado",
      account: "GCINVEST5LQA9M3X7ER2YBD6VTHKCW8ZFN4PSJQ91GEA5R2M",
      txHash: "0xc157830e0f6254e9b04c5998d21320a6e7bec1dd89060c643236b16fb7138e0d",
      value: 31240,
      block: "5,912,998",
      when: "17 mai 2026, 17:04",
      status: "Confirmado",
    },
  ],
  Contract: [
    {
      id: "contract-001",
      note: "NF-2409-018",
      event: "Escrow criado no contrato",
      account: "CONTRACT-RECEIVABLE-POOL-BRL-2026-05",
      txHash: "0x54300c1b1eb16f7e2e8d0db8191a18aa4b955814c1126f03bf8c7d02ad5c74fb",
      value: 184200,
      block: "5,913,238",
      when: "18 mai 2026, 10:14",
      status: "Confirmado",
    },
    {
      id: "contract-002",
      note: "NF-2409-021",
      event: "Parametro de elegibilidade pendente",
      account: "CONTRACT-UNDERWRITING-RULES-V3",
      txHash: "0x2bc66861b214985dfc60f90a8110950e2d78f3ab517c908ee96702c02d99e641",
      value: 96750,
      block: "5,913,205",
      when: "18 mai 2026, 09:44",
      status: "Pendente",
    },
    {
      id: "contract-003",
      note: "NF-2408-112",
      event: "Distribuicao de yield executada",
      account: "CONTRACT-YIELD-DISTRIBUTOR-BRL",
      txHash: "0xa6a3ce9086139169181619e5283320917504d02bb085bdb85f4e42b832bd2904",
      value: 242900,
      block: "5,913,008",
      when: "17 mai 2026, 17:16",
      status: "Confirmado",
    },
  ],
};

const statusClass: Record<AuditStatus, string> = {
  Confirmado: "badge completed",
  "Em monitoramento": "badge active",
  Pendente: "badge pending",
};

function getTabTotal(tab: AuditTab) {
  return auditRows[tab].reduce((sum, row) => sum + row.value, 0);
}

function stringifyScVal(value: unknown): string {
  if (value === null || value === undefined) return "Sem payload";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return "Payload XDR";
  }
}

function formatEventName(event: StellarContractEvent): string {
  const [firstTopic] = event.topic;
  const topicText = stringifyScVal(firstTopic);
  if (topicText.length <= 80) return topicText;
  return `${topicText.slice(0, 77)}...`;
}

function formatContractTime(date?: string): string {
  if (!date) return "Ledger recente";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function eventToAuditRow(event: StellarContractEvent): AuditRow {
  return {
    id: event.id,
    note: `ledger-${event.ledger}`,
    event: formatEventName(event),
    account: event.contractId ?? CONTRACT_ID,
    txHash: event.txHash,
    value: 0,
    block: String(event.ledger),
    when: formatContractTime(event.ledgerClosedAt),
    status: "Confirmado",
  };
}

export function AuditContractsPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>("PME");
  const [contractData, setContractData] = useState<StellarContractResponse | null>(null);
  const [contractStatus, setContractStatus] = useState<ContractLoadStatus>("idle");
  const [contractError, setContractError] = useState<string | null>(null);

  async function loadContractData() {
    if (contractStatus === "loading" || contractStatus === "success") return;

    setContractStatus("loading");
    setContractError(null);

    try {
      const response = await fetch(`/api/stellar/contract?contractId=${encodeURIComponent(CONTRACT_ID)}`);
      const payload = (await response.json()) as StellarContractResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao consultar contrato Stellar");
      }

      setContractData(payload);
      setContractStatus("success");
    } catch (error) {
      setContractError(error instanceof Error ? error.message : "Falha ao consultar contrato Stellar");
      setContractStatus("error");
    }
  }

  const contractRows = contractData?.events.length
    ? contractData.events.map(eventToAuditRow)
    : auditRows.Contract;
  const activeRows = activeTab === "Contract" ? contractRows : auditRows[activeTab];

  const stats = useMemo(() => {
    const allRows = Object.values(auditRows).flat();
    const uniqueNotes = new Set(allRows.map((row) => row.note));
    const uniqueAccounts = new Set(allRows.map((row) => row.account));
    const monitoredValue = allRows.reduce((sum, row) => sum + row.value, 0);

    return {
      uniqueNotes: uniqueNotes.size,
      uniqueAccounts: uniqueAccounts.size,
      monitoredValue,
      lastBlock: "5,913,289",
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav className="appnav">
        <div className="wrap-wide">
          <Logo />
          <span className="badge neutral no-dot" style={{ marginLeft: 4 }}>
            Auditoria publica
          </span>
          <div style={{ flex: 1 }} />
          <Link className="appnav-link" href="/">
            Produto
          </Link>
          <Link className="btn btn-ghost btn-sm" href="/login">
            Login
          </Link>
        </div>
      </nav>

      <main className="wrap-wide" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div
          className="row between"
          style={{
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Contratos e notas
            </div>
            <h1 style={{ fontSize: 40, lineHeight: 1.08, letterSpacing: 0 }}>
              Auditoria de contratos
            </h1>
            <p className="t-2" style={{ maxWidth: 680, marginTop: 10, fontSize: 14 }}>
              Visao consolidada das notas, contas e eventos que compoem a trilha operacional da CredBridge.
            </p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="chip">
              <span className="dot-live" />
              <span>Stellar testnet</span>
            </div>
            <div className="chip">
              <Icon name="shield" size={12} />
              <span>Sem login</span>
            </div>
          </div>
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="card hi">
            <div className="kpi-label">Notas rastreadas</div>
            <div className="kpi num" style={{ fontSize: 30 }}>
              {stats.uniqueNotes}
            </div>
            <p className="t-3" style={{ fontSize: 12, marginTop: 8 }}>
              NF-e com trilha aberta
            </p>
          </div>
          <div className="card">
            <div className="kpi-label">Valor observado</div>
            <div className="kpi num" style={{ fontSize: 30 }}>
              {fmtBRL(stats.monitoredValue, { compact: true })}
            </div>
            <p className="t-3" style={{ fontSize: 12, marginTop: 8 }}>
              Eventos indexados
            </p>
          </div>
          <div className="card">
            <div className="kpi-label">Contas</div>
            <div className="kpi num" style={{ fontSize: 30 }}>
              {stats.uniqueAccounts}
            </div>
            <p className="t-3" style={{ fontSize: 12, marginTop: 8 }}>
              Carteiras e contratos
            </p>
          </div>
          <div className="card violet-hi">
            <div className="kpi-label">Ultimo bloco</div>
            <div className="kpi num" style={{ fontSize: 30 }}>
              {stats.lastBlock}
            </div>
            <p className="t-3" style={{ fontSize: 12, marginTop: 8 }}>
              Rede de auditoria
            </p>
          </div>
        </section>

        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="row between"
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: 24, letterSpacing: 0 }}>Trilha por participante</h2>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
                {activeTab === "Contract"
                  ? `${activeRows.length} eventos · contrato ${fmtTxHash(CONTRACT_ID, 10)}`
                  : `${activeRows.length} eventos · ${fmtBRL(getTabTotal(activeTab), { compact: true })}`}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Participantes da auditoria"
              className="row"
              style={{
                gap: 4,
                padding: 4,
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "var(--surface)",
                flexWrap: "wrap",
              }}
            >
              {tabs.map((tab) => {
                const isActive = tab === activeTab;

                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className="btn btn-sm"
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "Contract") {
                        void loadContractData();
                      }
                    }}
                    style={{
                      height: 32,
                      borderColor: isActive ? "var(--line-2)" : "transparent",
                      background: isActive ? "var(--surface-2)" : "transparent",
                      color: isActive ? "var(--fg)" : "var(--fg-2)",
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "Contract" && (
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--line)",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              <div className="chip" style={{ justifyContent: "flex-start", minWidth: 0 }}>
                <Icon name="code" size={12} />
                <span className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {CONTRACT_ID}
                </span>
              </div>
              <div className="chip">
                <span className={contractStatus === "loading" ? "dot-live" : undefined} />
                <span>
                  {contractStatus === "success"
                    ? contractData?.found
                      ? "Contrato encontrado"
                      : "Contrato nao encontrado"
                    : contractStatus === "error"
                      ? "Erro no RPC"
                      : contractStatus === "loading"
                        ? "Consultando testnet"
                        : "Aguardando consulta"}
                </span>
              </div>
              <div className="chip">
                <Icon name="chain" size={12} />
                <span>
                  Ledger {contractData?.latestLedger ?? contractData?.instance?.lastModifiedLedgerSeq ?? "..."}
                </span>
              </div>
              <a
                className="btn btn-ghost btn-sm"
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="arrow_up_right" size={12} />
                Explorer
              </a>
              {contractError && (
                <p className="t-red" style={{ gridColumn: "1 / -1", fontSize: 12 }}>
                  {contractError}
                </p>
              )}
              {contractStatus === "success" && contractData?.events.length === 0 && (
                <p className="t-3" style={{ gridColumn: "1 / -1", fontSize: 12 }}>
                  Contrato consultado na Stellar testnet, mas sem eventos recentes no intervalo indexado.
                </p>
              )}
              {contractStatus === "success" && contractData?.eventError && (
                <p className="t-amber" style={{ gridColumn: "1 / -1", fontSize: 12 }}>
                  Contrato encontrado, mas a busca de eventos retornou: {contractData.eventError}
                </p>
              )}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Nota</th>
                  <th>Evento</th>
                  <th>Conta</th>
                  <th>Valor</th>
                  <th>Bloco</th>
                  <th>Transacao</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{row.when}</td>
                    <td>
                      <span className="mono" style={{ color: "var(--fg)" }}>
                        {row.note}
                      </span>
                    </td>
                    <td style={{ color: "var(--fg)" }}>{row.event}</td>
                    <td>
                      <span className="mono" title={row.account}>
                        {fmtTxHash(row.account, 12)}
                      </span>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {fmtBRL(row.value)}
                    </td>
                    <td className="mono">{row.block}</td>
                    <td>
                      <span className="mono t-blue" title={row.txHash}>
                        {fmtTxHash(row.txHash, 10)}
                      </span>
                    </td>
                    <td>
                      <span className={statusClass[row.status]}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
