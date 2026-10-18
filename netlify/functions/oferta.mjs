import { statusOferta } from './_oferta.mjs';

// GET /.netlify/functions/oferta?id=<pedido pago> → { valida, expiraEm, motivo }
export default async (req) => {
  try {
    const id = new URL(req.url).searchParams.get('id') || '';
    const st = await statusOferta(id);
    return new Response(JSON.stringify(st), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('oferta:', e && e.message);
    return new Response(JSON.stringify({ valida: false, motivo: 'erro' }), { headers: { 'Content-Type': 'application/json' } });
  }
};
