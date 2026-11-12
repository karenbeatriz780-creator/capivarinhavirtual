import { getStore } from '@netlify/blobs';
import { liberarSemComprovante } from './_comprovante.mjs';
import { ESPERA_LIBERAR } from './_pixmanual.mjs';
// A cada minuto: Pix manual gerado há 1 minuto ou mais → libera a música (mesmo se a pessoa saiu da tela).
// Depois o aviso de "pagamento confirmado" do WhatsApp sai normalmente (avisar-pagos-agendado).
export const config = { schedule: '* * * * *' };
export default async () => {
  const loja = getStore('comprovantes');
  const ks = ((await loja.list({ prefix: 'pend_' })).blobs || []).map((b) => b.key);
  for (const k of ks.slice(0, 200)) {
    try {
      const p = await loja.get(k, { type: 'json' }).catch(() => null);
      if (!p) { await loja.delete(k).catch(() => {}); continue; }
      if (Date.now() - (p.em || 0) < ESPERA_LIBERAR) continue;
      const g = await liberarSemComprovante(p.id, 'auto-1min');
      if (!g || g.pago || g.cancelado || Date.now() - (p.em || 0) > 3 * 864e5) await loja.delete(k).catch(() => {});
    } catch (e) { console.error('liberar-manual:', e && e.message); }
  }
};
