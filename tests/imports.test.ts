import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseDemands } from "../apps/api/src/imports";
it("rejects invalid CSV headers and preserves physical line locators", async () => {
  await expect(
    parseDemands(Buffer.from("bad;head\na;b"), "test.csv", "2026-09-13"),
  ).rejects.toThrow();
  const parsed = await parseDemands(
    Buffer.from(
      "Tipo;Orgao;DataCriacao;Assunto;Situacao;Bairro\nSolicitação;Obras;31/02/2026;Vias;Aberto;Norte\nSolicitação;Obras;01/09/2026;Vias;Aberto;Norte",
    ),
    "test.csv",
    "2026-09-13",
  );
  expect(parsed.quality.rejected_rows).toBe(1);
  expect(parsed.rows[0].source_row_number).toBe(3);
});
it("imports the selected XLSX worksheet and rejects formulas", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Demandas");
  sheet.addRow([
    "Tipo",
    "Orgao",
    "DataCriacao",
    "Assunto",
    "Situacao",
    "Bairro",
  ]);
  sheet.addRow([
    "Solicitação",
    "Obras",
    "01/09/2026",
    "Vias",
    "Aberto",
    "Norte",
  ]);
  let bytes = Buffer.from(await book.xlsx.writeBuffer());
  const parsed = await parseDemands(bytes, "test.xlsx", "2026-09-13", {
    sheet: "Demandas",
  });
  expect(parsed.rows).toHaveLength(1);
  await expect(
    parseDemands(bytes, "test.xlsx", "2026-09-13", {}),
  ).rejects.toThrow(/aba/);
  sheet.getCell("C2").value = { formula: "TODAY()", result: 1 };
  bytes = Buffer.from(await book.xlsx.writeBuffer());
  await expect(
    parseDemands(bytes, "test.xlsx", "2026-09-13", { sheet: "Demandas" }),
  ).rejects.toThrow(/fórmulas/);
});
