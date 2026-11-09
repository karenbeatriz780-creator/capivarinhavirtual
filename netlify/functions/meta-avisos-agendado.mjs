// AVISOS NO WHATSAPP + PROTEÇÃO CONTRA QUEDA — roda a cada 10 min, cada coisa no seu horário:
//  • 7h: resumo de ONTEM (faturamento, anúncio com imposto, IA, lucro) + saldo da IA
//  • 12h, 17h e 19h: andamento de HOJE (bom / precisa de atenção)
//  • na hora: hoje saiu do zero 🎉 · hoje passou de R$ 30 de prejuízo ⚠️ · saldo da IA abaixo de R$ 10 🔻
//  • IA do site fora do ar (2 testes seguidos, 10 min de intervalo) → pausa TODAS as campanhas e avisa;
//    voltou → religa as mesmas e avisa
import { getStore } from '@netlify/blobs';
import { metaAds } from './_gastos.mjs';
import { lerCfg, aplicarAcao, logRobo, avisar } from './_meta.mjs';
import { resumoDia, textoResumo, saldoKieBRL, diaBR, horaBR, brl, rankingCampanhas } from './_resumo.mjs';
import { iaFetch, TEXTO_KIE, RESERVA_OR } from './_ia.mjs';

export const config = { schedule: '*/10 * * * *' };
const L = () => getStore({ name: 'gastos', consistency: 'strong' });
const uma = async (k) => { if (await L().get(k).catch(() => null)) return false; await L().set(k, '1').catch(() => {}); return true; }; // só uma vez
const RODAPE = '\n\n_Responda "ok" pra os avisos continuarem chegando._';

async function iaFunciona() {
  for (const m of [TEXTO_KIE[0], TEXTO_KIE[1], RESERVA_OR[0]]) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
      const r = await iaFetch('ia', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 20, messages: [{ role: 'user', content: 'Responda só: ok' }] }) });
      clearTimeout(t);
      const d = await r.json().catch(() => null);
      if (r.ok && d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) return true;
    } catch (e) {}
  }
  return false;
}

async function protecao(cfg) {
  const kie = await saldoKieBRL();
  const ok = (await iaFunciona()) && !(kie && kie.creditos < 15);
  const s = (await L().get('saude', { type: 'json' }).catch(() => null)) || { falhas: 0 };
  const emerg = await L().get('emergencia', { type: 'json' }).catch(() => null);
  if (ok) {
    await L().setJSON('saude', { falhas: 0, em: Date.now() });
    if (emerg) {
      const voltaram = [];
      for (const id of emerg.ids || []) { try { await aplicarAcao({ id }, 'ativar', 'robô'); voltaram.push(id); } catch (e) {} }
      await L().delete('emergencia');
      await logRobo({ tipo: 'ativou', camp: 'Emergência', motivo: 'IA voltou — religuei ' + voltaram.length + ' campanha(s)' });
      await avisar('✅ *A IA do site voltou a funcionar.* Religuei as ' + voltaram.length + ' campanha(s) que eu tinha pausado.');
    }
    return;
  }
  s.falhas = (s.falhas || 0) + 1; s.em = Date.now(); await L().setJSON('saude', s);
  if (s.falhas < 2 || emerg || !cfg.protecaoQueda) return;
  const meta = await metaAds(7, null, null, true);
  const ativas = (meta.campanhas || []).filter((c) => c.status === 'ACTIVE'), ids = [];
  for (const c of ativas) { try { await aplicarAcao(c, 'pausar', 'robô'); ids.push(c.id); } catch (e) {} }
  await L().setJSON('emergencia', { em: Date.now(), ids, motivo: kie && kie.creditos < 15 ? 'sem saldo na IA' : 'IA não responde' });
  await logRobo({ tipo: 'pausou', camp: 'Emergência', motivo: (kie && kie.creditos < 15 ? 'sem saldo na IA' : 'a IA do site não responde') + ' — pausei ' + ids.length + ' campanha(s)' });
  await avisar('🚨 *EMERGÊNCIA:* ' + (kie && kie.creditos < 15 ? 'acabou o saldo da IA (Kie)' : 'a IA do site parou de responder') + '. Os clientes não iam receber a música.\n\n⏸ Pausei ' + ids.length + ' campanha(s) pra não queimar dinheiro. Quando voltar, eu religo sozinho e te aviso.');
}

