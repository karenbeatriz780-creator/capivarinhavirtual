import { getStore } from '@netlify/blobs';

// OFERTA DE CLIENTE: quem pagou ganha, por 48h, UMA compra de
// "4 músicas (2 letras × 2 versões) por R$ 9,99" — uma vez por link/pedido.
export const OFERTA_MS = 48 * 3600 * 1000;

export function pagoEmDe(g) {
  return (g && (g.pagoEm || (g.pagamento && (g.pagamento.pagoEm || g.pagamento.confirmadoEm)) || g.criadoEm)) || 0;
}

export async function statusOferta(id) {
  if (!id) return { valida: false, motivo: 'pedido' };
  // PROMOÇÃO PESSOAL (link do painel / WhatsApp): só pra quem já tem pedido
  // (pagou ou desistiu) ou já gerou música no site.
  //   p.<id do pedido>   ou   t.<taskId da música>
  if (id.indexOf('p.') === 0) {
    const g = await getStore('presentes').get(id.slice(2), { type: 'json' });
    return g ? { valida: true, expiraEm: 0, promo: true } : { valida: false, motivo: 'pedido' };
  }
  if (id.indexOf('t.') === 0) {
    const m = await getStore('musicas').get(id.slice(2), { type: 'json' });
    return m ? { valida: true, expiraEm: 0, promo: true } : { valida: false, motivo: 'pedido' };
  }
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' });
  if (!g || !g.pago || g.cancelado || g.produto !== 'musica') return { valida: false, motivo: 'pedido' };
  // o painel pode reabrir a oferta por mais 48h pra cliente antigo (ofertaLiberadaAte)
  const expiraEm = Math.max(pagoEmDe(g) + OFERTA_MS, Number(g.ofertaLiberadaAte) || 0);
  if (Date.now() > expiraEm) return { valida: false, motivo: 'expirou', expiraEm };
  const reg = await getStore('ofertas').get(id, { type: 'json' });
  for (const nid of (reg && reg.tentativas) || []) {
    const n = await presentes.get(nid, { type: 'json' });
    if (n && n.pago && !n.cancelado) return { valida: false, motivo: 'usada', expiraEm, usadaPor: nid };
  }
  return { valida: true, expiraEm };
}

// Guarda qual pedido novo tentou usar a oferta (só conta como "usada" quando ele for pago)
export async function registrarTentativa(origem, novoId) {
  const store = getStore('ofertas');
  const reg = (await store.get(origem, { type: 'json' })) || { tentativas: [] };
  if (reg.tentativas.indexOf(novoId) === -1) reg.tentativas.push(novoId);
  reg.tentativas = reg.tentativas.slice(-20);
  await store.setJSON(origem, reg);
}
