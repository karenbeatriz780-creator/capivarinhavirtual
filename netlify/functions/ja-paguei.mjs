import { liberarSemComprovante } from './_comprovante.mjs';
// "Já paguei" no Pix manual → libera na hora (regra sem comprovante). POST {id}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  try { const g = await liberarSemComprovante(id, 'ja-paguei'); return json({ ok: true, pago: !!(g && g.pago) }); }
  catch (e) { console.error('ja-paguei:', e && e.message); return json({ erro: 'Tente de novo.' }, 500); }
};
