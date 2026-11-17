// 🌙 Painel → aba "Meia-noite": quais campanhas o robô LIGA à meia-noite.
// GET  → todas as campanhas (só nome e situação) + as que você desmarcou
// POST {fora:[ids]} → salva as desmarcadas (campanha nova entra marcada)
import { getStore } from '@netlify/blobs';
import { graphConta, vendasSitePorCampanha } from './_meta.mjs';
import { metaAds } from './_gastos.mjs';
import { futuro } from './_futuro.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos');
  try {
    if (req.method === 'GET') {
      const cfg = (await L.get('meianoite_cfg', { type: 'json' }).catch(() => null)) || {};
      const d = await graphConta('GET', 'campaigns', { fields: 'name,effective_status,created_time', limit: 400 });
      const campanhas = (d.data || []).filter((x) => !/ARCHIVED|DELETED/.test(String(x.effective_status || '')))
        .map((x) => ({ id: String(x.id), nome: x.name, status: x.effective_status, criada: x.created_time }))
        .sort((a, b) => String(b.criada || '').localeCompare(String(a.criada || '')));
      // ⭐ tem futuro? (última semana até ontem — é o que o robô usa à meia-noite)
      try {
        const [meta, site] = await Promise.all([metaAds(7), vendasSitePorCampanha(10)]);
        const mc = {}; (meta.campanhas || []).forEach((c) => { mc[String(c.id)] = c; });
        campanhas.forEach((c) => { c.fut = futuro(mc[c.id] || { id: c.id, nome: c.nome, dias: {} }, site, Date.now() - 864e5); });
        campanhas.sort((a, b) => ((b.fut && b.fut.tem ? 1 : 0) - (a.fut && a.fut.tem ? 1 : 0)) || ((b.fut ? b.fut.vendas : 0) - (a.fut ? a.fut.vendas : 0)));
      } catch (e) {}
      return json({ campanhas, fora: cfg.fora || [] });
    }
    let b = {}; try { b = await req.json(); } catch (e) {}
    const fora = (Array.isArray(b.fora) ? b.fora : []).map(String).filter((x) => /^\d{5,30}$/.test(x)).slice(0, 500);
    await L.setJSON('meianoite_cfg', { fora, em: Date.now() });
    return json({ ok: true, fora });
  } catch (e) { return json({ erro: e.message }, 500); }
};
