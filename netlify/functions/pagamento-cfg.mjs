import { ipLigada } from './_infinitepay.mjs';
// Público: diz pro site se o pagamento está pela InfinitePay (Pix ou cartão) — só pra ajustar o texto dos botões.
export default async () => {
  let ip = false; try { ip = await ipLigada(); } catch (e) {}
  return new Response(JSON.stringify({ ip }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
};
