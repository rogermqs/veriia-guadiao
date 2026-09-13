"use client";
import { useEffect, useRef } from "react";
import { X, ArrowUpRight, FileText, AlertCircle } from "lucide-react";
export const date = (s: string) =>
  s ? s.split("T")[0].split("-").reverse().join("/") : "Prazo não definido";
export const number = (n: any) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const labels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  completed: "Concluído",
  closed: "Concluído",
  cancelled: "Cancelado",
  unknown: "Não informado",
  active: "Vigente",
  superseded: "Substituída",
  revoked: "Revogada",
  synced: "Sincronizado",
  pending: "Sincronização pendente",
  queued: "Na fila",
  running: "Em processamento",
  succeeded: "Concluído",
  failed: "Falha",
};
export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{labels[value] || value}</span>;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  ) : null;
}
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-head">
        <span>
          <small>INFORMAÇÃO VERIFICÁVEL</small>
          <h2>{title}</h2>
        </span>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X size={21} />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </dialog>
  );
}
export function Source({ data }: { data: any }) {
  const p = data.payload || data;
  return (
    <>
      <span className="origin-pill">
        {p.origin_kind === "public_real" ? "DADOS PÚBLICOS" : "SIMULAÇÃO"}
      </span>
      <h3>{p.title || p.source?.title || "Resultado da consulta"}</h3>
      {p.data_as_of && (
        <p>
          Base de {date(p.data_as_of)}
          {p.snapshot_id ? ` · Snapshot ${p.snapshot_id}` : ""}
        </p>
      )}
      {p.filters && (
        <details open>
          <summary>Filtros desta análise</summary>
          <dl>
            {Object.entries(p.filters).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {p.content && <pre className="document-content">{p.content}</pre>}
      {p.excerpt && !p.content && (
        <pre className="document-content">{p.excerpt}</pre>
      )}
      {p.result && <ResultTable result={p.result} />}{" "}
      {p.items && !p.content && (
        <div className="source-items">
          {p.items.map((v: any) => (
            <article key={v.id}>
              <h3>{v.title}</h3>
              <p>{v.statement || v.description}</p>
              <Badge value={v.status} />
            </article>
          ))}
        </div>
      )}
      {p.source?.source_url && /^https?:/.test(p.source.source_url) && (
        <a
          className="btn secondary"
          href={p.source.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Página de origem <ArrowUpRight size={16} />
        </a>
      )}
      {p.limitations?.map((s: string) => (
        <p className="muted" key={s}>
          {s}
        </p>
      ))}
      {data.hash && (
        <details>
          <summary>Integridade da evidência</summary>
          <code className="hash">SHA-256: {data.hash}</code>
        </details>
      )}
    </>
  );
}
export function ResultTable({ result }: { result: any }) {
  const rows =
    result.rows ||
    Object.entries(result).map(([metric, value]) => ({ metric, value }));
  if (!rows.length) return <p className="muted">Nenhum registro no filtro.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>
                {k === "label" ? "Categoria" : k === "value" ? "Registros" : k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r: any, i: number) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {typeof r[k] === "number"
                    ? number(r[k])
                    : String(r[k] ?? "Sem dados")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export async function request(
  path: string,
  body?: any,
  method?: string,
  headers?: any,
) {
  const r = await fetch("/api/v1" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  if (r.status === 401 && path !== "/auth/login") {
    window.location.assign("/login");
    throw Error("Sessão expirada");
  }
  if (!r.ok) {
    let error;
    try {
      error = await r.json();
    } catch {}
    throw Error(error?.message || "Não foi possível conectar ao servidor.");
  }
  if (r.status === 204) return null;
  return r.json();
}
export async function download(path: string, body: any, name: string) {
  const r = await fetch("/api/v1" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw Error("Não foi possível exportar.");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
