import { workerData, parentPort } from "node:worker_threads";
import { createReadStream, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Store, uuid, hash, now } from "./store";
import { parseDemandFile } from "./imports";
async function main() {
  const s = new Store(workerData.dir);
  await s.ready;
  try {
    const imp = (await s.db
      .prepare("SELECT * FROM imports WHERE id=?")
      .get(workerData.id)) as any;
    const meta = JSON.parse(imp.metadata);
    if (workerData.mode === "preview") {
      const parsed = await parseDemandFile(
        imp.path,
        imp.filename,
        meta.data_as_of,
        meta,
        () => {},
      );
      await s.db
        .prepare(
          "UPDATE imports SET state='awaiting_mapping',result=? WHERE id=?",
        )
        .run(
          JSON.stringify({
            headers: parsed.headers,
            preview: parsed.preview,
            quality: parsed.quality,
          }),
          imp.id,
        );
    } else {
      const fingerprint = createHash("sha256");
      for await (const b of createReadStream(imp.path)) fingerprint.update(b);
      const sha = fingerprint.digest("hex");
      const identity = hash(
        JSON.stringify([
          imp.workspace_id,
          sha,
          "v1",
          meta.data_as_of,
          meta.status_mapping || {},
          meta.encoding || "utf-8",
          meta.delimiter || ";",
        ]),
      );
      const existing = (await s.db
        .prepare("SELECT id,state,quality FROM snapshots WHERE identity=?")
        .get(identity)) as any;
      if (existing) {
        await s.db
          .prepare("UPDATE imports SET state=?,result=? WHERE id=?")
          .run(
            existing.state,
            JSON.stringify({
              snapshot_id: existing.id,
              state: existing.state,
              quality: JSON.parse(existing.quality),
            }),
            imp.id,
          );
        return;
      }
      const id = uuid(),
        db = s.writers.get(imp.workspace_id)!;
      const insert = db.prepare(
        "INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      );
      let batch: any[] = [];
      const flush = async () => {
        await db.transaction(async () => {
          for (const r of batch)
            await insert.run(
              id,
              r.source_row_number,
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
            );
        })();
        batch = [];
      };
      try {
        const parsed = await parseDemandFile(
          imp.path,
          imp.filename,
          meta.data_as_of,
          meta,
          async (r) => {
            batch.push(r);
            if (batch.length >= 1000) await flush();
          },
        );
        await flush();
        const state =
          parsed.quality.rejected_rows / parsed.quality.total_rows > 0.01 ||
          !parsed.quality.accepted_rows
            ? "blocked"
            : "ready";
        copyFileSync(imp.path, join(s.dir, "sources", sha));
        const metadata = {
          ...meta,
          source_sha256: sha,
          origin_kind: (await s.workspace(imp.workspace_id)).origin_kind,
          transform_version: "v1",
        };
        await s.db.transaction(async () => {
          await s.db
            .prepare("INSERT INTO snapshots VALUES(?,?,?,?,?,?,?)")
            .run(
              id,
              imp.workspace_id,
              identity,
              JSON.stringify(metadata),
              JSON.stringify(parsed.quality),
              state,
              now(),
            );
          await s.db
            .prepare("UPDATE imports SET state=?,result=? WHERE id=?")
            .run(
              state,
              JSON.stringify({
                snapshot_id: id,
                state,
                quality: parsed.quality,
              }),
              imp.id,
            );
          await s.audit(imp.workspace_id, "worker", "import.ready", imp.id);
        })();
      } catch (e) {
        await db.prepare("DELETE FROM records WHERE snapshot_id=?").run(id);
        throw e;
      }
    }
  } catch (error: any) {
    await s.db
      .prepare("UPDATE imports SET state='failed',result=? WHERE id=?")
      .run(
        JSON.stringify({
          code: error.code || "IMPORT_FAILED",
          message: error.message,
        }),
        workerData.id,
      );
  } finally {
    await s.close();
    parentPort?.postMessage({ done: true });
  }
}
main();
