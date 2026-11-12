import { getStore } from '@netlify/blobs';
import { lerCfgPix, salvarCfgPix, PIX_MANUAL } from './_pixmanual.mjs';
import { liberarManual } from './_comprovante.mjs';
// Painel → 🧾 Pix manual: comprovantes enviados, liberar/recusar, modo do Pix e liberação automática. (senha de administrador)
// GET               → { cfg, itens }      GET ?img=<chave> → a imagem do comprovante
// POST {acao:'liberar'|'recusar', id}  ·  {acao:'cfg', modo, autoLiberar}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha incorreta.' }, 401);
  const loja = getStore('comprovantes'), u = new URL(req.url);
  if (req.method === 'GET') {
    const img = u.searchParams.get('img');
    if (img) {
      if (!/^img_[A-Za-z0-9_-]+$/.test(img)) return json({ erro: 'inválido' }, 400);
      const r = await loja.getWithMetadata(img, { type: 'arrayBuffer' }).catch(() => null);
      if (!r || !r.data) return json({ erro: 'não achei' }, 404);
      return new Response(r.data, { headers: { 'Content-Type': (r.metadata && r.metadata.mime) || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
    }
    const ks = ((await loja.list({ prefix: 'c_' })).blobs || []).map((b) => b.key);
    const regs = (await Promise.all(ks.map((k) => loja.get(k, { type: 'json' }).catch(() => null)))).filter(Boolean)
      .filter((r) => Date.now() - (r.atualizadoEm || 0) < 4 * 864e5).sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0)).slice(0, 150);
    const pres = getStore('presentes');
    const itens = await Promise.all(regs.map(async (r) => { const g = await pres.get(r.id, { type: 'json' }).catch(() => null); return Object.assign({}, r, { pago: !!(g && g.pago), pagoEm: g && g.pagoEm }); }));
    return json({ cfg: await lerCfgPix(), chave: PIX_MANUAL.chave, nome: PIX_MANUAL.nome, itens });
  }
  let b = {}; try { b = await req.json(); } catch (e) {}
  if (b.acao === 'cfg') {
    const m = {}; if (['auto', 'manual', 'efi'].indexOf(b.modo) >= 0) m.modo = b.modo; if (typeof b.autoLiberar === 'boolean') m.autoLiberar = b.autoLiberar;
    if (b.modo === 'auto') m.efiFalhouEm = 0;
    return json({ ok: true, cfg: await salvarCfgPix(m) });
  }
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  const k = 'c_' + id, reg = (await loja.get(k, { type: 'json' }).catch(() => null)) || { id, envios: [] };
  if (b.acao === 'liberar') { await liberarManual(id, 'comprovante-painel'); reg.status = 'liberado'; reg.porVoce = true; }
  else if (b.acao === 'recusar') reg.status = 'recusado';
  else return json({ erro: 'Ação inválida.' }, 400);
  reg.atualizadoEm = Date.now(); await loja.setJSON(k, reg);
  return json({ ok: true });
};
