// RESUMO DO NEGÓCIO (pros avisos no WhatsApp e pro robô)
// faturamento do site, gasto do Meta (COM imposto), gasto da IA (Kie) e lucro de um dia;
// horários de pico de venda; saldo da Kie em reais.
import { getStore } from '@netlify/blobs';
import { metaAds, usdPorCredito, cotacaoDolar, saldoKie } from './_gastos.mjs';
import { lerDias, idsDoDia } from './_indice.mjs';

export const diaBR = (ms) => new Date((ms || Date.now()) - 3 * 3600000).toISOString().slice(0, 10);
export const horaBR = (ms) => new Date((ms || Date.now()) - 3 * 3600000).getUTCHours();
export const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const imposto = () => (process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;

// pedidos pagos de um dia (índice novo + antigo), sem cortesia/cancelado
export async function vendasDoDia(dia, idxAntigo) {
  const idx = idxAntigo === undefined ? await lerDias() : idxAntigo;
  const ids = {}; (await idsDoDia(dia, 'pg')).forEach((x) => { ids[x] = 1; });
  const e = idx && idx.dias && idx.dias[dia]; ((e && e.pg) || []).forEach((x) => { ids[x] = 1; });
  const pres = getStore('presentes');
  const gs = await Promise.all(Object.keys(ids).map((id) => pres.get(id, { type: 'json' }).catch(() => null)));
  const out = { dia, qtd: 0, valor: 0, horas: {} };
  gs.forEach((g) => {
    if (!g || !g.pago || g.cancelado || g.cortesia) return;
    const q = g.pagoEm || g.criadoEm || 0; if (diaBR(q) !== dia) return;
    const v = Number((g.pagamento && g.pagamento.valor) || g.valor || 0); if (!(v > 0)) return;
    out.qtd++; out.valor += v; const h = horaBR(q); out.horas[h] = (out.horas[h] || 0) + 1;
  });
  out.valor = +out.valor.toFixed(2);
  return out;
}

// gasto da IA no dia, em reais
export async function gastoIADia(dia) {
  const r = await getStore('gastos').get('kie_' + dia, { type: 'json' }).catch(() => null);
  if (!r) return 0;
  return +(Number(r.gasto || 0) * usdPorCredito() * (await cotacaoDolar())).toFixed(2);
}
export async function saldoKieBRL() {
  const s = await saldoKie(); if (s == null) return null;
  return { creditos: s, reais: +(s * usdPorCredito() * (await cotacaoDolar())).toFixed(2) };
}

// resumo completo de um dia
export async function resumoDia(dia, fresco) {
  const [v, ia, meta] = await Promise.all([vendasDoDia(dia), gastoIADia(dia), metaAds(3, null, null, fresco !== false)]);
  const metaSem = (meta && meta.porDia && meta.porDia[dia] && meta.porDia[dia].gasto) || 0;
  const anuncio = +(metaSem * (1 + imposto())).toFixed(2);
  const lucro = +(v.valor - anuncio - ia).toFixed(2);
  return { dia, faturamento: v.valor, vendas: v.qtd, anuncio, ia, lucro, retorno: anuncio > 0 ? v.valor / anuncio : null,
    custoVenda: v.qtd ? anuncio / v.qtd : null, metaErro: meta && meta.erro ? meta.erro : null };
}
export function textoResumo(r, titulo) {
  return titulo + '\n' +
    '💰 Faturamento: *' + brl(r.faturamento) + '* (' + r.vendas + ' vendas)\n' +
    '📣 Anúncio (com imposto): ' + brl(r.anuncio) + '\n' +
    '🤖 IA: ' + brl(r.ia) + '\n' +
    (r.lucro >= 0 ? '✅ Lucro: *' + brl(r.lucro) + '*' : '🔻 Prejuízo: *' + brl(-r.lucro) + '*') +
    (r.retorno ? '\n📈 Retorno: ' + r.retorno.toFixed(2).replace('.', ',') + 'x' : '') +
    (r.custoVenda ? ' · custo por venda ' + brl(r.custoVenda) : '') +
    (r.metaErro ? '\n⚠️ Meta: ' + r.metaErro : '');
}

// horários que mais vendem (últimos 14 dias) — guarda por 12 h
const PICO_PADRAO = [0, 6, 7, 8, 9, 10, 11, 12];
export async function horasPico() {
  const L = getStore('gastos'), c = await L.get('horas_pico', { type: 'json' }).catch(() => null);
  if (c && Date.now() - c.em < 12 * 3600000 && c.horas && c.horas.length) return c.horas;
  try {
    const idx = await lerDias(), cont = {};
    for (let i = 1; i <= 14; i++) {
      const v = await vendasDoDia(diaBR(Date.now() - i * 864e5), idx);
      Object.entries(v.horas).forEach(([h, n]) => { cont[h] = (cont[h] || 0) + n; });
    }
    const tot = Object.values(cont).reduce((a, b) => a + b, 0);
    if (tot < 50) return PICO_PADRAO; // pouco dado: usa os horários que você indicou
    const horas = Object.keys(cont).map(Number).sort((a, b) => cont[b] - cont[a]).slice(0, 8).sort((a, b) => a - b);
    await L.setJSON('horas_pico', { em: Date.now(), horas, cont });
    return horas;
  } catch (e) { return PICO_PADRAO; }
}

// custo por venda dos últimos 3 dias completos (com imposto)
export function cpa3dias(c, s, imp) {
  const hoje = diaBR(); let g = 0, v = 0;
  Object.keys(c.dias || {}).filter((k) => k < hoje).sort().reverse().slice(0, 3).forEach((k) => {
    g += (c.dias[k].gasto || 0) * (1 + imp); v += Math.max(c.dias[k].compras || 0, (s && s.porDia && s.porDia[k]) || 0);
  });
  return { gasto: g, vendas: v, cpa: v ? g / v : null };
}

