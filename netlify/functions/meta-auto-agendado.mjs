// ROBÔ DO TRÁFEGO — roda a cada 30 min. Valores IGUAIS aos do app do Meta (sem o imposto),
// pra bater com o que você vê no celular. (O lucro dos resumos continua com imposto.)
// O QUE ELE PODE FAZER (regra do Gusthavo):
//  ✅ DESLIGAR campanha ATIVA que está ruim
//  ❌ NUNCA liga campanha (as que você desligou ficam desligadas) — só religa o que ELE pausou na emergência da IA
//  ❌ NUNCA sobe orçamento — só te AVISA "pode subir" e você sobe
// QUANDO DESLIGA (campanha ativa) — olhando SÓ O DIA DE HOJE (regra de 10/11):
//  1) HOJE gastou R$ 15 e não vendeu nada
//  2) HOJE, com 3+ vendas, o custo por venda passou de R$ 13 (com 1-2 vendas: só quando nem mais uma venda salva — 1 venda: R$ 26; 2 vendas: R$ 39)
//  3) prejuízo 3 dias seguidos E hoje também no prejuízo
// Se VOCÊ religar uma campanha (pelo painel OU pelo app do Meta), o robô não mexe nela até a meia-noite.
import { getStore } from '@netlify/blobs';
import { metaAds, recomendar, ultimasAcoes, SUBIR_MAX, TICKET } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { registrarAcao } from './_gastos.mjs';
import { diaBR, brl, imposto, cpa3dias } from './_resumo.mjs';

export const config = { schedule: '17,47 * * * *' };
const L = () => getStore('gastos');
export const INICIO = Date.parse('2026-11-09T03:00:00Z'); // meia-noite de 09/11 (Belém)

