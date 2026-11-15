// ✉️ Entrega por e-mail (site em inglês /us). Usa o Resend: chave RESEND_API_KEY no Netlify.
// Sem a chave, não faz nada (a música continua liberando na tela na hora).
// Remetente: EMAIL_FROM (ex.: "Capivarinha Love <songs@capivarinhalove.com.br>") — o domínio precisa estar verificado no Resend.
import { getStore } from '@netlify/blobs';

const SITE = (process.env.URL || 'https://capivarinhalove.com.br').replace(/\/$/, '');
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const linkMusicaUS = (g) => SITE + '/us/#/song/' + g.id;

export async function enviarEmail(para, assunto, html, texto) {
  const k = (process.env.RESEND_API_KEY || '').trim();
  if (!k || !/@/.test(String(para || ''))) return { ok: false, motivo: k ? 'sem e-mail' : 'sem chave' };
  const de = (process.env.EMAIL_FROM || 'Capivarinha Love <songs@capivarinhalove.com.br>').trim();
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: de, to: [String(para).trim()], subject: assunto, html, text: texto })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('resend:', r.status, JSON.stringify(d).slice(0, 300)); return { ok: false, motivo: 'erro ' + r.status }; }
  return { ok: true, id: d.id };
}

// manda 1 e-mail com o link da música (uma vez por pedido)
export async function entregarPedidoEmail(g) {
  if (!g || !g.pago || g.cancelado || !g.email) return false;
  const loja = getStore('emails');
  if (await loja.get('pago_' + g.id, { type: 'json' }).catch(() => null)) return false;
  const link = linkMusicaUS(g), para = String(g.musicaParaNome || '').trim();
  const nome = String(g.meuNome || '').trim().split(/\s+/)[0];
  const assunto = '🎵 Your song' + (para ? ' for ' + para : '') + ' is ready!';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#1E0B18;padding:28px 16px;color:#fff">' +
    '<div style="max-width:520px;margin:0 auto;background:#2B1022;border-radius:18px;padding:28px 24px;text-align:center">' +
    '<div style="font-size:44px">🎵</div>' +
    '<h1 style="font-size:24px;margin:10px 0 6px">Your song is ready' + (nome ? ', ' + esc(nome) : '') + '!</h1>' +
    '<p style="color:#E9C9D8;font-size:16px;line-height:1.5;margin:0 0 22px">Thank you for your order. Your personalized song' + (para ? ' for <b>' + esc(para) + '</b>' : '') + ' is unlocked — full length, both versions, ready to play, download and share.</p>' +
    '<a href="' + link + '" style="display:inline-block;background:#E91E63;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:15px 28px;border-radius:14px">▶ Listen to your song</a>' +
    '<p style="color:#B79AAA;font-size:13px;margin:22px 0 0">Keep this email — the link always works.<br>' + esc(link) + '</p>' +
    '</div><p style="text-align:center;color:#8C6E7E;font-size:12px;margin-top:14px">Capivarinha Love · Personalized songs</p></div>';
  const texto = 'Your song is ready! Listen, download and share: ' + link;
  const r = await enviarEmail(g.email, assunto, html, texto);
  await loja.setJSON('pago_' + g.id, { em: Date.now(), para: g.email, ok: r.ok, motivo: r.motivo || null }).catch(() => {});
  if (!r.ok && r.motivo === 'sem chave') await loja.delete('pago_' + g.id).catch(() => {}); // quando a chave entrar, ainda dá pra mandar
  return r.ok;
}

// entrega certa pra cada site: inglês → e-mail; Brasil → WhatsApp
export async function entregarPago(g) {
  if (g && g.idioma === 'en') return entregarPedidoEmail(g);
  const { entregarPedidoPagoZap } = await import('./_zap.mjs');
  return entregarPedidoPagoZap(g);
}
