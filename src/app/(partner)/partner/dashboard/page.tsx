"use client";

import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { TrafficChart } from "@/components/partner/TrafficChart";
import { useTranslation } from "@/lib/i18n/useTranslation";

type ApiKeyEnv = "prod" | "sandbox";

interface ApiKey {
  label: string;
  key: string;
  env: ApiKeyEnv;
  last: string;
}

const API_KEYS: ApiKey[] = [
  { label: "Production — primary",  key: "cb_live_sk_4a8f...92b1", env: "prod",    last: "há 2 min"  },
  { label: "Production — readonly", key: "cb_live_pk_7d2e...f013", env: "prod",    last: "há 18 min" },
  { label: "Sandbox",               key: "cb_test_sk_a91c...ee42", env: "sandbox", last: "há 4h"      },
];

type LogColor = "var(--green)" | "var(--blue)" | "var(--violet)";

interface LogEvent {
  m: string;
  p: string;
  code: number;
  t: string;
  dur: string;
  color: LogColor;
}

const LOG_EVENTS: LogEvent[] = [
  { m: "POST", p: "/v1/anticipations",       code: 201, t: "14:22:04.812", dur: "142ms", color: "var(--green)"  },
  { m: "GET",  p: "/v1/receivables/rx_7d2e", code: 200, t: "14:22:04.704", dur: "38ms",  color: "var(--blue)"   },
  { m: "POST", p: "/v1/webhooks/deliver",    code: 200, t: "14:22:04.581", dur: "91ms",  color: "var(--blue)"   },
  { m: "GET",  p: "/v1/fund/nav",            code: 200, t: "14:22:04.412", dur: "24ms",  color: "var(--blue)"   },
  { m: "POST", p: "/v1/stellar/sign",        code: 200, t: "14:22:04.201", dur: "218ms", color: "var(--violet)" },
];

type WebhookStatus = "ok" | "warn" | "err";

interface Webhook {
  url: string;
  events: string[];
  status: WebhookStatus;
  delivery: string;
}

const WEBHOOKS: Webhook[] = [
  { url: "https://contabilizei.com.br/hooks/cb",      events: ["anticipation.created", "anticipation.settled"], status: "ok",   delivery: "100%"     },
  { url: "https://contabilizei.com.br/hooks/nav",     events: ["nav.updated"],                                   status: "ok",   delivery: "99.8%"    },
  { url: "https://staging.contabilizei.com.br/hooks", events: ["*"],                                              status: "warn", delivery: "94.2%"    },
  { url: "https://old.contabilizei.com.br/hooks",     events: ["anticipation.*"],                                 status: "err",  delivery: "retrying" },
];

