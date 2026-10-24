import { getStore } from '@netlify/blobs';
import { pegarAudio, corpo } from './_audio.mjs';

// Download de verdade da música (só pra pedido PAGO).
// O link do MP3 é de outro site, então o celular só "toca" em vez de baixar.
// Aqui o arquivo passa pelo nosso domínio com "attachment" — aí o Android
// e o iPhone salvam o arquivo de fato.
//   /.netlify/functions/baixar-musica?id=<pedido>&v=1   (v=2 pra segunda versão)

function erro(msg, status) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
function nomeArquivo(txt) {
  return (String(txt || 'presente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'presente');
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get('id') || '';
    const v = Math.min(6, Math.max(1, parseInt(u.searchParams.get('v'), 10) || 1));
    if (!id) return erro('Faltou o pedido.', 400);

    const g = await getStore('presentes').get(id, { type: 'json' });
    if (!g) return erro('Pedido não encontrado.', 404);
    if (!g.pago || g.cancelado) return erro('Esse download libera depois do pagamento.', 403);
    if (g.expiraEm && Date.now() > g.expiraEm) return erro('Esse link expirou.', 403);

    const m1 = g.ofertaM1 || {}, m2 = g.ofertaM2 || {};
    // cópia permanente (não depende do link do serviço de música continuar no ar)
    const buf = await pegarAudio(g, v);
    if (!buf) return erro('Não consegui pegar a música agora. Tenta de novo em instantes.', 502);

    const mx = v > 4 ? m2 : m1;
    const para = (v > 2 ? (mx.paraNome || mx.estilo) : (g.musicaParaNome || g.musicaEstilo)) || g.parceiroNome || 'presente';
    const num = v > 4 ? '-2' : v > 2 ? '-1' : (g.ofertaM2 ? '-3' : g.ofertaM1 ? '-2' : '');
    const arquivo = 'musica' + num + '-' + nomeArquivo(para) + (v % 2 === 0 ? '-versao-2' : '-versao-1') + '.mp3';
    const headers = {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="' + arquivo + '"',
      'Cache-Control': 'private, max-age=3600'
    };
    headers['Content-Length'] = String(buf.length);
    return new Response(corpo(buf), { status: 200, headers });
  } catch (e) {
    console.error('baixar-musica:', e && e.stack || e);
    return erro('Erro inesperado.', 500);
  }
};
