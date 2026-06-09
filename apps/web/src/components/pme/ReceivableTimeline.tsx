"use client";

import { Timeline } from "@/components/patterns/Timeline";
import type { TimelineItem } from "@/components/patterns/Timeline";
import { useAuditTrail } from "@/lib/api/audit";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { AuditEvent } from "@credbridge/types";

interface ReceivableTimelineProps {
  receivableId: string;
}

type Translate = (key: string) => string;

const EVENT_LABEL_KEYS: Record<string, string> = {
  "receivable.created": "rt_ev_created",
  "receivable.validated": "rt_ev_validated",
  "receivable.ready_for_blockchain": "rt_ev_ready",
  "receivable.nft_minting": "rt_ev_minting",
  "receivable.nft_minted": "rt_ev_minted",
  "receivable.tx_confirmed": "rt_ev_confirmed",
  "document.created": "rt_ev_doc",
  "document.uploaded": "rt_ev_doc",
  "settlement.created": "rt_ev_settlement_created",
  "settlement.completed": "rt_ev_settlement_completed",
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

function fmtTime(iso: string, t: Translate): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `${t("rt_today")} ${time}`;
  return `${d.toLocaleDateString("en-US", { day: "2-digit", month: "short" })} ${time}`;
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

function eventsToTimeline(events: AuditEvent[], t: Translate): TimelineItem[] {
  return [...events]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((e) => ({
      time: fmtTime(e.createdAt, t),
      label: EVENT_LABEL_KEYS[e.event] ? t(EVENT_LABEL_KEYS[e.event]) : e.event,
      value: eventValue(e),
      kind: EVENT_KIND[e.event] ?? "blue",
    }));
}

export function ReceivableTimeline({ receivableId }: ReceivableTimelineProps) {
  const { t } = useTranslation("en");
  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useAuditTrail(receivableId);

  if (isLoading) {
    return (
      <div className="t-3" style={{ padding: "16px 24px", fontSize: 12 }}>
        {t("rt_loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: "16px 24px", fontSize: 12, color: "var(--red)" }}>
        {t("rt_error")}
      </div>
    );
  }

  const items = eventsToTimeline(data ?? [], t as Translate);

  if (items.length === 0) {
    return (
      <div className="t-3" style={{ padding: "16px 24px", fontSize: 12 }}>
        {t("rt_none")}
      </div>
    );
  }

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", {
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
          {t("rt_title")}
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
          <span>{isFetching ? t("rt_updating") : `${t("rt_live")}${lastUpdate ? ` · ${lastUpdate}` : ""}`}</span>
        </span>
      </div>
      <Timeline items={items} />
    </div>
  );
}
