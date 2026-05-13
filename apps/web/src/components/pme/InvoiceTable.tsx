"use client";

import { useState, Fragment } from "react";
import { Icon } from "@/components/primitives/Icon";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { ReceivableTimeline } from "@/components/pme/ReceivableTimeline";
import { fmtBRL } from "@/lib/format";
import type { ReceivableStatus } from "@/types";

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
  onActivate?: (id: string) => void;
  activatingId?: string;
}

export function InvoiceTable({ rows, compact = false, onActivate, activatingId }: InvoiceTableProps) {
  const visibleRows = compact ? rows.slice(0, 4) : rows;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const colSpan = compact ? 8 : 9;

  function toggle(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <table className="tbl">
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
        {visibleRows.map((r) => {
          const isOpen = expandedId === r.id;
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
                  {r.status !== "active" && onActivate ? (
                    <button
                      className="btn btn-primary btn-sm"
                      aria-label="Ativar recebível"
                      disabled={activatingId === r.id}
                      onClick={() => onActivate(r.id)}
                    >
                      {activatingId === r.id ? "…" : "Ativar"}
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
  );
}
