import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const data = resolve(process.env.AGM_DATA_DIR || "data");
const config = join(data, "memory-config");
mkdirSync(config, { recursive: true });
const env = {
  ...process.env,
  BASIC_MEMORY_CONFIG_DIR: config,
  BASIC_MEMORY_HOME: join(data, "vaults", "main"),
};
const cmd = process.env.AGM_MCP_EXECUTABLE || resolve(".venv/bin/bm");
for (const [project, folder] of [
  ["agm-municipio-demo", "demo"],
  ["agm-curitiba-public", "real"],
]) {
  const path = join(data, "vaults", folder);
  mkdirSync(path, { recursive: true });
  const result = spawnSync(cmd, ["project", "add", project, path], {
    env,
    encoding: "utf8",
  });
  if (
    result.status !== 0 &&
    !`${result.stdout}${result.stderr}`.includes("already exists")
  )
    throw new Error(result.stderr || result.stdout);
}
const path = join(config, "config.json");
const settings = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
Object.assign(settings, {
  auto_update: false,
  semantic_embedding_model:
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  semantic_embedding_provider: "fastembed",
  reranker_enabled: false,
});
writeFileSync(path, JSON.stringify(settings, null, 2));
console.log("Projetos locais provisionados em", config);
