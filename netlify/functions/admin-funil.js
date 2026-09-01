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

    const store = getStore('funil');
    const { blobs } = await store.list();

    const visitas = [];
    for (const b of blobs) {
      const v = await store.get(b.key, { type: 'json' });
      if (v) visitas.push(v);
    }
    visitas.sort((a, b) => (b.ultimaVez || 0) - (a.ultimaVez || 0));

    return json({ ok: true, visitas });
  } catch (e) {
    console.error('admin-funil (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
