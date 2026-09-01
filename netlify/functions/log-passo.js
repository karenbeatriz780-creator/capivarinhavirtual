import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const id = body && body.id;
    const passo = body && body.passo;
    if (!id || !passo) return json({ erro: 'Dados incompletos.' }, 400);

    const store = getStore('funil');
    const atual = await store.get(id, { type: 'json' });
    const agora = Date.now();
    const registro = {
      id,
      produto: body.produto || (atual && atual.produto) || null,
      passo,
      indice: body.indice || null,
      primeiraVez: (atual && atual.primeiraVez) || agora,
      ultimaVez: agora
    };
    await store.setJSON(id, registro);
    return json({ ok: true });
  } catch (e) {
    console.error('log-passo (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
