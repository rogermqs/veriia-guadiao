import { z } from "zod";
import { writeFileSync } from "node:fs";
import {
  loginSchema,
  filtersSchema,
  decisionSchema,
  decisionCreationSchema,
  commitmentSchema,
  messageSchema,
} from "../packages/contracts";
const paths: any = {};
const error = {
  description: "Erro estruturado",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["code", "message", "correlation_id"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          correlation_id: { type: "string" },
        },
      },
    },
  },
};
function add(path: string, method: string, summary: string, schema?: any) {
  const full =
    path.startsWith("/auth") ||
    path.startsWith("/health") ||
    path === "/workspaces"
      ? path
      : "/workspaces/{workspaceId}" + path;
  paths[full] ??= {};
  paths[full][method] = {
    summary,
    security:
      path.startsWith("/health") || path === "/auth/login"
        ? []
        : [{ session: [] }],
    parameters: [
      ...(full.includes("{workspaceId}")
        ? [
            {
              in: "path",
              name: "workspaceId",
              required: true,
              schema: { type: "string", enum: ["demo", "real"] },
            },
          ]
        : []),
      ...Array.from(full.matchAll(/\{(\w+)\}/g))
        .filter((m: any) => m[1] !== "workspaceId")
        .map((m: any) => ({
          in: "path",
          name: m[1],
          required: true,
          schema: { type: "string" },
        })),
      ...(["post", "patch"].includes(method) &&
      ["decisions", "commitments", "turns", "documents"].some((t) =>
        path.includes(t),
      )
        ? [
            {
              in: "header",
              name: "Idempotency-Key",
              required: true,
              schema: { type: "string" },
            },
          ]
        : []),
      ...(method === "patch"
        ? [
            {
              in: "header",
              name: "If-Match",
              required: true,
              schema: { type: "integer" },
            },
          ]
        : []),
    ],
    ...(schema
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.toJSONSchema(schema, { unrepresentable: "any" }),
              },
            },
          },
        }
      : {}),
    responses: {
      "200": {
        description:
          "Operação concluída. Consulte os exemplos e o schema da aplicação.",
      },
      "400": error,
      "401": error,
      "403": error,
      "404": error,
      "409": error,
      "503": error,
    },
  };
}
add("/auth/login", "post", "Autenticar conta local", loginSchema);
add("/auth/logout", "post", "Revogar sessão");
add("/auth/me", "get", "Identidade e espaços");
add("/workspaces", "get", "Listar espaços autorizados");
for (const type of ["live", "ready"])
  add("/health/" + type, "get", "Verificar processo e banco");
for (const p of [
  "datasets",
  "dimensions",
  "capabilities",
  "conversations",
  "documents",
  "admin",
  "memberships",
  "audit",
])
  add("/" + p, "get", "Consultar " + p);
for (const type of ["summary", "grouped", "time-series", "records"])
  add(
    "/analytics/" + type,
    "post",
    "Consulta controlada de registros",
    filtersSchema,
  );
for (const [kind, schema] of [
  ["decisions", decisionSchema],
  ["commitments", commitmentSchema],
] as any[]) {
  add("/" + kind, "get", "Listar registros");
  add("/" + kind + "/{id}", "get", "Consultar registro e revisões");
  add(
    "/" + kind,
    "post",
    "Criar registro",
    kind === "decisions" ? decisionCreationSchema : schema,
  );
  add("/" + kind + "/{id}", "patch", "Revisar registro", schema);
}
for (const kind of ["demands", "commitments"]) {
  add("/imports/" + kind, "post", "Upload multipart com prévia");
  paths["/workspaces/{workspaceId}/imports/" + kind].post.requestBody = {
    required: true,
    content: {
      "multipart/form-data": {
        schema: {
          type: "object",
          properties: {
            file: { type: "string", format: "binary" },
            title: { type: "string" },
            data_as_of: { type: "string", format: "date" },
            source_url: { type: "string" },
            sheet: { type: "string" },
            encoding: { type: "string" },
            sample_info: { type: "string" },
          },
        },
      },
    },
  };
}
add("/imports/{id}", "get", "Estado da importação");
add(
  "/imports/{id}/confirm-mapping",
  "post",
  "Confirmar mapeamento e processar",
);
add("/datasets/{id}/activate", "post", "Ativar snapshot");
add("/datasets/{id}/rollback", "post", "Reativar snapshot anterior");
add("/documents", "post", "Importar Markdown");
add("/documents/{id}", "get", "Ler versão autorizada");
add("/documents/{id}/versions", "post", "Criar nova versão de documento");
add("/knowledge/search", "post", "Buscar e ler fontes em português");
add("/sources/{id}", "get", "Ler evidência autorizada");
add("/conversations", "post", "Criar conversa");
add("/conversations/{id}", "get", "Recuperar conversa do proprietário");
add("/conversations/{id}/turns", "post", "Criar turno", messageSchema);
add("/conversations/{id}/turns/{turnId}", "get", "Estado do turno");
add(
  "/conversations/{id}/turns/{turnId}/events",
  "get",
  "Eventos SSE com Last-Event-ID",
);
add(
  "/conversations/{id}/turns/{turnId}/cancel",
  "post",
  "Cancelar processamento pendente",
);
for (const k of ["query", "briefing"])
  add("/exports/" + k, "post", "Exportar com procedência");
add("/memberships", "post", "Vincular conta existente");
add("/memberships/{id}", "patch", "Alterar papel ou revogar vínculo");
add("/jobs/{id}", "get", "Consultar sincronização");
add("/jobs/{id}/retry", "post", "Retentar job");
writeFileSync(
  "docs/contracts/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "AGM API", version: "1.0.0" },
      servers: [{ url: "/api/v1" }],
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "agm_session" },
        },
      },
      paths,
    },
    null,
    2,
  ),
);
console.log("Contrato OpenAPI gerado.");
