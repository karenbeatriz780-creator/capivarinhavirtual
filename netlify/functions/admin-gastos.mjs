import { getStore } from '@netlify/blobs';
import { registrarSaldoKie, cotacaoDolar, metaAds, usdPorCredito, diaBR } from './_gastos.mjs';
// Painel: gastos automáticos (Kie + Meta Ads) dos últimos N dias, já em reais.
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  try {
    const q = new URL(req.url).searchParams, ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    // período: ?de=AAAA-MM-DD&ate=AAAA-MM-DD (até 400 dias) ou ?dias=N (a partir de hoje)
    let de = q.get('de'), ate = q.get('ate'), dias = [];
    if (ok(de) && ok(ate) && de <= ate) {
      for (let t = Date.parse(ate + 'T12:00:00Z'); t >= Date.parse(de + 'T12:00:00Z') && dias.length < 400; t -= 864e5) dias.push(new Date(t).toISOString().slice(0, 10));
      de = dias[dias.length - 1];
    } else {
      const n = Math.min(400, Math.max(1, parseInt(q.get('dias'), 10) || 31));
      for (let i = 0; i < n; i++) dias.push(diaBR(Date.now() - i * 864e5));
      de = null; ate = null;
    }
    const L = getStore('gastos');
    const [kie, usd, meta] = await Promise.all([registrarSaldoKie(5).catch(() => null), cotacaoDolar(), metaAds(dias.length, de, ate)]);
    const upc = usdPorCredito();
    // imposto que o Meta cobra por cima do valor do Gerenciador/API no Brasil (PIS/Cofins + ISS). Trocar: META_IMPOSTO no Netlify
    const imp = (Number(process.env.META_IMPOSTO) >= 0 && process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;
    const regs = await Promise.all(dias.map((d) => Promise.all([
      L.get('kie_' + d, { type: 'json' }).catch(() => null), L.get('uso_' + d, { type: 'json' }).catch(() => null)])));
    const porDia = {};
    dias.forEach((d, i) => {
      const k = regs[i][0], u = regs[i][1] || {}, m = (meta.porDia || {})[d] || null;
      const kieCred = k ? k.gasto : 0;
      porDia[d] = {
        kieCreditos: kieCred, kieBRL: +(kieCred * upc * usd).toFixed(2), recargaCreditos: k ? k.recarga : 0,
        uso: u, temLeitura: !!k,
        metaBRL: m ? +(m.gasto * (meta.moeda === 'USD' ? usd : 1) * (1 + imp)).toFixed(2) : 0,
        metaSemImposto: m ? +(m.gasto * (meta.moeda === 'USD' ? usd : 1)).toFixed(2) : 0,
        metaCliques: m ? m.cliques : 0, metaImp: m ? m.imp : 0, metaCompras: m ? m.compras : 0
      };
    });
    return json({
      ok: true, usd, usdPorCredito: upc, impostoMeta: +(imp * 100).toFixed(2), de: dias[dias.length - 1], ate: dias[0], hoje: diaBR(),
      kie: { configurado: !!(process.env.KIE_API_KEY || '').trim(), saldo: kie ? kie.saldo : null,
        saldoBRL: kie ? +(kie.saldo * upc * usd).toFixed(2) : null },
      meta: { configurado: !!meta.configurado, erro: meta.erro || null, conta: meta.conta || null, moeda: meta.moeda || null, campanhas: (meta.campanhas || []).map((c) => Object.assign({}, c, { gasto: +(c.gasto * (1 + imp)).toFixed(2),
        dias: Object.fromEntries(Object.entries(c.dias || {}).map(([k, v]) => [k, Object.assign({}, v, { gasto: +(v.gasto * (1 + imp)).toFixed(2) })])) })) },
      porDia
    });
  } catch (e) { return json({ ok: false, erro: e && e.message }, 500); }
};
