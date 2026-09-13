import { Store, hash } from "./store";
import { parseDemands } from "./imports";
import { departments, neighborhoods } from "../../../packages/contracts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
export async function seedDemo(s: Store) {
  if ((await s.dataset("demo")).snapshot) return;
  let state = 20260913;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const services = [
    "Limpeza urbana",
    "Conservação de vias",
    "Iluminação pública",
    "Poda de árvores",
    "Coleta de resíduos",
    "Manutenção de praças",
  ];
  const rows = ["Tipo;Orgao;DataCriacao;Assunto;Situacao;Bairro;DataResposta"];
  const iso = (n: number) =>
    new Date(Date.UTC(2026, 6, 1) + n * 86400000).toISOString().slice(0, 10);
  const reference: any = {
    total_records: 2000,
    pending_records: 0,
    closed_records: 0,
    cancelled_records: 0,
    unknown_status_records: 0,
  };
  for (let i = 0; i < 2000; i++) {
    const day = Math.floor(random() * 75),
      service = Math.floor(random() * 6),
      neighborhood = neighborhoods[Math.floor(random() * 6)],
      r = random();
    const status =
      r < 0.28
        ? "Aberto"
        : r < 0.53
          ? "Em atendimento"
          : r < 0.92
            ? "Concluído"
            : r < 0.98
              ? "Cancelado"
              : "Aguardando vistoria";
    const response =
      ["Concluído", "Em atendimento"].includes(status) && random() > 0.25
        ? iso(Math.min(74, day + 1 + Math.floor(random() * 12)))
        : "";
    rows.push(
      [
        "Solicitação",
        departments[service % 3],
        iso(day),
        services[service],
        status,
        neighborhood,
        response,
      ].join(";"),
    );
    reference[
      status === "Aberto" || status === "Em atendimento"
        ? "pending_records"
        : status === "Concluído"
          ? "closed_records"
          : status === "Cancelado"
            ? "cancelled_records"
            : "unknown_status_records"
    ]++;
  }
  const bytes = Buffer.from(rows.join("\n"));
  const parsed = await parseDemands(bytes, "demo.csv", "2026-09-13");
  const snap = await s.saveSnapshot(
    "demo",
    parsed,
    {
      title: "Atendimento ao cidadão • Base simulada",
      data_as_of: "2026-09-13",
      published_at: "2026-09-13T12:00:00Z",
      source_url: "",
      sample_info: null,
    },
    bytes,
  );
  await s.activate("demo", snap.id, "seed");
  writeFileSync(
    join(s.dir, "seed-manifest.json"),
    JSON.stringify(
      {
        algorithm: "LCG Numerical Recipes v1",
        seed: 20260913,
        sha256: hash(bytes),
        reference,
      },
      null,
      2,
    ),
  );
  const topics = [
    "Vistoria de limpeza no bairro Norte",
    "Revisão do prazo de vistoria no Norte",
    "Conservação de vias no bairro Sul",
    "Iluminação no Centro",
    "Manutenção de praças no Leste",
    "Coleta de resíduos no Oeste",
    "Poda no Jardim das Flores",
    "Triagem de demandas",
    "Planejamento de equipamentos",
    "Rotina de acompanhamento",
    "Qualidade dos registros",
    "Pauta intersecretarial",
  ];
  for (let i = 0; i < 12; i++) {
    const content =
      i === 0
        ? "Em 01/09/2026, a equipe propôs realizar uma vistoria de limpeza no bairro Norte até 12/09/2026. Esta decisão inicial foi posteriormente substituída."
        : i === 1
          ? "Em 10/09/2026, a equipe revisou o prazo da vistoria do bairro Norte para 18/09/2026. A justificativa registrada foi a necessidade de concluir o levantamento de equipamentos. O prazo de 12/09 foi substituído."
          : `A equipe da ${departments[i % 3]} discutiu ${topics[i].toLowerCase()}. Foi proposto reunir as informações disponíveis e registrar as pendências para a próxima reunião. Esta ata não comprova a execução de serviços.`;
    await s.addDocument(
      "demo",
      `Ata ${String(i + 1).padStart(2, "0")} · ${topics[i]}`,
      `# ${topics[i]}\n\nSIMULAÇÃO — MUNICÍPIO DEMONSTRAÇÃO\n\n## Contexto\n\n${content}\n\n## Encaminhamento\n\nConferir os registros e acompanhar os compromissos no sistema. Autoria: equipe fictícia da demonstração.`,
      "seed",
      i === 0 ? "2026-09-01" : "2026-09-10",
    );
  }
  const decisionTitles = [
    "Realizar vistoria no bairro Norte",
    "Revisar prazo da vistoria do Norte",
    "Preparar plano de manutenção viária",
    "Inventariar pontos de iluminação",
    "Organizar manutenção das praças",
    "Revisar roteiro de coleta",
    "Levantar necessidade de poda",
    "Padronizar triagem das demandas",
  ];
  let initial: string | undefined;
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    const e = await s.writeEntity(
      "demo",
      "decisions",
      {
        title: decisionTitles[i],
        statement:
          i === 1
            ? "A vistoria do bairro Norte será apresentada até 18/09/2026."
            : decisionTitles[i],
        rationale:
          i === 1
            ? "Necessidade de concluir o levantamento de equipamentos."
            : "Encaminhamento da reunião fictícia de acompanhamento.",
        department: departments[i % 3],
        decided_on: i === 0 ? "2026-09-01" : "2026-09-10",
        ...(i === 1 ? { supersedes_id: initial } : {}),
      },
      "seed",
    );
    if (i === 0) initial = e.id;
    ids.push(e.id);
  }
  const titles = [
    "Apresentar levantamento de equipamentos",
    "Consolidar demandas do bairro Norte",
    "Entregar plano de manutenção viária",
    "Vistoriar pontos de iluminação",
    "Preparar cronograma das praças",
    "Revisar roteiro de coleta",
    "Mapear necessidade de poda",
    "Conferir registros sem situação",
    "Preparar pauta de zeladoria",
    "Concluir relatório de vistoria",
    "Validar prioridades de Obras",
    "Reunir informações do bairro Sul",
  ];
  for (let i = 0; i < 12; i++)
    await s.writeEntity(
      "demo",
      "commitments",
      {
        title: titles[i],
        department: departments[i % 3],
        description:
          "Compromisso fictício para demonstração do acompanhamento.",
        owner_name: [
          "Ana Costa (fictícia)",
          "Paulo Lima (fictício)",
          "Marina Alves (fictícia)",
        ][i % 3],
        due_date:
          i === 2
            ? null
            : ["2026-09-12", "2026-09-13", "2026-09-18", "2026-09-30"][i % 4],
        status: i >= 9 ? "completed" : i % 3 === 0 ? "in_progress" : "open",
        neighborhood: neighborhoods[i % 6],
        decision_id: ids[i % 8],
      },
      "seed",
    );
}
