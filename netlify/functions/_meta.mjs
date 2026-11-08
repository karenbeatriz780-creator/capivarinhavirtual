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
  autoPausar: true, autoSubir: true,
  limiteSemVenda: 25,          // R$ gastos (valor do Gerenciador) sem nenhuma venda → pausa
  orcInicial: 45,              // R$/dia de todo anúncio novo publicado pelo painel
  tetoCampanha: 150,           // o robô nunca passa disso por campanha (R$/dia)
  tetoTotal: 400,              // nem disso somando todas as campanhas ativas (R$/dia)
  textoPadrao: '🎵 Uma música personalizada com o nome e a história de quem você ama. Ouça a prévia grátis antes de pagar!',
  tituloPadrao: 'Crie sua música personalizada',
  link: 'https://capivarinhalove.com.br/',
  cta: 'SHOP_NOW',
  pageId: '', igId: '', pixelId: '2102013347063288',
  zapAvisos: ''                // seu WhatsApp pra receber os avisos do robô (com DDI: 5591...)
};
export async function lerCfg() {
  const c = await loja().get('auto_cfg', { type: 'json' }).catch(() => null);
  return Object.assign({}, CFG_PADRAO, c || {});
}
export async function salvarCfg(novo) {
  const c = await lerCfg(), num = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
  const o = Object.assign({}, c);
  if ('autoPausar' in novo) o.autoPausar = !!novo.autoPausar;
  if ('autoSubir' in novo) o.autoSubir = !!novo.autoSubir;
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
  if (metodo === 'GET') r = await fetch(url + (url.includes('?') ? '&' : '?') + new URLSearchParams(p));
  else r = await fetch(url, { method: 'POST', body: new URLSearchParams(p) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = d.error || {};
    const semPerm = e.code === 200 || e.code === 10 || /permission|ads_management/i.test(e.message || '');
    const err = new Error(semPerm ? 'O token não tem permissão de gerenciar (gere um token novo com ads_read + ads_management).' : (e.error_user_msg || e.message || ('erro ' + r.status)));
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
    const cfg = await lerCfg(), n = String(cfg.zapAvisos || process.env.ZAP_ADMIN || '').replace(/\D/g, '');
    if (n.length < 10) return;
    const { enviarTexto } = await import('./_zap.mjs');
    await enviarTexto(n, '🤖 *Robô do tráfego*\n\n' + texto);
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
      o.vendas++; o.valor += Number(g.valor) || 0; o.ultima = Math.max(o.ultima, q);
      o.porDia[dia] = (o.porDia[dia] || 0) + 1;
    });
  } catch (e) { console.error('vendas por campanha:', e && e.message); }
  return out;
}

// ---------- descobrir Página, Instagram e Pixel da conta ----------
export async function detectarAtivos() {
  const out = { paginas: [], instagrams: [], pixels: [] };
  try { out.paginas = ((await graphConta('GET', 'promote_pages', { fields: 'id,name', limit: 50 })).data || []).map((p) => ({ id: p.id, nome: p.name })); } catch (e) { out.erroPagina = e.message; }
  try { out.instagrams = ((await graphConta('GET', 'instagram_accounts', { fields: 'id,username', limit: 50 })).data || []).map((p) => ({ id: p.id, nome: p.username })); } catch (e) { out.erroInsta = e.message; }
  if (!out.instagrams.length && out.paginas[0]) {
    try { const p = await graph('GET', out.paginas[0].id, { fields: 'instagram_business_account{id,username}' }); if (p.instagram_business_account) out.instagrams.push({ id: p.instagram_business_account.id, nome: p.instagram_business_account.username }); } catch (e) {}
  }
  try { out.pixels = ((await graphConta('GET', 'adspixels', { fields: 'id,name', limit: 50 })).data || []).map((p) => ({ id: p.id, nome: p.name })); } catch (e) { out.erroPixel = e.message; }
  return out;
}

// ---------- publicar anúncio novo (campanha de VENDAS completa) ----------
// a = { nome, texto, titulo, orcamento, tipo:'imagem'|'video', hash, videoId, thumb }
export async function publicarAnuncio(cfg, a, etapa) {
  etapa = etapa || (async () => {});
  if (!cfg.pageId) throw new Error('Falta escolher a Página do Facebook (Robô do tráfego → Detectar).');
  const pixel = cfg.pixelId || '2102013347063288';
  const orc = Math.max(6, Number(a.orcamento || cfg.orcInicial || 45));
  const dataTxt = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10).split('-').reverse().join('/');
  const nome = String(a.nome || 'Criativo').slice(0, 60) + ' · ' + dataTxt;
  const link = cfg.link || 'https://capivarinhalove.com.br/';
  await etapa('Criando a campanha…');
  const camp = await graphConta('POST', 'campaigns', {
    name: '[Painel] ' + nome, objective: 'OUTCOME_SALES', status: 'ACTIVE', special_ad_categories: [],
    buying_type: 'AUCTION', daily_budget: String(Math.round(orc * 100)), bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
  });
  let adset, criativo, ad;
  try {
    await etapa('Criando o público (Brasil, automático)…');
    adset = await graphConta('POST', 'adsets', {
      name: nome, campaign_id: camp.id, billing_event: 'IMPRESSIONS', optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: pixel, custom_event_type: 'PURCHASE' },
      targeting: { geo_locations: { countries: ['BR'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } },
      status: 'ACTIVE'
    });
    await etapa('Montando o anúncio…');
    const cta = { type: cfg.cta || 'SHOP_NOW', value: { link } };
    const spec = { page_id: cfg.pageId };
    if (a.tipo === 'video') spec.video_data = { video_id: a.videoId, message: a.texto || cfg.textoPadrao, title: a.titulo || cfg.tituloPadrao, image_url: a.thumb, call_to_action: cta };
    else spec.link_data = { image_hash: a.hash, link, message: a.texto || cfg.textoPadrao, name: a.titulo || cfg.tituloPadrao, call_to_action: cta };
    const corpoCriativo = (comInsta) => ({ name: nome, object_story_spec: Object.assign({}, spec, comInsta && cfg.igId ? { instagram_user_id: cfg.igId } : {}),
      url_tags: 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}' });
    try { criativo = await graphConta('POST', 'adcreatives', corpoCriativo(true)); }
    catch (e) { if (!cfg.igId) throw e; criativo = await graphConta('POST', 'adcreatives', corpoCriativo(false)); } // se o Instagram der erro, vai só com a Página
    await etapa('Publicando…');
    ad = await graphConta('POST', 'ads', { name: nome, adset_id: adset.id, creative: { creative_id: criativo.id }, status: 'ACTIVE' });
  } catch (e) {
    // não deixa campanha pela metade gastando: pausa
    try { await graph('POST', camp.id, { status: 'PAUSED' }); } catch (x) {}
    throw e;
  }
  return { campanha: camp.id, conjunto: adset.id, criativo: criativo.id, anuncio: ad.id, nome, orcamento: orc };
}
