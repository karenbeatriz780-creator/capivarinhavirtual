// LIVRO MÁGICO — mesma coisa que o livro-img, mas com endereço "de arquivo" (termina em .jpg).
// A IA de imagem baixa a foto da criança por aqui: alguns serviços só leem direito
// quando o link parece um arquivo de imagem.
//   /lv-foto/<pedido>/foto-<token>.jpg     → foto enviada
//   /lv-foto/<pedido>/capa-<token>.jpg     → capa gerada
import { getStore } from '@netlify/blobs';
import { loja, tipoImagem } from './_livros.mjs';

export const config = { path: '/lv-foto/*' };

function nao(status) { return new Response('não encontrado', { status: status || 404, headers: { 'Cache-Control': 'no-store' } }); }

export default async (req) => {
  try {
    const u = new URL(req.url);
    const m = /\/lv-foto\/(L[0-9a-f]{14})\/(foto|capa|x[1-3])-([0-9a-f]{24})\.(?:jpg|jpeg|png)$/i.exec(u.pathname);
    if (!m) return nao(400);
    const [, id, nome, token] = m;
    const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.livro || token.toLowerCase() !== g.livro.token) return nao();
    // x1, x2, x3 = fotos de quem vai junto na história (mãe, pai, bichinho…)
    const k = nome === 'foto' ? 'foto/' + id : /^x[1-3]$/i.test(nome) ? 'foto/' + id + '/' + nome.toLowerCase() : 'img/' + id + '/capa';
    const r = await loja().getWithMetadata(k, { type: 'arrayBuffer' }).catch(() => null);
    if (!r || !r.data) return nao();
    const buf = Buffer.from(r.data);
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': tipoImagem(buf, 'image/jpeg'), 'Content-Length': String(buf.length), 'Cache-Control': 'private, max-age=3600' }
    });
  } catch (e) {
    console.error('livro-foto:', e && e.message);
    return nao(500);
  }
};
