import { z } from "zod";
export const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida");
export const filtersSchema = z
  .object({
    created_from: civilDate.optional(),
    created_to: civilDate.optional(),
    request_type: z.string().max(100).default("Solicitação"),
    department: z.string().max(200).optional(),
    neighborhood: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    status: z
      .enum(["open", "in_progress", "closed", "cancelled", "unknown"])
      .optional(),
    group_by: z
      .enum(["neighborhood", "department", "subject"])
      .default("neighborhood"),
    limit: z.number().int().min(1).max(100).default(20),
    page: z.number().int().min(1).default(1),
  })
  .strict()
  .refine(
    (v) => !v.created_from || !v.created_to || v.created_from <= v.created_to,
    "Intervalo inválido",
  );
const title = z.string().trim().min(3).max(250);
export const sourceRefs = z
  .array(
    z
      .object({ document_id: z.string(), version: z.number().int().positive() })
      .strict(),
  )
  .max(20)
  .default([]);
export const decisionSchema = z
  .object({
    title,
    statement: z.string().trim().min(3).max(8000),
    rationale: z.string().max(4000).default(""),
    department: z.string().min(1).max(150),
    decided_on: civilDate,
    status: z.enum(["active", "superseded", "revoked"]).default("active"),
    source_refs: sourceRefs,
    supersedes_id: z.string().nullable().optional(),
  })
  .strict();
export const commitmentSchema = z
  .object({
    title,
    description: z.string().max(4000).default(""),
    department: z.string().min(1).max(150),
    owner_name: z.string().max(150).nullable().default(null),
    due_date: civilDate.nullable().default(null),
    status: z
      .enum(["open", "in_progress", "completed", "cancelled"])
      .default("open"),
    neighborhood: z.string().max(150).nullable().default(null),
    source_refs: sourceRefs,
    decision_id: z.string().nullable().default(null),
  })
  .strict();
export const decisionCreationSchema = decisionSchema.extend({
  commitments: z
    .array(commitmentSchema.omit({ decision_id: true }))
    .max(50)
    .default([]),
});
export const loginSchema = z
  .object({ email: z.email(), password: z.string().min(1).max(200) })
  .strict();
export const messageSchema = z
  .object({
    message: z.string().trim().min(1).max(8000),
    allow_write: z.boolean().default(false),
  })
  .strict();
export const departments = [
  "Secretaria de Zeladoria",
  "Secretaria de Obras",
  "Secretaria de Meio Ambiente",
  "Secretaria de Saúde",
];
export const neighborhoods = [
  "Centro",
  "Norte",
  "Sul",
  "Leste",
  "Oeste",
  "Jardim das Flores",
];
export const roleLabels = {
  admin: "Administrador",
  manager: "Gestor",
  analyst: "Analista",
  reader: "Leitor",
};
