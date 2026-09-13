import { it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { Store, uuid, now } from "../apps/api/src/store";
import { Analytics } from "../apps/api/src/analytics";
import { Knowledge } from "../apps/api/src/knowledge";
import { Agent } from "../apps/api/src/agent";
import { parseDemands } from "../apps/api/src/imports";
it("executes controlled LLM tools, validates evidence, and denies model-requested unauthorized writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agm-agent-"));
  const s = new Store(dir);
  await s.bootstrap("agent@test.local", "password-test");
  const u = ((await s.db.prepare("SELECT id FROM users").get()) as any).id;
  const bytes = readFileSync("packages/test-fixtures/demands-golden.csv");
  const snap = await s.saveSnapshot(
    "demo",
    await parseDemands(bytes, "golden.csv", "2026-09-13"),
    { title: "Golden", data_as_of: "2026-09-13" },
    bytes,
  );
  await s.activate("demo", snap.id, u);
  let malicious = false;
  let invalidAlways = false;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    const tool = [...body.messages]
      .reverse()
      .find((m: any) => m.role === "tool");
    const message = !body.response_format
      ? { role: "assistant", content: "Resposta em prosa antes do JSON." }
      : tool
        ? (() => {
            const q = JSON.parse(tool.content);
            return {
              role: "assistant",
              content: JSON.stringify({
                status: "answered",
                text: body.messages.some(
                  (m: any) =>
                    m.role === "system" && m.content.includes("VALIDAÇÃO:"),
                )
                  ? `Existem {{query:${q.id}:total_records}} registros no período.`
                  : "Existem 12 registros no período.",
                evidence_ids:
                  !invalidAlways &&
                  body.messages.some(
                    (m: any) =>
                      m.role === "system" && m.content.includes("referências"),
                  )
                    ? [q.evidence_id]
                    : [snap.id],
                query_ids: [q.id],
                limitations: ["Simulação."],
              }),
            };
          })()
        : {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tool-one",
                type: "function",
                function: {
                  name: malicious
                    ? "create_commitment"
                    : "query_demands_summary",
                  arguments: malicious
                    ? JSON.stringify({
                        title: "Escrita não autorizada",
                        department: "Secretaria de Obras",
                      })
                    : JSON.stringify({
                        request_type: null,
                        department: "",
                        limit: null,
                        neighborhood: "",
                        subject: "",
                      }),
                },
              },
            ],
          };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const old = {
    key: process.env.AGM_LLM_API_KEY,
    model: process.env.AGM_LLM_MODEL,
    url: process.env.AGM_LLM_BASE_URL,
  };
  process.env.AGM_LLM_API_KEY = "test-only-fake";
  process.env.AGM_LLM_MODEL = "controlled-test";
  process.env.AGM_LLM_BASE_URL = `http://127.0.0.1:${(server.address() as any).port}`;
  const knowledge = new Knowledge(s),
    agent = new Agent(s, new Analytics(s), knowledge);
  try {
    const conv = uuid();
    await s.db
      .prepare("INSERT INTO conversations VALUES(?,?,?,?,?)")
      .run(conv, "demo", u, "Teste", now());
    const createTurn = async () => {
      const id = uuid();
      await s.db
        .prepare("INSERT INTO turns VALUES(?,?,?,?,?,?,?,?)")
        .run(
          id,
          conv,
          "Quantos registros existem?",
          "queued",
          snap.id,
          null,
          null,
          now(),
        );
      return id;
    };
    const t = await createTurn();
    await agent.run("demo", u, "admin", t, false);
    const result = (await s.db
      .prepare("SELECT * FROM turns WHERE id=?")
      .get(t)) as any;
    expect(result.status).toBe("completed");
    expect(JSON.parse(result.answer).text).toBe(
      "Existem 12 registros no período.",
    );
    expect(JSON.parse(result.answer).queries[0].result.total_records).toBe(12);
    malicious = true;
    const denied = await createTurn();
    await agent.run("demo", u, "reader", denied, false);
    const failure = (await s.db
      .prepare("SELECT * FROM turns WHERE id=?")
      .get(denied)) as any;
    expect(JSON.parse(failure.error).code).toBe("FORBIDDEN");
    expect(await s.entities("demo", "commitments")).toHaveLength(0);
    malicious = false;
    invalidAlways = true;
    const forged = await createTurn();
    await agent.run("demo", u, "admin", forged, false);
    const rejected = (await s.db
      .prepare("SELECT * FROM turns WHERE id=?")
      .get(forged)) as any;
    expect(rejected.status).toBe("failed");
    expect(JSON.parse(rejected.error).code).toBe("CITATION_VALIDATION_FAILED");
    expect(rejected.answer).toBeNull();
  } finally {
    for (const [k, v] of Object.entries({
      AGM_LLM_API_KEY: old.key,
      AGM_LLM_MODEL: old.model,
      AGM_LLM_BASE_URL: old.url,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await knowledge.close();
    await new Promise<void>((r) => server.close(() => r()));
    await s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
