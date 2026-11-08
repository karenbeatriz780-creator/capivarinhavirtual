// Painel → Robô do tráfego: configurações, histórico e "detectar Página/Instagram/Pixel".
import { lerCfg, salvarCfg, detectarAtivos, logRobo } from './_meta.mjs';
import { getStore } from '@netlify/blobs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (req.method === 'GET') {
    const [cfg, log] = await Promise.all([lerCfg(), getStore('gastos').get('meta_log', { type: 'json' }).catch(() => null)]);
    return json({ cfg, log: (log || []).slice(0, 40), ligado: !!(process.env.META_ADS_TOKEN && process.env.META_AD_ACCOUNT_ID) });
  }
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  let b = {}; try { b = await req.json(); } catch (e) {}
  try {
    if (b.acao === 'detectar') {
      const d = await detectarAtivos(), cfg = await lerCfg(), novo = {};
      if (!cfg.pageId && d.paginas[0]) novo.pageId = d.paginas[0].id;
      if (!cfg.igId && d.instagrams[0]) novo.igId = d.instagrams[0].id;
      if (d.pixels[0] && !d.pixels.find((p) => p.id === cfg.pixelId)) novo.pixelId = d.pixels[0].id;
      return json({ detectado: d, cfg: Object.keys(novo).length ? await salvarCfg(novo) : cfg });
    }
    if (b.acao === 'rodar') { const { rodarRobo } = await import('./meta-auto-agendado.mjs'); return json(await rodarRobo(!!b.simular)); }
    const cfg = await salvarCfg(b.cfg || {});
    await logRobo({ tipo: 'config', motivo: 'você mudou as configurações do robô' });
    return json({ cfg });
  } catch (e) { return json({ erro: e.message }, 502); }
};
