// Gera uma prévia personalizada (nome da pessoa + foto) pra quando o
// link do presente é compartilhado no WhatsApp/Instagram/etc, e depois
// manda quem clicou pro app de verdade. Isso só é possível porque essa
// rota usa um caminho de URL "de verdade" (/p/:id), diferente do resto
// do site que usa #/p/:id — o navegador nunca envia a parte depois do
// # pro servidor, então sem essa rota a prévia sempre seria genérica.
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    const origem = url.origin;

    let titulo = 'Você tem um presente especial esperando! 💕';
    let descricao = 'Alguém preparou algo especial pra você no Capivarinha Love.';

    if (id) {
      try {
        const { getStore } = await import('@netlify/blobs');
        const g = await getStore('presentes').get(id, { type: 'json' });
        if (g && g.pago) {
          if (g.parceiroNome) titulo = 'Um presente especial pra você, ' + g.parceiroNome + '! 💕';
          if (g.titulo) descricao = g.titulo;
        }
      } catch {}
    }

    const imagem = origem + '/.netlify/functions/foto-og?id=' + encodeURIComponent(id);
    const destino = origem + '/#/p/' + encodeURIComponent(id);

    const html = '<!DOCTYPE html><html lang="pt-BR"><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + esc(titulo) + '</title>' +
      '<meta name="description" content="' + esc(descricao) + '">' +
      '<meta property="og:title" content="' + esc(titulo) + '">' +
      '<meta property="og:description" content="' + esc(descricao) + '">' +
      '<meta property="og:image" content="' + esc(imagem) + '">' +
      '<meta property="og:type" content="website">' +
      '<meta property="og:url" content="' + esc(destino) + '">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta http-equiv="refresh" content="0; url=' + esc(destino) + '">' +
      '</head><body style="font-family:sans-serif;text-align:center;padding-top:3rem">' +
      '<script>location.replace(' + JSON.stringify(destino) + ');</script>' +
      '<p>Abrindo seu presente... <a href="' + esc(destino) + '">clique aqui se não abrir sozinho</a>.</p>' +
      '</body></html>';

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('og:', e && e.stack || e);
    const destino = new URL(req.url).origin + '/';
    return new Response(
      '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=' + destino + '"></head><body>Redirecionando...</body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
};
