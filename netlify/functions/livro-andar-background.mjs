// LIVRO MÁGICO — "motor" rápido: fica acompanhando o livro a cada 3 segundos
// (em vez de esperar o agendador de 3 em 3 minutos). Pede a capa, a 1ª ilustração e a música,
// confere, baixa, refaz na hora se der erro, e manda a prévia no WhatsApp assim que fica pronta.
// Depois do pagamento, faz o mesmo com as outras ilustrações.
// POST { id }   (segundo plano: pode rodar até 15 min; aqui para bem antes)
import { getStore } from '@netlify/blobs';
import { loja, avancarLivro, entregarPreviaLivro, previaPronta } from './_livros.mjs';
import { SITE, enviarTexto, conversaAberta } from './_zap.mjs';

const PASSO = 2000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^L[0-9a-f]{14}$/.test(id)) return;
  const trava = 'andar/' + id, eu = Math.random().toString(36).slice(2);
  // já tem um motor rodando pra esse livro? então não começa outro (evita pedir a mesma imagem 2 vezes)
  const atual = await loja().get(trava, { type: 'json' }).catch(() => null);
  if (atual && atual.ate > Date.now() && atual.eu) return;
  await loja().setJSON(trava, { eu, ate: Date.now() + 20000 });
  const base = process.env.URL || SITE, zap = getStore('whatsapp'), inicio = Date.now();
  try {
    for (;;) {
      const t = await loja().get(trava, { type: 'json' }).catch(() => null);
      if (t && t.eu !== eu) return; // outro motor assumiu
      await loja().setJSON(trava, { eu, ate: Date.now() + 20000 });
      let g = null;
      try { g = await avancarLivro(id, base, { motor: true }); } catch (e) { console.error('livro-andar', id, e && e.message); }
      if (!g || !g.livro) break;
      // cliente pediu a prévia no WhatsApp: manda assim que ficar pronta
      if (!g.pago) {
        const pend = await zap.get('lvpend_' + id, { type: 'json' }).catch(() => null);
        if (pend && previaPronta(g)) {
          const r = await entregarPreviaLivro(id, pend.t, pend.numero, base).catch(() => 'erro');
          if (r !== 'esperando' && r !== 'erro') await zap.delete('lvpend_' + id).catch(() => {});
        } else if (pend && !pend.avisou && Date.now() - (pend.em || 0) > 45 * 1000) {
          // passou de 45 s: avisa uma vez que está finalizando
          pend.avisou = Date.now(); await zap.setJSON('lvpend_' + id, pend).catch(() => {});
          const para = await conversaAberta(pend.numero);
          if (para) await enviarTexto(para, '⏳ Estamos finalizando a capa, a música e a primeira ilustração… só mais um pouquinho! Já já chega aqui. 💛').catch(() => {});
        }
        const tudo = previaPronta(g) && !!g.musicaPreviewUrl;
        if (tudo && !pend) break;
        if (Date.now() - inicio > 9 * 60 * 1000) break;
      } else {
        if (g.livro.status === 'pronto') break; // com problema: continua tentando
        if (Date.now() - inicio > 13 * 60 * 1000) break;
      }
      await dormir(PASSO);
    }
  } finally {
    const t = await loja().get(trava, { type: 'json' }).catch(() => null);
    if (t && t.eu === eu) await loja().delete(trava).catch(() => {});
  }
};
