// GASTOS AUTOMÁTICOS (painel → aba Gastos / Dashboard) — Meta Ads ligado
// - Kie.ai: o saldo de créditos é lido a cada 30 min (gastos-agendado). A diferença
//   entre uma leitura e outra é o gasto (se o saldo SOBE, foi recarga).
// - Dólar: cotação do dia (AwesomeAPI, grátis, sem chave).
// - Meta Ads: gasto, cliques e compras por dia (precisa META_ADS_TOKEN e META_AD_ACCOUNT_ID).
import { getStore } from '@netlify/blobs';

const loja = () => getStore('gastos');
// valor de 1 crédito da Kie em dólar (pacote básico). Dá pra trocar no Netlify: KIE_USD_POR_CREDITO
export const usdPorCredito = () => Number(process.env.KIE_USD_POR_CREDITO) || 0.005;
// dia no horário de Belém (UTC-3)
export const diaBR = (ms) => new Date((ms || Date.now()) - 3 * 3600000).toISOString().slice(0, 10);

export async function saldoKie() {
  const ch = (process.env.KIE_API_KEY || '').trim();
  if (!ch) return null;
  try {
    const r = await fetch('https://api.kie.ai/api/v1/chat/credit', { headers: { Authorization: 'Bearer ' + ch } });
    const d = await r.json().catch(() => null);
    if (d && d.code === 200 && typeof d.data === 'number') return d.data;
    console.log('Kie saldo: resposta estranha ' + JSON.stringify(d).slice(0, 200));
  } catch (e) { console.log('Kie saldo erro: ' + (e && e.message)); }
  return null;
}

// lê o saldo e soma o gasto/recarga do dia
export async function registrarSaldoKie(intervaloMin) {
  if (intervaloMin) { // não lê de novo se leu há pouco (evita contar duas vezes)
    const u = await loja().get('kie_ult', { type: 'json' }).catch(() => null);
    if (u && Date.now() - u.em < intervaloMin * 60000) return { saldo: u.saldo };
  }
  const saldo = await saldoKie();
  if (saldo == null) return null;
  const L = loja(), agora = Date.now(), dia = diaBR(agora);
  const ult = await L.get('kie_ult', { type: 'json' }).catch(() => null);
  const reg = (await L.get('kie_' + dia, { type: 'json' }).catch(() => null)) || { dia, gasto: 0, recarga: 0, inicio: saldo };
  if (ult && typeof ult.saldo === 'number') {
    const dif = ult.saldo - saldo;
    if (dif > 0) reg.gasto = +(reg.gasto + dif).toFixed(3);
    else if (dif < 0) reg.recarga = +(reg.recarga - dif).toFixed(3);
  }
  reg.fim = saldo; reg.em = agora;
  await L.setJSON('kie_' + dia, reg);
  await L.setJSON('kie_ult', { saldo, em: agora });
  return { saldo, dia: reg };
}

export async function cotacaoDolar() {
  const L = loja();
  const c = await L.get('usd', { type: 'json' }).catch(() => null);
  if (c && Date.now() - c.em < 6 * 3600000) return c.valor;
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const d = await r.json();
    const v = Number(d && d.USDBRL && d.USDBRL.bid);
    if (v > 1) { await L.setJSON('usd', { valor: v, em: Date.now() }); return v; }
  } catch (e) { console.log('cotação dólar erro: ' + (e && e.message)); }
  return (c && c.valor) || 5.6;
}

