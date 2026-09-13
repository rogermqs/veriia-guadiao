import SQLite from "better-sqlite3";
import { Store } from "../apps/api/src/store";
import { join, basename, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

async function main() {
  if (!process.env.DATABASE_URL || !process.env.AGM_PG_SCHEMA)
    throw Error("Configure DATABASE_URL e AGM_PG_SCHEMA para o destino.");
  const source = resolve(process.argv[2] || "");
  const manifest = JSON.parse(
    readFileSync(join(source, "manifest.json"), "utf8"),
  );
  for (const [path, expected] of Object.entries(manifest.files)) {
    const actual = createHash("sha256")
      .update(readFileSync(join(source, path)))
      .digest("hex");
    if (actual !== expected) throw Error(`Backup alterado: ${path}`);
  }
  const store = new Store();
  await store.ready;
  const report: any = {
    migrated_at: new Date().toISOString(),
    source,
    tables: {},
    excluded: ["sessions"],
    transformed: ["imports.path"],
  };
  try {
    if ((await store.db.prepare("SELECT COUNT(*) n FROM users").get()).n)
      throw Error(
        "O destino já contém dados. Migração cancelada para preservar o banco.",
      );
    for (const name of ["app", "analytics-demo", "analytics-real"]) {
      const sqlite = new SQLite(join(source, `${name}.sqlite`), {
        readonly: true,
      });
      const db =
        name === "app"
          ? store.db
          : store.writers.get(name.replace("analytics-", ""))!;
      try {
        await db.transaction(async () => {
          const tables = sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
            )
            .all() as { name: string }[];
          for (const { name: table } of tables) {
            if (["schema_migrations", "sessions"].includes(table)) continue;
            if (!/^[a-z_]+$/.test(table)) throw Error("Unexpected table");
            const rows = sqlite
              .prepare(`SELECT * FROM "${table}"`)
              .all() as any[];
            if (table === "imports")
              for (const row of rows)
                row.path = `/app/data/uploads/${basename(row.path)}`;
            if (rows.length) {
              const columns = Object.keys(rows[0]);
              for (let offset = 0; offset < rows.length; offset += 200) {
                const chunk = rows.slice(offset, offset + 200);
                await db
                  .prepare(
                    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",")}`,
                  )
                  .run(...chunk.flatMap((row) => columns.map((c) => row[c])));
              }
            }
            const migrated = await db.prepare(`SELECT * FROM "${table}"`).all();
            const digest = (items: any[]) =>
              createHash("sha256")
                .update(
                  JSON.stringify(
                    items
                      .map((row) =>
                        JSON.stringify(
                          Object.fromEntries(Object.entries(row).sort()),
                        ),
                      )
                      .sort(),
                  ),
                )
                .digest("hex");
            if (digest(rows) !== digest(migrated))
              throw Error(`Dados divergentes: ${name}.${table}`);
            report.tables[`${name}.${table}`] = {
              rows: rows.length,
              sha256: digest(rows),
            };
          }
        })();
      } finally {
        sqlite.close();
      }
    }
    writeFileSync(
      "docs/contracts/postgres-migration.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({ verified: true, tables: report.tables }, null, 2),
    );
  } finally {
    await store.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
