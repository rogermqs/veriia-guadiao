# Guardião: PostgreSQL e Coolify

Pedido autorizado: migrar a aplicação e os dados fictícios para PostgreSQL e publicar no servidor informado. Manter os bancos de outros serviços isolados.

1. Criar camada assíncrona de persistência com PostgreSQL (pg), transações em conexão dedicada e schemas separados para domínio e analytics de cada espaço. Preservar SQLite para testes locais e origem da migração.
2. Adaptar Store, autenticação, consultas, importadores, memória e orquestrador para await; validar transações, idempotência e consultas golden.
3. Criar banco/usuário exclusivos no PostgreSQL existente e migrar tabelas/arquivos com relatório de contagens. Não transportar sessões de login. Reindexar memória local no servidor.
4. Criar recurso no Coolify, volumes persistentes, configurações privadas e limites de recursos. Testar imagem Linux no servidor.
5. Validar acesso, login, painel, escrita/versões, fontes e consultas OpenRouter no endereço publicado. Documentar backup PostgreSQL e arquivos, domínio e operação.

A publicação permanece dependente da migração validada. O hostname público será definido conforme resposta do usuário ou endereço provisório suportado pelo Coolify.
