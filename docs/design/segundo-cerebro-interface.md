# Interface Segundo Cérebro

A referência visual é a versão da equipe em `Guardiao-Projeto/dist/brain.js` e `guardiao-logo.png`. O algoritmo de contorno, distribuição de pontos e cores foi adaptado em `scripts/create-neural-brain.mjs` para gerar uma imagem SVG reutilizável, sem depender do servidor ou das funções de análise do projeto de referência.

- Painel: cérebro em destaque e atalhos para saúde, financeiro, contratos, fontes, conhecimento, decisões e compromissos. A identidade dos cartões é independente do destino de navegação.
- Chat: cabeçalho compacto, cérebro na abertura e brilho durante consulta/leitura por voz. Movimento reduzido do sistema é respeitado.
- Login e landing page: mesma rede neural e identidade do Segundo Cérebro.
- Tema: claro/escuro, preferência persistida em `guardiao-theme`; na ausência de preferência, segue o sistema. Funciona também com armazenamento bloqueado.
- Chat: perfis de Gestão, Financeiro, Contratos e Saúde. O foco selecionado é incluído na pergunta enviada ao assistente existente; não cria agentes autônomos. Roteiros preenchem o campo para revisão, sem envio automático.
- Conexões sugeridas e cérebro expandido ficam em controles recolhíveis. As etapas de consulta refletem os eventos do servidor; evidências e briefing continuam vinculados à resposta retornada.

A visualização é conceitual; seus pontos não correspondem a registros, evidências ou relações calculadas. Os dados e a integração de IA existentes não foram substituídos pelos da referência.

Execute `node scripts/create-neural-brain.mjs` para regenerar a arte e `pnpm site:sync` para sincronizar os arquivos da landing page e os assets.

Verificação de interface: `pnpm exec playwright test tests/e2e/neural-interface.spec.ts tests/e2e/chat-specialists.spec.ts tests/e2e/brain-interaction.spec.ts` com o frontend iniciado. Os testes isolam as APIs com dados de interface fictícios; não validam a conexão ao banco nem o provedor de IA.
