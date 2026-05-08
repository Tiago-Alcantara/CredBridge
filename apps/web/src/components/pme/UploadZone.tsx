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

export function UploadZone({ id }: UploadZoneProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [debtorName, setDebtorName] = useState("");
  const [debtorDocument, setDebtorDocument] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createReceivable = useCreateReceivable();
  const createDocument = useCreateDocument();

  const isPending = createReceivable.isPending || createDocument.isPending;

  const pickFile = useCallback((f: File) => {
    if (!f.name.endsWith(".xml")) {
      setErrorMsg("Apenas arquivos XML são aceitos.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setPhase("form");
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
    if (!file || !debtorName || !debtorDocument || !value || !dueDate) return;
    setPhase("submitting");
    setErrorMsg(null);

    try {
      const hash = await sha256Hex(file);
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
  }, [file, debtorName, debtorDocument, value, dueDate, createReceivable, createDocument]);

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setDebtorName("");
    setDebtorDocument("");
    setValue("");
    setDueDate("");
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
              <button
                className="btn btn-primary"
                style={{ marginTop: 20 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={14} /> Selecionar arquivos
              </button>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            </div>

            {errorMsg && (
              <p style={{ color: "var(--red)", fontSize: 13 }}>{errorMsg}</p>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={isPending || !debtorName || !debtorDocument || !value || !dueDate}
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
