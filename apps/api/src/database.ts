import SQLite from "better-sqlite3";
import { Pool, PoolClient, types } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

/** One pinned connection per transaction, including nested service calls. */
export class Database {
  readonly postgres: boolean;
  private sqlite?: SQLite.Database;
  private pool?: Pool;
  private context = new AsyncLocalStorage<{
    client?: PoolClient;
    depth: number;
  }>();
  private tail: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;
  constructor(path: string, schema: string, readonly = false) {
    this.postgres = !!process.env.DATABASE_URL;
    if (this.postgres) {
      if (!/^[a-z][a-z0-9_]*$/.test(schema))
        throw Error("Invalid database schema");
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: readonly ? 2 : 4,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        options: `-c search_path=${schema} -c statement_timeout=${readonly ? 3000 : 15000}${readonly ? " -c default_transaction_read_only=on" : ""}`,
      });
      this.ready = readonly
        ? Promise.resolve()
        : (async () => {
            const client = await this.pool!.connect();
            try {
              await client.query("BEGIN");
              await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
                "initialize:" + schema,
              ]);
              await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
              await client.query("COMMIT");
            } catch (e) {
              await client.query("ROLLBACK");
              throw e;
            } finally {
              client.release();
            }
          })();
      this.ready.catch(() => {});
    } else {
      this.sqlite = new SQLite(path, { readonly });
      if (!readonly) this.sqlite.pragma("journal_mode=WAL");
      else this.sqlite.pragma("query_only=ON");
      this.sqlite.pragma("foreign_keys=ON");
      this.sqlite.pragma("busy_timeout=5000");
      this.ready = Promise.resolve();
    }
  }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.postgres || this.context.getStore()) return fn();
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => {});
    return result;
  }
  private sql(sql: string) {
    if (!this.postgres) return sql;
    sql = sql
      .replace(/PRAGMA[^;]*;/g, "")
      .replace(/ INDEXED BY \w+/g, "")
      .replace(/ COLLATE NOCASE/g, "")
      .replace(
        /strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)/g,
        "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
      )
      .replace(
        /json_extract\(response,'\$\.id'\)/g,
        "(response::jsonb->>'id')",
      );
    sql = sql
      .split(";")
      .map((s) =>
        /INSERT OR IGNORE/i.test(s)
          ? s.replace(/INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING"
          : s,
      )
      .join(";");
    let index = 0;
    return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, (token) =>
      token === "?" ? `$${++index}` : token,
    );
  }
  async exec(sql: string) {
    await this.ready;
    return this.exclusive(async () => {
      if (this.pool)
        await (this.context.getStore()?.client || this.pool).query(
          this.sql(sql),
        );
      else this.sqlite!.exec(sql);
    });
  }
  prepare(sql: string) {
    const query = async (
      params: any[],
      mode: "get" | "all" | "run",
    ): Promise<any> => {
      await this.ready;
      return this.exclusive(async () => {
        if (this.pool) {
          const result = await (
            this.context.getStore()?.client || this.pool
          ).query(
            this.sql(sql),
            params.map((v) => (v === undefined ? null : v)),
          );
          return mode === "run"
            ? { changes: result.rowCount || 0 }
            : mode === "get"
              ? result.rows[0]
              : result.rows;
        }
        return this.sqlite!.prepare(sql)[mode](...params);
      });
    };
    return {
      get: (...p: any[]) => query(p, "get"),
      all: (...p: any[]) => query(p, "all"),
      run: (...p: any[]) => query(p, "run"),
    };
  }
  transaction<T>(fn: () => T | Promise<T>) {
    return async (): Promise<T> => {
      await this.ready;
      return this.exclusive(async () => {
        const parent = this.context.getStore();
        const client =
          parent?.client || (this.pool ? await this.pool.connect() : undefined);
        const depth = (parent?.depth || 0) + 1;
        const execute = async (sql: string) => {
          if (client) await client.query(sql);
          else this.sqlite!.exec(sql);
        };
        const savepoint = `nested_${depth}`;
        try {
          await execute(parent ? `SAVEPOINT ${savepoint}` : "BEGIN");
          // Serialize domain writes across processes, preserving SQLite's previous transaction semantics.
          if (client && !parent)
            await client.query(
              "SELECT pg_advisory_xact_lock(hashtext(current_schema()))",
            );
          const result = await this.context.run({ client, depth }, fn);
          await execute(parent ? `RELEASE SAVEPOINT ${savepoint}` : "COMMIT");
          return result;
        } catch (error) {
          await execute(
            parent ? `ROLLBACK TO SAVEPOINT ${savepoint}` : "ROLLBACK",
          );
          throw error;
        } finally {
          if (client && !parent) client.release();
        }
      });
    };
  }
  async close() {
    await this.ready;
    await this.tail;
    if (this.pool) await this.pool.end();
    else this.sqlite!.close();
  }
}
export async function mapAsync<T, U>(
  values: T[],
  fn: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < values.length; i++) results.push(await fn(values[i], i));
  return results;
}
