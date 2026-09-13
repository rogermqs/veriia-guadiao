import { Store } from "../apps/api/src/store";
import { Knowledge } from "../apps/api/src/knowledge";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
async function main() {
  const s = new Store(),
    k = new Knowledge(s);
  try {
    for (let i = 0; i < 1000; i++) {
      const remaining = (
        (await s.db
          .prepare(
            "SELECT COUNT(*) n FROM jobs WHERE state IN ('queued','running')",
          )
          .get()) as any
      ).n;
      if (!remaining) break;
      await k.processOne();
      await new Promise((r) => setTimeout(r, 100));
    }
    await k.close();
    const child = spawn(
      process.env.AGM_MCP_EXECUTABLE || resolve(".venv/bin/bm"),
      ["reindex", "--project", "agm-municipio-demo"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          BASIC_MEMORY_CONFIG_DIR: join(s.dir, "memory-config"),
          BASIC_MEMORY_HOME: join(s.dir, "vaults", "main"),
        },
      },
    );
    await new Promise<void>((res, rej) => {
      child.on("error", rej);
      child.on("exit", (code) =>
        code ? rej(Error("Falha ao preparar embeddings")) : res(),
      );
    });
    console.log("Índice e embeddings preparados.");
  } finally {
    await k.close();
    await s.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
