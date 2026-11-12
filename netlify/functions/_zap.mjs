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
      const resumo = corpo.type === 'text' ? corpo.text.body : corpo.type === 'interactive' ? corpo.interactive.body.text + ' [botões]' : corpo.type === 'audio' ? '[áudio]' : corpo.type === 'image' ? '[imagem] ' + ((corpo.image && corpo.image.caption) || '') : corpo.type === 'document' ? '[PDF] ' + ((corpo.document && corpo.document.filename) || '') : corpo.type === 'template' ? '[aviso pago: música pronta] ' + corpo.template.name : '[' + corpo.type + ']';
      await getStore('whatsapp').setJSON('out_' + chaveNum(corpo.to) + '_' + Date.now(), { para: String(corpo.to), txt: String(resumo).slice(0, 1000), em: Date.now() });
    } catch (e) {}
    return true;
  } catch (e) { console.error('whatsapp envio (rede):', e && e.message); await registrar('falha', { para: corpo.to, erro: 'Sem conexão com a Meta' }); return false; }
}

export const enviarTexto = (para, texto) => chamar({ to: para, type: 'text', text: { preview_url: true, body: texto } });
export const enviarAudio = (para, link) => chamar({ to: para, type: 'audio', audio: { link } });
export const enviarDocumento = (para, link, nomeArquivo, legenda) => chamar({ to: para, type: 'document', document: legenda ? { link, filename: nomeArquivo, caption: legenda } : { link, filename: nomeArquivo } });
export const enviarImagem = (para, link, legenda) => chamar({ to: para, type: 'image', image: legenda ? { link, caption: legenda } : { link } });
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
  // recuperação: se não pagar em 1 h, o robô manda a oferta (recuperar-zap-agendado)
  await loja.setJSON('rec_' + taskId, { taskId, numero: para, em: Date.now() }).catch(() => {});
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
  if (comTexto) await enviarTexto(para, '🎧 Aqui estão suas músicas completas pra ouvir e guardar! 💗\n\nTambém ficam salvas no link:\n' + linkPedido(g) + '\n\n' + textoIndica(g));
  for (const v of vs) await enviarAudio(para, SITE + '/.netlify/functions/baixar-musica?id=' + encodeURIComponent(g.id) + '&v=' + v);
  if (ehInfantil(g)) await oferecerLivro(para, g); else await oferecerPromo(para, g);
  return true;
}

