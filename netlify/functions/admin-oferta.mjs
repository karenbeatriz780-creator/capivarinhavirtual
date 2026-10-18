import { getStore } from '@netlify/blobs';

// Painel: reabre a oferta "4 músicas por R$ 9,99" por mais 48h pra um cliente antigo.
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    const senha = (process.env.ADMIN_SENHA || '').trim();
    if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha incorreta.' }, 401);
    const body = await req.json().catch(() => ({}));
    const id = body && body.id;
    if (!id) return json({ erro: 'Faltou o pedido.' }, 400);
    const store = getStore('presentes');
    const g = await store.get(id, { type: 'json' });
    if (!g || !g.pago) return json({ erro: 'Pedido não encontrado ou não pago.' }, 404);
    g.ofertaLiberadaAte = Date.now() + 48 * 3600 * 1000;
    await store.setJSON(id, g);
    await getStore('ofertas').delete(id); // zera o "já usada" pra valer de novo
    return json({ ok: true, ate: g.ofertaLiberadaAte });
  } catch (e) {
    console.error('admin-oferta:', e && e.stack || e);
    return json({ erro: 'Erro inesperado.' }, 500);
  }
};
