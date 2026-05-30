"use client";

import { useState } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { Icon } from "@/components/primitives/Icon";
import { extractApiErrorMessage } from "@/lib/api/client";
import { usePrepareAssignment, useSubmitAssignment } from "@/lib/api/receivables";
import { fmtBRL } from "@/lib/format";

interface CessaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  receivableId: string;
  nfeNumber: string;
  sacado: string;
  valor: number;
  desagio: number;
  liquido: number;
  userEmail?: string | null;
}

export function CessaoModal({
  isOpen,
  onClose,
  receivableId,
  nfeNumber,
  sacado,
  valor,
  desagio,
  liquido,
}: CessaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const prepareAssignment = usePrepareAssignment();
  const submitAssignment = useSubmitAssignment();
  const { signRawHash } = useSignRawHash();

  if (!isOpen) return null;

  async function handleAssign() {
    setLoading(true);
    setError(null);

    try {
      // 1. Prepara a transação Soroban no backend
      const prepRes = await prepareAssignment.mutateAsync(receivableId);
      const { unsignedXdr, hashToSign, pmeAddress } = prepRes;

      if (!pmeAddress) {
        throw new Error("Carteira Stellar Privy do cliente não localizada.");
      }

      // 2. Solicita a assinatura da transação on-chain do cliente via Privy
      const signatureResult = await signRawHash({
        address: pmeAddress,
        chainType: "stellar",
        hash: `0x${hashToSign}`,
      });

      if (!signatureResult?.signature) {
        throw new Error("Assinatura recusada ou falhou.");
      }

      // 3. Envia o XDR e a assinatura hex de volta para envelopamento e submissão na Stellar
      await submitAssignment.mutateAsync({
        id: receivableId,
        unsignedXdr,
        signatureHex: signatureResult.signature,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 3000);
    } catch (err: unknown) {
      console.error("Cessão falhou:", err);
      setError(extractApiErrorMessage(err) || "Ocorreu um erro ao assinar a cessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-content" style={contentStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={iconContainerStyle}>
              <Icon name="doc" size={18} />
            </span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>
              Cessão Fiduciária de Recebível
            </h3>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        {success ? (
          <div style={successContainerStyle}>
            <span style={successIconStyle}>✓</span>
            <h4 style={{ margin: "12px 0 6px 0", color: "var(--green)" }}>Cessão Concluída!</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-muted)" }}>
              A transação foi assinada e enviada para a Stellar Testnet com sucesso.
            </p>
          </div>
        ) : (
          <>
            <div style={bodyStyle}>
              <div style={detailsGridStyle}>
                <div style={detailBoxStyle}>
                  <div style={labelStyle}>NF-e</div>
                  <div style={valueStyle}>{nfeNumber}</div>
                </div>
                <div style={detailBoxStyle}>
                  <div style={labelStyle}>Sacado</div>
                  <div style={valueStyle}>{sacado}</div>
                </div>
              </div>

              <div style={financialCardStyle}>
                <div style={financialRowStyle}>
                  <span style={labelStyle}>Valor de Face</span>
                  <span style={{ fontWeight: 500 }}>{fmtBRL(valor)}</span>
                </div>
                <div style={financialRowStyle}>
                  <span style={labelStyle}>Taxa de Deságio</span>
                  <span style={{ color: "var(--red)" }}>-{desagio.toFixed(2)}%</span>
                </div>
                <hr style={dividerStyle} />
                <div style={financialRowStyle}>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>Valor Líquido a Receber</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>
                    {fmtBRL(liquido)}
                  </span>
                </div>
              </div>

              <div style={contractBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="chain" size={14} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                    Contrato Digital de Cessão
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.4 }}>
                  Ao clicar em assinar, você autoriza a transferência de propriedade da NF-e tokenizada para a Pool de Liquidez da CredBridge de forma descentralizada on-chain.
                </p>
                <div style={fileMockStyle}>
                  <Icon name="doc" size={16} />
                  <span style={{ fontSize: 12, color: "var(--fg-2)" }}>contrato_cessao_fiduciaria.pdf (Em breve)</span>
                </div>
              </div>

              {error && <div style={errorStyle}>{error}</div>}
            </div>

            <div style={footerStyle}>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                disabled={loading}
                style={{ minWidth: 100 }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={loading}
                style={{
                  minWidth: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={spinnerStyle} />
                    Assinando…
                  </>
                ) : (
                  <>
                    <Icon name="key" size={14} />
                    Assinar e Confirmar
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 🎨 Estilos Premium Inline (Evita conflitos de CSS global)
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const contentStyle: React.CSSProperties = {
  backgroundColor: "var(--card-bg, #1a1b1f)",
  border: "1px solid var(--border-color, #2a2b2f)",
  borderRadius: 16,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border-color, #2a2b2f)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const iconContainerStyle: React.CSSProperties = {
  backgroundColor: "rgba(123, 47, 255, 0.1)",
  color: "var(--violet, #7B2FFF)",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--fg-muted)",
  padding: 4,
};

const bodyStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const detailBoxStyle: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--border-color, #2a2b2f)",
  borderRadius: 10,
  padding: "10px 14px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--fg-muted, #7e8085)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--fg)",
};

const financialCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  border: "1px solid var(--border-color, #2a2b2f)",
  borderRadius: 12,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const financialRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
};

const dividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border-color, #2a2b2f)",
  margin: "4px 0",
};

const contractBoxStyle: React.CSSProperties = {
  backgroundColor: "rgba(123, 47, 255, 0.03)",
  border: "1px dashed rgba(123, 47, 255, 0.2)",
  borderRadius: 12,
  padding: 14,
};

const fileMockStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  borderRadius: 8,
  padding: "8px 12px",
  marginTop: 10,
  border: "1px solid var(--border-color, #2a2b2f)",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderTop: "1px solid var(--border-color, #2a2b2f)",
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
};

const successContainerStyle: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
};

const successIconStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  backgroundColor: "rgba(16, 185, 129, 0.1)",
  color: "var(--green, #10b981)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: "bold",
};

const errorStyle: React.CSSProperties = {
  color: "var(--red)",
  backgroundColor: "rgba(239, 68, 68, 0.05)",
  border: "1px solid rgba(239, 68, 68, 0.15)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: "2px solid rgba(255, 255, 255, 0.3)",
  borderTop: "2px solid white",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