// ===== MÚSICA INFANTIL → oferece o LIVRO MÁGICO (R$ 37) =====
export const ehInfantil = (g) => /^infantil/.test(String((g && g.musicaEstilo) || '')) || (g && g.musicaPara) === 'filho';
async function capaExemploLivro() {
  try {
    const l = (await getStore('livros').get('exemplos', { type: 'json' }).catch(() => null)) || [];
    const x = l.find((e) => e.tipo === 'livro' && e.mostrar !== false) || l.find((e) => e.tipo === 'livro');
    return x ? SITE + '/.netlify/functions/livro-img?k=' + encodeURIComponent('ex/' + x.id + '/capa') + '&v=' + (x.em || 1) : null;
  } catch (e) { return null; }
}
const nomeCrianca = (g) => String((g && (g.musicaParaNome || g.parceiroNome)) || '').split(/,|\s+e\s+/)[0].trim().slice(0, 30);
// etapa 1: logo depois da música paga · etapa 2: lembrete umas 3 h depois (só com a conversa aberta)
export async function oferecerLivro(para, g, etapa) {
  try {
    const loja = getStore('whatsapp'), kp = 'lvofp_' + g.id;
    const ja = await loja.get(kp, { type: 'json' }).catch(() => null);
    const et = etapa || 1;
    if (ja && ja.etapa >= et) return;
    const nome = nomeCrianca(g), quem = nome ? '*' + nome + '*' : 'seu filho(a)', link = SITE + '/#/livro';
    if (et === 1) {
      await new Promise((r) => setTimeout(r, 6000)); // deixa os áudios chegarem antes
      const capa = await capaExemploLivro();
      const txt = '📖 E se ' + quem + ' virasse o herói de um livro?\n\n' +
        'A gente faz um *livro personalizado* com o *rostinho e o nome* ' + (nome ? 'de ' + quem : 'da criança') + ' em toda a história, pra *imprimir ou ler no celular*, + *2 músicas* novas.\n\n' +
        'Tudo por *R$ 37*. A prévia é grátis: você vê antes de pagar 👇\n' + link;
      if (capa) await enviarImagem(para, capa, '✨ Olha um livro que fizemos 👆');
      await enviarTexto(para, txt);
      await loja.setJSON('lvof_' + chaveNum(para), { para, pedido: g.id, nome, em: Date.now() }).catch(() => {});
    } else {
      await enviarTexto(para, 'Oi! Passando só pra lembrar 💛\n\nA prévia do *livro do ' + (nome || 'seu pequeno') + '* é grátis: você manda uma foto, escolhe a história e vê como fica antes de pagar.\n\n👉 ' + link);
    }
    await loja.setJSON(kp, { etapa: et, em: Date.now() });
  } catch (e) { console.error('oferecerLivro:', e && e.message); }
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


// ===== MÚSICA PAGA → WhatsApp de quem NÃO conversou com o número (modelo de UTILIDADE, ~R$ 0,08, 1 vez só) =====
// Modelo só com o aviso do pedido (sem promoção — senão a Meta reclassifica como marketing e cobra mais).
// Botões: "Ouvir minha música" (link) e "Receber os áudios aqui" (abre a conversa → áudios grátis).
export const MODELO_PAGO = 'musica_pronta_v1';
const corpoModelo = () => ({
  name: MODELO_PAGO, language: 'pt_BR', category: 'UTILITY',
  components: [
    { type: 'BODY', text: 'Olá, {{1}}! Seu pagamento foi confirmado ✅\n\nA música para {{2}} está pronta. Toque no botão abaixo para ouvir e baixar as versões completas.\n\nSe preferir receber os áudios aqui no WhatsApp, toque em "Receber os áudios aqui".',
      example: { body_text: [['Ana', 'Rafael']] } },
    { type: 'BUTTONS', buttons: [
      { type: 'URL', text: 'Ouvir minha música', url: SITE + '/m/{{1}}', example: [SITE + '/m/abc123'] },
      { type: 'QUICK_REPLY', text: 'Receber os áudios aqui' }
    ] }
  ]
});
export async function wabaId(token) {
  const env = (process.env.WHATSAPP_WABA_ID || '').trim();
  if (env) return env;
  const loja = getStore('whatsapp');
  const c = await loja.get('waba_id', { type: 'json' }).catch(() => null);
  if (c && c.id) return c.id;
  const r = await fetch('https://graph.facebook.com/' + VERSAO + '/debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(token));
  const d = await r.json().catch(() => ({}));
  const gs = (d.data && d.data.granular_scopes) || [];
  const s = gs.find((x) => x.scope === 'whatsapp_business_management') || gs.find((x) => x.scope === 'whatsapp_business_messaging');
  const id = s && s.target_ids && s.target_ids[0];
  if (id) await loja.setJSON('waba_id', { id, em: Date.now() }).catch(() => {});
  return id || null;
}
// 'APPROVED' | 'PENDING' | 'REJECTED' | 'sem' (cria) | 'erro' — confere no máximo a cada 20 min
export async function statusModeloPago(forcar) {
  const loja = getStore('whatsapp'), k = 'modelo_' + MODELO_PAGO;
  const c = await loja.get(k, { type: 'json' }).catch(() => null);
  // erro de "não achei a conta" com a variável já colocada → confere de novo na hora
  if (c && c.status === 'erro' && /não achei a conta/.test(c.motivo || '') && (process.env.WHATSAPP_WABA_ID || '').trim()) forcar = true;
  if (!forcar && c && (c.status === 'APPROVED' ? Date.now() - c.em < 6 * 3600e3 : Date.now() - c.em < 20 * 60e3)) return c.status;
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  let status = 'erro', motivo = '';
  try {
    const w = await wabaId(token);
    if (!w) throw new Error('não achei a conta do WhatsApp Business (coloque WHATSAPP_WABA_ID no Netlify)');
    const g = await (await fetch('https://graph.facebook.com/' + VERSAO + '/' + w + '/message_templates?name=' + MODELO_PAGO + '&fields=name,status,category,rejected_reason', { headers: { Authorization: 'Bearer ' + token } })).json();
    const t = (g.data || []).find((x) => x.name === MODELO_PAGO);
    if (t) { status = t.status; motivo = t.rejected_reason || ''; if (t.category && t.category !== 'UTILITY') motivo = 'a Meta mudou a categoria pra ' + t.category; }
    else if (g.error) throw new Error(g.error.message);
    else {
      const cr = await (await fetch('https://graph.facebook.com/' + VERSAO + '/' + w + '/message_templates', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(corpoModelo()) })).json();
      if (cr.error) throw new Error(cr.error.error_user_msg || cr.error.message);
      status = cr.status || 'PENDING';
      if (cr.category && cr.category !== 'UTILITY') motivo = 'a Meta mudou a categoria pra ' + cr.category;
      await registrar('modelo', { erro: 'Modelo "música pronta" enviado pra aprovação da Meta (' + status + ')' });
    }
  } catch (e) { motivo = String(e.message || e).slice(0, 200); }
  await loja.setJSON(k, { status, motivo, em: Date.now() }).catch(() => {});
  if ((status === 'erro' || status === 'REJECTED' || motivo) && (!c || c.status !== status || c.motivo !== motivo))
    await registrar('falha', { erro: 'Modelo do WhatsApp (música paga): ' + status + (motivo ? ' — ' + motivo : '') });
  return status;
}
// manda o modelo (1 vez por pedido). Volta true se a Meta aceitou.
export async function enviarModeloPago(para, g) {
  if ((await statusModeloPago()) !== 'APPROVED') return false;
  const nome = String(g.meuNome || '').trim().split(/\s+/)[0] || 'tudo bem';
  const quem = String(g.musicaParaNome || g.parceiroNome || '').split(/,|\s+e\s+/)[0].trim() || 'quem você ama';
  return chamar({ to: String(para), type: 'template', template: { name: MODELO_PAGO, language: { code: 'pt_BR' }, components: [
    { type: 'body', parameters: [{ type: 'text', text: nome.slice(0, 30) }, { type: 'text', text: quem.slice(0, 40) }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(g.id) }] },
    { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: 'audios:' + g.id }] }
  ] } });
}
// "Indica e ganha" — só em mensagem GRÁTIS (conversa aberta)
export const textoIndica = (g) => '🎁 *Indica e ganha:* cada amigo que comprar pelo seu link vale *1 música grátis* pra você (2 versões).\nSeu link: ' + SITE + '/#/criar/musica/r.' + g.id;