// ---------- Meta Ads ----------
const VER = () => (process.env.META_API_VERSION || 'v24.0').trim();
function contaMeta() {
  let id = String(process.env.META_AD_ACCOUNT_ID || '').trim().replace(/^act_/, '');
  const tk = String(process.env.META_ADS_TOKEN || '').trim();
  return id && tk ? { id, tk } : null;
}
const COMPRA = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
function acao(lista, tipos) {
  if (!Array.isArray(lista)) return 0;
  for (const t of tipos) { const a = lista.find((x) => x.action_type === t); if (a) return Number(a.value) || 0; }
  return 0;
}
export async function metaAds(dias, deX, ateX, semCache) {
  const c = contaMeta();
  if (!c) return { configurado: false };
  const L = loja();
  const ckey = 'meta_cache_' + (deX || '') + '_' + (ateX || '') + '_' + dias;
  const cache = await L.get(ckey, { type: 'json' }).catch(() => null);
  const zerado = await L.get('meta_cache_zerado', { type: 'json' }).catch(() => null); // depois de pausar/subir, ignora o cache antigo
  if (!semCache && cache && Date.now() - cache.em < 10 * 60000 && !(zerado && zerado.em > cache.em)) return cache.dados; // guarda por 10 min
  const base = 'https://graph.facebook.com/' + VER() + '/act_' + c.id;
  const ate = ateX || diaBR(), de = deX || diaBR(Date.now() - (dias - 1) * 864e5);
  const tr = encodeURIComponent(JSON.stringify({ since: de, until: ate }));
  const campos = 'spend,impressions,clicks,cpc,ctr,actions,action_values';
  try {
    const tk = '&access_token=' + encodeURIComponent(c.tk);
    const tr7 = encodeURIComponent(JSON.stringify({ since: diaBR(Date.now() - 6 * 864e5), until: ate }));
    const [rc, rd, rcamp, rcd, rlist, rsets, rtot] = await Promise.all([
      fetch(base + '?fields=name,currency,account_status' + tk),
      fetch(base + '/insights?level=account&time_increment=1&time_range=' + tr + '&fields=' + campos + '&limit=500' + tk),
      fetch(base + '/insights?level=campaign&date_preset=last_7d&fields=campaign_id,campaign_name,' + campos + '&limit=100' + tk),
      fetch(base + '/insights?level=campaign&time_increment=1&time_range=' + tr7 + '&fields=campaign_id,spend,actions,action_values&limit=500' + tk),
      fetch(base + '/campaigns?fields=name,effective_status,created_time,start_time,daily_budget,lifetime_budget&limit=100' + tk),
      fetch(base + '/adsets?fields=id,campaign_id,effective_status,daily_budget,learning_stage_info&limit=300' + tk),
      fetch(base + '/insights?level=campaign&date_preset=maximum&fields=campaign_id,spend,actions&limit=200' + tk)
    ]);
    const conta = await rc.json(), dd = await rd.json(), dc = await rcamp.json();
    const dcd = await rcd.json().catch(() => ({})), dlist = await rlist.json().catch(() => ({})), dsets = await rsets.json().catch(() => ({}));
    const dtot = await rtot.json().catch(() => ({})), tot = {};
    (dtot.data || []).forEach((x) => { tot[x.campaign_id] = { gasto: Number(x.spend) || 0, compras: acao(x.actions, COMPRA) }; });
    if (conta.error || dd.error) {
      const e = conta.error || dd.error;
      return { configurado: true, erro: (e.message || 'erro') + (e.code === 190 ? ' (chave vencida ou inválida)' : '') };
    }
    const porDia = {};
    (dd.data || []).forEach((x) => {
      porDia[x.date_start] = { gasto: Number(x.spend) || 0, imp: Number(x.impressions) || 0, cliques: Number(x.clicks) || 0,
        compras: acao(x.actions, COMPRA), valorCompras: acao(x.action_values, COMPRA) };
    });
    // por campanha: últimos 7 dias, dia a dia, status, orçamento e aprendizado
    const info = {};
    (dlist.data || []).forEach((x) => { info[x.id] = x; });
    const sets = {};
    (dsets.data || []).forEach((x) => { (sets[x.campaign_id] = sets[x.campaign_id] || []).push(x); });
    const diaCamp = {};
    (dcd.data || []).forEach((x) => { (diaCamp[x.campaign_id] = diaCamp[x.campaign_id] || {})[x.date_start] = { gasto: Number(x.spend) || 0, compras: acao(x.actions, COMPRA), valor: acao(x.action_values, COMPRA) }; });
    const campanhas = (dc.data || []).map((x) => {
      const i = info[x.campaign_id] || {}, ss = (sets[x.campaign_id] || []).filter((a) => a.effective_status === 'ACTIVE');
      const orc = Number(i.daily_budget || 0) || ss.reduce((t, a) => t + (Number(a.daily_budget) || 0), 0);
      return { id: x.campaign_id, nome: x.campaign_name, gasto: Number(x.spend) || 0, cliques: Number(x.clicks) || 0,
        cpc: Number(x.cpc) || 0, ctr: Number(x.ctr) || 0, compras: acao(x.actions, COMPRA), valor: acao(x.action_values, COMPRA),
        status: i.effective_status || '', criada: i.start_time || i.created_time || null,
        orcamentoDia: orc ? orc / 100 : null,
        aprendendo: ss.some((a) => a.learning_stage_info && /LEARNING/.test(String(a.learning_stage_info.status || '')) && !/FAIL|LIMITED/.test(String(a.learning_stage_info.status || ''))),
        aprendizadoLimitado: ss.some((a) => a.learning_stage_info && /FAIL|LIMITED/.test(String(a.learning_stage_info.status || ''))),
        orcamentoNaCampanha: !!Number(i.daily_budget || 0),
        conjuntos: ss.map((a) => ({ id: a.id, orcamentoDia: Number(a.daily_budget || 0) / 100 })),
        dias: diaCamp[x.campaign_id] || {}, total: tot[x.campaign_id] || null };
    }).sort((a, b) => b.gasto - a.gasto);
    const dados = { configurado: true, conta: conta.name, moeda: conta.currency || 'BRL', porDia, campanhas };
    await L.setJSON(ckey, { em: Date.now(), dados }).catch(() => {});
    return dados;
  } catch (e) { return { configurado: true, erro: 'sem conexão com o Meta: ' + (e && e.message) }; }
}

