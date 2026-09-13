# Progresso AGM

Registro de 13/09/2026. Aplicação e login implementados no workspace. A SDD foi usada como requisito funcional, preservando a página institucional.

| Tarefa | Estado | Evidência |
| --- | --- | --- |
| T-01 Workspace e baseline | Concluída | pnpm-lock.yaml, apps/, dependency-baseline.md; instalação congelada |
| T-02 MCP e embeddings | Concluída | basic-memory-tools.json, mcp-smoke.json, knowledge-evaluation.json (10/10) |
| T-03 Adaptador de provedor | Concluída | OpenRouter/gpt-4.1-mini: tool calling e duas consultas reais com fontes; llm-smoke.json e llm-demo-validation.json |
| T-04 Schema e migrations | Concluída | schema.sql, SQLite WAL/FK, schema_migrations |
| T-05 Acesso e espaços | Concluída | auth.ts, testes API/domínio, cookies e autorização |
| T-06 Golden e seed | Concluída | fixtures, seed.ts, seed-manifest.json |
| T-07 CSV/XLSX | Concluída | parser, worker, prévia, aba, fórmulas rejeitadas; API e E2E |
| T-08 Snapshots e qualidade | Em andamento | ativação, reversão, identidade e qualidade implementadas; falta editor de aliases |
| T-09 Analytics | Em progresso | golden correto, worker com deadline e query_runs persistidos; importação e agrupamentos de 1 milhão passaram, resumo integral ainda atinge timeout |
| T-10 Painel | Concluída | filtros, métricas, barras, série temporal e tabelas; E2E |
| T-11 Documentos | Concluída | upload Markdown, versões preservadas, busca híbrida real |
| T-12 Evidências | Concluída | catálogo com hash, referências autorizadas e drawer |
| T-13 Orquestrador | Em andamento | ferramentas limitadas, schema, referências e controle de escrita; duas consultas reais validadas; avaliação ampla pendente |
| T-14 Conversas/SSE | Concluída | histórico por proprietário, eventos persistidos, replay e cancelamento |
| T-15 Decisões/compromissos | Concluída | formulários, vínculos, fontes, transições, revisões e If-Match |
| T-16 Outbox | Concluída | jobs com lease/retry, projeções imutáveis e teste de timeout após escrita |
| T-17 Escrita pelo chat | Bloqueada na validação real | ferramentas implementadas; autorização explícita e permissões; roteiro de escrita com provedor real ainda não executado |
| T-18 Exportações | Concluída | CSV com escaping de fórmula; briefing Markdown com fontes |
| T-19 Interface | Concluída | telas responsivas, teste desktop/tablet/390px e auditoria automatizada |
| T-20 Operação | Em andamento | backup/restauração validados; Compose entregue, daemon indisponível |
| T-21 Aceite completo | Em andamento | testes determinísticos e reais separados; matriz remanescente em validation-report.md |
| T-22 Documentação | Concluída | README, SDD, decisões, runbook, contratos e relatório |

Os estados “Em andamento” e “Bloqueada na validação real” não devem ser tratados como aceite integral da SDD. A implantação externa não foi executada.
