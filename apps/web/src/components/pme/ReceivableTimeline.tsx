"use client";

import { Timeline } from "@/components/patterns/Timeline";
import type { TimelineItem } from "@/components/patterns/Timeline";
import { useAuditTrail } from "@/lib/api/audit";
import type { AuditEvent } from "@credbridge/types";

interface ReceivableTimelineProps {
  receivableId: string;
}

const EVENT_LABELS: Record<string, string> = {
  "receivable.created": "Criado na base de dados",
  "receivable.validated": "Validado nas verificações",
  "receivable.ready_for_blockchain": "Pronto para ativação em blockchain",
  "receivable.nft_minting": "NFT sendo emitida no contrato Soroban",
  "receivable.nft_minted": "NFT criada na blockchain Stellar",
  "receivable.tx_confirmed": "Transação confirmada na blockchain",
  "document.created": "Documento enviado",
  "document.uploaded": "Documento enviado",
  "settlement.created": "Liquidação criada",
  "settlement.completed": "Liquidação concluída",
};

const EVENT_KIND: Record<string, TimelineItem["kind"]> = {
  "receivable.created": "blue",
  "receivable.validated": "blue",
  "receivable.ready_for_blockchain": "violet",
  "receivable.nft_minting": "violet",
  "receivable.nft_minted": "green",
  "receivable.tx_confirmed": "green",
  "document.created": "blue",
  "document.uploaded": "blue",
  "settlement.created": "violet",
  "settlement.completed": "green",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${time}`;
}

function shortHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function eventValue(e: AuditEvent): string {
  if (e.txHash) return shortHash(e.txHash);
  if (e.event === "receivable.validated") return "OK";
  if (e.event === "receivable.created") return "pending";
  if (e.event === "receivable.ready_for_blockchain") return "stellar";
  if (e.event === "receivable.nft_minting") return "minting";
  return e.entityType;
}

function eventsToTimeline(events: AuditEvent[]): TimelineItem[] {
  return [...events]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((e) => ({
      time: fmtTime(e.createdAt),
      label: EVENT_LABELS[e.event] ?? e.event,
      value: eventValue(e),
      kind: EVENT_KIND[e.event] ?? "blue",
    }));
}

export function ReceivableTimeline({ receivableId }: ReceivableTimelineProps) {
  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useAuditTrail(receivableId);

  if (isLoading) {
    return (
      <div className="t-3" style={{ padding: "16px 24px", fontSize: 12 }}>
        Carregando histórico…
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: "16px 24px", fontSize: 12, color: "var(--red)" }}>
        Erro ao carregar histórico do recebível.
      </div>
    );
  }

  const items = eventsToTimeline(data ?? []);

  if (items.length === 0) {
    return (
      <div className="t-3" style={{ padding: "16px 24px", fontSize: 12 }}>
        Nenhum evento registrado para este recebível.
      </div>
    );
  }

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div
      style={{
        background: "var(--bg-2, rgba(255,255,255,0.02))",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="row between"
        style={{ padding: "14px 24px 0", alignItems: "center" }}
      >
        <span className="eyebrow" style={{ fontSize: 11 }}>
          Histórico do recebível
        </span>
        <span
          className="row"
          style={{
            gap: 6,
            fontSize: 11,
            color: "var(--fg-2)",
            alignItems: "center",
          }}
          aria-live="polite"
        >
          <span
            className="dot-live"
            style={{
              opacity: isFetching ? 1 : 0.5,
              transition: "opacity 200ms ease",
            }}
          />
          <span>{isFetching ? "Atualizando…" : `Ao vivo${lastUpdate ? ` · ${lastUpdate}` : ""}`}</span>
        </span>
      </div>
      <Timeline items={items} />
    </div>
  );
}
