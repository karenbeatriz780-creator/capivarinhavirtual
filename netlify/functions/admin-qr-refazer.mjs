// 🔧 QR Code corrigido (15/11): o gerador de QR estava com a "informação de formato" trocada e muitos leitores não liam.
// GET  ?dias=7            (x-admin-key) → quadros (retrato com QR) e livros pagos nos últimos dias, com o link pra baixar de novo
// POST {acao:'livros', dias} (x-admin-key) → refaz os PDFs dos livros (o QR da última página volta a funcionar)
import { getStore } from '@netlify/blobs';
import { idsDosDiasTudo, lerIndice } from './_indice.mjs';

const SITE = (process.env.URL || 'https://capivarinhalove.com.br').replace(/\/$/, '');
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function pedidosComQR(dias) {
  const idx = await lerIndice().catch(() => null);
  const ids = await idsDosDiasTudo(idx, dias, 'pg');
  const pres = getStore('presentes'), out = [];
  const gs = await Promise.all(ids.map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
  for (const g of gs) {
    if (!g || !g.pago || g.cancelado) continue;
    const ex = Array.isArray(g.extrasPix) ? g.extrasPix : [];
    const zap = String(g.musicaWhatsapp || g.whatsapp || (g.livro && g.livro.whatsapp) || '').replace(/\D/g, '');
    if (ex.indexOf('quadro') >= 0) out.push({ id: g.id, tipo: 'quadro', nome: g.meuNome || '', para: g.musicaParaNome || '', zap, pagoEm: g.pagoEm, link: SITE + '/#/montar/' + g.id });
    if (g.livro && /^L[0-9a-f]{14}$/.test(g.id)) out.push({ id: g.id, tipo: 'livro', nome: g.livro.nome || '', zap, pagoEm: g.pagoEm });
  }
  return out.sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0));
}
export async function refazerLivros(dias) {
  const l = (await pedidosComQR(dias)).filter((x) => x.tipo === 'livro');
  for (const x of l) await fetch(SITE + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id, refazer: true }) }).catch(() => {});
  return l.length;
}
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  try {
    if (req.method === 'GET') { const d = Math.min(30, parseInt(new URL(req.url).searchParams.get('dias'), 10) || 7); return json({ itens: await pedidosComQR(d) }); }
    let b = {}; try { b = await req.json(); } catch (e) {}
    if (b.acao === 'livros') return json({ ok: true, livros: await refazerLivros(Math.min(30, b.dias || 10)) });
    return json({ erro: 'Ação inválida.' }, 400);
  } catch (e) { return json({ erro: e.message }, 500); }
};
