import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { commitmentSchema } from "../../../packages/contracts";
import { AppError } from "./errors";
export async function parseCommitments(
  bytes: Buffer,
  name: string,
  sheetName?: string,
) {
  if (bytes.length > 20971520)
    throw new AppError(
      "FILE_TOO_LARGE",
      "O template de compromissos deve ter até 20 MiB.",
    );
  let raw: any[];
  if (/\.csv$/i.test(name)) {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AppError(
        "INVALID_ENCODING",
        "Exporte o template de compromissos em UTF-8.",
      );
    }
    raw = parse(text, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      delimiter: text.split("\n")[0].includes(";") ? ";" : ",",
    });
  } else if (/\.xlsx$/i.test(name)) {
    if (!sheetName)
      throw new AppError("SHEET_REQUIRED", "Informe a aba do template.");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as any);
    const sheet = book.getWorksheet(sheetName);
    if (!sheet) throw new AppError("INVALID_SHEET", "Aba não encontrada.");
    raw = [];
    let headers: string[] = [];
    sheet.eachRow((row, n) => {
      const values = (row.values as any[]).slice(1).map((v) => {
        if (v?.formula)
          throw new AppError(
            "FORMULA_NOT_ALLOWED",
            "Converta fórmulas em valores.",
          );
        return v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? "");
      });
      if (n === 1) headers = values.map(String);
      else
        raw.push(
          Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])),
        );
    });
  } else throw new AppError("INVALID_FILE", "Use CSV ou XLSX.");
  if (!raw.length || raw.length > 50000)
    throw new AppError(
      "ROW_LIMIT",
      "O template deve ter entre 1 e 50 mil linhas.",
    );
  const seen = new Set<string>();
  const errors: any[] = [],
    rows: any[] = [];
  raw.forEach((r, i) => {
    try {
      const external_ref = String(r.external_ref || "").trim();
      if (!external_ref || seen.has(external_ref))
        throw Error("external_ref ausente ou repetido no lote.");
      seen.add(external_ref);
      const value = commitmentSchema.parse({
        title: r.title,
        department: r.department,
        description: r.description || "",
        owner_name: r.owner_name || null,
        due_date: r.due_date || null,
        status: r.status || "open",
        neighborhood: r.neighborhood || null,
        decision_id: r.decision_id || null,
      });
      rows.push({ external_ref, ...value });
    } catch (e: any) {
      errors.push({ line: i + 2, reason: e.message });
    }
  });
  return { rows, errors, total_rows: raw.length };
}
