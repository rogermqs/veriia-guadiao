import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../apps/api/src/store";
import { Knowledge, matchesMemoryProject } from "../apps/api/src/knowledge";
it("recovers an uncertain memory write by reading the marker without duplicating the note", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agm-outbox-"));
  const s = new Store(dir);
  await s.bootstrap("outbox@test.local", "test-password");
  const item = await s.writeEntity(
    "demo",
    "commitments",
    { title: "Plano após falha de índice", department: "Secretaria de Obras" },
    "test",
  );
  const gateway = new Knowledge(s);
  let note = "",
    writes = 0;
  gateway.call = async (_w, name, args) => {
    if (name === "read_note") {
      if (!note) throw Error("not found");
      return note;
    }
    if (name === "write_note") {
      writes++;
      note = args.content;
      throw Error("timeout after persisted write");
    }
    throw Error("unsupported");
  };
  await gateway.processOne();
  expect((await s.entity("demo", "commitments", item.id)).title).toBe(
    item.title,
  );
  expect(
    await s.db.prepare("SELECT state FROM jobs WHERE entity_id=?").get(item.id),
  ).toEqual({ state: "queued" });
  await s.db
    .prepare("UPDATE jobs SET next_run_at='2000-01-01' WHERE entity_id=?")
    .run(item.id);
  await gateway.processOne();
  expect(writes).toBe(1);
  expect(
    await s.db.prepare("SELECT state FROM jobs WHERE entity_id=?").get(item.id),
  ).toEqual({ state: "succeeded" });
  expect((await s.entity("demo", "commitments", item.id)).indexing_state).toBe(
    "synced",
  );
  await gateway.close();
  await s.close();
  rmSync(dir, { recursive: true, force: true });
});

it("validates normalized Docker memory paths without crossing workspace boundaries", () => {
  const identity = {
    constrained_project: "demo",
    projects: [{ name: "demo", path: "/vaults/demo" }],
  };
  expect(matchesMemoryProject(identity, "demo", "/app/data/vaults/demo")).toBe(
    true,
  );
  expect(matchesMemoryProject(identity, "demo", "/app/data/vaults/real")).toBe(
    false,
  );
  expect(
    matchesMemoryProject(
      { ...identity, constrained_project: "real" },
      "demo",
      "/app/data/vaults/demo",
    ),
  ).toBe(false);
  expect(
    matchesMemoryProject(
      { ...identity, projects: [{ name: "demo", path: "/elsewhere/demo" }] },
      "demo",
      "/app/data/vaults/demo",
    ),
  ).toBe(false);
});
