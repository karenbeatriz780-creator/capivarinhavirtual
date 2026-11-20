// ⭐ Painel → aba "Modo especial": você escolhe uma campanha (pesquisa pelo nome), define o orçamento e ativa.
// O robô passa a vigiar com a regra do modo especial (R$ 30 sem venda ou R$ 40 com 1 venda → desliga e avisa).
// GET → campanhas + as que estão no modo especial · POST {acao:'ativar', id, orc} · POST {acao:'tirar', id}
import { getStore } from '@netlify/blobs';
import { graph, graphConta, aplicarAcao, logRobo } from './_meta.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function definirOrcamento(id, reais) {
  const c = await graph('GET', id, { fields: 'daily_budget,name' });
  if (Number(c.daily_budget) > 0) { await graph('POST', id, { daily_budget: String(Math.round(reais * 100)) }); return; }
  const r = await graph('GET', id + '/adsets', { fields: 'id,daily_budget,effective_status', limit: 50 });
  const cs = (r.data || []).filter((x) => Number(x.daily_budget) > 0 && !/DELETED|ARCHIVED/.test(String(x.effective_status || '')));
  if (!cs.length) throw new Error('não achei orçamento diário nessa campanha');
  const tot = cs.reduce((t, x) => t + Number(x.daily_budget), 0);
  for (const x of cs) await graph('POST', x.id, { daily_budget: String(Math.max(100, Math.round(reais * 100 * Number(x.daily_budget) / tot))) });
}
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos');
  try {
    const cfg = (await L.get('especial_cfg', { type: 'json' }).catch(() => null)) || { ids: [] };
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const id = String(b.id || ''); if (!/^\d{5,30}$/.test(id)) return json({ erro: 'Campanha inválida.' }, 400);
      const c = await graph('GET', id, { fields: 'name,effective_status' });
      if (b.acao === 'tirar') {
        cfg.ids = (cfg.ids || []).filter((x) => x !== id); await L.setJSON('especial_cfg', cfg);
        await logRobo({ tipo: 'alerta', camp: c.name, id, motivo: '⭐ você tirou do modo especial (volta às regras normais do robô)' }).catch(() => {});
        return json({ ok: true });
      }
      const orc = Number(b.orc);
      if (orc > 0) { if (orc < 6 || orc > 5000) return json({ erro: 'Orçamento entre R$ 6 e R$ 5.000.' }, 400); await definirOrcamento(id, orc); }
      if (c.effective_status !== 'ACTIVE') await aplicarAcao({ id, nome: c.name }, 'ativar', 'você (modo especial)');
      if ((cfg.ids || []).indexOf(id) < 0) cfg.ids = (cfg.ids || []).concat([id]);
      await L.setJSON('especial_cfg', cfg);
      await logRobo({ tipo: 'ativou', camp: c.name, id, motivo: '⭐ você ativou o MODO ESPECIAL' + (orc > 0 ? ' com R$ ' + orc.toFixed(2).replace('.', ',') + '/dia' : '') + ': R$ 30 sem venda ou R$ 40 com 1 venda → desliga e avisa' }).catch(() => {});
      return json({ ok: true });
    }
    const lista = await graphConta('GET', 'campaigns', { fields: 'name,effective_status,daily_budget,created_time', limit: 400 });
    const campanhas = (lista.data || []).filter((x) => !/ARCHIVED|DELETED/.test(String(x.effective_status || '')))
      .map((x) => ({ id: String(x.id), nome: x.name, status: x.effective_status, orc: Number(x.daily_budget) > 0 ? Number(x.daily_budget) / 100 : null, criada: x.created_time }))
      .sort((a, b) => String(b.criada || '').localeCompare(String(a.criada || '')));
    return json({ ids: cfg.ids || [], campanhas });
  } catch (e) { return json({ erro: e.message }, 500); }
};
