import { ipLigada } from './_infinitepay.mjs';
import { stripeLigado, pk } from './_stripe.mjs';
// Público: diz pro site se o pagamento está pela InfinitePay e se o cartão/Apple Pay/Google Pay (Stripe) está ligado.
// A chave publicável (pk_) é pública por natureza — a secreta nunca sai do servidor.
export default async () => {
  let ip = false, st = false; try { ip = await ipLigada(); } catch (e) {}
  try { st = await stripeLigado(); } catch (e) {}
  return new Response(JSON.stringify({ ip, stripe: st, pk: st ? pk() : '' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
};
