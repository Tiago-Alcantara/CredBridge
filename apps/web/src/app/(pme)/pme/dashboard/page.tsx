"use client";

import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { Timeline } from "@/components/patterns/Timeline";
import type { TimelineItem } from "@/components/patterns/Timeline";
import { UploadZone } from "@/components/pme/UploadZone";
import { YieldSpark } from "@/components/pme/YieldSpark";
import { InvoiceTable } from "@/components/pme/InvoiceTable";
import type { InvoiceRow } from "@/components/pme/InvoiceTable";
import { InvoiceTableSkeleton } from "@/components/pme/InvoiceTableSkeleton";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useReceivables } from "@/lib/api/receivables";
import type { Receivable } from "@/types";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function toInvoiceRow(r: Receivable): InvoiceRow {
  const due = new Date(r.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return {
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

const pmeTimeline: TimelineItem[] = [
  { time: "há 12 min", label: "Pix enviado · Itaú Unibanco",           value: "+R$ 176.884,27", kind: "green"  },
  { time: "há 14 min", label: "Liquidação on-chain · tx 0xA7F2…91C",   value: "Confirmada",     kind: "blue"   },
  { time: "há 15 min", label: "Smart contract executado · Soroban",     value: "182.450 USDC",   kind: "violet" },
  { time: "há 17 min", label: "Proposta aprovada · Cota Sênior",        value: "Deságio 3,05%",  kind: "blue"   },
  { time: "há 21 min", label: "NF-e 000.428.551 validada · SEFAZ",      value: "OK",             kind: "green"  },
  { time: "há 2h",     label: "Cessão assinada · Stellar Auth",         value: "SEP-10",         kind: "violet" },
];

export default function PmeDashboardPage() {
  const { t } = useTranslation("pt");
  const { data: receivables, isLoading, isError } = useReceivables();

  const invoiceRows: InvoiceRow[] = receivables?.map(toInvoiceRow) ?? [];

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
            {t("dash_greeting")}, Luciana
          </div>
          <h2 style={{ fontSize: 32 }}>Sua liquidez hoje</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost">
            <Icon name="download" size={14} /> Extrato
          </button>
          <button className="btn btn-primary" onClick={scrollToUpload}>
            <Icon name="plus" size={14} /> {t("dash_upload")}
          </button>
        </div>
      </div>

      {/* Balance hero + KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card hi" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t("dash_avail")}
          </div>
          <div className="kpi kpi-lg num">
            <span className="unit">R$</span>284.716
            <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>,08</span>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary">
              <Icon name="download" size={14} /> {t("dash_withdraw")}
            </button>
            <button className="btn btn-ghost">
              <Icon name="arrow_up_right" size={14} /> Transferir
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
            <span className="mono">GDCH7Q4X…FQT9M4</span>
          </div>
        </div>

        <MiniKpi
          label={t("dash_pending")}
          value="R$ 523,5k"
          sub="3 NF-e"
          color="#FFC857"
          icon="bolt"
        />
        <MiniKpi
          label={t("dash_released")}
          value="R$ 1,28M"
          sub="+23% vs mar"
          color="#00FF94"
          icon="arrow_up_right"
        />
        <MiniKpi
          label={t("dash_nf_count")}
          value="12"
          sub="6 em análise"
          color="#00D4FF"
          icon="doc"
        />
      </div>

      {/* Upload zone + yield spark */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <UploadZone id="upload-zone" />
        <YieldSpark />
      </div>

      {/* Active anticipations table */}
      <div
        className="card"
        style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
      >
        <div
          className="row between"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}
        >
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
              <input
                placeholder={t("search")}
                style={{
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  color: "var(--fg)",
                  width: 140,
                  font: "inherit",
                }}
              />
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
          <InvoiceTable rows={invoiceRows} />
        )}
      </div>

      {/* Timeline */}
      <div className="card" style={{ padding: 0 }}>
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
        <Timeline items={pmeTimeline} />
      </div>
    </>
  );
}
