// LIVRO MÁGICO — "Meus livros": acha os livros pelo WhatsApp usado no pedido
// GET ?tel=<número>
import { getStore } from '@netlify/blobs';
import { json } from './_livros.mjs';
import { idsDoTel, lerIndice, chaveTel } from './_indice.mjs';

export default async (req) => {
  try {
    const tel = new URL(req.url).searchParams.get('tel') || '';
    if (!chaveTel(tel)) return json({ erro: 'Digite o WhatsApp com DDD.' }, 400);
    const ent = await idsDoTel(tel, await lerIndice());
    const ids = ent.p.filter((id) => /^L[0-9a-f]{14}$/.test(id)).slice(-20);
    const presentes = getStore('presentes');
    const gs = (await Promise.all(ids.map((id) => presentes.get(id, { type: 'json' }).catch(() => null))))
      .filter((g) => g && g.livro && !g.cancelado);
    const livros = gs.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).map((g) => {
      const L = g.livro;
      return {
        id: g.id, t: L.token, nome: L.nome, genero: L.genero, tema: L.tema, pago: !!g.pago, pronto: L.status === 'pronto',
        criadoEm: g.criadoEm || null,
        capa: L.capa && L.capa.ok ? '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + g.id + '/capa') + '&t=' + L.token : null
      };
    });
    return json({ ok: true, livros });
  } catch (e) {
    console.error('livro-meus:', e && e.stack || e);
    return json({ erro: 'Não consegui buscar agora.' }, 500);
  }
};
