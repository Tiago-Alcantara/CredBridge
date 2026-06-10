"use client";

import { useState } from "react";
import { useUser } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { useToast } from "@/providers/ToastProvider";
import { useGetWallet, useWalletBalance } from "@/lib/api/wallet";
import { findPrivyStellarWalletAddress, type LinkedAccount } from "@/lib/stellar/wallet-address";
import { buildWithdrawalTx, submitWithdrawal } from "@/lib/api/pix";
import { extractApiErrorMessage } from "@/lib/api/client";
import { fmtBRL } from "@/lib/format";

interface WithdrawalDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "form" | "preparing" | "signing" | "submitting" | "success" | "error";
type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export function WithdrawalDrawer({ open, onClose, onSuccess }: WithdrawalDrawerProps) {
  const { showToast } = useToast();
  const { user } = useUser();
  const { signRawHash } = useSignRawHash();
  const { data: wallet } = useGetWallet();
  const { data: balance, refetch: refetchBalance } = useWalletBalance();

  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("CPF");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const walletAddress =
    wallet?.walletType === "privy_stellar"
      ? wallet.contractId
      : findPrivyStellarWalletAddress(user?.linkedAccounts as LinkedAccount[] | undefined);

  const availableBrl = balance?.balance?.value ?? 0;

  const handleClose = () => {
    setStep("form");
    setAmount("");
    setPixKey("");
    setPixKeyType("CPF");
    setErrorMessage(null);
    setTxHash(null);
    onClose();
  };

  const handleWithdraw = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Por favor, insira um valor válido para o saque.", "error");
      return;
    }

    if (parsedAmount > availableBrl) {
      showToast("Saldo insuficiente para realizar este resgate.", "error");
      return;
    }

    if (!pixKey.trim()) {
      showToast("A chave Pix é obrigatória.", "error");
      return;
    }

    if (!walletAddress) {
      showToast("Sua carteira Stellar Privy não foi encontrada.", "error");
      return;
    }

    try {
      setErrorMessage(null);
      
      // Passo 1: Construir transação de queima (burn) no backend
      setStep("preparing");
      const builtTx = await buildWithdrawalTx(parsedAmount);

      // Passo 2: Assinar a transação com Privy
      setStep("signing");
      const { signature } = await signRawHash({
        address: walletAddress,
        chainType: "stellar",
        hash: `0x${builtTx.hashToSign}`,
      });

      if (!signature) {
        throw new Error("Assinatura rejeitada pelo usuário.");
      }

      // Passo 3: Enviar a transação assinada e os dados Pix
      setStep("submitting");
      const result = await submitWithdrawal({
        amount: parsedAmount,
        pixKey: pixKey.trim(),
        pixKeyType,
        xdr: builtTx.xdr,
        signature,
      });

      setTxHash(result.txHash);
      setStep("success");
      showToast("Solicitação de resgate Pix enviada com sucesso!", "success");
      
      // Recarrega o saldo para refletir o débito das cotas
      refetchBalance();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const msg = extractApiErrorMessage(err);
      setErrorMessage(msg);
      setStep("error");
      showToast(msg || "Falha ao processar saque Pix.", "error");
    }
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Resgatar BRL (Pix)" width={560}>
      {step === "form" && (
        <div className="col" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 16, fontSize: 13, background: "rgba(0, 212, 255, 0.04)" }}>
            <span className="t-2" style={{ fontWeight: 600 }}>Saldo Disponível</span>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "var(--accent)" }}>
              {fmtBRL(availableBrl)}
            </div>
            <p className="t-3" style={{ marginTop: 8, lineHeight: 1.5, fontSize: 12 }}>
              Seus tokens BRLT serão queimados na blockchain Stellar e o valor equivalente em Reais (BRL) será depositado instantaneamente na conta bancária associada à chave Pix informada.
            </p>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">Valor do Resgate (BRL)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="input"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">Tipo de Chave Pix</label>
            <select
              className="input"
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
              style={{ appearance: "auto" }}
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Celular</option>
              <option value="EVP">Chave Aleatória (EVP)</option>
            </select>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">Chave Pix de Destino</label>
            <input
              type="text"
              className="input"
              placeholder="Insira a chave Pix correspondente"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleWithdraw}
            disabled={!amount || parseFloat(amount) <= 0 || !pixKey.trim()}
            style={{ marginTop: 12 }}
          >
            Resgatar <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {(step === "preparing" || step === "signing" || step === "submitting") && (
        <div
          className="col"
          style={{ gap: 24, alignItems: "center", textAlign: "center", paddingTop: 48 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "3px solid var(--line)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>
              {step === "preparing" && "Preparando transação…"}
              {step === "signing" && "Aguardando assinatura Privy…"}
              {step === "submitting" && "Processando resgate Pix…"}
            </h3>
            <p className="t-2" style={{ fontSize: 13, maxWidth: 320 }}>
              {step === "preparing" && "Construindo transação Stellar de queima de tokens."}
              {step === "signing" && "Por favor, assine a transação de queima (burn) no pop-up do Privy."}
              {step === "submitting" && "Enviando assinatura Stellar e efetuando ordem de Pix Out."}
            </p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "success" && (
        <div
          className="col"
          style={{ gap: 24, alignItems: "center", textAlign: "center", paddingTop: 32 }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(0, 255, 148, 0.1)",
              color: "var(--green)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="check" size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Solicitação enviada!</h3>
            <p className="t-2" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              Os tokens BRLT correspondentes foram queimados na blockchain e sua ordem de saque Pix está em processamento.
            </p>
          </div>

          <div
            className="card col"
            style={{
              width: "100%",
              padding: 14,
              gap: 8,
              textAlign: "left",
              fontSize: 12.5,
              background: "var(--surface-2)",
            }}
          >
            <div className="row between">
              <span className="t-3">Valor do resgate:</span>
              <span style={{ fontWeight: 600 }}>{fmtBRL(parseFloat(amount))}</span>
            </div>
            {txHash && (
              <div className="col" style={{ gap: 4 }}>
                <span className="t-3">Hash Stellar (Burn):</span>
                <span className="mono" style={{ fontSize: 11, wordBreak: "break-all", color: "var(--fg-2)" }}>
                  {txHash}
                </span>
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={handleClose} style={{ width: "100%", marginTop: 12 }}>
            Concluir
          </button>
        </div>
      )}

      {step === "error" && (
        <div
          className="col"
          style={{ gap: 24, alignItems: "center", textAlign: "center", paddingTop: 32 }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255, 85, 119, 0.1)",
              color: "var(--red)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="close" size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Erro no Resgate</h3>
            <p className="t-2" style={{ fontSize: 13, color: "var(--red)", marginBottom: 16 }}>
              {errorMessage || "Não foi possível concluir a operação."}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setStep("form")} style={{ width: "100%" }}>
            Tentar novamente
          </button>
        </div>
      )}
    </Drawer>
  );
}
