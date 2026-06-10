"use client";

import { useState, useEffect } from "react";
import { useActiveCollections, ReceivableCollection, retryCollection } from "@/lib/api/collections";
import { Icon } from "@/components/primitives/Icon";
import { useToast } from "@/providers/ToastProvider";

export default function PmeCollectionsPage() {
  const { data: collections = [], isLoading, isError, refetch } = useActiveCollections();
  const { showToast } = useToast();
  const [selectedCollection, setSelectedCollection] = useState<ReceivableCollection | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const currentCollection = selectedCollection
    ? collections.find((c) => c.id === selectedCollection.id) || selectedCollection
    : null;

  // Polling: refetch every 5 seconds when a pending collection modal is open
  useEffect(() => {
    if (!currentCollection) return;
    const isPending =
      currentCollection.status.toLowerCase() === "pending" ||
      currentCollection.status.toLowerCase() === "pending_payment";

    if (!isPending) return;

    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentCollection, refetch]);

  const handleRetryCollection = async (collectionId: string) => {
    try {
      setIsRetrying(true);
      const updated = await retryCollection(collectionId);
      setSelectedCollection(updated);
      showToast("Cobrança Pix gerada com sucesso!", "success");
      refetch();
    } catch (err: any) {
      const msg = err?.message || "Falha ao gerar cobrança Pix.";
      showToast(msg, "error");
    } finally {
      setIsRetrying(false);
    }
  };

  const formatBRL = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const handleCopyPix = (payload: string) => {
    navigator.clipboard.writeText(payload);
    showToast("Código Pix Copia e Cola copiado com sucesso!", "success");
  };

  const getQrCodeSrc = (base64Str: string | null) => {
    if (!base64Str) return "";
    if (base64Str.startsWith("data:")) return base64Str;
    return `data:image/png;base64,${base64Str}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return (
          <span
            className="eyebrow"
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(0, 255, 148, 0.1)",
              color: "#00FF94",
            }}
          >
            PAGA
          </span>
        );
      case "pending":
      case "pending_payment":
        return (
          <span
            className="eyebrow"
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(255, 200, 87, 0.1)",
              color: "#FFC857",
            }}
          >
            PENDENTE
          </span>
        );
      default:
        return (
          <span
            className="eyebrow"
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.1)",
              color: "var(--fg-2)",
            }}
          >
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Gestão de Recebíveis</div>
          <h2 style={{ fontSize: 32 }}>Cobranças de Sacados</h2>
        </div>
        <button className="btn btn-ghost" onClick={() => refetch()} disabled={isLoading}>
          <Icon name="refresh" size={14} className={isLoading ? "spinning" : undefined} /> Atualizar
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
          <h3>Acompanhamento de Cobranças Pix</h3>
          <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
            Visualização de cobranças geradas para devedores (sacados) após antecipação dos recebíveis.
          </p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                <th style={{ padding: "12px 24px" }}>Sacado (Devedor)</th>
                <th style={{ padding: "12px 24px" }}>Valor</th>
                <th style={{ padding: "12px 24px" }}>Vencimento</th>
                <th style={{ padding: "12px 24px" }}>Status</th>
                <th style={{ padding: "12px 24px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center" }} className="t-3">
                    Carregando cobranças...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--red)" }}>
                    Erro ao carregar cobranças.
                  </td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center" }} className="t-3">
                    Nenhuma cobrança ativa encontrada no momento.
                  </td>
                </tr>
              ) : (
                collections.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--line-2)" }}>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ fontWeight: 600 }}>{c.debtorName}</div>
                      <div className="t-3" style={{ fontSize: 12 }}>CNPJ: {c.debtorDocument}</div>
                    </td>
                    <td style={{ padding: "16px 24px", fontWeight: 600 }}>{formatBRL(c.amount)}</td>
                    <td style={{ padding: "16px 24px" }}>{formatDate(c.dueDate)}</td>
                    <td style={{ padding: "16px 24px" }}>{getStatusBadge(c.status)}</td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      {c.status.toLowerCase() === "pending" || c.status.toLowerCase() === "pending_payment" ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedCollection(c)}>
                          <Icon name="zap" size={12} /> Mostrar Pix
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCollection(c)}>
                          Ver Detalhes
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pix QR Code */}
      {selectedCollection && currentCollection && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 0,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="eyebrow" style={{ color: "#00D4FF", marginBottom: 4 }}>Cobrança Pix</span>
                <h3 style={{ fontSize: 20 }}>Pagamento do Sacado</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCollection(null)} style={{ padding: 4 }}>
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20, alignItems: "center", textAlign: "center" }}>
              <div style={{ width: "100%", textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{currentCollection.debtorName}</div>
                <div className="t-3" style={{ fontSize: 13, marginBottom: 12 }}>CNPJ: {currentCollection.debtorDocument}</div>
                <div className="row between" style={{ background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--line-2)" }}>
                  <span className="t-3" style={{ fontSize: 13 }}>Valor da cobrança:</span>
                  <span style={{ fontWeight: 700, color: "var(--fg)" }}>{formatBRL(currentCollection.amount)}</span>
                </div>
              </div>

              {currentCollection.status.toLowerCase() === "pending" || currentCollection.status.toLowerCase() === "pending_payment" ? (
                currentCollection.pixQrCodeBase64 ? (
                  <>
                    <div style={{ background: "white", padding: 16, borderRadius: 12, display: "inline-block", marginTop: 8 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getQrCodeSrc(currentCollection.pixQrCodeBase64)}
                        alt="Pix QR Code"
                        style={{ width: 220, height: 220, display: "block" }}
                      />
                    </div>
                    <p className="t-2" style={{ fontSize: 13, marginTop: 8 }}>
                      Aponte a câmera do aplicativo do seu banco para o QR Code acima para realizar o pagamento.
                    </p>
                    <div style={{ width: "100%", display: "flex", gap: 12, marginTop: 8 }}>
                      {currentCollection.pixQrCodePayload && (
                        <button
                          className="btn btn-violet"
                          onClick={() => handleCopyPix(currentCollection.pixQrCodePayload!)}
                          style={{ flex: 1 }}
                        >
                          <Icon name="copy" size={14} /> Copiar Código
                        </button>
                      )}
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          refetch();
                          showToast("Verificando pagamento...", "info");
                        }}
                        style={{ flex: 1, border: "1px solid var(--line)" }}
                      >
                        <Icon name="refresh" size={14} /> Verificar Status
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255, 85, 119, 0.1)", color: "var(--red)", display: "grid", placeItems: "center" }}>
                      <Icon name="close" size={32} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 600, color: "var(--red)" }}>QR Code Indisponível</h4>
                      <p className="t-3" style={{ fontSize: 13, marginTop: 6, maxWidth: 300, marginBottom: 16 }}>
                        Esta cobrança não possui dados Pix gerados devido a uma falha temporária de comunicação com o serviço Pix.
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleRetryCollection(currentCollection.id)}
                        disabled={isRetrying}
                        style={{ width: "100%" }}
                      >
                        {isRetrying ? "Gerando Pix..." : "Gerar Cobrança Pix"}
                      </button>
                    </div>
                  </div>
                )
              ) : currentCollection.status.toLowerCase() === "paid" ? (
                <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0, 255, 148, 0.1)", color: "#00FF94", display: "grid", placeItems: "center" }}>
                    <Icon name="check" size={32} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 18, fontWeight: 600, color: "#00FF94" }}>Cobrança Liquidada</h4>
                    <p className="t-3" style={{ fontSize: 13, marginTop: 6 }}>
                      O pagamento Pix foi recebido e a liquidação on-chain na Stellar foi concluída com sucesso.
                    </p>
                  </div>
                  {currentCollection.txHash && (
                    <div style={{ width: "100%", background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--line-2)", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all", textAlign: "left" }}>
                      <span className="t-3">Hash da Liquidação Stellar:</span>
                      <div style={{ marginTop: 4, color: "#00FF94" }}>{currentCollection.txHash}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="t-3" style={{ padding: "40px 0" }}>
                  Status da cobrança: {currentCollection.status.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
