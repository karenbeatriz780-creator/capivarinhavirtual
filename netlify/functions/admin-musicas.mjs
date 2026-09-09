import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function autorizado(req) {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha) return false;
  const enviada = req.headers.get('x-admin-key') || '';
  return enviada === senha;
}

export default async (req) => {
  try {
    if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    const store = getStore('musicas');
    const { blobs } = await store.list();

    const musicas = [];
    for (const b of blobs) {
      const m = await store.get(b.key, { type: 'json' });
      if (m) musicas.push(m);
    }
    // mais recentes primeiro
    musicas.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    return json({ ok: true, musicas });
  } catch (e) {
    console.error('admin-musicas (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
