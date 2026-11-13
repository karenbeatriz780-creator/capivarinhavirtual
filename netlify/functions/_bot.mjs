import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos, SITE, entregarPedidoPagoZap } from './_zap.mjs';
import { lerIndice, idsDoTel } from './_indice.mjs';
import { entregarLivroZap } from './_livros.mjs';
import { liberarSemComprovante } from './_comprovante.mjs';

// ROBÔ DE ATENDIMENTO (não cria música):
// - "Oi" → "Como podemos te ajudar?" [Receber minha música] [Criar uma música]
// - Receber minha música → procura pelo número de quem mandou; se não achar, pede o número do pedido
// - Criar uma música → manda o link do site
// - Promoções: oferecidas depois que a música paga é entregue (ver _zap.mjs → entregarAudiosPagos)

const H2 = 2 * 3600 * 1000;
const loja = () => getStore('whatsapp');
const chaveConv = (n) => 'bot_' + chaveNum(n);
const salvar = async (n, c) => { c.em = Date.now(); await loja().setJSON(chaveConv(n), c); };
const limpar = async (n) => { await loja().delete(chaveConv(n)).catch(() => {}); };
const LINK_CRIAR = SITE + '/#/criar/musica';

const LINK_LIVRO = SITE + '/#/livro';

export async function boasVindas(para) {
  return enviarBotoes(para,
    'Oi! 💗 Seja bem-vindo(a) à *Capivarinha Love*!\n\nO que você procura?\n\n' +
    '🎵 *Música personalizada*: com o nome e a história de quem você ama\n' +
    '📖 *Livro Mágico*: um livro ilustrado com o rostinho do seu filho + 2 músicas com o nome dele\n' +
    '✅ *Já comprei*: receber o que você comprou',
    [['ini:musica', '🎵 Música'], ['ini:livro', '📖 Livro Mágico'], ['ini:minha', '✅ Já comprei']]);
}

async function mandarLinkLivro(para) {
  await enviarTexto(para, '📖✨ O *Livro Mágico* é um livro ilustrado em que seu filho é o protagonista: o rostinho dele nas ilustrações, o nome em toda a história e *2 músicas* cantando o nome dele.\n\n' +
    'Você escolhe a aventura, manda uma foto e já vê a *capa e a música antes de pagar*:\n\n' + LINK_LIVRO +
    '\n\n💡 Quando a prévia ficar pronta, toque em *"Receber no WhatsApp"* que eu te mando aqui. 💛');
  await registrar('pediu_livro', { numero: para });
}

// Livros do número: pronto e pago → link + PDFs; pago fazendo → avisa; prévia → link da prévia
async function mandarLivrosDoNumero(para, tel, ent) {
  const presentes = getStore('presentes');
  const ids = (ent.p || []).filter((id) => /^L[0-9a-f]{14}$/.test(id)).slice(-10);
  const gs = (await Promise.all(ids.map((id) => presentes.get(id, { type: 'json' }).catch(() => null)))).filter((g) => g && g.livro && !g.cancelado)
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  if (!gs.length) return 0;
  const pagos = gs.filter((g) => g.pago);
  if (pagos.length) {
    for (const g of pagos.slice(0, 2)) {
      if (g.livro.status === 'pronto') await entregarLivroZap(para, g);
      else await enviarTexto(para, '📖 O Livro Mágico de *' + g.livro.nome + '* está sendo ilustrado agora 🎨\nAssim que ficar pronto eu te mando aqui, com os PDFs pra imprimir. 💛');
    }
    await registrar('reenviou', { para, tel: String(tel), livros: pagos.slice(0, 2).map((g) => g.id).join(',') });
    return pagos.length;
  }
  const g = gs[0];
  await enviarTexto(para, '📖 Achei a prévia do Livro Mágico de *' + g.livro.nome + '*! Lá você vê a capa, ouve a música e desbloqueia a história completa:\n' + SITE + '/#/livro/' + g.id + '.' + g.livro.token);
  return 1;
}

async function mandarLinkCriar(para) {
  await enviarTexto(para, '🎵 Que legal! Você cria a música pelo nosso site, é rapidinho e você *ouve a prévia antes de pagar*:\n\n' + LINK_CRIAR +
    '\n\n💡 Quando a prévia ficar pronta, toque em *"Receber no WhatsApp"* que eu te mando ela aqui. 💗');
  await registrar('pediu_criar', { numero: para });
}