export async function rodarAvisos(forcar) {
  const cfg = await lerCfg(), agora = Date.now(), hoje = diaBR(agora), h = horaBR(agora), min = new Date(agora).getUTCMinutes();
  const hhmm = String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  // resumo de hoje logo depois de ligar (pedido do Gusthavo, só hoje)
  if (hoje === '2026-11-08' && await uma('av_inicial_' + hoje)) {
    const [r, kie] = await Promise.all([resumoDia(hoje), saldoKieBRL()]);
    await avisar('✅ *Tudo publicado e funcionando!*\n\n' + textoResumo(r, '📊 *Hoje até agora (' + hhmm + ')*') + (kie ? '\n🔋 Saldo da IA: ' + brl(kie.reais) : '') +
      '\n\nA partir de agora: resumo às 7h (dia anterior), andamento às 12h, 17h e 19h, e aviso na hora se der prejuízo, se a IA cair ou se o saldo dela ficar baixo.' + RODAPE);
    return 'inicial';
  }
  // 7h: ontem
  if (h >= 7 && h < 10 && await uma('av_7_' + hoje)) {
    const ontem = diaBR(agora - 864e5), [r, kie] = await Promise.all([resumoDia(ontem), saldoKieBRL()]);
    const rk = await rankingCampanhas(ontem).catch(() => '');
    await avisar(textoResumo(r, '☀️ *Bom dia! Resumo de ontem (' + ontem.split('-').reverse().slice(0, 2).join('/') + ')*') + (kie ? '\n🔋 Saldo da IA: ' + brl(kie.reais) + (kie.reais < (cfg.kieMin || 10) ? ' — *recarregue!*' : '') : '') + rk + RODAPE);
    return '7h';
  }
  // 12h, 17h, 19h: hoje
  for (const hs of [12, 17, 19]) {
    if (h === hs && await uma('av_' + hs + '_' + hoje)) {
      const r = await resumoDia(hoje);
      const st = r.lucro > 0 ? '✅ *Andamento bom*' : r.lucro > -15 ? '🟡 *Andamento no zero a zero* — atenção' : '⚠️ *Precisa de atenção*';
      const rk = hs === 19 ? await rankingCampanhas(hoje).catch(() => '') : '';
      await avisar(st + '\n\n' + textoResumo(r, '📊 *Hoje até agora (' + hhmm + ')*') + rk + (hs === 19 ? RODAPE : ''));
      return hs + 'h';
    }
  }
  // a cada 10 min: proteção contra queda
  await protecao(cfg);
  // a cada 10 min (deslocado): saldo da IA, saiu do zero, prejuízo
  {
    const kie = await saldoKieBRL();
    if (kie && kie.reais < (cfg.kieMin || 10) && await uma('av_kie_' + hoje)) await avisar('🔻 *Saldo da IA baixo:* só ' + brl(kie.reais) + ' na Kie (' + Math.round(kie.creditos) + ' créditos). Recarrega pra não parar de gerar música.');
    if (h >= 8) {
      const r = await resumoDia(hoje, false), k = 'av_estado_' + hoje;
      const ant = await L().get(k).catch(() => null);
      if (r.lucro > 0 && ant === 'neg' && await uma('av_zero_' + hoje)) await avisar('🎉 *Hoje saiu do zero!* Lucro de ' + brl(r.lucro) + ' até agora (' + r.vendas + ' vendas).');
      if (r.lucro <= -30 && h >= 10 && await uma('av_preju_' + hoje)) await avisar('⚠️ *Atenção:* hoje está com prejuízo de ' + brl(-r.lucro) + ' até agora.\n' + textoResumo(r, ''));
      await L().set(k, r.lucro > 0 ? 'pos' : 'neg').catch(() => {});
    }
  }
  return 'ok';
}
export default async () => { try { await rodarAvisos(); } catch (e) { console.error('avisos:', e && e.message); } };
