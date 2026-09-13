# CircleCI — Guardião

O código do pipeline está em `.circleci/config.yml`. A conexão do repositório e os contextos abaixo precisam ser configurados na conta CircleCI antes da primeira execução. Nenhum token é incluído no repositório.

## Fluxo

1. Toda branch: tipos, testes SQLite, integração PostgreSQL isolada, build estático e testes de navegador de saúde/voz.
2. `main`, após testes: construir uma única imagem Linux amd64 com backend e frontend e publicar com a tag imutável `$CIRCLE_SHA1`.
3. Deploy serializado: atualizar somente a imagem do serviço `web` no compose existente; reiniciar no Coolify; conferir a revisão via `/api/v1/health/ready` e a página `/login`.
4. Se a revisão esperada não ficar saudável, restaurar o compose anterior e reiniciar. O banco existente e os volumes permanecem intactos. Alterações de schema devem continuar retrocompatíveis; rollback de imagem não reverte dados.

## Conectar

- Publicar este projeto em um repositório Git e adicionar esse repositório no CircleCI.
- Usar `main` como branch de publicação. Proteger a branch e restringir os contextos à equipe/branch de produção; não disponibilizar secrets em PRs de forks.
- Criar o contexto `guardiao-registry` com `REGISTRY_HOST` (ex.: `ghcr.io`), `REGISTRY_USER`, `REGISTRY_PASSWORD` (permissão de publicação de pacote) e `GUARDIAO_IMAGE` (registro/conta/repositório, sem tag).
- Criar o contexto `guardiao-production` com `GUARDIAO_IMAGE`, `COOLIFY_API_URL` (URL HTTPS incluindo `/api/v1`), `COOLIFY_API_TOKEN` (read/read:sensitive/write/deploy; a leitura do compose exige read:sensitive no Coolify 4.3), `COOLIFY_SERVICE_UUID=ct8wkhfnfbcfbpcrrlnb3k4p` e `GUARDIAO_PUBLIC_ORIGIN=https://veriia.com.br`.
- Se o registro for privado, cadastrar no servidor Coolify a credencial de leitura necessária para `docker pull`. Manter a imagem anterior no registro para rollback.
- As variáveis `DATABASE_URL`, chave OpenRouter e senha da aplicação continuam exclusivamente no Coolify. Não precisam entrar nos contextos CircleCI.
- O serviço deve continuar no projeto exclusivo Guardião, ambiente production. O script recusa compose com outro serviço além de `web`.
- Executar a primeira pipeline e revisar os jobs `verify`, `publish`, `deploy`. Publicação automática só está validada depois dessa execução real.

## Verificação local

`pnpm exec vitest run tests/deploy.test.ts` testa preservação do compose, rejeição de múltiplos serviços e rollback quando a revisão HTTP permanece antiga.

`circleci config validate .circleci/config.yml` valida o arquivo com a CLI oficial quando ela estiver instalada. Os testes do navegador usam APIs de voz simuladas; permissão e reconhecimento de áudio real devem ser conferidos manualmente em navegador compatível.

Referências: https://circleci.com/docs/reference/configuration-reference/ e https://coolify.io/docs/api/endpoints/services/update-service-by-uuid.
