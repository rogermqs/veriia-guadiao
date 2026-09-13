"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  HeartPulse,
  Building2,
  UserRound,
  BookOpen,
} from "lucide-react";
import { request, date, ErrorBox, Empty, Drawer } from "./ui";
const labels: Record<string, string> = {
  completed: "Realizada",
  scheduled: "Agendada",
  missed: "Não realizada",
};
export default function Health({ w, onSource }: any) {
  const base = `/workspaces/${w.id}/health`;
  const [data, setData] = useState<any>(null),
    [query, setQuery] = useState(""),
    [unit, setUnit] = useState(""),
    [detail, setDetail] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [visits, setVisits] = useState<any[]>([]);
  const generation = useRef(0);
  async function load(q = query, u = unit) {
    const g = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const r = await request(
        base + "/citizens?" + new URLSearchParams({ query: q, unit_id: u }),
      );
      if (g === generation.current) setData(r);
    } catch (e: any) {
      if (g === generation.current) setError(e.message);
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load("", "");
    request(base + "/visits?status=missed")
      .then((r) => setVisits(r.items))
      .catch((e) => setError(e.message));
    return () => {
      generation.current++;
    };
  }, []);
  async function open(id: string) {
    setError("");
    try {
      setDetail(await request(base + "/citizens/" + encodeURIComponent(id)));
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <header className="page-title">
        <div>
          <div className="eyebrow">SEGUNDO CÉREBRO · ATENÇÃO BÁSICA</div>
          <h1>Saúde do cidadão</h1>
          <p>UBS, atendimentos e visitas conectados em um histórico.</p>
        </div>
        <HeartPulse size={28} />
      </header>
      <div className="notice">
        <strong>Dados inteiramente fictícios</strong>
        <p>
          Esta demonstração não contém prontuários reais. Medicamentos e
          prescrições são exemplos de registro, sem orientação de tratamento.
        </p>
      </div>
      <ErrorBox message={error} />
      <section className="panel health-panel">
        <form
          className="health-filters"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label>
            Buscar cidadão
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: Maria Oliveira"
              maxLength={150}
            />
          </label>
          <label>
            UBS de referência
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">Todas as UBS</option>
              {data?.units.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={loading}>
            <Search size={16} />
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>
        {data && (
          <p className="muted">
            {data.total} cidadãos no recorte · Base demonstrativa de{" "}
            {date(data.data_as_of)}
          </p>
        )}
        <div className="health-citizens">
          {data?.items.map((c: any) => (
            <button
              className="health-citizen"
              key={c.id}
              onClick={() => open(c.id)}
            >
              <span className="health-citizen-icon">
                <UserRound size={22} />
              </span>
              <strong>{c.name}</strong>
              <small>{c.id}</small>
              <span>
                <Building2 size={14} />
                {c.unit_name}
              </span>
              <span>Agente: {c.agent_name}</span>
              <span className="health-open">Consultar histórico →</span>
            </button>
          ))}
        </div>
        {data && !data.items.length && (
          <Empty title="Nenhum cidadão encontrado">
            {w.id === "demo"
              ? "Ajuste o nome ou o filtro de UBS."
              : "A base fictícia está disponível no Município Demonstração."}
          </Empty>
        )}
      </section>
      {!!visits.length && (
        <section className="panel health-panel">
          <h2>Visitas que precisam de acompanhamento</h2>
          <p className="muted">
            Visitas não realizadas na demonstração. O registro não comprova
            atendimento.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cidadão</th>
                  <th>Agente</th>
                  <th>UBS</th>
                  <th>Data prevista</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button
                        className="health-link"
                        onClick={() => open(v.citizen_id)}
                      >
                        {v.citizen_name}
                      </button>
                    </td>
                    <td>{v.agent_name}</td>
                    <td>{v.team_unit_name}</td>
                    <td>{date(v.visited_on)}</td>
                    <td>{labels[v.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {detail && (
        <Drawer
          title={"Histórico de " + detail.citizen.name}
          onClose={() => setDetail(null)}
        >
          <span className="origin-pill">SIMULAÇÃO · SAÚDE</span>
          <h2>{detail.citizen.name}</h2>
          <p>
            {detail.citizen.id} · Nascimento: {date(detail.citizen.birth_date)}
          </p>
          <p>
            <strong>UBS de referência:</strong> {detail.citizen.unit_name}
            <br />
            <strong>Agente responsável:</strong> {detail.citizen.agent_name}
          </p>
          <p>{detail.citizen.history}</p>
          <button
            className="btn secondary"
            onClick={() => {
              request(`/workspaces/${w.id}/sources/${detail.evidence_id}`)
                .then((source) => {
                  onSource(source);
                  setDetail(null);
                })
                .catch((e) => setError(e.message));
            }}
          >
            <BookOpen size={16} />
            Ver fonte do histórico
          </button>
          <h3>Atendimentos e prescrições</h3>
          <div className="health-timeline">
            {detail.encounters.map((e: any) => (
              <article key={e.id}>
                <small>
                  {date(e.occurred_on)} · {e.unit_name}
                </small>
                <h4>{e.reason}</h4>
                <p>{e.professional}</p>
                <p>{e.notes}</p>
                <strong>Prescrição registrada</strong>
                {e.prescriptions.length ? (
                  e.prescriptions.map((p: any) => (
                    <p key={p.id}>
                      {p.medication}
                      <br />
                      <small>{p.instructions}</small>
                    </p>
                  ))
                ) : (
                  <p>Nenhuma prescrição neste atendimento.</p>
                )}
              </article>
            ))}
          </div>
          <h3>Visitas domiciliares</h3>
          <div className="health-timeline">
            {detail.visits.map((v: any) => (
              <article key={v.id}>
                <small>
                  {date(v.visited_on)} · {labels[v.status]}
                </small>
                <h4>{v.agent_name}</h4>
                <p>
                  {v.team_unit_name} · {v.notes}
                </p>
              </article>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}
