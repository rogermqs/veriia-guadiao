# Decisões desta implementação

1. O pedido de login estático foi aplicado ao formulário e às contas locais de demonstração. A sessão e as permissões são validadas no servidor. O bootstrap gera uma senha local, em vez de embutir uma senha pública no navegador.
2. A landing HTML foi preservada e adicionada ao diretório público do Next. O backend não altera o conteúdo institucional.
3. CSS próprio mantém a identidade da Veriia; Tailwind não foi acrescentado. Recharts atende à série temporal; barras simples têm tabela equivalente.
4. Python 3.14.6 substitui a proposta inicial 3.12 porque essa foi a versão instalada e validada com Basic Memory 0.23.2. A imagem usa a mesma versão. O SDK MCP instalado é a geração v1 (`@modelcontextprotocol/sdk@1.30.0`), não imports presumidos da geração v2.
5. O modelo inicial testado, multilingual-e5-small, não estava no catálogo FastEmbed instalado. Foi substituído por paraphrase-multilingual-MiniLM-L12-v2, validado em 10 perguntas portuguesas. O erro inicial não foi contado como sucesso.
6. Domínio consolidado em entidades/revisões com tipos decisions/commitments, SQLite e transações; bancos analíticos separados por espaço. Os IDs dos dois espaços e datasets bootstrap são estáveis e legíveis; recursos operacionais usam UUID.
7. Projeções de memória são notas imutáveis por entidade e versão, com marcador de integridade e leitura de confirmação. O estado vigente vem do banco, nunca da similaridade de uma nota antiga.
8. Upload CSV é recebido em disco. Prévia e processamento usam worker separado, leitura incremental e inserção em lotes de 1.000 linhas. XLSX é limitado a 20 MiB/50 mil linhas e requer aba explícita.
9. O escopo atual de filtros usa nomes canônicos validados. Um catálogo administrativo de aliases e política versionada com interface própria não foi entregue.
10. Não há repositório Git inicial neste diretório; os arquivos foram implementados no workspace sem criação de commits ou publicação remota. `RTK.md` foi procurado no projeto, ancestrais e pastas de instruções e não foi localizado.
