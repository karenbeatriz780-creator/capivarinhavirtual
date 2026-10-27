import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos, SITE } from './_zap.mjs';
import { lerIndice, idsDoTel } from './_indice.mjs';

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

export async function boasVindas(para) {
  return enviarBotoes(para,
    'Oi! 💗 Seja bem-vindo(a) à *Capivarinha Love*!\n\nComo podemos te ajudar?',
    [['ini:minha', '🎶 Receber minha música'], ['ini:criar', '🎵 Criar uma música']]);
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
  const pagos = peds.filter((g) => g.pago && !g.cancelado && temMusica(g)).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0)).slice(0, 2);
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

async function procurar(de) {
  await enviarTexto(de, '🔎 Procurando suas músicas...');
  if (await mandarMusicasDoNumero(de, de)) return;
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
  if (id === 'ini:minha') { await limpar(de); await procurar(de); return true; }
  if (id === 'ini:criar' || id === 'ini:zap') { await limpar(de); await mandarLinkCriar(de); return true; }
  if (id) return true; // botão antigo/desconhecido: ignora

  // esperando o número do pedido
  if (c && c.etapa === 'tel') {
    if (/^(cancelar|sair|parar)$/.test(baixo)) { await limpar(de); await enviarTexto(de, 'Tudo bem 😊 Qualquer coisa é só chamar.'); return true; }
    const dig = texto.replace(/\D/g, '');
    if (dig.length < 10) { await enviarTexto(de, 'Me manda o número com DDD, por favor (ex: 91 98888-7777) 😊'); return true; }
    await enviarTexto(de, '🔎 Procurando...');
    if (await mandarMusicasDoNumero(de, dig)) { await limpar(de); return true; }
    c.d.tentativas = (c.d.tentativas || 0) + 1; await salvar(de, c);
    if (c.d.tentativas >= 2) {
      await limpar(de);
      await enviarBotoes(de, 'Não encontrei nenhum pedido nesse número 😕 Pode ser que o pedido tenha sido feito com outro número.',
        [['ini:minha', '🔎 Tentar outro número'], ['ini:criar', '🎵 Criar uma música']]);
    } else await enviarTexto(de, 'Não achei nada nesse número 🤔 Confere e me manda de novo (com DDD).');
    return true;
  }

  // texto livre: entende os pedidos mais comuns
  if (/(minha|receber|cad[eê]|enviar?|mandar?|n[aã]o (chegou|recebi)).{0,25}m[uú]sica|j[aá] (comprei|paguei)|^paguei|fiz o pix|fiz o pagamento/.test(baixo)) { await procurar(de); return true; }
  if (/\b(criar|cria|fazer|faz|quero|gerar|comprar)\b.{0,25}\bm[uú]sica\b|^criar$/.test(baixo)) { await mandarLinkCriar(de); return true; }
  if (/promo[cç][aã]o|promo[cç][oõ]es|desconto|indica/.test(baixo)) {
    const pr = await loja().get('promo_' + chaveNum(de), { type: 'json' }).catch(() => null);
    if (pr) { await mandarPromocoes(de); return true; }
  }
  return false; // o webhook responde com o menu
}
