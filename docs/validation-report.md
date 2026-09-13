# Relatório de validação

Data: 13/09/2026. Ambiente: Apple M4, macOS arm64, 16 GiB, Node 24.8.0, Python 3.14.6. Versões completas em dependency-baseline.md e contracts/dependency-baseline.json.

## Validado

- Instalação Node com lockfile congelado.
- Typecheck API/frontend e build de produção Next/Nest.
- 11 testes determinísticos em 7 arquivos: golden, domínio, API, parser CSV/XLSX, orquestração com provedor HTTP controlado e recuperação de outbox após escrita de resultado incerto.
- Golden: todo período 12 registros, 5 pendentes, 5 concluídos, 1 cancelado, 1 desconhecido, 5 respostas válidas, média 3,4, 2 pendentes há mais de 30 dias. Setembro: 9/3/4/1/1, 4 respostas válidas, média 3,0, nenhum pendente há mais de 30 dias. Repetição e resposta anterior à criação preservadas na contagem.
- Sessão ausente negada; credenciais inválidas negadas; origem externa negada; fontes de outro espaço negadas; papel Leitor sem gravação; revisões concorrentes e chave idempotente divergente recusadas.
- Importação em worker com prévia, confirmação e ativação. Linhas físicas preservadas após rejeições. Aba XLSX explícita e fórmulas rejeitadas.
- Modelo controlado solicita uma ferramenta real de analytics; a resposta quantitativa é preenchida com o resultado do banco. Uma tentativa do modelo de gravar sem permissão é recusada.
- Decisão com vários compromissos em uma chamada transacional: falha de validação em um compromisso desfaz os registros e as projeções; o formulário oferece um compromisso inicial e a API aceita até 50.
- Outbox: teste controlado simula timeout depois de gravar a nota; a retentativa reconhece o marcador por leitura, sem outra escrita. O registro no banco permanece disponível durante a falha.
- Basic Memory **real**, 0.23.2: descoberta, escrita, leitura, busca e persistência via SDK MCP. Contratos e resultados em contracts/mcp-smoke.json.
- Busca híbrida **real** em português: 10/10 documentos esperados no top 5; perguntas e tempos em contracts/knowledge-evaluation.json. A primeira consulta inclui inicialização; consultas seguintes ficam aquecidas. Não é avaliação de respostas de LLM.
- Benchmark sintético isolado com 1.000.000 de linhas de conteúdo distinto, arquivo de 110.555.628 bytes, sem mistura com o seed da aplicação. Importação e falhas da execução final estão em contracts/performance.json. O resumo integral atingiu o deadline de três segundos após 20 agrupamentos concluídos, e uma repetição também atingiu timeout no agrupamento. Não há p95 consolidado da implementação final; a meta de escala ainda não está aceita. O relatório anterior de consultas síncronas foi mantido apenas como histórico. O cenário usa o worker de importação e as consultas da aplicação. Pico de memória e carga concorrente não foram medidos.
- Backup com driver SQLite e restauração independente, conferindo SHA-256, integrity_check, quantidades de decisões/compromissos e snapshot ativo. Registro em contracts/restore-check.json.
- Jornadas Playwright: login, painel/filtros, fonte, compromisso persistido após reload, troca de espaço, biblioteca, falta de provedor explícita, importação CSV e template de compromissos. Telas em 1440, 1024 e 390 px; screenshots em screenshots/.
- Auditoria automatizada de acessibilidade de login e visão geral registrada em contracts/accessibility.json. Esse resultado não substitui uma auditoria humana completa de WCAG.

## Integrações e testes não comprovados

1. **LLM real:** OpenRouter com openai/gpt-4.1-mini validado em 13/09/2026: chamada de ferramenta, total de 1.030 pendentes conferido no banco e justificativa da revisão da vistoria do Norte conferida na ata. Evidências em contracts/llm-smoke.json e contracts/llm-demo-validation.json. A integração foi corrigida para exigir JSON estruturado, omitir filtros vazios e preservar a definição de pendentes. O roteiro completo de escrita, cancelamento e avaliação ampla de respostas ainda precisa ser executado.
2. **Docker Compose:** validado no servidor Linux/Coolify em 13/09/2026, com PostgreSQL 16 dedicado, volumes persistentes e HTTPS. Registro operacional em `deployment/COOLIFY.md`.
3. **Base pública:** CSV de Curitiba não foi importado. Esse espaço está vazio e não contém números fictícios.
4. **Escala:** o resumo integral de um milhão de registros ainda pode atingir o deadline de três segundos. o arquivo de teste tem aproximadamente 105 MiB, não os 150 MiB da meta específica. O resultado foi medido num M4/16 GiB, não numa VM de 4 vCPU/8 GiB. Não foi medido pico RSS nem concorrência máxima.
5. **Matriz de falhas:** há cobertura controlada de timeout de projeção, persistência, idempotência e autorização. Não foi executada toda a sequência de encerramento forçado dos processos, ativação simultânea durante consulta, cancelamento depois de commit com LLM real e falha de transporte real após escrita MCP.
6. **Entailment das fontes:** IDs e valores estruturados são validados. A cobertura factual integral do texto livre do LLM exige avaliação com provedor real; a aplicação não promete ausência de alucinação.

