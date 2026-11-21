// 🟢 21/11 7h10 — pedido do Gusthavo: "pega as campanhas que estavam LUCRANDO ontem e anteontem e deixa ligadas, agora".
// Roda sozinho no próximo minuto, UMA vez só (trava no blob). Lucrando = nos DOIS dias (20/11 e 19/11) fez venda
// com custo por venda até R$ 9,50 (EUA: até R$ 30). Liga as que estiverem desligadas e põe todas na lista "lucro_hoje":
// hoje o robô vigia essas com a regra do modo especial (R$ 30 sem venda ou R$ 40 com 1 venda → desliga e avisa).
import { getStore } from '@netlify/blobs';
import { metaAds } from './_gastos.mjs';
import { aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { diaBR, brl } from './_resumo.mjs';
import { ehEUA, CPA_LIM, FUT_CPA_EUA } from './_futuro.mjs';

export const config = { schedule: '* * * * *' };
const DIA_ALVO = '2026-11-21';

export default async () => {
  const agora = Date.now(), hoje = diaBR(agora);
  if (hoje !== DIA_ALVO) return;
  const L = getStore('gastos'), FLAG = 'lucro_ligar_' + hoje;
  if (await L.get(FLAG).catch(() => null)) return;
  await L.setJSON(FLAG, { em: agora, status: 'rodando' });
  try {
    const meta = await metaAds(7, null, null, true);
    if (!meta.configurado || meta.erro) throw new Error(meta.erro || 'Meta não configurado');
    const site = await vendasSitePorCampanha(31);
    const dias = [diaBR(agora - 864e5), diaBR(agora - 2 * 864e5)];
    const boas = [];
    for (const c of meta.campanhas || []) {
      const s = (site && site[c.id]) || { porDia: {} }, lim = ehEUA(c.nome) ? FUT_CPA_EUA : CPA_LIM;
      const res = dias.map((d) => { const x = (c.dias || {})[d] || {}; const g = x.gasto || 0, v = Math.max(x.compras || 0, (s.porDia || {})[d] || 0); return { g, v, cpa: v ? g / v : null }; });
      if (res.every((r) => r.v >= 1 && r.cpa <= lim)) boas.push({ c, res });
    }
    const ligadas = [], jaLigadas = [], erros = [];
    for (const { c, res } of boas) {
      const txt = c.nome + ' (ontem ' + res[0].v + ' vendas a ' + brl(res[0].cpa) + ' · anteontem ' + res[1].v + ' a ' + brl(res[1].cpa) + ')';
      if (c.status === 'ACTIVE') { jaLigadas.push(txt); continue; }
      try { await aplicarAcao(c, 'ativar', 'robô (lucrou ontem e anteontem — pedido 21/11)'); ligadas.push(txt);
        await logRobo({ tipo: 'ativou', camp: c.nome, id: c.id, motivo: '🟢 lucrou ontem e anteontem → liguei (seu pedido de 21/11 7h)' }).catch(() => {}); }
      catch (e) { erros.push(c.nome + ': ' + e.message); }
    }
    await L.setJSON('lucro_hoje_' + hoje, { ids: boas.map((b) => String(b.c.id)), em: Date.now() });
    const resumo = { status: 'pronto', em: Date.now(), ligadas, jaLigadas, erros };
    await L.setJSON(FLAG, resumo);
    await avisar('🟢 Campanhas que lucraram ontem e anteontem — ' + (ligadas.length ? 'LIGUEI: ' + ligadas.join('; ') : 'nenhuma estava desligada') +
      (jaLigadas.length ? ' | JÁ LIGADAS: ' + jaLigadas.join('; ') : '') + (erros.length ? ' | ERRO: ' + erros.join('; ') : '') +
      '. Hoje o robô vigia essas: R$ 30 sem venda ou R$ 40 com 1 venda → desliga.').catch(() => {});
  } catch (e) {
    await L.setJSON(FLAG, { status: 'erro', erro: String(e && e.message || e), em: Date.now() });
    await avisar('⚠️ Não consegui ligar as campanhas que lucraram ontem: ' + (e && e.message || e)).catch(() => {});
  }
};
