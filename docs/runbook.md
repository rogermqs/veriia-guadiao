# Operação da demonstração

## Preparar apresentação

1. Executar bootstrap, memory:setup e iniciar o sistema.
2. Entrar com a conta local em `.env`.
3. Na Administração, verificar jobs. Aguardar sincronização antes de avaliar busca.
4. Rodar smoke:integrations e knowledge:evaluate. Confirmar separadamente se o provedor LLM foi validado.
5. Usar Município Demonstração, com indicação SIMULAÇÃO. Curitiba só deve ser apresentado com arquivo autêntico importado.

## Importar registros

Fontes e importações → arquivo CSV/XLSX → título, data de referência, origem, publicação e critérios de amostra. Para XLSX, informar aba. A prévia exibe cabeçalhos, primeiras 50 linhas, qualidade e situações encontradas. Mapear explicitamente as situações; Curitiba começa com estados desconhecidos. Confirmar processamento. O Administrador pode ativar/reverter uma versão pronta. Mais de 1% de rejeições bloqueia ativação. Até 1% exige reconhecimento explícito. Linhas repetidas são preservadas.

O arquivo original é preservado com SHA-256. Uma consulta antiga guarda resultado, filtros e snapshot. Reimportar a mesma identidade não acumula linhas.

## Importar compromissos

Compromissos → Importar plano de ações → baixar template → escolher CSV ou XLSX. Informar a aba no XLSX. Revisar linhas, corrigir erros e confirmar. `external_ref` é obrigatório e único no lote. Reenvios do mesmo lote pelo mesmo usuário não duplicam as ações. A operação é exclusiva de Gestor/Administrador no espaço simulado.

## Documentos

Conhecimento → Importar documento Markdown. O texto é tratado como dado, não executado. Abra um documento para importar outra versão; a versão anterior permanece no catálogo. Não importe textos fictícios para Curitiba. Documentos públicos exigem URL de origem.

## Recuperar índice

Jobs falhos podem ser retentados na Administração. Cada job consulta a versão vigente antes de projetar e confirma a escrita por leitura. O banco continua sendo a fonte de decisões e compromissos. Se a configuração do Basic Memory foi restaurada em outro caminho, rode memory:setup para registrar os vaults atuais. Reconstrua embeddings com `bm reindex --embeddings --project agm-municipio-demo`, usando `BASIC_MEMORY_CONFIG_DIR` e `BASIC_MEMORY_HOME` apontando para os diretórios dentro de data.

## Backup

`pnpm backup` bloqueia novas mutações por meio de `data/backup.lock` e aguarda operações já iniciadas. Copia bancos via driver e arquivos de origem/vault. `pnpm restore:check` restaura uma cópia isolada e valida o manifesto. Para restauração operacional, pare web/API, preserve o estado atual, copie o backup validado para um novo `AGM_DATA_DIR`, reprovisione os projetos de memória e só então inicie a aplicação. Não substitua bancos ativos.

Se o backup for interrompido externamente, confira se não há outro backup em execução antes de remover manualmente `data/backup.lock`.

## Roteiro de oito minutos

1. Visão geral: escolher período e bairro; abrir origem e filtros.
2. Explicar que registros não são protocolos únicos e resposta não é execução.
3. Abrir as atas 01 e 02 do Norte e comparar os prazos.
4. Consultar decisão vigente e seu histórico.
5. Criar compromisso de Obras para 30/09 e abrir o registro salvo.
6. Recarregar a aplicação e mostrar a persistência.
7. Com LLM validado, abrir nova conversa e consultar compromissos de Obras; abrir fontes e exportar briefing.
8. Sem provedor configurado, mostrar a indisponibilidade de forma explícita e usar as telas de domínio. Isso não demonstra o roteiro de IA completo.