export default function PartnerDashboardPage() {
  const { t } = useTranslation("pt");

  return (
    <>
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>INTEGRAÇÃO</div>
          <h2 style={{ fontSize: 32 }}>Painel de parceiro</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost"><Icon name="doc" size={14} /> API Reference</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} /> {t("api_new_key")}</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <MiniKpi label="Chamadas 24h"        value="284.712"  sub="99,98% uptime"    color="#00D4FF" icon="bolt"         />
        <MiniKpi label="Latência p95"        value="112ms"    sub="▼ 18ms vs 7d"     color="#00FF94" icon="arrow_up_right"/>
        <MiniKpi label="Webhooks"            value="4 / 5"    sub="ativos"           color="#7B2FFF" icon="webhook"      />
        <MiniKpi label="Operações este mês"  value="12.408"   sub="R$ 48,2M"         color="#FFC857" icon="chart"        />
      </div>

      {/* Keys + Quick start */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3>{t("api_keys")}</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>3 chaves · 2 em produção</p>
            </div>
            <button className="btn btn-ghost btn-sm"><Icon name="plus" size={12} /> {t("api_new_key")}</button>
          </div>
          <div style={{ padding: "4px 0" }}>
            {API_KEYS.map((k, i) => (
              <div key={k.key} className="row between" style={{ padding: "16px 24px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <div className="row" style={{ gap: 14 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: k.env === "prod" ? "var(--blue-soft)" : "var(--violet-soft)",
                    color: k.env === "prod" ? "var(--blue)" : "var(--violet)",
                    display: "grid", placeItems: "center",
                  }}>
                    <Icon name="key" size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{k.label}</div>
                    <div className="mono t-3" style={{ fontSize: 11.5, marginTop: 2 }}>{k.key}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 16 }}>
                  <span className="t-3" style={{ fontSize: 11 }}>Uso {k.last}</span>
                  <button className="btn btn-ghost btn-sm" aria-label="copy"><Icon name="copy" size={12} /></button>
                  <button className="btn btn-ghost btn-sm" aria-label="view"><Icon name="eye" size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3>{t("api_quick")}</h3>
            <span className="badge violet no-dot" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>v1.4</span>
          </div>
          <pre className="code" style={{ margin: 0 }}>
            <span className="c">{"// Submeter uma NF-e para antecipação"}</span>{"\n"}
            <span className="k">POST</span> <span className="s">/v1/anticipations</span>{"\n"}
            {"Authorization: Bearer "}<span className="n">cb_live_sk_***</span>{"\n\n"}
            {"{\n"}
            {"  "}<span className="p">&quot;nfe_xml&quot;</span>{": "}<span className="s">&quot;&lt;nfeProc&gt;...&quot;</span>{",\n"}
            {"  "}<span className="p">&quot;sacado_cnpj&quot;</span>{": "}<span className="s">&quot;47960950000121&quot;</span>{",\n"}
            {"  "}<span className="p">&quot;client_id&quot;</span>{": "}<span className="s">&quot;pme_4a8f92b1&quot;</span>{",\n"}
            {"  "}<span className="p">&quot;stellar_account&quot;</span>{": "}<span className="s">&quot;GDCH...&quot;</span>{"\n"}
            {"}"}
          </pre>
          <a href="#" className="row" style={{ gap: 6, color: "var(--blue)", fontSize: 13, marginTop: 14, textDecoration: "none" }}>
            Ver documentação completa <Icon name="arrow_right" size={13} />
          </a>
        </div>
      </div>

      {/* Monitor + webhooks */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3>{t("api_monitor")}</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>últimas 24h · todas as rotas</p>
            </div>
            <span className="row" style={{ gap: 6, fontSize: 12, color: "var(--fg-2)" }}>
              <span className="dot-live" /> Ao vivo
            </span>
          </div>
          <div style={{ padding: 20 }}>
            <TrafficChart />
            <div className="row" style={{ gap: 24, marginTop: 16, fontSize: 12 }}>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, background: "var(--blue)",  borderRadius: 2 }} /> 2xx · 284.210</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, background: "var(--amber)", borderRadius: 2 }} /> 4xx · 492</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, background: "var(--red)",   borderRadius: 2 }} /> 5xx · 10</span>
            </div>
          </div>
          {/* Event stream */}
          <div style={{ borderTop: "1px solid var(--line)", padding: "4px 0" }}>
            {LOG_EVENTS.map((e, i) => (
              <div key={e.t} className="row" style={{ gap: 14, padding: "10px 24px", fontFamily: "var(--mono)", fontSize: 12, borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span className="t-3" style={{ width: 90 }}>{e.t}</span>
                <span style={{ width: 44, color: e.color, fontWeight: 600 }}>{e.m}</span>
                <span className="t-2" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{e.p}</span>
                <span className="t-green">{e.code}</span>
                <span className="t-3" style={{ width: 60, textAlign: "right" }}>{e.dur}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <h3>{t("api_webhooks")}</h3>
            <button className="btn btn-ghost btn-sm"><Icon name="plus" size={12} /></button>
          </div>
          <div>
            {WEBHOOKS.map((w, i) => (
              <div key={w.url} style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{w.url}</span>
                  <span className={`badge ${w.status === "ok" ? "completed" : w.status === "warn" ? "pending" : "defaulted"}`}>{w.delivery}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {w.events.map(ev => (
                    <span key={ev} style={{ fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 7px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 4, color: "var(--fg-2)" }}>{ev}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
