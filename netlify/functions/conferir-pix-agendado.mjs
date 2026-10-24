import { getStore } from '@netlify/blobs';
import { indexarDia } from './_indice.mjs';
import { obterToken, listarPixRecebidos, aplicarPagamento } from './_efi.mjs';

// CONFERE O BANCO SOZINHO, A CADA 5 MINUTOS.
// Pega todos os Pix que caíram na conta nas últimas 48 h e libera o pedido
// ligado a cada um (pelo txid da cobrança). Assim, mesmo se o aviso automático
// da Efí (webhook) falhar, ninguém fica pago e sem a música.
// Pix que caiu e não tem pedido ligado fica guardado pro painel mostrar.
export const config = { schedule: '*/5 * * * *' };

export default async () => {
  const t0 = Date.now();
  const presentes = getStore('presentes'), txStore = getStore('efi-txid'), idx = getStore('indices');
  let liberados = 0, vistos = 0;
  const semPedido = [];
  try {
    const token = await obterToken();
    const pixes = await listarPixRecebidos(token, new Date(Date.now() - 48 * 3600 * 1000), new Date(Date.now() + 60000), 10);
    for (const p of pixes) {
      if (Date.now() - t0 > 22000) break;
      vistos++;
      const pagador = (p.gnExtras && p.gnExtras.pagador && p.gnExtras.pagador.nome) || (p.pagador && p.pagador.nome) || '';
      const item = { e2eid: p.endToEndId || null, txid: p.txid || null, valor: p.valor || null, horario: p.horario || null, pagador, info: p.infoPagador || '' };
      if (!p.txid) { semPedido.push(item); continue; }
      try {
        const mapa = await txStore.get(p.txid, { type: 'json' });
        const g = mapa && mapa.giftId ? await presentes.get(mapa.giftId, { type: 'json' }) : null;
        if (!g) { semPedido.push(item); continue; }
        if (g.pago || g.cancelado) continue;
        aplicarPagamento(g, { e2eid: p.endToEndId || null, valor: p.valor || null }, 'conferencia-automatica');
        const h = p.horario && Date.parse(p.horario); if (h) { g.pagoEm = h; g.pagamento.pagoEm = h; }
        await presentes.setJSON(g.id, g);
      try { await indexarDia('pg', g.id, g.pagoEm); } catch (e) {}
        liberados++;
        console.log('liberado automático:', g.id, p.valor);
      } catch (e) { console.error('conferir-pix: ', p.txid, e && e.message); }
    }
  } catch (e) { console.error('conferir-pix-agendado:', e && e.message); }
  try { await idx.setJSON('pix-sem-pedido', { em: Date.now(), itens: semPedido.slice(0, 50) }); } catch (e) {}
  try { await idx.setJSON('pix-conferencia', { em: Date.now(), liberados, vistos }); } catch (e) {}
  console.log('conferência automática:', { vistos, liberados, semPedido: semPedido.length });
};
