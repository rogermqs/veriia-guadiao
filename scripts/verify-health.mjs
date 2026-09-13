import { writeFileSync } from "node:fs";
process.loadEnvFile(".env");
const origin = process.env.GUARDIAO_VERIFY_ORIGIN || "https://veriia.com.br";
let cookie = "";
async function api(path, body) {
  const r = await fetch(origin + "/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
      "Idempotency-Key": crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(120000),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  const data = await r.json();
  if (!r.ok) throw Error(`${r.status} ${path}`);
  return data;
}
await api("/auth/login", {
  email: process.env.AGM_BOOTSTRAP_ADMIN_EMAIL,
  password: process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD,
});
const health = await api("/health/ready");
const list = await api("/workspaces/demo/health/citizens");
if (list.total !== 24 || list.units.length !== 3)
  throw Error("Health seed differs");
const maria = await api("/workspaces/demo/health/citizens/cid-demo-001");
if (
  maria.encounters.length !== 2 ||
  maria.visits.length !== 2 ||
  !maria.encounters[0].prescriptions.length
)
  throw Error("History incomplete");
await api("/workspaces/demo/sources/" + maria.evidence_id);
const report = {
  origin,
  checked_at: new Date().toISOString(),
  revision: health.revision,
  citizens: list.total,
  units: list.units.length,
  answers: [],
};
for (const message of [
  "Qual UBS atendeu Maria Oliveira e o que foi prescrito no último atendimento?",
  "Qual agente visitou Maria Oliveira? Diferencie visitas realizadas e agendadas.",
  "Quais visitas de Ana Ribeiro já foram realizadas?",
]) {
  const conv = await api("/workspaces/demo/conversations", {});
  const turn = await api(`/workspaces/demo/conversations/${conv.id}/turns`, {
    message,
    allow_write: false,
  });
  const events = await fetch(origin + turn.events_url, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(120000),
  });
  await events.text();
  const result = await api(
    `/workspaces/demo/conversations/${conv.id}/turns/${turn.turn_id}`,
  );
  if (result.status !== "completed" || !result.answer.evidence_ids?.length)
    throw Error("Health AI failed: " + JSON.stringify(result.error));
  const kinds = [];
  for (const id of result.answer.evidence_ids)
    kinds.push((await api("/workspaces/demo/sources/" + id)).kind);
  if (!kinds.includes("health_records")) throw Error("No health source");
  report.answers.push({ message, ...result.answer, verified_sources: true });
  console.log(
    JSON.stringify({
      message,
      status: result.answer.status,
      sources: kinds.length,
      text: result.answer.text,
    }),
  );
}
writeFileSync(
  "docs/contracts/health-verification.json",
  JSON.stringify(report, null, 2),
);
