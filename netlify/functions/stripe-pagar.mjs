// 💳 POST {acao:'sessao', id}            → cria o pagamento por cartão / Apple Pay / Google Pay (embutido no site)
//    POST {acao:'confirmar', id, sessao} → confere no Stripe e libera a música (e manda 1 mensagem no WhatsApp)
import { getStore } from '@netlify/blobs';
import { stripeLigado, criarSessaoStripe, confirmarSessaoStripe, pk } from './_stripe.mjs';
import { entregarPedidoPagoZap } from './_zap.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req, context) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  try {
    if (b.acao === 'sessao') {
      if (!(await stripeLigado())) return json({ erro: 'Pagamento por cartão indisponível agora. Use o Pix.' }, 409);
      const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
      if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);
      if (g.pago) return json({ ok: true, pago: true });
      if (!g.pagamento || !g.pagamento.valor) return json({ erro: 'Gere o pagamento primeiro.' }, 409);
      const s = await criarSessaoStripe(g);
      return json({ ok: true, clientSecret: s.clientSecret, sessao: s.sessao, pk: pk(), valor: s.valor });
    }
    if (b.acao === 'confirmar') {
      const g = await confirmarSessaoStripe(String(b.sessao || ''), 'stripe-site');
      if (!g || g.id !== id) return json({ ok: true, pago: false });
      const ent = entregarPedidoPagoZap(g).catch((e) => console.error('stripe zap', e && e.message));
      if (context && context.waitUntil) context.waitUntil(ent);
      return json({ ok: true, pago: true });
    }
    return json({ erro: 'Ação inválida.' }, 400);
  } catch (e) { console.error('stripe-pagar:', e.message); return json({ erro: 'Não consegui abrir o pagamento por cartão agora. Use o Pix ou tente de novo.' }, 502); }
};
