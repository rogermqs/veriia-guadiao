"use client";
import { useEffect, useState } from "react";
import { Shield, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { request, Badge, ErrorBox, date } from "./ui";
export default function Admin({ w }: any) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const base = `/workspaces/${w.id}`;
  function load() {
    request(base + "/admin")
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);
  return (
    <>
      <header className="page-title">
        <div>
          <div className="eyebrow">OPERAÇÃO E ACESSOS</div>
          <h1>Administração</h1>
          <p>Controle de acesso e saúde das integrações do espaço.</p>
        </div>
        <button className="btn secondary" onClick={load}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </header>
      <ErrorBox message={error} />
      {data && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Capacidades do sistema</h2>
              <Shield size={19} />
            </div>
            <div className="capability-row">
              <CheckCircle2 size={20} />
              <div>
                <strong>Banco de dados e memória operacional</strong>
                <p>
                  Decisões, compromissos e consultas com persistência local.
                </p>
              </div>
              <Badge value="Disponível" />
            </div>
            <div className="capability-row">
              {data.provider_configured ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <div>
                <strong>Assistente de inteligência artificial</strong>
                <p>
                  {data.provider_configured
                    ? "Provedor e modelo configurados."
                    : "Configure a chave e o modelo do OpenRouter no servidor."}
                </p>
              </div>
              <Badge
                value={
                  data.provider_configured ? "Configurado" : "Não configurado"
                }
              />
            </div>
            <div className="capability-row">
              <CheckCircle2 size={20} />
              <div>
                <strong>Índice de conhecimento</strong>
                <p>
                  Busca {data.knowledge.mode === "text" ? "textual" : "híbrida"}{" "}
                  · {data.jobs.filter((j: any) => j.state === "queued").length}{" "}
                  sincronizações na fila
                </p>
              </div>
              <Badge
                value={
                  data.knowledge.status === "degraded"
                    ? "degraded"
                    : "Disponível"
                }
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Acessos do espaço</h2>
                <p>Contas criadas pelo administrador local.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {data.memberships.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          aria-label={`Papel de ${u.name}`}
                          value={u.role}
                          onChange={async (e) => {
                            try {
                              await request(
                                base + "/memberships/" + u.id,
                                { role: e.target.value },
                                "PATCH",
                              );
                              load();
                            } catch (err: any) {
                              setError(err.message);
                            }
                          }}
                        >
                          {[
                            ["admin", "Administrador"],
                            ["manager", "Gestor"],
                            ["analyst", "Analista"],
                            ["reader", "Leitor"],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Sincronização da memória</h2>
                <p>Uma falha de indexação não apaga o registro salvo.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Registro</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                    <th>Tentativas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j: any) => (
                    <tr key={j.id}>
                      <td>
                        <code>{j.entity_id.slice(0, 8)}</code>
                      </td>
                      <td>
                        {
                          {
                            documents: "Documento",
                            decisions: "Decisão",
                            commitments: "Compromisso",
                          }[j.kind]
                        }
                      </td>
                      <td>
                        <Badge value={j.state} />
                      </td>
                      <td>{j.attempts}</td>
                      <td>
                        {j.state === "failed" && (
                          <button
                            className="btn small secondary"
                            onClick={() =>
                              request(base + "/jobs/" + j.id + "/retry", {})
                                .then(load)
                                .catch((e) => setError(e.message))
                            }
                          >
                            Tentar novamente
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
