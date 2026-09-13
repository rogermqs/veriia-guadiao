# Saúde e conversa por voz

## Demonstração de saúde

No Município Demonstração, abrir **Saúde**, buscar Maria Oliveira e consultar o histórico. Há 24 cidadãos fictícios, 3 UBS, 6 agentes, 48 atendimentos, 24 prescrições demonstrativas e 48 visitas. A primeira consulta de Maria ocorreu na UBS Centro; o retorno e a UBS de referência são Jardim Norte. Ana Ribeiro realizou uma visita e tem outra agendada. Visita agendada não equivale a realizada.

O seed é idempotente e executa independentemente do seed prévio de demandas. As seis tabelas `health_*` usam o banco principal, com chaves e relações por workspace. Os endpoints são autenticados e somente leitura. Leituras geram auditoria e evidência imutável com hash, restrita ao mesmo usuário/espaço. O ambiente Curitiba não recebe dados fictícios.

Perguntas de teste:
- Qual UBS atendeu Maria Oliveira e o que foi prescrito no último atendimento?
- Qual é o histórico de Maria Oliveira?
- Qual agente visitou Maria Oliveira? Existe visita agendada?
- Quais visitas de Ana Ribeiro já foram realizadas?
- Quais visitas não foram realizadas?

As ferramentas são `search_health_citizens`, `read_health_history` e `list_health_visits`. Não há conexão com e-SUS, prontuários ou sistemas clínicos reais. As prescrições usam medicamentos demonstrativos sem posologia clínica.

## Voz

No Assistente: **Ditar pergunta**, permitir o microfone, falar, revisar o texto e enviar. Para ouvir, usar **Ouvir resposta** ou marcar **Ouvir respostas automaticamente**. **Parar áudio** interrompe a fala. Nova conversa, troca de página/espaço e aba oculta interrompem a captura/reprodução. A permissão de escrita continua exigindo marcação e envio explícito; é desmarcada após cada envio.

A primeira versão usa Web Speech API em pt-BR. O navegador pode enviar áudio ao seu serviço de reconhecimento e pode exigir conexão. Se a API não existir, o botão de ditado fica desabilitado com explicação; o chat textual permanece disponível. As fontes continuam no texto e a IA continua usando OpenRouter no backend. Não há nova chave nem áudio armazenado pela aplicação.

Teste manual no navegador em HTTPS: permissão aceita/negada; microfone ausente; silêncio; frase longa; corrigir transcrição; ouvir resposta; interromper; navegar durante gravação. Testes automatizados simulam reconhecimento e síntese; não comprovam a disponibilidade do serviço de voz de cada navegador.

Referências: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition e https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis.
