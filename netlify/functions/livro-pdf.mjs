// LIVRO MÁGICO — entrega os PDFs prontos (link "de arquivo", que o WhatsApp consegue baixar)
//   /lv-pdf/<pedido>/<ler|folhas|livreto|previa>-<token>.pdf  (a prévia abre sem pagar)
import { getStore } from '@netlify/blobs';
import { loja } from './_livros.mjs';

export const config = { path: '/lv-pdf/*' };

function nao(status) { return new Response('não encontrado', { status: status || 404, headers: { 'Cache-Control': 'no-store' } }); }

export default async (req) => {
  try {
    const m = /\/lv-pdf\/(L[0-9a-f]{14})\/(ler|folhas|livreto|previa-livreto|previa)-([0-9a-f]{24})\.pdf$/i.exec(new URL(req.url).pathname);
    if (!m) return nao(400);
    const [, id, tipo, token] = m;
    const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.livro || (!g.pago && !/^previa/.test(tipo)) || token.toLowerCase() !== g.livro.token) return nao();
    const r = await loja().get('pdf/' + id + '/' + tipo + '.pdf', { type: 'arrayBuffer' }).catch(() => null);
    if (!r) return nao();
    const buf = Buffer.from(r);
    const nome = 'Livro-Magico-' + String(g.livro.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-') + (tipo === 'ler' ? '' : '-' + tipo) + '.pdf';
    return new Response(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(buf.length), 'Content-Disposition': 'inline; filename="' + nome + '"', 'Cache-Control': /^previa/.test(tipo) ? 'no-store' : 'private, max-age=3600' } });
  } catch (e) {
    console.error('livro-pdf:', e && e.message);
    return nao(500);
  }
};