export async function rodarRobo(simular) {
  const cfg = await lerCfg();
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return { ok: false, motivo: 'Meta não ligado' };
  if (!cfg.autoPausar && !cfg.autoSubir) return { ok: true, motivo: 'robô desligado', feitas: [] };
  if (!simular && Date.now() < INICIO) return { ok: true, motivo: 'regras começam à meia-noite de 09/11', feitas: [] };
  const emerg = await L().get('emergencia', { type: 'json' }).catch(() => null);
  if (emerg && !simular) return { ok: true, motivo: 'modo emergência (IA fora do ar) — robô parado até voltar', feitas: [] };
  const imp = imposto(), tk = TICKET();
  const prim = cfg.primeiraVendaMax || 15, lim = cfg.cpaLimite || 13, cpaSobe = cfg.cpaMax || 7;
  const meta = await metaAds(7, null, null, true);
  if (!meta.configurado || meta.erro) { if (meta.erro && !simular) await logRobo({ tipo: 'erro', motivo: meta.erro }); return { ok: false, motivo: meta.erro }; }
  const [acoes, site] = await Promise.all([ultimasAcoes(), vendasSitePorCampanha(31)]);
  const agora = Date.now(), hoje = diaBR(agora), feitas = [];
  const ativas = (meta.campanhas || []).filter((c) => c.status === 'ACTIVE');
  const fotos = (await L().get('cpa_hist_' + hoje, { type: 'json' }).catch(() => null)) || {}; // custo por venda de hoje a cada conferência
  for (const c of ativas) {
    let a = acoes[c.id]; const s = site[c.id] || { vendas: 0, porDia: {}, ultima: 0 };
    const gT = c.total ? c.total.gasto : c.gasto, vT = Math.max(c.total ? c.total.compras : c.compras, s.vendas || 0);
    const dh = (c.dias || {})[hoje] || {}, gH = dh.gasto || 0, vH = Math.max(dh.compras || 0, s.porDia[hoje] || 0);
    const cpaH = vH ? gH / vH : null;
    fotos[c.id] = (fotos[c.id] || []).concat(cpaH ? [+cpaH.toFixed(2)] : []).slice(-4);
    // o robô tinha desligado e agora está ligada → foi VOCÊ que religou (pelo app do Meta). Respeita até a meia-noite.
    if (a && a.tipo === 'pausar' && a.quem === 'robô') {
      if (!simular) await registrarAcao(c.id, 'ativar', { quem: 'você (app do Meta)' }).catch(() => {});
      acoes[c.id] = a = { tipo: 'ativar', quem: 'você (app do Meta)', em: agora };
    }
    const voceAtivou = a && a.tipo === 'ativar' && a.quem !== 'robô' && diaBR(a.em) === hoje;
    let pausar = null;
    if (cfg.autoPausar && !voceAtivou) {
      if (vH === 0 && gH >= prim) pausar = 'hoje gastou ' + brl(gH) + ' e não fez nenhuma venda (limite ' + brl(prim) + ')';
      else if (vH > 0 && vH < 3 && gH >= lim * (vH + 1)) pausar = 'hoje ' + vH + ' venda(s) com ' + brl(gH) + ' — mesmo com mais uma venda passaria do limite de ' + brl(lim);
      else if (vH >= 3 && cpaH > lim) pausar = 'hoje o custo por venda está ' + brl(cpaH) + ' (' + vH + ' vendas, ' + brl(gH) + ') — passou do limite de ' + brl(lim);
      const hojeLucro = vH > 0 && cpaH <= tk / (1 + imp);
      if (!pausar && !hojeLucro) { // prejuízo 3 dias seguidos (com imposto) — só se HOJE também não está dando lucro
        const cImp = Object.assign({}, c, { gasto: c.gasto * (1 + imp), compras: Math.max(c.compras, Object.keys(c.dias || {}).reduce((t, k) => t + (s.porDia[k] || 0), 0)),
          dias: Object.fromEntries(Object.entries(c.dias || {}).map(([k, v]) => [k, Object.assign({}, v, { gasto: v.gasto * (1 + imp), compras: Math.max(v.compras || 0, s.porDia[k] || 0) })])) });
        const r = recomendar(cImp, a, agora);
        if (r.nivel === 'pausar' && /3 dias/.test(r.motivo)) pausar = r.motivo;
        c._rec = r;
      }
    }
    if (pausar) {
      try { if (!simular) await aplicarAcao(c, 'pausar', 'robô'); feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: pausar }); }
      catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui desligar: ' + e.message }); }
      continue;
    }
    // PODE SUBIR? só avisa (quem sobe é você) — 1 aviso por dia por campanha
    if (cfg.autoSubir && c.orcamentoDia && vH >= 5 && cpaH && cpaH <= cpaSobe) {
      const k3 = cpa3dias(Object.assign({}, c), s, 0); // 3 dias, valor do Meta
      const r = c._rec || recomendar(Object.assign({}, c, { gasto: c.gasto * (1 + imp) }), a, agora);
      if (k3.cpa && k3.cpa <= cpaSobe && !r.trava) {
        const novo = Math.floor(c.orcamentoDia * (1 + SUBIR_MAX));
        const k = 'podesubir_' + c.id + '_' + hoje;
        if (simular || !(await L().get(k).catch(() => null))) {
          if (!simular) await L().set(k, '1').catch(() => {});
          feitas.push({ tipo: 'podeSubir', camp: c.nome, id: c.id, aviso: true, motivo: 'está vendendo barato: hoje ' + vH + ' vendas a ' + brl(cpaH) + ', e ' + brl(k3.cpa) + ' nos últimos 3 dias. Pode subir de ' + brl(c.orcamentoDia) + ' para ' + brl(novo) + '/dia (+20%).' });
        }
      }
    }
  }
  if (!simular) {
    await L().setJSON('cpa_hist_' + hoje, fotos).catch(() => {});
    const avisos = [];
    for (const f of feitas) {
      await logRobo(f);
      if (f.aviso) avisos.push((f.tipo === 'pausou' ? '⏸ Desliguei' : f.tipo === 'podeSubir' ? '🟢 PODE SUBIR:' : '⚠️ Erro em') + ' *' + f.camp + '*\n' + f.motivo);
    }
    if (avisos.length) await avisar(avisos.join('\n\n'));
  }
  return { ok: true, feitas };
}
export default async () => { try { await rodarRobo(false); } catch (e) { console.error('robô:', e && e.message); await logRobo({ tipo: 'erro', motivo: e.message }).catch(() => {}); } };
