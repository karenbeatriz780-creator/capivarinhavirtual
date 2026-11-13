import { getStore } from '@netlify/blobs';
import { entregarMusica, SITE } from './_zap.mjs';

// AVISO RÁPIDO NO WHATSAPP: começa assim que a música é pedida.
// Espera ~45 s (a música quase nunca fica pronta antes) e depois pergunta
// a cada 12 s se ficou pronta. Assim que ficar, manda no WhatsApp na hora.
// Não desiste por até 12 minutos (o agendado a cada minuto continua de reserva).
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  let b = null;
  try { b = await req.json(); } catch (e) {}
  const taskId = String((b && b.taskId) || '');
  if (!taskId || taskId.length > 100) return;
  const loja = getStore('whatsapp');
  const base = process.env.URL || SITE;
  const ini = Date.now();
  // marca que tem vigia rápido cuidando (o agendado não mexe nesta música enquanto isso)
  await loja.setJSON('vig_' + taskId, { em: ini }).catch(() => {});
  await dormir(b && b.rapido ? 8000 : 45000); // pedido pelo WhatsApp: a música já está sendo feita há um tempo
  while (Date.now() - ini < 12 * 60 * 1000) {
    try {
      const p = await loja.get('pend_' + taskId, { type: 'json' }).catch(() => null);
      if (!p) return; // já foi entregue (ou cancelado)
      let r = await entregarMusica(taskId, p.numero);
      if (r === 'esperando') {
        await fetch(base + '/.netlify/functions/gerar-musica-status?taskId=' + encodeURIComponent(taskId)).catch(() => {});
        r = await entregarMusica(taskId, p.numero);
      }
      if (r === 'enviado' || r === 'ja' || r === 'naoachei') {
        await loja.delete('pend_' + taskId).catch(() => {});
        await loja.delete('vig_' + taskId).catch(() => {});
        console.log('avisar-musica rápido: ' + r + ' em ' + Math.round((Date.now() - ini) / 1000) + 's (' + taskId + ')');
        return;
      }
      if (r === 'semjanela') { await loja.delete('vig_' + taskId).catch(() => {}); return; } // fica na fila: sai quando o cliente chamar no WhatsApp
    } catch (e) { console.error('avisar-musica rápido:', taskId, e && e.message); }
    await dormir(12000);
  }
};
