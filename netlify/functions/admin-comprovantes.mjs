import { getStore } from '@netlify/blobs';
import { lerDias, idsDosDiasTudo } from './_indice.mjs';
import { SITE, chaveNum } from './_zap.mjs';
// 🧾 COMPROVANTES DE ENTREGA — pra mandar pra Efí / contestação (MED):
// cada pedido PAGO com o Pix (txid, código E2E do Banco Central, valor, hora) e a ENTREGA (link da música, músicas geradas,
// aviso no WhatsApp). Telefone e nome vão mascarados (privacidade do cliente).
// POST {dias: 1..31, busca?: "pedido / E2E / txid / final do telefone"}  (senha de administrador)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const mascTel = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length >= 8 ? '(' + d.slice(-11, -9) + ') •••••-' + d.slice(-4) : ''; };
const primeiro = (n) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p ? p.charAt(0).toUpperCase() + p.slice(1, 20).toLowerCase() : ''; };
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha incorreta.' }, 401);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const dias = Math.max(1, Math.min(31, Number(b.dias) || 7)), busca = String(b.busca || '').trim().toLowerCase().replace(/[^\w]/g, '');
  const pres = getStore('presentes'), zap = getStore('whatsapp');
  const ids = await idsDosDiasTudo(await lerDias(), dias, 'pg');
  const out = [], LIM = busca ? 3000 : 1500;
  for (let i = 0; i < Math.min(ids.length, LIM); i += 60) {
    const gs = await Promise.all(ids.slice(i, i + 60).map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
    for (const g of gs) {
      if (!g || !g.pago || g.cancelado) continue;
      const pg = g.pagamento || {}, tel = String(g.musicaWhatsapp || g.whatsapp || '');
      if (busca) {
        const alvo = [g.id, pg.txid, pg.e2eid, tel.replace(/\D/g, '')].map((x) => String(x || '').toLowerCase()).join(' ');
        if (alvo.indexOf(busca) < 0) continue;
      }
      out.push({ g, pg, tel });
    }
  }
  out.sort((a, b2) => (b2.g.pagoEm || 0) - (a.g.pagoEm || 0));
  const lista = await Promise.all(out.slice(0, 1200).map(async ({ g, pg, tel }) => {
    const av = await zap.get('pago_' + g.id, { type: 'json' }).catch(() => null);
    const musicas = [g.musicaPreviewUrl, g.musicaPreviewUrl2, g.ofertaM1 && g.ofertaM1.url, g.ofertaM1 && g.ofertaM1.url2, g.ofertaM2 && g.ofertaM2.url, g.ofertaM2 && g.ofertaM2.url2].filter(Boolean).length;
    return {
      id: g.id, criadoEm: g.criadoEm || null, pagoEm: g.pagoEm || pg.pagoEm || null,
      valor: Number(pg.valorRecebido || pg.valor || 0) || null, txid: pg.txid || null, e2e: pg.e2eid || null, confirmado: pg.confirmadoPor || null,
      produto: g.produto || 'musica', extras: g.extrasPix || pg.extras || [], quatro: !!g.quatro,
      cliente: primeiro(g.meuNome), para: primeiro(g.musicaParaNome || g.parceiroNome), tel: mascTel(tel),
      estilo: g.musicaEstilo || '', ocasiao: g.musicaOcasiao || '',
      musicas, link: SITE + '/#/p/' + g.id + ((g.produto || 'musica') === 'musica' ? '/c' : ''),
      zap: av ? { em: av.em || null, para: mascTel(av.para) } : null
    };
  }));
  const total = lista.reduce((t, x) => t + (x.valor || 0), 0);
  return json({ ok: true, dias, busca: b.busca || '', geradoEm: Date.now(), qtd: lista.length, total: Math.round(total * 100) / 100,
    comE2E: lista.filter((x) => x.e2e).length, comZap: lista.filter((x) => x.zap).length, comMusica: lista.filter((x) => x.musicas > 0).length, lista });
};
