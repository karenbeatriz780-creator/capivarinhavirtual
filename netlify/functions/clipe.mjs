// CLIPE COM FOTOS + QUADRO COM QR — extras comprados na hora do Pix (pedido de música).
//   GET  ?id=<pedido>              → dados do clipe (fotos, nomes, dedicatória, música)
//   GET  ?id=<pedido>&f=<0..7>     → a foto
//   POST {acao:'foto', id, k, img}  → guarda 1 foto (dataURL jpeg). k=0 é a capa (alta resolução, vai pro quadro)
//   POST {acao:'salvar', id, ...}   → guarda nomes, dedicatória, música, tema e quantas fotos
// O id do pedido é o "segredo" (mesmo esquema do link da música).
import { getStore } from '@netlify/blobs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const st = () => getStore({ name: 'clipes', consistency: 'strong' });
const limpa = (x, n) => String(x == null ? '' : x).replace(/[<>]/g, '').trim().slice(0, n);

async function pedido(id) {
  if (!id || id.length > 100 || !/^[\w.-]+$/.test(id)) return null;
  const g = await getStore('presentes').get(id, { type: 'json' });
  if (!g || !g.pago || g.cancelado) return null;
  const ex = Array.isArray(g.extrasPix) ? g.extrasPix : [];
  if (ex.indexOf('clipe') < 0 && ex.indexOf('quadro') < 0) return null;
  return { g, clipe: ex.indexOf('clipe') >= 0, quadro: ex.indexOf('quadro') >= 0 };
}
function versoes(g) {
  const v = [];
  if (g.musicaPreviewUrl) v.push(1); if (g.musicaPreviewUrl2) v.push(2);
  if (g.ofertaM1 && g.ofertaM1.url) v.push(3); if (g.ofertaM1 && g.ofertaM1.url2) v.push(4);
  if (g.ofertaM2 && g.ofertaM2.url) v.push(5); if (g.ofertaM2 && g.ofertaM2.url2) v.push(6);
  return v.length ? v : [1];
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url), id = (u.searchParams.get('id') || '').trim(), f = u.searchParams.get('f');
      const p = await pedido(id);
      if (!p) return json({ erro: 'Clipe não encontrado.' }, 404);
      if (f != null) {
        const k = parseInt(f, 10);
        if (!(k >= 0 && k < 8)) return new Response('foto inválida', { status: 400 });
        const b = await st().get(id + '/f' + k, { type: 'arrayBuffer' });
        if (!b) return new Response('sem foto', { status: 404 });
        return new Response(b, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
      }
      const d = await st().get(id, { type: 'json' });
      const g = p.g;
      const base = {
        ok: true, tem: { clipe: p.clipe, quadro: p.quadro }, versoes: versoes(g),
        sugestao: { para: limpa(g.musicaParaNome || g.parceiroNome, 40), de: limpa((g.meuNome || '').split(' ')[0], 40) }
      };
      if (!d) return json(Object.assign(base, { montado: false }));
      const fotos = []; for (let k = 0; k < d.n; k++) fotos.push('/.netlify/functions/clipe?id=' + encodeURIComponent(id) + '&f=' + k + '&t=' + (d.tf && d.tf[k] || d.ts));
      return json(Object.assign(base, { montado: true, dados: d, fotos, audio: '/.netlify/functions/audio?id=' + encodeURIComponent(id) + '&v=' + (d.v || 1) }));
    }
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Pedido inválido.' }, 400); }
    const id = String(b.id || '').trim();
    const p = await pedido(id);
    if (!p) return json({ erro: 'Esse pedido não tem clipe nem quadro.' }, 404);
    const max = p.clipe ? 8 : 1;
    if (b.acao === 'foto') {
      const k = parseInt(b.k, 10);
      if (!(k >= 0 && k < max)) return json({ erro: 'Foto fora do limite.' }, 400);
      const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(String(b.img || ''));
      if (!m) return json({ erro: 'Imagem inválida.' }, 400);
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 2.5 * 1024 * 1024) return json({ erro: 'Foto grande demais.' }, 413);
      await st().set(id + '/f' + k, buf);
      return json({ ok: true, k, t: Date.now() });
    }
    if (b.acao === 'salvar') {
      const n = Math.max(1, Math.min(max, parseInt(b.n, 10) || 1));
      const vs = versoes(p.g), v = vs.indexOf(parseInt(b.v, 10)) >= 0 ? parseInt(b.v, 10) : vs[0];
      const ant = (await st().get(id, { type: 'json' })) || {};
      const tf = Array.isArray(b.tf) ? b.tf.slice(0, n).map((x) => parseInt(x, 10) || Date.now()) : (ant.tf || []);
      const d = {
        n, v, tf, ts: Date.now(), criadoEm: ant.criadoEm || Date.now(),
        para: limpa(b.para, 40), de: limpa(b.de, 40), titulo: limpa(b.titulo, 48), data: limpa(b.data, 40),
        dedicatoria: p.clipe ? limpa(b.dedicatoria, 400) : '',
        tema: ['creme', 'noite', 'rose'].indexOf(b.tema) >= 0 ? b.tema : 'creme',
        focoY: Math.max(0, Math.min(1, Number(b.focoY) || .42))
      };
      await st().setJSON(id, d);
      return json({ ok: true, link: '/clipe.html?id=' + encodeURIComponent(id) });
    }
    return json({ erro: 'Ação inválida.' }, 400);
  } catch (e) {
    console.error('clipe:', e && e.stack || e);
    return json({ erro: 'Erro no servidor.' }, 500);
  }
};
