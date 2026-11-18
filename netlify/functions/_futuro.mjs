// ⭐ "Campanha com futuro" (regra de 17/11): na última semana fez pelo menos 3 vendas a até R$ 9,50 cada. EUA: 1+ venda até R$ 30.
// Só essas o robô liga à meia-noite. ROAS 1,5 é META DA CONTA (geral), NÃO é regra pra desligar campanha (17/11 21h).
import { diaBR } from './_resumo.mjs';
export const FUT_VENDAS = 3, ROAS_MIN = 1.5, FUT_CPA_EUA = 30;
export const ehEUA = (nome) => /(^|[^a-z])(eua|usa|us)([^a-z]|$)/i.test(String(nome || ''));
// ticket médio da campanha (vendas do site com extras); sem dado → R$ 9,99
export function ticketDe(id, site) { const s = site && site[id]; return s && s.vendas > 0 && s.valor > 0 ? Math.max(9.99, s.valor / s.vendas) : 9.99; }
export const CPA_LIM = 9.5;
export const cpaMaxDe = () => CPA_LIM; // limite por campanha: R$ 9,50 por venda (média)
export function futuro(c, site, agora) {
  const s = (site && site[c.id]) || { porDia: {} };
  let g = 0, v = 0;
  for (let i = 0; i < 7; i++) { const d = diaBR((agora || Date.now()) - i * 864e5), x = (c.dias || {})[d] || {}; g += x.gasto || 0; v += Math.max(x.compras || 0, (s.porDia || {})[d] || 0); }
  const eua = ehEUA(c.nome), cpa = v ? g / v : null, lim = cpaMaxDe(c.id, site);
  const tem = eua ? (v >= 1 && cpa <= FUT_CPA_EUA) : (v >= FUT_VENDAS && cpa <= lim);
  return { tem, vendas: v, gasto: +g.toFixed(2), cpa: cpa == null ? null : +cpa.toFixed(2), roas: g ? +((v * ticketDe(c.id, site)) / g).toFixed(2) : null, lim, eua };
}
// 🏆 As 10 melhores (17/11 21h): mais vendas na última semana com custo médio até R$ 9,50 (empate: mais barata). Brasil só.
export const TOP_N = 10;
export function top10(campanhas, site, agora, excluir) {
  const fora = excluir || new Set();
  return (campanhas || []).filter((c) => !ehEUA(c.nome) && !fora.has(String(c.id)))
    .map((c) => ({ id: String(c.id), f: futuro(c, site, agora) }))
    .filter((x) => x.f.vendas >= 1 && x.f.cpa != null && x.f.cpa <= CPA_LIM)
    .sort((a, b) => b.f.vendas - a.f.vendas || a.f.cpa - b.f.cpa)
    .slice(0, TOP_N).map((x) => x.id);
}
