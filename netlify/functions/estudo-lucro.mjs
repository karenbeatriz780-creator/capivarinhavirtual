// 📚 26/11: dados pro ESTUDO de lucro (Gusthavo quer voltar aos R$ 300/dia de lucro).
// Abrir: https://capivarinhalove.com.br/.netlify/functions/estudo-lucro  → salvar/mandar o arquivo pro Claude.
// Só números (gasto, compras, vendas do site por dia e por campanha) — nenhuma chave.
import { graphConta } from './_meta.mjs';
import { diaBR, idsDoDia } from './_indice.mjs';
const COMPRA = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
const acao = (l, t) => { if (!Array.isArray(l)) return 0; for (const k of t) { const a = l.find((x) => x.action_type === k); if (a) return Number(a.value) || 0; } return 0; };
export default async (req) => {
  const N = Math.max(7, Math.min(60, parseInt(new URL(req.url).searchParams.get('dias'), 10) || 45));
  const ate = diaBR(), de = diaBR(Date.now() - (N - 1) * 864e5);
  const out = { de, ate, dias: {}, campanhas: {} };
  try {
    // conta por dia
    const conta = await graphConta('GET', 'insights', { level: 'account', time_increment: 1, time_range: { since: de, until: ate }, fields: 'spend,actions,action_values,impressions,clicks', limit: 100 });
    (conta.data || []).forEach((x) => { out.dias[x.date_start] = { gasto: +(+x.spend || 0).toFixed(2), comprasMeta: acao(x.actions, COMPRA), valorMeta: +acao(x.action_values, COMPRA).toFixed(2), cliques: +x.clicks || 0, imp: +x.impressions || 0 }; });
    // campanha por dia (com paginação)
    let pg = await graphConta('GET', 'insights', { level: 'campaign', time_increment: 1, time_range: { since: de, until: ate }, fields: 'campaign_id,campaign_name,spend,actions', limit: 500 });
    let voltas = 0;
    while (pg) {
      (pg.data || []).forEach((x) => {
        const c = out.campanhas[x.campaign_id] || (out.campanhas[x.campaign_id] = { nome: x.campaign_name, d: {} });
        c.d[x.date_start] = [+(+x.spend || 0).toFixed(2), acao(x.actions, COMPRA)];
      });
      const nx = pg.paging && pg.paging.next; if (!nx || ++voltas > 20) break;
      pg = await fetch(nx).then((r) => r.json()).catch(() => null);
    }
    // status/orçamento atual
    try { const l = await graphConta('GET', 'campaigns', { fields: 'name,effective_status,daily_budget,created_time', limit: 400 });
      (l.data || []).forEach((x) => { const c = out.campanhas[x.id]; if (c) { c.status = x.effective_status; c.orc = x.daily_budget ? +x.daily_budget / 100 : null; c.criada = String(x.created_time || '').slice(0, 10); } }); } catch (e) {}
  } catch (e) { out.erroMeta = String(e.message || e); }
  // vendas do site por dia (pedidos pagos)
  const lista = []; for (let i = 0; i < N; i++) lista.push(diaBR(Date.now() - i * 864e5));
  const cont = await Promise.all(lista.map((d) => idsDoDia(d, 'pg').then((ids) => ids.length).catch(() => null)));
  lista.forEach((d, i) => { (out.dias[d] = out.dias[d] || {}).pagosSite = cont[i]; });
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="estudo-lucro.json"' } });
};
