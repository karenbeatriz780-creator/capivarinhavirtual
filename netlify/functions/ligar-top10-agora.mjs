// 🏆 21/11 23h10 — pedido do Gusthavo: "deixa as 10 melhores campanhas desta semana que estão lucrando ligadas, agora".
// Roda sozinho no próximo minuto, UMA vez só. 10 melhores = mais vendas nos últimos 7 dias com custo médio até R$ 9,50
// (a mesma lista da meia-noite). Liga as que estão desligadas. Não desliga nenhuma outra.
// Pula a que o robô desligou HOJE pela regra do dia (gastou sem compra) — senão ele desligaria de novo na rodada seguinte.
// Depois disso vale a regra normal do robô: gastou até R$ 10 no dia sem nenhuma compra → desliga.
import { getStore } from '@netlify/blobs';
import { metaAds, ultimasAcoes } from './_gastos.mjs';
import { aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { diaBR, brl } from './_resumo.mjs';
import { top10, futuro } from './_futuro.mjs';

export const config = { schedule: '* * * * *' };
const DIA_ALVO = '2026-11-21';

export default async () => {
  const agora = Date.now(), hoje = diaBR(agora);
  if (hoje !== DIA_ALVO) return;
  const L = getStore('gastos'), FLAG = 'top10_agora_' + hoje;
  if (await L.get(FLAG).catch(() => null)) return;
  await L.setJSON(FLAG, { em: agora, status: 'rodando' });
  try {
    const meta = await metaAds(7, null, null, true);
    if (!meta.configurado || meta.erro) throw new Error(meta.erro || 'Meta não configurado');
    const [site, acoes] = await Promise.all([vendasSitePorCampanha(31), ultimasAcoes()]);
    const mn = (await L.get('meianoite_cfg', { type: 'json' }).catch(() => null)) || {};
    const fora = new Set((mn.fora || []).map(String));
    const ids = top10(meta.campanhas, site, agora, fora);
    const ligadas = [], jaLigadas = [], pulei = [], erros = [];
    for (const id of ids) {
      const c = (meta.campanhas || []).find((x) => String(x.id) === id); if (!c) continue;
      const f = futuro(c, site, agora), txt = c.nome + ' (' + f.vendas + ' vendas na semana a ' + brl(f.cpa) + ')';
      if (c.status === 'ACTIVE') { jaLigadas.push(txt); continue; }
      const ac = acoes[id];
      if (ac && ac.tipo === 'pausar' && /^robô/.test(ac.quem || '') && diaBR(ac.em) === hoje) { pulei.push(txt); continue; }
      try { await aplicarAcao(c, 'ativar', 'robô (10 melhores — pedido 21/11 23h)'); ligadas.push(txt);
        await logRobo({ tipo: 'religou', camp: c.nome, id, motivo: '🏆 está entre as 10 melhores da semana e lucrando → liguei (seu pedido de 21/11 23h)' }).catch(() => {}); }
      catch (e) { erros.push(c.nome + ': ' + e.message); }
    }
    await L.setJSON(FLAG, { status: 'pronto', em: Date.now(), ids, ligadas, jaLigadas, pulei, erros });
    await avisar('🏆 10 melhores da semana (lucrando) — ' + (ligadas.length ? 'LIGUEI: ' + ligadas.join('; ') : 'nenhuma estava desligada') +
      (jaLigadas.length ? ' | JÁ LIGADAS: ' + jaLigadas.join('; ') : '') +
      (pulei.length ? ' | NÃO LIGUEI (o robô desligou hoje por gastar sem compra; volta à meia-noite se continuar no top): ' + pulei.join('; ') : '') +
      (erros.length ? ' | ERRO: ' + erros.join('; ') : '') + '. Regra valendo: gastou até R$ 10 no dia sem compra → desliga.').catch(() => {});
  } catch (e) {
    await L.setJSON(FLAG, { status: 'erro', erro: String(e && e.message || e), em: Date.now() });
    await avisar('⚠️ Não consegui ligar as 10 melhores: ' + (e && e.message || e)).catch(() => {});
  }
};