// Procura as músicas de um número e manda pro cliente. Volta quantas achou.
async function mandarMusicasDoNumero(para, tel) {
  let ent = { p: [], t: [] };
  try { ent = await idsDoTel(tel, await lerIndice()); } catch (e) {}
  const presentes = getStore('presentes');
  const peds = (await Promise.all(ent.p.slice(-15).map((id) => presentes.get(id, { type: 'json' }).catch(() => null)))).filter(Boolean);
  const pagos = peds.filter((g) => g.pago && !g.cancelado && g.produto !== 'livro' && temMusica(g)).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0)).slice(0, 2);
  if (pagos.length) {
    for (const g of pagos) {
      const quando = new Date(g.pagoEm || g.criadoEm || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
      await enviarTexto(para, '🎶 Achei! Música' + (g.musicaParaNome ? ' pra *' + g.musicaParaNome + '*' : '') + ' (paga em ' + quando + '):\n' + linkPedido(g));
      await entregarAudiosPagos(para, g, false);
    }
    await registrar('reenviou', { para, tel: String(tel), pedidos: pagos.map((g) => g.id).join(',') });
    return pagos.length;
  }
  // não pagou ainda: manda a prévia mais recente
  const musicas = getStore('musicas');
  const ms = (await Promise.all(ent.t.slice(-10).map(async (t) => { const m = await musicas.get(t, { type: 'json' }).catch(() => null); return m && m.url ? Object.assign({ t }, m) : null; }))).filter(Boolean)
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  if (ms.length) {
    const m = ms[0];
    await enviarTexto(para, '🎵 Achei a sua prévia' + (m.nomes ? ' pra *' + m.nomes + '*' : '') + '! Pra liberar a música completa, é só finalizar o pagamento:\n' + SITE + '/#/ouvir/t.' + m.t +
      '\n\nAssim que o pagamento cair, eu te mando a música completa aqui. 💗');
    await registrar('reenviou', { para, tel: String(tel), previa: m.t });
    if (!(await loja().get('recfeito_' + m.t, { type: 'json' }).catch(() => null)) && !(await loja().get('rec_' + m.t, { type: 'json' }).catch(() => null)))
      await loja().setJSON('rec_' + m.t, { taskId: m.t, numero: para, em: Date.now() });
    return 1;
  }
  return 0;
}

// procura músicas E livros do número
async function mandarTudoDoNumero(para, tel) {
  let ent = { p: [], t: [] };
  try { ent = await idsDoTel(tel, await lerIndice()); } catch (e) {}
  const nl = await mandarLivrosDoNumero(para, tel, ent).catch((e) => { console.error('bot livros', e && e.message); return 0; });
  const nm = await mandarMusicasDoNumero(para, tel);
  return nl + nm;
}



// pedidos do número, do MAIS NOVO pro mais velho (só últimas 72 h)
async function pedidosRecentes(tel) {
  const ent = await idsDoTel(tel, await lerIndice()).catch(() => null);
  const ids = [...new Set(((ent && ent.p) || []))].slice(-40), pres = getStore('presentes');
  const gs = (await Promise.all(ids.map((id) => pres.get(id, { type: 'json' }).catch(() => null)))).filter(Boolean);
  return gs.filter((g) => Date.now() - (g.criadoEm || 0) < 72 * 3600e3).sort((a, b) => (b.pagoEm || b.criadoEm || 0) - (a.pagoEm || a.criadoEm || 0));
}

// Pix manual pendente (gerado e não liberado) do número, últimas 72 h
async function pixManualPendente(tel) {
  try {
    for (const g of await pedidosRecentes(tel)) {
      if (g && !g.pago && !g.cancelado && g.produto !== 'livro' && g.pagamento && g.pagamento.provedor === 'manual' && Date.now() - (g.pagamento.manualEm || g.criadoEm || 0) < 72 * 3600e3) return g;
    }
  } catch (e) {}
  return null;
}
// passo a passo: pergunta se já pagou → "Sim, já paguei" confirma e envia
async function perguntarSePagou(de) {
  await enviarBotoes(de, '💳 Você já fez o *pagamento do Pix* da sua música?', [['pg:conf', '✅ Sim, já paguei'], ['pg:nao', '⏳ Ainda não']]);
}

