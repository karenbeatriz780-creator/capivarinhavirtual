// ⚡ 26/11 21h (pedido do Gusthavo): liga AGORA as 3 campanhas que mais se destacaram (uma vez só).
// As regras do robô continuam valendo nelas (R$ 7 sem compra → desliga; apareceu compra → religa).
// Roda só no dia 26/11 e só uma vez — depois é só apagar este arquivo.
import { getStore } from '@netlify/blobs';
import { aplicarAcao, logRobo, avisar } from './_meta.mjs';
export const config = { schedule: '* * * * *' };
const CAMPS = [
  { id: '120248835316230265', nome: '11v · cópia' },
  { id: '120248847970630265', nome: '🔁 Capivarinha #010 · Praia 2' },
  { id: '120248805427620265', nome: 'Capivarinha #003 · Black' }
];
export default async () => {
  if (Date.now() > Date.parse('2026-11-27T03:00:00Z')) return; // só até meia-noite de 26/11
  const L = getStore('gastos'), FLAG = 'ligar3_20261126';
  if (await L.get(FLAG).catch(() => null)) return;
  await L.set(FLAG, String(Date.now())).catch(() => {});
  const ok = [], erro = [];
  for (const c of CAMPS) {
    try { await aplicarAcao(c, 'ativar', 'robô (pedido do Gusthavo)'); ok.push(c.nome);
      await logRobo({ tipo: 'religou', camp: c.nome, id: c.id, motivo: '⚡ liguei a pedido do Gusthavo (uma das 3 que mais se destacaram)' }).catch(() => {}); }
    catch (e) { erro.push(c.nome + ': ' + e.message); }
  }
  await avisar('⚡ Liguei agora (pedido seu): ' + ok.join(', ') + (erro.length ? '\n⚠️ Não consegui: ' + erro.join('; ') : '') + '\nAs regras do robô continuam valendo nelas.').catch(() => {});
};
