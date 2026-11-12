// ROBÔ DO TRÁFEGO — roda a cada 30 min. Valores IGUAIS aos do app do Meta (sem o imposto),
// pra bater com o que você vê no celular. (O lucro dos resumos continua com imposto.)
// O QUE ELE PODE FAZER (regra do Gusthavo):
//  ✅ DESLIGAR campanha ATIVA que está ruim
//  ❌ NUNCA liga campanha (as que você desligou ficam desligadas) — só religa o que ELE pausou na emergência da IA
//  ❌ NUNCA sobe orçamento — só te AVISA "pode subir" e você sobe
// REGRA ATUAL (12/11 6h30) — SÓ O DIA DE HOJE: R$ 10 gastos sem venda → desliga; CUSTO POR COMPRA (do Meta) acima de R$ 9,50 → desliga.
// Até R$ 9,50 → continua. À MEIA-NOITE religa as que ele desligou.
// (regras antigas abaixo, de 10/11, ficaram só como histórico)
// QUANDO DESLIGA (campanha ativa) — olhando SÓ O DIA DE HOJE (regra de 10/11):
//  1) HOJE gastou R$ 15 e não vendeu nada
//  2) HOJE, com 3+ vendas, o custo por venda passou de R$ 13 (com 1-2 vendas: só quando nem mais uma venda salva — 1 venda: R$ 26; 2 vendas: R$ 39)
//  3) prejuízo 3 dias seguidos E hoje também no prejuízo
// ⏰ MODO HORÁRIO BARATO (regra de 11/11): campanha ativa com HOJE 2+ vendas e custo por venda acima de R$ 9
//  (mas sem bater os limites acima) → o robô liga só nas horas baratas (verdes do quadro ⏰) e desliga nas caras.
//  Se o custo de hoje cair pra R$ 8,50 ou menos → volta ao normal (ligada o dia todo). Se bater o limite → desliga de vez.
//  À meia-noite volta ao normal. Se VOCÊ religar ou desligar uma campanha no modo, o robô larga ela.
// Se VOCÊ religar uma campanha (pelo painel OU pelo app do Meta), o robô não mexe nela até a meia-noite.
import { getStore } from '@netlify/blobs';
import { metaAds, recomendar, ultimasAcoes, TICKET, avaliarSubir } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { registrarAcao } from './_gastos.mjs';
import { diaBR, brl, imposto, cpa3dias } from './_resumo.mjs';
import { calcHorarios } from './_horarios.mjs';

