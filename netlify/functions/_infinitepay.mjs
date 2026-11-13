import { getStore } from '@netlify/blobs';
import { aplicarPagamento } from './_efi.mjs';
import { indexarDia } from './_indice.mjs';
// 💳 INFINITEPAY — checkout integrado (Pix e cartão). O site cria um link por pedido; o cliente paga na página da InfinitePay;
// a InfinitePay avisa (webhook) e/ou devolve o cliente pro site com os dados do pagamento; o site CONFERE com a InfinitePay
// (payment_check) antes de liberar. Doc: https://www.infinitepay.io/checkout-documentacao
export const IP_HANDLE = (process.env.INFINITEPAY_HANDLE || 'gusthavo-santos-til').trim();
const IP = 'https://api.checkout.infinitepay.io';
const SITE = 'https://capivarinhalove.com.br';
const chave = () => (process.env.INFINITEPAY_API_KEY || '').trim();
const cab = () => Object.assign({ 'Content-Type': 'application/json' }, chave() ? { 'X-Api-Key': chave() } : {});
export async function ipLigada() {
  const c = (await getStore('gastos').get('cfg_pixmanual', { type: 'json' }).catch(() => null)) || {};
  return c.infinitepay !== false && !!IP_HANDLE; // ligada por padrão; desliga no painel (🧾 Pix manual)
}
function acharUrl(d) {
  if (!d || typeof d !== 'object') return null;
  for (const k of ['url', 'link', 'checkout_url', 'payment_url', 'link_url']) if (typeof d[k] === 'string' && /^https:\/\//.test(d[k])) return d[k];
  for (const v of Object.values(d)) { if (typeof v === 'string' && /^https:\/\/[^ ]*infinitepay/.test(v)) return v; if (v && typeof v === 'object') { const u = acharUrl(v); if (u) return u; } }
  return null;
}
function telBR(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? '+' + d : null;
}
// cria o link de pagamento do pedido. valor em reais. cli = { nome, tel } pra já vir preenchido na InfinitePay.
export async function criarLinkIP(id, valor, descricao, cli) {
  const cust = {}; const nm = String((cli && cli.nome) || '').replace(/[^\p{L} '.-]/gu, '').trim().slice(0, 60); const tl = telBR(cli && cli.tel);
  if (nm.length >= 2) cust.name = nm; if (tl) cust.phone_number = tl;
  try { return await criarLinkIP0(id, valor, descricao, Object.keys(cust).length ? cust : null); }
  catch (e) { if (!Object.keys(cust).length) throw e; console.error('InfinitePay recusou com dados do cliente, tentando sem:', e.message); return await criarLinkIP0(id, valor, descricao, null); }
}
async function criarLinkIP0(id, valor, descricao, customer) {
  const corpo = { handle: IP_HANDLE, order_nsu: String(id), items: [{ quantity: 1, price: Math.round(Number(valor) * 100), description: String(descricao || 'Música Personalizada').slice(0, 120) }],
    redirect_url: SITE + '/.netlify/functions/infinitepay-retorno?id=' + encodeURIComponent(id),
    webhook_url: SITE + '/.netlify/functions/infinitepay-webhook' };
  if (customer) corpo.customer = customer;
  if (chave()) corpo.options = { require_delivery_address: false }; // sem endereço (só funciona com a chave da API)
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(IP + '/links', { method: 'POST', headers: cab(), body: JSON.stringify(corpo), signal: ac.signal });
    const txt = await r.text(); let d = null; try { d = JSON.parse(txt); } catch (e) {}
    const url = acharUrl(d);
    if (!r.ok || !url) throw new Error('InfinitePay ' + r.status + ': ' + txt.slice(0, 200));
    return { url, resposta: d };
  } finally { clearTimeout(to); }
}
// confere com a InfinitePay se foi pago (precisa do transaction_nsu e do slug que vêm no webhook/retorno)
export async function conferirIP(order_nsu, transaction_nsu, slug) {
  if (!order_nsu || !transaction_nsu || !slug) return null;
  const r = await fetch(IP + '/payment_check', { method: 'POST', headers: cab(), body: JSON.stringify({ handle: IP_HANDLE, order_nsu: String(order_nsu), transaction_nsu: String(transaction_nsu), slug: String(slug) }) });
  return await r.json().catch(() => null);
}
// confere e, se pago, libera o pedido. Devolve o pedido (atualizado) ou null.
export async function confirmarPagamentoIP({ order_nsu, transaction_nsu, slug, origem }) {
  const pres = getStore('presentes'), id = String(order_nsu || '');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return null;
  const g = await pres.get(id, { type: 'json' }).catch(() => null);
  if (!g) return null;
  if (g.pago) return g;
  const c = await conferirIP(id, transaction_nsu, slug);
  if (!c || !c.success || !c.paid) { console.log('infinitepay: ainda não pago', id, JSON.stringify(c || {}).slice(0, 200)); return null; }
  const esperado = Math.round(Number((g.pagamento && g.pagamento.valor) || 0) * 100);
  if (esperado && Number(c.paid_amount || c.amount || 0) + 1 < esperado) { console.error('infinitepay: valor menor que o pedido', id, c.paid_amount, esperado); return null; }
  aplicarPagamento(g, { e2eid: String(transaction_nsu), valor: (Number(c.paid_amount || c.amount || 0) / 100) || null }, origem || 'infinitepay');
  g.pagamento.provedor = 'infinitepay';
  Object.assign(g.pagamento, { ipSlug: slug, ipTransacao: transaction_nsu, ipMetodo: c.capture_method || null, ipPagoCentavos: c.paid_amount || null });
  await pres.setJSON(id, g);
  try { await indexarDia('pg', g.id, g.pagoEm); } catch (e) {}
  try { await getStore('comprovantes').delete('pend_' + id); } catch (e) {}
  return g;
}
