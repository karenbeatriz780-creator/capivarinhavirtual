import { getStore } from '@netlify/blobs';

// INDIQUE E GANHE: cada amigo indicado que PAGAR vale 1 música grátis (2 versões)
// pra quem indicou. Guarda: indicados (pedidos que vieram pelo link) e usados
// (pedidos grátis que o cliente já resgatou).
export async function statusIndicacao(refId) {
  if (!refId) return { confirmadas: 0, usadas: 0, disponiveis: 0 };
  const reg = (await getStore('indicacoes').get(refId, { type: 'json' })) || {};
  const presentes = getStore('presentes');
  let confirmadas = 0;
  for (const id of (reg.indicados || []).slice(-60)) {
    const g = await presentes.get(id, { type: 'json' });
    if (g && g.pago && !g.cancelado && !g.bonusDe) confirmadas++;
  }
  const usadas = (reg.usados || []).length;
  return { confirmadas, usadas, disponiveis: Math.max(0, confirmadas - usadas) };
}
export async function registrarIndicado(refId, novoId) {
  const store = getStore('indicacoes');
  const reg = (await store.get(refId, { type: 'json' })) || {};
  reg.indicados = reg.indicados || [];
  if (reg.indicados.indexOf(novoId) === -1) reg.indicados.push(novoId);
  await store.setJSON(refId, reg);
}
export async function registrarUso(refId, novoId) {
  const store = getStore('indicacoes');
  const reg = (await store.get(refId, { type: 'json' })) || {};
  reg.usados = reg.usados || [];
  if (reg.usados.indexOf(novoId) === -1) reg.usados.push(novoId);
  await store.setJSON(refId, reg);
}
