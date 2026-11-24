// ⏱️ VIGIA DA COMPRA ATRASADA (regra de 15/11): o robô desligou uma campanha por "gastou sem compra"?
// Por 40 minutos, de 5 em 5 min, confere se o Meta (ou o site) contou uma compra atrasada. Se contou → RELIGA.
import { getStore } from '@netlify/blobs';
import { graph, aplicarAcao, logRobo, avisar, vendasSitePorCampanha } from './_meta.mjs';
import { diaBR, brl } from './_resumo.mjs';

export const config = { schedule: '*/10 * * * *' };
const COMPRA = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
const JANELA = 40 * 60000;

export default async () => {
  const L = getStore('gastos');
  const lista = (await L.get('vigia_atraso', { type: 'json' }).catch(() => null)) || {};
  const ids = Object.keys(lista);
  if (!ids.length) return;
  const agora = Date.now(), hoje = diaBR(agora);
  let site = null, mudou = false;
  for (const id of ids) {
    const x = lista[id];
    if (!x || agora - x.em > JANELA || x.dia !== hoje) { delete lista[id]; mudou = true; continue; }
    try {
      const d = await graph('GET', id + '/insights', { fields: 'actions,spend', date_preset: 'today' });
      const r = (d.data || [])[0] || {};
      let compras = (r.actions || []).filter((a) => COMPRA.indexOf(a.action_type) >= 0).reduce((m, a) => Math.max(m, Number(a.value) || 0), 0);
      if (!compras) { if (!site) site = await vendasSitePorCampanha(1).catch(() => ({})); compras = ((site[id] || {}).porDia || {})[hoje] || 0; }
      if (compras > 0) {
        const st = await graph('GET', id, { fields: 'effective_status,name' }).catch(() => ({}));
        delete lista[id]; mudou = true;
        if (st.effective_status === 'PAUSED') {
          await aplicarAcao({ id }, 'ativar', 'robô (compra atrasada)');
          const msg = 'o Meta contou ' + compras + ' compra(s) atrasada(s) depois que eu desliguei (gasto ' + brl(Number(r.spend) || x.gasto || 0) + ') → religuei, ela continua o dia';
          await logRobo({ tipo: 'religou', camp: st.name || x.nome, id, motivo: msg });
          await avisar('▶️ Religuei *' + (st.name || x.nome) + '*\n' + msg);
        }
      }
    } catch (e) { console.error('compra atrasada', id, e.message); }
  }
  if (mudou) await L.setJSON('vigia_atraso', lista).catch(() => {});
};
