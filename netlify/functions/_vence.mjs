import { getStore } from '@netlify/blobs';
// ⏳ 24/11 (regra do Gusthavo): a música paga fica no site por 15 dias. Depois some (não toca nem baixa).
// "Para sempre" (R$ 5, pedido <id>-x-sempre-1) tira o prazo. Pedidos antigos contam os 15 dias a partir de 24/11.
export const PRAZO_DIAS = 15;
export const LANCAMENTO = Date.parse('2026-11-24T14:00:00Z');
export const venceEm = (g) => Math.max((g && (g.pagoEm || g.criadoEm)) || 0, LANCAMENTO) + PRAZO_DIAS * 864e5;
export const idSempre = (id) => id + '-x-sempre-1';
// pagou o "para sempre"? (marca no pedido principal na primeira vez que vê)
export async function ehParaSempre(g) {
  if (!g) return false;
  if (g.paraSempre) return true;
  // clipe + retrato (na hora do Pix ou no combo especial) também deixa pra sempre (24/11)
  const ex = g.extrasPix || [];
  if (g.especial || (ex.indexOf('clipe') >= 0 && ex.indexOf('quadro') >= 0)) return true;
  const pres = getStore('presentes');
  let x = await pres.get(idSempre(g.id), { type: 'json' }).catch(() => null);
  if (!x || !x.pago || x.cancelado) x = await pres.get(g.id + '-x-cq-1', { type: 'json' }).catch(() => null); // oferta R$ 7,99 inclui o "para sempre"
  if (!x || !x.pago || x.cancelado) return false;
  g.paraSempre = true;
  try { const a = await pres.get(g.id, { type: 'json' }); if (a && !a.paraSempre) { a.paraSempre = true; await pres.setJSON(g.id, a); } } catch (e) {}
  return true;
}
export async function musicaExpirou(g) {
  if (!g || !g.pago || g.cancelado) return false;
  if (Date.now() < venceEm(g)) return false;
  return !(await ehParaSempre(g));
}
