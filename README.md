# AGM · Veriia

Aplicação local de gestão municipal integrada à página institucional existente. O botão **Entrar** abre `/login`; o sistema fica em `/agm`. O login tem formulário estático e contas locais, com autenticação real no backend e cookie HttpOnly.

## Executar

Requisitos validados: Node 24.8.0, Python 3.14.6, pnpm 10.32.1. Se o Corepack local falhar, substitua `pnpm` por `npx --yes pnpm@10.32.1`.

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
pnpm bootstrap
pnpm memory:setup
pnpm dev
```

Acesse **http://localhost:3000/login**. O primeiro `bootstrap` cria `.env` com email `admin@veriia.local` e uma senha aleatória. Abra esse arquivo local para consultar as credenciais. A senha não é copiada para o frontend nem versionada. Se preferir, prepare `.env` a partir de `.env.example` e preencha email/senha antes do bootstrap.

A base de apresentação contém **2.000 registros fictícios, 12 atas, 8 decisões e 12 compromissos**. Os testes de navegador criam compromissos identificados como E2E. O conjunto golden de 12 linhas usa diretório independente. O espaço Curitiba começa sem base, aguardando importação de dados públicos autênticos.

```sh
pnpm build
pnpm start
```

`start` mantém o frontend e a API em execução. Portas locais: 3000 (web), 3001 (API). A API exige sessão para dados e aceita mutações da origem definida em `AGM_PUBLIC_ORIGIN`. Ao alterar a porta web, ajuste a origem.

## Inteligência artificial e memória

Defina no `.env`:

```dotenv
AGM_LLM_BASE_URL=https://openrouter.ai/api/v1
AGM_LLM_API_KEY=sua_chave
AGM_LLM_MODEL=openai/gpt-4.1-mini
AGM_KNOWLEDGE_SEARCH_MODE=hybrid
```

Reinicie a API após alterar a configuração. Sem chave/modelo, o chat registra a pergunta e informa `PROVIDER_NOT_CONFIGURED`. Não há respostas simuladas de IA. Painel, fontes, decisões e compromissos continuam disponíveis.

O Basic Memory 0.23.2 roda por MCP stdio, em projetos separados. O adaptador valida o projeto, filtra resultados contra o catálogo autorizado e lê a fonte antes de citá-la. A busca híbrida utiliza `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensões). O primeiro uso pode baixar o modelo. No setup inicial, jobs persistentes indexam documentos e registros; a administração mostra o progresso.

```sh
pnpm smoke:integrations
pnpm knowledge:evaluate
```

O smoke valida chamadas reais de memória. Com as variáveis do provedor preenchidas, também verifica uma chamada real de ferramenta no LLM. Consulte `docs/contracts/knowledge-evaluation.json`: avaliação local de busca com 10/10 fontes esperadas no top 5. Isso não é uma avaliação de respostas do LLM.

## Testes e operação

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm seed:golden
pnpm contracts:generate
npx playwright install chromium
# Com pnpm dev ou pnpm start em execução:
pnpm test:e2e
pnpm backup
pnpm restore:check
```

Em execução local sem DATABASE_URL, o backup usa a API de backup SQLite, pausa novas mutações/projeções com um marcador e aguarda operações ativas. A restauração de teste ocorre em outro diretório e confere hashes, integridade, registros e snapshot ativo. O índice de memória é reconstruível; não é a fonte de verdade de decisões.

Para criar/atualizar uma conta local ou trocar a senha, forneça `AGM_USER_EMAIL`, `AGM_USER_PASSWORD` (mínimo 12 caracteres), `AGM_USER_NAME` e `AGM_USER_ROLE` (`admin`, `manager`, `analyst`, `reader`) ao comando `pnpm user:upsert`. Senhas devem ser fornecidas por ambiente seguro. A alteração revoga sessões anteriores. A administração web altera vínculos de contas existentes.

## Docker

```sh
docker compose up --build
```

Configure `.env` antes. Somente a porta web é publicada, em loopback. Os dados ficam no volume `agm-state`. A imagem foi construída e validada em Linux no Coolify, com PostgreSQL dedicado. Consulte [operação em produção](docs/deployment/COOLIFY.md).

## Organização

- `index.html`, `styles.css`, `app.js`, `assets/`: página institucional preservada, com link de acesso.
- `apps/web/`: Next.js, interface responsiva e componentes.
- `apps/api/src/`: NestJS, sessão, importação em worker, analytics, domínio, orquestrador e adaptador MCP.
- `packages/contracts/`: schemas Zod usados pelo backend e contrato de ferramentas.
- `packages/test-fixtures/`: golden e template de compromissos.
- `data/`: bancos, originais, vaults, configuração local e backups, fora da área pública.
- `docs/`: SDD, progresso, contratos, decisões e relatório de validação.

`pnpm site:sync` copia somente arquivos institucionais explícitos para `public-site/` e para o diretório público do Next. O `wrangler.jsonc` agora aponta para `public-site`, evitando publicar bancos, dependências ou `.env`. **O AGM precisa dos processos web/API; o deploy estático antigo do Wrangler não hospeda o sistema.** O Guardião está publicado em https://veriia.com.br pelo Coolify.

## Escopo e aceite

As jornadas principais estão implementadas. O aceite integral da SDD depende do smoke com LLM real, do teste Compose e dos itens descritos em `docs/validation-report.md`. Esse relatório diferencia testes reais, testes controlados e requisitos ainda não comprovados; não declara que toda a matriz CA-01 a CA-26 foi integralmente satisfeita.

## PostgreSQL em produção

O domínio e as análises usam PostgreSQL em produção; SQLite permanece disponível para execução local. A migração preservou dados, versões e fontes, excluindo sessões. Veja `docs/contracts/postgres-migration.json`, `docs/contracts/postgres-restore-check.json` e `docs/contracts/deployment-verification.json`. Para backup PostgreSQL use `infra/backup-postgres.py`, conforme `docs/deployment/COOLIFY.md`.

### Container único

A produção usa um único backend Nest na porta 3000, servindo também o frontend estático e minificado (`apps/web/out`). Não é iniciado um servidor Next em produção. `npm run build` gera API e exportação estática; `npm start` inicia somente o backend. O Coolify organiza o serviço no projeto exclusivo **Guardião** e reutiliza o PostgreSQL existente.

## Saúde, voz e entrega contínua

A demonstração inclui o menu Saúde com cidadãos, UBS, atendimentos, prescrições fictícias e visitas dos agentes. O Assistente consulta esses históricos com fontes e oferece ditado e leitura em voz alta em navegadores compatíveis. Consulte [Saúde e voz](docs/deployment/SAUDE-VOZ.md).

O pipeline CircleCI testa SQLite/PostgreSQL, constrói a imagem única e publica no Coolify com verificação da revisão e rollback. A ativação requer conectar o repositório e configurar os contextos descritos em [CircleCI](docs/deployment/CIRCLECI.md).
