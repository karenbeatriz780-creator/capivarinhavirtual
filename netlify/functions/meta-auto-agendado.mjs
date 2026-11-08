// ROBÔ DO TRÁFEGO — roda de hora em hora. Tudo COM o imposto do Meta (12,15%).
// Vendas = maior entre o Pixel do Meta e as vendas reais do site daquela campanha.
// PAUSA (regras do Gusthavo — "campanha não pode dar prejuízo"):
//  1) a 1ª venda tem que sair em até R$ 15 gastos
//  2) começo ruim: R$ 20+ gastos e custo por venda acima do ticket (ex.: 1 venda com R$ 20) → prejuízo
//  3) campanha que já vendia: hoje gastou R$ 30+ e está no prejuízo
//  4) "desandou": gastou muito desde a última venda
//  5) prejuízo nos últimos 3 dias seguidos
// SEGUNDA CHANCE: a campanha pausada por resultado volta SÓ nos horários de pico (os que mais vendem).
//  - fez a 1ª venda / vendeu barato (3+ vendas com custo ≤ R$ 7) → volta a rodar o dia todo
//  - não deu certo de novo → pausa de vez e te pede vídeo novo
// SOBE (+20%) só com lucro de verdade: custo por venda ≤ R$ 7 nos últimos 3 dias, fora do aprendizado, 72 h sem mexer.
// Se VOCÊ ativar/pausar uma campanha pelo painel, o robô respeita (48 h sem pausar de novo).
import { getStore } from '@netlify/blobs';
import { metaAds, recomendar, ultimasAcoes, SUBIR_MAX, TICKET } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { horasPico, horaBR, diaBR, brl, imposto, cpa3dias } from './_resumo.mjs';

export const config = { schedule: '17 * * * *' };
const L = () => getStore('gastos');

