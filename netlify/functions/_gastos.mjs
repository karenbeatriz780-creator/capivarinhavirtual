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
export async function metaAds(dias, deX, ateX) {
  const c = contaMeta();
  if (!c) return { configurado: false };
  const L = loja();
  const ckey = 'meta_cache_' + (deX || '') + '_' + (ateX || '') + '_' + dias;
  const cache = await L.get(ckey, { type: 'json' }).catch(() => null);
  if (cache && Date.now() - cache.em < 10 * 60000) return cache.dados; // guarda por 10 min
  const base = 'https://graph.facebook.com/' + VER() + '/act_' + c.id;
  const ate = ateX || diaBR(), de = deX || diaBR(Date.now() - (dias - 1) * 864e5);
  const tr = encodeURIComponent(JSON.stringify({ since: de, until: ate }));
  const campos = 'spend,impressions,clicks,cpc,ctr,actions,action_values';
  try {
    const tk = '&access_token=' + encodeURIComponent(c.tk);
    const tr7 = encodeURIComponent(JSON.stringify({ since: diaBR(Date.now() - 6 * 864e5), until: ate }));
    const [rc, rd, rcamp, rcd, rlist, rsets] = await Promise.all([
      fetch(base + '?fields=name,currency,account_status' + tk),
      fetch(base + '/insights?level=account&time_increment=1&time_range=' + tr + '&fields=' + campos + '&limit=500' + tk),
      fetch(base + '/insights?level=campaign&date_preset=last_7d&fields=campaign_id,campaign_name,' + campos + '&limit=100' + tk),
      fetch(base + '/insights?level=campaign&time_increment=1&time_range=' + tr7 + '&fields=campaign_id,spend,actions,action_values&limit=500' + tk),
      fetch(base + '/campaigns?fields=name,effective_status,created_time,start_time,daily_budget,lifetime_budget&limit=100' + tk),
      fetch(base + '/adsets?fields=campaign_id,effective_status,daily_budget,learning_stage_info&limit=300' + tk)
    ]);
    const conta = await rc.json(), dd = await rd.json(), dc = await rcamp.json();
    const dcd = await rcd.json().catch(() => ({})), dlist = await rlist.json().catch(() => ({})), dsets = await rsets.json().catch(() => ({}));
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
        dias: diaCamp[x.campaign_id] || {} };
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
