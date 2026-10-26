import { getStore } from '@netlify/blobs';

// Funções do WhatsApp usadas pelo webhook e pelo aviso automático.
export const VERSAO = 'v25.0';
export const SITE = 'https://capivarinhalove.com.br';
const H23 = 23 * 3600 * 1000; // janela grátis da Meta é 24 h — usamos 23 h por segurança

// Mesmo número escrito de jeitos diferentes (com/sem 55, com/sem o 9) → mesma chave: DDD + 8 últimos
export function chaveNum(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return '';
  return d.slice(0, 2) + d.slice(-8);
}

// Registro pro painel (aba 🤖 WhatsApp)
export async function registrar(tipo, dados) {
  try { await getStore('whatsapp').setJSON('ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), Object.assign({ t: tipo, em: Date.now() }, dados || {})); } catch (e) {}
}

async function chamar(corpo) {
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  const phoneId = (process.env.WHATSAPP_PHONE_ID || '').trim();
  if (!token || !phoneId) { console.log('whatsapp: falta WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID'); return false; }
  try {
    const r = await fetch('https://graph.facebook.com/' + VERSAO + '/' + phoneId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ messaging_product: 'whatsapp', recipient_type: 'individual' }, corpo))
    });
    if (!r.ok) {
      const erro = (await r.text()).slice(0, 400);
      console.error('whatsapp envio:', r.status, erro);
      let msg = erro; try { const j = JSON.parse(erro); msg = (j.error && (j.error.error_data && j.error.error_data.details || j.error.message)) || erro; } catch (e) {}
      await registrar('falha', { para: corpo.to, erro: 'Envio recusado pela Meta: ' + String(msg).slice(0, 200) });
      return false;
    }
    // guarda o que foi enviado pra aparecer na conversa do painel
    try {
      const resumo = corpo.type === 'text' ? corpo.text.body : corpo.type === 'interactive' ? corpo.interactive.body.text + ' [botões]' : corpo.type === 'audio' ? '[áudio]' : '[' + corpo.type + ']';
      await getStore('whatsapp').setJSON('out_' + chaveNum(corpo.to) + '_' + Date.now(), { para: String(corpo.to), txt: String(resumo).slice(0, 1000), em: Date.now() });
    } catch (e) {}
    return true;
  } catch (e) { console.error('whatsapp envio (rede):', e && e.message); await registrar('falha', { para: corpo.to, erro: 'Sem conexão com a Meta' }); return false; }
}

export const enviarTexto = (para, texto) => chamar({ to: para, type: 'text', text: { preview_url: true, body: texto } });
export const enviarAudio = (para, link) => chamar({ to: para, type: 'audio', audio: { link } });
// Botões (até 3, título até 20 letras)
export const enviarBotoes = (para, texto, botoes) => chamar({
  to: para, type: 'interactive',
  interactive: { type: 'button', body: { text: texto },
    action: { buttons: botoes.slice(0, 3).map(([id, t]) => ({ type: 'reply', reply: { id, title: t.slice(0, 20) } })) } }
});
// Lista (até 10 opções, título até 24 letras)
export const enviarLista = (para, texto, botao, linhas) => chamar({
  to: para, type: 'interactive',
  interactive: { type: 'list', body: { text: texto },
    action: { button: botao.slice(0, 20), sections: [{ title: 'Opções', rows: linhas.slice(0, 10).map(([id, t, d]) => Object.assign({ id, title: t.slice(0, 24) }, d ? { description: d.slice(0, 72) } : {})) }] } }
});

// Guarda que esse número mandou mensagem agora (abre a janela grátis de 24 h)
export async function marcarConversa(numeroZap) {
  const k = chaveNum(numeroZap); if (!k) return;
  await getStore('whatsapp').setJSON('ult_' + k, { numero: String(numeroZap), em: Date.now() }).catch(() => {});
}
export async function conversaAberta(numero) {
  const k = chaveNum(numero); if (!k) return null;
  const u = await getStore('whatsapp').get('ult_' + k, { type: 'json' }).catch(() => null);
  return u && Date.now() - (u.em || 0) < H23 ? u.numero : null;
}