## Diferenças funcionais da SDD

- Dimensões usam rótulos canônicos e filtros por nome. Não existe ainda uma interface administrativa completa para aliases de bairros, secretarias e serviços, com IDs estáveis e políticas independentes versionadas.
- As listas da API são limitadas/paginadas. A interface principal apresenta até 100 registros por carregamento; navegação completa entre páginas ainda precisa ser acrescentada para coleções maiores.
- O contrato OpenAPI lista as rotas e deriva schemas de entrada do Zod, mas vários schemas de saída ainda são genéricos. Não deve ser tratado como contrato totalmente tipado de todas as respostas.
- Logs/auditoria persistem ações e referências, mas não existe painel completo de métricas operacionais de tokens, custos, filas e percentis.

Esses itens impedem declarar toda a Definition of Done da SDD como aceita. A entrega contém uma aplicação local funcional e testada, com limitações e pendências identificadas.


## Correção de referências no Guardião — 13/09/2026

Reproduzida a falha em “Quantos registros existem e quantos estão pendentes?”. O modelo citava o UUID do snapshot como evidência e utilizava contagens dos metadados para inferir pendências. O adaptador agora distingue cobertura de métricas, restringe os IDs de fontes/consultas no schema de resposta ao catálogo do turno e permite correção limitada sem aceitar IDs inventados. Referências persistentemente inválidas continuam bloqueadas.

Marcadores de valores são fornecidos pelo backend; o renderizador aceita apenas valores escalares do resultado autorizado, inclusive linhas de rankings. Filtros opcionais das ferramentas aceitam null explicitamente, para não confundir ausência de filtro com situação desconhecida. Testes controlados cobrem correção de fontes, rejeição persistente, valores aninhados e filtros vazios/nulos. O relatório de consultas reais está em contracts/llm-citation-validation.json; a continuidade da conversa está em contracts/llm-citation-followup.json. A validação é dos cenários registrados, não uma garantia de correção de todo texto livre do modelo.

## Publicação no Coolify — 13/09/2026

- Produção: https://veriia.com.br, containers API e web saudáveis.
- 12 testes passaram no PostgreSQL remoto, incluindo concorrência/idempotência; 13 testes locais passaram após acrescentar a regressão do caminho normalizado do Basic Memory no Docker. Typecheck e build Linux passaram.
- Migração por tabela conferida com hashes; restauração PostgreSQL independente conferida com as contagens migradas.
- Login e métricas de demonstração verificados em produção: 2.000 registros, 1.030 pendentes.
- Duas consultas reais via OpenRouter concluídas; consulta quantitativa com uma fonte e consulta documental sobre drenagem do Norte com duas fontes, todas abertas e autorizadas pela API. Resultado em `contracts/deployment-verification.json`.
- Índice Basic Memory reconstruído com 46 notas.
- As ressalvas de escala e de cobertura completa do SDD listadas acima continuam aplicáveis; esta publicação não representa aprovação desses critérios pendentes.

### Ajuste da implantação: container único

Frontend exportado pelo Next e servido pelo backend, com headers de segurança e cache de assets. Build estático e 14 testes passaram, incluindo a integração HTTP frontend/API no mesmo processo. Serviço movido de resources para o projeto exclusivo Guardião. PostgreSQL existente reutilizado, sem container de banco adicional.

Validação final do container único: login e bundle estático carregados diretamente do backend; duas consultas reais à IA concluídas via SSE, com fontes abertas e verificadas. Apenas um container do Guardião está ativo, e o container PostgreSQL preexistente permaneceu em execução.

## Saúde, voz e CircleCI — 13/09/2026

Publicado em veriia.com.br como `guardiao:20260913-6`, um container e PostgreSQL existente. Saúde: 24 cidadãos, 3 UBS, 6 agentes, 48 atendimentos, 24 prescrições fictícias e 48 visitas. Validação: 17 testes SQLite, 7 testes PostgreSQL, 3 testes de navegador contra produção; 3 respostas reais do OpenRouter sobre saúde e 2 de regressão sobre demandas/memória, todas com fontes acessíveis. Build estático e revisão pública conferidos.

A voz foi testada com APIs simuladas de reconhecimento/síntese, inclusive fallback e interrupção; áudio real depende do navegador e do microfone do usuário. CircleCI: configuração validada pela CLI oficial e rollback testado com respostas HTTP controladas; conexão de repositório e contextos ainda pendentes. Relatórios em `docs/contracts/features-verification.json`, `health-verification.json` e `deployment-verification.json`.
