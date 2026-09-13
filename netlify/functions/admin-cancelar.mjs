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
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const id = body && body.id;
    if (!id) return json({ erro: 'Faltou o id do pedido.' }, 400);

    const store = getStore('presentes');
    const g = await store.get(id, { type: 'json' });
    if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);

    const agora = Date.now();
    const atualizado = Object.assign({}, g, {
      pago: false,
      cancelado: true,
      canceladoEm: agora,
      expiraEm: agora, // corta o acesso na hora
      pagamento: Object.assign({}, g.pagamento || {}, { status: 'CANCELADA', canceladoEm: agora })
    });

    await store.setJSON(id, atualizado);
    return json({ ok: true, id });
  } catch (e) {
    console.error('admin-cancelar (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
