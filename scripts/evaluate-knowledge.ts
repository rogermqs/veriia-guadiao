import { Store } from "../apps/api/src/store";
import { Knowledge } from "../apps/api/src/knowledge";
import { writeFileSync } from "node:fs";
const pairs = [
  ["Qual é o novo prazo da vistoria do bairro Norte?", "Ata 02"],
  ["Por que o prazo da vistoria no Norte foi alterado?", "Ata 02"],
  ["Qual era a proposta inicial para vistoriar a limpeza no Norte?", "Ata 01"],
  ["O que foi discutido sobre conservação de vias no Sul?", "Ata 03"],
  ["Há registros de reunião sobre iluminação do Centro?", "Ata 04"],
  ["O que foi discutido sobre as praças do Leste?", "Ata 05"],
  ["Onde está a ata sobre coleta de resíduos no Oeste?", "Ata 06"],
  ["O que foi discutido sobre poda no Jardim das Flores?", "Ata 07"],
  ["Qual documento trata da triagem de demandas?", "Ata 08"],
  ["Que ata trata do planejamento de equipamentos?", "Ata 09"],
];
async function main() {
  const s = new Store();
  process.env.AGM_KNOWLEDGE_SEARCH_MODE = "hybrid";
  const k = new Knowledge(s);
  const rows: any[] = [];
  try {
    for (const [query, prefix] of pairs) {
      const t = performance.now();
      const r = await k.search("demo", query, "evaluation");
      const titles = r.items.slice(0, 5).map((i: any) => i.title);
      rows.push({
        query,
        expected_prefix: prefix,
        top5: titles,
        passed: titles.some((x: string) => x.startsWith(prefix)),
        elapsed_ms: Math.round(performance.now() - t),
      });
    }
    const passed = rows.filter((r) => r.passed).length;
    const report = {
      model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      dimension: 384,
      mode: "hybrid",
      passed,
      total: 10,
      accepted: passed >= 9,
      rows,
    };
    writeFileSync(
      "docs/contracts/knowledge-evaluation.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await k.close();
    await s.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
