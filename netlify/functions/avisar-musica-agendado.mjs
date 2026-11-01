import { getStore } from '@netlify/blobs';
import { entregarMusica, enviarTexto, conversaAberta, SITE } from './_zap.mjs';
import { entregarPreviaLivro, avancarLivro, motorRodando } from './_livros.mjs';

// A CADA MINUTO: confere as músicas que estão sendo criadas e, quando ficam
// prontas, manda no WhatsApp do cliente (mesmo que ele tenha fechado o site).
export const config = { schedule: '*/3 * * * *' };

const LIMITE = 3 * 3600 * 1000; // depois de 3 h desiste

export default async () => {
  const loja = getStore('whatsapp');
  // LIVRO MÁGICO: prévias que o cliente pediu pra receber no WhatsApp
  try {
    const lv = ((await loja.list({ prefix: 'lvpend_' })).blobs || []).slice(0, 20);
    await Promise.all(lv.map(async (b) => {
      try {
        const p = await loja.get(b.key, { type: 'json' }).catch(() => null);
        if (!p || !p.id || Date.now() - (p.em || 0) > LIMITE) { await loja.delete(b.key); return; }
        if (await motorRodando(p.id)) return; // o motor rápido já está cuidando (e manda sozinho)
        const r = await entregarPreviaLivro(p.id, p.t, p.numero, process.env.URL || SITE);
        if (r !== 'esperando' && r !== 'erro') { await loja.delete(b.key); return; }
        // passou de 1 minuto e ainda não ficou pronta: avisa uma vez que está finalizando
        if (r === 'esperando' && !p.avisou && Date.now() - (p.em || 0) > 60 * 1000) {
          const para = await conversaAberta(p.numero);
          if (para) await enviarTexto(para, '⏳ Estamos finalizando a capa, a música e a primeira ilustração… só mais um pouquinho! Já já chega aqui. 💛').catch(() => {});
          p.avisou = Date.now(); await loja.setJSON(b.key, p);
        }
      } catch (e) { console.error('avisar-livro:', b.key, e && e.message); }
    }));
  } catch (e) {}
  // LIVROS que você liberou no painel (ex.: livro de exemplo): termina as imagens
  try {
    const adm = ((await loja.list({ prefix: 'lvadm_' })).blobs || []).slice(0, 10);
    for (const b of adm) {
      const p = await loja.get(b.key, { type: 'json' }).catch(() => null);
      if (!p || !p.id || Date.now() - (p.em || 0) > 6 * 3600 * 1000) { await loja.delete(b.key); continue; }
      const g = await avancarLivro(p.id, process.env.URL || SITE).catch(() => null);
      if (!g || (g.livro && g.livro.status === 'pronto' && !g.livro.autoExemplo)) await loja.delete(b.key);
    }
  } catch (e) { console.error('avisar-livro-adm:', e && e.message); }
  let lista = [];
  try { lista = ((await loja.list({ prefix: 'pend_' })).blobs || []).slice(0, 40); } catch (e) { return; }
  if (!lista.length) return;
  await Promise.all(lista.map(async (b) => {
    try {
      const p = await loja.get(b.key, { type: 'json' }).catch(() => null);
      if (!p || !p.taskId || Date.now() - (p.em || 0) > LIMITE) {
        await loja.delete(b.key); return;
      }
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
