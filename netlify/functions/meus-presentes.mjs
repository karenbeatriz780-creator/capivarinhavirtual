import { getStore } from '@netlify/blobs';
import { statusIndicacao } from './_indicacao.mjs';

// MEUS PRESENTES por WhatsApp: a pessoa entra com o número que usou na compra
// e confirma um nome (o dela ou de quem recebeu a música). Funciona em qualquer
// navegador/celular, porque tudo vem do servidor, não do aparelho.
//   POST { tel, nome } → { ok, itens:[...], indicacao:{...}, promo, indicarLink }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
// DDD + últimos 8 dígitos: casa número com ou sem o 9 e com ou sem +55
export function chaveTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length < 10) return '';
  return d.slice(0, 2) + d.slice(-8);
}
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim();
}
function mascara(t) {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length < 10) return '';
  return '(' + d.slice(0, 2) + ') •••••-' + d.slice(-4);
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const chave = chaveTel(body.tel);
    const nome = norm(body.nome);
    if (!chave) return json({ erro: 'Digite o WhatsApp com DDD.' }, 400);
    if (nome.length < 2) return json({ erro: 'Digite um nome pra confirmar.' }, 400);

    const presentes = getStore('presentes');
    const { blobs } = await presentes.list();
    const todos = (await Promise.all(blobs.map((b) => presentes.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);
    const meus = todos.filter((g) => !g.cancelado && chaveTel(g.musicaWhatsapp || g.whatsapp) === chave);

    const musicasSt = getStore('musicas');
    const ml = await musicasSt.list();
    const usadas = {};
    meus.forEach((g) => { if (g.musicaPreviewId) usadas[g.musicaPreviewId] = 1; if (g.ofertaM1 && g.ofertaM1.id) usadas[g.ofertaM1.id] = 1; });
    const soMusica = [];
    await Promise.all(ml.blobs.map(async (b) => {
      if (usadas[b.key]) return;
      const m = await musicasSt.get(b.key, { type: 'json' }).catch(() => null);
      if (!m || !m.url || m.origem === 'painel' || m.pedidoRecId) return;
      if (chaveTel(m.whatsapp) !== chave) return;
      soMusica.push(Object.assign({ taskId: b.key }, m));
    }));

    if (!meus.length && !soMusica.length) return json({ ok: true, vazio: true });

    // confirma o nome: o da pessoa ou de quem recebeu alguma música
    const nomes = new Set();
    function addNomes(s) { norm(s).split(' ').filter((w) => w.length >= 2 && w !== 'e').forEach((w) => nomes.add(w)); }
    meus.forEach((g) => { addNomes(g.meuNome); addNomes(g.parceiroNome); addNomes(g.musicaParaNome); if (g.ofertaM1) addNomes(g.ofertaM1.paraNome); });
    soMusica.forEach((m) => addNomes(m.nomes));
    if (nomes.size) {
      const ok = nome.split(' ').some((w) => nomes.has(w));
      if (!ok) return json({ erro: 'nome', msg: 'Esse nome não confere com as suas músicas. Use o seu nome ou o de quem recebeu a música.' }, 403);
    }

    const itens = [];
    meus.forEach((g) => {
      if (g.produto === 'extra' || String(g.produto || '').indexOf('extra_') === 0) return;
      const pago = !!g.pago;
      const temMusica = !!g.musicaPreviewUrl;
      if (!pago && !temMusica) return;
      itens.push({
        id: g.id, produto: g.produto || 'musica', pago, cortesia: !!g.cortesia, bonus: !!g.bonusDe,
        quatro: !!(g.ofertaM1 && g.ofertaM1.url),
        para: g.musicaParaNome || g.parceiroNome || '', estilo: g.musicaEstilo || '', capa: g.musicaCapa && String(g.musicaCapa).length < 120000 ? g.musicaCapa : null,
        em: g.pagoEm || g.criadoEm || 0,
        link: pago ? '#/p/' + g.id + (g.produto === 'musica' ? '/c' : '') : '#/ouvir/' + g.id
      });
    });
    soMusica.forEach((m) => itens.push({
      id: 't.' + m.taskId, produto: 'musica', pago: false, para: m.nomes || '', estilo: m.estilo || '',
      em: m.criadoEm || 0, link: '#/ouvir/t.' + m.taskId
    }));
    itens.sort((a, b) => (b.em || 0) - (a.em || 0));

    // indique e ganhe: soma tudo que os amigos indicados pagaram
    const pagos = meus.filter((g) => g.pago && !g.bonusDe).sort((a, b) => (b.pagoEm || b.criadoEm || 0) - (a.pagoEm || a.criadoEm || 0));
    const indStore = getStore('indicacoes');
    let disponiveis = 0, confirmadas = 0; let resgatar = null; const amigos = [];
    for (const g of pagos.slice(0, 20)) {
      const st = await statusIndicacao(g.id);
      confirmadas += st.confirmadas; disponiveis += st.disponiveis;
      if (st.disponiveis > 0 && !resgatar) resgatar = '#/bonus/' + g.id;
      const reg = await indStore.get(g.id, { type: 'json' }).catch(() => null);
      for (const nid of ((reg && reg.indicados) || []).slice(-30)) {
        const n = todos.find((x) => x.id === nid);
        if (!n || n.bonusDe) continue;
        amigos.push({ nome: String(n.meuNome || '').trim().split(' ')[0] || 'Amigo(a)', tel: mascara(n.musicaWhatsapp || n.whatsapp), pago: !!(n.pago && !n.cancelado) });
      }
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
