import { analisarComprovante } from './_comprovante.mjs';
// 🧾 o cliente manda o print do comprovante do Pix manual (site). POST {id, imagem: "data:image/jpeg;base64,..."}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Envio inválido.' }, 400); }
  const id = String(b.id || '').trim(), m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(b.imagem || ''));
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  if (!m) return json({ erro: 'Mande uma FOTO ou PRINT do comprovante (imagem).' }, 400);
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4.5 * 1024 * 1024) return json({ erro: 'Imagem muito grande. Mande um print da tela.' }, 400);
  try {
    const r = await analisarComprovante(id, buf, m[1], 'site');
    return json({ ok: r.status !== 'erro', status: r.status, motivos: r.motivos || [], jaPago: !!r.jaPago });
  } catch (e) {
    console.error('enviar-comprovante:', e && e.stack || e);
    return json({ erro: 'Não consegui analisar agora. Tente de novo em instantes.' }, 500);
  }
};
