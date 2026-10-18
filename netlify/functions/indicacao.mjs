import { statusIndicacao } from './_indicacao.mjs';

// GET ?id=<pedido de quem indicou> → { confirmadas, usadas, disponiveis }
export default async (req) => {
  try {
    const id = new URL(req.url).searchParams.get('id') || '';
    const st = await statusIndicacao(id);
    return new Response(JSON.stringify(st), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ confirmadas: 0, usadas: 0, disponiveis: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }
};
