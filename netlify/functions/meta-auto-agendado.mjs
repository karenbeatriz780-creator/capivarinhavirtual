// ROBÔ DO TRÁFEGO — roda de hora em hora.
// Desliga sozinho o que está ruim e sobe (+20%) o que está bom E seguro pro aprendizado.
// Regras (ajustáveis no painel → Gastos → Robô do tráfego):
//  • R$ 25 gastos (valor do Gerenciador) sem NENHUMA venda → pausa
//  • "desandou": gastou desde a última venda bem mais do que uma venda costuma custar → pausa
//  • prejuízo nos últimos 3 dias seguidos → pausa
//  • lucro 3 dias seguidos, fora do aprendizado, 72 h sem mexer → sobe 20% (respeitando os tetos)
// Vendas = maior entre Pixel do Meta e vendas reais do site daquela campanha.
// Se VOCÊ reativar uma campanha, o robô não pausa ela de novo por 48 h.
import { metaAds, recomendar, ultimasAcoes, SUBIR_MAX } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';

export const config = { schedule: '17 * * * *' };
const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

export async function rodarRobo(simular) {
  const cfg = await lerCfg();
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return { ok: false, motivo: 'Meta não ligado' };
  if (!cfg.autoPausar && !cfg.autoSubir) return { ok: true, motivo: 'robô desligado' };
  const imp = (process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;
  const meta = await metaAds(7, null, null, true);
  if (!meta.configurado || meta.erro) { if (meta.erro) await logRobo({ tipo: 'erro', motivo: meta.erro }); return { ok: false, motivo: meta.erro }; }
  const [acoes, site] = await Promise.all([ultimasAcoes(), vendasSitePorCampanha(31)]);
  const agora = Date.now(), feitas = [];
  const ativas = (meta.campanhas || []).filter((c) => !c.status || c.status === 'ACTIVE');
  let somaOrc = ativas.reduce((t, c) => t + (c.orcamentoDia || 0), 0);
  for (const c of ativas) {
    if (feitas.length >= 6) break;
    const a = acoes[c.id], s = site[c.id] || { vendas: 0, porDia: {}, ultima: 0 };
    const gastoTot = c.total ? c.total.gasto : c.gasto;
    const vendasTot = Math.max(c.total ? c.total.compras : c.compras, s.vendas || 0);
    const reativadaAgora = a && a.tipo === 'ativar' && agora - a.em < 48 * 3600000;
    let pausar = null;
    if (cfg.autoPausar && !reativadaAgora) {
      // A) nenhuma venda
      if (vendasTot === 0 && gastoTot >= cfg.limiteSemVenda) pausar = 'gastou ' + brl(gastoTot) + ' e não fez nenhuma venda';
      // B) desandou: quanto gastou desde a última venda (Pixel ou site), nos últimos 7 dias
      if (!pausar && vendasTot > 0) {
        const dias = Object.keys(c.dias || {}).sort().reverse();
        let desde = 0, achou = false;
        for (const k of dias) { const d = c.dias[k]; if ((d.compras || 0) > 0 || (s.porDia[k] || 0) > 0) { achou = true; break; } desde += d.gasto || 0; }
        const cpa = gastoTot / vendasTot, limite = Math.max(cfg.limiteSemVenda, 2.5 * cpa);
        const vendeuSite24h = s.ultima && agora - s.ultima < 24 * 3600000;
        if (desde >= limite && !vendeuSite24h) pausar = 'desandou: gastou ' + brl(desde) + (achou ? ' desde a última venda' : ' em 7 dias sem vender') + ' (uma venda costuma custar ' + brl(cpa) + ')';
      }
      // C) prejuízo 3 dias seguidos (regra da estratégia, já com imposto)
      if (!pausar) {
        const site7 = Object.keys(c.dias || {}).reduce((t, k) => t + (s.porDia[k] || 0), 0);
        const cImp = Object.assign({}, c, { gasto: c.gasto * (1 + imp), compras: Math.max(c.compras, site7),
          dias: Object.fromEntries(Object.entries(c.dias || {}).map(([k, v]) => [k, Object.assign({}, v, { gasto: v.gasto * (1 + imp), compras: Math.max(v.compras || 0, s.porDia[k] || 0) })])) });
        const r = recomendar(cImp, a, agora);
        if (r.nivel === 'pausar' && /3 dias/.test(r.motivo)) pausar = r.motivo;
        c._rec = r;
      }
    }
    if (pausar) {
      try { if (!simular) await aplicarAcao(c, 'pausar', 'robô'); feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, motivo: pausar }); }
      catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, motivo: 'não consegui pausar: ' + e.message }); }
      continue;
    }
    // SUBIR (seguro)
    if (cfg.autoSubir && c.orcamentoDia) {
      const r = c._rec || recomendar(Object.assign({}, c, { gasto: c.gasto * (1 + imp) }), a, agora);
      if (r.nivel === 'subir') {
        let novo = Math.min(Math.floor(c.orcamentoDia * (1 + SUBIR_MAX)), cfg.tetoCampanha);
        if (novo <= c.orcamentoDia) { feitas.push({ tipo: 'teto', camp: c.nome, id: c.id, motivo: 'pronta pra subir, mas já está no teto de ' + brl(cfg.tetoCampanha) + '/dia' }); continue; }
        if (somaOrc + (novo - c.orcamentoDia) > cfg.tetoTotal) { feitas.push({ tipo: 'teto', camp: c.nome, id: c.id, motivo: 'pronta pra subir, mas o total passaria do teto de ' + brl(cfg.tetoTotal) + '/dia' }); continue; }
        try {
          if (!simular) await aplicarAcao(Object.assign({}, c, { novoOrcamento: novo }), 'subir', 'robô');
          somaOrc += novo - c.orcamentoDia;
          feitas.push({ tipo: 'subiu', camp: c.nome, id: c.id, motivo: 'de ' + brl(c.orcamentoDia) + ' para ' + brl(novo) + '/dia · ' + r.motivo });
        } catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, motivo: 'não consegui subir: ' + e.message }); }
      }
    }
  }
  if (!simular) {
    for (const f of feitas) {
      if (f.tipo === 'teto') { // aviso de teto: no máximo 1 por dia por campanha
        const L = (await import('@netlify/blobs')).getStore('gastos'), k = 'teto_' + f.id + '_' + new Date(agora - 3 * 3600000).toISOString().slice(0, 10);
        if (await L.get(k).catch(() => null)) continue; await L.set(k, '1').catch(() => {});
      }
      await logRobo(f);
      await avisar((f.tipo === 'pausou' ? '⏸ Pausei' : f.tipo === 'subiu' ? '⬆️ Subi o orçamento de' : f.tipo === 'teto' ? '🧱 No teto:' : '⚠️ Erro em') + ' *' + f.camp + '*\n' + f.motivo);
    }
  }
  return { ok: true, feitas };
}
export default async () => { try { await rodarRobo(false); } catch (e) { console.error('robô:', e && e.message); await logRobo({ tipo: 'erro', motivo: e.message }).catch(() => {}); } };
