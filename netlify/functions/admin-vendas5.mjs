// ✅ Painel → aba "Vendas 5 dias": campanhas (ligadas e desligadas) que venderam nos últimos 5 dias, com custo por venda.
import { metaAds } from './_gastos.mjs';
import { vendasSitePorCampanha } from './_meta.mjs';
import { diaBR } from './_resumo.mjs';
import { ehEUA } from './_futuro.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  // 21/11: ver a aba é livre (igual ao resto do painel aberto pelo link); só os BOTÕES que mexem em dinheiro pedem a senha
  if (req.method === 'POST' && (!senha || (req.headers.get('x-admin-key') || '') !== senha)) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  try {
    const [meta, site] = await Promise.all([metaAds(7, null, null, true), vendasSitePorCampanha(10)]);
    if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta Ads não está ligado.' });
    const agora = Date.now(), dias = [0, 1, 2, 3, 4].map((i) => diaBR(agora - i * 864e5));
    const lista = (meta.campanhas || []).map((c) => {
      const s = site[c.id] || { porDia: {} }; let g = 0, v = 0;
      dias.forEach((d) => { const x = (c.dias || {})[d] || {}; g += x.gasto || 0; v += Math.max(x.compras || 0, (s.porDia || {})[d] || 0); });
      const eua = ehEUA(c.nome), cpa = v ? g / v : null, lim = eua ? 30 : 9.5;
      return { id: String(c.id), nome: c.nome, status: c.status, gasto: +g.toFixed(2), vendas: v, cpa: cpa == null ? null : +cpa.toFixed(2), boa: v > 0 && cpa <= lim, eua, orc: c.orcamentoDia };
    }).filter((x) => x.vendas > 0).sort((a, b) => (b.boa - a.boa) || (b.vendas - a.vendas) || ((a.cpa || 99) - (b.cpa || 99)));
    return json({ dias, campanhas: lista });
  } catch (e) { return json({ erro: e.message }, 500); }
};
