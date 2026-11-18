// 🏦 O Pix deu erro no banco do cliente? Gera o código de novo com a chave do OUTRO banco (Nubank ⇄ Bradesco).
// POST {id} → {payload}
import { getStore } from '@netlify/blobs';
import { brcode, refPedido, lerCfgPix, PIX_MANUAL, PIX_RESERVA } from './_pixmanual.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  const st = getStore('presentes'), g = await st.get(id, { type: 'json' }).catch(() => null);
  if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);
  if (g.pago) return json({ ok: true, pago: true });
  const valor = Number(g.pagamento && g.pagamento.valor) || 0;
  if (!(valor > 0)) return json({ erro: 'Gere o pagamento primeiro.' }, 409);
  const cfg = await lerCfgPix();
  const outra = cfg.banco === 'bradesco' ? PIX_MANUAL : PIX_RESERVA; // o contrário do que está em uso
  const payload = brcode(valor, refPedido(id), outra);
  g.pagamento = Object.assign({}, g.pagamento, { payload, copiaECola: payload, bancoTrocado: outra.banco, bancoTrocadoEm: Date.now() });
  await st.setJSON(id, g);
  return json({ ok: true, payload, banco: outra.banco });
};
