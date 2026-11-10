// Painel → achar o PEDIDO de um Pix (ex.: contestação MED da Efí).
//   GET ?q=<ID do Pix (E2E, começa com E)> | <nome de quem pagou>   (senha de administrador)
// Volta o pedido, pra quem era a música e o link das músicas.
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, listarPixRecebidos } from './_efi.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const SITE = 'https://capivarinhalove.com.br';
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const q = String(new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 3) return json({ erro: 'Digite o ID do Pix ou o nome de quem pagou.' }, 400);
  try {
    const token = await obterToken();
    let pixes = [];
    if (/^E[0-9A-Za-z]{25,40}$/.test(q)) {
      const r = await efiRequest('/v2/pix/' + encodeURIComponent(q), { token });
      if (r.ok && r.data) pixes = [r.data];
    } else {
      const lista = await listarPixRecebidos(token, new Date(Date.now() - 5 * 864e5), new Date(Date.now() + 60000), 10);
      const n = norm(q);
      pixes = lista.filter((p) => norm((p.gnExtras && p.gnExtras.pagador && p.gnExtras.pagador.nome) || (p.pagador && p.pagador.nome) || '').indexOf(n) >= 0).slice(0, 15);
    }
    if (!pixes.length) return json({ ok: true, itens: [], aviso: 'Não achei esse Pix na Efí (a busca por nome olha os últimos 5 dias).' });
    const txs = getStore('efi-txid'), presentes = getStore('presentes');
    const itens = [];
    for (const p of pixes) {
      const pagador = (p.gnExtras && p.gnExtras.pagador && p.gnExtras.pagador.nome) || (p.pagador && p.pagador.nome) || '';
      const it = { e2e: p.endToEndId || '', valor: p.valor || '', horario: p.horario || '', pagador, pedido: null };
      if (p.txid) {
        const m = await txs.get(p.txid, { type: 'json' }).catch(() => null);
        const g = m && m.giftId ? await presentes.get(m.giftId, { type: 'json' }).catch(() => null) : null;
        if (g) it.pedido = { id: g.id, para: g.musicaParaNome || g.parceiroNome || '', estilo: g.musicaEstilo || '', pago: !!g.pago, whatsapp: g.musicaWhatsapp || g.whatsapp || '',
          link: SITE + '/#/p/' + g.id + '/c', criadoEm: g.criadoEm || null };
      }
      itens.push(it);
    }
    return json({ ok: true, itens });
  } catch (e) { return json({ erro: 'Não consegui consultar a Efí: ' + (e && e.message) }, 502); }
};
