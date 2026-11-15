// 💳 STRIPE: cartão, Apple Pay e Google Pay DENTRO do site (Checkout embutido). O Pix continua no Nubank.
// Chaves no Netlify: STRIPE_SECRET_KEY (sk_live_…) e STRIPE_PUBLISHABLE_KEY (pk_live_…). Nunca no código.
// A ligação do aviso automático (webhook) e o domínio do Apple Pay são criados sozinhos na 1ª compra.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { aplicarPagamento } from './_efi.mjs';
import { indexarDia } from './_indice.mjs';

const VERSAO = '2024-06-20'; // versão fixa da API (ui_mode "embedded")
export const SITE_ST = (process.env.URL || 'https://capivarinhalove.com.br').replace(/\/$/, '');
const sk = () => (process.env.STRIPE_SECRET_KEY || '').trim();
export const pk = () => (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
const loja = () => getStore('gastos');

export async function stripeLigado() {
  if (!/^sk_(live|test)_/.test(sk()) || !/^pk_(live|test)_/.test(pk())) return false;
  const c = (await getStore('gastos').get('cfg_pixmanual', { type: 'json' }).catch(() => null)) || {};
  return c.stripe !== false; // ligado por padrão; dá pra desligar no painel (🧾 Pix manual)
}

function enc(o, pre, out) {
  out = out || [];
  Object.keys(o).forEach((k) => {
    const v = o[k], key = pre ? pre + '[' + k + ']' : k;
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => { if (x && typeof x === 'object') enc(x, key + '[' + i + ']', out); else out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(x)); });
    else if (typeof v === 'object') enc(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  });
  return out;
}
export async function st(metodo, caminho, dados) {
  const url = 'https://api.stripe.com/v1/' + caminho + (metodo === 'GET' && dados ? '?' + enc(dados).join('&') : '');
  const r = await fetch(url, { method: metodo, headers: { Authorization: 'Bearer ' + sk(), 'Stripe-Version': VERSAO, 'Content-Type': 'application/x-www-form-urlencoded' }, body: metodo === 'GET' ? undefined : enc(dados || {}).join('&') });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) { const e = new Error((d.error && d.error.message) || ('Stripe erro ' + r.status)); e.stripe = d.error; throw e; }
  return d;
}

// 1ª vez: cria o aviso automático (webhook) e cadastra o domínio pro Apple Pay. Guarda o segredo do webhook no Blobs.
export async function prepararStripe() {
  const k = 'stripe_setup_' + sk().slice(-6);
  const s = (await loja().get(k, { type: 'json' }).catch(() => null)) || {};
  let mudou = false;
  if (!s.whSecret) {
    try {
      const w = await st('POST', 'webhook_endpoints', { url: SITE_ST + '/.netlify/functions/stripe-webhook', enabled_events: ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], description: 'Capivarinha Love — libera a música quando o pagamento passa' });
      s.whSecret = w.secret; s.whId = w.id; mudou = true;
    } catch (e) { console.error('stripe webhook:', e.message); }
  }
  if (!s.dominio) {
    for (const dom of ['capivarinhalove.com.br', 'www.capivarinhalove.com.br']) {
      try { await st('POST', 'payment_method_domains', { domain_name: dom }); } catch (e) { if (!/already|exist/i.test(e.message)) console.error('stripe domínio', dom, e.message); }
    }
    s.dominio = Date.now(); mudou = true;
  }
  if (mudou) await loja().setJSON(k, s).catch(() => {});
  return s;
}

