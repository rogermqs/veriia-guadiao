import { mapAsync } from "./database";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { Store, now, hash } from "./store";
import { AppError } from "./errors";
export function unwrap(result: any): any {
  if (result.isError)
    throw new AppError(
      "KNOWLEDGE_UNAVAILABLE",
      "O índice de conhecimento não respondeu corretamente.",
      503,
    );
  let value = result.structuredContent?.result ?? result.structuredContent;
  if (value === undefined) {
    value =
      result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n") || "";
  }
  if (
    (typeof value === "string" &&
      /^# (Search Failed|Error|Read Failed)/i.test(value)) ||
    (value && typeof value === "object" && value.error)
  )
    throw new AppError(
      "KNOWLEDGE_UNAVAILABLE",
      "Não foi possível consultar o índice de conhecimento.",
      503,
    );
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
// Basic Memory 0.23 normalizes /app/data mount paths in project responses.
// Normalize the expected path only; both project and workspace remain exact.
export function matchesMemoryProject(
  identity: any,
  project: string,
  expectedPath: string,
) {
  const reportedPath = expectedPath.startsWith("/app/data/")
    ? expectedPath.slice("/app/data".length)
    : expectedPath;
  return (
    identity.constrained_project === project &&
    identity.projects?.some(
      (p: any) => p.name === project && p.path === reportedPath,
    ) === true
  );
}
export class Knowledge {
  clients = new Map<string, Promise<Client>>();
  timer: any;
  busy = false;
  lastError = "";
  constructor(public store: Store) {}
  async client(w: string) {
    const workspace = await this.store.workspace(w);
    if (!this.clients.has(w)) {
      const ready = (async () => {
        const client = new Client({ name: "agm", version: "1.0.0" });
        const transport = new StdioClientTransport({
          command: process.env.AGM_MCP_EXECUTABLE || resolve(".venv/bin/bm"),
          args: ["mcp", "--project", (await this.store.workspace(w)).project],
          env: {
            ...(process.env as Record<string, string>),
            BASIC_MEMORY_CONFIG_DIR: join(this.store.dir, "memory-config"),
            BASIC_MEMORY_HOME: join(this.store.dir, "vaults", "main"),
          },
          stderr: "pipe",
        });
        await client.connect(transport);
        const identity = unwrap(
          await client.callTool({
            name: "list_memory_projects",
            arguments: { output_format: "json" },
          }),
        );
        if (
          !matchesMemoryProject(
            identity,
            workspace.project,
            join(this.store.dir, "vaults", w),
          )
        ) {
          await client.close();
          throw new AppError(
            "KNOWLEDGE_UNAVAILABLE",
            "O projeto de conhecimento não corresponde ao espaço autorizado.",
            503,
          );
        }
        const { tools } = await client.listTools();
        for (const name of ["search_notes", "read_note", "write_note"])
          if (!tools.find((t) => t.name === name))
            throw new Error("Contrato MCP incompatível");
        return client;
      })();
      this.clients.set(w, ready);
      ready.catch(() => this.clients.delete(w));
    }
    return this.clients.get(w)!;
  }
  async call(w: string, name: string, args: any) {
    const c = await this.client(w);
    return unwrap(
      await c.callTool(
        {
          name,
          arguments: {
            ...args,
            project: (await this.store.workspace(w)).project,
          },
        },
        undefined,
        { timeout: 25000 },
      ),
    );
  }
  start() {
    this.timer = setInterval(() => this.processOne().catch(() => {}), 1500);
    this.timer.unref();
  }
  async processOne() {
    if (this.busy || existsSync(join(this.store.dir, "backup.lock"))) return;
    this.busy = true;
    let job: any;
    try {
      job = await this.store.db.transaction(async () => {
        const candidate = await this.store.db
          .prepare(
            "SELECT * FROM jobs WHERE (state='queued' AND next_run_at<=?) OR (state='running' AND lease_until<?) ORDER BY next_run_at LIMIT 1",
          )
          .get(now(), now());
        if (candidate)
          await this.store.db
            .prepare(
              "UPDATE jobs SET state='running',attempts=attempts+1,lease_until=? WHERE id=?",
            )
            .run(new Date(Date.now() + 60000).toISOString(), candidate.id);
        return candidate;
      })();
      if (!job) return;
      const entity =
        job.kind === "documents"
          ? await this.store.document(job.workspace_id, job.entity_id)
          : await this.store.entity(job.workspace_id, job.kind, job.entity_id);
      const content =
        job.kind === "documents"
          ? entity.content
          : `# ${entity.title}\n\nSIMULAÇÃO — MUNICÍPIO DEMONSTRAÇÃO\n\n${JSON.stringify(entity, null, 2)}`;
      const title = `agm-${entity.id}-v${entity.version}`;
      const marker = `AGM_PROJECTION:${entity.id}:${entity.version}:${hash(content)}`;
      const note = `${content}\n\n<!-- ${marker} -->`;
      const existing = (await this.store.db
        .prepare(
          "SELECT * FROM memory_refs WHERE workspace_id=? AND entity_id=? AND version=?",
        )
        .get(job.workspace_id, entity.id, entity.version)) as any;
      let receipt: any;
      if (!existing) {
        let current: any;
        try {
          current = await this.call(job.workspace_id, "read_note", {
            identifier: `managed/${title}`,
          });
        } catch {}
        if (typeof current === "string" && current.includes(marker))
          receipt = { permalink: `managed/${title}` };
        else {
          receipt = await this.call(job.workspace_id, "write_note", {
            title,
            directory: "managed",
            content: note,
            metadata: {
              agm_entity_id: entity.id,
              agm_version: entity.version,
              agm_hash: hash(content),
              workspace_id: job.workspace_id,
            },
            overwrite: false,
            output_format: "json",
          });
        }
        const read = await this.call(job.workspace_id, "read_note", {
          identifier:
            receipt.permalink ||
            receipt.entity?.permalink ||
            `managed/${title}`,
        });
        if (!JSON.stringify(read).includes(marker))
          throw new Error("Projeção não confirmada pela leitura");
        await this.store.db
          .prepare(
            "INSERT INTO memory_refs VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,entity_id,version) DO UPDATE SET permalink=excluded.permalink,content_hash=excluded.content_hash",
          )
          .run(
            job.workspace_id,
            entity.id,
            entity.version,
            receipt.permalink ||
              receipt.entity?.permalink ||
              `managed/${title}`,
            hash(content),
          );
      }
      await this.store.db.transaction(async () => {
        await this.store.db
          .prepare(
            "UPDATE jobs SET state='succeeded',lease_until=NULL,last_error=NULL WHERE id=?",
          )
          .run(job.id);
        await this.store.db
          .prepare(
            `UPDATE ${job.kind === "documents" ? "documents" : "entities"} SET indexing_state='synced' WHERE id=? AND version=?`,
          )
          .run(entity.id, entity.version);
      })();
      this.lastError = "";
    } catch (error: any) {
      this.lastError = "Conhecimento temporariamente indisponível";
      if (job) {
        const attempts = job.attempts + 1;
        await this.store.db
          .prepare(
            "UPDATE jobs SET state=?,next_run_at=?,last_error=?,lease_until=NULL WHERE id=?",
          )
          .run(
            attempts >= 5 ? "failed" : "queued",
            new Date(
              Date.now() +
                [2000, 5000, 15000, 60000, 60000][Math.min(attempts - 1, 4)],
            ).toISOString(),
            "KNOWLEDGE_UNAVAILABLE",
            job.id,
          );
      }
    } finally {
      this.busy = false;
    }
  }
  async search(w: string, query: string, u: string) {
    const result = await this.call(w, "search_notes", {
      query,
      search_type: process.env.AGM_KNOWLEDGE_SEARCH_MODE || "hybrid",
      output_format: "json",
      page_size: 8,
      search_all_projects: false,
    });
    const hits = Array.isArray(result)
      ? result
      : result.results || result.items || [];
    const found: any[] = [];
    for (const hit of hits) {
      const permalink = hit.permalink || hit.entity?.permalink;
      const ref = (await this.store.db
        .prepare(
          "SELECT * FROM memory_refs WHERE workspace_id=? AND permalink=?",
        )
        .get(w, permalink || "")) as any;
      if (!ref) continue;
      const doc = (await this.store.db
        .prepare("SELECT id FROM documents WHERE id=? AND workspace_id=?")
        .get(ref.entity_id, w)) as any;
      if (!doc) continue;
      const canonical = await this.store.document(w, doc.id, ref.version);
      const remote = await this.call(w, "read_note", { identifier: permalink });
      if (
        !JSON.stringify(remote).includes(
          `AGM_PROJECTION:${doc.id}:${ref.version}:${canonical.sha256}`,
        )
      )
        continue;
      const payload = {
        ...canonical,
        locator: "Documento completo",
        excerpt: canonical.content.slice(0, 6000),
      };
      const evidence_id = await this.store.evidence(
        w,
        u,
        "document_excerpt",
        payload,
      );
      if (!found.some((h) => h.id === doc.id))
        found.push({ ...payload, evidence_id });
    }
    return {
      items: found,
      mode: process.env.AGM_KNOWLEDGE_SEARCH_MODE || "hybrid",
      degraded: (process.env.AGM_KNOWLEDGE_SEARCH_MODE || "hybrid") === "text",
    };
  }
  async close() {
    clearInterval(this.timer);
    await Promise.allSettled(
      await mapAsync(
        [...this.clients.values()],
        async (c) => await (await c).close(),
      ),
    );
  }
}
