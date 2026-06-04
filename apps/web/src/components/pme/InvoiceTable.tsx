"use client";

import { useState, Fragment } from "react";
import { Icon } from "@/components/primitives/Icon";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { ReceivableTimeline } from "@/components/pme/ReceivableTimeline";
import { fmtBRL } from "@/lib/format";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useAssignReceivable, useTokenizeReceivable } from "@/lib/api/receivables";
import { useFinancialAuthorization } from "@/lib/financial-actions/useFinancialAuthorization";
import type { ReceivableStatus } from "@/types";
import { CessaoModal } from "@/components/pme/CessaoModal";

export interface InvoiceRow {
  id: string;
  nfe: string;
  sacado: string;
  cnpj: string;
  valor: number;
  desagio: number;
  liquido: number;
  due: string;
  status: ReceivableStatus;
  days: number;
}

interface InvoiceTableProps {
  rows: InvoiceRow[];
  compact?: boolean;
  userEmail?: string | null;
}

export function InvoiceTable({ rows, compact = false, userEmail }: InvoiceTableProps) {
  const visibleRows = compact ? rows.slice(0, 4) : rows;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRowForCessao, setSelectedRowForCessao] = useState<InvoiceRow | null>(null);
  const tokenizeReceivable = useTokenizeReceivable();
  const assignReceivable = useAssignReceivable();
  const { authorize, isAuthorizing } = useFinancialAuthorization(userEmail);
  const colSpan = compact ? 8 : 9;

  function toggle(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  async function handleReceivableAction(row: InvoiceRow) {
    setActionRowId(row.id);
    setActionError(null);

    try {
      if (row.status === "validated") {
        await tokenizeReceivable.mutateAsync(row.id);
        return;
      }

      if (row.status === "tokenized" || row.status === "assignment_pending") {
        setSelectedRowForCessao(row);
      }
    } catch (err) {
      setActionError(extractApiErrorMessage(err) || "Não foi possível concluir a ação.");
    } finally {
      setActionRowId(null);
    }
  }

  function getActionLabel(status: ReceivableStatus): string | null {
    if (status === "validated") return "Tokenizar";
    if (status === "tokenized" || status === "assignment_pending") return "Assinar cessão";
    return null;
  }

  return (
    <div className="tbl-scroll">
    <table className="tbl" style={{ minWidth: 720 }}>
      <thead>
        <tr>
          <th style={{ width: 28 }} />
          <th>NF-e</th>
          <th>Sacado</th>
          <th style={{ textAlign: "right" }}>Valor</th>
          {!compact && <th style={{ textAlign: "right" }}>Deságio</th>}
          <th style={{ textAlign: "right" }}>Líquido</th>
          <th>Vencimento</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {actionError && (
          <tr>
            <td colSpan={colSpan} style={{ color: "var(--red)", fontSize: 13 }}>
              {actionError}
            </td>
          </tr>
        )}
        {visibleRows.map((r) => {
          const isOpen = expandedId === r.id;
          const actionLabel = getActionLabel(r.status);
          const isActionPending =
            actionRowId === r.id &&
            (tokenizeReceivable.isPending || assignReceivable.isPending || isAuthorizing);
          return (
            <Fragment key={r.id}>
              <tr>
                <td style={{ width: 28, padding: 0, textAlign: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={isOpen ? "Ocultar histórico" : "Ver histórico"}
                    aria-expanded={isOpen}
                    onClick={() => toggle(r.id)}
                    style={{
                      padding: 6,
                      width: 24,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 120ms ease",
                      }}
                    >
                      <Icon name="arrow_right" size={12} />
                    </span>
                  </button>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 13 }}>
                    {r.nfe}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.sacado}</div>
                  <div className="mono t-3" style={{ fontSize: 11 }}>
                    {r.cnpj}
                  </div>
                </td>
                <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                  {fmtBRL(r.valor)}
                </td>
                {!compact && (
                  <td
                    className="num"
                    style={{ textAlign: "right", color: "var(--fg-2)" }}
                  >
                    {r.desagio.toFixed(2).replace(".", ",")}%
                  </td>
                )}
                <td
                  className="num"
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color:
                      r.status === "defaulted"
                        ? "var(--red)"
                        : r.status === "settled"
                        ? "var(--green)"
                        : "var(--fg)",
                  }}
                >
                  {fmtBRL(r.liquido)}
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.due}</div>
                  <div className="t-3" style={{ fontSize: 11 }}>
                    {r.days > 0
                      ? `em ${r.days}d`
                      : r.days < 0
                      ? `${Math.abs(r.days)}d atraso`
                      : "hoje"}
                  </div>
                </td>
                <td>
                  <StatusBadge status={r.status} lang="pt" />
                </td>
                <td style={{ textAlign: "right" }}>
                  {actionLabel ? (
                    <button
                      className="btn btn-primary btn-sm"
                      aria-label={actionLabel}
                      disabled={isActionPending}
                      onClick={() => handleReceivableAction(r)}
                    >
                      {isActionPending ? "…" : actionLabel}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label="verify"
                    >
                      <Icon name="chain" size={12} />
                    </button>
                  )}
                </td>
              </tr>
              {isOpen && (
                <tr>
                  <td colSpan={colSpan} style={{ padding: 0 }}>
                    <ReceivableTimeline receivableId={r.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>

    <CessaoModal
      isOpen={!!selectedRowForCessao}
      onClose={() => setSelectedRowForCessao(null)}
      receivableId={selectedRowForCessao?.id ?? ""}
      nfeNumber={selectedRowForCessao?.nfe ?? ""}
      sacado={selectedRowForCessao?.sacado ?? ""}
      valor={selectedRowForCessao?.valor ?? 0}
      desagio={selectedRowForCessao?.desagio ?? 0}
      liquido={selectedRowForCessao?.liquido ?? 0}
      userEmail={userEmail}
    />
    </div>
  );
}
