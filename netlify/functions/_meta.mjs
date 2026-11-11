// META ADS — ações e automação (o "robô do tráfego")
// - config do robô (orçamento inicial, limites, tetos, textos) guardada no Blobs
// - pausar / ativar / subir orçamento (usado pelo painel E pelo robô)
// - vendas REAIS do site por campanha (pra não pausar campanha que vendeu e o Pixel ainda não contou)
// - publicar criativo novo (campanha de vendas completa)
import { getStore } from '@netlify/blobs';
import { registrarAcao, SUBIR_MAX } from './_gastos.mjs';
import { lerDias, idsDosDiasTudo } from './_indice.mjs';

const VER = () => (process.env.META_API_VERSION || 'v24.0').trim();
const conta = () => String(process.env.META_AD_ACCOUNT_ID || '').trim().replace(/^act_/, '');
const token = () => String(process.env.META_ADS_TOKEN || '').trim();
const loja = () => getStore('gastos');

export const CFG_PADRAO = {
  autoPausar: true, autoSubir: true, // autoSubir = AVISAR que pode subir (o robô nunca sobe sozinho)
  limiteSemVenda: 15,          // (antigo) — agora vale primeiraVendaMax
  novaSemVenda: 15,            // (antigo) — o robô agora olha só o dia de hoje
  primeiraVendaMax: 15,        // R$ gastos (valor do app do Meta) sem venda → desliga
  cpaLimite: 13,               // custo por venda de HOJE acima disso → desliga
  cpaMax: 7,                   // custo por venda até isso → avisa que PODE SUBIR (quem sobe é você)
  segundaChance: false,         // campanha pausada por resultado ruim volta SÓ no horário de pico, uma vez
  kieMin: 10,                  // avisa quando o saldo da IA (Kie) ficar abaixo disso (R$)
  protecaoQueda: true,         // IA do site caiu → pausa tudo e avisa; voltou → religa
  orcInicial: 45,              // R$/dia de todo anúncio novo publicado pelo painel
  tetoCampanha: 150,           // o robô nunca passa disso por campanha (R$/dia)
  tetoTotal: 400,              // nem disso somando todas as campanhas ativas (R$/dia)
  textoPadrao: '🎵 Uma música personalizada com o nome e a história de quem você ama. Ouça a prévia grátis antes de pagar!',
  tituloPadrao: 'Crie sua música personalizada',
  link: 'https://capivarinhalove.com.br/',
  cta: 'SHOP_NOW',
  pageId: '1267535713110534', igId: '', pixelId: '2102013347063288',
  zapAvisos: '5591988039960'   // seu WhatsApp pra receber os avisos do robô (com DDI: 5591...)
};
export async function lerCfg() {
  const c = await loja().get('auto_cfg', { type: 'json' }).catch(() => null);
  const o = Object.assign({}, CFG_PADRAO, c || {});
  if (o.versaoRegras !== 2 && o.versaoRegras !== 3) Object.assign(o, { primeiraVendaMax: 14, cpaLimite: 13, segundaChance: false });
  if (o.versaoRegras !== 4) Object.assign(o, { versaoRegras: 4, novaSemVenda: 15, primeiraVendaMax: 15, cpaLimite: 13 }); // regras de 10/11: só o dia de hoje, R$ 15 sem venda
  return o;
}
export async function salvarCfg(novo) {
  const c = await lerCfg(), num = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
  const o = Object.assign({}, c);
  if ('autoPausar' in novo) o.autoPausar = !!novo.autoPausar;
  if ('autoSubir' in novo) o.autoSubir = !!novo.autoSubir;
  if ('segundaChance' in novo) o.segundaChance = !!novo.segundaChance;
  if ('protecaoQueda' in novo) o.protecaoQueda = !!novo.protecaoQueda;
  if (novo.primeiraVendaMax != null && novo.primeiraVendaMax !== '') o.primeiraVendaMax = num(novo.primeiraVendaMax, 5, 500);
  if (novo.cpaMax != null && novo.cpaMax !== '') o.cpaMax = num(novo.cpaMax, 1, 500);
  if (novo.novaSemVenda != null && novo.novaSemVenda !== '') o.novaSemVenda = num(novo.novaSemVenda, 3, 500);
  if (novo.cpaLimite != null && novo.cpaLimite !== '') o.cpaLimite = num(novo.cpaLimite, 1, 500);
  if (novo.kieMin != null && novo.kieMin !== '') o.kieMin = num(novo.kieMin, 0, 5000);
  if (novo.limiteSemVenda != null) o.limiteSemVenda = num(novo.limiteSemVenda, 5, 500);
  if (novo.orcInicial != null) o.orcInicial = num(novo.orcInicial, 6, 1000);
  if (novo.tetoCampanha != null) o.tetoCampanha = num(novo.tetoCampanha, 6, 5000);
  if (novo.tetoTotal != null) o.tetoTotal = num(novo.tetoTotal, 6, 20000);
  ['textoPadrao', 'tituloPadrao', 'link', 'cta', 'pageId', 'igId', 'pixelId', 'zapAvisos'].forEach((k) => { if (novo[k] != null) o[k] = String(novo[k]).trim().slice(0, 600); });
  await loja().setJSON('auto_cfg', o);
  return o;
}

