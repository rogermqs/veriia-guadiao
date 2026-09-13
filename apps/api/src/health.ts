import { z } from "zod";
import { Store } from "./store";
import { AppError, requireValue } from "./errors";
export const healthSearch = z
  .object({
    query: z.string().max(150).default(""),
    unit_id: z.string().max(80).default(""),
  })
  .strict();
export const healthVisits = z
  .object({
    agent: z.string().max(150).default(""),
    citizen: z.string().max(150).default(""),
    status: z.enum(["all", "completed", "scheduled", "missed"]).default("all"),
  })
  .strict();
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const limits = [
  "Dados inteiramente fictícios para demonstração; não são prontuários reais.",
  "Prescrições simuladas não constituem orientação de tratamento.",
];
const statusLabel: Record<string, string> = {
  completed: "Realizada",
  scheduled: "Agendada",
  missed: "Não realizada",
};
export class Health {
  constructor(private s: Store) {}
  private async evidence(w: string, u: string, payload: any) {
    const value = {
      ...payload,
      origin_kind: (await this.s.workspace(w)).origin_kind,
      data_as_of: "2026-09-13",
      limitations: limits,
    };
    await this.s.audit(w, u, "health.read");
    return {
      ...value,
      evidence_id: await this.s.evidence(w, u, "health_records", value),
    };
  }
  async citizens(w: string, u: string, input: unknown) {
    const p = healthSearch.parse(input);
    const units = await this.s.db
      .prepare(
        "SELECT id,name,neighborhood FROM health_units WHERE workspace_id=? ORDER BY name",
      )
      .all(w);
    const all: any[] = await this.s.db
      .prepare(
        `SELECT c.id,c.name,c.birth_date,c.neighborhood,c.unit_id,h.name unit_name,a.name agent_name FROM health_citizens c JOIN health_units h ON h.workspace_id=c.workspace_id AND h.id=c.unit_id JOIN health_agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id WHERE c.workspace_id=? ORDER BY c.name`,
      )
      .all(w);
    const matched = all.filter(
      (c) =>
        (!p.unit_id || c.unit_id === p.unit_id) &&
        normalize(c.name + " " + c.id).includes(normalize(p.query)),
    );
    const items = matched.slice(0, 50);
    return this.evidence(w, u, {
      title: "Cadastro de saúde — demonstração",
      items,
      units,
      total: matched.length,
      returned: items.length,
      filters: p,
      content:
        items
          .map(
            (c) =>
              `${c.name} (${c.id}) • ${c.unit_name} • Agente: ${c.agent_name} • Bairro: ${c.neighborhood}`,
          )
          .join("\n") || "Nenhum cidadão cadastrado neste recorte.",
    });
  }
  async history(w: string, u: string, id: string) {
    const citizen: any = requireValue(
      await this.s.db
        .prepare(
          `SELECT c.*,h.name unit_name,a.name agent_name FROM health_citizens c JOIN health_units h ON h.workspace_id=c.workspace_id AND h.id=c.unit_id JOIN health_agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id WHERE c.workspace_id=? AND c.id=?`,
        )
        .get(w, id),
    );
    const encounters: any[] = await this.s.db
      .prepare(
        `SELECT e.*,h.name unit_name FROM health_encounters e JOIN health_units h ON h.workspace_id=e.workspace_id AND h.id=e.unit_id WHERE e.workspace_id=? AND e.citizen_id=? ORDER BY e.occurred_on DESC,e.id`,
      )
      .all(w, id);
    for (const e of encounters)
      e.prescriptions = await this.s.db
        .prepare(
          "SELECT id,medication,instructions FROM health_prescriptions WHERE workspace_id=? AND encounter_id=? ORDER BY id",
        )
        .all(w, e.id);
    const visits = await this.visitRows(w);
    const own = visits.filter((v) => v.citizen_id === id);
    const content = [
      `Cidadão fictício: ${citizen.name} (${citizen.id})`,
      `Nascimento: ${citizen.birth_date}; Bairro: ${citizen.neighborhood}`,
      `UBS de referência: ${citizen.unit_name}; Agente responsável: ${citizen.agent_name}`,
      citizen.history,
      ...encounters.map(
        (e) =>
          `\nAtendimento ${e.id} em ${e.occurred_on} — ${e.unit_name}\nProfissional: ${e.professional}\nMotivo: ${e.reason}\nRegistro: ${e.notes}\nPrescrições: ${e.prescriptions.map((p: any) => p.medication + " — " + p.instructions).join("; ") || "Nenhuma registrada"}`,
      ),
      ...own.map(
        (v) =>
          `\nVisita ${v.id} em ${v.visited_on} — ${statusLabel[v.status]}\nLocal: domicílio do cidadão. Agente: ${v.agent_name}; UBS da equipe: ${v.team_unit_name}\n${v.notes}`,
      ),
    ].join("\n");
    return this.evidence(w, u, {
      title: `Histórico de ${citizen.name}`,
      citizen,
      encounters,
      visits: own,
      content,
    });
  }
  private async visitRows(w: string): Promise<any[]> {
    return this.s.db
      .prepare(
        `SELECT v.*,c.name citizen_name,a.name agent_name,h.name team_unit_name FROM health_visits v JOIN health_citizens c ON c.workspace_id=v.workspace_id AND c.id=v.citizen_id JOIN health_agents a ON a.workspace_id=v.workspace_id AND a.id=v.agent_id JOIN health_units h ON h.workspace_id=a.workspace_id AND h.id=a.unit_id WHERE v.workspace_id=? ORDER BY v.visited_on DESC,v.id`,
      )
      .all(w);
  }
  async visits(w: string, u: string, input: unknown) {
    const p = healthVisits.parse(input);
    const all = await this.visitRows(w);
    const matched = all.filter(
      (v) =>
        normalize(v.agent_name).includes(normalize(p.agent)) &&
        normalize(v.citizen_name).includes(normalize(p.citizen)) &&
        (p.status === "all" || v.status === p.status),
    );
    const items = matched.slice(0, 100);
    return this.evidence(w, u, {
      title: "Visitas dos agentes de saúde — demonstração",
      items,
      total: matched.length,
      returned: items.length,
      filters: p,
      content:
        items
          .map(
            (v) =>
              `${v.visited_on} • ${v.citizen_name} • Agente: ${v.agent_name} • UBS da equipe: ${v.team_unit_name} • Local: domicílio do cidadão • ${statusLabel[v.status]} • ${v.notes}`,
          )
          .join("\n") || "Nenhuma visita neste recorte.",
    });
  }
}
export async function seedHealth(s: Store) {
  await s.ready;
  await s.db.transaction(async () => {
    const insert = async (table: string, values: any[]) =>
      s.db
        .prepare(
          `INSERT OR IGNORE INTO ${table} VALUES(${values.map(() => "?").join(",")})`,
        )
        .run(...values);
    const units = [
      ["ubs-norte", "UBS Jardim Norte", "Norte"],
      ["ubs-centro", "UBS Centro", "Centro"],
      ["ubs-sul", "UBS Vila Sul", "Sul"],
    ];
    for (const [id, name, n] of units)
      await insert("health_units", ["demo", id, name, n]);
    const agents = [
      "Ana Ribeiro",
      "Carlos Mendes",
      "Juliana Costa",
      "Paulo Martins",
      "Luciana Rocha",
      "Pedro Almeida",
    ];
    for (let i = 0; i < agents.length; i++)
      await insert("health_agents", [
        "demo",
        `acs-${i + 1}`,
        agents[i],
        units[Math.floor(i / 2)][0],
      ]);
    const names = [
      "Maria Oliveira",
      "José Santos",
      "Ana Ferreira",
      "João Pereira",
      "Rosa Almeida",
      "Pedro Costa",
      "Lucia Martins",
      "Antonio Ribeiro",
      "Clara Gomes",
      "Paulo Rocha",
      "Helena Lima",
      "Marcos Souza",
      "Beatriz Castro",
      "Lucas Melo",
      "Cecilia Nunes",
      "Rafael Barbosa",
      "Laura Azevedo",
      "Bruno Cardoso",
      "Sofia Teixeira",
      "Daniel Moreira",
      "Irene Lopes",
      "Miguel Batista",
      "Teresa Dias",
      "Eduardo Ramos",
    ];
    for (let i = 0; i < names.length; i++) {
      const id = `cid-demo-${String(i + 1).padStart(3, "0")}`,
        unit = units[i % 3],
        agent = `acs-${(i % 3) * 2 + (Math.floor(i / 3) % 2) + 1}`;
      await insert("health_citizens", [
        "demo",
        id,
        names[i],
        `${1955 + i}-03-15`,
        unit[2],
        unit[0],
        agent,
        "Histórico fictício: acompanhamento periódico na atenção básica e atualização de cadastro.",
      ]);
      for (let j = 0; j < 2; j++) {
        const eid = `${id}-at-${j + 1}`,
          date = `2026-${j === 0 ? "08" : "09"}-${String(2 + (i % 10)).padStart(2, "0")}`;
        // One visit to a different unit demonstrates the distinction between reference and attended UBS.
        const attended = i === 0 && j === 0 ? units[1] : unit;
        await insert("health_encounters", [
          "demo",
          eid,
          id,
          attended[0],
          date,
          j === 0
            ? "Dra. Marina Prado (fictícia)"
            : "Enf. Felipe Moura (fictício)",
          j === 0 ? "Consulta de acompanhamento" : "Retorno programado",
          j === 0
            ? "Cadastro e avaliação de rotina registrados na simulação."
            : "Retorno registrado; acompanhamento pela equipe de referência.",
        ]);
        if (j === 1)
          await insert("health_prescriptions", [
            "demo",
            `${eid}-rx`,
            eid,
            "Medicamento demonstrativo A",
            "Prescrição fictícia sem posologia clínica; apenas exemplo de registro.",
          ]);
        const state =
          j === 0
            ? "completed"
            : i % 4 === 0
              ? "scheduled"
              : i % 4 === 1
                ? "missed"
                : "completed";
        const visitDate =
          j === 0
            ? `2026-08-${String(16 + (i % 10)).padStart(2, "0")}`
            : state === "scheduled"
              ? "2026-09-18"
              : `2026-09-${String(3 + (i % 10)).padStart(2, "0")}`;
        await insert("health_visits", [
          "demo",
          `${id}-vis-${j + 1}`,
          id,
          agent,
          visitDate,
          state,
          state === "completed"
            ? "Visita domiciliar realizada para atualização cadastral e acompanhamento."
            : state === "scheduled"
              ? "Visita de acompanhamento agendada."
              : "Morador não localizado; reagendamento pendente.",
        ]);
      }
    }
  })();
}