// 🤖 IA (Kie): entende o que a pessoa quer quando o texto não é óbvio → pagou | criar | livro | outro
async function intencaoIA(texto) {
  const ch = (process.env.KIE_API_KEY || '').trim();
  if (!ch || texto.length < 4) return 'outro';
  const prompt = 'Classifique a mensagem de um cliente de uma loja de músicas personalizadas no WhatsApp. Responda SÓ uma palavra:\n' +
    'pagou = diz que já pagou/fez o Pix/comprou e quer receber a música, ou reclama que pagou e não recebeu\n' +
    'criar = quer criar/comprar uma música nova ou saber preço\nlivro = quer o livro infantil\noutro = qualquer outra coisa\n\nMensagem: "' + texto.slice(0, 400) + '"';
  for (const m of ['gemini-3-8-flash-openai']) {
    try {
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 4500);
      const r = await fetch('https://api.kie.ai/' + m + '/v1/chat/completions', { method: 'POST', signal: ac.signal,
        headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: false, reasoning_effort: 'low' }) });
      clearTimeout(to);
      const j = await r.json().catch(() => null);
      const t = String((j && (((j.choices || [])[0] || {}).message || {}).content) || '').toLowerCase();
      const k = (/\b(pagou|criar|livro|outro)\b/.exec(t) || [])[1];
      if (k) return k;
    } catch (e) {}
  }
  return 'outro';
}
const PRINT = (n) => 'printpend_' + chaveNum(n);
// liberados sem conferência (texto/botão/2 toques) desse número nos últimos 7 dias
async function liberadosSemConferencia(gs) {
  return gs.filter((g) => g.pago && g.pagamento && g.pagamento.provedor === 'manual' && !g.pagamento.e2eid && Date.now() - (g.pagoEm || 0) < 7 * 864e5).length;
}
// 💬 a pessoa ESCREVEU que pagou: já pago → envia · Pix gerado e confiável → libera e envia · desconfiou → pede o print
export async function pagouTexto(de) {
  const gs = (await pedidosRecentes(de)).filter((g) => !g.cancelado && g.produto !== 'livro' && temMusica(g));
  // pago e AINDA NÃO entregue → entrega (pedido antigo já entregue nunca é reenviado)
  let pago = null;
  for (const g of gs) if (g.pago && !(await getStore('whatsapp').get('pago_' + g.id, { type: 'json' }).catch(() => null))) { pago = g; break; }
  const pend = gs.find((g) => !g.pago && g.pagamento && g.pagamento.provedor === 'manual');
  if (pago && (!pend || (pago.pagoEm || 0) > (pend.criadoEm || 0))) {
    await enviarTexto(de, '💗 Achei! Seu pagamento já está confirmado. Mandando suas músicas completas agora 🎶');
    await entregarPedidoPagoZap(pago);
    return;
  }
  // escreveu "já paguei" e não está pago: NUNCA libera pelo texto → manda o link pra gerar o Pix / tocar em "Já paguei" no site
  await enviarTexto(de, msgPagouTexto(await linkDaPessoa(de)));
}

// ✅ "Já paguei" no WhatsApp: NÃO libera nada. Só ENTREGA se a pessoa já confirmou no site (2 toques em "Já paguei").
// link da pessoa pra gerar o Pix: a prévia dela (ou o pedido em aberto)
export async function linkDaPessoa(de, t) {
  if (t) return SITE + '/#/ouvir/t.' + t;
  try {
    const gs = (await pedidosRecentes(de)).filter((g) => !g.pago && !g.cancelado && g.produto !== 'livro' && temMusica(g));
    if (gs.length) return SITE + '/#/p/' + gs[0].id;
    const ent = await idsDoTel(de, await lerIndice()).catch(() => null);
    const ts = [...new Set((ent && ent.t) || [])].slice(-15);
    const ms = (await Promise.all(ts.map(async (x) => { const m = await getStore('musicas').get(x, { type: 'json' }).catch(() => null); return m && m.url && !m.pago ? { x, em: m.criadoEm || m.em || 0 } : null; }))).filter(Boolean);
    ms.sort((a, b) => b.em - a.em);
    if (ms.length) return SITE + '/#/ouvir/t.' + ms[0].x;
  } catch (e) {}
  return SITE;
}
export const msgSemPix = (link) => '😕 Não achei um Pix gerado neste número.\n\nToque no link, *gere o Pix* e pague:\n' + link + '\n\nSe já pagou, toque em *"Já paguei"* (ao lado de *"Copiar código Pix"*). 💗';
// escreveu "já paguei": duas formas — o botão no site OU mandar o comprovante aqui
const msgPagouTexto = (link) => '💗 Pra liberar sua música, escolha uma das formas:\n\n1️⃣ Abra o link, e se ainda não pagou, *gere o Pix* e pague. Depois toque em *"Já paguei"* (ao lado de *"Copiar código Pix"*):\n' + link + '\n\n2️⃣ Ou me manda aqui o *print ou PDF do comprovante* do Pix que eu confiro na hora. 🧾';
// pedidos ligados a UMA música (o botão "Já paguei" da prévia vem com o código dela)
async function pedidosDaMusica(de, t) {
  const m = await getStore('musicas').get(t, { type: 'json' }).catch(() => null);
  const usa = (g) => g && (g.musicaPreviewId === t || (g.ofertaM1 && g.ofertaM1.id === t) || (g.ofertaM2 && g.ofertaM2.id === t) || (m && (g.id === m.presenteId || g.id === m.pedidoRecId)));
  const lista = (await pedidosRecentes(de)).filter(usa);
  for (const x of [m && m.presenteId, m && m.pedidoRecId].filter(Boolean)) {
    if (!lista.some((g) => g.id === x)) { const g = await getStore('presentes').get(x, { type: 'json' }).catch(() => null); if (g && usa(g)) lista.push(g); }
  }
  return lista.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}
