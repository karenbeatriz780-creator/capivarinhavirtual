import { getStore } from '@netlify/blobs';
import { ESPERA_JA_PAGUEI } from './_pixmanual.mjs';
// ✅ "Já paguei" do Pix manual (sem comprovante): o cliente toca no botão e o pedido libera sozinho
// ESPERA_JA_PAGUEI depois do clique (quem libera é presente.mjs, que o site consulta a cada poucos segundos).
// POST {id}  →  { ok, jaPago?, liberaEm }
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Envio inválido.' }, 400); }
  const id = String(b.id || '').trim();
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  const pres = getStore('presentes');
  const g = await pres.get(id, { type: 'json' }).catch(() => null);
  if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);
  if (g.pago) return json({ ok: true, jaPago: true });
  if (g.cancelado) return json({ erro: 'Esse pedido foi cancelado.' }, 400);
  const pg = g.pagamento || {};
  if (pg.provedor !== 'manual') return json({ erro: 'Esse pedido não está no Pix manual.' }, 400);
  if (!pg.jaPagueiEm) { // só vale o 1º clique (clicar de novo não adia a liberação)
    g.pagamento = Object.assign({}, pg, { jaPagueiEm: Date.now(), status: 'DECLARADO' });
    await pres.setJSON(id, g);
  }
  return json({ ok: true, liberaEm: (g.pagamento.jaPagueiEm || Date.now()) + ESPERA_JA_PAGUEI });
};
