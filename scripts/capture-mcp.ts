import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
async function main() {
  const client = new Client({ name: "agm-contract-check", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: resolve(".venv/bin/bm"),
    args: ["mcp", "--project", "agm-municipio-demo"],
    env: {
      ...(process.env as Record<string, string>),
      BASIC_MEMORY_CONFIG_DIR: resolve("data/memory-config"),
      BASIC_MEMORY_HOME: resolve("data/vaults/main"),
    },
    stderr: "pipe",
  });
  await client.connect(transport);
  let all: any[] = [];
  let cursor;
  do {
    const p = await client.listTools({ cursor });
    all.push(...p.tools);
    cursor = p.nextCursor;
  } while (cursor);
  writeFileSync(
    "docs/contracts/basic-memory-tools.json",
    JSON.stringify(all, null, 2),
  );
  console.log(
    JSON.stringify(
      all.filter((t) =>
        [
          "search_notes",
          "read_note",
          "write_note",
          "list_memory_projects",
        ].includes(t.name),
      ),
      null,
      2,
    ),
  );
  await client.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
