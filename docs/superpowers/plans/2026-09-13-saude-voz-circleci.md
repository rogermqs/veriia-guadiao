# Saúde, voz e CircleCI

Objetivo: implementar os três itens aprovados pelo usuário, mantendo um container e PostgreSQL existente.

## Saúde
- Tabelas relacionais de UBS, agentes, cidadãos, atendimentos, prescrições e visitas no banco principal; todas as chaves incluem workspace.
- Seed determinístico e idempotente apenas no demo, independente do seed anterior de demandas.
- API autenticada de busca, histórico e visitas com evidências imutáveis e auditoria. Nenhum endpoint de dados clínicos reais.
- Ferramentas da IA consultam as mesmas funções, sem SQL produzido pelo modelo. Tela Saúde com busca, UBS e histórico cronológico.
- Testes: relações, repetição do seed, filtros, fontes e isolamento demo/real e autenticação.

## Voz
- Web Speech API em pt-BR: ditado para o campo editável, envio explícito, leitura da resposta por botão e opção automática.
- Detectar suporte; lidar com permissão negada, ausência de fala e erros; parar ao trocar conversa/sair e não reproduzir resposta antiga.
- Cérebro compacto indica ouvindo/processando/falando. Não capturar áudio automaticamente.
- Testes de navegador com APIs simuladas para ditado, envio, parada e fallback.

## CircleCI
- Testes SQLite e PostgreSQL, typecheck, build Docker único e publicação com tag do commit.
- Deploy serializado da branch main usando contexto de produção, token Coolify e registro configurados fora do código.
- Atualizar somente imagem web no compose existente, preservar variáveis/volumes/banco; reiniciar, validar container com a imagem esperada e saúde HTTP; restaurar imagem anterior em falha.
- Documentar configuração de repositório/contextos e dependências externas pendentes. Não alegar pipeline conectado antes de validar no CircleCI.

## Validação e publicação
- Executar testes significativos, typecheck, build, verificar saúde/login e consultas autenticadas.
- Publicar em veriia.com.br usando a sessão SSH autorizada, se disponível. Preservar dados e manter uma imagem anterior para rollback.
