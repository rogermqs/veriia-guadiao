# Guardião em produção

- Domínio: https://veriia.com.br
- Servidor: 45.235.240.52, usuário operacional linuxadmin.
- Coolify: projeto Guardião (`ca6f2dl7jpsxbm5pufo9mn8y`), ambiente production, serviço `ct8wkhfnfbcfbpcrrlnb3k4p`.
- Imagem local: `guardiao:20260913-8`, construída de `~/guardiao/app/infra/docker/Dockerfile`.
- PostgreSQL 16 existente: banco dedicado `guardiao`, usuário `guardiao_app`; esquemas `guardiao`, `guardiao_demo`, `guardiao_real`.
- Persistência de arquivos: `/home/linuxadmin/guardiao/data`, montada em `/app/data`.
- Container único `web-ct8wkhfnfbcfbpcrrlnb3k4p`: backend Nest na porta 3000, servindo a API e o frontend estático/minificado de `/app/apps/web/out`. Limite 1536 MiB / 1 CPU. Não executa servidor Next em produção.
- OpenRouter: chave armazenada nas variáveis do serviço Coolify. Nunca incluir em build, frontend ou repositório.
- As credenciais administrativas permanecem as configuradas localmente. Sessões não foram migradas: realizar novo login.

## Atualização

Copiar as fontes (sem `.env`, `data`, `.venv`, `node_modules` ou `.next`) para `~/guardiao/app`, construir uma nova imagem e atualizar o nome da imagem no Compose do serviço antes de reiniciar pelo Coolify, sem marcar a opção de baixar imagens, para aplicar a nova imagem. O serviço usa `pull_policy: never`: a imagem deve existir no host. A build precisa dos arquivos estáticos na raiz: `index.html`, `styles.css`, `app.js`, `config.js`, `404.html`, `_headers` e `assets/`.

## Backup e recuperação

Executar no servidor `python3 ~/guardiao/backup-postgres.py --check`. O script gera um dump PostgreSQL consistente, um arquivo com fontes/documentos e valida o dump restaurando em um banco temporário separado. Os backups ficam em `~/guardiao/backups/`. O script não inclui credenciais: as variáveis do Coolify devem ser preservadas separadamente.

Para recuperação operacional completa, interromper o serviço, restaurar o dump em um banco dedicado vazio, restaurar arquivos em `/app/data` com UID 10001, configurar as variáveis, executar `node scripts/memory-setup.mjs` e `node --import tsx scripts/warmup.ts`, e iniciar o serviço. O índice local do Basic Memory é reconstruível e não é o banco de domínio.

A migração inicial é registrada em `docs/contracts/postgres-migration.json`, com contagens e hashes de cada tabela. `scripts/migrate-postgres.ts` exige destino vazio e backup íntegro. O adaptador mantém SQLite para testes e execução local sem `DATABASE_URL`; produção usa PostgreSQL.

O PostgreSQL compartilhado já existia no servidor e foi reutilizado; não há serviço PostgreSQL no Compose desta aplicação. `npm run build` gera o frontend estático e `npm start` inicia somente o backend. O desenvolvimento (`npm run dev`) mantém o Next com hot reload.

## Recuperação da imagem local

A imagem validada foi arquivada em `/home/linuxadmin/guardiao/guardiao-20260913-8.tar`. Se a limpeza do Coolify remover uma imagem parada, use `docker load -i ~/guardiao/guardiao-20260913-8.tar` antes de iniciar. Para atualizações, altere a tag no Compose e utilize Reiniciar sem baixar imagens; o fluxo de reinício evita a limpeza global disparada por uma parada manual.
