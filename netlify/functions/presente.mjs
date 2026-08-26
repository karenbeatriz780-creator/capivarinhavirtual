// netlify/functions/presente.mjs
// Devolve o presente salvo no Blobs — é isso que faz o link abrir no celular
// de quem recebe, não só no aparelho de quem criou.
import { getStore } from '@netlify/blobs';

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ erro: 'id ausente' }, 400);

  const store = getStore('presentes');
  const presente = await store.get(id, { type: 'json' });

  if (!presente) return json({ encontrado: false }, 404);
  if (!presente.pago) return json({ encontrado: true, pago: false });

  return json({ encontrado: true, pago: true, presente: presente });
};
