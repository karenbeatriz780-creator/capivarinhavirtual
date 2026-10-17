import { getStore } from '@netlify/blobs';

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
    const v = u.searchParams.get('v') === '2' ? 2 : 1;
    if (!id) return erro('Faltou o pedido.', 400);

    const g = await getStore('presentes').get(id, { type: 'json' });
    if (!g) return erro('Pedido não encontrado.', 404);
    if (!g.pago || g.cancelado) return erro('Esse download libera depois do pagamento.', 403);
    if (g.expiraEm && Date.now() > g.expiraEm) return erro('Esse link expirou.', 403);

    const url = v === 2 ? g.musicaPreviewUrl2 : g.musicaPreviewUrl;
    if (!url) return erro('Música não encontrada.', 404);

    const origem = await fetch(url);
    if (!origem.ok || !origem.body) return erro('Não consegui pegar a música agora. Tenta de novo.', 502);

    const para = g.musicaParaNome || g.parceiroNome || 'presente';
    const arquivo = 'musica-' + nomeArquivo(para) + (v === 2 ? '-versao-2' : '') + '.mp3';
    const headers = {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="' + arquivo + '"',
      'Cache-Control': 'private, max-age=3600'
    };
    const tam = origem.headers.get('content-length');
    if (tam) headers['Content-Length'] = tam;
    // repassa o arquivo em "streaming" (não precisa carregar tudo na memória)
    return new Response(origem.body, { status: 200, headers });
  } catch (e) {
    console.error('baixar-musica:', e && e.stack || e);
    return erro('Erro inesperado.', 500);
  }
};
