import { confirmarPagamentoIP } from './_infinitepay.mjs';
import { entregarPedidoPagoZap } from './_zap.mjs';
// O cliente pagou na InfinitePay e voltou pro site: confere com a InfinitePay e manda pra página da música.
export default async (req, context) => {
  const u = new URL(req.url), q = (k) => u.searchParams.get(k) || '';
  const id = q('id') || q('order_nsu');
  let pago = false;
  try {
    const g = await confirmarPagamentoIP({ order_nsu: id, transaction_nsu: q('transaction_nsu'), slug: q('slug') || q('invoice_slug'), origem: 'infinitepay-retorno' });
    pago = !!(g && g.pago);
    if (pago) { const t = entregarPedidoPagoZap(g).catch(() => {}); if (context && context.waitUntil) context.waitUntil(t); else await t; }
  } catch (e) { console.error('infinitepay-retorno:', e && e.message); }
  const destino = 'https://capivarinhalove.com.br/#/' + (pago ? 'p/' + encodeURIComponent(id) + '/c' : 'pagar/' + encodeURIComponent(id));
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
};
