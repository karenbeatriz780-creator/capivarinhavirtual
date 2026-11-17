// ⭐ "Campanha com futuro" (regra de 17/11): na última semana fez pelo menos 3 vendas com ROAS 1,5 ou mais
// (custo por venda até ticket médio ÷ 1,5 — R$ 6,66 numa venda de R$ 9,99). EUA: 1+ venda até R$ 30. Só essas o robô liga à meia-noite.
import { diaBR } from './_resumo.mjs';
export const FUT_VENDAS = 3, ROAS_MIN = 1.5, FUT_CPA_EUA = 30;
export const ehEUA = (nome) => /(^|[^a-z])(eua|usa|us)([^a-z]|$)/i.test(String(nome || ''));
// ticket médio da campanha (vendas do site com extras); sem dado → R$ 9,99
export function ticketDe(id, site) { const s = site && site[id]; return s && s.vendas > 0 && s.valor > 0 ? Math.max(9.99, s.valor / s.vendas) : 9.99; }
export const cpaMaxDe = (id, site) => +(ticketDe(id, site) / ROAS_MIN).toFixed(2);
export function futuro(c, site, agora) {
  const s = (site && site[c.id]) || { porDia: {} };
  let g = 0, v = 0;
  for (let i = 0; i < 7; i++) { const d = diaBR((agora || Date.now()) - i * 864e5), x = (c.dias || {})[d] || {}; g += x.gasto || 0; v += Math.max(x.compras || 0, (s.porDia || {})[d] || 0); }
  const eua = ehEUA(c.nome), cpa = v ? g / v : null, lim = cpaMaxDe(c.id, site);
  const tem = eua ? (v >= 1 && cpa <= FUT_CPA_EUA) : (v >= FUT_VENDAS && cpa <= lim);
  return { tem, vendas: v, gasto: +g.toFixed(2), cpa: cpa == null ? null : +cpa.toFixed(2), roas: g ? +((v * ticketDe(c.id, site)) / g).toFixed(2) : null, lim, eua };
}
