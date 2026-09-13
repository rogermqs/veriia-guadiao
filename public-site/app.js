/* No frameworks, trackers, cookies, local storage or third-party requests. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const config = window.VERIIA_CONFIG || {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prototypeMode = !config.contactEndpoint;

  const modules = {
    triagem: { title: 'Demandas e indicadores', icon: 'shield', copy: 'Consulte demandas por bairro, secretaria e situação. Identifique pendências e confira a origem de cada indicador.' },
    credito: { title: 'Conhecimento', icon: 'sliders', copy: 'Reúna atas, relatórios e documentos. Consulte o Segundo Cérebro e confira as fontes que fundamentam a resposta.' },
    instala: { title: 'Decisões', icon: 'route', copy: 'Registre o que foi decidido, por quê e com base em quais documentos. Preserve as revisões e o contexto da gestão.' },
    jornada: { title: 'Compromissos', icon: 'cycle', copy: 'Transforme decisões em ações com responsáveis, prazos e situação. Acompanhe o que está aberto, em andamento ou concluído.' },
    escuta: { title: 'Saúde do cidadão', icon: 'spark', copy: 'Explore UBS, atendimentos, prescrições e visitas de agentes em históricos conectados. A demonstração utiliza apenas cidadãos e registros fictícios.' },
    recupera: { title: 'Conversa por voz', icon: 'target', copy: 'Dite sua pergunta, revise e envie. Ouça a resposta do Segundo Cérebro e consulte as fontes na tela, em navegadores compatíveis.' }
  };

  const steps = [
    ['Dados dispersos.\nUma visão conectada.', 'Demandas, documentos, indicadores e registros de saúde disponíveis passam a compor o contexto da gestão. Na demonstração, os históricos de cidadãos são inteiramente fictícios.'],
    ['Informação com fonte.\nContexto para entender.', 'Pergunte em linguagem natural. O Segundo Cérebro consulta as fontes do espaço de trabalho e reúne o contexto para você conferir antes de decidir.'],
    ['Inteligência para apoiar.\nA decisão é da gestão.', 'Compare informações, confira as evidências e registre a decisão, sua justificativa e os documentos de apoio. Uma sugestão da IA não equivale a uma decisão aprovada.'],
    ['Uma boa decisão\nprecisa sair do papel.', 'Registre compromissos com responsáveis e prazos. Acompanhe o andamento das ações e consulte as pendências da gestão.'],
    ['A gestão avança.\nO conhecimento permanece.', 'Decisões, revisões e documentos preservam a memória institucional. Quem assume uma tarefa encontra o histórico e o contexto dos próximos passos.']
  ];

  const productTabs = $$('.product-tab');
  function selectProduct(product, focus = false) {
    if (!['guardiao'].includes(product)) return;
    productTabs.forEach((tab) => {
      const selected = tab.dataset.product === product;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $('#' + tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus();
    });
  }
  productTabs.forEach((tab) => tab.addEventListener('click', () => selectProduct(tab.dataset.product)));
  $$('[data-select-product]').forEach((link) => link.addEventListener('click', () => selectProduct(link.dataset.selectProduct)));

  // Roving tabindex with standard tab keyboard behavior.
  function enableTabKeyboard(tablist, selector, activate) {
    tablist.addEventListener('keydown', (event) => {
      const tabs = $$(selector, tablist);
      const current = tabs.indexOf(document.activeElement);
      if (current === -1) return;
      let target;
      if (event.key === 'ArrowRight') target = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      activate(tabs[target]);
      tabs[target].focus();
    });
  }
  enableTabKeyboard($('.product-tabs'), '.product-tab', (tab) => selectProduct(tab.dataset.product));

  function replaceCopyWithStrong(element, title, copy) {
    const strong = document.createElement('strong');
    strong.textContent = title + '.';
    element.replaceChildren(strong, document.createTextNode(' ' + copy));
  }
  $$('[data-module]').forEach((button) => button.addEventListener('click', () => {
    const module = modules[button.dataset.module];
    $$('[data-module]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    replaceCopyWithStrong($('#module-copy'), module.title, module.copy);
    $('#module-icon use').setAttribute('href', '#i-' + module.icon);
  }));


  function selectStep(index) {
    if (!Number.isInteger(index) || !steps[index]) return;
    $$('[data-step]').forEach((button) => {
      const active = Number(button.dataset.step) === index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const title = $('#step-title');
    const parts = steps[index][0].split('\n');
    title.replaceChildren(document.createTextNode(parts[0]), document.createElement('br'), document.createTextNode(parts[1]));
    $('#step-description').textContent = steps[index][1];
    $('#step-counter').textContent = '0' + (index + 1) + ' / 05';
    $('#step-panel').setAttribute('aria-labelledby', 'step-tab-' + index);
  }
  $$('[data-step]').forEach((button) => button.addEventListener('click', () => selectStep(Number(button.dataset.step))));
  enableTabKeyboard($('.method-steps'), '.method-step', (tab) => selectStep(Number(tab.dataset.step)));

  // Responsive menu. Native details remains usable with keyboard and without JS.
  const navigation = $('#main-navigation');
  const menuToggle = $('.menu-toggle');
  function setMenu(open, returnFocus = false) {
    navigation.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    $('use', menuToggle).setAttribute('href', open ? '#i-close' : '#i-menu');
    if (!open) $('.nav-dropdown').open = false;
    if (returnFocus) menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  $$('a', navigation).forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) setMenu(false);
    else if (!event.target.closest('.nav-dropdown')) $('.nav-dropdown').open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (menuToggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    else if ($('.nav-dropdown').open) {
      $('.nav-dropdown').open = false;
      $('.nav-dropdown summary').focus();
    }
  });
  window.matchMedia('(min-width: 760px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });

  // Dialogs use native modal focus trapping and Escape handling.
  const productDialog = $('#product-dialog');
  const privacyDialog = $('#privacy-dialog');
  let activeProduct = 'guardiao';
  let dialogOpener = null;
  function showDialog(dialog) {
    dialogOpener = document.activeElement;
    setMenu(false);
    dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
  }
  $$('dialog').forEach((dialog) => {
    $$('.close-dialog', dialog).forEach((button) => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
      if (dialogOpener && dialogOpener.isConnected) dialogOpener.focus({ preventScroll: true });
    });
  });

  function openProduct(product) {
    if (!['guardiao'].includes(product)) return;
    activeProduct = product;
    $('#dialog-logo').src = 'assets/guardiao.png';
    $('#dialog-logo').alt = 'Guardião';
    $('#dialog-logo').width = 247;
    $('#dialog-logo').height = 239;
    $('#dialog-title').textContent = 'Seu Segundo Cérebro em ação.';
    $('#dialog-kicker').textContent = 'GUARDIÃO · INTELIGÊNCIA, DECISÃO E MEMÓRIA';
    $('#dialog-intro').textContent = 'O Segundo Cérebro do município conecta dados, documentos e históricos para apoiar a gestão. Conheça as frentes do Guardião.';
    const moduleList = $('#dialog-modules');
    moduleList.replaceChildren();
    const items = Object.values(modules).map((module, index) => ['0' + (index + 1), module.title, module.copy]);
    items.forEach(([number, title, copy]) => {
      const article = document.createElement('article');
      article.className = 'dialog-module';
      const marker = document.createElement('span'); marker.textContent = number;
      const heading = document.createElement('h3'); heading.textContent = title;
      const paragraph = document.createElement('p'); paragraph.textContent = copy;
      article.append(marker, heading, paragraph);
      moduleList.append(article);
    });
    const button = $('#dialog-contact');
    button.firstChild.textContent = 'Conversar sobre o ' + 'Guardião ';
    showDialog(productDialog);
  }
  $$('[data-open-product]').forEach((button) => button.addEventListener('click', () => openProduct(button.dataset.openProduct)));
  $('#dialog-contact').addEventListener('click', () => {
    $('#lead-product').value = activeProduct;
    clearFieldError($('#lead-product'));
    productDialog.close();
    $('#contato').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    window.setTimeout(() => $('#lead-name').focus({ preventScroll: true }), reducedMotion.matches ? 0 : 600);
  });

  function safePolicyUrl() {
    try { const url = new URL(config.privacyUrl); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
  }
  $$('[data-open-privacy]').forEach((button) => button.addEventListener('click', () => {
    const policy = safePolicyUrl();
    if (!prototypeMode && policy) window.open(policy, '_blank', 'noopener,noreferrer');
    else showDialog(privacyDialog);
  }));

  if (!prototypeMode) {
    $('#prototype-note').textContent = 'Seus dados serão encaminhados para tratar esta solicitação. Consulte a política de privacidade.';
    $('.footer-bottom [data-open-privacy]').textContent = 'Política de privacidade';
    const faqStart = $('.faq-list details:last-child p');
    faqStart.textContent = 'Conte seu cenário no formulário abaixo. A conversa inicial permite discutir a solução mais adequada, as prioridades do município e o escopo de uma possível avaliação.';
  }

  // Frontend validation is only an experience layer. The backend must validate too.
  const form = $('#contact-form');
  const fields = [$('#lead-name'), $('#lead-company'), $('#lead-email'), $('#lead-product'), $('#lead-consent')];
  const errors = new Map([
    ['lead-name', ['error-name', 'Informe seu nome, com pelo menos 2 caracteres.']],
    ['lead-company', ['error-company', 'Informe o nome da prefeitura ou secretaria.']],
    ['lead-email', ['error-email', 'Informe um e-mail válido.']],
    ['lead-product', ['error-product', 'Selecione a solução que deseja conhecer.']],
    ['lead-consent', ['error-consent', 'Autorize o contato para continuar.']]
  ]);
  function clearFieldError(field) {
    const [id] = errors.get(field.id);
    $('#' + id).textContent = '';
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  }
  function validField(field) {
    let valid = field.checkValidity();
    if (field.type === 'text') valid = valid && field.value.trim().length >= (field.id === 'lead-name' ? 2 : 1);
    if (!valid) {
      const [id, message] = errors.get(field.id);
      $('#' + id).textContent = message;
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', id);
    } else clearFieldError(field);
    return valid;
  }
  fields.forEach((field) => {
    field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validField(field); });
    field.addEventListener('change', () => { if (field.getAttribute('aria-invalid') === 'true') validField(field); });
  });
  function feedback(title, message, type = '') {
    const target = $('#form-feedback');
    target.className = 'form-feedback' + (type ? ' ' + type : '');
    const strong = document.createElement('strong'); strong.textContent = title;
    const paragraph = document.createElement('p'); paragraph.textContent = message;
    target.replaceChildren(strong, paragraph);
    target.hidden = false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#form-feedback').hidden = true;
    if ($('#lead-site').value) return;
    const invalid = fields.filter((field) => !validField(field));
    if (invalid.length) { invalid[0].focus(); return; }
    if (prototypeMode) {
      feedback('Solicitação validada no protótipo.', 'O fluxo está pronto para conectar ao seu atendimento. Nenhum dado foi enviado ou armazenado. Para receber contatos reais, configure o serviço de envio e a política de privacidade.');
      return;
    }
    if (!safePolicyUrl()) {
      feedback('Canal de contato em configuração.', 'Não foi possível enviar. A política de privacidade precisa estar configurada antes de receber contatos.', 'error');
      return;
    }
    let endpoint;
    try {
      endpoint = new URL(config.contactEndpoint, window.location.href);
      if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) throw new Error('Unsupported transport');
    } catch {
      feedback('Canal de contato em configuração.', 'O endereço de recebimento ainda não foi configurado corretamente. Seus dados não foram enviados.', 'error');
      return;
    }
    const submit = $('.form-submit');
    const label = $('span', submit);
    submit.disabled = true; label.textContent = 'Enviando solicitação…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || 15000);
    const payload = {
      nome: $('#lead-name').value.trim(),
      empresa: $('#lead-company').value.trim(),
      email: $('#lead-email').value.trim(),
      interesse: $('#lead-product').value,
      mensagem: $('#lead-message').value.trim(),
      contato_autorizado: $('#lead-consent').checked,
      origem: 'landing-veriia'
    };
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(payload), signal: controller.signal
      });
      if (!response.ok) throw new Error('Server did not accept submission');
      const result = await response.json();
      if (result.success !== true) throw new Error('Missing success acknowledgment');
      form.reset();
      fields.forEach(clearFieldError);
      feedback('Solicitação recebida.', 'Obrigado pelo interesse na Veriia. Sua solicitação foi encaminhada para o atendimento.', 'success');
    } catch (error) {
      feedback('Não foi possível confirmar o envio.', error.name === 'AbortError' ? 'A confirmação demorou mais que o esperado. Aguarde um momento antes de tentar novamente.' : 'Não recebemos uma confirmação do serviço. Tente novamente mais tarde.', 'error');
    } finally {
      clearTimeout(timer);
      submit.disabled = false;
      label.textContent = 'Solicitar demonstração';
      form.removeAttribute('aria-busy');
    }
  });

  // A sticky header is not a reliable native scroll target: explicitly return to top.
  $$('a[href="#topo"]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    setMenu(false);
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }));

  // Stable deep links for shared product views.
  function readProductHash() {
    const product = window.location.hash.slice(1).toLowerCase();
    if (!['guardiao'].includes(product)) return;
    selectProduct(product);
    requestAnimationFrame(() => $('#solucoes').scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  window.addEventListener('hashchange', readProductHash);
  readProductHash();
  $('#current-year').textContent = String(new Date().getFullYear());
})();
