import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { Store } from "../apps/api/src/store";
import { Health, seedHealth } from "../apps/api/src/health";
import { createApp } from "../apps/api/src/main";
it("seeds linked fictional health histories idempotently and isolates sources and workspaces", async () => {
  const dir = mkdtempSync(join(tmpdir(), "guardiao-health-"));
  const s = new Store(dir);
  await s.bootstrap("health@test.local", "health-test-password");
  const u: any = await s.db.prepare("SELECT id FROM users").get();
  try {
    await seedHealth(s);
    await seedHealth(s);
    const h = new Health(s);
    const list = await h.citizens("demo", u.id, {});
    expect(list.total).toBe(24);
    expect(list.units).toHaveLength(3);
    const maria = await h.citizens("demo", u.id, { query: "mária" });
    expect(maria.items).toHaveLength(1);
    const history = await h.history("demo", u.id, maria.items[0].id);
    expect(history.citizen.name).toBe("Maria Oliveira");
    expect(history.encounters).toHaveLength(2);
    expect(history.encounters[0].prescriptions[0].medication).toContain(
      "demonstrativo",
    );
    expect(
      history.visits.some(
        (v: any) => v.agent_name === "Ana Ribeiro" && v.status === "completed",
      ),
    ).toBe(true);
    expect(
      (await s.source("demo", history.evidence_id, u.id)).payload.content,
    ).toContain("Maria Oliveira");
    await expect(s.source("real", history.evidence_id, u.id)).rejects.toThrow();
    await expect(
      s.source("demo", history.evidence_id, "other"),
    ).rejects.toThrow();
    await expect(h.history("real", u.id, maria.items[0].id)).rejects.toThrow();
    expect((await h.citizens("real", u.id, {})).items).toHaveLength(0);
    const visits = await h.visits("demo", u.id, {
      agent: "Ana Ribeiro",
      status: "completed",
    });
    expect(visits.items.length).toBeGreaterThan(0);
    expect(
      visits.items.every(
        (v: any) => v.agent_name === "Ana Ribeiro" && v.status === "completed",
      ),
    ).toBe(true);
    expect(
      (await h.citizens("demo", u.id, { query: "' OR 1=1 --" })).items,
    ).toHaveLength(0);
    const { app, knowledge } = await createApp(s, false);
    const api = request.agent(app.getHttpServer());
    try {
      expect(
        (await api.get("/api/v1/workspaces/demo/health/citizens")).status,
      ).toBe(401);
      await api
        .post("/api/v1/auth/login")
        .send({ email: "health@test.local", password: "health-test-password" });
      const r = await api.get(
        "/api/v1/workspaces/demo/health/citizens?query=Maria",
      );
      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      expect(
        (await api.post("/api/v1/workspaces/demo/health/citizens").send({}))
          .status,
      ).toBe(405);
      expect(
        (
          await api.get(
            "/api/v1/workspaces/real/health/citizens/" + maria.items[0].id,
          )
        ).status,
      ).toBe(404);
    } finally {
      await knowledge.close();
      await app.close();
    }
  } finally {
    await s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
