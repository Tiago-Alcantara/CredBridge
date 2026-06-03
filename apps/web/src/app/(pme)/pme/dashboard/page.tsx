"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { StellarWalletAddress } from "@/components/auth/StellarWalletAddress";
import { Timeline } from "@/components/patterns/Timeline";
import type { TimelineItem } from "@/components/patterns/Timeline";
import { UploadZone } from "@/components/pme/UploadZone";
import { YieldSpark } from "@/components/pme/YieldSpark";
import { InvoiceTable } from "@/components/pme/InvoiceTable";
import type { InvoiceRow } from "@/components/pme/InvoiceTable";
import { InvoiceTableSkeleton } from "@/components/pme/InvoiceTableSkeleton";
import { AnchorDrawer } from "@/components/anchor/AnchorDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useReceivables, receivableQueryKeys } from "@/lib/api/receivables";
import { useMe } from "@/lib/api/me";
import { useAuditLog, auditQueryKeys } from "@/lib/api/audit";
import { useWalletBalance, walletQueryKeys } from "@/lib/api/wallet";
import type { Receivable } from "@/types";
import type { AuditEvent } from "@credbridge/types";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function toInvoiceRow(r: Receivable): InvoiceRow {
  const due = new Date(r.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return {
    id: r.id,
    nfe: r.id.slice(-9).toUpperCase(),
    sacado: r.debtorName,
    cnpj: r.debtorDocument,
    valor: r.value,
    desagio: 0,
    liquido: r.value,
    due: `${due.getDate()} ${MONTHS[due.getMonth()]}`,
    status: r.status,
    days,
  };
}

function fmtBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

const EVENT_LABELS: Record<string, string> = {
  "receivable.created": "Recebível enviado",
  "receivable.updated": "Recebível atualizado",
  "receivable.validated": "Recebível validado",
  "document.created": "Documento enviado",
  "document.uploaded": "Documento enviado",
  "settlement.created": "Liquidação criada",
  "settlement.updated": "Liquidação atualizada",
  "settlement.completed": "Liquidação concluída",
};

const ENTITY_KIND: Record<string, TimelineItem["kind"]> = {
  receivable: "blue",
  document: "blue",
  settlement: "green",
  user: "violet",
};

function auditToTimeline(e: AuditEvent): TimelineItem {
  return {
    time: relativeTime(e.createdAt),
    label: EVENT_LABELS[e.event] ?? e.event,
    value: e.entityType,
    kind: ENTITY_KIND[e.entityType] ?? "blue",
  };
}

export default function PmeDashboardPage() {
  const { t } = useTranslation("pt");
  const queryClient = useQueryClient();
  const { data: receivables, isLoading, isError } = useReceivables();
  const { data: me } = useMe();
  const { data: auditEvents } = useAuditLog();
  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useWalletBalance();
  const [offrampOpen, setOfframpOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: walletQueryKeys.balance }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.me }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const invoiceRows: InvoiceRow[] = receivables?.map(toInvoiceRow) ?? [];

  // KPI computations from real receivable data
  const analysisRows = (receivables ?? []).filter(
    (r) => r.status === "pending" || r.status === "validated",
  );
  const settledRows = (receivables ?? []).filter((r) => r.status === "settled");
  const analysisValue = analysisRows.reduce((sum, r) => sum + r.value, 0);
  const settledValue = settledRows.reduce((sum, r) => sum + r.value, 0);
  const totalCount = receivables?.length ?? 0;

  const firstName = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0] ?? "";

  const timelineItems: TimelineItem[] = auditEvents?.map(auditToTimeline) ?? [];

  function scrollToUpload() {
    document.getElementById("upload-zone")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <>
      {/* Header */}
      <div
        className="row between"
        style={{
          marginBottom: 28,
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t("dash_greeting")}{firstName ? `, ${firstName}` : ""}
          </div>
          <h2 style={{ fontSize: 32 }}>Sua liquidez hoje</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleRefresh} disabled={refreshing}>
            <Icon name="refresh" size={14} className={refreshing ? "spinning" : undefined} /> Atualizar
          </button>
          <button className="btn btn-ghost">
            <Icon name="download" size={14} /> Extrato
          </button>
          <button className="btn btn-primary" onClick={scrollToUpload}>
            <Icon name="plus" size={14} /> {t("dash_upload")}
          </button>
        </div>
      </div>

      <StellarWalletAddress />

      {/* Balance hero + KPI cards */}
      <div
        className="grid-kpi"
        style={{ marginBottom: 24 }}
      >
        <div className="card hi" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t("dash_avail")}
          </div>
          <div className="kpi kpi-lg num">
            <span className="unit">R$</span>
            {balanceLoading
              ? "…"
              : balanceError || balance == null
              ? "—"
              : balance.balance.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setOfframpOpen(true)} >
              <Icon name="download" size={14} /> {t("dash_withdraw")}
            </button>
          </div>
          <div
            className="row"
            style={{
              gap: 20,
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid var(--line)",
              color: "var(--fg-2)",
              fontSize: 12.5,
            }}
          >
            <span className="row" style={{ gap: 6 }}>
              <span className="dot-live" />
              <span>BRL Digital · Stellar</span>
            </span>
            <span className="mono">
              {balanceLoading
                ? "…"
                : balanceError || balance == null
                ? "—"
                : `${balance.balance.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} BRLT`}
            </span>
          </div>
        </div>

        <MiniKpi
          label={t("dash_pending")}
          value={isLoading ? "…" : fmtBRL(analysisValue)}
          sub={isLoading ? "" : `${analysisRows.length} NF-e`}
          color="#FFC857"
          icon="bolt"
        />
        <MiniKpi
          label={t("dash_released")}
          value={isLoading ? "…" : fmtBRL(settledValue)}
          sub={isLoading ? "" : `${settledRows.length} liquidadas`}
          color="#00FF94"
          icon="arrow_up_right"
        />
        <MiniKpi
          label={t("dash_nf_count")}
          value={isLoading ? "…" : String(totalCount)}
          sub={isLoading ? "" : `${analysisRows.length} em análise`}
          color="#00D4FF"
          icon="doc"
        />
      </div>

      {/* Upload zone + yield spark */}
      <div
        className="grid-split"
        style={{ marginBottom: 24 }}
      >
        <UploadZone id="upload-zone" />
        <YieldSpark />
      </div>

      {/* Active anticipations table */}
      <div className="card" id="receivables-table" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div className="row between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <h3>{t("dash_active")}</h3>
            <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              {isLoading
                ? "Carregando…"
                : isError
                ? "Erro ao carregar"
                : `${invoiceRows.length} operaç${invoiceRows.length === 1 ? "ão" : "ões"}`}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="chip">
              <Icon name="search" size={12} />
              <input placeholder={t("search")} style={{ background: "transparent",border: 0,outline: "none",color: "var(--fg)",width: 140,font: "inherit",}}/>
            </div>
            <button className="btn btn-ghost btn-sm">{t("view_all")}</button>
          </div>
        </div>

        {isLoading && <InvoiceTableSkeleton />}

        {isError && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--red)" }}>
            Erro ao carregar recebíveis. Tente novamente.
          </div>
        )}

        {!isLoading && !isError && invoiceRows.length === 0 && (
          <div
            style={{
              padding: "56px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(0,212,255,0.08)",
                color: "var(--blue)",
                display: "grid",
                placeItems: "center",
                marginBottom: 16,
              }}
            >
              <Icon name="doc" size={28} />
            </div>
            <p
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 600,
                fontSize: 16,
                marginBottom: 6,
              }}
            >
              Nenhum recebível ainda
            </p>
            <p className="t-2" style={{ fontSize: 13, marginBottom: 20, maxWidth: 300 }}>
              Envie sua primeira NF-e para iniciar o processo de antecipação.
            </p>
            <button className="btn btn-primary" onClick={scrollToUpload}>
              <Icon name="plus" size={14} /> Enviar primeira NF-e
            </button>
          </div>
        )}

        {!isLoading && !isError && invoiceRows.length > 0 && (
          <InvoiceTable rows={invoiceRows} userEmail={me?.email} />
        )}
      </div>

      {/* Timeline */}
      {/* @TODO deixar comentado por enquanto */}
      {/* <div className="card" style={{ padding: 0 }}>
        <div
          className="row between"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}
        >
          <h3>{t("dash_history")}</h3>
          <span
            className="row"
            style={{ gap: 6, fontSize: 12, color: "var(--fg-2)" }}
          >
            <span className="dot-live" /> Ao vivo
          </span>
        </div>
        {timelineItems.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "var(--fg-2)", fontSize: 13 }}>
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <Timeline items={timelineItems} />
        )}
      </div> */}

      <AnchorDrawer mode="offramp" open={offrampOpen} onClose={() => setOfframpOpen(false)} />
    </>
  );
}
