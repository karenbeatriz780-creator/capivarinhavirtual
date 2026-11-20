// 📈 Painel → aba "Aumento": você sobe +10% no orçamento CAMPANHA POR CAMPANHA (botão), 1 vez por dia cada.
// Mostra as que já subiram hoje e as que faltam, e a projeção de vendas/lucro até o fim do mês.
// GET → campanhas ligadas com números dos últimos 5 dias + quem já subiu hoje + custos (imposto, IA por venda)
// POST {acao:'subirUm', id} → sobe +10% agora (bloqueia essa campanha até amanhã)
// POST {teto} → salva o teto (opcional)
import { getStore } from '@netlify/blobs';
import { graphConta, logRobo, vendasSitePorCampanha } from './_meta.mjs';
import { metaAds, TICKET } from './_gastos.mjs';
import { aplicarAumento } from './_aumento.mjs';
import { diaBR, imposto, vendasDoDia, gastoIADia } from './_resumo.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const PCT = 10;
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos'), agora = Date.now(), hoje = diaBR(agora), kHoje = 'aum_dia_' + hoje;
  try {
    const cfg = (await L.get('aumento_cfg', { type: 'json' }).catch(() => null)) || {};
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      if (b.acao === 'subirUm') {
        const id = String(b.id || ''); if (!/^\d{5,30}$/.test(id)) return json({ erro: 'Campanha inválida.' }, 400);
        const feitosHoje = (await L.get(kHoje, { type: 'json' }).catch(() => null)) || {};
        if (feitosHoje[id]) return json({ erro: 'Essa campanha já subiu hoje. Amanhã libera de novo.' }, 409);
        const meta = await metaAds(7, null, null, true);
        if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta Ads não está ligado.' }, 400);
        const r = await aplicarAumento(meta.campanhas, [id], Number(cfg.teto) > 0 ? Number(cfg.teto) : null, PCT, 'você (+10%)');
        const ok = r.find((f) => f.tipo === 'subiu');
        if (!ok) return json({ erro: (r[0] && r[0].motivo) || 'Não subiu (campanha desligada, sem orçamento ou já no teto).' }, 409);
        feitosHoje[id] = { em: agora, motivo: ok.motivo }; await L.setJSON(kHoje, feitosHoje);
        await logRobo(Object.assign({}, ok, { motivo: ok.motivo.replace('aumento diário', 'você subiu') })).catch(() => {});
        return json({ ok: true, motivo: ok.motivo });
      }
      const teto = Number(b.teto) > 0 ? Math.round(Number(b.teto) * 100) / 100 : null;
      await L.setJSON('aumento_cfg', Object.assign({}, cfg, { teto, auto: false, em: agora }));
      return json({ ok: true, teto });
    }
    const dias5 = [0, 1, 2, 3, 4].map((i) => diaBR(agora - i * 864e5));
    const diasPassados = [1, 2, 3, 4, 5].map((i) => diaBR(agora - i * 864e5)); // pro custo de IA por venda (dias fechados)
    const [lista, meta, site, ...extra] = await Promise.all([
      graphConta('GET', 'campaigns', { fields: 'name,effective_status,daily_budget', limit: 400 }),
      metaAds(7, null, null, true), vendasSitePorCampanha(10),
      ...diasPassados.map((d) => vendasDoDia(d).catch(() => ({ qtd: 0, valor: 0 }))),
      ...diasPassados.map((d) => gastoIADia(d).catch(() => 0))
    ]);
    const vd = extra.slice(0, 5), ia = extra.slice(5);
    const vendasTot = vd.reduce((t, v) => t + (v.qtd || 0), 0), iaTot = ia.reduce((t, v) => t + (Number(v) || 0), 0);
    const iaPorVenda = vendasTot ? +(iaTot / vendasTot).toFixed(2) : 0;
    const mc = {}; (meta.campanhas || []).forEach((c) => { mc[String(c.id)] = c; });
    const feitosHoje = (await L.get(kHoje, { type: 'json' }).catch(() => null)) || {};
    const campanhas = (lista.data || []).filter((x) => x.effective_status === 'ACTIVE').map((x) => {
      const id = String(x.id), c = mc[id] || { dias: {} }, s = site[id] || { porDia: {} };
      let g = 0, v = 0; dias5.forEach((d) => { const z = (c.dias || {})[d] || {}; g += z.gasto || 0; v += Math.max(z.compras || 0, (s.porDia || {})[d] || 0); });
      const ticket = s.vendas > 0 && s.valor > 0 ? +(s.valor / s.vendas).toFixed(2) : TICKET();
      return { id, nome: x.name, orc: Number(x.daily_budget) > 0 ? Number(x.daily_budget) / 100 : (c.orcamentoDia || null),
        gasto5: +g.toFixed(2), vendas5: v, cpa: v ? +(g / v).toFixed(2) : null, ticket, subiuHoje: feitosHoje[id] ? feitosHoje[id].em : null };
    }).sort((a, b) => (!!a.subiuHoje - !!b.subiuHoje) || (b.vendas5 - a.vendas5));
    const [a, m] = hoje.split('-').map(Number), fimMes = new Date(Date.UTC(a, m, 0)).getUTCDate(), diasRestantes = fimMes - Number(hoje.slice(8)) + 1;
    return json({ hoje, diasRestantes, imposto: imposto(), iaPorVenda, teto: cfg.teto || null, campanhas });
  } catch (e) { return json({ erro: e.message }, 500); }
};
