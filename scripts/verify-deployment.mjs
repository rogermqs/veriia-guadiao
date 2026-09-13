import { readFileSync, writeFileSync } from 'node:fs';
process.loadEnvFile('.env');
const base = process.env.GUARDIAO_VERIFY_ORIGIN || 'https://veriia.com.br';
let cookie = '';
async function request(path, body) {
  const response = await fetch(base + '/api/v1' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type':'application/json', Origin:base, ...(cookie ? {Cookie:cookie} : {}), 'Idempotency-Key':crypto.randomUUID() },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(120000)
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const value = await response.json();
  if (!response.ok) throw Error(`${path}: ${response.status} ${value.code}`);
  return value;
}
const report = { origin:base, checked_at:new Date().toISOString(), checks:[], answers:[] };
const page = await fetch(base + '/login');
const html = await page.text();
if(!page.ok || !html.includes('Bem-vindo ao Guardião') || page.headers.get('x-powered-by') === 'Next.js') throw Error('Static frontend unavailable');
const asset = html.match(/src="(\/_next\/static\/[^"]+\.js)"/);
if(!asset) throw Error('Frontend bundle absent');
const bundle = await fetch(base + asset[1]);
if(!bundle.ok || !bundle.headers.get('cache-control')?.includes('immutable')) throw Error('Static bundle unavailable');
report.checks.push('static frontend and minified bundle from backend');
await request('/health/ready');report.checks.push('readiness');
await request('/auth/login',{email:process.env.AGM_BOOTSTRAP_ADMIN_EMAIL,password:process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD});report.checks.push('login');
const result = await request('/workspaces/demo/analytics/summary',{});
if(result.result.total_records !== 2000 || result.result.pending_records !== 1030) throw Error('Demo indicators differ');
report.checks.push('2000 records / 1030 pending');
const conversation = await request('/workspaces/demo/conversations',{});
for (const message of ['Quantos registros existem e quantos estão pendentes na base de demonstração?', 'Qual é o histórico da revisão de prazo da drenagem do bairro Norte?']) {
  const turn = await request(`/workspaces/demo/conversations/${conversation.id}/turns`,{message});
  const stream = await fetch(base + turn.events_url, {headers:{Cookie:cookie},signal:AbortSignal.timeout(120000)});
  if(!stream.ok || !stream.headers.get('content-type')?.includes('text/event-stream')) throw Error('SSE unavailable');
  const events = await stream.text();
  const current = await request(`/workspaces/demo/conversations/${conversation.id}/turns/${turn.turn_id}`);
  if(current.status !== 'completed') throw Error(`AI: ${JSON.stringify(current.error)}`);
  if(!events.includes('event: answer.ready')) throw Error('Answer absent from SSE');
  const answer = current.answer;
  if(!answer)throw Error('AI timed out');
  if(!answer.evidence_ids?.length)throw Error('AI answer has no sources');
  for(const id of answer.evidence_ids) await request(`/workspaces/demo/sources/${id}`);
  report.answers.push({message,status:answer.status,text:answer.text,evidence_count:answer.evidence_ids.length,verified_sources:true});
  console.log(JSON.stringify({message,status:answer.status,verified_sources:answer.evidence_ids.length}));
}
report.checks.push('OpenRouter analytics and knowledge / verified sources / SSE');
writeFileSync('docs/contracts/deployment-verification.json',JSON.stringify(report,null,2));
console.log('Published application verified');
