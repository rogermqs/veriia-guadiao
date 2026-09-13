import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { writeFileSync, existsSync } from "node:fs";
import { unwrap } from "../apps/api/src/knowledge";
async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const c = new Client({ name: "agm-smoke", version: "1.0.0" });
  const t = new StdioClientTransport({
    command: resolve(".venv/bin/bm"),
    args: ["mcp", "--project", "agm-municipio-demo"],
    env: {
      ...(process.env as Record<string, string>),
      BASIC_MEMORY_CONFIG_DIR: resolve("data/memory-config"),
      BASIC_MEMORY_HOME: resolve("data/vaults/main"),
    },
    stderr: "pipe",
  });
  await c.connect(t);
  try {
    const project = unwrap(
      await c.callTool({
        name: "list_memory_projects",
        arguments: { output_format: "json" },
      }),
    );
    console.log("Projects", JSON.stringify(project));
    const receipt = unwrap(
      await c.callTool({
        name: "write_note",
        arguments: {
          title: "agm-smoke-v1",
          directory: "smoke",
          content:
            "# Verificação de integração\n\nSIMULAÇÃO. A vistoria de limpeza do bairro Norte está prevista para 18 de setembro de 2026.",
          project: "agm-municipio-demo",
          overwrite: true,
          output_format: "json",
        },
      }),
    );
    console.log("Receipt", JSON.stringify(receipt));
    const read = unwrap(
      await c.callTool({
        name: "read_note",
        arguments: {
          identifier: "smoke/agm-smoke-v1",
          project: "agm-municipio-demo",
        },
      }),
    );
    console.log("Read", JSON.stringify(read).slice(0, 700));
    const search = unwrap(
      await c.callTool({
        name: "search_notes",
        arguments: {
          query: "vistoria",
          project: "agm-municipio-demo",
          search_type: "text",
          output_format: "json",
        },
      }),
    );
    console.log("Search", JSON.stringify(search).slice(0, 2000));
    const cross = await c.callTool({
      name: "search_notes",
      arguments: {
        query: "vistoria",
        project: "agm-curitiba-public",
        search_type: "text",
        output_format: "json",
      },
    });
    console.log("Cross-project", JSON.stringify(cross).slice(0, 700));
    writeFileSync(
      "docs/contracts/mcp-smoke.json",
      JSON.stringify({ project, receipt, read, search, cross }, null, 2),
    );
  } finally {
    await c.close();
  }
  if (!process.env.AGM_LLM_API_KEY)
    console.log("LLM: PENDENTE, chave não configurada.");
  else {
    const response = await fetch(
      `${process.env.AGM_LLM_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AGM_LLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AGM_LLM_MODEL,
          messages: [
            {
              role: "user",
              content:
                "Chame get_dataset_status para descobrir a cobertura dos dados.",
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "get_dataset_status",
                description: "Consultar cobertura",
                parameters: {
                  type: "object",
                  properties: {},
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "get_dataset_status" },
          },
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!response.ok) throw Error(`Provedor retornou ${response.status}`);
    const json: any = await response.json();
    if (
      json.choices?.[0]?.message?.tool_calls?.[0]?.function?.name !==
      "get_dataset_status"
    )
      throw Error("Modelo não confirmou tool calling");
    writeFileSync(
      "docs/contracts/llm-smoke.json",
      JSON.stringify(
        {
          model: process.env.AGM_LLM_MODEL,
          tool_calling: true,
          usage: json.usage,
          validated_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log("LLM: chamada real de ferramenta validada.");
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
