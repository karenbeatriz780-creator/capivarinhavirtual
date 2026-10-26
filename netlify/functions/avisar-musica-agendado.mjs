import { getStore } from '@netlify/blobs';
import { entregarMusica, SITE } from './_zap.mjs';

// A CADA MINUTO: confere as músicas que estão sendo criadas e, quando ficam
// prontas, manda no WhatsApp do cliente (mesmo que ele tenha fechado o site).
export const config = { schedule: '* * * * *' };

const LIMITE = 3 * 3600 * 1000; // depois de 3 h desiste

export default async () => {
  const loja = getStore('whatsapp');
  let lista = [];
  try { lista = ((await loja.list({ prefix: 'pend_' })).blobs || []).slice(0, 40); } catch (e) { return; }
  if (!lista.length) return;
  await Promise.all(lista.map(async (b) => {
    try {
      const p = await loja.get(b.key, { type: 'json' }).catch(() => null);
      if (!p || !p.taskId || Date.now() - (p.em || 0) > LIMITE) { await loja.delete(b.key); return; }
      let r = await entregarMusica(p.taskId, p.numero);
      if (r === 'esperando') {
        // pergunta ao serviço de música se ficou pronta (isso grava o link)
        await fetch(SITE + '/.netlify/functions/gerar-musica-status?taskId=' + encodeURIComponent(p.taskId)).catch(() => {});
        r = await entregarMusica(p.taskId, p.numero);
      }
      if (r === 'enviado' || r === 'ja' || r === 'naoachei') await loja.delete(b.key);
      // 'semjanela' fica na fila: se o cliente chamar no WhatsApp depois, sai na hora
    } catch (e) { console.error('avisar-musica:', b.key, e && e.message); }
  }));
};
