// LIVRO MÁGICO — entrega as imagens guardadas.
//  img/tema/<id>          → capas de vitrine (públicas)
//  ex/<id>/capa|pN        → exemplos escolhidos no painel (públicos)
//  img/<pedido>/capa      → capa do livro (com o token do livro)
//  img/<pedido>/p1..p5    → ilustrações (só com o livro PAGO)
//  foto/<pedido>          → foto enviada (só com o token; é o que a IA usa de referência)
import { getStore } from '@netlify/blobs';
import { loja } from './_livros.mjs';

function nao(status) { return new Response('não encontrado', { status: status || 404, headers: { 'Cache-Control': 'no-store' } }); }

export default async (req) => {
  try {
    const u = new URL(req.url);
    const k = (u.searchParams.get('k') || '').trim();
    const t = (u.searchParams.get('t') || '').trim();
    let publico = false;
    if (/^img\/tema\/[a-z0-9-]{1,40}$/.test(k) || /^ex\/(?:L[0-9a-f]{14}|F[0-9a-f]{10})\/(?:capa|p[1-9]|p1[0-9])$/.test(k)) publico = true;
    else {
      const mm = /^(?:img|foto)\/(L[0-9a-f]{14})(?:\/(capa|p[1-9]|p1[0-9]))?$/.exec(k);
      if (!mm) return nao(400);
      const g = await getStore('presentes').get(mm[1], { type: 'json' }).catch(() => null);
      if (!g || !g.livro || !t || t !== g.livro.token) return nao();
      if (k.indexOf('img/') === 0 && /^p\d+$/.test(mm[2] || '') && !g.pago) return nao(403);
    }
    const r = await loja().getWithMetadata(k, { type: 'arrayBuffer' }).catch(() => null);
    if (!r || !r.data) return nao();
    return new Response(r.data, {
      status: 200,
      headers: {
        'Content-Type': (r.metadata && r.metadata.tipo) || 'image/png',
        'Cache-Control': publico ? 'public, max-age=86400' : 'private, max-age=86400'
      }
    });
  } catch (e) {
    console.error('livro-img:', e && e.message);
    return nao(500);
  }
};