// botão "Já paguei" (WhatsApp). Regra:
// · pedido desta música já pago e AINDA NÃO entregue → entrega
// · Pix gerado e não pago → 1º toque "processando, toque de novo"; 2º toque libera e entrega
// · não gerou o Pix → "Ops, não identificamos… gere o Pix pelo link"
// (nunca reenvia música de pedido antigo já entregue)
async function confirmarPagamentoZap(de, botao, t) {
  let gerou = false, pend = null;
  try {
    const lista = t ? await pedidosDaMusica(de, t) : await pedidosRecentes(de);
    for (const g of lista) {
      if (!g || g.cancelado || g.produto === 'livro' || !temMusica(g)) continue;
      if (!g.pago) {
        if (g.pagamento && g.pagamento.provedor) gerou = true;
        if (!pend && g.pagamento && g.pagamento.provedor === 'manual' && Date.now() - (g.pagamento.manualEm || g.criadoEm || 0) < 72 * 3600e3) pend = g;
        continue;
      }
      const ja = await loja().get('pago_' + g.id, { type: 'json' }).catch(() => null);
      if (ja) continue; // já foi entregue antes → não manda de novo por esse botão
      await getStore('whatsapp').setJSON('pago_' + g.id, { em: Date.now(), para: de, via: 'ja-paguei-whatsapp' }).catch(() => {});
      await enviarTexto(de, '✅ *Pagamento confirmado!* Suas músicas completas, sem corte, pra ouvir e baixar:\n' + linkPedido(g) + ' 🎶💗');
      await registrar('pago_enviado', { para: de, pedido: g.id, via: 'ja-paguei-whatsapp' });
      return;
    }
  } catch (e) { console.error('confirmar pagamento zap:', e && e.message); }
  // 2 toques no botão "Já paguei" → libera (sem tempo mínimo), só se o Pix foi gerado
  if (botao && pend) {
    try {
      const k = 'jpz_' + chaveNum(de), st = await loja().get(k, { type: 'json' }).catch(() => null);
      const bt = t ? [['pg:perg:' + t, '✅ Já paguei']] : [['pg:perg', '✅ Já paguei']];
      if (!st || st.id !== pend.id || Date.now() - (st.em || 0) > 6 * 3600e3) {
        await loja().setJSON(k, { id: pend.id, em: Date.now() });
        await enviarBotoes(de, '⏳ *Processando o seu pagamento…*\n\nAinda não identificamos. Toque em *"Já paguei"* de novo pra confirmar. 💗', bt);
        return;
      }
      await loja().delete(k).catch(() => {});
      const g2 = await liberarSemComprovante(pend.id, 'ja-paguei-whatsapp-2toques');
      if (g2 && g2.pago) { await enviarTexto(de, '✅ *Pagamento confirmado!* Mandando suas músicas completas agora 🎶💗'); await entregarPedidoPagoZap(g2); return; }
    } catch (e) { console.error('ja paguei zap 2 toques:', e && e.message); }
  }
  await enviarTexto(de, gerou
    ? '😕 *Ops, ainda não identificamos o seu pagamento.*\n\nSe você já pagou, volte na página do Pix e toque em *"Já paguei"* pra confirmar. Assim que confirmar, a música chega aqui. 💗'
    : msgSemPix(await linkDaPessoa(de, t)));
}
async function procurar(de) {
  await enviarTexto(de, '🔎 Procurando seus pedidos...');
  const pend = await pixManualPendente(de);
  const achou = await mandarTudoDoNumero(de, de);
  if (pend && !achou) { await confirmarPagamentoZap(de); return; }
  if (achou) return;
  await salvar(de, { etapa: 'tel', d: { tentativas: 0 } });
  await enviarTexto(de, 'Não achei pedidos neste número 🤔\n\nQual o *número de WhatsApp que você usou no pedido*? (com DDD, ex: 91 98888-7777)');
}

