import { getStore } from '@netlify/blobs';
import { chaveTel, lerIndice } from './_indice.mjs';

// MEUS PRESENTES pelo número de telefone. Rápido: usa o índice por telefone
// (_indice.mjs) e só abre os pedidos daquele número. Nada de áudio aqui —
// a música só carrega quando a pessoa aperta o play na página dela.
//   POST { tel } → { ok, itens:[...], indicacao:{...}, promo, indicarLink }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function mascara(t) {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length < 10) return '';
  return '(' + d.slice(0, 2) + ') •••••-' + d.slice(-4);
}
const comLimite = (p, ms, padrao) => Promise.race([p, new Promise((r) => setTimeout(() => r(padrao), ms))]);

export default async (req) => {
  const t0 = Date.now();
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const chave = chaveTel(body.tel);
    if (!chave) return json({ erro: 'Digite o número com DDD.' }, 400);

    const presentes = getStore('presentes');
    const musicasSt = getStore('musicas');
    const idx = await lerIndice();
    if (!idx || !idx.mapa || !idx.montadoEm) {
      // índice ainda não existe: manda montar e pede pra tentar de novo em instantes
      await comLimite(fetch(new URL(req.url).origin + '/.netlify/functions/indexar-telefones-background', { method: 'POST' }).catch(() => null), 2500, null);
      return json({ erro: 'preparando', msg: 'Estamos organizando as músicas. Tenta de novo em 1 minutinho.' }, 503);
    }
    // índice com mais de 6 h: manda atualizar em segundo plano (não espera)
    if (Date.now() - idx.montadoEm > 6 * 3600 * 1000) {
      comLimite(fetch(new URL(req.url).origin + '/.netlify/functions/indexar-telefones-background', { method: 'POST' }).catch(() => null), 1500, null);
    }
    const ent = idx.mapa[chave] || { p: [], t: [] };
    if (!ent.p.length && !ent.t.length) return json({ ok: true, vazio: true });

    const lerP = (id) => comLimite(presentes.get(id, { type: 'json' }).catch(() => null), 4000, null);
    const lerM = (id) => comLimite(musicasSt.get(id, { type: 'json' }).catch(() => null), 4000, null);

    const [ps, ms] = await Promise.all([
      Promise.all(ent.p.slice(-40).map(lerP)),
      Promise.all(ent.t.slice(-40).map(async (id) => { const m = await lerM(id); return m ? Object.assign({ taskId: id }, m) : null; }))
    ]);
    const meus = ps.filter((g) => g && !g.cancelado);
    // música que virou pedido (recuperação/cortesia) → traz o pedido junto
    const jaTem = {}; meus.forEach((g) => { jaTem[g.id] = 1; });
    const extras = await Promise.all(ms.filter((m) => m && m.pedidoRecId && !jaTem[m.pedidoRecId]).map((m) => lerP(m.pedidoRecId)));
    extras.forEach((g) => { if (g && !g.cancelado && !jaTem[g.id]) { meus.push(g); jaTem[g.id] = 1; } });

    const usadas = {};
    meus.forEach((g) => { if (g.musicaPreviewId) usadas[g.musicaPreviewId] = 1; if (g.ofertaM1 && g.ofertaM1.id) usadas[g.ofertaM1.id] = 1; if (g.ofertaM2 && g.ofertaM2.id) usadas[g.ofertaM2.id] = 1; });
    const soMusica = ms.filter((m) => m && m.url && m.origem !== 'painel' && !m.pedidoRecId && !usadas[m.taskId]);

    const itens = [];
    meus.forEach((g) => {
      if (g.produto === 'extra' || String(g.produto || '').indexOf('extra_') === 0) return;
      const pago = !!g.pago;
      if (!pago && !g.musicaPreviewUrl) return;
      itens.push({
        id: g.id, produto: g.produto || 'musica', pago, cortesia: !!g.cortesia, bonus: !!(g.bonusDe || g.dobroDe),
        liberadas: !!(pago && g.quatro && !g.dobroUsado && !g.dobroDe), quatroPedido: !!g.quatro,
        quatro: !!(g.ofertaM1 && g.ofertaM1.url), seis: !!(g.ofertaM2 && g.ofertaM2.url),
        para: g.musicaParaNome || g.parceiroNome || '', estilo: g.musicaEstilo || '',
        capa: g.musicaCapa && String(g.musicaCapa).length < 120000 ? g.musicaCapa : null,
        em: g.pagoEm || g.criadoEm || 0,
        link: pago ? '#/p/' + g.id + (g.produto === 'musica' ? '/c' : '') : '#/ouvir/' + g.id
      });
    });
    soMusica.forEach((m) => itens.push({
      id: 't.' + m.taskId, produto: 'musica', pago: false, para: m.nomes || '', estilo: m.estilo || '',
      em: m.criadoEm || 0, link: '#/ouvir/t.' + m.taskId
    }));
    itens.sort((a, b) => (b.em || 0) - (a.em || 0));
    if (!itens.length) return json({ ok: true, vazio: true });

    // indique e ganhe (com limite de tempo pra nunca travar a tela)
    const pagos = meus.filter((g) => g.pago && !g.bonusDe && !g.dobroDe).sort((a, b) => (b.pagoEm || b.criadoEm || 0) - (a.pagoEm || a.criadoEm || 0));
    let disponiveis = 0, confirmadas = 0, resgatar = null; const amigos = [];
    if (pagos.length && Date.now() - t0 < 6000) {
      const indStore = getStore('indicacoes');
      await comLimite(Promise.all(pagos.slice(0, 10).map(async (g) => {
        const reg = await indStore.get(g.id, { type: 'json' }).catch(() => null);
        const ind = ((reg && reg.indicados) || []).slice(-30);
        const usados = ((reg && reg.usados) || []).length;
        const ns = await Promise.all(ind.map(lerP));
        let conf = 0;
        ns.forEach((n) => {
          if (!n || n.bonusDe) return;
          const ok = !!(n.pago && !n.cancelado); if (ok) conf++;
          amigos.push({ nome: String(n.meuNome || '').trim().split(' ')[0] || 'Amigo(a)', tel: mascara(n.musicaWhatsapp || n.whatsapp), pago: ok });
        });
        const disp = Math.max(0, conf - usados);
        confirmadas += conf; disponiveis += disp;
        if (disp > 0 && !resgatar) resgatar = '#/bonus/' + g.id;
      })), Math.max(500, 7000 - (Date.now() - t0)), null);
    }
    const base = meus.slice().sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0];
    const promo = base ? '#/oferta/p.' + base.id : (soMusica[0] ? '#/oferta/t.' + soMusica[0].taskId : null);
    return json({
      ok: true, itens, promo,
      indicarLink: pagos[0] ? '/#/criar/musica/r.' + pagos[0].id : null,
      indicacao: { confirmadas, disponiveis, resgatar, amigos }
    });
  } catch (e) {
    console.error('meus-presentes:', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
