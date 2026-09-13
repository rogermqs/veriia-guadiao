"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  GitBranch,
  ClipboardCheck,
  CalendarDays,
  Save,
  X,
} from "lucide-react";
import CommitmentUpload from "./commitment-upload";
import { request, Badge, date, Empty, ErrorBox, Drawer } from "./ui";
export default function Records({ w, kind, onSource }: any) {
  const isDecision = kind === "decisions",
    base = `/workspaces/${w.id}/${kind}`,
    canWrite = w.id === "demo" && ["admin", "manager"].includes(w.role);
  const [items, setItems] = useState<any[]>([]),
    [documents, setDocuments] = useState<any[]>([]),
    [decisions, setDecisions] = useState<any[]>([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false),
    [loading, setLoading] = useState(true);
  const deps = [
    "Secretaria de Zeladoria",
    "Secretaria de Obras",
    "Secretaria de Meio Ambiente",
  ];
  async function load() {
    try {
      const r = await request(base);
      setItems(r.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    request(`/workspaces/${w.id}/documents`)
      .then((r) => setDocuments(r.items))
      .catch(() => {});
    if (!isDecision)
      request(`/workspaces/${w.id}/decisions`)
        .then((r) => setDecisions(r.items))
        .catch(() => {});
  }, []);
  const filtered = items.filter(
    (v) =>
      (!search ||
        JSON.stringify(v)
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))) &&
      (!status ||
        (status === "overdue"
          ? v.due_date &&
            v.due_date < w.reference_date &&
            ["open", "in_progress"].includes(v.status)
          : v.status === status)),
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const body: any = isDecision
      ? {
          title: f.title,
          statement: f.statement,
          rationale: f.rationale || "",
          department: f.department,
          decided_on: f.decided_on,
          status: f.status || "active",
        }
      : {
          title: f.title,
          description: f.description || "",
          department: f.department,
          owner_name: f.owner_name || null,
          due_date: f.due_date || null,
          status: f.status || "open",
          neighborhood: editing.neighborhood || null,
          decision_id: editing.decision_id || null,
        };
    const document = documents.find((d) => d.id === f.source_document);
    body.source_refs = document
      ? [{ document_id: document.id, version: document.version }]
      : [];
    if (!isDecision) body.decision_id = f.decision_id || null;
    if (isDecision && f.supersedes_id) body.supersedes_id = f.supersedes_id;
    if (isDecision && !editing.id && f.commitment_title)
      body.commitments = [
        {
          title: f.commitment_title,
          department: f.department,
          due_date: f.commitment_due || null,
          status: "open",
        },
      ];
    try {
      await request(
        base + (editing.id ? "/" + editing.id : ""),
        body,
        editing.id ? "PATCH" : "POST",
        {
          "Idempotency-Key": crypto.randomUUID(),
          ...(editing.id ? { "If-Match": String(editing.version) } : {}),
        },
      );
      setEditing(null);
      await load();
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
          <div className="eyebrow">MEMÓRIA OPERACIONAL</div>
          <h1>{isDecision ? "Decisões" : "Compromissos"}</h1>
          <p>
            {isDecision
              ? "O que foi decidido, por quem e em qual contexto."
              : "Transforme decisões em entregas acompanháveis."}
          </p>
        </div>
        {canWrite && !isDecision && (
          <button className="btn secondary" onClick={() => setImporting(true)}>
            Importar plano de ações
          </button>
        )}
        {canWrite && (
          <button className="btn primary" onClick={() => setEditing({})}>
            <Plus size={17} />
            {isDecision ? "Registrar decisão" : "Novo compromisso"}
          </button>
        )}
      </header>
      <ErrorBox message={error} />
      {w.id === "real" && (
        <div className="notice">
          O espaço de Curitiba é reservado à consulta de dados públicos.
          Registros operacionais ficam disponíveis no Município Demonstração.
        </div>
      )}
      {importing && (
        <CommitmentUpload
          w={w}
          onDone={load}
          onClose={() => setImporting(false)}
        />
      )}
      {editing && (
        <section className="panel editor-panel">
          <div className="panel-heading">
            <h2>
              {editing.id
                ? "Editar registro"
                : isDecision
                  ? "Registrar uma decisão"
                  : "Criar compromisso"}
            </h2>
            <button
              className="icon-btn"
              onClick={() => setEditing(null)}
              aria-label="Fechar formulário"
            >
              <X size={19} />
            </button>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="span-two">
                Título
                <input
                  name="title"
                  defaultValue={editing.title}
                  required
                  minLength={3}
                  maxLength={250}
                  placeholder={
                    isDecision
                      ? "Qual decisão deve ficar registrada?"
                      : "Qual entrega será acompanhada?"
                  }
                />
              </label>
              <label>
                Secretaria
                <select
                  aria-label="Secretaria"
                  name="department"
                  defaultValue={editing.department || deps[0]}
                >
                  {deps.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                {isDecision ? "Data da decisão" : "Prazo"}
                <input
                  type="date"
                  name={isDecision ? "decided_on" : "due_date"}
                  required={isDecision}
                  defaultValue={
                    editing.decided_on ||
                    editing.due_date ||
                    (isDecision ? w.reference_date : "")
                  }
                />
              </label>
              {!isDecision && (
                <label>
                  Responsável
                  <input
                    name="owner_name"
                    defaultValue={editing.owner_name || ""}
                    placeholder="Nome do responsável (opcional)"
                  />
                </label>
              )}
              <label>
                Situação
                <select
                  name="status"
                  defaultValue={
                    editing.status || (isDecision ? "active" : "open")
                  }
                >
                  {(isDecision
                    ? ["active", "revoked"]
                    : ["open", "in_progress", "completed", "cancelled"]
                  ).map((s) => (
                    <option value={s} key={s}>
                      {
                        {
                          active: "Vigente",
                          revoked: "Revogada",
                          open: "Aberto",
                          in_progress: "Em andamento",
                          completed: "Concluído",
                          cancelled: "Cancelado",
                        }[s]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-two">
                {isDecision ? "Decisão registrada" : "Descrição"}
                <textarea
                  name={isDecision ? "statement" : "description"}
                  defaultValue={editing.statement || editing.description || ""}
                  rows={3}
                  required={isDecision}
                  placeholder="Registre o contexto e os detalhes necessários."
                />
              </label>
              {isDecision && (
                <label className="span-two">
                  Justificativa
                  <textarea
                    name="rationale"
                    defaultValue={editing.rationale || ""}
                    rows={2}
                  />
                </label>
              )}
              <label className="span-two">
                Documento de origem (opcional)
                <select
                  aria-label="Documento de origem"
                  name="source_document"
                  defaultValue={editing.source_refs?.[0]?.document_id || ""}
                >
                  <option value="">Registro direto do usuário</option>
                  {documents.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.title} · v{d.version}
                    </option>
                  ))}
                </select>
              </label>
              {!isDecision && (
                <label className="span-two">
                  Decisão relacionada (opcional)
                  <select
                    name="decision_id"
                    aria-label="Decisão relacionada"
                    defaultValue={editing.decision_id || ""}
                  >
                    <option value="">Sem decisão vinculada</option>
                    {decisions.map((d) => (
                      <option value={d.id} key={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isDecision && !editing.id && (
                <label className="span-two">
                  Substitui uma decisão anterior (opcional)
                  <select name="supersedes_id" aria-label="Decisão substituída">
                    <option value="">Não substitui decisão anterior</option>
                    {items
                      .filter((d) => d.status === "active")
                      .map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            {isDecision && !editing.id && (
              <details className="bundle-form">
                <summary>Registrar também um compromisso</summary>
                <div className="form-grid">
                  <label>
                    Entrega a acompanhar
                    <input
                      name="commitment_title"
                      placeholder="Opcional"
                      minLength={3}
                    />
                  </label>
                  <label>
                    Prazo da entrega
                    <input name="commitment_due" type="date" />
                  </label>
                </div>
              </details>
            )}
            <div className="form-actions">
              <p>A autoria e o histórico são registrados automaticamente.</p>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="btn primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Salvando…" : "Salvar registro"}
              </button>
            </div>
          </form>
        </section>
      )}
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar registros"
            placeholder={
              isDecision ? "Buscar decisões…" : "Buscar compromissos…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todas as situações</option>
          {(isDecision
            ? ["active", "superseded", "revoked"]
            : ["open", "in_progress", "completed", "cancelled", "overdue"]
          ).map((s) => (
            <option key={s} value={s}>
              {
                {
                  active: "Vigente",
                  superseded: "Substituída",
                  revoked: "Revogada",
                  open: "Aberto",
                  in_progress: "Em andamento",
                  completed: "Concluído",
                  cancelled: "Cancelado",
                  overdue: "Vencidos",
                }[s]
              }
            </option>
          ))}
        </select>
        <span>{filtered.length} registros exibidos</span>
      </div>
      {loading ? (
        <div className="skeleton tall" />
      ) : !filtered.length ? (
        <Empty title="Nenhum registro encontrado">
          {search || status
            ? "Ajuste os filtros para encontrar outros registros."
            : "Os registros deste espaço aparecerão aqui."}
        </Empty>
      ) : (
        <section className="panel records-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{isDecision ? "Decisão" : "Compromisso"}</th>
                  <th>Secretaria</th>
                  {!isDecision && <th>Responsável</th>}
                  <th>{isDecision ? "Decidido em" : "Prazo"}</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button
                        className="table-title"
                        onClick={() =>
                          request(base + "/" + v.id)
                            .then(setDetail)
                            .catch((e) => setError(e.message))
                        }
                      >
                        {v.title}
                      </button>
                      <small className="record-meta">
                        Revisão {v.version} ·{" "}
                        {v.indexing_state === "synced"
                          ? "Memória sincronizada"
                          : "Salvo · Sincronização pendente"}
                      </small>
                    </td>
                    <td>{v.department.replace("Secretaria de ", "")}</td>
                    {!isDecision && <td>{v.owner_name || "Não definido"}</td>}
                    <td>
                      <span
                        className={
                          v.due_date &&
                          v.due_date < w.reference_date &&
                          ["open", "in_progress"].includes(v.status)
                            ? "overdue-text"
                            : ""
                        }
                      >
                        {date(v.decided_on || v.due_date)}
                      </span>
                      {v.due_date &&
                        v.due_date < w.reference_date &&
                        ["open", "in_progress"].includes(v.status) && (
                          <small className="record-meta overdue-text">
                            Vencido no relógio de demonstração
                          </small>
                        )}
                    </td>
                    <td>
                      <Badge value={v.status} />
                    </td>
                    <td>
                      {canWrite ? (
                        <button
                          className="btn small secondary"
                          onClick={() => {
                            setEditing(v);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Editar
                        </button>
                      ) : (
                        <button
                          className="icon-btn"
                          aria-label="Abrir registro"
                          onClick={() =>
                            request(base + "/" + v.id).then(setDetail)
                          }
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="page-footnote">
        {w.id === "demo" ? "SIMULAÇÃO · " : ""}Referência para vencimentos:{" "}
        {date(w.reference_date)}. Um compromisso que vence hoje ainda não está
        vencido.
      </p>
      {detail && (
        <Drawer title={detail.title} onClose={() => setDetail(null)}>
          <Badge value={detail.status} />
          <p className="detail-prose">
            {detail.statement || detail.description}
          </p>
          <dl>
            <div>
              <dt>Secretaria</dt>
              <dd>{detail.department}</dd>
            </div>
            <div>
              <dt>{isDecision ? "Data da decisão" : "Prazo"}</dt>
              <dd>{date(detail.decided_on || detail.due_date)}</dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>Registro do usuário · Simulação</dd>
            </div>
            <div>
              <dt>Autor do registro</dt>
              <dd>
                {detail.created_by === "seed"
                  ? "Equipe fictícia da demonstração"
                  : detail.created_by}
              </dd>
            </div>
          </dl>
          {detail.rationale && (
            <>
              <h3>Justificativa registrada</h3>
              <p>{detail.rationale}</p>
            </>
          )}
          {!!detail.source_refs?.length && (
            <>
              <h3>Documentos de origem</h3>
              {detail.source_refs.map((ref: any) => (
                <button
                  className="btn secondary"
                  key={ref.document_id}
                  onClick={() =>
                    request(
                      `/workspaces/${w.id}/documents/${ref.document_id}?version=${ref.version}`,
                    )
                      .then((d) => {
                        setDetail(null);
                        onSource({ payload: d });
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  Abrir documento · v{ref.version}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </>
          )}
          <h3>Histórico de revisões</h3>
          {detail.revisions.map((r: any) => (
            <details key={r.version}>
              <summary>
                Revisão {r.version} · {date(r.created_at)}
              </summary>
              <pre className="document-content">
                {JSON.stringify(JSON.parse(r.payload), null, 2)}
              </pre>
            </details>
          ))}
        </Drawer>
      )}
    </>
  );
}
