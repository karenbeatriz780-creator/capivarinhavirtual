// Painel → 📍 Onde vende (GET ?dias=30[&camp=<id>][&novo=1]) e 🎯 Interesses (GET ?q=... | ?pacote=relacionamento)
import { calcPosicoes, buscarInteresses, pacoteInteresses } from './_publico.mjs';
import { TICKET } from './_gastos.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return json({ erro: 'Meta Ads não está ligado.' }, 400);
  const u = new URL(req.url);
  try {
    if (u.searchParams.get('q')) return json({ itens: await buscarInteresses(u.searchParams.get('q')) });
    if (u.searchParams.get('pacote')) return json({ itens: await pacoteInteresses(u.searchParams.get('pacote')) });
    const dias = Math.max(3, Math.min(90, parseInt(u.searchParams.get('dias'), 10) || 30));
    return json(await calcPosicoes(dias, u.searchParams.get('camp'), u.searchParams.get('novo') === '1', TICKET()));
  } catch (e) { return json({ erro: 'Não consegui ler no Meta: ' + (e.message || e) }, 502); }
};
