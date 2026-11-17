// 📍 17/11: nas campanhas do Brasil que NÃO têm futuro (fracas/novas), tira os Stories do Facebook.
// Fica: Feed e Reels do Facebook + Feed, Stories e Reels do Instagram. As ⭐ (vendendo bem) e as dos EUA não mudam.
// Roda uma vez (chamada pelo deploy-succeeded). POST com x-admin-key.
import { getStore } from '@netlify/blobs';
import { graphConta, vendasSitePorCampanha, logRobo } from './_meta.mjs';
import { metaAds } from './_gastos.mjs';
import { futuro, ehEUA } from './_futuro.mjs';
import { tirarDaCampanha } from './admin-campanha-pos.mjs';

export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return;
  const L = getStore('gastos'), FLAG = 'semstoryfb_20261117';
  if (await L.get(FLAG, { type: 'json' }).catch(() => null)) return;
  await L.setJSON(FLAG, { em: Date.now(), status: 'rodando' });
  const res = { mudou: [], ficou: [], erros: [] };
  try {
    const [meta, site, lista] = await Promise.all([metaAds(7, null, null, true), vendasSitePorCampanha(10),
      graphConta('GET', 'campaigns', { fields: 'name,effective_status', limit: 400 })]);
    const mc = {}; (meta.campanhas || []).forEach((c) => { mc[String(c.id)] = c; });
    for (const c of (lista.data || [])) {
      if (/ARCHIVED|DELETED/.test(String(c.effective_status || '')) || ehEUA(c.name)) continue;
      const f = futuro(mc[String(c.id)] || { id: String(c.id), nome: c.name, dias: {} }, site, Date.now());
      if (f.tem) { res.ficou.push(c.name); continue; }
      try {
        const r = await tirarDaCampanha(String(c.id), 'facebook|story');
        if (r.feitos.length) { res.mudou.push(c.name); await logRobo({ tipo: 'posicao', camp: c.name, id: String(c.id), motivo: '📍 campanha sem futuro: tirei os Stories do Facebook (' + r.feitos.length + ' conjunto(s)). Ficou Feed e Reels do Facebook + Feed, Stories e Reels do Instagram.' }).catch(() => {}); }
        if (r.erros.length) res.erros.push(c.name + ': ' + r.erros.join('; '));
      } catch (e) { res.erros.push(c.name + ': ' + e.message); }
    }
  } catch (e) { res.erros.push(e.message); }
  await L.setJSON(FLAG, Object.assign({ em: Date.now(), status: 'feito' }, res));
};
