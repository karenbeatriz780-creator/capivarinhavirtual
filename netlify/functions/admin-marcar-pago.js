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

    // dias: quantos dias o link fica liberado a partir de agora.
    // null/ausente = sem expiração (pra sempre).
    const dias = (body.dias === null || body.dias === undefined || body.dias === '') ? null : Number(body.dias);
    if (dias !== null && (!isFinite(dias) || dias <= 0)) {
      return json({ erro: 'Número de dias inválido.' }, 400);
    }

    const store = getStore('presentes');
    const g = await store.get(id, { type: 'json' });
    if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);

    const agora = Date.now();
    const atualizado = Object.assign({}, g, {
      pago: true,
      expiraEm: dias !== null ? agora + dias * 24 * 60 * 60 * 1000 : null,
      pagamento: Object.assign({}, g.pagamento || {}, {
        status: 'CONCLUIDA',
        confirmadoManualmente: true,
        confirmadoEm: agora
      })
    });

    await store.setJSON(id, atualizado);

    return json({ ok: true, id, expiraEm: atualizado.expiraEm });
  } catch (e) {
    console.error('admin-marcar-pago (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
