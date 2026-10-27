import { getStore } from '@netlify/blobs';
import { idsDoDia, diaBR } from './_indice.mjs';

// TELA AO VIVO: pedidos PAGOS que vieram pelo link da live (#/live).
//   GET                → { itens: [...] }  (nunca expõe WhatsApp)
//   GET ?capa=<pedido> → a imagem da capa da música (se tiver)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const temMusica = (g) => !!(g.musicaPreviewUrl || (g.ofertaM1 && g.ofertaM1.url));

export default async (req) => {
  const u = new URL(req.url);
  const presentes = getStore('presentes');
  const capa = u.searchParams.get('capa');
  if (capa) {
    const g = await presentes.get(capa, { type: 'json' }).catch(() => null);
    const m = g && g.live && g.pago && /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(g.musicaCapa || ''));
    if (!m) return new Response('sem capa', { status: 404 });
    return new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400' } });
  }
  const agora = Date.now();
  let ids = [];
  try {
    const dias = [0, 1].map((i) => diaBR(agora - i * 86400000));
    ids = [...new Set((await Promise.all(dias.map((d) => idsDoDia(d, 'pg')))).flat())];
  } catch (e) {}
  const gs = (await Promise.all(ids.slice(-300).map((id) => presentes.get(id, { type: 'json' }).catch(() => null)))).filter(Boolean);
  const itens = gs
    .filter((g) => g.live && g.pago && !g.cancelado && temMusica(g) && agora - (g.pagoEm || 0) < 36 * 3600 * 1000)
    .sort((a, b) => (a.pagoEm || 0) - (b.pagoEm || 0))
    .slice(-40)
    .map((g) => ({
      id: g.id,
      nome: String(g.liveNome || '').trim().slice(0, 30),
      para: String(g.musicaParaNome || '').trim().slice(0, 40),
      estilo: g.musicaEstilo || '',
      estiloOutro: g.musicaEstiloOutro || '',
      pagoEm: g.pagoEm || 0,
      capa: /^data:image\//.test(String(g.musicaCapa || '')),
      versoes: g.musicaPreviewUrl2 ? 2 : 1
    }));
  return json({ itens, agora });
};
