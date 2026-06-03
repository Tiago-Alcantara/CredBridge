"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@/components/primitives/Icon";
import { useCreateReceivable } from "@/lib/api/receivables";
import { useCreateDocument } from "@/lib/api/documents";

interface UploadZoneProps {
  id?: string;
}

type Phase = "idle" | "form" | "submitting" | "success" | "error";

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SAMPLE_XML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35200100000000000000550010000000011000000018" versao="4.00">
      <ide>
        <dhEmi>2026-06-30T12:00:00-03:00</dhEmi>
      </ide>
      <dest>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Adquirente de Teste S.A.</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Prestacao de Servicos CredBridge</xProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>15000.00</vNF>
        </ICMSTot>
      </total>
      <cobr>
        <dup>
          <dVenc>2026-07-15</dVenc>
        </dup>
      </cobr>
    </infNFe>
  </NFe>
</nfeProc>`;

function downloadSampleXml() {
  const blob = new Blob([SAMPLE_XML_CONTENT], { type: "text/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nfe_modelo_credbridge.xml";
  a.click();
  URL.revokeObjectURL(url);
}

export function UploadZone({ id }: UploadZoneProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [debtorName, setDebtorName] = useState("");
  const [debtorDocument, setDebtorDocument] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customHash, setCustomHash] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createReceivable = useCreateReceivable();
  const createDocument = useCreateDocument();

  const isPending = createReceivable.isPending || createDocument.isPending;

  const handleFillManually = useCallback(() => {
    const dummyBlob = new Blob([SAMPLE_XML_CONTENT], { type: "text/xml" });
    const dummyFile = new File([dummyBlob], "nfe_manual.xml", { type: "text/xml" });
    setFile(dummyFile);
    setErrorMsg(null);
    setPhase("form");
    setDebtorName("");
    setDebtorDocument("");
    setValue("");
    setDueDate("");
    setCustomHash("");
  }, []);

  const pickFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".xml")) {
      setErrorMsg("Apenas arquivos XML são aceitos.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setPhase("form");

    try {
      const hash = await sha256Hex(f);
      setCustomHash(hash);
      const text = await f.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      // Extract Debtor (Sacado) Name
      const destName = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("xNome")[0]?.textContent || "";
      if (destName) setDebtorName(destName);

      // Extract Debtor Document (CNPJ / CPF)
      const destCnpj = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("CNPJ")[0]?.textContent || "";
      const destCpf = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("CPF")[0]?.textContent || "";
      const doc = destCnpj || destCpf || "";
      if (doc) {
        if (doc.length === 14) {
          setDebtorDocument(doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"));
        } else if (doc.length === 11) {
          setDebtorDocument(doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"));
        } else {
          setDebtorDocument(doc);
        }
      }

      // Extract Invoice Value (vNF)
      const vNf = xmlDoc.getElementsByTagName("ICMSTot")[0]?.getElementsByTagName("vNF")[0]?.textContent || "";
      if (vNf) {
        const parsedVal = parseFloat(vNf);
        if (!isNaN(parsedVal)) {
          setValue(parsedVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
        } else {
          setValue(vNf);
        }
      }

      // Extract Due Date (dVenc)
      const dVenc = xmlDoc.getElementsByTagName("cobr")[0]?.getElementsByTagName("dup")[0]?.getElementsByTagName("dVenc")[0]?.textContent || 
                   xmlDoc.getElementsByTagName("ide")[0]?.getElementsByTagName("dhEmi")[0]?.textContent?.split("T")[0] || "";
      if (dVenc) {
        setDueDate(dVenc.split("T")[0]);
      }
    } catch (err) {
      console.warn("Failed to auto-parse XML file:", err);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) pickFile(f);
    },
    [pickFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) pickFile(f);
    },
    [pickFile]
  );

  const handleSubmit = useCallback(async () => {
    if (!file || !debtorName || !debtorDocument || !value || !dueDate || !customHash) return;
    setPhase("submitting");
    setErrorMsg(null);

    try {
      const hash = customHash;
      const receivable = await createReceivable.mutateAsync({
        value: parseFloat(value.replace(/\./g, "").replace(",", ".")),
        type: "invoice",
        debtorName,
        debtorDocument,
        dueDate: new Date(dueDate).toISOString(),
      });

      await createDocument.mutateAsync({
        receivableId: receivable.id,
        type: "invoice",
        url: `https://stub/${encodeURIComponent(file.name)}`,
        hash,
      });

      setPhase("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar NF-e";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [file, debtorName, debtorDocument, value, dueDate, customHash, createReceivable, createDocument]);

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setDebtorName("");
    setDebtorDocument("");
    setValue("");
    setDueDate("");
    setCustomHash("");
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div
      id={id}
      className="card"
      style={{
        padding: 0,
        background: "linear-gradient(180deg, rgba(0,212,255,0.04), rgba(255,255,255,0.01))",
        borderColor: "rgba(0,212,255,0.22)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 24 }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h3>Enviar NF-e</h3>
            <p className="t-2" style={{ fontSize: 13, marginTop: 4 }}>
              Validação SEFAZ em tempo real · proposta em &lt; 60s
            </p>
          </div>
          <span className="badge violet">Soroban v1.4</span>
        </div>

        {/* Idle: drop zone */}
        {phase === "idle" && (
          <>
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              style={{
                border: `1.5px dashed rgba(0,212,255,${dragOver ? "0.8" : "0.4"})`,
                background: dragOver ? "rgba(0,212,255,0.08)" : "rgba(0,212,255,0.04)",
                borderRadius: 12,
                padding: "36px 24px",
                textAlign: "center",
                transition: "all .15s",
              }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "rgba(0,212,255,0.12)", color: "var(--blue)",
                  display: "grid", placeItems: "center", margin: "0 auto 14px",
                }}
              >
                <Icon name="upload" size={22} />
              </div>
              <div style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                Arraste o XML aqui ou clique para selecionar
              </div>
              <div className="t-3" style={{ fontSize: 12 }}>
                XML · até 10 MB · lote de até 50 arquivos
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
              <div className="row center" style={{ gap: 16, marginTop: 20, justifyContent: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="upload" size={14} /> Selecionar XML
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={handleFillManually}
                >
                  <Icon name="plus" size={14} /> Preencher Manualmente
                </button>
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  className="appnav-link"
                  type="button"
                  style={{ fontSize: 12, padding: 0, color: "var(--blue)", border: "none", background: "none", cursor: "pointer" }}
                  onClick={downloadSampleXml}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="doc" size={12} /> Baixar XML de Exemplo para Teste
                  </span>
                </button>
              </div>
            </div>
            {errorMsg && (
              <p style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>{errorMsg}</p>
            )}
          </>
        )}

        {/* Form: fill NF-e data */}
        {(phase === "form" || phase === "error") && (
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 8, padding: "10px 12px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--line)" }}>
              <Icon name="doc" size={14} className="t-2" />
              <span style={{ fontSize: 13, flex: 1 }}>{file?.name}</span>
              <button className="appnav-link" style={{ padding: 0, fontSize: 12 }} onClick={reset}>
                Trocar
              </button>
            </div>

            <div className="grid-2">
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Sacado (razão social)</label>
                <input className="input" placeholder="Empresa Ltda." value={debtorName} onChange={(e) => setDebtorName(e.target.value)} disabled={isPending} />
              </div>
              <div>
                <label className="field-label">CNPJ / CPF</label>
                <input className="input" placeholder="00.000.000/0001-00" value={debtorDocument} onChange={(e) => setDebtorDocument(e.target.value)} disabled={isPending} />
              </div>
              <div>
                <label className="field-label">Valor (R$)</label>
                <input className="input" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} disabled={isPending} />
              </div>
              <div>
                <label className="field-label">Vencimento</label>
                <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isPending} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Hash da Nota (SHA-256)</label>
                <input 
                  className="input" 
                  placeholder="Ex: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" 
                  value={customHash} 
                  onChange={(e) => setCustomHash(e.target.value)} 
                  disabled={isPending} 
                />
              </div>
            </div>

            {errorMsg && (
              <p style={{ color: "var(--red)", fontSize: 13 }}>{errorMsg}</p>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={isPending || !debtorName || !debtorDocument || !value || !dueDate || !customHash}
              onClick={handleSubmit}
            >
              {isPending ? "Enviando…" : <><Icon name="upload" size={14} /> Enviar NF-e</>}
            </button>
          </div>
        )}

        {/* Success */}
        {phase === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--green-soft)", color: "var(--green)",
              display: "grid", placeItems: "center", margin: "0 auto 14px",
            }}>
              <Icon name="check" size={28} />
            </div>
            <h4 style={{ marginBottom: 6 }}>NF-e enviada com sucesso</h4>
            <p className="t-2" style={{ fontSize: 13, marginBottom: 16 }}>
              Seu recebível foi registrado e está em análise.
            </p>
            <button className="btn btn-ghost" onClick={reset}>
              Enviar outra NF-e
            </button>
          </div>
        )}

        {/* Pipeline steps */}
        {phase === "idle" && (
          <div className="row" style={{ gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {(["SEFAZ", "Score", "Proposta", "Cessão", "Pix"] as const).map((s, i) => (
              <span key={s} style={{ display: "contents" }}>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-2)",
                  padding: "3px 8px", background: "var(--surface)",
                  border: "1px solid var(--line)", borderRadius: 6,
                }}>
                  <span className="t-3" style={{ marginRight: 4 }}>0{i + 1}</span>{s}
                </span>
                {i < 4 && <span className="t-3">→</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
