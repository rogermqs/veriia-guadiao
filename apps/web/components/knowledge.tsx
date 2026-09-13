"use client";
import { useEffect, useState } from "react";
import {
  Search,
  Upload,
  FileText,
  ArrowUpRight,
  X,
  BookOpen,
} from "lucide-react";
import { request, Badge, date, ErrorBox, Empty, Drawer } from "./ui";
export default function Knowledge({ w, onSource }: any) {
  const [items, setItems] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState<any[] | null>(null),
    [error, setError] = useState(""),
    [upload, setUpload] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const base = `/workspaces/${w.id}`;
  function load() {
    request(base + "/documents")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await request(base + "/knowledge/search", { query });
      setHits(r.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const file = f.get("file") as File;
    try {
      const content = await file.text();
      await request(
        base + "/documents",
        {
          title: f.get("title"),
          content,
          effective_date: f.get("effective_date"),
          source_url: f.get("source_url") || "",
        },
        "POST",
        { "Idempotency-Key": crypto.randomUUID() },
      );
      setUpload(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-title">
        <div>
          <div className="eyebrow">CONTEXTO INSTITUCIONAL</div>
          <h1>Conhecimento</h1>
          <p>Atas, procedimentos e documentos que dão contexto às decisões.</p>
        </div>
        {["admin", "analyst"].includes(w.role) && (
          <button className="btn primary" onClick={() => setUpload(!upload)}>
            <Upload size={17} />
            Importar documento
          </button>
        )}
      </header>
      <ErrorBox message={error} />
      {upload && (
        <section className="panel editor-panel">
          <h2>Importar documento Markdown</h2>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                Título
                <input name="title" required minLength={3} />
              </label>
              <label>
                Data do documento
                <input
                  name="effective_date"
                  type="date"
                  required
                  defaultValue="2026-09-13"
                />
              </label>
              <label>
                Arquivo Markdown (até 2 MiB)
                <input
                  name="file"
                  type="file"
                  accept=".md,.markdown"
                  required
                />
              </label>
              <label>
                Página de origem
                <input
                  name="source_url"
                  type="url"
                  required={w.id === "real"}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setUpload(false)}
              >
                Cancelar
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Importando…" : "Salvar documento"}
              </button>
            </div>
          </form>
        </section>
      )}
      <form className="knowledge-search" onSubmit={search}>
        <div className="search-field">
          <Search size={18} />
          <input
            placeholder="Buscar nas atas e documentos…"
            aria-label="Buscar conhecimento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "Buscando…" : "Buscar conteúdo"}
        </button>
        {hits && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setHits(null);
              setQuery("");
            }}
          >
            Limpar busca
          </button>
        )}
      </form>
      <div className="section-caption">
        <span>{hits ? "RESULTADOS DA BUSCA" : "BIBLIOTECA DO ESPAÇO"}</span>
        <span>
          {(hits || items).length} documentos ·{" "}
          {w.id === "demo" ? "Conteúdo fictício" : "Documentos públicos"}
        </span>
      </div>
      {!(hits || items).length ? (
        <Empty
          title={
            hits ? "Nenhuma fonte localizada" : "Sua biblioteca começa aqui"
          }
        >
          {hits
            ? "Experimente termos presentes no documento. Documentos ainda em sincronização podem não aparecer."
            : "Importe documentos Markdown para construir o conhecimento deste espaço."}
        </Empty>
      ) : (
        <div className="document-list">
          {(hits || items).map((d) => (
            <button
              className="document-row"
              key={d.id}
              onClick={() =>
                request(base + "/documents/" + d.id)
                  .then(setDetail)
                  .catch((e) => setError(e.message))
              }
            >
              <div className="document-symbol">
                <FileText size={23} />
              </div>
              <div>
                <h3>{d.title}</h3>
                <p>
                  Documento Markdown · Versão {d.version} ·{" "}
                  {w.id === "demo" ? "SIMULAÇÃO" : "DADOS PÚBLICOS"}
                </p>
                {d.excerpt && (
                  <p className="excerpt">{d.excerpt.slice(0, 150)}…</p>
                )}
              </div>
              <Badge value={d.indexing_state} />
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      )}
      {detail && (
        <Drawer title={detail.title} onClose={() => setDetail(null)}>
          <span className="origin-pill">
            {w.id === "demo" ? "SIMULAÇÃO" : "DADOS PÚBLICOS"}
          </span>
          <p>
            Versão {detail.version} · Data efetiva {date(detail.effective_date)}
          </p>
          <pre className="document-content">{detail.content}</pre>
          <code className="hash">SHA-256 {detail.sha256}</code>
          {["admin", "analyst"].includes(w.role) && (
            <details>
              <summary>Importar nova versão</summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const f = new FormData(e.currentTarget);
                  try {
                    const content = await (f.get("file") as File).text();
                    const next = await request(
                      base + "/documents/" + detail.id + "/versions",
                      {
                        title: detail.title,
                        content,
                        effective_date: f.get("effective_date"),
                        source_url: detail.source_url || "",
                      },
                      "POST",
                      {
                        "Idempotency-Key": crypto.randomUUID(),
                        "If-Match": String(detail.version),
                      },
                    );
                    setDetail(next);
                    load();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Arquivo Markdown
                  <input
                    name="file"
                    type="file"
                    accept=".md,.markdown"
                    required
                  />
                </label>
                <label>
                  Data efetiva
                  <input
                    name="effective_date"
                    type="date"
                    required
                    defaultValue={detail.effective_date}
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Salvar nova versão
                </button>
              </form>
            </details>
          )}
        </Drawer>
      )}
    </>
  );
}