// cria a sessão de pagamento embutida (cartão / Apple Pay / Google Pay) com o MESMO valor do pedido
export async function criarSessaoStripe(g) {
  await prepararStripe().catch(() => {});
  const moeda = (g.pagamento && g.pagamento.moeda) || 'brl';
  const valor = moeda === 'brl' ? Number((g.pagamento && g.pagamento.valor) || g.precoFinal || 0) : Number(g.pagamento.valorMoeda || 0);
  const cents = Math.round(valor * 100);
  if (!(cents >= 100)) throw new Error('Valor do pedido inválido.');
  const en = g.idioma === 'en';
  const nome = en ? 'Personalized Song' : g.produto === 'livro' ? 'Livro Mágico personalizado' : 'Música personalizada';
  const s = await st('POST', 'checkout/sessions', {
    ui_mode: 'embedded', mode: 'payment', redirect_on_completion: 'never',
    payment_method_types: ['card'], // cartão + Apple Pay + Google Pay (carteiras entram junto com o cartão)
    line_items: [{ quantity: 1, price_data: { currency: moeda, unit_amount: cents, product_data: { name: nome + ' · Capivarinha Love' } } }],
    client_reference_id: g.id, metadata: { pedido: g.id }, payment_intent_data: { metadata: { pedido: g.id }, description: nome + ' ' + g.id },
    locale: en ? 'en' : 'pt-BR',
    customer_email: g.email && /@/.test(g.email) ? g.email : undefined
  });
  return { clientSecret: s.client_secret, sessao: s.id, valor };
}

// confere no Stripe e libera o pedido (usado pelo site e pelo webhook)
export async function confirmarSessaoStripe(sessaoId, origem) {
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(String(sessaoId || ''))) return null;
  const s = await st('GET', 'checkout/sessions/' + sessaoId);
  const id = (s.metadata && s.metadata.pedido) || s.client_reference_id;
  if (!id || s.payment_status !== 'paid') return null;
  const pres = getStore('presentes'), g = await pres.get(id, { type: 'json' }).catch(() => null);
  if (!g) return null;
  if (g.pago) return g;
  const moeda = (g.pagamento && g.pagamento.moeda) || 'brl';
  const esperado = Math.round(Number(moeda === 'brl' ? ((g.pagamento && g.pagamento.valor) || 0) : (g.pagamento.valorMoeda || 0)) * 100);
  if (String(s.currency || 'brl').toLowerCase() !== moeda) { console.error('stripe: moeda diferente', id, s.currency, moeda); return null; }
  if (esperado && Number(s.amount_total || 0) + 1 < esperado) { console.error('stripe: valor menor que o pedido', id, s.amount_total, esperado); return null; }
  let valorReais = Number(s.amount_total || 0) / 100;
  if (moeda !== 'brl') { // venda em dólar: guarda quanto entrou em REAIS (é o que o painel soma)
    valorReais = Number(g.pagamento.valor) || 0;
    try {
      const pi = await st('GET', 'payment_intents/' + s.payment_intent, { expand: ['latest_charge.balance_transaction'] });
      const bt = pi && pi.latest_charge && pi.latest_charge.balance_transaction;
      if (bt && bt.currency === 'brl' && bt.amount > 0) { valorReais = bt.amount / 100; g.pagamento.taxaStripe = (bt.fee || 0) / 100; g.pagamento.liquido = (bt.net || 0) / 100; }
    } catch (e) { console.error('stripe: conversão', e.message); }
    g.pagamento.valor = Math.round(valorReais * 100) / 100;
  }
  aplicarPagamento(g, { e2eid: String(s.payment_intent || s.id), valor: valorReais }, origem || 'stripe');
  g.pagamento.provedor = 'stripe';
  Object.assign(g.pagamento, { stSessao: s.id, stIntent: s.payment_intent || null, stCentavos: s.amount_total || null });
  await pres.setJSON(id, g);
  try { await indexarDia('pg', g.id, g.pagoEm); } catch (e) {}
  try { await getStore('comprovantes').delete('pend_' + id); } catch (e) {}
  return g;
}

// assinatura do aviso do Stripe (Stripe-Signature: t=…,v1=…)
export async function webhookValido(corpo, cab) {
  const s = (await loja().get('stripe_setup_' + sk().slice(-6), { type: 'json' }).catch(() => null)) || {};
  const seg = (process.env.STRIPE_WEBHOOK_SECRET || s.whSecret || '').trim();
  if (!seg || !cab) return false;
  const p = {}; String(cab).split(',').forEach((x) => { const [a, b] = x.split('='); (p[a] = p[a] || []).push(b); });
  const t = (p.t || [])[0]; if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const esp = crypto.createHmac('sha256', seg).update(t + '.' + corpo).digest('hex');
  return (p.v1 || []).some((v) => v && v.length === esp.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(esp)));
}
