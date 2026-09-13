import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { filtersSchema } from "../../../packages/contracts";
import { Store, uuid, hash, now } from "./store";
import { AppError } from "./errors";
export class Analytics {
  constructor(public store: Store) {}
  async runAsync(
    w: string,
    kind: string,
    input: any,
    u: string,
    snapshotId?: string,
  ) {
    await this.store.ready;
    if (this.store.db.postgres) return this.run(w, kind, input, u, snapshotId);
    const filters = filtersSchema.parse(input);
    const snapshot = (await this.store.snapshot(w, snapshotId)).id;
    return new Promise<any>((resolveResult, reject) => {
      const worker = new Worker(resolve("scripts/analytics-worker.cjs"), {
        workerData: {
          dir: this.store.dir,
          workspace: w,
          kind,
          input: filters,
          user: u,
          snapshot,
        },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      let settled = false;
      const timer = setTimeout(
        () => {
          settled = true;
          worker.terminate();
          reject(
            new AppError(
              "QUERY_TIMEOUT",
              "A consulta excedeu o tempo permitido. Reduza o período ou aplique filtros.",
              408,
            ),
          );
        },
        Number(process.env.AGM_QUERY_TIMEOUT_MS || 3000),
      );
      worker.once("message", ({ result, error }) => {
        settled = true;
        clearTimeout(timer);
        if (error)
          reject(
            new AppError(
              error.code || "QUERY_FAILED",
              error.message,
              error.status || 500,
            ),
          );
        else resolveResult(result);
      });
      worker.once("error", () => {
        settled = true;
        clearTimeout(timer);
        reject(
          new AppError(
            "QUERY_FAILED",
            "Não foi possível executar a consulta.",
            500,
          ),
        );
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (!settled)
          reject(
            new AppError("QUERY_FAILED", "A consulta foi interrompida.", 500),
          );
      });
    });
  }
  async run(
    w: string,
    kind: string,
    input: any,
    u: string,
    snapshotId?: string,
  ) {
    const f = filtersSchema.parse(input);
    const snap = await this.store.snapshot(w, snapshotId);
    const cutoff = snap.metadata.data_as_of;
    const predicates = ["snapshot_id=?", "request_type=?", "created_date<=?"];
    const args: any[] = [snap.id, f.request_type, cutoff];
    for (const [key, col, op] of [
      ["created_from", "created_date", ">="],
      ["created_to", "created_date", "<="],
      ["department", "department", "="],
      ["neighborhood", "neighborhood", "="],
      ["subject", "subject", "="],
      ["status", "status", "="],
    ])
      if ((f as any)[key]) {
        predicates.push(`${col}${op}?`);
        args.push((f as any)[key]);
      }
    const where = predicates.join(" AND ");
    const index =
      kind === "grouped"
        ? `records_group_${f.group_by}`
        : kind === "summary"
          ? "records_summary"
          : "records_date";
    const db = this.store.readers.get(w)!;
    const day = (column: string) =>
      db.postgres ? `CAST(${column} AS date)` : `julianday(${column})`;
    let result: any;
    if (kind === "summary") {
      result = await db
        .prepare(
          `SELECT COUNT(*) total_records,COALESCE(SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END),0) pending_records,COALESCE(SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END),0) closed_records,COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) cancelled_records,COALESCE(SUM(CASE WHEN status='unknown' THEN 1 ELSE 0 END),0) unknown_status_records,COALESCE(SUM(response_valid),0) response_observation_count,AVG(CASE WHEN response_valid=1 THEN ${day("response_date")}-${day("created_date")} END) average_response_days,COALESCE(SUM(CASE WHEN status IN ('open','in_progress') AND ${day("?")} - ${day("created_date")}>30 THEN 1 ELSE 0 END),0) pending_older_than_30_days,COALESCE(SUM(CASE WHEN quality_flags LIKE '%invalid_response_date%' THEN 1 ELSE 0 END),0) invalid_response_date_records FROM records INDEXED BY ${index} WHERE ${where}`,
        )
        .get(cutoff, ...args);
      result.duplicate_fingerprint_excess_rows = (
        (await db
          .prepare(
            `SELECT COUNT(*)-COUNT(DISTINCT fingerprint) n FROM records INDEXED BY records_fingerprint WHERE ${where}`,
          )
          .get(...args)) as any
      ).n;
    } else if (kind === "grouped") {
      const col = f.group_by;
      result = {
        rows: await db
          .prepare(
            `SELECT ${col} label,COUNT(*) value FROM records INDEXED BY ${index} WHERE ${where} GROUP BY ${col} ORDER BY value DESC,${col} COLLATE NOCASE ASC LIMIT ?`,
          )
          .all(...args, Math.min(f.limit, 20)),
        total_records_in_scope: (
          (await db
            .prepare(
              `SELECT COUNT(*) n FROM records INDEXED BY ${index} WHERE ${where}`,
            )
            .get(...args)) as any
        ).n,
      };
    } else if (kind === "time-series") {
      result = {
        rows: await db
          .prepare(
            `SELECT created_date label,COUNT(*) value FROM records INDEXED BY ${index} WHERE ${where} GROUP BY created_date ORDER BY created_date`,
          )
          .all(...args),
      };
    } else if (kind === "records") {
      result = {
        rows: await db
          .prepare(
            `SELECT row_number,request_type,department,subject,neighborhood,status,created_date,response_date,response_valid,quality_flags FROM records INDEXED BY ${index} WHERE ${where} ORDER BY created_date DESC,row_number LIMIT ? OFFSET ?`,
          )
          .all(...args, f.limit, (f.page - 1) * f.limit),
        page: f.page,
        total: (
          (await db
            .prepare(
              `SELECT COUNT(*) n FROM records INDEXED BY ${index} WHERE ${where}`,
            )
            .get(...args)) as any
        ).n,
      };
    } else throw new AppError("INVALID_QUERY", "Consulta não permitida.");
    const id = uuid();
    const output = {
      id,
      query_run_id: id,
      query_version: `demands.${kind}.v1`,
      snapshot_id: snap.id,
      origin_kind: (await this.store.workspace(w)).origin_kind,
      data_as_of: cutoff,
      source: snap.metadata,
      quality: snap.quality,
      filters: f,
      result,
      limitations: [
        ...(w === "demo" ? ["Cenário fictício de demonstração."] : []),
        ...(f.created_to && f.created_to > cutoff
          ? [
              `Cobertura limitada a ${cutoff}. Não há dados posteriores ao corte.`,
            ]
          : []),
        "Registros não representam protocolos únicos. Data de resposta não comprova execução do serviço.",
      ],
    };
    const json = JSON.stringify(output);
    await this.store.db
      .prepare("INSERT INTO query_runs VALUES(?,?,?,?,?,?,?,?,?)")
      .run(id, w, u, snap.id, kind, JSON.stringify(f), json, hash(json), now());
    await this.store.audit(w, u, `analytics.${kind}`, id);
    return output;
  }
}
export function csvCell(v: any) {
  if (typeof v === "number") return String(v);
  let text = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportQuery(q: any) {
  const rows =
    q.result.rows ||
    Object.entries(q.result).map(([metric, value]) => ({ metric, value }));
  const cols = rows.length ? Object.keys(rows[0]) : ["label", "value"];
  return (
    "\uFEFF" +
    [
      ["Origem", q.origin_kind],
      ["Data de referência", q.data_as_of],
      ["Snapshot", q.snapshot_id],
      ["Consulta", q.query_run_id],
      ["Filtros", JSON.stringify(q.filters)],
      ["Fonte", q.source.source_url || "Simulação"],
      [],
      cols,
      ...rows.map((r: any) => cols.map((k) => r[k])),
    ]
      .map((r) => r.map(csvCell).join(";"))
      .join("\r\n")
  );
}
