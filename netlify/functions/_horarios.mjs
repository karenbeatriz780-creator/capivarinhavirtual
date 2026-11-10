// MELHORES HORÁRIOS + CAMPANHA PROGRAMADA
// - custo por venda de cada hora do dia (gasto do Meta por hora × vendas reais do site por hora)
// - janelas com as horas boas (horário de Brasília)
// - duplicar uma campanha como "programada": cópia que só roda nessas janelas (o próprio Meta liga/desliga)
//   O Meta só deixa programar horário com ORÇAMENTO TOTAL → a cópia usa orçamento total = R$/dia × dias.
import { getStore } from '@netlify/blobs';
import { graph, graphConta, lerCfg, logRobo } from './_meta.mjs';
import { registrarAcao } from './_gastos.mjs';
import { lerDias, idsDosDiasTudo } from './_indice.mjs';

const loja = () => getStore('gastos');
const BR = -3; // Brasília
export const SUGESTAO_VOCE = [[6, 8], [11, 14], [18, 25]]; // 6h–8h, 11h–14h, 18h–1h
const imposto = () => (process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;

// janelas [[ini,fim)] em horas de Brasília (fim pode passar de 24 = madrugada do dia seguinte) → lista de horas 0..23
export function horasDe(janelas) {
  const s = new Set();
  (janelas || []).forEach(([a, b]) => { for (let h = a; h < b; h++) s.add(((h % 24) + 24) % 24); });
  return [...s].sort((x, y) => x - y);
}
// lista de horas → janelas contínuas (junta a virada da meia-noite: 18..23 + 0 → [18,25))
export function janelasDe(horas) {
  const on = Array(24).fill(false); horas.forEach((h) => { on[h] = true; });
  if (on.every(Boolean)) return [[0, 24]];
  let ini = on.findIndex((x) => !x); // começa num "desligado" pra não cortar janela que vira a noite
  const out = []; let a = null;
  for (let k = 1; k <= 24; k++) {
    const h = (ini + k) % 24, abs = ini + k;
    if (on[h] && a === null) a = abs;
    if (!on[h] && a !== null) { out.push([a, abs]); a = null; }
  }
  if (a !== null) out.push([a, ini + 25]);
  return out.map(([x, y]) => (x >= 24 ? [x - 24, y - 24] : [x, y])).sort((p, q) => p[0] - q[0]);
}
export const txtJanelas = (js) => js.map(([a, b]) => a + 'h–' + (b % 24) + 'h').join(', ');

export async function calcHorarios(nDias, semCache) {
  nDias = nDias || 14;
  const L = loja(), ck = 'horarios_' + nDias;
  if (!semCache) { const c = await L.get(ck, { type: 'json' }).catch(() => null); if (c && Date.now() - c.em < 3 * 3600000) return c.dados; }
  const cfg = await lerCfg(), imp = imposto();
  const acc = await graphConta('GET', '', { fields: 'timezone_name,timezone_offset_hours_utc' });
  const off = Number(acc.timezone_offset_hours_utc || BR), desloc = Math.round(off - BR); // hora da conta = hora BR + desloc
  const ate = new Date(Date.now() - 3 * 3600000), de = new Date(ate.getTime() - (nDias - 1) * 86400000);
  const tr = { since: de.toISOString().slice(0, 10), until: ate.toISOString().slice(0, 10) };
  const ins = await graphConta('GET', 'insights', { level: 'account', time_range: tr, breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone', fields: 'spend,impressions,clicks', limit: 100 });
  const H = Array.from({ length: 24 }, (_, h) => ({ h, gasto: 0, vendas: 0, cliques: 0 }));
  (ins.data || []).forEach((x) => {
    const hc = parseInt(String(x.hourly_stats_aggregated_by_advertiser_time_zone || '').slice(0, 2), 10);
    if (!(hc >= 0 && hc < 24)) return;
    const hb = ((hc - desloc) % 24 + 24) % 24; // converte pra hora de Brasília
    H[hb].gasto += (Number(x.spend) || 0) * (1 + imp); H[hb].cliques += Number(x.clicks) || 0;
  });
  // vendas reais do site que vieram de anúncio (utm_campaign), pela hora do pagamento em Brasília
  let totVendas = 0, rapidas = 0, comTempo = 0;
  try {
    const idx = await lerDias(), ids = await idsDosDiasTudo(idx, nDias, 'pg'), pres = getStore('presentes');
    const gs = await Promise.all(ids.slice(0, 3000).map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
    const desde = Date.parse(tr.since + 'T03:00:00Z');
    gs.forEach((g) => {
      if (!g || !g.pago || g.cancelado || g.cortesia) return;
      if (!(g.trafego && String(g.trafego.camp || '').replace(/\D/g, ''))) return;
      const q = g.pagoEm || 0; if (!q || q < desde) return;
      const hb = new Date(q + BR * 3600000).getUTCHours();
      H[hb].vendas++; totVendas++;
      if (g.criadoEm && q > g.criadoEm) { comTempo++; if (q - g.criadoEm <= 30 * 60000) rapidas++; }
    });
  } catch (e) { console.error('horarios vendas:', e && e.message); }
  const totGasto = H.reduce((t, x) => t + x.gasto, 0), cpaDia = totVendas ? totGasto / totVendas : 0;
  const lim = Number(cfg.cpaLimite || 13);
  const alvo = Math.min(lim, cpaDia ? cpaDia * 1.05 : lim);
  H.forEach((x) => {
    x.gasto = Math.round(x.gasto * 100) / 100;
    x.cpa = x.vendas ? Math.round(x.gasto / x.vendas * 100) / 100 : null;
    if (x.vendas >= 2 && x.cpa <= alvo) x.cor = 'verde';
    else if ((x.vendas === 0 && x.gasto >= 8) || (x.cpa && x.cpa > lim * 1.25)) x.cor = 'vermelho';
    else x.cor = 'amarelo';
  });
  // melhores: verdes + amarelos "colados" entre dois verdes (pra não picotar) + amarelos baratos se faltar hora
  let boas = H.filter((x) => x.cor === 'verde').map((x) => x.h);
  H.forEach((x) => { if (x.cor === 'amarelo' && boas.indexOf((x.h + 23) % 24) >= 0 && boas.indexOf((x.h + 1) % 24) >= 0) boas.push(x.h); });
  if (boas.length < 8) H.filter((x) => x.cor === 'amarelo' && x.cpa && x.cpa <= lim).sort((a, b) => a.cpa - b.cpa).slice(0, 8 - boas.length).forEach((x) => boas.push(x.h));
  boas = [...new Set(boas)].sort((a, b) => a - b);
  const janelas = janelasDe(boas);
  const resumoDe = (horas) => { const g = horas.reduce((t, h) => t + H[h].gasto, 0), v = horas.reduce((t, h) => t + H[h].vendas, 0);
    return { horas: horas.length, gasto: Math.round(g * 100) / 100, vendas: v, cpa: v ? Math.round(g / v * 100) / 100 : null, parteVendas: totVendas ? Math.round(v / totVendas * 100) : 0 }; };
  const dados = {
    dias: nDias, de: tr.since, ate: tr.until, fuso: acc.timezone_name || '', porHora: H,
    diaTodo: resumoDe(H.map((x) => x.h)), melhores: Object.assign({ janelas, txt: txtJanelas(janelas) }, resumoDe(boas)),
    sua: Object.assign({ janelas: SUGESTAO_VOCE, txt: txtJanelas(SUGESTAO_VOCE) }, resumoDe(horasDe(SUGESTAO_VOCE))),
    poucosDados: totVendas < 40, pagamNaHora: comTempo ? Math.round(rapidas / comTempo * 100) : null, cpaLimite: lim
  };
  await L.setJSON(ck, { em: Date.now(), dados }).catch(() => {});
  return dados;
}

// ---------- duplicar como PROGRAMADA ----------
// cria campanha nova (pausada) → conjunto(s) com o mesmo público/pixel/posicionamentos + horário → anúncio(s) com o MESMO criativo
// confere → liga. Qualquer erro: apaga o que criou. A original não é mexida.
export async function duplicarProgramada(id, janelas, orcDia, dias) {
  const acc = await graphConta('GET', '', { fields: 'timezone_offset_hours_utc' });
  const desloc = Math.round(Number(acc.timezone_offset_hours_utc || BR) - BR);
  const horas = horasDe(janelas);
  if (horas.length < 3 || horas.length > 22) throw new Error('escolha entre 3 e 22 horas por dia');
  // horas de Brasília → minutos no fuso da conta, em blocos contínuos dentro de 0..1440
  const hc = horas.map((h) => ((h + desloc) % 24 + 24) % 24).sort((a, b) => a - b);
  const sched = []; let a = null, p = null;
  hc.forEach((h) => { if (a === null) { a = h; p = h; } else if (h === p + 1) p = h; else { sched.push([a, p + 1]); a = h; p = h; } });
  if (a !== null) sched.push([a, p + 1]);
  const adset_schedule = sched.map(([x, y]) => ({ start_minute: x * 60, end_minute: y * 60, days: [0, 1, 2, 3, 4, 5, 6], timezone_type: 'ADVERTISER' }));

  const orig = await graph('GET', id, { fields: 'name,objective,bid_strategy,special_ad_categories,buying_type' });
  const sets = (await graph('GET', id + '/adsets', { fields: 'id,name,targeting,promoted_object,optimization_goal,billing_event,destination_type,attribution_spec,bid_strategy,bid_amount,effective_status', limit: 50 })).data || [];
  const ads = (await graph('GET', id + '/ads', { fields: 'id,name,adset_id,creative{id},effective_status', limit: 100 })).data || [];
  const setsOk = sets.filter((s) => ads.some((x) => x.adset_id === s.id && x.creative && x.creative.id));
  if (!setsOk.length) throw new Error('não achei conjunto com anúncio nessa campanha');
  const total = Math.round(orcDia * dias * 100);
  const nomeBase = String(orig.name || 'Campanha').replace(/^⏰ PROG · /, '').slice(0, 70);
  const nome = '⏰ PROG · ' + nomeBase;
  const inicio = new Date(Math.ceil((Date.now() + 2 * 60000) / 60000) * 60000), fim = new Date(inicio.getTime() + dias * 86400000);
  let camp = null;
  try {
    camp = await graphConta('POST', 'campaigns', { name: nome, objective: orig.objective || 'OUTCOME_SALES', status: 'PAUSED',
      special_ad_categories: orig.special_ad_categories || [], buying_type: 'AUCTION', lifetime_budget: String(total),
      bid_strategy: orig.bid_strategy || 'LOWEST_COST_WITHOUT_CAP' });
    const criados = [];
    for (const s of setsOk) {
      const corpo = { name: nome, campaign_id: camp.id, billing_event: s.billing_event || 'IMPRESSIONS', optimization_goal: s.optimization_goal || 'OFFSITE_CONVERSIONS',
        targeting: s.targeting, promoted_object: s.promoted_object, start_time: String(Math.floor(inicio.getTime() / 1000)), end_time: String(Math.floor(fim.getTime() / 1000)),
        pacing_type: ['day_parting'], adset_schedule, status: 'PAUSED' };
      if (s.destination_type) corpo.destination_type = s.destination_type;
      if (s.attribution_spec) corpo.attribution_spec = s.attribution_spec;
      console.log('programada adset:', JSON.stringify({ sched: adset_schedule, ini: corpo.start_time, fim: corpo.end_time, desloc, horas }));
      const ns = await graphConta('POST', 'adsets', corpo);
      for (const ad of ads.filter((x) => x.adset_id === s.id && x.creative && x.creative.id)) {
        const na = await graphConta('POST', 'ads', { name: nome, adset_id: ns.id, creative: { creative_id: ad.creative.id }, status: 'PAUSED' });
        criados.push({ set: ns.id, ad: na.id });
      }
    }
    // confere
    const conf = await graph('GET', criados[0].set, { fields: 'adset_schedule,pacing_type,end_time' });
    if (!Array.isArray(conf.adset_schedule) || !conf.adset_schedule.length) throw new Error('o Meta não gravou o horário programado');
    const cc = await graph('GET', camp.id, { fields: 'lifetime_budget' });
    if (Number(cc.lifetime_budget) !== total) throw new Error('orçamento total diferente do pedido');
    // liga
    for (const x of criados) await graph('POST', x.ad, { status: 'ACTIVE' });
    for (const s of [...new Set(criados.map((x) => x.set))]) await graph('POST', s, { status: 'ACTIVE' });
    await graph('POST', camp.id, { status: 'ACTIVE' });
    await loja().setJSON('prog_' + camp.id, { origem: id, janelas, orcDia, dias, criadaEm: Date.now(), fim: fim.getTime() });
    try { await registrarAcao(camp.id, 'criada', { quem: 'painel' }); await loja().setJSON('meta_cache_zerado', { em: Date.now() }); } catch (e) {}
    await logRobo({ tipo: 'publicou', camp: nome, id: camp.id, motivo: 'você duplicou como PROGRAMADA (' + txtJanelas(janelas) + ', R$ ' + orcDia + '/dia por ' + dias + ' dias = R$ ' + (total / 100) + ' no total)' });
    return { ok: true, nova: camp.id, nome, total: total / 100, fim: fim.getTime(), janelas: txtJanelas(janelas) };
  } catch (e) {
    console.error('programada erro:', e && e.message, JSON.stringify((e && e.meta) || {}));
    if (camp) { try { await graph('DELETE', camp.id, {}); } catch (x) { try { await graph('POST', camp.id, { status: 'PAUSED' }); } catch (y) {} } }
    throw e;
  }
}