// Promoções (só pra quem já comprou — o botão só é enviado depois da entrega da música paga)
async function mandarPromocoes(de) {
  const pr = await loja().get('promo_' + chaveNum(de), { type: 'json' }).catch(() => null);
  const pedido = pr && pr.pedido;
  const linkInd = pedido ? SITE + '/#/criar/musica/r.' + encodeURIComponent(pedido) : '';
  await enviarTexto(de, '🎁 *Promoções pra clientes Capivarinha Love:*\n\n' +
    '1️⃣ *4 músicas por R$ 9,99*\nCrie outra música pra quem você ama:\n' + LINK_CRIAR +
    (linkInd ? '\n\n2️⃣ *Ganhe 2 músicas GRÁTIS*\nIndique um amigo com o seu link. Quando ele comprar, você ganha *2 músicas personalizadas* de graça:\n' + linkInd +
      '\n\n👇 É só encaminhar a próxima mensagem pro seu amigo:' : ''));
  if (linkInd) await enviarTexto(de, 'Olha que presente lindo 😍 Uma música personalizada com o nome e a história de quem você ama 🎵\n\n4 músicas por R$ 9,99 e você ouve a prévia antes de pagar:\n' + linkInd);
  await registrar('promo_sim', { numero: de, pedido: pedido || '' });
}

