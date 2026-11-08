import { getStore } from '@netlify/blobs';
import { registrarSaldoKie, cotacaoDolar, metaAds, usdPorCredito, diaBR } from './_gastos.mjs';
// Painel: gastos automáticos (Kie + Meta Ads) dos últimos N dias, já em reais.
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  try {
    const n = Math.min(60, Math.max(1, parseInt(new URL(req.url).searchParams.get('dias'), 10) || 30));
    const L = getStore('gastos');
    const [kie, usd, meta] = await Promise.all([registrarSaldoKie(5).catch(() => null), cotacaoDolar(), metaAds(n)]);
    const upc = usdPorCredito();
    const dias = [];
    for (let i = 0; i < n; i++) dias.push(diaBR(Date.now() - i * 864e5));
    const regs = await Promise.all(dias.map((d) => Promise.all([
      L.get('kie_' + d, { type: 'json' }).catch(() => null), L.get('uso_' + d, { type: 'json' }).catch(() => null)])));
    const porDia = {};
    dias.forEach((d, i) => {
      const k = regs[i][0], u = regs[i][1] || {}, m = (meta.porDia || {})[d] || null;
      const kieCred = k ? k.gasto : 0;
      porDia[d] = {
        kieCreditos: kieCred, kieBRL: +(kieCred * upc * usd).toFixed(2), recargaCreditos: k ? k.recarga : 0,
        uso: u, temLeitura: !!k,
        metaBRL: m ? +(m.gasto * (meta.moeda === 'USD' ? usd : 1)).toFixed(2) : 0,
        metaCliques: m ? m.cliques : 0, metaImp: m ? m.imp : 0, metaCompras: m ? m.compras : 0
      };
    });
    return json({
      ok: true, usd, usdPorCredito: upc,
      kie: { configurado: !!(process.env.KIE_API_KEY || '').trim(), saldo: kie ? kie.saldo : null,
        saldoBRL: kie ? +(kie.saldo * upc * usd).toFixed(2) : null },
      meta: { configurado: !!meta.configurado, erro: meta.erro || null, conta: meta.conta || null, moeda: meta.moeda || null, campanhas: meta.campanhas || [] },
      porDia
    });
  } catch (e) { return json({ ok: false, erro: e && e.message }, 500); }
};
