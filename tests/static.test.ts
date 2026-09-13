import { it, expect } from 'vitest';
import request from 'supertest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../apps/api/src/store';
import { createApp } from '../apps/api/src/main';
it('serves the static frontend and authenticated API from the same backend', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'guardiao-static-'));
  const frontend = join(dir,'public');
  mkdirSync(join(frontend,'_next/static'),{recursive:true});
  mkdirSync(join(frontend,'login')); // Next also emits route payload directories alongside login.html.
  writeFileSync(join(frontend,'index.html'),'<h1>Guardião</h1>');
  writeFileSync(join(frontend,'login.html'),'<form>Entrar no sistema</form>');
  writeFileSync(join(frontend,'_next/static/app.js'),'console.log("ready");');
  writeFileSync(join(dir,'.env'),'PRIVATE_SECRET');
  const previous = process.env.AGM_FRONTEND_DIR;
  process.env.AGM_FRONTEND_DIR = frontend;
  const store = new Store(join(dir,'state'));
  const {app,knowledge} = await createApp(store,false);
  try {
    const api = request(app.getHttpServer());
    expect((await api.get('/')).text).toContain('Guardião');
    const login = await api.get('/login');
    expect(login.status).toBe(200);
    expect(login.text).toContain('Entrar no sistema');
    expect(login.headers['x-content-type-options']).toBe('nosniff');
    const js = await api.get('/_next/static/app.js');
    expect(js.status).toBe(200);
    expect(js.headers['cache-control']).toContain('immutable');
    expect((await api.get('/.env')).status).toBe(404);
    expect((await api.get('/api/v1/health/ready')).status).toBe(200);
    expect((await api.get('/api/v1/auth/me')).status).toBe(401);
  } finally {
    if(previous === undefined) delete process.env.AGM_FRONTEND_DIR; else process.env.AGM_FRONTEND_DIR = previous;
    await knowledge.close(); await app.close(); await store.close(); rmSync(dir,{recursive:true,force:true});
  }
});
