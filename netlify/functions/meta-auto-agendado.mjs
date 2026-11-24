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
// REGRA DE 15/11 (atual): 🌙 À MEIA-NOITE liga TODAS as campanhas marcadas na aba "🌙 Meia-noite" do painel.
//   Durante o dia, gasto SEM NENHUMA COMPRA: campanha BOA (vendeu nos 3 dias anteriores com custo/compra até R$ 9,99) → até R$ 9,99;
//   campanha nova/parada → até R$ 7. Passou → desliga e fica 40 min vigiando: se o Meta contar uma compra atrasada, religa.
//   Vendendo: continua o dia todo; só desliga se a média de 3 dias (custo por compra) passar de R$ 9,50 (prejudica no longo prazo).
// REGRA DE 14/11: campanha com 2+ dias de dados decide pela MÉDIA DE 3 DIAS (custo/compra até R$ 9,50; R$ 10 em 3 dias sem compra → desliga;
//   trava: R$ 15 hoje sem compra → desliga). Campanha nova (menos de 2 dias) segue a regra só de hoje.
import { getStore } from '@netlify/blobs';
import { metaAds, recomendar, ultimasAcoes, TICKET, avaliarSubir } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar, vendasSitePorCampanha, graphConta, graph } from './_meta.mjs';
import { registrarAcao } from './_gastos.mjs';
import { diaBR, brl, imposto, cpa3dias } from './_resumo.mjs';
import { calcHorarios } from './_horarios.mjs';
import { futuro, cpaMaxDe, top10 } from './_futuro.mjs';
import { aplicarAumento } from './_aumento.mjs';

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
  // 🛡️ VIGIAS: campanhas que você mandou o robô vigiar com o SEU limite (funcionam mesmo com o robô geral desligado)
  const vigias = (await getStore('gastos').get('vigias', { type: 'json' }).catch(() => null)) || {};
  const temVigia = Object.values(vigias).some((v) => v && v.ligado);
  if (!cfg.autoPausar && !cfg.autoSubir && !temVigia) return { ok: true, motivo: 'robô desligado', feitas: [] };
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
  // 🌙 MEIA-NOITE (regra de 17/11): liga SÓ as campanhas marcadas que TÊM FUTURO (última semana: 3+ vendas a até R$ 9,50 cada).
  //    As ligadas SEM futuro que já gastaram R$ 10+ na semana sem provar que vendem → desliga. Campanha nova (gastou menos de R$ 10) fica.
  // 🎓 APRENDIZAGEM (17/11): até 2 campanhas que você escolheu no painel — o robô NUNCA desliga, liga à meia-noite e só AVISA se regredir
  const especial = new Set(((await L().get('especial_cfg', { type: 'json' }).catch(() => null)) || {}).ids || []);
  // 20/11 23h (Gusthavo): campanha de VALOR (orçamento R$ 300+/dia, ex.: Capivarinha #007 R$ 600, mamazona R$ 300) segue a regra do modo especial;
  //   as outras seguem a regra normal (passou do limite por venda → desliga)
  const lucroHoje = new Set(((await L().get('lucro_hoje_' + hoje, { type: 'json' }).catch(() => null)) || {}).ids || []); // 21/11: lucraram ontem e anteontem → hoje regra do modo especial
  const ehEspecial = (c) => especial.has(String(c.id)) || lucroHoje.has(String(c.id)) || /modo\s*especial|capivarinha\s*#?\s*007/i.test(c.nome || '') || Number(c.orcamentoDia || 0) >= 300;
  const aprend = new Set(((await L().get('aprendizagem_cfg', { type: 'json' }).catch(() => null)) || {}).ids || []);
  const flagMN = 'meianoite_feito_' + hoje, FLAG_JA = 'futuro_agora_20261117b', FLAG_DESFAZ = 'desfaz_roas_20261117';
  // ↩️ 22/11: regra nova é por DIA (sem média de 3 dias) — religa (uma vez, hoje) as que o robô desligou HOJE e estão com custo por compra do dia até R$ 10
  // 24/11: uma vez POR DIA, religa o que o robô desligou hoje com custo por compra do dia até R$ 10 (não podia ter desligado)
  const FLAG_DIA = 'desfaz_lucro_' + hoje;
  if (cfg.autoPausar && !simular && !(await L().get(FLAG_DIA, { type: 'json' }).catch(() => null))) {
    await L().setJSON(FLAG_DIA, { em: agora }).catch(() => {});
    for (const c of (meta.campanhas || [])) {
      const ac = acoes[c.id];
      if (c.status === 'ACTIVE' || !ac || ac.tipo !== 'pausar' || !/^robô$/.test(ac.quem || '') || diaBR(ac.em) !== hoje || ehEspecial(c) || (vigias[c.id] && vigias[c.id].ligado)) continue;
      const d0 = (c.dias || {})[hoje] || {}, v0 = Math.max(d0.compras || 0, ((site[c.id] || {}).porDia || {})[hoje] || 0);
      if (!(v0 > 0 && (d0.gasto || 0) / v0 <= 10)) continue;
      try { await aplicarAcao(c, 'ativar', 'robô (regra do dia)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (regra do dia)', em: agora }; c.status = 'ACTIVE';
        feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: true, motivo: '↩️ religuei: hoje está ' + brl(d0.gasto / v0) + ' por compra (' + v0 + ' compra(s)) — está lucrando (até R$ 10 por compra hoje), não podia ter desligado' }); } catch (e) {}
    }
  }
  // ↩️ 17/11 21h: desfaz o corte por ROAS 1,5 por campanha — religa (uma vez) as que o robô desligou desde 19h50 e passam na regra de R$ 9,50
  if (cfg.autoPausar && !simular && !(await L().get(FLAG_DESFAZ, { type: 'json' }).catch(() => null))) {
    await L().setJSON(FLAG_DESFAZ, { em: agora }).catch(() => {});
    const desde = Date.parse('2026-11-17T22:50:00Z');
    for (const c of (meta.campanhas || [])) {
      const ac = acoes[c.id];
      if (c.status === 'ACTIVE' || !ac || ac.tipo !== 'pausar' || !/^robô/.test(ac.quem || '') || !(ac.em >= desde)) continue;
      const d0 = (c.dias || {})[hoje] || {}, v0 = Math.max(d0.compras || 0, ((site[c.id] || {}).porDia || {})[hoje] || 0);
      if (!futuro(c, site, agora).tem && !(v0 > 0 && (d0.gasto || 0) / v0 <= 9.99)) continue;
      try { await aplicarAcao(c, 'ativar', 'robô (desfez ROAS)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (desfez ROAS)', em: agora }; c.status = 'ACTIVE';
        feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: true, motivo: '↩️ religuei: tinha desligado pela regra de ROAS 1,5 por campanha (errada). ROAS 1,5 é meta geral, não corta campanha.' }); } catch (e) {}
    }
  }
  // ⚡ aplicação ÚNICA agora (17/11 à noite): mesma análise da meia-noite, com a semana até hoje
  let jaAgora = cfg.autoPausar && !simular && !(await L().get(FLAG_JA, { type: 'json' }).catch(() => null));
  if (jaAgora) await L().setJSON(FLAG_JA, { em: agora }).catch(() => {});
  // 🏆 estratégia das 10 melhores começa hoje às 23h (depois: todo dia à meia-noite)
  const FLAG_23 = 'top10_23h_20261117';
  if (cfg.autoPausar && !simular && hoje === '2026-11-17' && horaBR(agora) === 23 && !(await L().get(FLAG_23, { type: 'json' }).catch(() => null))) { await L().setJSON(FLAG_23, { em: agora }).catch(() => {}); jaAgora = true; }
  if (cfg.autoPausar && (jaAgora || !(await L().get(flagMN, { type: 'json' }).catch(() => null)))) {
    if (!simular && !jaAgora) await L().setJSON(flagMN, { em: agora }).catch(() => {});
    if (horaBR(agora) === 0 || jaAgora) { // só na primeira rodada do dia novo (00h17) — ou na aplicação única
      const mn = (await L().get('meianoite_cfg', { type: 'json' }).catch(() => null)) || {}, fora = mn.fora || [];
      let todas = [];
      try { todas = ((await graphConta('GET', 'campaigns', { fields: 'name,effective_status', limit: 400 })).data || []).map((x) => ({ id: String(x.id), nome: x.name, status: x.effective_status })); } catch (e) { todas = (meta.campanhas || []).map((x) => ({ id: String(x.id), nome: x.nome, status: x.status })); }
      const top = new Set(top10(meta.campanhas, site, jaAgora ? agora : agora - 864e5, new Set(fora.map(String).concat([...aprend]))));
      if (!simular) await L().setJSON('top10_' + hoje, { ids: [...top], em: agora }).catch(() => {});
      for (const c of todas) {
        const mc = (meta.campanhas || []).find((x) => String(x.id) === c.id);
        if (aprend.has(c.id)) { // 🎓 aprendizagem: nunca desliga; se estiver desligada, liga
          if (c.status !== 'ACTIVE' && /PAUSED/.test(String(c.status || ''))) { try { if (!simular) { await aplicarAcao(c, 'ativar', 'robô (aprendizagem)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (aprendizagem)', em: agora }; } if (mc) mc.status = 'ACTIVE'; feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: false, motivo: '🎓 campanha de aprendizagem: liguei (o robô não desliga)' }); } catch (e) {} }
          continue;
        }
        const f = futuro(mc || { id: c.id, nome: c.nome, dias: {} }, site, jaAgora ? agora : agora - 864e5);
        const txt = f.vendas + ' venda(s) na semana' + (f.cpa != null ? ' a ' + brl(f.cpa) + ' cada' : '') + ', gasto ' + brl(f.gasto);
        if (c.status === 'ACTIVE') { // ligada sem futuro → desliga (só se já teve chance: R$ 10+ na semana)
          const ac = acoes[c.id]; if (ac && ac.tipo === 'ativar' && !/^robô/.test(ac.quem || '') && diaBR(ac.em) === hoje) continue; // você ligou hoje → respeita
          // 24/11: você religou nas últimas 24h (pelo painel ou pelo app do Meta, depois do robô desligar) → a meia-noite também não desliga
          const ac0 = acoes[c.id], ha24 = ac0 && agora - (ac0.em || 0) < 864e5;
          if (ha24 && ((ac0.tipo === 'pausar' && /^robô/.test(ac0.quem || '') && c.status === 'ACTIVE') || (ac0.tipo === 'ativar' && !/^robô/.test(ac0.quem || '')))) continue;
          if (f.tem || f.gasto < 10 || f.eua || ehEspecial(c)) continue; // modo especial: só a regra do dia dele // EUA segue as regras próprias (média de 3 dias, R$ 30)
          try { if (!simular) { await aplicarAcao(c, 'pausar', 'robô'); acoes[c.id] = { tipo: 'pausar', quem: 'robô', em: agora }; } if (mc) mc.status = 'PAUSED';
            feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: (jaAgora ? '⚡ análise de agora' : '🌙 dia novo') + ': desliguei, não tem futuro (' + txt + ')' }); }
          catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui desligar à meia-noite: ' + e.message }); }
          continue;
        }
        if (fora.indexOf(String(c.id)) >= 0 || !/PAUSED/.test(String(c.status || ''))) continue;
        if (!top.has(c.id)) continue; // 🏆 só liga as 10 melhores (as outras só se VOCÊ ligar)
        if (jaAgora) { const ap = acoes[c.id]; if (ap && ap.tipo === 'pausar' && diaBR(ap.em) === hoje) continue; } // desligada hoje pela regra do dia → não religa agora
        if (mc) mc.status = 'ACTIVE';
        try { if (!simular) { await aplicarAcao(c, 'ativar', 'robô (meia-noite)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (meia-noite)', em: agora }; }
          feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: false, motivo: (jaAgora ? '⚡ análise de agora' : '🌙 dia novo') + ': liguei — 🏆 está entre as 10 melhores (' + txt + ')' }); }
        catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui ligar à meia-noite: ' + e.message }); }
      }
    }
  }
  // 📈 AUMENTO DIÁRIO (20/11, pedido do Gusthavo): as campanhas que você marcou na aba "📈 Aumento" sobem +10% no orçamento
  //    todo dia, 1 vez (primeira rodada do dia, depois da meia-noite). Só as que estão LIGADAS. Respeita o teto, se você colocou.
  const FLAG_AU = 'aumento_feito_' + hoje;
  if (!simular && !(await L().get(FLAG_AU, { type: 'json' }).catch(() => null))) {
    const au = (await L().get('aumento_cfg', { type: 'json' }).catch(() => null)) || {};
    const ids = (au.ids || []).map(String), teto = Number(au.teto) > 0 ? Number(au.teto) : null, pct = Number(au.pct) > 0 ? Number(au.pct) : 10;
    if (ids.length && au.auto === true) { // 20/11: agora você sobe campanha por campanha no painel (botão); o automático fica desligado
      await L().setJSON(FLAG_AU, { em: agora }).catch(() => {});
      feitas.push(...(await aplicarAumento(meta.campanhas, ids, teto, pct, 'robô (+' + pct + '%/dia)')));
    }
  }
  const atraso = (await L().get('vigia_atraso', { type: 'json' }).catch(() => null)) || {};
  // 🔁 REVISÃO (regra de 15/11): campanha que o ROBÔ desligou hoje e depois o Meta contou compras (atrasadas)
  //    → se o dia dela está POSITIVO (custo por compra até R$ 9,99) e a média de 3 dias não está no prejuízo, RELIGA.
  if (cfg.autoPausar) for (const c of (meta.campanhas || [])) {
    const a = acoes[c.id];
    if (c.status === 'ACTIVE' || !a || a.tipo !== 'pausar' || a.quem !== 'robô' || diaBR(a.em) !== hoje) continue;
    if (/(^|[^a-z])(eua|usa|us)([^a-z]|$)/i.test(String(c.nome || ''))) continue;
    const s0 = site[c.id] || { porDia: {} }, d0 = (c.dias || {})[hoje] || {}, g0 = d0.gasto || 0, v0 = Math.max(d0.compras || 0, s0.porDia[hoje] || 0);
    if (aprend.has(c.id)) continue;
    const limR = cpaMaxDe(c.id, site); if (!v0 || g0 / v0 > 9.99) continue;
    let g3r = 0, v3r = 0; for (const d of [hoje, ontem, diaBR(agora - 2 * 864e5)]) { const x = (c.dias || {})[d] || {}; g3r += x.gasto || 0; v3r += Math.max(x.compras || 0, s0.porDia[d] || 0); }
    if (v3r && g3r / v3r > limR) continue;
    try { if (!simular) { await aplicarAcao(c, 'ativar', 'robô (dia positivo)'); acoes[c.id] = { tipo: 'ativar', quem: 'robô (dia positivo)', em: agora }; } c.status = 'ACTIVE'; delete atraso[c.id];
      feitas.push({ tipo: 'religou', camp: c.nome, id: c.id, aviso: true, motivo: '▶️ religuei: depois que eu desliguei o Meta contou ' + v0 + ' compra(s) — hoje está positivo (' + brl(g0 / v0) + ' por compra, gasto ' + brl(g0) + '). Ela continua o dia.' }); }
    catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: 'não consegui religar: ' + e.message }); }
  }
  const ativas = (meta.campanhas || []).filter((c) => c.status === 'ACTIVE' || (modo[c.id] && !modo[c.id].fim));
  const fotos = (await L().get('cpa_hist_' + hoje, { type: 'json' }).catch(() => null)) || {}; // custo por venda de hoje a cada conferência
  // 🧹 LIMPEZA ÚNICA (14/11): olha a média de 3 dias de TODAS as ligadas, mesmo as que você ligou hoje (só nessa primeira rodada)
  const LIMPEZA = 'limpeza3d_20261114';
  const limpezaAgora = cfg.autoPausar && agora >= Date.parse('2026-11-14T08:45:00Z') && !(await L().get(LIMPEZA, { type: 'json' }).catch(() => null));
  const dias3 = [hoje, ontem, diaBR(agora - 2 * 864e5)];
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
    // ⭐ MODO ESPECIAL (20/11): campanha com "modo especial" no nome — aposta de orçamento alto, monitorada de perto.
    //    Hoje: R$ 30 sem nenhuma venda → desliga. R$ 40 com só 1 venda → desliga. 2+ vendas → continua e te avisa como está indo.
    if (ehEspecial(c)) {
      const kA = 'esp_' + c.id + '_' + hoje, st = (await L().get(kA, { type: 'json' }).catch(() => null)) || { avisadas: 0, lucroAvisado: false };
      let corte = null;
      if (vH === 0 && gH >= 30) corte = 'gastou ' + brl(gH) + ' hoje sem nenhuma venda (limite R$ 30)';
      else if (vH === 1 && gH >= 40) corte = 'gastou ' + brl(gH) + ' hoje com só 1 venda (limite R$ 40)';
      if (corte) {
        try { if (!simular) { await aplicarAcao(c, 'pausar', 'robô'); acoes[c.id] = { tipo: 'pausar', quem: 'robô', em: agora }; }
          feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: '⭐ MODO ESPECIAL não deu certo hoje: ' + corte + '. Desliguei.' }); }
        catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id: c.id, aviso: true, motivo: '⭐ modo especial: não consegui desligar: ' + e.message }); }
        continue;
      }
      const cpaE = vH ? gH / vH : null, marco = vH >= 1 && (vH <= 2 || vH - st.avisadas >= 5);
      if (vH > st.avisadas && (marco || (cpaE <= 9.5 && !st.lucroAvisado))) {
        const lucro = cpaE != null && cpaE <= 9.5;
        feitas.push({ tipo: 'alerta', camp: c.nome, id: c.id, aviso: true, motivo: '⭐ MODO ESPECIAL: ' + vH + ' venda(s) hoje, gasto ' + brl(gH) + ' (' + brl(cpaE) + ' por venda). ' + (lucro ? '🟢 Está dando lucro, segue rodando.' : vH >= 2 ? '🟡 Passou da trava, segue aprendendo — custo ainda alto.' : '🟡 Primeira venda, segue rodando (corta se chegar em R$ 40 com só 1 venda).') });
        st.avisadas = vH; if (lucro) st.lucroAvisado = true;
        if (!simular) await L().setJSON(kA, st).catch(() => {});
      }
      continue;
    }
    if (aprend.has(c.id)) { // 🎓 aprendizagem: não desliga; só avisa (1x por dia) se gastar R$ 50+ hoje sem venda
      if (gH >= 50 && vH === 0) { const k = 'aprend_alerta_' + c.id + '_' + hoje; if (simular || !(await L().get(k).catch(() => null))) { if (!simular) await L().set(k, '1').catch(() => {}); feitas.push({ tipo: 'alerta', camp: c.nome, id: c.id, aviso: true, motivo: '🎓 campanha de aprendizagem gastou ' + brl(gH) + ' hoje sem nenhuma venda. NÃO desliguei — veja na aba 🎓 Aprendizagem se ela está progredindo e decida.' }); } }
      continue;
    }
    // 23/11: você religou pelo app do Meta (o robô tinha desligado hoje e agora ela está ATIVA) → conta como "você ligou": robô não mexe até meia-noite
    const religouNoApp = !limpezaAgora && a && a.tipo === 'pausar' && /^robô/.test(a.quem || '') && diaBR(a.em) === hoje && c.status === 'ACTIVE';
    const voceAtivou = religouNoApp || (!limpezaAgora && a && a.tipo === 'ativar' && !/^robô/.test(a.quem || '') && diaBR(a.em) === hoje);
    // 📊 MÉDIA DE 3 DIAS (hoje + 2 anteriores): gasto e compras do Meta (se o Meta não contou, as do site)
    let g3 = 0, v3m = 0, v3s = 0, diasDados = 0;
    for (const d of dias3) { const x = (c.dias || {})[d] || {}; g3 += x.gasto || 0; v3m += x.compras || 0; v3s += s.porDia[d] || 0; if ((x.gasto || 0) > 0) diasDados++; }
    const v3 = v3m || v3s, aprendeu = diasDados >= 2;
    // 🇺🇸 campanha dos EUA (nome com "EUA", "USA" ou "US"): venda de US$ 7,99 → aceita custo por compra até R$ 30 (lucro > R$ 10)
    const eua = /(^|[^a-z])(eua|usa|us)([^a-z]|$)/i.test(String(c.nome || ''));
    const CPA_BR = cpaMaxDe(c.id, site); // R$ 9,50 por venda (ROAS 1,5 é meta geral da conta, não corta campanha)
    const CPA_C = eua ? 30 : CPA_BR, PRIM_C = eua ? 30 : prim, TRAVA_C = eua ? 45 : 15;
    let pausar = null;
    const lucroH = vH * tk - gH * (1 + imp);
    const vMeta = dh.compras || 0, vCpa = vMeta || vH; const vDia = Math.max(vMeta, vH), CPA_DIA = 10; // 22/11: custo por compra do DIA (o maior número de compras entre Meta e site) // custo por compra = o do app do Meta (se o Meta ainda não contou, usa as do site)
    // ⭐ campanha BOA = vendeu nos 3 dias ANTERIORES a hoje com custo por compra até R$ 9,99
    let gP = 0, vPm = 0, vPs = 0;
    for (const d of [ontem, diaBR(agora - 2 * 864e5), diaBR(agora - 3 * 864e5)]) { const x = (c.dias || {})[d] || {}; gP += x.gasto || 0; vPm += x.compras || 0; vPs += s.porDia[d] || 0; }
    const vP = vPm || vPs, boa = (vP > 0 && gP / vP <= 9.99) || futuro(c, site, agora - 864e5).tem;
    // ❌ sem chance: nos 3 dias anteriores gastou R$ 5+ e não vendeu NADA em 2 ou mais dias → corta mais cedo (R$ 5)
    let diasRuins = 0; for (const d of [ontem, diaBR(agora - 2 * 864e5), diaBR(agora - 3 * 864e5)]) { const x = (c.dias || {})[d] || {}; if ((x.gasto || 0) >= 5 && !(x.compras || 0) && !(s.porDia[d] || 0)) diasRuins++; }
    const semChance = !boa && diasRuins >= 2, LIM_SEM = boa ? 20 : semChance ? 5 : 7; // 22/11: campanha boa pode gastar até R$ 20 sem compra
    let semCompra = false;
    if (cfg.autoPausar && !voceAtivou && !eua) { // REGRA DE 15/11 (Brasil)
      if (vH === 0 && gH >= LIM_SEM) { pausar = 'hoje gastou ' + brl(gH) + ' sem nenhuma compra (' + (boa ? '⭐ campanha boa, limite R$ 20' : semChance ? 'sem chance: ' + diasRuins + ' dos últimos 3 dias sem nenhuma venda, limite R$ 5' : 'campanha nova/parada, limite R$ 7') + ')'; semCompra = true; }
      // 22/11 (Gusthavo): NÃO existe média — vale o custo por compra DO DIA. Passou de R$ 10 hoje → desliga; não passou → fica.
      //   Campanha ⭐ boa (vendeu bem nos dias anteriores) começa cara e termina positiva → fica ligada (só a regra do "sem compra" vale pra ela).
      else if (!boa && vDia > 0 && gH / vDia > CPA_DIA) pausar = 'hoje o custo por compra está ' + brl(gH / vDia) + ' (' + vDia + ' compra(s), gasto ' + brl(gH) + ') — passou de ' + brl(CPA_DIA) + ' no dia';
      // 22/11 13h: ⭐ campanha boa → 1 compra: pode gastar até R$ 20
      // 23/11 (Gusthavo): o corte de R$ 8 derrubou campanha LUCRANDO (12z a R$ 8,08) → campanha boa com 2+ compras só sai se passar de R$ 10 por compra, igual às outras
      else if (boa && vDia === 1 && gH > 20) pausar = '⭐ campanha boa: 1 compra e já gastou ' + brl(gH) + ' (limite R$ 20)';
      else if (boa && vDia >= 2 && gH / vDia > CPA_DIA) pausar = '⭐ campanha boa: ' + vDia + ' compras a ' + brl(gH / vDia) + ' cada (gasto ' + brl(gH) + ') — passou de ' + brl(CPA_DIA) + ' por compra';
    } else if (cfg.autoPausar && !voceAtivou && aprendeu) { // 🇺🇸 EUA: média de 3 dias
      if (v3 === 0 && g3 >= PRIM_C) pausar = 'em 3 dias gastou ' + brl(g3) + ' e não fez nenhuma compra' + (eua ? ' (EUA, limite ' + brl(PRIM_C) + ')' : '');
      else if (v3 > 0 && g3 / v3 > CPA_C) pausar = 'média de 3 dias: custo por compra ' + brl(g3 / v3) + ' (' + v3 + ' compra(s), gasto ' + brl(g3) + ') — passou do máximo de ' + brl(CPA_C);
      else if (vH === 0 && gH >= TRAVA_C) { pausar = 'trava de segurança: hoje gastou ' + brl(gH) + ' sem nenhuma compra (limite ' + brl(TRAVA_C) + ')'; semCompra = true; }
    } else if (cfg.autoPausar && !voceAtivou) { // 🇺🇸 EUA campanha nova: regra só do dia de hoje
      if (vH === 0 && gH >= PRIM_C) { pausar = 'hoje gastou ' + brl(gH) + ' e não fez nenhuma venda (limite ' + brl(PRIM_C) + ')'; semCompra = true; }
      else if (vCpa > 0 && gH / vCpa > CPA_C) pausar = 'hoje o custo por compra está ' + brl(gH / vCpa) + ' (' + vCpa + ' compra(s) no Meta, gasto ' + brl(gH) + ') — passou do máximo de ' + brl(CPA_C);
    }
    // 🛡️ VIGIA desta campanha (você ligou no painel): o SEU limite vale sempre, mesmo se foi você quem ligou/subiu hoje
    const vg = vigias[c.id];
    if (!pausar && vg && vg.ligado && c.status === 'ACTIVE') {
      if (vH === 0 && vg.semCompra && gH >= vg.semCompra) pausar = '🛡️ vigia: hoje gastou ' + brl(gH) + ' sem nenhuma compra (seu limite: ' + brl(vg.semCompra) + ')';
      else if (vCpa > 0 && vg.cpaMax && gH / vCpa > vg.cpaMax) pausar = '🛡️ vigia: hoje o custo por compra está ' + brl(gH / vCpa) + ' (' + vCpa + ' compra(s), gasto ' + brl(gH) + ') — passou do seu limite de ' + brl(vg.cpaMax);
      else if (vg.gastoMax && gH >= vg.gastoMax) pausar = '🛡️ vigia: hoje já gastou ' + brl(gH) + ' (seu limite de gasto do dia: ' + brl(vg.gastoMax) + ')';
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
      try { if (!simular) await aplicarAcao(c, 'pausar', 'robô'); feitas.push({ tipo: 'pausou', camp: c.nome, id: c.id, aviso: true, motivo: pausar + (semCompra ? ' — vou vigiar 40 min: se o Meta contar uma compra atrasada, eu religo' : '') });
        if (semCompra) atraso[c.id] = { em: agora, nome: c.nome, gasto: +gH.toFixed(2), dia: hoje }; }
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
    if (limpezaAgora) await L().setJSON(LIMPEZA, { em: agora }).catch(() => {});
    await L().setJSON('cpa_hist_' + hoje, fotos).catch(() => {});
    await L().setJSON('modohor_' + hoje, modo).catch(() => {});
    await L().setJSON('vigia_atraso', atraso).catch(() => {});
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
