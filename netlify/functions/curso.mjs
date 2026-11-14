// 📚 Curso "Aprenda a Criar e Vender com IA" (página /aprenda)
// POST {acao:'pedido', nome, whatsapp, bump}  → cria o pedido e devolve o Pix copia e cola (Nubank)
// POST {acao:'bump', id}                      → adiciona o 2º e-book (metade do preço) num pedido ainda não pago
// POST {acao:'ja-paguei', id, segundo}        → mesma regra do site: 1 toque depois de 20 s OU 2 toques
// GET  ?id=&t=                                → situação do pedido + o material (só se pago)
import { getStore } from '@netlify/blobs';
import { brcode } from './_pixmanual.mjs';
import crypto from 'node:crypto';

const PRECO = 27, BUMP = 13.5, ESPERA = 20 * 1000;
const loja = () => getStore('cursos');
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const valorDe = (p) => +(PRECO + (p.bump ? BUMP : 0)).toFixed(2);

// material: o Gusthavo coloca os links/arquivos depois (cfg_material). Enquanto não tiver, aparece "chega no WhatsApp".
async function material(p) {
  const cfg = (await loja().get('cfg_material', { type: 'json' }).catch(() => null)) || {};
  const itens = [{ id: 'videos', titulo: 'Criar Vídeos com IA que Vendem', url: cfg.videos || null }];
  if (p.bump) itens.push({ id: 'site', titulo: 'Criar um Site que Vende com Vídeos Virais', url: cfg.site || null });
  return itens;
}
function publico(p, comMaterial) {
  return { id: p.id, nome: p.nome, bump: !!p.bump, valor: valorDe(p), pago: !!p.pago, payload: p.pago ? null : p.payload, criadoEm: p.criadoEm, ...(comMaterial || {}) };
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const id = url.searchParams.get('id') || '', t = url.searchParams.get('t') || '';
    if (!/^C[0-9a-f]{12}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
    const p = await loja().get(id, { type: 'json' }).catch(() => null);
    if (!p || p.token !== t) return json({ erro: 'Pedido não encontrado.' }, 404);
    return json(publico(p, p.pago ? { material: await material(p) } : null));
  }
  let b = {}; try { b = await req.json(); } catch (e) {}
  if (b.acao === 'pedido') {
    const nome = String(b.nome || '').trim().slice(0, 60), zap = String(b.whatsapp || '').replace(/\D/g, '').slice(0, 13);
    if (nome.length < 2) return json({ erro: 'Digite seu nome.' }, 400);
    if (zap.length < 10) return json({ erro: 'Digite seu WhatsApp com DDD.' }, 400);
    const id = 'C' + crypto.randomBytes(6).toString('hex'), token = crypto.randomBytes(9).toString('hex');
    const p = { id, token, nome, whatsapp: zap, bump: !!b.bump, criadoEm: Date.now(), manualEm: Date.now(), pago: false, origem: String(b.origem || '').slice(0, 40) };
    p.payload = brcode(valorDe(p), id);
    await loja().setJSON(id, p);
    return json(Object.assign(publico(p), { token }));
  }
  const id = String(b.id || '');
  if (!/^C[0-9a-f]{12}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  const p = await loja().get(id, { type: 'json' }).catch(() => null);
  if (!p || p.token !== String(b.t || '')) return json({ erro: 'Pedido não encontrado.' }, 404);
  if (b.acao === 'bump') {
    if (p.pago) return json({ erro: 'Esse pedido já foi pago.' }, 400);
    p.bump = true; p.payload = brcode(valorDe(p), id); p.manualEm = Date.now();
    await loja().setJSON(id, p);
    return json(publico(p));
  }
  if (b.acao === 'ja-paguei') {
    if (!p.pago) {
      if (!b.segundo && Date.now() - (p.manualEm || p.criadoEm) < ESPERA) return json({ ok: false, cedo: true });
      p.pago = true; p.pagoEm = Date.now(); p.via = b.segundo ? 'ja-paguei-2toques' : 'ja-paguei';
      await loja().setJSON(id, p);
    }
    return json(Object.assign({ ok: true }, publico(p, { material: await material(p) })));
  }
  return json({ erro: 'Ação inválida.' }, 400);
};