// contagem do que a Kie fez (pra dividir o gasto por tipo)
export async function contarUso(tipo) {
  try {
    const L = loja(), k = 'uso_' + diaBR();
    const u = (await L.get(k, { type: 'json' }).catch(() => null)) || {};
    u[tipo] = (u[tipo] || 0) + 1;
    await L.setJSON(k, u);
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// ESTRATÉGIA DE TRÁFEGO: o que fazer com cada campanha (usada no painel E no servidor,
// então a trava vale mesmo que alguém tente burlar a tela).
// c.gasto e c.dias[].gasto já vêm COM o imposto do Meta.
// ---------------------------------------------------------------------------
export const TICKET = () => Number(process.env.TICKET_MEDIO) || 9.99;
export const SUBIR_MAX = 0.2;              // no máximo +20% por vez
const TRAVA_H = 72;                        // depois de mexer no orçamento, 3 dias sem mexer de novo
export async function ultimasAcoes() {
  try { return (await loja().get('meta_acoes', { type: 'json' })) || {}; } catch (e) { return {}; }
}
export async function registrarAcao(id, tipo, extra) {
  const L = loja(), a = (await L.get('meta_acoes', { type: 'json' }).catch(() => null)) || {};
  const ant = a[id] || {};
  a[id] = Object.assign({}, ant, { tipo, em: Date.now() }, extra || {}, tipo === 'orcamento' ? { orcEm: Date.now() } : {});
  await L.setJSON('meta_acoes', a);
}
export function recomendar(c, acao, agora) {
  agora = agora || Date.now();
  const tk = TICKET();
  const valor = c.valor || c.compras * tk, roas = c.gasto > 0 ? valor / c.gasto : 0;
  const hoje = diaBR(agora);
  const dias = Object.keys(c.dias || {}).filter((k) => k < hoje).sort().reverse().slice(0, 3);
  const diaBom = (k) => { const d = c.dias[k], v = d.valor || d.compras * tk; return d.compras >= 1 && v >= d.gasto * 1.3; };
  const diaRuim = (k) => { const d = c.dias[k], v = d.valor || d.compras * tk; return d.gasto >= tk && v < d.gasto * 0.7; };
  const idadeH = c.criada ? (agora - new Date(c.criada).getTime()) / 3600000 : 999;
  const mexeuH = acao && acao.orcEm ? (agora - acao.orcEm) / 3600000 : 999;
  const r = { nivel: 'manter', titulo: 'Manter e observar', motivo: '', podeSubir: false, trava: '', roas, cpa: c.compras ? c.gasto / c.compras : null, valor };
  const novoOrc = c.orcamentoDia ? Math.floor(c.orcamentoDia * (1 + SUBIR_MAX)) : null;
  // travas (nunca subir)
  if (c.status && c.status !== 'ACTIVE') return Object.assign(r, { nivel: 'pausada', titulo: 'Pausada', motivo: 'não está rodando' });
  if (idadeH < 72) r.trava = 'campanha nova (' + Math.max(1, Math.round(idadeH / 24)) + ' dia(s)) — o Meta precisa de 3 dias pra aprender';
  else if (c.aprendendo) r.trava = 'o Meta ainda está aprendendo — mexer no orçamento reinicia o aprendizado';
  else if (mexeuH < TRAVA_H) r.trava = 'você mexeu no orçamento há ' + Math.round(mexeuH) + ' h — espere completar 72 h';
  else if (!c.orcamentoDia) r.trava = 'não achei o orçamento diário (orçamento total ou de outro tipo)';
  // 1) PAUSAR (alerta)
  if (c.compras === 0 && c.gasto >= 3 * tk && idadeH >= 48)
    return Object.assign(r, { nivel: 'pausar', titulo: 'Pausar', motivo: 'gastou R$ ' + c.gasto.toFixed(2).replace('.', ',') + ' em 7 dias e não vendeu nada' + (c.ctr && c.ctr < 0.8 ? ' · poucos cliques no anúncio (CTR ' + c.ctr.toFixed(2).replace('.', ',') + '%): troque o criativo' : '') });
  if (c.gasto >= 5 * tk && roas < 0.7 && dias.length >= 3 && dias.every(diaRuim) && !c.aprendendo)
    return Object.assign(r, { nivel: 'pausar', titulo: 'Pausar', motivo: 'prejuízo nos últimos 3 dias seguidos · cada R$ 1 voltou R$ ' + roas.toFixed(2).replace('.', ',') });
  // 2) travado → não mexer
  if (r.trava) return Object.assign(r, { nivel: 'travado', titulo: 'Não mexer ainda', motivo: r.trava });
  // 3) SUBIR (alerta): lucro nos 3 últimos dias e retorno forte
  if (dias.length >= 3 && dias.every(diaBom) && roas >= 1.5 && c.compras >= 5)
    return Object.assign(r, { nivel: 'subir', titulo: 'Subir orçamento', podeSubir: true, novoOrcamento: novoOrc, motivo: 'lucro nos últimos 3 dias seguidos · cada R$ 1 voltou R$ ' + roas.toFixed(2).replace('.', ',') + ' · suba 20%' });
  // 4) pode subir (opcional)
  if (roas >= 1.3 && c.compras >= 3)
    return Object.assign(r, { nivel: 'podeSubir', titulo: 'Pode subir', podeSubir: true, novoOrcamento: novoOrc, motivo: 'dando lucro (R$ ' + roas.toFixed(2).replace('.', ',') + ' pra cada R$ 1), mas ainda sem 3 dias seguidos — subir é opcional' });
  if (roas > 0 && roas < 1)
    return Object.assign(r, { nivel: 'manter', titulo: 'Atenção', motivo: 'está no prejuízo (R$ ' + roas.toFixed(2).replace('.', ',') + ' pra cada R$ 1) — se continuar 3 dias, pause' });
  return Object.assign(r, { motivo: 'ainda sem sinal claro — espere mais 1 ou 2 dias' });
}
