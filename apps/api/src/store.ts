import { mapAsync } from "./database";
import { Database } from "./database";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import * as argon2 from "argon2";
import { AppError, requireValue } from "./errors";
import {
  decisionSchema,
  decisionCreationSchema,
  commitmentSchema,
  departments,
  neighborhoods,
} from "../../../packages/contracts";
export const uuid = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
export const decode = (r: any) =>
  r
    ? { ...r, ...(r.payload ? JSON.parse(r.payload) : {}), payload: undefined }
    : r;
export class Store {
  db: Database;
  dir: string;
  writers = new Map<string, Database>();
  readers = new Map<string, Database>();
  ready: Promise<void>;
  constructor(dir = process.env.AGM_DATA_DIR || "data") {
    this.dir = resolve(dir);
    mkdirSync(this.dir, { recursive: true });
    mkdirSync(join(this.dir, "sources"), { recursive: true });
    const schema =
      process.env.AGM_PG_SCHEMA || `guardiao_${hash(this.dir).slice(0, 12)}`;
    this.db = new Database(join(this.dir, "app.sqlite"), schema);
    for (const w of ["demo", "real"]) {
      const path = join(this.dir, `analytics-${w}.sqlite`);
      this.writers.set(w, new Database(path, `${schema}_${w}`));
      this.readers.set(w, new Database(path, `${schema}_${w}`, true));
    }
    this.ready = this.initialize();
  }
  private async initialize() {
    await this.db.exec(
      readFileSync(resolve("apps/api/src/schema.sql"), "utf8"),
    );
    for (const db of this.writers.values()) {
      await db.exec(
        `CREATE TABLE IF NOT EXISTS records(snapshot_id TEXT NOT NULL,row_number INTEGER NOT NULL,request_type TEXT,department TEXT,subject TEXT,neighborhood TEXT,status TEXT,created_date TEXT,response_date TEXT,response_valid INTEGER,fingerprint TEXT,quality_flags TEXT,PRIMARY KEY(snapshot_id,row_number));CREATE INDEX IF NOT EXISTS records_date ON records(snapshot_id,created_date);CREATE INDEX IF NOT EXISTS records_dims ON records(snapshot_id,neighborhood,department,subject);CREATE INDEX IF NOT EXISTS records_summary ON records(snapshot_id,request_type,created_date,status,response_valid,response_date,quality_flags);CREATE INDEX IF NOT EXISTS records_group_neighborhood ON records(snapshot_id,request_type,neighborhood,created_date);CREATE INDEX IF NOT EXISTS records_group_department ON records(snapshot_id,request_type,department,created_date);CREATE INDEX IF NOT EXISTS records_group_subject ON records(snapshot_id,request_type,subject,created_date);CREATE INDEX IF NOT EXISTS records_group_status ON records(snapshot_id,request_type,status,created_date);CREATE INDEX IF NOT EXISTS records_fingerprint ON records(snapshot_id,request_type,fingerprint,created_date);`,
      );
    }
  }
  async bootstrap(email: string, password: string) {
    await this.ready;
    await this.db
      .prepare("INSERT OR IGNORE INTO workspaces VALUES(?,?,?,?,?)")
      .run(
        "demo",
        "Município Demonstração",
        "synthetic_demo",
        "2026-09-13",
        "agm-municipio-demo",
      );
    await this.db
      .prepare("INSERT OR IGNORE INTO workspaces VALUES(?,?,?,?,?)")
      .run(
        "real",
        "Curitiba",
        "public_real",
        "2026-09-13",
        "agm-curitiba-public",
      );
    for (const w of ["demo", "real"])
      await this.db
        .prepare(
          "INSERT OR IGNORE INTO datasets(id,workspace_id,title) VALUES(?,?,?)",
        )
        .run(
          `dataset-${w}`,
          w,
          w === "demo"
            ? "Atendimento ao cidadão • Simulação"
            : "SIAC 156 • Dados públicos",
        );
    if (
      !(await this.db.prepare("SELECT id FROM users WHERE email=?").get(email))
    ) {
      const id = uuid();
      await this.db
        .prepare(
          "INSERT INTO users(id,email,password_hash,name) VALUES(?,?,?,?)",
        )
        .run(
          id,
          email,
          await argon2.hash(password, { type: argon2.argon2id }),
          "Administrador",
        );
      for (const w of ["demo", "real"])
        await this.db
          .prepare("INSERT INTO memberships VALUES(?,?,?)")
          .run(id, w, "admin");
    }
  }
  async workspace(w: string) {
    return requireValue(
      await this.db.prepare("SELECT * FROM workspaces WHERE id=?").get(w),
    ) as any;
  }
  async audit(w: string, u: string, action: string, id = "") {
    await this.db
      .prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)")
      .run(uuid(), w, u, action, id, now());
  }
  async saveSnapshot(w: string, parsed: any, metadata: any, bytes: Buffer) {
    await this.workspace(w);
    const sha = hash(bytes),
      identity = hash(
        JSON.stringify([
          w,
          sha,
          "v1",
          metadata.data_as_of,
          metadata.status_mapping || {},
          metadata.encoding || "utf-8",
          metadata.delimiter || ";",
        ]),
      );
    const existing = (await this.db
      .prepare("SELECT * FROM snapshots WHERE identity=?")
      .get(identity)) as any;
    if (existing) return existing;
    const id = uuid();
    writeFileSync(join(this.dir, "sources", sha), bytes);
    const db = this.writers.get(w)!;
    const insert = db.prepare(
      "INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    await db.transaction(async () => {
      await mapAsync(
        parsed.rows,
        async (r: any, i: number) =>
          await insert.run(
            id,
            r.source_row_number || i + 2,
            r.request_type,
            r.department,
            r.subject,
            r.neighborhood,
            r.status,
            r.created_date,
            r.response_date,
            r.response_valid ? 1 : 0,
            r.fingerprint,
            JSON.stringify(r.flags),
          ),
      );
    })();
    const state =
      parsed.quality.rejected_rows / parsed.quality.total_rows > 0.01 ||
      !parsed.rows.length
        ? "blocked"
        : "ready";
    metadata = {
      ...metadata,
      source_sha256: sha,
      origin_kind: (await this.workspace(w)).origin_kind,
      transform_version: "v1",
    };
    await this.db
      .prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        w,
        identity,
        JSON.stringify(metadata),
        JSON.stringify(parsed.quality),
        state,
        now(),
      );
    return (await this.db
      .prepare("SELECT * FROM snapshots WHERE id=?")
      .get(id)) as any;
  }
  async activate(w: string, id: string, u: string, ack = false) {
    const s = requireValue(
      await this.db
        .prepare("SELECT * FROM snapshots WHERE id=? AND workspace_id=?")
        .get(id, w),
    ) as any;
    const q = JSON.parse(s.quality);
    if (s.state !== "ready")
      throw new AppError(
        "IMPORT_QUALITY_BLOCKED",
        "A qualidade da importação impede a ativação.",
      );
    if (q.rejected_rows && !ack)
      throw new AppError(
        "QUALITY_ACK_REQUIRED",
        "Reconheça as linhas rejeitadas para ativar.",
      );
    await this.db.transaction(async () => {
      await this.db
        .prepare(
          "UPDATE datasets SET previous_snapshot_id=active_snapshot_id,active_snapshot_id=? WHERE workspace_id=? AND (active_snapshot_id IS NULL OR active_snapshot_id<>?)",
        )
        .run(id, w, id);
      await this.audit(w, u, "snapshot.activated", id);
    })();
    return await this.dataset(w);
  }
  async dataset(w: string) {
    const d = (await this.db
      .prepare("SELECT * FROM datasets WHERE workspace_id=?")
      .get(w)) as any;
    return {
      ...d,
      snapshot: d?.active_snapshot_id
        ? await this.snapshot(w, d.active_snapshot_id)
        : null,
      snapshots: (
        (await this.db
          .prepare(
            "SELECT * FROM snapshots WHERE workspace_id=? ORDER BY created_at DESC",
          )
          .all(w)) as any[]
      ).map((s) => ({
        ...s,
        metadata: JSON.parse(s.metadata),
        quality: JSON.parse(s.quality),
      })),
    };
  }
  async snapshot(w: string, id?: string) {
    if (!id)
      id = (
        (await this.db
          .prepare(
            "SELECT active_snapshot_id FROM datasets WHERE workspace_id=?",
          )
          .get(w)) as any
      )?.active_snapshot_id;
    const s = (await this.db
      .prepare("SELECT * FROM snapshots WHERE id=? AND workspace_id=?")
      .get(id || "", w)) as any;
    if (!s)
      throw new AppError(
        "DATASET_NOT_READY",
        "Este espaço ainda não tem uma base ativa.",
        409,
      );
    return {
      ...s,
      metadata: JSON.parse(s.metadata),
      quality: JSON.parse(s.quality),
    };
  }
  async entity(w: string, kind: string, id: string) {
    return decode(
      requireValue(
        await this.db
          .prepare(
            "SELECT * FROM entities WHERE id=? AND workspace_id=? AND kind=?",
          )
          .get(id, w, kind),
      ),
    );
  }
  async entities(w: string, kind: string, search = "", page = 1) {
    return (
      (await this.db
        .prepare(
          "SELECT * FROM entities WHERE workspace_id=? AND kind=? ORDER BY created_at DESC",
        )
        .all(w, kind)) as any[]
    )
      .map(decode)
      .filter(
        (e) =>
          !search ||
          JSON.stringify(e)
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
      )
      .slice((page - 1) * 100, page * 100);
  }
  async writeDecisionBundle(w: string, payload: any, u: string) {
    const { commitments, ...decision } = decisionCreationSchema.parse(payload);
    return await this.db.transaction(async () => {
      const entity = await this.writeEntity(w, "decisions", decision, u);
      const children = await mapAsync(
        commitments,
        async (c) =>
          await this.writeEntity(
            w,
            "commitments",
            { ...c, decision_id: entity.id },
            u,
          ),
      );
      return { ...entity, commitment_ids: children.map((c) => c.id) };
    })();
  }
  async validateEntity(w: string, kind: string, payload: any) {
    if (w !== "demo")
      throw new AppError(
        "FORBIDDEN",
        "Decisões e compromissos são permitidos somente no espaço simulado.",
        403,
      );
    const p = (kind === "decisions" ? decisionSchema : commitmentSchema).parse(
      payload,
    ) as any;
    if (!departments.includes(p.department))
      throw new AppError(
        "INVALID_DIMENSION",
        "Selecione uma secretaria cadastrada.",
      );
    if (p.neighborhood && !neighborhoods.includes(p.neighborhood))
      throw new AppError(
        "INVALID_DIMENSION",
        "Selecione um bairro cadastrado.",
      );
    for (const source of p.source_refs || [])
      await this.document(w, source.document_id, source.version);
    if (p.decision_id) await this.entity(w, "decisions", p.decision_id);
    if (p.supersedes_id) await this.entity(w, "decisions", p.supersedes_id);
    return p;
  }
  async writeEntity(
    w: string,
    kind: string,
    payload: any,
    u: string,
    id?: string,
    version?: number,
  ) {
    const p = await this.validateEntity(w, kind, payload);
    return await this.db.transaction(async () => {
      let v = 1;
      const time = now();
      if (id) {
        const old = await this.entity(w, kind, id);
        if (old.status !== p.status) {
          const transitions: any =
            kind === "decisions"
              ? {
                  active: ["superseded", "revoked"],
                  superseded: [],
                  revoked: [],
                }
              : {
                  open: ["in_progress", "completed", "cancelled"],
                  in_progress: ["completed", "cancelled"],
                  completed: [],
                  cancelled: [],
                };
          if (!transitions[old.status]?.includes(p.status))
            throw new AppError(
              "INVALID_TRANSITION",
              "Essa mudança de situação não é permitida. Registre uma nova ação para outro acompanhamento.",
              409,
            );
        }
        if (old.version !== version)
          throw new AppError(
            "VERSION_CONFLICT",
            "O registro foi atualizado. Recarregue antes de salvar.",
            409,
          );
        v = version! + 1;
        await this.db
          .prepare(
            "UPDATE entities SET payload=?,version=?,indexing_state='pending' WHERE id=?",
          )
          .run(JSON.stringify(p), v, id);
      } else {
        id = uuid();
        await this.db
          .prepare(
            "INSERT INTO entities(id,workspace_id,kind,payload,version,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
          )
          .run(id, w, kind, JSON.stringify(p), v, u, time);
      }
      await this.db
        .prepare("INSERT INTO revisions VALUES(?,?,?,?,?)")
        .run(id, v, JSON.stringify(p), u, time);
      await this.enqueue(w, id!, kind);
      if (p.supersedes_id) {
        const old = await this.entity(w, kind, p.supersedes_id);
        if (old.status === "active")
          await this.writeEntity(
            w,
            kind,
            { ...decisionSchema.parse(oldPayload(old)), status: "superseded" },
            u,
            old.id,
            old.version,
          );
      }
      await this.audit(w, u, `${kind}.${v === 1 ? "created" : "revised"}`, id);
      return await this.entity(w, kind, id!);
    })();
  }
  async enqueue(w: string, id: string, kind: string) {
    await this.db
      .prepare(
        "INSERT INTO jobs(id,workspace_id,entity_id,kind,next_run_at) VALUES(?,?,?,?,?)",
      )
      .run(uuid(), w, id, kind, now());
  }
  async idempotent(
    w: string,
    u: string,
    route: string,
    key: string | undefined,
    body: any,
    fn: () => any,
  ) {
    if (!key || key.length > 200)
      throw new AppError(
        "IDEMPOTENCY_REQUIRED",
        "Idempotency-Key obrigatório.",
      );
    const requestHash = hash(JSON.stringify(body));
    return await this.db.transaction(async () => {
      const old = (await this.db
        .prepare(
          "SELECT * FROM idempotency WHERE workspace_id=? AND actor_id=? AND route=? AND key=?",
        )
        .get(w, u, route, key)) as any;
      if (old) {
        if (old.request_hash !== requestHash)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "Chave já utilizada com outro conteúdo.",
            409,
          );
        return JSON.parse(old.response);
      }
      const result = await fn();
      await this.db
        .prepare("INSERT INTO idempotency VALUES(?,?,?,?,?,?)")
        .run(w, u, route, key, requestHash, JSON.stringify(result));
      return result;
    })();
  }
  async addDocument(
    w: string,
    title: string,
    content: string,
    u: string,
    effective: string,
    sourceUrl = "",
    id?: string,
  ) {
    if (Buffer.byteLength(content) > 2097152)
      throw new AppError("FILE_TOO_LARGE", "Documento acima de 2 MiB.");
    if (w === "real" && !/^https:\/\//.test(sourceUrl))
      throw new AppError(
        "SOURCE_REQUIRED",
        "Informe a origem pública do documento autêntico.",
      );
    return await this.db.transaction(async () => {
      let v = 1;
      if (id) {
        const old = await this.document(w, id);
        v = old.version + 1;
        await this.db
          .prepare(
            "UPDATE documents SET title=?,version=?,indexing_state='pending' WHERE id=?",
          )
          .run(title, v, id);
      } else {
        id = uuid();
        await this.db
          .prepare(
            "INSERT INTO documents(id,workspace_id,title,kind,version,origin_kind) VALUES(?,?,?,?,?,?)",
          )
          .run(
            id,
            w,
            title,
            "meeting",
            v,
            (await this.workspace(w)).origin_kind,
          );
      }
      await this.db
        .prepare("INSERT INTO document_versions VALUES(?,?,?,?,?,?,?)")
        .run(id, v, content, hash(content), effective, sourceUrl, now());
      await this.enqueue(w, id!, "documents");
      await this.audit(w, u, "document.imported", id);
      return await this.document(w, id!);
    })();
  }
  async document(w: string, id: string, version?: number) {
    const doc = requireValue(
      await this.db
        .prepare("SELECT * FROM documents WHERE id=? AND workspace_id=?")
        .get(id, w),
    ) as any;
    return {
      ...doc,
      ...(requireValue(
        await this.db
          .prepare(
            "SELECT * FROM document_versions WHERE document_id=? AND version=?",
          )
          .get(id, version || doc.version),
      ) as any),
    };
  }
  async evidence(w: string, u: string | null, kind: string, payload: any) {
    const id = uuid();
    await this.db
      .prepare("INSERT INTO evidence VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        w,
        u,
        kind,
        JSON.stringify(payload),
        hash(JSON.stringify(payload)),
        now(),
      );
    return id;
  }
  async source(w: string, id: string, u: string) {
    const s = requireValue(
      await this.db
        .prepare(
          "SELECT * FROM evidence WHERE id=? AND workspace_id=? AND (user_id IS NULL OR user_id=?)",
        )
        .get(id, w, u),
    ) as any;
    return { ...s, payload: JSON.parse(s.payload) };
  }
  async event(turn: string, type: string, payload: any) {
    await this.db.transaction(async () => {
      const seq = (
        (await this.db
          .prepare(
            "SELECT COALESCE(MAX(sequence),0)+1 AS n FROM turn_events WHERE turn_id=?",
          )
          .get(turn)) as any
      ).n;
      await this.db
        .prepare("INSERT INTO turn_events VALUES(?,?,?,?,?)")
        .run(turn, seq, type, JSON.stringify(payload), now());
    })();
  }

  async close() {
    await this.ready;
    for (const d of this.readers.values()) await d.close();
    for (const d of this.writers.values()) await d.close();
    await this.db.close();
  }
}
export function oldPayload(entity: any) {
  const {
    id,
    workspace_id,
    kind,
    version,
    created_by,
    created_at,
    indexing_state,
    payload,
    ...p
  } = entity;
  return p;
}
