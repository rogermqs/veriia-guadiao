import { parse } from "csv-parse";
import ExcelJS from "exceljs";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { hash } from "./store";
import { AppError } from "./errors";
export function parseCivilDate(value: any): string | null {
  const s = String(value ?? "").trim(),
    parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00Z");
  return !isNaN(+d) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
export const statusMap: Record<string, string> = {
  Aberto: "open",
  "Em atendimento": "in_progress",
  Concluído: "closed",
  Cancelado: "cancelled",
};
const required = [
  "Tipo",
  "Orgao",
  "DataCriacao",
  "Assunto",
  "Situacao",
  "Bairro",
];
export async function parseDemands(
  buffer: Buffer,
  filename: string,
  asOf: string,
  options: any = {},
) {
  return parseSource(buffer, filename, asOf, options);
}
export async function parseDemandFile(
  path: string,
  filename: string,
  asOf: string,
  options: any = {},
  onRow?: (r: any) => void | Promise<void>,
) {
  return parseSource(path, filename, asOf, options, onRow);
}
async function parseSource(
  input: string | Buffer,
  filename: string,
  asOf: string,
  options: any = {},
  onRow?: (r: any) => void | Promise<void>,
) {
  if (!parseCivilDate(asOf))
    throw new AppError(
      "INVALID_DATE",
      "Informe uma data de referência válida.",
    );
  let headers: string[] = [];
  const preview: any[] = [],
    rows: any[] = [];
  const seen = new Set();
  const quality: any = {
    total_rows: 0,
    accepted_rows: 0,
    rejected_rows: 0,
    unknown_status_records: 0,
    invalid_response_date_records: 0,
    duplicate_fingerprint_excess_rows: 0,
    missing_fields: 0,
    rejections: [],
    status_values: {},
    created_from: null,
    created_to: null,
  };
  const mapping = options.status_mapping || statusMap;
  async function consume(r: any, line: number) {
    quality.total_rows++;
    if (quality.total_rows > (/\.xlsx$/i.test(filename) ? 50000 : 2000000))
      throw new AppError("ROW_LIMIT", "O arquivo excede o limite de linhas.");
    if (preview.length < 50) preview.push(r);
    const created = parseCivilDate(r.DataCriacao),
      type = String(r.Tipo || "").trim();
    if (!created || !type) {
      quality.rejected_rows++;
      if (quality.rejections.length < 100)
        quality.rejections.push({
          line,
          reason: !created ? "DataCriacao inválida" : "Tipo ausente",
        });
      return;
    }
    const response = parseCivilDate(r.DataResposta),
      flags: string[] = [];
    if (created > asOf) flags.push("future_creation");
    const response_valid =
      !!response && response >= created && response <= asOf && created <= asOf;
    if (r.DataResposta && !response_valid) {
      flags.push("invalid_response_date");
      quality.invalid_response_date_records++;
    }
    const text = (field: string) =>
      String(r[field] || "").trim() || "Não informado";
    const status = mapping[text("Situacao")] || "unknown";
    if (
      !["open", "in_progress", "closed", "cancelled", "unknown"].includes(
        status,
      )
    )
      throw new AppError("INVALID_MAPPING", "Mapeamento de situação inválido.");
    quality.status_values[text("Situacao")] =
      (quality.status_values[text("Situacao")] || 0) + 1;
    if (status === "unknown") quality.unknown_status_records++;
    if (["Orgao", "Assunto", "Bairro"].some((k) => !r[k]))
      quality.missing_fields++;
    const fingerprint = hash(JSON.stringify(r));
    if (seen.has(fingerprint)) quality.duplicate_fingerprint_excess_rows++;
    seen.add(fingerprint);
    const row = {
      source_row_number: line,
      request_type: type,
      department: text("Orgao"),
      subject: text("Assunto"),
      neighborhood: text("Bairro"),
      status,
      created_date: created,
      response_date: response,
      response_valid,
      fingerprint,
      flags,
    };
    if (onRow) await onRow(row);
    else rows.push(row);
    quality.accepted_rows++;
    quality.created_from =
      !quality.created_from || created < quality.created_from
        ? created
        : quality.created_from;
    quality.created_to =
      !quality.created_to || created > quality.created_to
        ? created
        : quality.created_to;
  }
  function checkHeaders() {
    if (required.some((h) => !headers.includes(h)))
      throw new AppError(
        "INVALID_HEADERS",
        `Cabeçalhos obrigatórios: ${required.join(", ")}.`,
      );
  }
  if (/\.csv$/i.test(filename)) {
    const stream =
      typeof input === "string"
        ? createReadStream(input)
        : Readable.from([input]);
    const decoder = new TextDecoder(options.encoding || "utf-8", {
      fatal: true,
    });
    let first = true;
    let parser: any;
    for await (const bytes of stream) {
      let text: string;
      try {
        text = decoder.decode(bytes as Buffer, { stream: true });
      } catch {
        throw new AppError(
          "ENCODING_REQUIRED",
          "Arquivo não é UTF-8 válido. Selecione Windows-1252.",
        );
      }
      if (first) {
        first = false;
        const line = text.split(/\r?\n/)[0];
        const delimiter =
          options.delimiter ||
          [";", ",", "\t"].sort(
            (a, b) => line.split(b).length - line.split(a).length,
          )[0];
        parser = parse({
          bom: true,
          delimiter,
          columns: (h: string[]) => {
            headers = h.map((s) => s.trim());
            checkHeaders();
            return headers;
          },
          skip_empty_lines: true,
          max_record_size: 65536,
          info: true,
        });
        parser.on("error", () => {});
        parser.on("readable", async () => {
          let entry;
          while ((entry = parser.read()) !== null) {
            try {
              await consume(entry.record, entry.info.lines);
            } catch (e) {
              parser.destroy(e as Error);
              break;
            }
          }
        });
      }
      await new Promise<void>((resolve, reject) =>
        parser.write(text, (e: any) => (e ? reject(e) : resolve())),
      );
    }
    if (!parser) throw new AppError("INVALID_FILE", "Arquivo vazio.");
    await new Promise<void>((resolve, reject) => {
      parser.once("error", reject);
      parser.once("end", resolve);
      parser.end(decoder.decode());
    });
  } else if (/\.xlsx$/i.test(filename)) {
    if (!options.sheet)
      throw new AppError(
        "SHEET_REQUIRED",
        "Informe o nome exato da aba para importar o XLSX.",
      );
    const book = new ExcelJS.Workbook();
    if (typeof input === "string") await book.xlsx.readFile(input);
    else await book.xlsx.load(input as any);
    const sheet = book.getWorksheet(options.sheet);
    if (!sheet)
      throw new AppError(
        "INVALID_SHEET",
        `Aba não encontrada. Abas: ${book.worksheets.map((s) => s.name).join(", ")}`,
      );
    for (const row of sheet.getRows(1, sheet.rowCount) || []) {
      const n = row.number;
      const vals = (row.values as any[]).slice(1).map((v) => {
        if (v && typeof v === "object") {
          if (v.formula)
            throw new AppError(
              "FORMULA_NOT_ALLOWED",
              "Exporte fórmulas como valores antes de importar.",
            );
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          return v.text || "";
        }
        return v ?? "";
      });
      if (n === 1) {
        headers = vals.map(String);
        checkHeaders();
      } else
        await consume(
          Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""])),
          n,
        );
    }
  } else throw new AppError("INVALID_FILE", "Use CSV ou XLSX.");
  checkHeaders();
  return { rows, quality, headers, preview };
}
