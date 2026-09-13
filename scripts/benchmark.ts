import { Store, uuid, now } from "../apps/api/src/store";
import { ImportCoordinator } from "../apps/api/src/import-coordinator";
import { Analytics } from "../apps/api/src/analytics";
import {
  mkdtempSync,
  createWriteStream,
  writeFileSync,
  statSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { once } from "node:events";
async function main() {
  const dir = mkdtempSync(join("data", "benchmark-"));
  const path = join(dir, "million.csv");
  const file = createWriteStream(path);
  file.write(
    "Tipo;Orgao;DataCriacao;Assunto;Subdivisao;Situacao;Bairro;DataResposta\n",
  );
  for (let start = 0; start < 1000000; start += 5000) {
    let chunk = "";
    for (let i = start; i < start + 5000; i++)
      chunk += `Solicitação;Secretaria de Obras;01/09/2026;Conservação de vias;Registro ${i};Concluído;${["Norte", "Sul", "Centro"][i % 3]};03/09/2026\n`;
    if (!file.write(chunk)) await once(file, "drain");
  }
  file.end();
  await once(file, "finish");
  const bytes = statSync(path).size;
  const s = new Store(dir);
  await s.bootstrap("perf@test.local", "isolated-perf-test");
  const id = uuid();
  await s.db.prepare("INSERT INTO imports VALUES(?,?,?,?,?,?,?,?)").run(
    id,
    "demo",
    "million.csv",
    path,
    JSON.stringify({
      title: "Benchmark sintético isolado",
      data_as_of: "2026-09-13",
    }),
    "processing",
    null,
    now(),
  );
  const coordinator = new ImportCoordinator(s);
  const start = performance.now();
  coordinator.start(id, "demo", "confirm");
  let result: any;
  for (let i = 0; i < 600; i++) {
    result = (await s.db
      .prepare("SELECT * FROM imports WHERE id=?")
      .get(id)) as any;
    if (["ready", "failed", "blocked"].includes(result.state)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (result.state !== "ready") throw Error(JSON.stringify(result));
  const import_ms = Math.round(performance.now() - start);
  const snapshot = JSON.parse(result.result).snapshot_id;
  await s.activate("demo", snapshot, "perf");
  const times: number[] = [];
  const analytics = new Analytics(s);
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const q = await analytics.runAsync(
      "demo",
      "grouped",
      { group_by: "neighborhood" },
      "perf",
    );
    if (q.result.total_records_in_scope !== 1000000)
      throw Error("Contagem inválida");
    times.push(performance.now() - start);
  }
  const summary = await analytics.runAsync("demo", "summary", {}, "perf");
  if (summary.result.average_response_days !== 2) throw Error("Média inválida");
  const report = {
    rows: 1000000,
    bytes,
    import_ms,
    query_runs: 20,
    grouped_p95_ms: Math.round(times.sort((a, b) => a - b)[18]),
    summary: summary.result,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    memory_peak_measured: false,
    note: "Dados sintéticos isolados, um milhão de linhas com conteúdo distinto; relatório não mede carga concorrente nem a máquina de referência da SDD.",
  };
  writeFileSync(
    "docs/contracts/performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await coordinator.close();
  await s.close();
  rmSync(dir, { recursive: true, force: true });
}
main().catch((e) => {
  writeFileSync(
    "docs/contracts/performance-failure.json",
    JSON.stringify(
      {
        captured_at: new Date().toISOString(),
        error: e.message,
        accepted: false,
      },
      null,
      2,
    ),
  );
  console.error(e.message);
  process.exitCode = 1;
});
