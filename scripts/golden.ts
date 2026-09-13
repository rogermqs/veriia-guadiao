import { Store } from "../apps/api/src/store";
import { parseDemands } from "../apps/api/src/imports";
import { Analytics } from "../apps/api/src/analytics";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
async function main() {
  const dir = mkdtempSync(join("data", "golden-"));
  const s = new Store(dir);
  await s.bootstrap("golden@test.local", "isolated-golden-test");
  const bytes = readFileSync("packages/test-fixtures/demands-golden.csv");
  const snap = await s.saveSnapshot(
    "demo",
    await parseDemands(bytes, "golden.csv", "2026-09-13"),
    {
      title: "Golden isolado",
      data_as_of: "2026-09-13",
      source_url: "",
      sample_info: "Fixture de 12 linhas",
    },
    bytes,
  );
  await s.activate("demo", snap.id, "test");
  console.log(
    JSON.stringify(
      {
        directory: dir,
        all: (await new Analytics(s).run("demo", "summary", {}, "test")).result,
        september: (
          await new Analytics(s).run(
            "demo",
            "summary",
            { created_from: "2026-09-01" },
            "test",
          )
        ).result,
      },
      null,
      2,
    ),
  );
  await s.close();
}
main();
