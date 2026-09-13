import { it, expect } from "vitest";
import { queryValues, renderQueryValues } from "../apps/api/src/query-values";
it("renders exact authorized nested ranking values and rejects fabricated metrics", () => {
  const q = {
    id: "q1",
    result: {
      total_records: 2000,
      rows: [{ label: "Norte", value: 350 }],
      average: null,
    },
  };
  const queries = new Map([["q1", q]]);
  expect(queryValues(q)["{{query:q1:rows.0.value}}"]).toBe(350);
  expect(
    renderQueryValues(
      "{{query:q1:rows.0.label}}: {{query:q1:rows.0.value}} de {{query:q1:total_records}}",
      queries,
    ),
  ).toBe("Norte: 350 de 2.000");
  expect(renderQueryValues("{{query:q1:average}}", queries)).toBe(
    "Sem dados para calcular",
  );
  for (const token of [
    "{{query:other:total_records}}",
    "{{query:q1:rows.1.value}}",
    "{{query:q1:__proto__}}",
    "{{query:q1:rows}}",
  ])
    expect(() => renderQueryValues(token, queries)).toThrow(
      "Métrica não verificada",
    );
});