// Manda o link da música UMA vez só (sem o áudio).
// Volta: 'enviado' | 'ja' | 'esperando' | 'semjanela' | 'naoachei' | 'erro'
export async function entregarMusica(taskId, numeroPedido) {
  const loja = getStore('whatsapp');
  if (await loja.get('env_' + taskId, { type: 'json' }).catch(() => null)) return 'ja';
  const m = await getStore('musicas').get(taskId, { type: 'json' }).catch(() => null);
  if (!m) return 'naoachei';
  if (!m.url) return 'esperando';
  if (m.pago) return 'ja';
  const nome = String(m.nomes || '').trim().slice(0, 60);
  const link = SITE + '/#/ouvir/t.' + taskId;
  const opt = await loja.get('optin_' + taskId, { type: 'json' }).catch(() => null);
  let para = (opt && Date.now() - (opt.em || 0) < H23 && opt.numero) ||
    await conversaAberta(numeroPedido || m.whatsapp) ||
    (opt && await conversaAberta(opt.numero));
  let ok = false, via = 'grátis';
  if (para) {
    ok = await enviarTexto(para,
      '🎶 *Sua música ficou pronta!*' + (nome ? '\nFeita pra *' + nome + '* 💗' : '') + '\n\n' +
      '▶️ Toque pra ouvir sua música:\n' + link + '\n\n' +
      'Depois do pagamento você recebe as músicas *completas*, sem corte, pra baixar e mandar pra quem você ama.\n\n' +
      'Guarde esta conversa: o link fica salvo aqui pra você voltar quando quiser. 💗');
    // só o link (sem áudio no WhatsApp, pra pessoa ouvir no site e comprar)
  } else {
    return 'semjanela'; // só manda pra quem abriu conversa (sem modelo pago)
  }
  if (!ok) return 'erro';
  await loja.setJSON('env_' + taskId, { para, em: Date.now() }).catch(() => {});
  await registrar('enviou', { para, taskId, nome, via });
  await loja.delete('bot_' + chaveNum(para)).catch(() => {}); // conversa do robô terminou
  await loja.setJSON('bv_' + String(para).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
  return 'enviado';
}

// ===== pedidos PAGOS =====
export const temMusica = (g) => !!(g.musicaPreviewUrl || (g.ofertaM1 && g.ofertaM1.url));
const versoes = (g) => [[g.musicaPreviewUrl, 1], [g.musicaPreviewUrl2, 2], [g.ofertaM1 && g.ofertaM1.url, 3], [g.ofertaM1 && g.ofertaM1.url2, 4],
  [g.ofertaM2 && g.ofertaM2.url, 5], [g.ofertaM2 && g.ofertaM2.url2, 6]].filter((x) => x[0]).map((x) => x[1]);
export const linkPedido = (g) => SITE + '/#/p/' + g.id + (g.produto === 'musica' || temMusica(g) ? '/c' : '');

// manda os áudios completos (até 6) — usado aqui e quando a pessoa responde o modelo
export async function entregarAudiosPagos(para, g, comTexto = true) {
  const vs = versoes(g);
  if (!vs.length) return false;
  if (comTexto) await enviarTexto(para, '🎧 Aqui estão suas músicas completas pra ouvir e guardar! 💗\n\nTambém ficam salvas no link:\n' + linkPedido(g));
  for (const v of vs) await enviarAudio(para, SITE + '/.netlify/functions/baixar-musica?id=' + encodeURIComponent(g.id) + '&v=' + v);
  await oferecerPromo(para, g);
  return true;
}

// Depois de entregar a música paga: pergunta se quer as promoções (1 vez por pedido)
async function oferecerPromo(para, g) {
  try {
    const loja = getStore('whatsapp'), k = 'promo_' + chaveNum(para);
    const ant = await loja.get(k, { type: 'json' }).catch(() => null);
    if (ant && ant.pedido === g.id) return;
    await loja.setJSON(k, { pedido: g.id, em: Date.now() });
    await new Promise((r) => setTimeout(r, 6000)); // deixa os áudios chegarem antes
    await enviarBotoes(para, '💗 Esperamos que você ame a sua música!\n\n🎁 Quer conhecer as *promoções* pra quem já é cliente?',
      [['promo:sim', '🎁 Quero ver!'], ['promo:nao', 'Agora não']]);
  } catch (e) {}
}