// Volta true se o robô cuidou da mensagem
export async function tratarBot(msg) {
  const de = String(msg.from);
  const ir = msg.interactive && (msg.interactive.button_reply || msg.interactive.list_reply);
  const id = (ir && ir.id) || '';
  const texto = String((msg.text && msg.text.body) || (ir && ir.title) || '').trim();
  const baixo = texto.toLowerCase();

  let c = await loja().get(chaveConv(de), { type: 'json' }).catch(() => null);
  if (c && Date.now() - (c.em || 0) > H2) { await limpar(de); c = null; }

  // botões
  if (id === 'promo:sim') { await mandarPromocoes(de); return true; }
  if (id === 'promo:nao') { await enviarTexto(de, 'Tudo bem! 💗 Aproveite sua música. Qualquer coisa é só chamar.'); await registrar('promo_nao', { numero: de }); return true; }
  if (id === 'pg:conf') { await limpar(de); await confirmarPagamentoZap(de, true); return true; }
  if (id === 'pg:perg') { await limpar(de); await confirmarPagamentoZap(de, true); return true; } // botão Já paguei: 2 toques libera
  if (id.startsWith('pg:perg:')) { await limpar(de); await confirmarPagamentoZap(de, true, id.slice(8)); return true; } // botão da prévia (ligado à música)
  if (id === 'pg:txt') { await limpar(de); await pagouTexto(de); return true; }
  if (id === 'ini:humano') { await limpar(de); await loja().setJSON('humano_' + chaveNum(de), { em: Date.now() }).catch(() => {}); await enviarTexto(de, '💬 Certo! Um atendente vai te responder por aqui assim que possível. Pode deixar sua mensagem 💗'); try { const { avisar } = await import('./_meta.mjs'); await avisar('💬 Cliente pediu atendente no WhatsApp: ' + de); } catch (e) {} return true; }
  if (id === 'pg:nao') { await limpar(de); await enviarTexto(de, 'Tudo bem! 💗 Pra pagar, toque no link da sua prévia e gere o Pix. Depois é só voltar aqui e me dizer que já pagou.'); return true; }
  if (id === 'ini:minha') { await limpar(de); await procurar(de); return true; }
  if (id === 'ini:criar' || id === 'ini:zap' || id === 'ini:musica') { await limpar(de); await mandarLinkCriar(de); return true; }
  if (id === 'ini:livro') { await limpar(de); await mandarLinkLivro(de); return true; }
  if (id) return true; // botão antigo/desconhecido: ignora

  // esperando o número do pedido
  if (c && c.etapa === 'tel') {
    if (/^(cancelar|sair|parar)$/.test(baixo)) { await limpar(de); await enviarTexto(de, 'Tudo bem 😊 Qualquer coisa é só chamar.'); return true; }
    const dig = texto.replace(/\D/g, '');
    if (dig.length < 10) { await enviarTexto(de, 'Me manda o número com DDD, por favor (ex: 91 98888-7777) 😊'); return true; }
    await enviarTexto(de, '🔎 Procurando...');
    if (await mandarTudoDoNumero(de, dig)) { await limpar(de); return true; }
    c.d.tentativas = (c.d.tentativas || 0) + 1; await salvar(de, c);
    if (c.d.tentativas >= 2) {
      await limpar(de);
      await enviarBotoes(de, 'Não encontrei nenhum pedido nesse número 😕 Pode ser que o pedido tenha sido feito com outro número.',
        [['ini:minha', '🔎 Tentar outro número'], ['ini:musica', '🎵 Criar uma música'], ['ini:livro', '📖 Livro Mágico']]);
    } else await enviarTexto(de, 'Não achei nada nesse número 🤔 Confere e me manda de novo (com DDD).');
    return true;
  }

  // texto livre: entende os pedidos mais comuns
  const sa = baixo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/(ja|eu) (paguei|pague|paguei ja|comprei|fiz o pix|fiz o pagamento|transferi|mandei o pix)|\bpaguei\b|\bpago\b|fiz (o )?pix|fiz (o )?pagamento|nao (recebi|chegou|veio|enviou|enviaram|mandou|mandaram|liberou|apareceu)|recebi nao|cade|cad[eê]|ainda nada|nada ainda|demorando|ta demorando|nao recebi|minha musica|a musica (nao|ainda)|enviar (a|minha) musica|mandar (a|minha) musica|(problema|erro|ajuda|duvida).{0,30}(pagamento|pix|compra|musica)|comprovante|pix (feito|pago|enviado)|(mandei|enviei|fiz|paguei) (o )?pix|transferi|ja fiz a musica|vcs nao|voces nao/.test(sa)) { await pagouTexto(de); return true; }
  if (/(minha|receber|cad[eê]|enviar?|mandar?|n[aã]o (chegou|recebi)).{0,25}m[uú]sica|j[aá] (comprei|paguei)|^paguei|fiz o pix|fiz o pagamento/.test(baixo)) { await procurar(de); return true; }
  if (/(meu|minha|receber|cad[eê]|enviar?|mandar?|n[aã]o (chegou|recebi)).{0,25}(livro|hist[oó]ria|pdf)/.test(baixo)) { await procurar(de); return true; }
  if (/\b(livro|livrinho|hist[oó]ria|historinha)\b/.test(baixo)) { await mandarLinkLivro(de); return true; }
  if (/\b(criar|cria|fazer|faz|quero|gerar|comprar)\b.{0,25}\bm[uú]sica\b|^criar$/.test(baixo)) { await mandarLinkCriar(de); return true; }
  if (/promo[cç][aã]o|promo[cç][oõ]es|desconto|indica/.test(baixo)) {
    const pr = await loja().get('promo_' + chaveNum(de), { type: 'json' }).catch(() => null);
    if (pr) { await mandarPromocoes(de); return true; }
  }
  // não entendeu pelas palavras: a IA (Kie) classifica e manda a coisa certa
  if (texto.length >= 6 && !/^(oi+|ol[aá]|bom dia|boa tarde|boa noite|eai|e a[ií])[!. ]*$/.test(baixo)) {
    const k = await intencaoIA(texto);
    if (k === 'pagou') { await pagouTexto(de); return true; }
    if (k === 'criar') { await mandarLinkCriar(de); return true; }
    if (k === 'livro') { await mandarLinkLivro(de); return true; }
    // não entendeu, mas o número tem pedido recente → pergunta o que precisa (não deixa sem resposta)
    const recentes = await pedidosRecentes(de).catch(() => []);
    if (recentes.length) {
      await enviarBotoes(de, 'Oi! 💗 Me conta como posso te ajudar:', [['pg:txt', '✅ Já paguei'], ['ini:musica', '🎵 Criar música'], ['ini:humano', '💬 Falar c/ atendente']]);
      return true;
    }
  }
  return false; // o webhook responde com o menu
}
