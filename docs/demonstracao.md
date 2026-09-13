# Demonstração municipal

Selecione **Município Demonstração** em http://localhost:3000/agm. O espaço de Curitiba continua reservado a dados públicos reais.

Base fictícia verificada em 13/09/2026: 2.000 solicitações, 12 atas, 8 decisões e 18 compromissos. O recorte tem 1.030 registros pendentes, 806 concluídos, 124 cancelados e 40 com situação desconhecida. A data de referência é 13/09/2026. Os cinco compromissos remanescentes dos testes foram enriquecidos com cenários de obras, responsáveis fictícios e prazos; suas revisões anteriores foram preservadas.

## Roteiro

1. Abra Visão geral e filtre um bairro ou secretaria.
2. Abra a origem do indicador para mostrar o recorte e a fonte.
3. Em Compromissos, compare ações vencidas, em andamento e concluídas.
4. Em Decisões, consulte a revisão do prazo da vistoria do Norte.
5. Em Conhecimento, compare as atas 01 e 02, que registram o prazo anterior e o revisado.
6. Após configurar a IA, pergunte: “Quantos registros estão pendentes?”; “Quais bairros concentram mais solicitações?”; “Por que o prazo da vistoria do Norte foi revisado?”.

## OpenRouter

O adaptador já está implementado no backend. O `.env` local foi preparado com a URL `https://openrouter.ai/api/v1` e o modelo `openai/gpt-4.1-mini`. Preencha `AGM_LLM_API_KEY` com a chave da sua conta OpenRouter. A chave permanece no servidor.

Pare o processo atual e execute `npm start` para carregar a configuração. Depois execute `npm run smoke:integrations` para verificar uma chamada de ferramenta real. A conta precisa ter saldo ou limite disponível para o modelo escolhido. Em 13/09/2026, após a configuração da chave, foram validadas chamadas reais de ferramenta, uma pergunta quantitativa e uma pergunta sobre as atas. Resultados em contracts/llm-demo-validation.json.

Fluxo: pergunta → backend → OpenRouter → solicitação de ferramenta → consulta autorizada ao banco ou à memória → resultados enviados ao modelo → resposta com referências. A chave não é enviada ao navegador. A pergunta, o histórico selecionado e os resultados das ferramentas são enviados ao provedor; o banco completo permanece local. Os cálculos são executados pelo sistema e os valores estruturados são validados antes de exibição. Gravações exigem papel adequado e solicitação explícita.