const CPA_MAX = 9.5; // regra de 12/11 6h30: custo por compra (do Meta) acima de R$ 9,50 hoje → desliga até meia-noite
const HB_LIGADO = false; // modo horário barato desligado na regra de 11/11 19h (prejuízo → desliga até meia-noite)
const HB_ENTRA = 9, HB_SAI = 8.5, QUEM_HB = 'robô (horário)';
const horaBR = (t) => new Date((t || Date.now()) - 3 * 3600000).getUTCHours();
export async function horasBaratas() {
  const H = await calcHorarios(14, false);
  const P = (H && H.porHora) || [];
  let b = P.filter((x) => x.cor === 'verde').map((x) => x.h);
  if (b.length < 3) b = P.filter((x) => x.vendas >= 1 && x.cpa).sort((x, y) => x.cpa - y.cpa).slice(0, 6).map((x) => x.h);
  return b.sort((x, y) => x - y);
}

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
  const prim = 10, lim = cfg.cpaLimite || 13, cpaSobe = cfg.cpaMax || 7;
  const meta = await metaAds(7, null, null, true);
  if (!meta.configurado || meta.erro) { if (meta.erro && !simular) await logRobo({ tipo: 'erro', motivo: meta.erro }); return { ok: false, motivo: meta.erro }; }
  const [acoes, site] = await Promise.all([ultimasAcoes(), vendasSitePorCampanha(31)]);
  const agora = Date.now(), hoje = diaBR(agora), feitas = [];
  // ⏰ modo horário barato: estado do dia (e o de ontem, pra voltar ao normal à meia-noite)
  const ontem = diaBR(agora - 864e5);
  const modo = (await L().get('modohor_' + hoje, { type: 'json' }).catch(() => null)) || {};
  const modoOntem = (await L().get('modohor_' + ontem, { type: 'json' }).catch(() => null)) || {};
  let baratas = null; const pegaBaratas = async () => { if (!baratas) { try { baratas = await horasBaratas(); } catch (e) { baratas = []; } } return baratas; };
  const hAgora = horaBR(agora);
  for (const [id, m] of Object.entries(modoOntem)) {
    if (m.fim || modo[id]) continue;
    const c = (meta.campanhas || []).find((x) => x.id === id);
    if (c && c.status !== 'ACTIVE' && m.ultimo === 'off') {
      try { if (!simular) { await aplicarAcao(c, 'ativar', QUEM_HB); c.status = 'ACTIVE'; } feitas.push({ tipo: 'horario', camp: c.nome, id, aviso: false, motivo: 'dia novo: saiu do modo horário barato e voltou a rodar o dia todo' }); } catch (e) {}
    }
    m.fim = true;
  }
  if (!simular && Object.keys(modoOntem).length) await L().setJSON('modohor_' + ontem, modoOntem).catch(() => {});
  // 🌙 MEIA-NOITE: religa as que o ROBÔ desligou ontem (as que VOCÊ desligou ficam desligadas)
  if (cfg.autoPausar && agora >= Date.parse('2026-11-12T03:00:00Z')) for (const c of (meta.campanhas || [])) { // começa na meia-noite de 12/11
    const a = acoes[c.id];
    if (c.status === 'ACTIVE' || !a || a.tipo !== 'pausar' || !/^robô/.test(a.quem || '') || diaBR(a.em) !== ontem) continue;
    try { if (!simular) { await aplicarAcao(c, 'ativar', 'robô (meia-noite)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (meia-noite)', em: agora }; } c.status = 'ACTIVE'; c._religada = true;
      feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: false, motivo: 'dia novo: religuei (ontem eu tinha desligado)' }); }
    catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui religar à meia-noite: ' + e.message }); }
  }
  const ativas = (meta.campanhas || []).filter((c) => c.status === 'ACTIVE' || (modo[c.id] && !modo[c.id].fim));
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
    // modo horário: VOCÊ mexeu? (o robô tinha desligado e está ligada → você religou; o robô tinha ligado e está desligada → você desligou)
    let m = modo[c.id] && !modo[c.id].fim ? modo[c.id] : null;
    if (m && m.ultimo === 'off' && c.status === 'ACTIVE') {
      if (!simular) await registrarAcao(c.id, 'ativar', { quem: 'você (app do Meta)' }).catch(() => {});
      acoes[c.id] = a = { tipo: 'ativar', quem: 'você (app do Meta)', em: agora }; m.fim = true; m.saiu = 'você religou'; m = null;
    } else if (m && m.ultimo === 'on' && c.status !== 'ACTIVE') { m.fim = true; m.saiu = 'você desligou'; continue; }
    if (c.status !== 'ACTIVE' && !m) continue;
    const voceAtivou = a && a.tipo === 'ativar' && !/^robô/.test(a.quem || '') && diaBR(a.em) === hoje;
    let pausar = null;
    const lucroH = vH * tk - gH * (1 + imp);
    const vMeta = dh.compras || 0, vCpa = vMeta || vH; // custo por compra = o do app do Meta (se o Meta ainda não contou, usa as do site)
    if (cfg.autoPausar && !voceAtivou) { // REGRA DE 11/11 (19h): só o dia de hoje
      if (vH === 0 && gH >= prim) pausar = 'hoje gastou ' + brl(gH) + ' e não fez nenhuma venda (limite ' + brl(prim) + ')';
      else if (vCpa > 0 && gH / vCpa > CPA_MAX) pausar = 'hoje o custo por compra está ' + brl(gH / vCpa) + ' (' + vCpa + ' compra(s) no Meta, gasto ' + brl(gH) + ') — passou do máximo de ' + brl(CPA_MAX);
    }
    // estava no modo horário (regra antiga) e NÃO está no prejuízo → volta a rodar o dia todo
    if (m && !pausar) {
      m.fim = true; m.saiu = 'regra nova (lucro)';
      if (c.status !== 'ACTIVE') { try { if (!simular) await aplicarAcao(c, 'ativar', QUEM_HB); c.status = 'ACTIVE'; feitas.push({ tipo: 'horario', camp: c.nome, id: c.id, aviso: true, motivo: 'hoje está no lucro (' + brl(lucroH) + '): saiu do modo horário e voltou a rodar o dia todo' }); } catch (e) {} }
      m = null;
    }
    if (pausar) {
      if (m) { m.fim = true; m.saiu = 'bateu o limite'; }
      if (c.status !== 'ACTIVE') { if (!simular) await registrarAcao(c.id, 'pausar', { quem: 'robô' }).catch(() => {}); feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: pausar + ' — estava no modo horário barato, agora fica desligada até amanhã' }); continue; }
      try { if (!simular) await aplicarAcao(c, 'pausar', 'robô'); feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: pausar }); }
      catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui desligar: ' + e.message }); }
      continue;
    }
    // ⏰ MODO HORÁRIO BARATO
    if (cfg.autoPausar && !voceAtivou) {
      if (HB_LIGADO && !m && c.status === 'ACTIVE' && vH >= 2 && cpaH > HB_ENTRA) {
        const hb = await pegaBaratas();
        if (hb.length >= 3) {
          m = modo[c.id] = { desde: agora, ultimo: 'on', cpaEntrou: +cpaH.toFixed(2) };
          feitas.push({ tipo: 'horario', camp: c.nome, id: c.id, aviso: true, motivo: 'hoje ' + vH + ' vendas a ' + brl(cpaH) + ' (acima de ' + brl(HB_ENTRA) + '). Entrou no ⏰ modo horário barato: só fica ligada nas horas baratas (' + hb.map((h) => h + 'h').join(', ') + '). Se baixar pra ' + brl(HB_SAI) + ' volta ao normal.' });
        }
      } else if (m && vH > 0 && cpaH <= HB_SAI) {
        m.fim = true; m.saiu = 'melhorou';
        if (c.status !== 'ACTIVE') { try { if (!simular) await aplicarAcao(c, 'ativar', QUEM_HB); } catch (e) {} }
        feitas.push({ tipo: 'horario', camp: c.nome, id: c.id, aviso: true, motivo: 'melhorou: hoje ' + vH + ' vendas a ' + brl(cpaH) + '. Saiu do modo horário barato e volta a rodar o dia todo.' });
        m = null;
      }
      if (m) {
        const hb = await pegaBaratas(), quer = hb.indexOf(hAgora) >= 0 ? 'on' : 'off', esta = c.status === 'ACTIVE' ? 'on' : 'off';
        if (quer !== esta) {
          try { if (!simular) await aplicarAcao(c, quer === 'on' ? 'ativar' : 'pausar', QUEM_HB);
            feitas.push({ tipo: 'horario', camp: c.nome, id: c.id, aviso: false, motivo: (quer === 'on' ? '▶️ liguei: ' + hAgora + 'h é hora barata' : '⏸ desliguei: ' + hAgora + 'h é hora cara') + ' (modo horário barato, hoje ' + brl(cpaH || 0) + '/venda)' }); }
          catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'modo horário: não consegui ' + (quer === 'on' ? 'ligar' : 'desligar') + ': ' + e.message }); }
        }
        m.ultimo = quer;
        continue; // no modo horário não avisa "pode subir"
      }
    }
    if (c.status !== 'ACTIVE') continue;
    // PODE SUBIR? só avisa (quem sobe é você) — 1 aviso por dia por campanha
    if (cfg.autoSubir && c.orcamentoDia) {
      const av = avaliarSubir(c, s.porDia, a, cpaSobe, agora);
      if (av.agora) {
        const k = 'podesubir_' + c.id + '_' + hoje;
        if (simular || !(await L().get(k).catch(() => null))) {
          if (!simular) await L().set(k, '1').catch(() => {});
          feitas.push({ tipo: 'podeSubir', camp: c.nome, id: c.id, aviso: true, motivo: 'está vendendo barato: ' + av.vendas + ' vendas a ' + brl(av.cpa) + ' nos últimos 3 dias' + (vH ? ' (hoje ' + vH + ' a ' + brl(cpaH) + ')' : '') + '. Pode subir de ' + brl(c.orcamentoDia) + ' para ' + brl(av.novo) + '/dia (+20%) — tem o botão na aba Campanhas do painel.' });
        }
      }
    }
  }
  if (!simular) {
    await L().setJSON('cpa_hist_' + hoje, fotos).catch(() => {});
    await L().setJSON('modohor_' + hoje, modo).catch(() => {});
    const avisos = [];
    for (const f of feitas) {
      await logRobo(f);
      if (f.aviso) avisos.push((f.tipo === 'pausou' ? '⏸ Desliguei' : f.tipo === 'podeSubir' ? '🟢 PODE SUBIR:' : f.tipo === 'horario' ? '⏰' : '⚠️ Erro em') + ' *' + f.camp + '*\n' + f.motivo);
    }
    if (avisos.length) await avisar(avisos.join('\n\n'));
  }
  return { ok: true, feitas, modoHorario: modo };
}
export default async () => { try { await rodarRobo(false); } catch (e) { console.error('robô:', e && e.message); await logRobo({ tipo: 'erro', motivo: e.message }).catch(() => {}); } };
