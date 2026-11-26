// 🎁 Painel → aba "Ofertas" (26/11): depois da venda, quanto entra a mais.
// Por dia (últimos 7): clientes que pagaram, quantos levaram clipe/retrato (no Pix ou na oferta R$ 7,99),
// quantos pagaram o "para sempre" (R$ 5) e outras ofertas — e quanto cada coisa faturou.
import { getStore } from '@netlify/blobs';
import { diaBR, idsDoDia } from './_indice.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const r2 = (n) => Math.round(n * 100) / 100;
export default async () => {
  try {
    const pres = getStore('presentes'), N = 7, agora = Date.now(), dias = [];
    for (let i = N - 1; i >= 0; i--) dias.push(diaBR(agora - i * 864e5));
    const out = await Promise.all(dias.map(async (dia) => {
      const ids = Array.from(new Set(await idsDoDia(dia, 'pg')));
      const gs = await Promise.all(ids.map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
      const d = { dia, clientes: 0, fatMusica: 0, fatLivro: 0, livros: 0,
        noPix: 0, fatNoPix: 0, cq: 0, fatCq: 0, sempre: 0, fatSempre: 0, outras: 0, fatOutras: 0, total: 0 };
      gs.forEach((g) => {
        if (!g || !g.pago || g.cancelado || g.cortesia || g.dobroDe || g.bonusDe) return;
        const pg = g.pagamento || {}, valor = Number(pg.valor || 0) || 0;
        if (/-x-/.test(g.id)) {
          if (/-x-sempre-/.test(g.id)) { d.sempre++; d.fatSempre += valor; }
          else if (/-x-cq-/.test(g.id)) { d.cq++; d.fatCq += valor; }
          else { d.outras++; d.fatOutras += valor; }
          d.total += valor; return;
        }
        if (g.comboDaMusica) { d.outras++; d.fatOutras += valor; d.total += valor; return; }
        d.clientes++;
        const ex = Number(pg.valorExtras || 0) || 0, temEx = (g.extrasPix || []).length > 0;
        if (temEx) { d.noPix++; d.fatNoPix += ex; }
        if ((g.produto || 'musica') === 'livro') { d.livros++; d.fatLivro += valor; } else d.fatMusica += valor - ex;
        d.total += valor;
      });
      Object.keys(d).forEach((k) => { if (k.indexOf('fat') === 0 || k === 'total') d[k] = r2(d[k]); });
      return d;
    }));
    return json({ dias: out });
  } catch (e) { return json({ erro: e.message }, 500); }
};