export async function rodarRobo(simular) {
  const cfg = await lerCfg();
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return { ok: false, motivo: 'Meta não ligado' };
  if (!cfg.autoPausar && !cfg.autoSubir) return { ok: true, motivo: 'robô desligado', feitas: [] };
  const emerg = await L().get('emergencia', { type: 'json' }).catch(() => null);
  if (emerg) return { ok: true, motivo: 'modo emergência (IA fora do ar) — robô parado até voltar', feitas: [] };
  const imp = imposto(), tk = TICKET(), prim = cfg.primeiraVendaMax || 15, cpaMax = cfg.cpaMax || 7;
  const meta = await metaAds(7, null, null, true);
  if (!meta.configurado || meta.erro) { if (meta.erro && !simular) await logRobo({ tipo: 'erro', motivo: meta.erro }); return { ok: false, motivo: meta.erro }; }
  const [acoes, site, pico] = await Promise.all([ultimasAcoes(), vendasSitePorCampanha(31), horasPico()]);
  const agora = Date.now(), hoje = diaBR(agora), horaPico = pico.indexOf(horaBR(agora)) >= 0, feitas = [];
  const scList = ((await L().list({ prefix: 'sc_' }).catch(() => null)) || { blobs: [] }).blobs.map((b) => b.key);
  const sc = {}; for (const k of scList) { const r = await L().get(k, { type: 'json' }).catch(() => null); if (r) sc[k.slice(3)] = r; }
  const nums = (c) => {
    const s = site[c.id] || { vendas: 0, porDia: {}, ultima: 0 };
    const gT = (c.total ? c.total.gasto : c.gasto) * (1 + imp), vT = Math.max(c.total ? c.total.compras : c.compras, s.vendas || 0);
    const dh = (c.dias || {})[hoje] || {}, gH = (dh.gasto || 0) * (1 + imp), vH = Math.max(dh.compras || 0, s.porDia[hoje] || 0);
    return { s, gT, vT, gH, vH };
  };
  const pico$ = pico.map((h) => h + 'h').join(', ');

  // ---------- 1) campanhas em SEGUNDA CHANCE ----------
  for (const [id, r] of Object.entries(sc)) {
    if (r.modo !== 'sc') continue;
    const c = (meta.campanhas || []).find((x) => String(x.id) === id);
    if (!c) { if (agora - r.desde > 8 * 864e5 && !simular) await L().delete('sc_' + id).catch(() => {}); continue; }
    const { gT, vT } = nums(c), dG = gT - r.g0, dV = vT - r.v0, ativa = c.status === 'ACTIVE';
    const venceu = agora - r.desde > 4 * 864e5;
    const falhou = (dV <= 0 && dG >= prim) || (dV > 0 && dG >= 20 && dG / dV > tk) || (venceu && !(dV > 0 && dG / dV <= cpaMax));
    const voltou = (dV >= 3 && dG / dV <= cpaMax) || (venceu && dV > 0 && dG / dV <= cpaMax);
    try {
      if (falhou) {
        if (!simular) { if (ativa) await aplicarAcao(c, 'pausar', 'robô'); await L().setJSON('sc_' + id, Object.assign({}, r, { modo: 'fim', em: agora })); }
        feitas.push({ tipo: 'pausou', camp: c.nome, id, aviso: true, motivo: 'a segunda chance (só horário de pico) não deu certo: ' + brl(dG) + ' gastos e ' + Math.max(0, dV) + ' venda(s). Pausei de vez. 🎬 Manda um vídeo novo pra essa oferta.' });
      } else if (voltou) {
        if (!simular) { if (!ativa) await aplicarAcao(c, 'ativar', 'robô'); await L().delete('sc_' + id); }
        feitas.push({ tipo: 'ativou', camp: c.nome, id, aviso: true, motivo: 'voltou a vender bem na segunda chance (' + dV + ' vendas a ' + brl(dG / dV) + ' cada). Deixei ligada o dia todo de novo.' });
      } else if (horaPico && !ativa) {
        if (!simular) await aplicarAcao(c, 'ativar', 'robô');
        feitas.push({ tipo: 'ativou', camp: c.nome, id, motivo: 'segunda chance: liguei no horário de pico (' + pico$ + ')' });
      } else if (!horaPico && ativa) {
        if (!simular) await aplicarAcao(c, 'pausar', 'robô');
        feitas.push({ tipo: 'pausou', camp: c.nome, id, motivo: 'segunda chance: fora do horário de pico, pausei até o próximo pico' });
      }
    } catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id, aviso: true, motivo: 'segunda chance: ' + e.message }); }
  }

  // ---------- 2) campanhas ativas normais ----------
  const ativas = (meta.campanhas || []).filter((c) => (!c.status || c.status === 'ACTIVE') && !(sc[c.id] && sc[c.id].modo === 'sc'));
  let somaOrc = ativas.reduce((t, c) => t + (c.orcamentoDia || 0), 0);
  let mexidas = 0;
  for (const c of ativas) {
    if (mexidas >= 6) break;
    const a = acoes[c.id], { s, gT, vT, gH, vH } = nums(c);
    const voceAtivou = a && a.tipo === 'ativar' && a.quem !== 'robô' && agora - a.em < 48 * 3600000;
    let pausar = null;
    if (cfg.autoPausar && !voceAtivou) {
      if (vT === 0 && gT >= prim) pausar = 'gastou ' + brl(gT) + ' (com imposto) e a 1ª venda não saiu (limite ' + brl(prim) + ')';
      else if (vT > 0 && vT < 5 && gT >= 20 && gT / vT > tk) pausar = 'começo ruim: ' + brl(gT) + ' gastos pra ' + vT + ' venda(s) — ' + brl(gT / vT) + ' por venda dá prejuízo';
      else if (vT >= 5 && gH >= 30 && (vH === 0 || gH / vH > tk)) {
        const k3 = cpa3dias(c, s, imp);
        if (k3.cpa && k3.cpa <= cpaMax) { // campanha BOA (últimos 3 dias lucrando) num dia ruim: não desliga, só avisa 1x por dia
          if (!simular && !(await L().get('ruimhoje_' + c.id + '_' + hoje).catch(() => null))) {
            await L().set('ruimhoje_' + c.id + '_' + hoje, '1').catch(() => {});
            feitas.push({ tipo: 'alerta', aviso: true, camp: c.nome, id: c.id, motivo: 'hoje está no prejuízo (' + brl(gH) + ' pra ' + vH + ' vendas), mas nos últimos 3 dias vendeu a ' + brl(k3.cpa) + ' cada. Mantive ligada — é uma campanha boa num dia ruim.' });
          }
        } else pausar = 'hoje está no prejuízo: ' + brl(gH) + ' gastos pra ' + vH + ' venda(s)';
      }
      if (!pausar && vT >= 5) { // desandou
        let desde = 0, achou = false;
        for (const k of Object.keys(c.dias || {}).sort().reverse()) { const d = c.dias[k]; if ((d.compras || 0) > 0 || (s.porDia[k] || 0) > 0) { achou = true; break; } desde += (d.gasto || 0) * (1 + imp); }
        const limite = Math.max(25, 3 * cpaMax), vendeu24h = s.ultima && agora - s.ultima < 24 * 3600000;
        if (desde >= limite && !vendeu24h) pausar = 'desandou: ' + brl(desde) + (achou ? ' gastos desde a última venda' : ' em 7 dias sem vender');
      }
      if (!pausar) { // prejuízo 3 dias seguidos
        const cImp = Object.assign({}, c, { gasto: c.gasto * (1 + imp), compras: Math.max(c.compras, Object.keys(c.dias || {}).reduce((t, k) => t + (s.porDia[k] || 0), 0)),
          dias: Object.fromEntries(Object.entries(c.dias || {}).map(([k, v]) => [k, Object.assign({}, v, { gasto: v.gasto * (1 + imp), compras: Math.max(v.compras || 0, s.porDia[k] || 0) })])) });
        const r = recomendar(cImp, a, agora);
        if (r.nivel === 'pausar' && /3 dias/.test(r.motivo)) pausar = r.motivo;
        c._rec = r;
      }
    }
    if (pausar) {
      mexidas++;
      try {
        const jaTeve = sc[c.id];
        const daChance = cfg.segundaChance && !jaTeve;
        if (!simular) {
          await aplicarAcao(c, 'pausar', 'robô');
          if (daChance) await L().setJSON('sc_' + c.id, { modo: 'sc', desde: agora, g0: gT, v0: vT, motivo: pausar });
        }
        feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: pausar + (daChance ? '. Vai ter UMA segunda chance só nos horários de pico (' + pico$ + ').' : jaTeve ? '. Já teve segunda chance — 🎬 manda vídeo novo.' : '') });
      } catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui pausar: ' + e.message }); }
      continue;
    }
    // SUBIR (lucro de verdade + seguro pro aprendizado)
    if (cfg.autoSubir && c.orcamentoDia) {
      const r = c._rec || recomendar(Object.assign({}, c, { gasto: c.gasto * (1 + imp) }), a, agora);
      if (r.nivel !== 'subir') continue;
      const k3 = cpa3dias(c, s, imp);
      if (!(k3.cpa && k3.cpa <= cpaMax)) continue; // custo por venda acima do seu limite → não sobe
      let novo = Math.min(Math.floor(c.orcamentoDia * (1 + SUBIR_MAX)), cfg.tetoCampanha);
      if (novo <= c.orcamentoDia) { feitas.push({ tipo: 'teto', camp: c.nome, id: c.id, motivo: 'pronta pra subir, mas já está no teto de ' + brl(cfg.tetoCampanha) + '/dia' }); continue; }
      if (somaOrc + (novo - c.orcamentoDia) > cfg.tetoTotal) { feitas.push({ tipo: 'teto', camp: c.nome, id: c.id, motivo: 'pronta pra subir, mas o total passaria do teto de ' + brl(cfg.tetoTotal) + '/dia' }); continue; }
      mexidas++;
      try {
        if (!simular) await aplicarAcao(Object.assign({}, c, { novoOrcamento: novo }), 'subir', 'robô');
        somaOrc += novo - c.orcamentoDia;
        feitas.push({ tipo: 'subiu', camp: c.nome, id: c.id, aviso: true, motivo: 'de ' + brl(c.orcamentoDia) + ' para ' + brl(novo) + '/dia · custo por venda ' + brl(k3.cpa) + ' nos últimos 3 dias' });
      } catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui subir: ' + e.message }); }
    }
  }

  if (!simular) {
    const avisos = [];
    for (const f of feitas) {
      if (f.tipo === 'teto') { // no máximo 1 por dia por campanha
        const k = 'teto_' + f.id + '_' + hoje;
        if (await L().get(k).catch(() => null)) continue; await L().set(k, '1').catch(() => {});
      }
      await logRobo(f);
      if (f.aviso || f.tipo === 'teto') avisos.push((f.tipo === 'pausou' ? '⏸ Pausei' : f.tipo === 'subiu' ? '⬆️ Subi' : f.tipo === 'ativou' ? '▶️ Liguei' : f.tipo === 'teto' ? '🧱 No teto:' : f.tipo === 'alerta' ? '👀 Mantive' : '⚠️ Erro em') + ' *' + f.camp + '*\n' + f.motivo);
    }
    if (avisos.length) await avisar(avisos.join('\n\n')); // tudo numa mensagem só
  }
  return { ok: true, feitas, pico };
}
export default async () => { try { await rodarRobo(false); } catch (e) { console.error('robô:', e && e.message); await logRobo({ tipo: 'erro', motivo: e.message }).catch(() => {}); } };
