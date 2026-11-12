import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos, SITE } from './_zap.mjs';
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

// Pix manual sem comprovante: quem escreve "já comprei/já paguei" no WhatsApp tem o pedido de música
// pendente MAIS RECENTE (desse número, últimas 72 h) liberado — aí a música sai no envio normal abaixo.
async function liberarPixManualDoNumero(tel) {
  try {
    const ent = await idsDoTel(tel, await lerIndice());
    const pres = getStore('presentes');
    for (const id of ((ent && ent.p) || []).slice(-15).reverse()) {
      const g = await pres.get(id, { type: 'json' }).catch(() => null);
      if (g && !g.pago && !g.cancelado && g.produto !== 'livro' && g.pagamento && g.pagamento.provedor === 'manual' &&
          Date.now() - (g.pagamento.manualEm || g.criadoEm || 0) < 72 * 3600e3) {
        await liberarSemComprovante(id, 'ja-paguei-whatsapp');
        return id;
      }
    }
  } catch (e) { console.error('liberar pix manual (whatsapp):', e && e.message); }
  return null;
}


// ✅ "Já paguei" no WhatsApp: libera o pedido do Pix manual mais recente do número e manda as músicas COMPLETAS (só áudio)
async function confirmarPagamentoZap(de) {
  try {
    const ent = await idsDoTel(de, await lerIndice());
    const pres = getStore('presentes');
    for (const id of ((ent && ent.p) || []).slice(-15).reverse()) {
      let g = await pres.get(id, { type: 'json' }).catch(() => null);
      if (!g || g.cancelado || g.produto === 'livro' || !temMusica(g)) continue;
      if (Date.now() - (g.criadoEm || 0) > 72 * 3600e3) continue;
      if (!g.pago && g.pagamento && g.pagamento.provedor === 'manual') g = (await liberarSemComprovante(id, 'ja-paguei-whatsapp')) || g;
      if (!g.pago) { await enviarTexto(de, '⏳ Ainda não consegui confirmar o seu pagamento. Se você já pagou, aguarde 1 minutinho e toque em *Já paguei* de novo. 💗'); return; }
      await getStore('whatsapp').setJSON('pago_' + id, { em: Date.now(), para: de, via: 'ja-paguei-whatsapp' }).catch(() => {});
      await enviarTexto(de, '✅ *Pagamento confirmado!* Aqui estão suas músicas completas 🎶💗');
      await entregarAudiosPagos(de, g, false);
      await registrar('pago_enviado', { para: de, pedido: id, via: 'ja-paguei-whatsapp' });
      return;
    }
  } catch (e) { console.error('confirmar pagamento zap:', e && e.message); }
  await enviarTexto(de, 'Não achei um Pix gerado neste número 🤔\n\nPra comprar: toque no link da sua prévia, gere o Pix e pague. Depois volte aqui e toque em *Já paguei*. 💗');
}
async function procurar(de) {
  await enviarTexto(de, '🔎 Procurando seus pedidos...');
  await liberarPixManualDoNumero(de);
  if (await mandarTudoDoNumero(de, de)) return;
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
  if (id === 'pg:conf') { await limpar(de); await confirmarPagamentoZap(de); return true; }
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
  if (/j[aá] (comprei|paguei)|^paguei|fiz o pix|fiz o pagamento|confirmar pagamento/.test(baixo)) { await confirmarPagamentoZap(de); return true; }
  if (/(minha|receber|cad[eê]|enviar?|mandar?|n[aã]o (chegou|recebi)).{0,25}m[uú]sica|j[aá] (comprei|paguei)|^paguei|fiz o pix|fiz o pagamento/.test(baixo)) { await procurar(de); return true; }
  if (/(meu|minha|receber|cad[eê]|enviar?|mandar?|n[aã]o (chegou|recebi)).{0,25}(livro|hist[oó]ria|pdf)/.test(baixo)) { await procurar(de); return true; }
  if (/\b(livro|livrinho|hist[oó]ria|historinha)\b/.test(baixo)) { await mandarLinkLivro(de); return true; }
  if (/\b(criar|cria|fazer|faz|quero|gerar|comprar)\b.{0,25}\bm[uú]sica\b|^criar$/.test(baixo)) { await mandarLinkCriar(de); return true; }
  if (/promo[cç][aã]o|promo[cç][oõ]es|desconto|indica/.test(baixo)) {
    const pr = await loja().get('promo_' + chaveNum(de), { type: 'json' }).catch(() => null);
    if (pr) { await mandarPromocoes(de); return true; }
  }
  return false; // o webhook responde com o menu
}
