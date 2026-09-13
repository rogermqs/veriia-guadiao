import Database from "better-sqlite3";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  cpSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const dir = resolve(process.env.AGM_DATA_DIR || "data"),
  root = join(dir, "backups");
mkdirSync(root, { recursive: true });
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function files(path: string): string[] {
  return readdirSync(path).flatMap((n) => {
    const p = join(path, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
async function main() {
  if (process.argv.includes("--check")) {
    const entries = readdirSync(root)
      .filter((n) => n.startsWith("backup-"))
      .sort();
    if (!entries.length) throw Error("Execute o backup primeiro.");
    const from = join(root, entries.at(-1)!),
      to = join(root, "restore-" + Date.now());
    cpSync(from, to, { recursive: true });
    const manifest = JSON.parse(
      readFileSync(join(to, "manifest.json"), "utf8"),
    );
    for (const [name, digest] of Object.entries(manifest.files))
      if (hash(readFileSync(join(to, name))) !== digest)
        throw Error("Hash divergente: " + name);
    const db = new Database(join(to, "app.sqlite"), { readonly: true });
    const integrity = db.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw Error("Banco inconsistente");
    const actual = {
      decisions: (
        (await db
          .prepare("SELECT COUNT(*) n FROM entities WHERE kind='decisions'")
          .get()) as any
      ).n,
      commitments: (
        (await db
          .prepare("SELECT COUNT(*) n FROM entities WHERE kind='commitments'")
          .get()) as any
      ).n,
      snapshots: await db
        .prepare("SELECT id,active_snapshot_id FROM datasets ORDER BY id")
        .all(),
    };
    if (JSON.stringify(actual) !== JSON.stringify(manifest.state))
      throw Error("Estado restaurado não corresponde ao manifesto");
    await db.close();
    writeFileSync(
      "docs/contracts/restore-check.json",
      JSON.stringify(
        {
          restored_at: new Date().toISOString(),
          directory: relative(process.cwd(), to),
          integrity,
          state: actual,
          verified_files: Object.keys(manifest.files).length,
        },
        null,
        2,
      ),
    );
    console.log("Restauração independente verificada:", JSON.stringify(actual));
    return;
  }
  const marker = join(dir, "backup.lock");
  writeFileSync(marker, new Date().toISOString(), { flag: "wx" });
  const output = join(
    root,
    "backup-" + new Date().toISOString().replaceAll(":", "-"),
  );
  try {
    const app = new Database(join(dir, "app.sqlite"));
    for (let i = 0; i < 30; i++) {
      const active = (
        (await app
          .prepare(
            "SELECT (SELECT COUNT(*) FROM turns WHERE status IN ('queued','running'))+(SELECT COUNT(*) FROM imports WHERE state IN ('previewing','processing'))+(SELECT COUNT(*) FROM jobs WHERE state='running') n",
          )
          .get()) as any
      ).n;
      if (!active) break;
      if (i === 29)
        throw Error("Operações ainda ativas. Tente novamente ao finalizar.");
      await new Promise((r) => setTimeout(r, 1000));
    }
    mkdirSync(output, { recursive: true });
    const state = {
      decisions: (
        (await app
          .prepare("SELECT COUNT(*) n FROM entities WHERE kind='decisions'")
          .get()) as any
      ).n,
      commitments: (
        (await app
          .prepare("SELECT COUNT(*) n FROM entities WHERE kind='commitments'")
          .get()) as any
      ).n,
      snapshots: await app
        .prepare("SELECT id,active_snapshot_id FROM datasets ORDER BY id")
        .all(),
    };
    await app.backup(join(output, "app.sqlite"));
    app.close();
    for (const name of ["analytics-demo.sqlite", "analytics-real.sqlite"]) {
      const db = new Database(join(dir, name));
      await db.backup(join(output, name));
      await db.close();
    }
    for (const name of ["sources", "vaults", "memory-config", "uploads"])
      if (existsSync(join(dir, name)))
        cpSync(join(dir, name), join(output, name), {
          recursive: true,
          filter: (p) =>
            !p.endsWith(".db") &&
            !p.endsWith(".db-wal") &&
            !p.endsWith(".db-shm") &&
            !p.endsWith(".log"),
        });
    const digest = Object.fromEntries(
      files(output).map((p) => [relative(output, p), hash(readFileSync(p))]),
    );
    writeFileSync(
      join(output, "manifest.json"),
      JSON.stringify(
        {
          created_at: new Date().toISOString(),
          state,
          files: digest,
          note: "Índice de memória reconstruível; não incluído como banco ativo.",
        },
        null,
        2,
      ),
    );
    console.log("Backup consistente criado:", relative(process.cwd(), output));
  } finally {
    unlinkSync(marker);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
