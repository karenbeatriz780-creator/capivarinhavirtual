// ⭐ "Campanha com futuro" (regra de 17/11): na última semana fez pelo menos 3 vendas
// com custo médio por venda até R$ 9,50 (EUA: 1+ venda até R$ 30). Só essas o robô liga à meia-noite.
import { diaBR } from './_resumo.mjs';
export const FUT_VENDAS = 3, FUT_CPA = 9.5, FUT_CPA_EUA = 30;
export const ehEUA = (nome) => /(^|[^a-z])(eua|usa|us)([^a-z]|$)/i.test(String(nome || ''));
export function futuro(c, site, agora) {
  const s = (site && site[c.id]) || { porDia: {} };
  let g = 0, v = 0;
  for (let i = 0; i < 7; i++) { const d = diaBR((agora || Date.now()) - i * 864e5), x = (c.dias || {})[d] || {}; g += x.gasto || 0; v += Math.max(x.compras || 0, (s.porDia || {})[d] || 0); }
  const eua = ehEUA(c.nome), cpa = v ? g / v : null;
  const tem = eua ? (v >= 1 && cpa <= FUT_CPA_EUA) : (v >= FUT_VENDAS && cpa <= FUT_CPA);
  return { tem, vendas: v, gasto: +g.toFixed(2), cpa: cpa == null ? null : +cpa.toFixed(2), eua };
}
