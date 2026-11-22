// 🎓 Painel → aba "Aprendizagem": até 2 campanhas que o robô NUNCA desliga (meta: 50 compras/semana).
// GET  → campanhas + as escolhidas, com compras da semana, custo/ROAS dos últimos 3 dias vs 3 anteriores e tendência
// POST {ids:[...]} → salva (máximo 2)
import { getStore } from '@netlify/blobs';
import { graphConta, vendasSitePorCampanha, graph, aplicarAcao } from './_meta.mjs';
import { metaAds } from './_gastos.mjs';
import { ticketDe } from './_futuro.mjs';
import { diaBR } from './_resumo.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  // 21/11: ver a aba é livre (igual ao resto do painel aberto pelo link); só os BOTÕES que mexem em dinheiro pedem a senha
  if (req.method === 'POST' && (!senha || (req.headers.get('x-admin-key') || '') !== senha)) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos');
  try {
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => /^\d{5,30}$/.test(x)).slice(0, 2);
      const antes = ((await L.get('aprendizagem_cfg', { type: 'json' }).catch(() => null)) || {}).ids || [];
      await L.setJSON('aprendizagem_cfg', { ids, em: Date.now() });
      const ligou = [];
      for (const id of ids.filter((x) => antes.indexOf(x) < 0)) { // escolhida agora e desligada → liga já
        try { const c = await graph('GET', id, { fields: 'name,effective_status' }); if (String(c.effective_status || '') === 'PAUSED') { await aplicarAcao({ id, nome: c.name }, 'ativar', 'você (aprendizagem)'); ligou.push(c.name); } } catch (e) {}
      }
      return json({ ok: true, ids, ligou });
    }
    const cfg = (await L.get('aprendizagem_cfg', { type: 'json' }).catch(() => null)) || {}, ids = cfg.ids || [];
    const [lista, meta, site] = await Promise.all([graphConta('GET', 'campaigns', { fields: 'name,effective_status,created_time', limit: 400 }), metaAds(7), vendasSitePorCampanha(10)]);
    const mc = {}; (meta.campanhas || []).forEach((c) => { mc[String(c.id)] = c; });
    const agora = Date.now(), dia = (i) => diaBR(agora - i * 864e5);
    const campanhas = (lista.data || []).filter((x) => !/ARCHIVED|DELETED/.test(String(x.effective_status || ''))).map((x) => {
      const id = String(x.id), c = mc[id] || { dias: {} }, s = site[id] || { porDia: {} }, tk = ticketDe(id, site);
      const soma = (de, ate) => { let g = 0, v = 0; for (let i = de; i <= ate; i++) { const d = c.dias[dia(i)] || {}; g += d.gasto || 0; v += Math.max(d.compras || 0, (s.porDia || {})[dia(i)] || 0); } return { g: +g.toFixed(2), v, cpa: v ? +(g / v).toFixed(2) : null, roas: g ? +(v * tk / g).toFixed(2) : null }; };
      const sem = soma(0, 6), a3 = soma(0, 2), p3 = soma(3, 5);
      let tend = 'estavel';
      if (a3.v > p3.v && (!p3.cpa || (a3.cpa && a3.cpa <= p3.cpa * 1.1))) tend = 'progredindo';
      else if (a3.v < p3.v || (a3.cpa && p3.cpa && a3.cpa > p3.cpa * 1.15) || (a3.g >= 15 && !a3.v)) tend = 'regredindo';
      return { id, nome: x.name, status: x.effective_status, criada: x.created_time, semana: sem, ult3: a3, ant3: p3, tend };
    }).sort((a, b) => (ids.indexOf(b.id) >= 0) - (ids.indexOf(a.id) >= 0) || b.semana.v - a.semana.v);
    return json({ ids, campanhas });
  } catch (e) { return json({ erro: e.message }, 500); }
};
