"use client";
import { useEffect, useState } from "react";
import {
  Upload,
  Database,
  Check,
  ArrowUpRight,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { request, date, Badge, Empty, ErrorBox, ResultTable } from "./ui";
export default function Sources({ w, onSource }: any) {
  const [dataset, setDataset] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [ready, setReady] = useState<any>(null),
    [mapping, setMapping] = useState<any>({}),
    [ack, setAck] = useState(false);
  const base = `/workspaces/${w.id}`,
    canImport = ["admin", "analyst"].includes(w.role);
  async function load() {
    try {
      setDataset(await request(base + "/datasets"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function waitImport(id: string) {
    for (let i = 0; i < 600; i++) {
      const current = await request(base + "/imports/" + id);
      if (current.state === "failed")
        throw Error(current.result?.message || "Falha na importação.");
      if (["awaiting_mapping", "ready", "blocked"].includes(current.state))
        return { id, ...current.result };
      await new Promise((r) => setTimeout(r, 500));
    }
    throw Error(
      "A importação continua em processamento. Consulte novamente em instantes.",
    );
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setReady(null);
    try {
      const queued = await request(
        base + "/imports/demands",
        new FormData(e.currentTarget),
      );
      const p = await waitImport(queued.id);
      setPreview(p);
      setMapping(
        Object.fromEntries(
          Object.keys(p.quality.status_values).map((s) => [
            s,
            w.id === "demo"
              ? {
                  Aberto: "open",
                  "Em atendimento": "in_progress",
                  Concluído: "closed",
                  Cancelado: "cancelled",
                }[s] || "unknown"
              : "unknown",
          ]),
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const queued = await request(
        base + `/imports/${preview.id}/confirm-mapping`,
        { status_mapping: mapping },
      );
      setReady(
        queued.state === "processing" ? await waitImport(preview.id) : queued,
      );
      setPreview(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function activate(id: string) {
    setBusy(true);
    try {
      await request(base + `/datasets/dataset-${w.id}/activate`, {
        snapshot_id: id,
        acknowledge: ack,
      });
      setReady(null);
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
          <div className="eyebrow">DADOS COM PROCEDÊNCIA</div>
          <h1>Fontes e importações</h1>
          <p>Da origem dos dados à versão usada em cada análise.</p>
        </div>
        <span className="muted">
          <Database size={17} />
          Um espaço, uma base ativa
        </span>
      </header>
      <ErrorBox message={error} />
      {dataset?.snapshot ? (
        <section className="panel source-active">
          <div className="file-icon">
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <span className="eyebrow">BASE ATIVA</span>
            <h2>{dataset.title}</h2>
            <p>
              Referência: {date(dataset.snapshot.metadata.data_as_of)} ·{" "}
              {dataset.snapshot.quality.accepted_rows.toLocaleString("pt-BR")}{" "}
              registros · {w.id === "demo" ? "Simulação" : "Dados públicos"}
            </p>
          </div>
          <button
            className="btn secondary"
            onClick={() =>
              onSource({
                payload: {
                  ...dataset.snapshot,
                  source: dataset.snapshot.metadata,
                  origin_kind: w.origin_kind,
                  data_as_of: dataset.snapshot.metadata.data_as_of,
                  content: JSON.stringify(dataset.snapshot.quality, null, 2),
                },
              })
            }
          >
            Ver procedência
            <ArrowUpRight size={16} />
          </button>
        </section>
      ) : (
        <Empty title="Nenhuma base ativa">
          Importe um arquivo, revise a qualidade e ative uma versão para iniciar
          as consultas.
        </Empty>
      )}
      {canImport && (
        <section className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Importar registros</h2>
              <p>
                CSV até 200 MiB ou XLSX até 20 MiB. O arquivo será revisado
                antes de ativar.
              </p>
            </div>
            <Upload size={21} />
          </div>
          <form onSubmit={upload}>
            <label className="upload-area">
              <Upload size={25} />
              <strong>Selecione o arquivo de dados</strong>
              <span>Perfil SIAC 156 · CSV ou XLSX</span>
              <input
                name="file"
                type="file"
                accept=".csv,.xlsx"
                required
                aria-label="Arquivo de dados"
              />
            </label>
            <div className="form-grid">
              <label>
                Título da base
                <input
                  name="title"
                  placeholder="Ex.: Atendimento ao cidadão, setembro"
                  required
                  minLength={3}
                />
              </label>
              <label>
                Data de referência
                <input
                  name="data_as_of"
                  type="date"
                  defaultValue="2026-09-13"
                  required
                />
              </label>
              <label>
                Página de origem
                <input
                  name="source_url"
                  type="url"
                  required={w.id === "real"}
                  placeholder="https://dadosabertos…"
                />
              </label>
              <label>
                Data e hora de publicação
                <input name="published_at" type="datetime-local" />
              </label>
              <label>
                Codificação
                <select name="encoding">
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252</option>
                </select>
              </label>
              <label>
                Aba (somente XLSX)
                <input name="sheet" placeholder="Nome exato da aba" />
              </label>
              <label className="span-two">
                Amostra e critérios do recorte
                <input
                  name="sample_info"
                  placeholder="Deixe vazio se o arquivo representar a base completa"
                />
              </label>
            </div>
            <div className="form-actions">
              <p>Os arquivos importados ficam associados a este espaço.</p>
              <button className="btn primary" disabled={busy}>
                <Upload size={16} />
                {busy ? "Processando…" : "Analisar arquivo"}
              </button>
            </div>
          </form>
        </section>
      )}
      {preview && (
        <section className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Prévia e mapeamento</h2>
              <p>
                {preview.quality.total_rows} linhas lidas ·{" "}
                {preview.quality.rejected_rows} rejeitadas ·{" "}
                {preview.quality.duplicate_fingerprint_excess_rows} repetições
                preservadas
              </p>
            </div>
          </div>
          <h3>Como interpretar cada situação</h3>
          <div className="mapping-grid">
            {Object.entries(mapping).map(([raw, status]) => (
              <label key={raw}>
                {raw}
                <select
                  value={String(status)}
                  onChange={(e) =>
                    setMapping({ ...mapping, [raw]: e.target.value })
                  }
                >
                  {[
                    ["open", "Aberto"],
                    ["in_progress", "Em atendimento"],
                    ["closed", "Concluído"],
                    ["cancelled", "Cancelado"],
                    ["unknown", "Desconhecido"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <ResultTable result={{ rows: preview.preview }} />
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setPreview(null)}>
              Descartar prévia
            </button>
            <button className="btn primary" disabled={busy} onClick={confirm}>
              Confirmar mapeamento
              <Check size={17} />
            </button>
          </div>
        </section>
      )}
      {ready && (
        <section className="notice">
          <h3>
            {ready.state === "ready"
              ? "Importação pronta para revisão"
              : "Importação bloqueada por qualidade"}
          </h3>
          <p>
            {ready.quality.accepted_rows} linhas aceitas,{" "}
            {ready.quality.rejected_rows} rejeitadas,{" "}
            {ready.quality.invalid_response_date_records} datas de resposta
            inconsistentes.
          </p>
          {ready.quality.rejections?.map((r: any) => (
            <p key={r.line}>
              Linha {r.line}: {r.reason}
            </p>
          ))}
        </section>
      )}
      {dataset?.snapshots?.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Histórico de versões</h2>
              <p>Ativar uma versão não altera análises já realizadas.</p>
            </div>
            <History size={20} />
          </div>
          {w.role === "admin" && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              Revisei e reconheço as linhas rejeitadas indicadas no relatório.
            </label>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Referência</th>
                  <th>Registros aceitos</th>
                  <th>Qualidade</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dataset.snapshots.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.metadata.title}</strong>
                      <small className="record-meta">
                        {s.id.slice(0, 8)} ·{" "}
                        {s.metadata.sample_info ? "AMOSTRA" : "Base completa"}
                      </small>
                    </td>
                    <td>{date(s.metadata.data_as_of)}</td>
                    <td>{s.quality.accepted_rows.toLocaleString("pt-BR")}</td>
                    <td>{s.quality.rejected_rows} rejeitadas</td>
                    <td>
                      <Badge
                        value={
                          dataset.active_snapshot_id === s.id
                            ? "active"
                            : s.state === "ready"
                              ? "Pronta"
                              : "Bloqueada"
                        }
                      />
                    </td>
                    <td>
                      {w.role === "admin" &&
                        s.state === "ready" &&
                        dataset.active_snapshot_id !== s.id && (
                          <button
                            className="btn small secondary"
                            disabled={busy}
                            onClick={() => activate(s.id)}
                          >
                            Ativar versão
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
    </>
  );
}
