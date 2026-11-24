import { getStore } from '@netlify/blobs';
import { pegarAudio, responderAudio } from './_audio.mjs';
import { musicaExpirou } from './_vence.mjs';

// Toca a música de um pedido PAGO pelo nosso domínio (link permanente).
//   /.netlify/functions/audio?id=<pedido>&v=1..6
export default async (req) => {
  try {
    const u = new URL(req.url);
    const id = (u.searchParams.get('id') || '').trim();
    const v = Math.min(6, Math.max(1, parseInt(u.searchParams.get('v'), 10) || 1));
    if (!id || id.length > 100) return new Response('Pedido inválido.', { status: 400 });
    const g = await getStore('presentes').get(id, { type: 'json' });
    if (!g) return new Response('Pedido não encontrado.', { status: 404 });
    if (!g.pago || g.cancelado) {
      // não pago: manda pra prévia de 70s
      return new Response(null, { status: 302, headers: { Location: '/.netlify/functions/previa-musica?id=' + encodeURIComponent(id) + '&v=' + v, 'Cache-Control': 'no-store' } });
    }
    if (await musicaExpirou(g)) return new Response('Essa música ficou disponível por 15 dias e expirou. Pra recuperar e deixar pra sempre (R$ 5), abra o link do seu pedido.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    const buf = await pegarAudio(g, v);
    if (!buf) return new Response('Não consegui carregar essa música agora.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    return responderAudio(req, buf, { 'Content-Disposition': 'inline; filename="musica.mp3"' });
  } catch (e) {
    console.error('audio:', e && e.stack || e);
    return new Response('Erro no servidor.', { status: 500 });
  }
};
