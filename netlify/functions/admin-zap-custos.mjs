import { getStore } from '@netlify/blobs';
import { VERSAO, wabaId } from './_zap.mjs';
// Painel → aba WhatsApp → 💸 Quanto o WhatsApp cobrou: números do PRÓPRIO Meta (pricing_analytics da conta do WhatsApp),
// por dia e por categoria (utilidade, marketing…), + a nossa contagem de avisos pagos ("música pronta") nos últimos 15 dias.
// GET ?dias=30&novo=1  (só leitura)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const D = 864e5, dia = (t) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10);
const tsDe = (k) => +((k.match(/_(\d{13})(_|$)/) || [])[1] || 0);
export default async (req) => {
  const u = new URL(req.url), dias = Math.max(1, Math.min(60, Number(u.searchParams.get('dias')) || 30));
  const loja = getStore('whatsapp'), ck = 'custos_' + dias;
  if (!u.searchParams.get('novo')) { const c = await loja.get(ck, { type: 'json' }).catch(() => null); if (c && Date.now() - c.em < 30 * 60e3) return json(c); }
  const token = (process.env.WHATSAPP_TOKEN || '').trim(), agora = Date.now();
  const out = { em: agora, dias, porDia: {}, total: { pagas: 0, gratis: 0, custo: 0 }, porCategoria: {}, moeda: null, erroMeta: null, nossos: { porDia: {}, total: 0 } };
  // 1) o que o Meta diz
  try {
    const w = await wabaId(token); if (!w) throw new Error('não achei a conta do WhatsApp Business');
    const ini = Math.floor((agora - dias * D) / 1000), fim = Math.floor(agora / 1000);
    const campo = 'currency,pricing_analytics.start(' + ini + ').end(' + fim + ').granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])';
    const r = await (await fetch('https://graph.facebook.com/' + VERSAO + '/' + w + '?fields=' + encodeURIComponent(campo), { headers: { Authorization: 'Bearer ' + token } })).json();
    if (r.error) throw new Error(r.error.error_user_msg || r.error.message);
    out.moeda = r.currency || null;
    const pts = ((((r.pricing_analytics || {}).data || [])[0] || {}).data_points) || [];
    pts.forEach((p) => {
      const k = dia((p.start || 0) * 1000 + 3 * 3600e3), cat = String(p.pricing_category || '?').toLowerCase(), tipo = String(p.pricing_type || '');
      const vol = Number(p.volume || 0), custo = Number(p.cost || 0), gratis = /FREE/.test(tipo);
      const d = out.porDia[k] = out.porDia[k] || { pagas: 0, gratis: 0, custo: 0, cat: {} };
      if (gratis) { d.gratis += vol; out.total.gratis += vol; }
      else { d.pagas += vol; out.total.pagas += vol; d.cat[cat] = (d.cat[cat] || 0) + vol; const pc = out.porCategoria[cat] = out.porCategoria[cat] || { msgs: 0, custo: 0 }; pc.msgs += vol; pc.custo += custo; }
      d.custo += custo; out.total.custo += custo;
    });
    out.total.custo = Math.round(out.total.custo * 100) / 100;
    Object.values(out.porDia).forEach((d) => { d.custo = Math.round(d.custo * 100) / 100; });
    Object.values(out.porCategoria).forEach((c) => { c.custo = Math.round(c.custo * 100) / 100; c.porMsg = c.msgs ? Math.round(c.custo / c.msgs * 1000) / 1000 : 0; });
  } catch (e) { out.erroMeta = String(e.message || e).slice(0, 300); }
  // 2) a nossa contagem: avisos pagos "música pronta" (ficam guardados 15 dias)
  try {
    const ks = ((await loja.list({ prefix: 'ev_' })).blobs || []).map((b) => b.key).filter((k) => agora - tsDe(k) < 15 * D).sort((a, b) => tsDe(b) - tsDe(a)).slice(0, 4000);
    for (let i = 0; i < ks.length; i += 80) {
      const evs = await Promise.all(ks.slice(i, i + 80).map((k) => loja.get(k, { type: 'json' }).catch(() => null)));
      evs.forEach((e) => { if (e && e.t === 'pago_enviado' && e.via === 'utilidade') { const k = dia(e.em); out.nossos.porDia[k] = (out.nossos.porDia[k] || 0) + 1; out.nossos.total++; } });
    }
  } catch (e) {}
  await loja.setJSON(ck, out).catch(() => {});
  return json(out);
};
