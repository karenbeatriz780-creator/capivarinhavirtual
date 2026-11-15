// 🔔 Aviso automático do Stripe: pagamento aprovado → libera a música e manda 1 mensagem no WhatsApp.
// (Reserva do confirmar pelo site: funciona mesmo se a pessoa fechar a página logo depois de pagar.)
import { webhookValido, confirmarSessaoStripe } from './_stripe.mjs';
import { entregarPedidoPagoZap } from './_zap.mjs';

export default async (req, context) => {
  const corpo = await req.text();
  if (!(await webhookValido(corpo, req.headers.get('stripe-signature')))) return new Response('assinatura inválida', { status: 400 });
  let ev = {}; try { ev = JSON.parse(corpo); } catch (e) { return new Response('ok'); }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].indexOf(ev.type) >= 0) {
    const s = (ev.data && ev.data.object) || {};
    try {
      const g = await confirmarSessaoStripe(s.id, 'stripe-webhook');
      if (g) { const ent = entregarPedidoPagoZap(g).catch(() => {}); if (context && context.waitUntil) context.waitUntil(ent); else await ent; }
    } catch (e) { console.error('stripe-webhook:', e.message); return new Response('erro', { status: 500 }); }
  }
  return new Response('ok');
};
