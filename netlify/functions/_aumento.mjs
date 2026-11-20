// 📈 Aumento diário de orçamento (+10%): usado pelo robô (1x/dia) e pelo botão "Subir agora" do painel.
import { graph } from './_meta.mjs';
import { registrarAcao } from './_gastos.mjs';
import { brl } from './_resumo.mjs';
export async function aplicarAumento(campanhas, ids, teto, pct, quem) {
  const feitas = [];
  for (const id of ids) {
        const c = (campanhas || []).find((x) => String(x.id) === id);
        if (!c) { feitas.push({ tipo: 'erro', camp: id, id, aviso: true, motivo: '📈 não achei essa campanha pra aumentar o orçamento' }); continue; }
        if (c.status !== 'ACTIVE') continue;
        if (!c.orcamentoNaCampanha && !(c.conjuntos || []).some((x) => x.orcamentoDia > 0)) { // acabou de ser ligada: busca os conjuntos direto no Meta
          try { const r = await graph('GET', id + '/adsets', { fields: 'id,daily_budget,effective_status', limit: 50 });
            c.conjuntos = (r.data || []).filter((x) => Number(x.daily_budget) > 0 && !/DELETED|ARCHIVED/.test(String(x.effective_status || ''))).map((x) => ({ id: x.id, orcamentoDia: Number(x.daily_budget) / 100 }));
            c.orcamentoDia = c.conjuntos.reduce((t, x) => t + x.orcamentoDia, 0) || c.orcamentoDia; } catch (e) {}
        }
        const de = Number(c.orcamentoDia) || 0;
        let para = Math.round(de * (1 + pct / 100) * 100) / 100;
        if (teto && para > teto) para = teto;
        if (!(de > 0) || !(para > de)) continue;
        try {
          if (c.orcamentoNaCampanha) await graph('POST', id, { daily_budget: String(Math.round(para * 100)) });
          else {
            const cs = (c.conjuntos || []).filter((x) => x.orcamentoDia > 0);
            if (!cs.length) throw new Error('sem orçamento diário nos conjuntos');
            const f = para / de;
            for (const x of cs) await graph('POST', x.id, { daily_budget: String(Math.round(x.orcamentoDia * f * 100)) });
          }
          await registrarAcao(id, 'orcamento', { de, para, quem }).catch(() => {});
          c.orcamentoDia = para;
          feitas.push({ tipo: 'subiu', camp: c.nome, id, aviso: true, motivo: '📈 aumento diário: orçamento ' + brl(de) + ' → ' + brl(para) + ' (+' + pct + '%)' + (teto && para === teto ? ' — chegou no teto' : '') });
        } catch (e) { feitas.push({ tipo: 'erro', camp: c.nome, id, aviso: true, motivo: '📈 não consegui aumentar o orçamento: ' + e.message }); }
      }
  return feitas;
}
