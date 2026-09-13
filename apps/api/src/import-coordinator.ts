import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { Store } from "./store";
export class ImportCoordinator {
  active = new Map<string, Worker>();
  constructor(public store: Store) {}
  async resume() {
    for (const imp of (await this.store.db
      .prepare(
        "SELECT id,workspace_id,state FROM imports WHERE state IN ('previewing','processing')",
      )
      .all()) as any[])
      this.start(
        imp.id,
        imp.workspace_id,
        imp.state === "previewing" ? "preview" : "confirm",
      );
  }
  start(id: string, w: string, mode: "preview" | "confirm") {
    if (this.active.has(w)) return;
    const worker = new Worker(resolve("scripts/import-worker.cjs"), {
      workerData: { id, dir: this.store.dir, mode },
      resourceLimits: { maxOldGenerationSizeMb: 768 },
    });
    this.active.set(w, worker);
    const timer = setTimeout(() => worker.terminate(), 300000);
    worker.on("error", async () => {
      await this.store.db
        .prepare("UPDATE imports SET state='failed',result=? WHERE id=?")
        .run(
          JSON.stringify({
            code: "IMPORT_FAILED",
            message: "O processamento do arquivo falhou.",
          }),
          id,
        );
    });
    worker.on("exit", async (code) => {
      clearTimeout(timer);
      this.active.delete(w);
      if (code)
        await this.store.db
          .prepare("UPDATE imports SET state='failed',result=? WHERE id=?")
          .run(
            JSON.stringify({
              code: "IMPORT_TIMEOUT",
              message: "O arquivo excedeu os recursos ou o tempo permitido.",
            }),
            id,
          );
    });
  }
  async close() {
    await Promise.all([...this.active.values()].map((w) => w.terminate()));
  }
}
