import { confirmarPagamentoIP } from './_infinitepay.mjs';
import { entregarPedidoPagoZap } from './_zap.mjs';
// Aviso da InfinitePay: o pagamento foi feito → confere (payment_check) e libera + manda a música no WhatsApp.
export default async (req, context) => {
  if (req.method !== 'POST') return new Response('ok');
  let b = {}; try { b = await req.json(); } catch (e) { return new Response('ok'); }
  console.log('INFINITEPAY webhook:', JSON.stringify(b).slice(0, 400));
  try {
    const g = await confirmarPagamentoIP({ order_nsu: b.order_nsu, transaction_nsu: b.transaction_nsu, slug: b.invoice_slug || b.slug, origem: 'infinitepay-webhook' });
    if (g && g.pago) { const t = entregarPedidoPagoZap(g).catch(() => {}); if (context && context.waitUntil) context.waitUntil(t); else await t; }
  } catch (e) { console.error('infinitepay-webhook:', e && e.message); return new Response('erro', { status: 400 }); }
  return new Response('ok');
};
