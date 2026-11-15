// 🇺🇸 Site em inglês (/us) — extras:
//   GET  ?acao=exemplos                → músicas de exemplo ("Listen to examples")
//   POST {acao:'exemplo-add', id, titulo, sub}  (x-admin-key) → usa a música de um pedido PAGO como exemplo
//   POST {acao:'exemplo-del', id}               (x-admin-key)
//   GET  ?acao=ref&id=<pedido>         → indique e ganhe: quantas músicas grátis o cliente tem
//   GET  ?acao=meus&email=<email>      → "My songs": pedidos pagos daquele e-mail
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { statusIndicacao } from './_indicacao.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const L = () => getStore('gastos');
export const chaveEmail = (e) => 'idx_' + crypto.createHash('sha256').update(String(e || '').trim().toLowerCase()).digest('hex').slice(0, 32);
export async function indexarEmail(email, id) {
  if (!/@/.test(String(email || ''))) return;
  const loja = getStore('emails'), k = chaveEmail(email);
  const l = (await loja.get(k, { type: 'json' }).catch(() => null)) || [];
  if (l.indexOf(id) < 0) { l.push(id); await loja.setJSON(k, l.slice(-60)); }
}

export default async (req) => {
  const u = new URL(req.url), acao = u.searchParams.get('acao') || '';
  try {
    if (req.method === 'GET' && acao === 'exemplos') {
      const ex = (await L().get('exemplos_us', { type: 'json' }).catch(() => null)) || [];
      return new Response(JSON.stringify({ exemplos: ex }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' } });
    }
    if (req.method === 'GET' && acao === 'ref') {
      const id = u.searchParams.get('id') || '';
      if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'id' }, 400);
      const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
      if (!g || !g.pago) return json({ disponiveis: 0, confirmadas: 0 });
      return json(await statusIndicacao(id));
    }
    if (req.method === 'GET' && acao === 'meus') {
      const email = String(u.searchParams.get('email') || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ erro: 'Please enter a valid email.' }, 400);
      const ids = (await getStore('emails').get(chaveEmail(email), { type: 'json' }).catch(() => null)) || [];
      const pres = getStore('presentes');
      const itens = (await Promise.all(ids.slice(-30).map((id) => pres.get(id, { type: 'json' }).catch(() => null))))
        .filter((g) => g && g.pago && !g.cancelado && String(g.email || '').toLowerCase() === email)
        .map((g) => ({ id: g.id, para: g.musicaParaNome || '', estilo: g.musicaEstilo || '', em: g.pagoEm || g.criadoEm }))
        .sort((a, b) => b.em - a.em);
      return json({ itens });
    }
    if (req.method === 'POST') {
      const senha = (process.env.ADMIN_SENHA || '').trim();
      if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
      let b = {}; try { b = await req.json(); } catch (e) {}
      const ex = (await L().get('exemplos_us', { type: 'json' }).catch(() => null)) || [];
      const id = String(b.id || '');
      if (b.acao === 'exemplo-add') {
        const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
        if (!g || !g.pago) return json({ erro: 'Só dá pra usar música de pedido pago.' }, 400);
        const novo = { id, titulo: String(b.titulo || ('Song for ' + (g.musicaParaNome || 'someone special'))).slice(0, 60), sub: String(b.sub || '').slice(0, 60), url: '/.netlify/functions/audio?id=' + encodeURIComponent(id) + '&v=' + (b.v === 2 ? 2 : 1) };
        const lista = ex.filter((x) => x.id !== id); lista.unshift(novo);
        await L().setJSON('exemplos_us', lista.slice(0, 8));
        return json({ ok: true, exemplos: lista.slice(0, 8) });
      }
      if (b.acao === 'exemplo-del') { const lista = ex.filter((x) => x.id !== id); await L().setJSON('exemplos_us', lista); return json({ ok: true, exemplos: lista }); }
    }
    return json({ erro: 'Ação inválida.' }, 400);
  } catch (e) { return json({ erro: e.message }, 500); }
};
