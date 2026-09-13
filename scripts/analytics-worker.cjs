require('tsx/cjs');
const {parentPort,workerData}=require('node:worker_threads');
const {Store}=require('../apps/api/src/store.ts');
const {Analytics}=require('../apps/api/src/analytics.ts');
(async()=>{ const store=new Store(workerData.dir);
try { await store.ready; parentPort.postMessage({result:await new Analytics(store).run(workerData.workspace,workerData.kind,workerData.input,workerData.user,workerData.snapshot)}); }
catch(error){parentPort.postMessage({error:{code:error.code,message:error.message,status:error.status}});}
finally{await store.close();} })();
