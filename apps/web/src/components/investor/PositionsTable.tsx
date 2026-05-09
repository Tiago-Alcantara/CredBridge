"use client";

import type { Investment } from "@credbridge/types";
import { fmtBRL } from "@/lib/format";

interface PositionsTableProps {
  positions: Investment[];
  loading: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function statusLabel(s: Investment["status"]): { label: string; color: string } {
  if (s === "settled") return { label: "Liquidada", color: "var(--green)" };
  if (s === "defaulted") return { label: "Inadimplente", color: "var(--red)" };
  return { label: "Ativa", color: "var(--blue)" };
}

export function PositionsTable({ positions, loading }: PositionsTableProps) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>ID</th>
          <th>Sacado</th>
          <th style={{ textAlign: "right" }}>Pago</th>
          <th style={{ textAlign: "right" }}>Face</th>
          <th style={{ textAlign: "right" }}>Lucro</th>
          <th>Vencimento</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Carregando posições…
            </td>
          </tr>
        ) : positions.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Nenhuma cota adquirida.
            </td>
          </tr>
        ) : (
          positions.map((p) => {
            const profit = p.faceValue - p.amountPaid;
            const s = statusLabel(p.status);
            return (
              <tr key={p.id}>
                <td><span className="mono">{shortId(p.id)}</span></td>
                <td style={{ fontWeight: 500 }}>{p.receivable?.debtorName ?? "—"}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.amountPaid)}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.faceValue)}</td>
                <td className="num t-green" style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmtBRL(profit)}
                </td>
                <td style={{ fontSize: 13 }}>
                  {p.receivable ? fmtDate(p.receivable.dueDate) : "—"}
                </td>
                <td>
                  <span
                    className="badge neutral no-dot"
                    style={{ fontFamily: "var(--mono)", fontSize: 11, color: s.color }}
                  >
                    {s.label}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
