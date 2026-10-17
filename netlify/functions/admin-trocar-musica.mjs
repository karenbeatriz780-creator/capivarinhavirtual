import { getStore } from '@netlify/blobs';

// Painel: troca a música de um pedido pela versão nova gerada no painel
// (depois de ajustar a letra). O link do cliente passa a tocar a nova.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function autorizado(req) {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha) return false;
  return (req.headers.get('x-admin-key') || '') === senha;
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const id = body && body.id;
    const url = String((body && body.url) || '').trim();
    if (!id || !/^https?:\/\//.test(url)) return json({ erro: 'Faltou o pedido ou a música.' }, 400);

    const store = getStore('presentes');
    const g = await store.get(id, { type: 'json' });
    if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);

    const url2 = String((body && body.url2) || '').trim();
    const letra = String((body && body.letra) || '').trim();
    const atualizado = Object.assign({}, g, {
      musicaPreviewUrl: url,
      musicaPreviewUrl2: /^https?:\/\//.test(url2) ? url2 : null,
      musicaPreviewId: String((body && body.taskId) || '') || g.musicaPreviewId || null,
      musicaLetra: letra || g.musicaLetra || null,
      musicaLetraTexto: letra || g.musicaLetraTexto || null,
      musicaTrocadaEm: Date.now()
    });
    await store.setJSON(id, atualizado);
    return json({ ok: true });
  } catch (e) {
    console.error('admin-trocar-musica (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
