import { mapAsync } from "./database";
import "reflect-metadata";
import { Module, Controller, All, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import multer from "multer";
import { readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Store, uuid, now, oldPayload, hash } from "./store";
import { Auth } from "./auth";
import { Analytics, exportQuery } from "./analytics";
import { Knowledge } from "./knowledge";
import { Health } from "./health";
import { Agent } from "./agent";
import { ImportCoordinator } from "./import-coordinator";
import { parseCommitments } from "./commitment-import";
import { parseDemands, parseCivilDate } from "./imports";
import { AppError, requireValue } from "./errors";
import {
  loginSchema,
  messageSchema,
  departments,
  neighborhoods,
  civilDate,
} from "../../../packages/contracts";
if (existsSync(".env")) process.loadEnvFile(".env");
export async function createApp(store = new Store(), startJobs = true) {
  await store.ready;
  const auth = new Auth(store),
    analytics = new Analytics(store),
    knowledge = new Knowledge(store),
    agent = new Agent(store, analytics, knowledge),
    imports = new ImportCoordinator(store);
  const uploadDir = join(store.dir, "uploads");
  mkdirSync(uploadDir, { recursive: true });
  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 209715200, files: 1, fields: 20 },
  }).single("file");
  const businessRoles = ["admin", "manager"],
    importRoles = ["admin", "analyst"];
  async function ownConversation(w: string, id: string, u: string) {
    return requireValue(
      await store.db
        .prepare(
          "SELECT * FROM conversations WHERE id=? AND workspace_id=? AND user_id=?",
        )
        .get(id, w, u),
    ) as any;
  }
  async function ownTurn(w: string, conv: string, id: string, u: string) {
    await ownConversation(w, conv, u);
    return requireValue(
      await store.db
        .prepare("SELECT * FROM turns WHERE id=? AND conversation_id=?")
        .get(id, conv),
    ) as any;
  }
  @Controller("api/v1")
  class ApiController {
    @All("{*path}")
    async dispatch(
      @Req()
      req: any,
      @Res()
      res: any,
    ) {
      const correlation_id = uuid();
      res.setHeader("X-Correlation-Id", correlation_id);
      res.setHeader("Cache-Control", "no-store");
      try {
        const parts = req.path
          .replace(/^\/api\/v1\/?/, "")
          .split("/")
          .filter(Boolean);
        const [root, a, b, c, d, e] = parts;
        const method = req.method;
        if (!["GET", "POST", "PATCH", "HEAD"].includes(method))
          throw new AppError(
            "METHOD_NOT_ALLOWED",
            "Método não permitido.",
            405,
          );
        const body = req.body || {};
        if (method !== "GET" && existsSync(join(store.dir, "backup.lock")))
          throw new AppError(
            "MAINTENANCE",
            "Backup em andamento. Tente novamente em instantes.",
            503,
          );
        if (!["GET", "HEAD"].includes(method)) {
          const origin = req.headers.origin;
          const allowed =
            process.env.AGM_PUBLIC_ORIGIN || "http://localhost:3000";
          if (origin && origin !== allowed)
            throw new AppError(
              "FORBIDDEN",
              "Origem da solicitação não autorizada.",
              403,
            );
          if (!origin && req.headers["sec-fetch-site"] === "cross-site")
            throw new AppError("FORBIDDEN", "Origem não autorizada.", 403);
        }
        if (root === "health" && ["live", "ready"].includes(a)) {
          if (a === "ready")
            await store.db.prepare("SELECT 1 AS healthy").get();
          res.json({
            status: "ok",
            revision: process.env.AGM_BUILD_REVISION || "development",
          });
          return;
        }
        if (root === "auth" && a === "login" && method === "POST") {
          const p = loginSchema.parse(body);
          const result = await auth.login(p.email, p.password, req.ip);
          res.cookie("agm_session", result.token, {
            httpOnly: true,
            sameSite: "lax",
            secure: (process.env.AGM_PUBLIC_ORIGIN || "").startsWith("https:"),
            maxAge: 8 * 3600000,
            path: "/",
          });
          res.json(result.user);
          return;
        }
        const user = await auth.identity(req.cookies.agm_session);
        if (root === "auth") {
          if (a === "logout" && method === "POST") {
            await auth.logout(req.cookies.agm_session);
            res.clearCookie("agm_session", { path: "/" });
            res.status(204).end();
            return;
          }
          if (a === "me") {
            res.json(user);
            return;
          }
        }
        if (root !== "workspaces")
          throw new AppError("RESOURCE_NOT_FOUND", "Rota não encontrada.", 404);
        if (!a) {
          res.json(user.workspaces);
          return;
        }
        const w = a,
          membership = auth.authorize(user, w),
          u = user.id;
        const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
        const requireRole = (roles: string[]) => auth.authorize(user, w, roles);
        let result: any;
        if (b === "capabilities" && method === "GET")
          result = { provider_configured: agent.configured() };
        else if (b === "datasets" && method === "GET")
          result = await store.dataset(w);
        else if (b === "datasets" && method === "POST") {
          requireRole(["admin"]);
          if (c !== `dataset-${w}`)
            throw new AppError(
              "RESOURCE_NOT_FOUND",
              "Base não encontrada.",
              404,
            );
          const dataset = await store.dataset(w);
          const snapshot =
            d === "rollback" ? dataset.previous_snapshot_id : body.snapshot_id;
          result = await store.activate(
            w,
            snapshot,
            u,
            body.acknowledge === true,
          );
        } else if (b === "dimensions") {
          const db = store.readers.get(w)!;
          const snap = (await store.dataset(w)).active_snapshot_id;
          const values = async (col: string) =>
            (
              (await db
                .prepare(
                  `SELECT DISTINCT ${col} label FROM records WHERE snapshot_id=? ORDER BY label`,
                )
                .all(snap || "")) as any[]
            ).map((x) => x.label);
          result = {
            departments:
              w === "demo" ? departments : await values("department"),
            neighborhoods:
              w === "demo" ? neighborhoods : await values("neighborhood"),
            subjects: await values("subject"),
          };
        } else if (b === "analytics" && method === "POST") {
          result = await analytics.runAsync(w, c, body, u);
          result.evidence_id = await store.evidence(
            w,
            u,
            "query_result",
            result,
          );
        } else if (b === "health") {
          if (method !== "GET")
            throw new AppError(
              "METHOD_NOT_ALLOWED",
              "Consulta de saúde aceita somente leitura.",
              405,
            );
          const health = new Health(store);
          if (c === "citizens" && !d)
            result = await health.citizens(w, u, req.query);
          else if (c === "citizens" && d)
            result = await health.history(w, u, d);
          else if (c === "visits" && !d)
            result = await health.visits(w, u, req.query);
          else throw new AppError("NOT_FOUND", "Consulta não encontrada.", 404);
        } else if (b === "decisions" || b === "commitments") {
          if (
            method !== "GET" &&
            !(method === "POST" && !c) &&
            !(method === "PATCH" && c)
          )
            throw new AppError(
              "METHOD_NOT_ALLOWED",
              "Método não permitido.",
              405,
            );
          if (method === "GET") {
            if (c) {
              const entity = await store.entity(w, b, c);
              result = {
                ...entity,
                revisions: await store.db
                  .prepare(
                    "SELECT * FROM revisions WHERE entity_id=? ORDER BY version DESC",
                  )
                  .all(c),
              };
            } else
              result = {
                items: await store.entities(
                  w,
                  b,
                  String(req.query.search || ""),
                  page,
                ),
                page,
              };
          } else {
            requireRole(businessRoles);
            const current = c ? await store.entity(w, b, c) : null;
            result = await store.idempotent(
              w,
              u,
              `${method}:${b}:${c || ""}`,
              req.headers["idempotency-key"],
              body,
              async () =>
                b === "decisions" && !c
                  ? await store.writeDecisionBundle(w, body, u)
                  : await store.writeEntity(
                      w,
                      b,
                      current ? { ...oldPayload(current), ...body } : body,
                      u,
                      c,
                      c ? Number(req.headers["if-match"]) : undefined,
                    ),
            );
          }
        } else if (b === "documents") {
          if (method === "GET") {
            if (c)
              result = await store.document(
                w,
                c,
                req.query.version ? Number(req.query.version) : undefined,
              );
            else
              result = {
                items: await store.db
                  .prepare(
                    "SELECT * FROM documents WHERE workspace_id=? ORDER BY title LIMIT 100 OFFSET ?",
                  )
                  .all(w, (page - 1) * 100),
                page,
              };
          } else {
            requireRole(importRoles);
            if (
              c &&
              Number(req.headers["if-match"]) !==
                (await store.document(w, c)).version
            )
              throw new AppError(
                "VERSION_CONFLICT",
                "O documento foi atualizado. Reabra antes de salvar.",
                409,
              );
            const p = z
              .object({
                title: z.string().trim().min(3).max(250),
                content: z.string().min(1).max(2097152),
                effective_date: civilDate,
                source_url: z.string().default(""),
              })
              .strict()
              .parse(body);
            result = await store.idempotent(
              w,
              u,
              `documents:${c || ""}`,
              req.headers["idempotency-key"],
              p,
              async () =>
                await store.addDocument(
                  w,
                  p.title,
                  p.content,
                  u,
                  p.effective_date,
                  p.source_url,
                  c,
                ),
            );
          }
        } else if (b === "knowledge" && c === "search") {
          const p = z.object({ query: z.string().min(1).max(500) }).parse(body);
          result = await knowledge.search(w, p.query, u);
        } else if (
          b === "imports" &&
          c === "commitments" &&
          method === "POST"
        ) {
          requireRole(businessRoles);
          if (w !== "demo")
            throw new AppError(
              "FORBIDDEN",
              "Importação operacional disponível somente no espaço simulado.",
              403,
            );
          await new Promise<void>((resolve, reject) =>
            upload(req, res, (e: any) => (e ? reject(e) : resolve())),
          );
          if (!req.file)
            throw new AppError("FILE_REQUIRED", "Selecione o template.");
          const bytes = readFileSync(req.file.path);
          const parsed = await parseCommitments(
            bytes,
            req.file.originalname,
            req.body.sheet,
          );
          for (const row of parsed.rows) {
            const { external_ref, ...p } = row;
            await store.validateEntity(w, "commitments", p);
          }
          const id = uuid();
          await store.db
            .prepare("INSERT INTO imports VALUES(?,?,?,?,?,?,?,?)")
            .run(
              id,
              w,
              req.file.originalname,
              req.file.path,
              JSON.stringify({
                import_kind: "commitments",
                sheet: req.body.sheet,
                sha256: hash(bytes),
              }),
              "awaiting_mapping",
              JSON.stringify(parsed),
              now(),
            );
          result = { id, ...parsed };
        } else if (b === "imports" && c === "demands" && method === "POST") {
          requireRole(importRoles);
          if (
            await store.db
              .prepare(
                "SELECT id FROM imports WHERE workspace_id=? AND state IN ('previewing','processing')",
              )
              .get(w)
          )
            throw new AppError(
              "IMPORT_BUSY",
              "Há uma importação em processamento neste espaço.",
              409,
            );
          await new Promise<void>((resolve, reject) =>
            upload(req, res, (e: any) => (e ? reject(e) : resolve())),
          );
          if (!req.file)
            throw new AppError("FILE_REQUIRED", "Selecione o arquivo.");
          const meta = z
            .object({
              title: z.string().min(3).max(250),
              data_as_of: civilDate,
              source_url: z.string().default(""),
              published_at: z.string().default(""),
              sample_info: z.string().default(""),
              sheet: z.string().optional(),
              encoding: z.enum(["utf-8", "windows-1252"]).default("utf-8"),
              delimiter: z.string().max(1).optional(),
            })
            .parse(req.body);
          if (w === "real" && !/^https:\/\//.test(meta.source_url))
            throw new AppError(
              "SOURCE_REQUIRED",
              "Informe a página oficial de origem.",
            );
          const id = uuid();
          await store.db
            .prepare("INSERT INTO imports VALUES(?,?,?,?,?,?,?,?)")
            .run(
              id,
              w,
              req.file.originalname,
              req.file.path,
              JSON.stringify(meta),
              "previewing",
              null,
              now(),
            );
          imports.start(id, w, "preview");
          result = { id, state: "previewing" };
        } else if (b === "imports" && c) {
          const imp = requireValue(
            await store.db
              .prepare("SELECT * FROM imports WHERE id=? AND workspace_id=?")
              .get(c, w),
          ) as any;
          if (method === "GET")
            result = {
              ...imp,
              path: undefined,
              metadata: JSON.parse(imp.metadata),
              result: imp.result ? JSON.parse(imp.result) : null,
            };
          else if (
            d === "confirm-mapping" &&
            JSON.parse(imp.metadata).import_kind === "commitments"
          ) {
            requireRole(businessRoles);
            const meta = JSON.parse(imp.metadata);
            const parsed = await parseCommitments(
              readFileSync(imp.path),
              imp.filename,
              meta.sheet,
            );
            if (parsed.errors.length)
              throw new AppError(
                "IMPORT_QUALITY_BLOCKED",
                "Corrija as linhas inválidas antes de importar.",
              );
            result = await store.idempotent(
              w,
              u,
              "import-commitments",
              req.headers["idempotency-key"],
              { hash: meta.sha256 },
              async () =>
                await store.db.transaction(async () => {
                  const countBefore = (
                    (await store.db
                      .prepare(
                        "SELECT COUNT(*) n FROM entities WHERE workspace_id=? AND kind='commitments'",
                      )
                      .get(w)) as any
                  ).n;
                  const ids = await mapAsync(parsed.rows, async (row: any) => {
                    const { external_ref, ...payload } = row;
                    const linked = (await store.db
                      .prepare(
                        "SELECT entity_id FROM commitment_import_keys WHERE workspace_id=? AND batch_hash=? AND external_ref=?",
                      )
                      .get(w, meta.sha256, external_ref)) as any;
                    if (linked) return linked.entity_id;
                    const entityId = (
                      await store.idempotent(
                        w,
                        u,
                        "commitment-row",
                        meta.sha256 + ":" + external_ref,
                        payload,
                        async () =>
                          await store.writeEntity(w, "commitments", payload, u),
                      )
                    ).id;
                    await store.db
                      .prepare(
                        "INSERT INTO commitment_import_keys VALUES(?,?,?,?)",
                      )
                      .run(w, meta.sha256, external_ref, entityId);
                    return entityId;
                  });
                  const result = {
                    state: "ready",
                    created_count:
                      (
                        (await store.db
                          .prepare(
                            "SELECT COUNT(*) n FROM entities WHERE workspace_id=? AND kind='commitments'",
                          )
                          .get(w)) as any
                      ).n - countBefore,
                    ids,
                  };
                  await store.db
                    .prepare(
                      "UPDATE imports SET state='ready',result=? WHERE id=?",
                    )
                    .run(JSON.stringify(result), c);
                  return result;
                })(),
            );
          } else if (d === "confirm-mapping") {
            requireRole(importRoles);
            if (imp.state === "ready" || imp.state === "blocked")
              result = JSON.parse(imp.result);
            else if (imp.state !== "awaiting_mapping")
              throw new AppError(
                "IMPORT_BUSY",
                "Aguarde a prévia da importação.",
                409,
              );
            else {
              const meta = {
                ...JSON.parse(imp.metadata),
                ...(body.status_mapping
                  ? { status_mapping: body.status_mapping }
                  : {}),
              };
              await store.db
                .prepare(
                  "UPDATE imports SET state='processing',metadata=? WHERE id=?",
                )
                .run(JSON.stringify(meta), c);
              imports.start(c, w, "confirm");
              result = { id: c, state: "processing" };
            }
          }
        } else if (b === "sources" && c) result = await store.source(w, c, u);
        else if (b === "exports" && c === "query") {
          const q = requireValue(
            await store.db
              .prepare(
                "SELECT result FROM query_runs WHERE id=? AND workspace_id=? AND user_id=?",
              )
              .get(body.query_run_id, w, u),
          ) as any;
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="guardiao-consulta.csv"',
          );
          res.send(exportQuery(JSON.parse(q.result)));
          return;
        } else if (b === "exports" && c === "briefing") {
          const turn = await ownTurn(w, body.conversation_id, body.turn_id, u);
          if (!turn.answer)
            throw new AppError(
              "ANSWER_NOT_READY",
              "A resposta ainda não está disponível.",
            );
          const answer = JSON.parse(turn.answer);
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="guardiao-briefing.md"',
          );
          res.send(
            `# Briefing de gestão municipal\n\nOrigem: ${answer.origin_kind}\n\n${answer.text}\n\n## Limites\n${answer.limitations.join("\n")}\n\n## Fontes\n${answer.evidence_ids.map((id: string) => `- /api/v1/workspaces/${w}/sources/${id}`).join("\n")}\n\n## Consultas e filtros\n${(answer.queries || []).map((q: any) => JSON.stringify({ id: q.id, source: q.source, filters: q.filters, data_as_of: q.data_as_of })).join("\n")}`,
          );
          return;
        } else if (b === "conversations") {
          if (!c) {
            if (method === "GET")
              result = {
                items: await store.db
                  .prepare(
                    "SELECT * FROM conversations WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC LIMIT 100 OFFSET ?",
                  )
                  .all(w, u, (page - 1) * 100),
              };
            else {
              const id = uuid();
              await store.db
                .prepare("INSERT INTO conversations VALUES(?,?,?,?,?)")
                .run(id, w, u, "Nova conversa", now());
              result = { id };
            }
          } else {
            const conv = await ownConversation(w, c, u);
            if (!d) {
              result = {
                ...conv,
                turns: (
                  (await store.db
                    .prepare(
                      "SELECT * FROM turns WHERE conversation_id=? ORDER BY created_at",
                    )
                    .all(c)) as any[]
                ).map((t) => ({
                  ...t,
                  answer: t.answer ? JSON.parse(t.answer) : null,
                  error: t.error ? JSON.parse(t.error) : null,
                })),
              };
            } else if (d === "turns") {
              if (!e && method === "POST") {
                const p = messageSchema.parse(body);
                let startTurn: string | undefined;
                result = await store.idempotent(
                  w,
                  u,
                  `turn:${c}`,
                  req.headers["idempotency-key"],
                  p,
                  async () => {
                    if (
                      await store.db
                        .prepare(
                          "SELECT id FROM turns WHERE conversation_id=? AND status IN ('queued','running')",
                        )
                        .get(c)
                    )
                      throw new AppError(
                        "TURN_BUSY",
                        "Aguarde a consulta atual.",
                        409,
                      );
                    if (
                      (
                        (await store.db
                          .prepare(
                            "SELECT COUNT(*) n FROM turns WHERE status IN ('queued','running')",
                          )
                          .get()) as any
                      ).n >= 4 ||
                      (
                        (await store.db
                          .prepare(
                            "SELECT COUNT(*) n FROM turns t JOIN conversations c ON c.id=t.conversation_id WHERE c.user_id=? AND t.status IN ('queued','running')",
                          )
                          .get(u)) as any
                      ).n >= 2
                    )
                      throw new AppError(
                        "RATE_LIMITED",
                        "O assistente está ocupado. Tente novamente.",
                        429,
                      );
                    const id = uuid(),
                      snapshot = (await store.dataset(w)).active_snapshot_id;
                    await store.db
                      .prepare("INSERT INTO turns VALUES(?,?,?,?,?,?,?,?)")
                      .run(
                        id,
                        c,
                        p.message,
                        "queued",
                        snapshot,
                        null,
                        null,
                        now(),
                      );
                    await store.db
                      .prepare("UPDATE conversations SET title=? WHERE id=?")
                      .run(p.message.slice(0, 65), c);
                    startTurn = id;
                    return {
                      turn_id: id,
                      status: "queued",
                      events_url: `/api/v1/workspaces/${w}/conversations/${c}/turns/${id}/events`,
                    };
                  },
                );
                if (startTurn)
                  setImmediate(() => {
                    void agent
                      .run(w, u, membership.role, startTurn!, p.allow_write)
                      .catch(() => {});
                  });
              } else if (e) {
                const t = await ownTurn(w, c, e, u);
                const action = parts[6];
                if (action === "cancel" && method === "POST") {
                  agent.cancel(e);
                  result = { status: "cancelling" };
                } else if (action === "events") {
                  res.setHeader("Content-Type", "text/event-stream");
                  res.setHeader("Connection", "keep-alive");
                  res.setHeader("X-Accel-Buffering", "no");
                  res.flushHeaders();
                  let last = Number(
                    req.headers["last-event-id"] || req.query.after || 0,
                  );
                  const push = async () => {
                    const events = (await store.db
                      .prepare(
                        "SELECT * FROM turn_events WHERE turn_id=? AND sequence>? ORDER BY sequence",
                      )
                      .all(e, last)) as any[];
                    for (const ev of events) {
                      res.write(
                        `id: ${ev.sequence}\nevent: ${ev.type}\ndata: ${ev.payload}\n\n`,
                      );
                      last = ev.sequence;
                    }
                    const latest = (await store.db
                      .prepare("SELECT status FROM turns WHERE id=?")
                      .get(e)) as any;
                    if (
                      ["completed", "failed", "cancelled"].includes(
                        latest.status,
                      )
                    ) {
                      clearInterval(timer);
                      res.end();
                    }
                  };
                  const timer = setInterval(push, 500);
                  req.on("close", () => clearInterval(timer));
                  await push();
                  return;
                } else
                  result = {
                    ...t,
                    answer: t.answer ? JSON.parse(t.answer) : null,
                    error: t.error ? JSON.parse(t.error) : null,
                  };
              }
            }
          }
        } else if (b === "admin") {
          requireRole(["admin"]);
          result = {
            provider_configured: agent.configured(),
            knowledge: {
              status: knowledge.lastError ? "degraded" : "available",
              mode: process.env.AGM_KNOWLEDGE_SEARCH_MODE || "hybrid",
            },
            jobs: await store.db
              .prepare(
                "SELECT * FROM jobs WHERE workspace_id=? ORDER BY next_run_at DESC LIMIT 100",
              )
              .all(w),
            memberships: await store.db
              .prepare(
                "SELECT u.id,u.email,u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?",
              )
              .all(w),
          };
        } else if (b === "memberships") {
          requireRole(["admin"]);
          if (method === "GET")
            result = await store.db
              .prepare(
                "SELECT u.id,u.email,u.name,m.role FROM users u JOIN memberships m ON u.id=m.user_id WHERE workspace_id=?",
              )
              .all(w);
          else {
            const p = z
              .object({
                email: z.email().optional(),
                role: z
                  .enum(["admin", "manager", "analyst", "reader"])
                  .nullable(),
              })
              .parse(body);
            const target =
              c ||
              (
                (await store.db
                  .prepare("SELECT id FROM users WHERE email=?")
                  .get(p.email || "")) as any
              )?.id;
            if (!target)
              throw new AppError(
                "RESOURCE_NOT_FOUND",
                "Conta não encontrada. Crie a conta pelo bootstrap administrativo.",
                404,
              );
            if (target === u && p.role !== "admin")
              throw new AppError(
                "FORBIDDEN",
                "Não é possível remover seu próprio acesso administrativo.",
                403,
              );
            if (p.role)
              await store.db
                .prepare(
                  "INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(user_id,workspace_id) DO UPDATE SET role=excluded.role",
                )
                .run(target, w, p.role);
            else
              await store.db
                .prepare(
                  "DELETE FROM memberships WHERE user_id=? AND workspace_id=?",
                )
                .run(target, w);
            await store.audit(w, u, "membership.updated", target);
            result = { ok: true };
          }
        } else if (b === "jobs" && c) {
          requireRole(["admin"]);
          const job = requireValue(
            await store.db
              .prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?")
              .get(c, w),
          );
          if (method === "POST" && d === "retry")
            await store.db
              .prepare(
                "UPDATE jobs SET state='queued',attempts=0,next_run_at=? WHERE id=?",
              )
              .run(now(), c);
          result = job;
        } else if (b === "audit") {
          requireRole(businessRoles);
          result = {
            items: await store.db
              .prepare(
                "SELECT * FROM audit WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100 OFFSET ?",
              )
              .all(w, (page - 1) * 100),
          };
        } else
          throw new AppError("RESOURCE_NOT_FOUND", "Rota não encontrada.", 404);
        res.json(result ?? { ok: true });
      } catch (error: any) {
        if (res.headersSent) {
          res.end();
          return;
        }
        const invalid = error instanceof z.ZodError;
        const code = invalid
          ? "VALIDATION_ERROR"
          : error.code || "INTERNAL_ERROR";
        const message = invalid
          ? error.issues
              .map((i: any) => `${i.path.join(".")}: ${i.message}`)
              .join(";")
          : error instanceof AppError
            ? error.message
            : "Não foi possível concluir esta operação.";
        if (!invalid && !(error instanceof AppError))
          console.error(
            JSON.stringify({ correlation_id, code, error: error.message }),
          );
        res
          .status(invalid ? 400 : error.status || 500)
          .json({ code, message, correlation_id });
      }
    }
  }
  @Module({ controllers: [ApiController] })
  class ApiModule {}
  const app = await NestFactory.create<any>(ApiModule, { logger: false });
  app.useBodyParser("json", { limit: "3mb" });
  app.use(cookieParser());
  if (process.env.AGM_FRONTEND_DIR) {
    // Next exports route payload directories alongside the HTML files.
    // Resolve page URLs explicitly so serve-static does not redirect to those directories.
    app.use((req: any, _res: any, next: () => void) => {
      if (req.method === "GET" || req.method === "HEAD") {
        req.url = req.url.replace(/^\/(login|agm)\/?(\?|$)/, "/$1.html$2");
      }
      next();
    });
    app.useStaticAssets(process.env.AGM_FRONTEND_DIR, {
      extensions: ["html"],
      index: "index.html",
      setHeaders(res: any, file: string) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader(
          "Cache-Control",
          file.includes("/_next/static/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    });
  }

  app.enableShutdownHooks();
  await app.init();
  if (startJobs) {
    knowledge.start();
    await imports.resume();
  }
  return { app, store, knowledge, agent, imports };
}
if (require.main === module) {
  createApp()
    .then(async ({ app, store, knowledge, imports }) => {
      await app.listen(
        Number(process.env.AGM_API_PORT || 3001),
        process.env.AGM_API_HOST || "127.0.0.1",
      );
      console.log(
        `Guardião: http://${process.env.AGM_API_HOST || "127.0.0.1"}:${process.env.AGM_API_PORT || 3001}`,
      );
      const close = async () => {
        await imports.close();
        await knowledge.close();
        await app.close();
        await store.close();
        process.exit(0);
      };
      process.on("SIGTERM", close);
      process.on("SIGINT", close);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
