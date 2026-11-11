// Painel → aba CAMPANHAS → 👥 Quem compra: GET ?dias=30[&novo=1]
import { calcPublico } from './_publico.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return json({ erro: 'Meta Ads não está ligado.' }, 400);
  const u = new URL(req.url), dias = Math.max(3, Math.min(90, parseInt(u.searchParams.get('dias'), 10) || 30));
  try { return json(await calcPublico(dias, u.searchParams.get('novo') === '1')); }
  catch (e) { return json({ erro: 'Não consegui ler as idades no Meta: ' + (e.message || e) }, 502); }
};
