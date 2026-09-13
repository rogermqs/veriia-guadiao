"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  SlidersHorizontal,
  CalendarDays,
  Database,
  Clock3,
  CheckCircle2,
  Inbox,
  Info,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  request,
  number,
  date,
  Badge,
  Empty,
  ErrorBox,
  ResultTable,
  download,
} from "./ui";
export default function Dashboard({
  w,
  navigate,
  onSource,
}: {
  w: any;
  navigate: (s: string) => void;
  onSource: (s: any) => void;
}) {
  const [filters, setFilters] = useState<any>({
      created_from: "2026-09-01",
      created_to: "2026-09-13",
    }),
    [dims, setDims] = useState<any>({}),
    [data, setData] = useState<any>(null),
    [commitments, setCommitments] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [revision, setRevision] = useState(0);
  const base = `/workspaces/${w.id}`;
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    setData(null);
    Promise.all([
      request(base + "/dimensions"),
      request(base + "/analytics/summary", filters),
      request(base + "/analytics/grouped", {
        ...filters,
        group_by: "neighborhood",
      }),
      request(base + "/analytics/grouped", { ...filters, group_by: "subject" }),
      request(base + "/analytics/time-series", filters),
      request(base + "/commitments"),
    ])
      .then(([d, summary, neighborhood, subject, series, c]) => {
        if (alive) {
          setDims(d);
          setData({ summary, neighborhood, subject, series });
          setCommitments(
            c.items
              .filter((v: any) => ["open", "in_progress"].includes(v.status))
              .sort((a: any, b: any) =>
                (a.due_date || "9999").localeCompare(b.due_date || "9999"),
              )
              .slice(0, 4),
          );
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [w.id, JSON.stringify(filters), revision]);
  const change = (key: string, value: string) =>
    setFilters((old: any) => {
      const next = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  const s = data?.summary.result;
  return (
    <>
      <header className="page-title">
        <div>
          <div className="eyebrow">GESTÃO COM CONTEXTO</div>
          <h1>Visão geral</h1>
          <p>Os dados do município, em perspectiva.</p>
        </div>
        <button
          className="btn secondary"
          disabled={!data}
          onClick={() =>
            download(
              base + "/exports/query",
              { query_run_id: data.summary.id },
              "agm-indicadores.csv",
            ).catch((e) => setError(e.message))
          }
        >
          <Download size={16} />
          Exportar dados
        </button>
      </header>
      <div className="filters">
        <span className="filter-label">
          <SlidersHorizontal size={16} />
          Filtros
        </span>
        <label className="date-filter">
          <span>De</span>
          <input
            type="date"
            aria-label="Data inicial"
            value={filters.created_from || ""}
            onChange={(e) => change("created_from", e.target.value)}
          />
        </label>
        <label className="date-filter">
          <span>Até</span>
          <input
            type="date"
            aria-label="Data final"
            value={filters.created_to || ""}
            onChange={(e) => change("created_to", e.target.value)}
          />
        </label>
        <select
          aria-label="Secretaria"
          value={filters.department || ""}
          onChange={(e) => change("department", e.target.value)}
        >
          <option value="">Todas as secretarias</option>
          {dims.departments?.map((d: string) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Bairro"
          value={filters.neighborhood || ""}
          onChange={(e) => change("neighborhood", e.target.value)}
        >
          <option value="">Todos os bairros</option>
          {dims.neighborhoods?.map((d: string) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Serviço"
          value={filters.subject || ""}
          onChange={(e) => change("subject", e.target.value)}
        >
          <option value="">Todos os serviços</option>
          {dims.subjects?.map((d: string) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <button
          className="icon-btn"
          aria-label="Atualizar indicadores"
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {busy ? (
        <div className="skeleton-grid" aria-label="Carregando indicadores">
          {[1, 2, 3, 4].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      ) : error ? (
        <>
          <ErrorBox message={error} />
          <Empty
            title="Uma base de dados é o primeiro passo"
            action={
              <button
                className="btn primary"
                onClick={() => navigate("sources")}
              >
                Abrir fontes e importações
                <ArrowRight size={16} />
              </button>
            }
          >
            Importe os registros deste espaço para calcular os indicadores.
          </Empty>
        </>
      ) : (
        <>
          <div className="base-caption">
            <span>
              <Database size={14} />
              Base de {date(data.summary.data_as_of)}{" "}
              <span className="dot-divider">·</span>{" "}
              {w.id === "demo"
                ? "Dados fictícios de demonstração"
                : "Dados públicos de Curitiba"}
            </span>
            <button onClick={() => onSource({ payload: data.summary })}>
              Ver origem e filtros <ArrowUpRight size={13} />
            </button>
          </div>
          <section className="metrics" aria-label="Indicadores">
            <Metric
              icon={Inbox}
              title="Registros no período"
              value={number(s.total_records)}
              note="Linhas aceitas da base"
            />
            <Metric
              icon={Clock3}
              title="Pendentes no corte"
              value={number(s.pending_records)}
              note="Abertos e em atendimento"
              tone="amber"
            />
            <Metric
              icon={CheckCircle2}
              title="Concluídos no corte"
              value={number(s.closed_records)}
              note="Situação registrada como concluída"
              tone="green"
            />
            <Metric
              icon={CalendarDays}
              title="Tempo até a resposta"
              value={
                s.average_response_days === null
                  ? "Sem dados"
                  : number(s.average_response_days)
              }
              unit={s.average_response_days !== null ? "dias" : ""}
              note={`${number(s.response_observation_count)} respostas válidas para a média`}
              tone="blue"
            />
          </section>
          <div className="dashboard-charts">
            <ChartPanel
              title="Registros por bairro"
              subtitle="Distribuição no período selecionado"
              query={data.neighborhood}
              onSource={onSource}
            >
              <Bars rows={data.neighborhood.result.rows} />
            </ChartPanel>
            <ChartPanel
              title="Registros ao longo do tempo"
              subtitle="Por data de criação, no período selecionado"
              query={data.series}
              onSource={onSource}
            >
              <div className="area-chart">
                <ResponsiveContainer width="100%" height={225}>
                  <AreaChart
                    data={data.series.result.rows}
                    margin={{ left: -20, right: 10, top: 20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#267264"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="100%"
                          stopColor="#267264"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e9edec" />
                    <XAxis
                      dataKey="label"
                      tickFormatter={(s) => s.slice(8)}
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      minTickGap={20}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <Tooltip
                      labelFormatter={(v) => date(String(v))}
                      formatter={(v) => [v, "Registros"]}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#287568"
                      fill="url(#areaFill)"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>
          <div className="dashboard-bottom">
            <ChartPanel
              title="Serviços mais registrados"
              subtitle="Volume não representa eficiência do serviço"
              query={data.subject}
              onSource={onSource}
            >
              <div className="service-list">
                {data.subject.result.rows
                  .slice(0, 6)
                  .map((r: any, i: number) => (
                    <div key={r.label}>
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{r.label}</span>
                      <strong>{number(r.value)}</strong>
                      <span className="mini-track">
                        <i
                          style={{
                            width: `${(r.value / Math.max(...data.subject.result.rows.map((x: any) => x.value))) * 100}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
              </div>
            </ChartPanel>
            <section className="panel commitments-preview">
              <div className="panel-heading">
                <div>
                  <h2>Próximos compromissos</h2>
                  <p>Da decisão ao acompanhamento</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("commitments")}
                >
                  Ver todos <ArrowUpRight size={15} />
                </button>
              </div>
              {commitments.length ? (
                commitments.map((c) => (
                  <button
                    className="commitment-preview-row"
                    key={c.id}
                    onClick={() => navigate("commitments")}
                  >
                    <span className="date-square">
                      <strong>{c.due_date?.slice(8) || "—"}</strong>
                      <small>{c.due_date ? "SET" : "SEM PRAZO"}</small>
                    </span>
                    <span>
                      <strong>{c.title}</strong>
                      <small>
                        {c.department.replace("Secretaria de ", "")} ·{" "}
                        {c.owner_name || "Sem responsável"}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <p className="panel-empty">
                  Nenhum compromisso em aberto neste espaço.
                </p>
              )}
            </section>
          </div>
          <div className="data-note">
            <Info size={16} />
            <p>
              Uma resposta registrada não comprova a execução do serviço.{" "}
              {number(s.unknown_status_records)} registros com situação
              desconhecida e {number(s.cancelled_records)} cancelados neste
              recorte.
            </p>
            <button onClick={() => onSource({ payload: data.summary })}>
              Entenda os indicadores <ArrowUpRight size={14} />
            </button>
          </div>
          <section className="assistant-banner">
            <div className="banner-icon">✳</div>
            <div>
              <h2>Há uma pergunta por trás de cada indicador.</h2>
              <p>
                Explore os dados e conecte as informações ao contexto das
                decisões.
              </p>
            </div>
            <button className="btn primary" onClick={() => navigate("chat")}>
              Conversar com o assistente <ArrowRight size={17} />
            </button>
          </section>
        </>
      )}
    </>
  );
}
function Metric({ icon: Icon, title, value, note, unit, tone = "" }: any) {
  return (
    <article className="metric">
      <div className="metric-label">
        {title}
        <Icon className={tone} size={18} />
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </article>
  );
}
function ChartPanel({ title, subtitle, children, query, onSource }: any) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button
          className="icon-btn"
          aria-label={`Ver fonte: ${title}`}
          onClick={() => onSource({ payload: query })}
        >
          <ArrowUpRight size={17} />
        </button>
      </div>
      {children}
      <details className="chart-table">
        <summary>Ver tabela de dados</summary>
        <ResultTable result={query.result} />
      </details>
    </section>
  );
}
function Bars({ rows }: any) {
  const max = Math.max(1, ...rows.map((r: any) => r.value));
  return (
    <div className="bars">
      {rows.map((r: any, i: number) => (
        <div className="bar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="bar-track">
            <i
              style={{
                width: `${(r.value / max) * 100}%`,
                background: i === 0 ? "#276f62" : "#a7c7be",
              }}
            />
          </div>
          <strong>{number(r.value)}</strong>
        </div>
      ))}
      {!rows.length && (
        <p className="panel-empty">Nenhum registro neste recorte.</p>
      )}
    </div>
  );
}
