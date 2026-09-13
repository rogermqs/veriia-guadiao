"use client";
import { useState } from "react";
import { request, ErrorBox, ResultTable } from "./ui";
import { Upload, Download, X } from "lucide-react";
export default function CommitmentUpload({ w, onDone, onClose }: any) {
  const [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const base = `/workspaces/${w.id}`;
  return (
    <section className="panel editor-panel">
      <div className="panel-heading">
        <h2>Importar plano de ações</h2>
        <button
          className="icon-btn"
          aria-label="Fechar importação"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <ErrorBox message={error} />
      <a href="/commitments-template.csv" download className="btn secondary">
        <Download size={16} />
        Baixar template CSV
      </a>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            setPreview(
              await request(
                base + "/imports/commitments",
                new FormData(e.currentTarget),
              ),
            );
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Arquivo de compromissos
            <input name="file" type="file" accept=".csv,.xlsx" required />
          </label>
          <label>
            Aba (para XLSX)
            <input name="sheet" />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            <Upload size={16} />
            {busy ? "Analisando…" : "Visualizar importação"}
          </button>
        </div>
      </form>
      {preview && (
        <>
          <h3>
            {preview.rows.length} compromissos válidos · {preview.errors.length}{" "}
            erros
          </h3>
          {preview.errors.map((e: any) => (
            <p key={e.line} className="error">
              Linha {e.line}: {e.reason}
            </p>
          ))}
          <ResultTable result={{ rows: preview.rows }} />
          <div className="form-actions">
            <button
              className="btn primary"
              disabled={busy || !!preview.errors.length}
              onClick={async () => {
                setBusy(true);
                try {
                  await request(
                    base + `/imports/${preview.id}/confirm-mapping`,
                    {},
                    "POST",
                    { "Idempotency-Key": crypto.randomUUID() },
                  );
                  onDone();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar importação
            </button>
          </div>
        </>
      )}
    </section>
  );
}