// ---------- Graph API ----------
export async function graph(metodo, caminho, campos) {
  const url = 'https://graph.facebook.com/' + VER() + '/' + caminho;
  const p = Object.assign({ access_token: token() }, campos || {});
  Object.keys(p).forEach((k) => { if (p[k] && typeof p[k] === 'object') p[k] = JSON.stringify(p[k]); });
  let r;
  if (metodo === 'GET' || metodo === 'DELETE') r = await fetch(url + (url.includes('?') ? '&' : '?') + new URLSearchParams(p), { method: metodo });
  else r = await fetch(url, { method: 'POST', body: new URLSearchParams(p) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = d.error || {};
    const semPerm = e.code === 200 || e.code === 10 || /permission|ads_management/i.test(e.message || '');
    const orig = e.error_user_msg || e.message || ('erro ' + r.status);
    const err = new Error(semPerm ? 'Sem permissão no Meta: ' + orig : orig);
    err.meta = e; throw err;
  }
  return d;
}
export const graphConta = (metodo, sub, campos) => graph(metodo, 'act_' + conta() + '/' + sub, campos);

// ---------- histórico + avisos ----------
export async function logRobo(item) {
  const L = loja(), l = (await L.get('meta_log', { type: 'json' }).catch(() => null)) || [];
  l.unshift(Object.assign({ em: Date.now() }, item));
  await L.setJSON('meta_log', l.slice(0, 120));
}
export async function avisar(texto) {
  try {
    const cfg = await lerCfg(), n = String(cfg.zapAvisos || process.env.ZAP_ADMIN || '5591988039960').replace(/\D/g, '');
    if (n.length < 10) return;
    const { enviarTexto } = await import('./_zap.mjs');
    return await enviarTexto(n, '🤖 *Robô do tráfego*\n\n' + texto);
  } catch (e) { console.error('aviso robô:', e && e.message); }
}

// ---------- ações ----------
// c = campanha (de metaAds), com orcamentoDia / orcamentoNaCampanha / conjuntos
export async function aplicarAcao(c, acao, quem) {
  const id = String(c.id);
  if (acao === 'pausar') { await graph('POST', id, { status: 'PAUSED' }); await registrarAcao(id, 'pausar', { quem }); }
  else if (acao === 'ativar') { await graph('POST', id, { status: 'ACTIVE' }); await registrarAcao(id, 'ativar', { quem }); }
  else if (acao === 'subir') {
    const novo = Math.floor(c.novoOrcamento || c.orcamentoDia * (1 + SUBIR_MAX));
    if (!(novo > c.orcamentoDia)) throw new Error('novo orçamento inválido');
    if (novo > c.orcamentoDia * (1 + SUBIR_MAX) + 0.01) throw new Error('mais de 20% de uma vez não é permitido');
    if (c.orcamentoNaCampanha) await graph('POST', id, { daily_budget: String(Math.round(novo * 100)) });
    else {
      const cs = (c.conjuntos || []).filter((x) => x.orcamentoDia > 0);
      if (!cs.length) throw new Error('não achei orçamento diário nessa campanha');
      const f = novo / c.orcamentoDia;
      for (const x of cs) await graph('POST', x.id, { daily_budget: String(Math.floor(x.orcamentoDia * f * 100)) });
    }
    await registrarAcao(id, 'orcamento', { de: c.orcamentoDia, para: novo, quem });
  }
  if (!/^robô/.test(quem || '') && (acao === 'ativar' || acao === 'pausar')) { try { await loja().delete('sc_' + id); } catch (e) {} } // você mandou: sai da segunda chance
  try { await loja().setJSON('meta_cache_zerado', { em: Date.now() }); } catch (e) {}
}

// ---------- vendas do SITE por campanha (utm_campaign={{campaign.id}} no link do anúncio) ----------
export async function vendasSitePorCampanha(nDias) {
  const out = {};
  try {
    const idx = await lerDias();
    const ids = await idsDosDiasTudo(idx, nDias || 31, 'pg');
    const pres = getStore('presentes');
    const gs = await Promise.all(ids.slice(0, 1500).map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
    gs.forEach((g) => {
      if (!g || !g.pago || g.cancelado || g.cortesia) return;
      const camp = g.trafego && String(g.trafego.camp || '').replace(/\D/g, '');
      if (!camp) return;
      const q = g.pagoEm || g.criadoEm || 0, dia = new Date(q - 3 * 3600000).toISOString().slice(0, 10);
      const o = out[camp] = out[camp] || { vendas: 0, valor: 0, ultima: 0, porDia: {} };
      o.vendas++; o.valor += Number((g.pagamento && g.pagamento.valor) || g.valor) || 0; o.ultima = Math.max(o.ultima, q);
      o.porDia[dia] = (o.porDia[dia] || 0) + 1;
    });
  } catch (e) { console.error('vendas por campanha:', e && e.message); }
  return out;
}

// ---------- descobrir Página, Instagram e Pixel da conta ----------
export async function detectarAtivos() {
  const out = { paginas: [], instagrams: [], pixels: [] };
  try { out.paginas = ((await graphConta('GET', 'promote_pages', { fields: 'id,name', limit: 50 })).data || []).map((p) => ({ id: p.id, nome: p.name })); } catch (e) { out.erroPagina = e.message; }
  const cfg = await lerCfg(), pg = cfg.pageId || (out.paginas[0] && out.paginas[0].id);
  if (pg) { const ig = await acharInstagram(pg); if (ig.id) out.instagrams.push({ id: ig.id, nome: ig.nome || ig.id }); else out.erroInsta = ig.erros.join(' | '); }
  try { out.pixels = ((await graphConta('GET', 'adspixels', { fields: 'id,name', limit: 50 })).data || []).map((p) => ({ id: p.id, nome: p.name })); } catch (e) { out.erroPixel = e.message; }
  return out;
}

// procura o Instagram de todos os jeitos que o Meta permite → { id, nome, erros[] }
export async function acharInstagram(pageId) {
  const erros = [];
  const tenta = async (rot, f) => { try { return await f(); } catch (e) { erros.push(rot + ': ' + e.message); return null; } };
  let r = await tenta('Página', async () => {
    const p = await graph('GET', pageId, { fields: 'instagram_business_account{id,username},connected_instagram_account{id,username}' });
    return p.instagram_business_account || p.connected_instagram_account || null; });
  if (!r) r = await tenta('Conta de anúncios', async () => { const d = await graphConta('GET', 'instagram_accounts', { fields: 'id,username', limit: 50 }); return d.data && d.data[0]; });
  if (!r) r = await tenta('Página (contas IG)', async () => { const d = await graph('GET', pageId + '/instagram_accounts', { fields: 'id,username' }); return d.data && d.data[0]; });
  return { id: r && r.id ? String(r.id) : '', nome: r && r.username ? '@' + r.username : '', erros };
}

// ---------- "Checar tudo" antes de publicar ----------
// cada item: { nome, ok, aviso?, msg } — ok:false bloqueia a publicação
export async function checarTudo() {
  const cfg = await lerCfg(), itens = [];
  const add = (nome, ok, msg, aviso) => itens.push({ nome, ok: !!ok, aviso: !!aviso, msg });
  // 1. token
  try {
    const d = (await graph('GET', 'debug_token', { input_token: token() })).data || {};
    const sc = d.scopes || [], falta = ['ads_read', 'ads_management'].filter((x) => sc.indexOf(x) < 0);
    if (!d.is_valid) add('Token', false, 'token inválido ou vencido — gere outro no painel-capivarinha');
    else if (falta.length) add('Token', false, 'falta a permissão ' + falta.join(' e ') + ' — gere outro marcando ela');
    else add('Token', true, 'válido · ' + sc.filter((x) => /^ads_|^pages_|^business|^instagram/.test(x)).join(', ') + (d.expires_at ? '' : ' · não vence'));
  } catch (e) { add('Token', false, e.message); }
  // 2. conta de anúncios
  try {
    const a = await graphConta('GET', '', { fields: 'name,account_status,disable_reason,currency,amount_spent,spend_cap' });
    const ST = { 1: 'ativa', 2: 'DESATIVADA pelo Meta', 3: 'com PAGAMENTO PENDENTE', 7: 'em análise do Meta', 8: 'aguardando pagamento', 9: 'em período de carência (pagamento)', 100: 'fechamento pendente', 101: 'fechada' };
    const cap = Number(a.spend_cap || 0), gasto = Number(a.amount_spent || 0);
    if (a.account_status !== 1) add('Conta de anúncios', false, (a.name || '') + ' está ' + (ST[a.account_status] || ('status ' + a.account_status)) + ' — resolva no Gerenciador antes');
    else if (cap > 0 && cap - gasto < 10000) add('Conta de anúncios', true, 'ativa, mas o limite de gastos da conta está quase no fim (R$ ' + ((cap - gasto) / 100).toFixed(2) + ') — os anúncios param sozinhos', true);
    else add('Conta de anúncios', true, (a.name || 'conta') + ' · ativa · ' + (a.currency || ''));
  } catch (e) { add('Conta de anúncios', false, e.message); }
  // 3. Página
  try {
    const p = await graph('GET', cfg.pageId, { fields: 'name,is_published' });
    const lista = ((await graphConta('GET', 'promote_pages', { fields: 'id', limit: 100 }).catch(() => ({}))).data || []).map((x) => x.id);
    if (p.is_published === false) add('Página', false, p.name + ' não está publicada');
    else if (lista.length && lista.indexOf(String(cfg.pageId)) < 0) add('Página', false, p.name + ' não está liberada pra anunciar nessa conta — dê a Página pro painel-capivarinha com acesso de Anúncios');
    else add('Página', true, p.name);
  } catch (e) { add('Página', false, 'sem acesso à Página ' + cfg.pageId + ' — ' + e.message); }
  // 4. Instagram
  let ig = { id: cfg.igId, nome: '' };
  if (!ig.id) { ig = await acharInstagram(cfg.pageId); if (ig.id) await salvarCfg({ igId: ig.id }).catch(() => {}); }
  else { try { const d = await graph('GET', ig.id, { fields: 'username' }); ig.nome = d.username ? '@' + d.username : ''; } catch (e) { /* conta de anúncio às vezes não lê o perfil — tudo bem */ } }
  if (ig.id) add('Instagram', true, (ig.nome || 'conta') + ' · ID ' + ig.id);
  else add('Instagram', false, 'não achei o Instagram. Compartilhe o @capivarinha_love com o portfólio Capivarinha love (Atribuir parceiro, ID 1090656557188598) e dê ele pro painel-capivarinha — OU cole o ID do Instagram em "ID do Instagram" e salve.');
  // 5. Pixel
  try {
    const px = await graph('GET', cfg.pixelId, { fields: 'name,last_fired_time' });
    const h = px.last_fired_time ? (Date.now() - Date.parse(px.last_fired_time)) / 3600000 : 1e9;
    if (h > 48) add('Pixel', false, px.name + ' não recebe eventos há mais de 2 dias — o site não está mandando venda pro Meta');
    else add('Pixel', true, px.name + ' · último evento há ' + (h < 1 ? 'menos de 1 h' : Math.round(h) + ' h'));
  } catch (e) {
    const lista = ((await graphConta('GET', 'adspixels', { fields: 'id,name', limit: 50 }).catch(() => ({}))).data || []);
    const achou = lista.find((x) => x.id === String(cfg.pixelId));
    if (achou) add('Pixel', true, achou.name + ' (ligado à conta de anúncios)');
    else add('Pixel', false, 'o Pixel ' + cfg.pixelId + ' não está ligado a essa conta de anúncios');
  }
  // 6. teste seco: o Meta aceita criar a campanha? (validate_only não cria nada)
  try {
    await graphConta('POST', 'campaigns', { name: 'teste', objective: 'OUTCOME_SALES', status: 'PAUSED', special_ad_categories: [], buying_type: 'AUCTION',
      daily_budget: String(Math.round((cfg.orcInicial || 45) * 100)), bid_strategy: 'LOWEST_COST_WITHOUT_CAP', execution_options: ['validate_only'] });
    add('Permissão de criar campanha', true, 'o Meta aceita (teste sem criar nada)');
  } catch (e) { add('Permissão de criar campanha', false, e.message); }
  // 7. avisos de qualidade (não bloqueiam)
  const txt = String(cfg.textoPadrao || '');
  if (/avalia[cç][oõ]es|\d[\d.]{3,}\s*(clientes|vendas|pessoas)/i.test(txt)) add('Texto padrão', true, 'tem número de avaliações/clientes — só use se for real e comprovável, senão o Meta reprova e pode restringir a conta', true);
  if (!cfg.zapAvisos) add('Avisos no WhatsApp', true, 'coloque seu número em "Seu WhatsApp pros avisos" pra saber quando o robô pausar/subir', true);
  return { ok: itens.every((x) => x.ok), itens, cfg: await lerCfg() };
}

// ---------- publicar anúncio novo (campanha de VENDAS completa) ----------
// REGRAS (pedidas por você):
//  • 1 campanha → 1 conjunto → 1 anúncio · orçamento NA CAMPANHA
//  • só 6 posicionamentos: feed FB/IG + stories FB/IG + reels FB/IG (nada de "gastar um pouco" nos excluídos)
//  • 2 arquivos no MESMO anúncio: um pro feed (4:5/1:1) e outro pro reels/stories (9:16)
//  • nenhum aprimoramento automático do Meta (sem IA, figurinha, cartão de perfil, comentário, música…)
//  • destino só o site, botão Comprar
// ORDEM SEGURA: criativo primeiro (não gasta) → campanha/conjunto/anúncio PAUSADOS → confere tudo lendo de volta
//  → só então liga. Qualquer erro: apaga o que criou. Nunca fica nada pela metade gastando.
const POSICOES = { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed', 'story', 'facebook_reels'], instagram_positions: ['stream', 'story', 'reels'] };
const REGRA_FEED = { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed'], instagram_positions: ['stream'] };
const REGRA_VERT = { publisher_platforms: ['facebook', 'instagram', 'whatsapp'], facebook_positions: ['story', 'facebook_reels'], instagram_positions: ['story', 'reels'], whatsapp_positions: ['status'] };
export const SEM_APRIMORAMENTOS = ['adapt_to_placement', 'add_text_overlay', 'ads_with_benefits', 'biz_ai', 'creative_stickers', 'description_automation',
  'enhance_cta', 'generate_cta', 'image_animation', 'image_background_gen', 'image_brightness_and_contrast', 'image_templates', 'image_touchups', 'image_uncrop',
  'inline_comment', 'local_store_extension', 'media_type_automation', 'multi_photo_to_video', 'music_generation', 'pac_relaxation', 'product_extensions',
  'profile_card', 'profile_extension', 'replace_media_text', 'reveal_details_over_time', 'show_destination_blurbs', 'show_summary', 'site_extensions',
  'text_extraction_for_headline', 'text_extraction_for_tap_target', 'text_optimizations', 'text_overlay_translation', 'text_translation', 'translate_voiceover',
  'video_auto_crop', 'video_highlights', 'video_to_image'];
const igual = (a, b) => JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort());

export async function publicarAnuncio(cfg, a, etapa) {
  etapa = etapa || (async () => {});
  if (!cfg.pageId) throw new Error('Falta a Página do Facebook (Robô do tráfego → Detectar).');
  if (!a.feed || !a.vertical) throw new Error('Precisa dos 2 arquivos: um pro Feed e um pro Reels/Stories.');
  if (!cfg.igId) {
    const ig = await acharInstagram(cfg.pageId);
    if (!ig.id) throw new Error('não achei o Instagram @capivarinha_love. Compartilhe ele com o portfólio Capivarinha love e dê pro painel-capivarinha (igual a Página), ou cole o ID dele em "ID do Instagram".');
    cfg.igId = ig.id; await salvarCfg({ igId: ig.id }).catch(() => {});
  }
  const pixel = cfg.pixelId || '2102013347063288';
  const orc = Math.max(6, Number(a.orcamento || cfg.orcInicial || 45));
  const dataTxt = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10).split('-').reverse().join('/');
  const L = loja(), seq = ((await L.get('anuncio_seq', { type: 'json' }).catch(() => null)) || { n: 0 }).n + 1;
  // público: idade/sexo escolhidos no painel. Restringiu → público fixo (sem "Advantage+", senão o Meta trata idade máx. só como sugestão)
  const iMin = Math.max(18, Math.min(65, parseInt(a.idadeMin, 10) || 18));
  let iMax = parseInt(a.idadeMax, 10) || null; if (iMax && (iMax >= 65 || iMax < iMin)) iMax = null;
  const gen = [1, 2].indexOf(parseInt(a.genero, 10)) >= 0 ? parseInt(a.genero, 10) : null;
  // posições escolhidas (padrão: as 6). fb_feed, fb_story, fb_reels, ig_feed, ig_story, ig_reels
  const MAPA = { fb_feed: ['facebook', 'feed'], fb_story: ['facebook', 'story'], fb_reels: ['facebook', 'facebook_reels'], ig_feed: ['instagram', 'stream'], ig_story: ['instagram', 'story'], ig_reels: ['instagram', 'reels'], wa_status: ['whatsapp', 'status'] };
  let pk = (Array.isArray(a.posicoes) ? a.posicoes : []).filter((k, i, l) => MAPA[k] && l.indexOf(k) === i);
  if (!pk.length) pk = Object.keys(MAPA).filter((k) => k !== 'wa_status');
  if (pk.indexOf('wa_status') >= 0 && pk.indexOf('ig_story') < 0) pk.push('ig_story'); // Meta: Status do WhatsApp só junto com Stories do Instagram
  const POS = { publisher_platforms: [], facebook_positions: [], instagram_positions: [], whatsapp_positions: [] };
  pk.forEach((k) => { const [pf, ps] = MAPA[k]; if (POS.publisher_platforms.indexOf(pf) < 0) POS.publisher_platforms.push(pf); POS[pf + '_positions'].push(ps); });
  ['facebook', 'instagram', 'whatsapp'].forEach((pf) => { if (!POS[pf + '_positions'].length) delete POS[pf + '_positions']; });
  const temFeed = pk.some((k) => /_feed$/.test(k)), temVert = pk.some((k) => !/_feed$/.test(k));
  const so = (regra) => { const o = { publisher_platforms: [] }; ['facebook', 'instagram', 'whatsapp'].forEach((pf) => { const l = (regra[pf + '_positions'] || []).filter((x) => (POS[pf + '_positions'] || []).indexOf(x) >= 0); if (l.length) { o.publisher_platforms.push(pf); o[pf + '_positions'] = l; } }); return o; };
  // interesses (detalhamento): interests / behaviors / life_events …
  const ints = (Array.isArray(a.interesses) ? a.interesses : []).filter((x) => x && /^\d{5,25}$/.test(String(x.id))).slice(0, 40);
  const flex = {}; ints.forEach((x) => { const t = ['interests', 'behaviors', 'life_events', 'family_statuses', 'relationship_statuses', 'industries', 'income'].indexOf(x.tipo) >= 0 ? x.tipo : 'interests'; (flex[t] = flex[t] || []).push({ id: String(x.id), name: String(x.nome || '').slice(0, 80) }); });
  const restrito = iMin > 18 || !!iMax || !!gen || ints.length > 0;
  const pubTxt = (iMin > 18 || iMax || gen ? (iMin + (iMax ? '-' + iMax : '+') + (gen === 1 ? ' H' : gen === 2 ? ' M' : '')) : '') + (ints.length ? (iMin > 18 || iMax || gen ? ' ' : '') + 'int' + ints.length : '') + (pk.indexOf('wa_status') >= 0 ? ' WA' : '') + (pk.filter((k) => k !== 'wa_status').length < 6 ? ' ' + pk.length + 'pos' : '');
  const nome = 'Capivarinha #' + String(seq).padStart(3, '0') + ' · ' + String(a.nome || 'Criativo').slice(0, 40) + (pubTxt ? ' · ' + pubTxt : '') + ' · ' + dataTxt;
  const link = cfg.link || 'https://capivarinhalove.com.br/';
  const video = a.tipo === 'video';

  // 1) criativo (não gasta nada) — se o Instagram/aprimoramentos derem erro, para aqui
  await etapa('Montando o anúncio (feed + reels/stories, sem aprimoramentos)…');
  const mid = (x, rot) => video ? { video_id: x.videoId, thumbnail_url: x.thumb, adlabels: [{ name: rot }] } : { hash: x.hash, adlabels: [{ name: rot }] };
  const lab = video ? 'video_label' : 'image_label';
  const RF = so(REGRA_FEED), RV = so(REGRA_VERT);
  const midias = temFeed && temVert ? [mid(a.feed, 'cap_feed'), mid(a.vertical, 'cap_vertical')] : temFeed ? [mid(a.feed, 'cap_feed')] : [mid(a.vertical, 'cap_vertical')];
  const regras = temFeed && temVert ? [
    { customization_spec: RF, [video ? 'video_label' : 'image_label']: { name: 'cap_feed' }, priority: 1 },
    { customization_spec: RV, [video ? 'video_label' : 'image_label']: { name: 'cap_vertical' }, priority: 2 }] : null;
  const feedSpec = {
    [video ? 'videos' : 'images']: midias,
    bodies: [{ text: a.texto || cfg.textoPadrao }], titles: [{ text: a.titulo || cfg.tituloPadrao }],
    link_urls: [{ website_url: link }], call_to_action_types: [cfg.cta || 'SHOP_NOW'],
    ad_formats: [video ? 'SINGLE_VIDEO' : 'SINGLE_IMAGE']
  };
  if (regras) Object.assign(feedSpec, { optimization_type: 'PLACEMENT', asset_customization_rules: regras });
  const tirar = [];
  const corpo = () => {
    const feats = {}; SEM_APRIMORAMENTOS.filter((k) => tirar.indexOf(k) < 0).forEach((k) => { feats[k] = { enroll_status: 'OPT_OUT' }; });
    return { name: nome, object_story_spec: { page_id: cfg.pageId, instagram_user_id: cfg.igId },
      asset_feed_spec: feedSpec, degrees_of_freedom_spec: { creative_features_spec: feats },
      url_tags: 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}' };
  };
  let criativo = null, erro = null;
  for (let t = 0; t < SEM_APRIMORAMENTOS.length + 1; t++) {
    try { criativo = await graphConta('POST', 'adcreatives', corpo()); erro = null; break; }
    catch (e) {
      erro = e; const msg = String(e.message || '') + ' ' + JSON.stringify(e.meta || {});
      // algum aprimoramento que essa conta não aceita/conhece → tira só ele e tenta de novo
      const k = SEM_APRIMORAMENTOS.find((x) => tirar.indexOf(x) < 0 && msg.indexOf(x) >= 0);
      if (k) { tirar.push(k); continue; }
      break;
    }
  }
  if (erro) throw new Error('o Meta recusou o anúncio: ' + erro.message);

  // 2) campanha → conjunto → anúncio, tudo PAUSADO
  let camp = null;
  const desfazer = async () => {
    if (camp) { try { await graph('DELETE', camp.id, {}); } catch (x) { try { await graph('POST', camp.id, { status: 'PAUSED' }); } catch (y) {} } }
    try { await graph('DELETE', criativo.id, {}); } catch (x) {}
  };
  try {
    await etapa('Criando a campanha de vendas (pausada até conferir)…');
    camp = await graphConta('POST', 'campaigns', {
      name: nome, objective: 'OUTCOME_SALES', status: 'PAUSED', special_ad_categories: [],
      buying_type: 'AUCTION', daily_budget: String(Math.round(orc * 100)), bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
    });
    await etapa('Criando o conjunto (' + pk.length + ' posicionamentos, Brasil, compra no site' + (ints.length ? ', ' + ints.length + ' interesses' : '') + ')…');
    const adset = await graphConta('POST', 'adsets', {
      name: nome, campaign_id: camp.id, billing_event: 'IMPRESSIONS', optimization_goal: 'OFFSITE_CONVERSIONS',
      destination_type: 'WEBSITE', is_dynamic_creative: 'false',
      promoted_object: { pixel_id: pixel, custom_event_type: 'PURCHASE' },
      targeting: Object.assign({ geo_locations: { countries: ['BR'] }, age_min: iMin }, iMax ? { age_max: iMax } : {}, gen ? { genders: [gen] } : {},
        Object.keys(flex).length ? { flexible_spec: [flex] } : {},
        { targeting_automation: { advantage_audience: restrito ? 0 : 1 } }, POS),
      status: 'PAUSED'
    });
    await etapa('Criando o anúncio…');
    const ad = await graphConta('POST', 'ads', { name: nome, adset_id: adset.id, creative: { creative_id: criativo.id }, status: 'PAUSED' });

    // 3) confere lendo de volta do Meta
    await etapa('Conferindo tudo no Meta antes de ligar…');
    const [cs, cr, cc] = await Promise.all([
      graph('GET', adset.id, { fields: 'targeting,promoted_object,destination_type' }),
      graph('GET', criativo.id, { fields: 'degrees_of_freedom_spec,object_story_spec,asset_feed_spec{link_urls,call_to_action_types}' }).catch(() => ({})),
      graph('GET', camp.id, { fields: 'daily_budget,objective' })
    ]);
    const tg = cs.targeting || {}, probs = [];
    if (!igual(tg.publisher_platforms, POS.publisher_platforms) || !igual(tg.facebook_positions || [], POS.facebook_positions || []) || !igual(tg.instagram_positions || [], POS.instagram_positions || []) || !igual(tg.whatsapp_positions || [], POS.whatsapp_positions || []))
      probs.push('posicionamentos diferentes dos ' + pk.length + ' pedidos: ' + JSON.stringify({ fb: tg.facebook_positions, ig: tg.instagram_positions, wa: tg.whatsapp_positions }));
    if (ints.length && !(Array.isArray(tg.flexible_spec) && tg.flexible_spec.length)) probs.push('os interesses não foram gravados');
    if (String(cs.promoted_object && cs.promoted_object.pixel_id) !== String(pixel)) probs.push('pixel errado no conjunto');
    if (Number(cc.daily_budget) !== Math.round(orc * 100)) probs.push('orçamento diferente do pedido');
    if (Number(tg.age_min || 18) !== iMin || (iMax && Number(tg.age_max) !== iMax)) probs.push('idade diferente da pedida (' + (tg.age_min || '?') + '-' + (tg.age_max || '65+') + ')');
    if (gen && !(Array.isArray(tg.genders) && tg.genders.length === 1 && Number(tg.genders[0]) === gen)) probs.push('sexo diferente do pedido');
    if (probs.length) throw new Error('conferência falhou — ' + probs.join('; '));
    const fs = (cr.degrees_of_freedom_spec && cr.degrees_of_freedom_spec.creative_features_spec) || {};
    const ligados = Object.keys(fs).filter((k) => fs[k] && fs[k].enroll_status === 'OPT_IN');
    const desligados = Object.keys(fs).filter((k) => fs[k] && fs[k].enroll_status === 'OPT_OUT').length;

    // 4) tudo certo → liga (anúncio, conjunto, campanha)
    await etapa('Tudo conferido ✓ Ligando…');
    await graph('POST', ad.id, { status: 'ACTIVE' });
    await graph('POST', adset.id, { status: 'ACTIVE' });
    await graph('POST', camp.id, { status: 'ACTIVE' });
    await L.setJSON('anuncio_seq', { n: seq });
    try { await registrarAcao(camp.id, 'criada', { quem: 'painel' }); } catch (e) {}
    return { campanha: camp.id, conjunto: adset.id, criativo: criativo.id, anuncio: ad.id, nome, orcamento: orc, publico: pubTxt || 'todos (18+)',
      conferido: { posicionamentos: pk.length, interesses: ints.length, aprimoramentosDesligados: desligados, aprimoramentosQueOMetaNaoDeixouDesligar: tirar.concat(ligados) } };
  } catch (e) { await desfazer(); throw e; }
}
