import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/api/src/store";
import { parseDemands, parseCivilDate } from "../apps/api/src/imports";
import { Analytics } from "../apps/api/src/analytics";
const csv = readFileSync("packages/test-fixtures/demands-golden.csv");
describe("SDD golden", () => {
  it("preserves repeated records, distinguishes reply from closure, and computes both periods", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agm-test-"));
    const store = new Store(dir);
    await store.bootstrap("admin@example.test", "test-password-strong");
    const parsed = await parseDemands(csv, "golden.csv", "2026-09-13");
    expect(parsed.rows).toHaveLength(12);
    expect(parsed.quality.duplicate_fingerprint_excess_rows).toBe(1);
    const snap = await store.saveSnapshot(
      "demo",
      parsed,
      {
        title: "Golden",
        data_as_of: "2026-09-13",
        source_url: "",
        sample_info: "Golden de teste",
      },
      csv,
    );
    await store.activate("demo", snap.id, "admin");
    const analytics = new Analytics(store);
    const all = (await analytics.run("demo", "summary", {}, "admin")).result;
    expect(all).toMatchObject({
      total_records: 12,
      pending_records: 5,
      closed_records: 5,
      cancelled_records: 1,
      unknown_status_records: 1,
      response_observation_count: 5,
      average_response_days: 3.4,
      pending_older_than_30_days: 2,
      invalid_response_date_records: 1,
      duplicate_fingerprint_excess_rows: 1,
    });
    const sep = (
      await analytics.run(
        "demo",
        "summary",
        { created_from: "2026-09-01", created_to: "2026-09-13" },
        "admin",
      )
    ).result;
    expect(sep).toMatchObject({
      total_records: 9,
      pending_records: 3,
      closed_records: 4,
      response_observation_count: 4,
      average_response_days: 3,
      pending_older_than_30_days: 0,
    });
    expect(
      (
        await analytics.run(
          "demo",
          "grouped",
          { created_from: "2026-09-01", group_by: "neighborhood" },
          "admin",
        )
      ).result.rows.map((r: any) => r.value),
    ).toEqual([3, 3, 3]);
    const again = await store.saveSnapshot(
      "demo",
      parsed,
      {
        title: "Golden",
        data_as_of: "2026-09-13",
        source_url: "",
        sample_info: "Golden de teste",
      },
      csv,
    );
    expect(again.id).toBe(snap.id);
    await expect(
      analytics.run("real", "summary", {}, "admin"),
    ).rejects.toThrow();
    const empty = (
      await analytics.run(
        "demo",
        "summary",
        { neighborhood: "Inexistente" },
        "admin",
      )
    ).result;
    expect(empty.total_records).toBe(0);
    expect(empty.average_response_days).toBeNull();
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("rejects impossible civil dates", () => {
    expect(parseCivilDate("31/02/2026")).toBeNull();
    expect(parseCivilDate("29/02/2024")).toBe("2024-02-29");
    expect(parseCivilDate("2026-09-13")).toBe("2026-09-13");
  });
});
