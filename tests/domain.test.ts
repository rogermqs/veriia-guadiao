import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/api/src/store";
import { Auth } from "../apps/api/src/auth";
import { csvCell } from "../apps/api/src/analytics";
it("persists revisions and outbox atomically, enforces idempotency and isolation after restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agm-domain-"));
  let s = new Store(dir);
  await s.bootstrap("a@test.local", "secure-test-password");
  const payload = {
    title: "Plano de manutenção",
    department: "Secretaria de Obras",
    due_date: "2026-09-30",
  };
  const run = async () =>
    await s.idempotent(
      "demo",
      "admin",
      "create",
      "same",
      payload,
      async () => await s.writeEntity("demo", "commitments", payload, "admin"),
    );
  const first = await run();
  expect((await run()).id).toBe(first.id);
  await expect(
    s.idempotent("demo", "admin", "create", "same", {}, () => null),
  ).rejects.toThrow(/Chave/);
  await expect(s.entity("real", "commitments", first.id)).rejects.toThrow();
  await expect(
    s.writeEntity("real", "commitments", payload, "admin"),
  ).rejects.toThrow();
  await expect(
    s.writeEntity("demo", "commitments", payload, "admin", first.id, 9),
  ).rejects.toThrow();
  await s.writeEntity(
    "demo",
    "commitments",
    { ...payload, status: "completed" },
    "admin",
    first.id,
    1,
  );
  expect(
    await s.db
      .prepare("SELECT COUNT(*) n FROM revisions WHERE entity_id=?")
      .get(first.id),
  ).toEqual({ n: 2 });
  await s.close();
  s = new Store(dir);
  expect((await s.entity("demo", "commitments", first.id)).status).toBe(
    "completed",
  );
  expect(await s.db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({
    n: 2,
  });
  const auth = new Auth(s);
  await expect(auth.identity(undefined)).rejects.toThrow();
  const login = await auth.login(
    "a@test.local",
    "secure-test-password",
    "test",
  );
  expect(login.user.workspaces).toHaveLength(2);
  expect(() =>
    auth.authorize({ workspaces: [{ id: "demo", role: "reader" }] }, "demo", [
      "admin",
      "manager",
    ]),
  ).toThrow();
  await s.close();
  rmSync(dir, { recursive: true, force: true });
});
it("neutralizes spreadsheet formulas without corrupting numeric metrics", () => {
  for (const v of ["=1+1", "+SUM(A1)", "-1+2", "@evil", "\ttest", "\rtest"])
    expect(csvCell(v)).toMatch(/^"'/);
  expect(csvCell(-2)).toBe("-2");
  expect(csvCell('a"b')).toBe('"a""b"');
});
it("creates decision commitments and projections atomically", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agm-bundle-"));
  const s = new Store(dir);
  await s.bootstrap("bundle@test.local", "secure-test-password");
  const decision = {
    title: "Plano integrado",
    statement: "Executar manutenção preventiva",
    department: "Secretaria de Obras",
    decided_on: "2026-09-13",
  };
  await expect(
    s.writeDecisionBundle(
      "demo",
      {
        ...decision,
        commitments: [
          { title: "Vistoria inicial", department: "Secretaria inexistente" },
        ],
      },
      "admin",
    ),
  ).rejects.toThrow();
  expect(await s.db.prepare("SELECT COUNT(*) n FROM entities").get()).toEqual({
    n: 0,
  });
  expect(await s.db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({
    n: 0,
  });
  const result = await s.writeDecisionBundle(
    "demo",
    {
      ...decision,
      commitments: [
        { title: "Vistoria inicial", department: "Secretaria de Obras" },
        { title: "Revisão final", department: "Secretaria de Obras" },
      ],
    },
    "admin",
  );
  expect(result.commitment_ids).toHaveLength(2);
  for (const id of result.commitment_ids)
    expect((await s.entity("demo", "commitments", id)).decision_id).toBe(
      result.id,
    );
  expect(await s.db.prepare("SELECT COUNT(*) n FROM jobs").get()).toEqual({
    n: 3,
  });
  await s.close();
  rmSync(dir, { recursive: true, force: true });
});

it("serializes duplicate requests and rejects concurrent stale revisions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "guardiao-concurrent-"));
  const s = new Store(dir);
  await s.bootstrap("concurrent@test.local", "secure-test-password");
  const payload = {
    title: "Plano simultâneo",
    department: "Secretaria de Obras",
  };
  try {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        s.idempotent("demo", "admin", "concurrent", "same", payload, () =>
          s.writeEntity("demo", "commitments", payload, "admin"),
        ),
      ),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await s.db.prepare("SELECT COUNT(*) n FROM entities").get()).toEqual(
      { n: 1 },
    );
    const revisions = await Promise.allSettled(
      ["Em execução", "Em acompanhamento"].map((title) =>
        s.writeEntity(
          "demo",
          "commitments",
          { ...payload, title },
          "admin",
          results[0].id,
          1,
        ),
      ),
    );
    expect(revisions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = revisions.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("VERSION_CONFLICT");
  } finally {
    await s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
