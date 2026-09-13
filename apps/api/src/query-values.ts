import { AppError } from "./errors";
export function queryValues(query: any) {
  const values: Record<string, string | number | null> = {};
  function visit(value: any, path: string, depth: number) {
    if (depth > 8) return;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number"
    )
      values[`{{query:${query.id}:${path}}}`] = value;
    else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value))
        visit(child, path ? `${path}.${key}` : key, depth + 1);
  }
  visit(query.result, "", 0);
  return values;
}
export function renderQueryValues(text: string, queries: Map<string, any>) {
  const allowed = Object.assign(
    {},
    ...Array.from(queries.values(), queryValues),
  );
  return text.replace(/\{\{query:([^:}]+):([^}]+)\}\}/g, (token) => {
    if (!Object.hasOwn(allowed, token))
      throw new AppError(
        "CITATION_VALIDATION_FAILED",
        "Métrica não verificada.",
      );
    const v = allowed[token];
    return v === null
      ? "Sem dados para calcular"
      : typeof v === "number"
        ? v.toLocaleString("pt-BR")
        : String(v);
  });
}
