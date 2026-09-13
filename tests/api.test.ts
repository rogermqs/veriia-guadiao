import { it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/api/src/store";
import { createApp } from "../apps/api/src/main";
it("authenticates, denies crossed sources, imports and activates golden, persists turns without fake AI", async () => {
  const oldKey = process.env.AGM_LLM_API_KEY;
  process.env.AGM_LLM_API_KEY = "";
  const dir = mkdtempSync(join(tmpdir(), "agm-api-"));
  const store = new Store(dir);
  await store.bootstrap("api@test.local", "password-test-api");
  const { app, knowledge } = await createApp(store, false);
  const api = request.agent(app.getHttpServer());
  try {
    expect((await api.get("/api/v1/workspaces/demo/datasets")).status).toBe(
      401,
    );
    expect(
      (
        await api
          .post("/api/v1/auth/login")
          .send({ email: "api@test.local", password: "bad" })
      ).status,
    ).toBe(401);
    expect(
      (
        await api
          .post("/api/v1/auth/login")
          .send({ email: "api@test.local", password: "password-test-api" })
      ).status,
    ).toBe(200);
    expect(
      (
        await api
          .post("/api/v1/workspaces/demo/commitments")
          .set("Origin", "https://evil.test")
          .send({})
      ).status,
    ).toBe(403);
    const upload = await api
      .post("/api/v1/workspaces/demo/imports/demands")
      .field("title", "Golden test")
      .field("data_as_of", "2026-09-13")
      .attach("file", "packages/test-fixtures/demands-golden.csv");
    expect(upload.status, JSON.stringify(upload.body)).toBe(200);
    async function waitImport(id: string) {
      for (let i = 0; i < 100; i++) {
        const r = await api.get("/api/v1/workspaces/demo/imports/" + id);
        if (
          ["awaiting_mapping", "ready", "blocked", "failed"].includes(
            r.body.state,
          )
        )
          return r.body;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw Error("Import timeout");
    }
    const preview = await waitImport(upload.body.id);
    expect(preview.result.quality.accepted_rows).toBe(12);
    const confirmed = await api
      .post(`/api/v1/workspaces/demo/imports/${upload.body.id}/confirm-mapping`)
      .send({});
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    const processed = await waitImport(upload.body.id);
    expect(
      (
        await api
          .post("/api/v1/workspaces/demo/datasets/dataset-demo/activate")
          .send({ snapshot_id: processed.result.snapshot_id })
      ).status,
    ).toBe(200);
    const query = await api
      .post("/api/v1/workspaces/demo/analytics/summary")
      .send({});
    expect(query.body.result.total_records).toBe(12);
    expect(
      (
        await api.get(
          `/api/v1/workspaces/real/sources/${query.body.evidence_id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api.get(
          `/api/v1/workspaces/demo/sources/${query.body.evidence_id}`,
        )
      ).status,
    ).toBe(200);
    const created = await api
      .post("/api/v1/workspaces/demo/commitments")
      .set("Idempotency-Key", "once")
      .send({
        title: "Entregar plano teste",
        department: "Secretaria de Obras",
        due_date: "2026-09-30",
      });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(
      (
        await api
          .post("/api/v1/workspaces/demo/commitments")
          .set("Idempotency-Key", "once")
          .send({
            title: "Entregar plano teste",
            department: "Secretaria de Obras",
            due_date: "2026-09-30",
          })
      ).body.id,
    ).toBe(created.body.id);
    const conv = await api
      .post("/api/v1/workspaces/demo/conversations")
      .send({});
    const turn = await api
      .post(`/api/v1/workspaces/demo/conversations/${conv.body.id}/turns`)
      .set("Idempotency-Key", "turn-one")
      .send({ message: "Quantos registros existem?" });
    expect(turn.status, JSON.stringify(turn.body)).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    const persisted = await api.get(
      `/api/v1/workspaces/demo/conversations/${conv.body.id}/turns/${turn.body.turn_id}`,
    );
    expect(persisted.body.error.code).toBe("PROVIDER_NOT_CONFIGURED");
    const stream = await api.get(turn.body.events_url);
    expect(stream.text).toContain("turn.failed");
    expect((await api.post("/api/v1/auth/logout").send({})).status).toBe(204);
    expect((await api.get("/api/v1/auth/me")).status).toBe(401);
  } finally {
    if (oldKey === undefined) delete process.env.AGM_LLM_API_KEY;
    else process.env.AGM_LLM_API_KEY = oldKey;
    await knowledge.close();
    await app.close();
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
