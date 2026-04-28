"use client";

import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { Timeline } from "@/components/patterns/Timeline";
import type { TimelineItem } from "@/components/patterns/Timeline";
import { UploadZone } from "@/components/pme/UploadZone";
import { YieldSpark } from "@/components/pme/YieldSpark";
import { InvoiceTable } from "@/components/pme/InvoiceTable";
import type { InvoiceRow } from "@/components/pme/InvoiceTable";
import { useTranslation } from "@/lib/i18n/useTranslation";

const pmeInvoices: InvoiceRow[] = [
  { nfe: "000.428.551", sacado: "Magazine Luiza S.A.",  cnpj: "47.960.950/0001-21", valor: 182450,  desagio: 3.05, liquido: 176884.27, due: "12 mai", status: "active",    days: 38 },
  { nfe: "000.428.539", sacado: "Via Varejo S.A.",      cnpj: "33.041.260/0065-28", valor: 94200,   desagio: 2.80, liquido: 91562.40,  due: "04 mai", status: "active",    days: 30 },
  { nfe: "000.428.502", sacado: "Americanas S.A.",      cnpj: "00.776.574/0006-60", valor: 246800,  desagio: 4.20, liquido: 236434.40, due: "22 mai", status: "pending",   days: 48 },
  { nfe: "000.428.488", sacado: "Lojas Renner S.A.",    cnpj: "92.754.738/0001-62", valor: 58120,   desagio: 2.65, liquido: 56581.82,  due: "29 abr", status: "completed", days: 0  },
  { nfe: "000.428.455", sacado: "C&A Modas Ltda.",      cnpj: "45.242.914/0001-05", valor: 132990,  desagio: 3.10, liquido: 128867.31, due: "19 abr", status: "completed", days: 0  },
  { nfe: "000.428.401", sacado: "Pernambucanas",        cnpj: "61.189.288/0001-89", valor: 71450,   desagio: 5.20, liquido: 67734.60,  due: "07 abr", status: "defaulted", days: -6 },
];

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

  function scrollToUpload() {
    document
      .getElementById("upload-zone")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
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
              6 operações · atualizado há 12 min
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
        <InvoiceTable rows={pmeInvoices} />
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
