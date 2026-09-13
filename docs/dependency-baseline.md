# Baseline validado

- Node: 24.8.0.
- Python: 3.14.6.
- pnpm: 10.32.1, lockfile verificado com instalação congelada.
- Next.js 16.3.5, React 19.3.0, NestJS 12.0.1.
- better-sqlite3 13.0.3; SQLite real do driver: 3.53.4.
- Basic Memory 0.23.2; FastMCP 4.0.0b1, SDK MCP TypeScript 1.30.0.
- TypeScript 5.9.3, Vitest 5.0.0, Playwright 1.63.0.
- Modelo de embeddings: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2, 384 dimensões, FastEmbed 0.8.0; índice sqlite-vec. Reranker desligado.
- Máquina medida: macOS arm64, Apple M4, 16 GiB de RAM. Diferente da máquina de referência de 4 vCPU/8 GiB sugerida na SDD.

As versões transitivas estão em `pnpm-lock.yaml` e `requirements.lock`. A captura completa está em `contracts/dependency-baseline.json`. As ferramentas efetivamente anunciadas pelo MCP estão em `contracts/basic-memory-tools.json`.

O servidor iniciado com `--project agm-municipio-demo` manteve consultas no projeto restrito mesmo quando um argumento solicitava outro projeto. A listagem administrativa ainda mostra projetos existentes; essa ferramenta nunca é exposta ao LLM. A aplicação também injeta o projeto e valida o catálogo antes de ler/citar qualquer resultado.

O build é executado com NODE_ENV=production explicitamente, evitando uma configuração herdada incompatível. Nenhuma chave LLM foi encontrada nas variáveis AGM do ambiente. O Docker CLI existe, mas o daemon não estava disponível para executar os containers.
