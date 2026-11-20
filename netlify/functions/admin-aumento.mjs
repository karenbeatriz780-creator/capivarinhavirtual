// 📈 Painel → aba "Aumento": campanhas que sobem +10% no orçamento todo dia (o robô faz 1x por dia, depois da meia-noite).
// GET  → campanhas (nome, situação, orçamento do dia) + as marcadas + teto
// POST {ids:[...], teto} → salva
import { getStore } from '@netlify/blobs';
import { graphConta, logRobo } from './_meta.mjs';
import { aplicarAumento } from './_aumento.mjs';
import { metaAds } from './_gastos.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos');
  try {
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      if (b.acao === 'subirAgora') { // botão "Subir 10% agora": todas as marcadas (1 vez por dia — o robô não repete hoje)
        const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10), FLAG = 'aumento_feito_' + hoje;
        const ja = await L.get(FLAG, { type: 'json' }).catch(() => null);
        if (ja) return json({ erro: 'Hoje já subiu (às ' + new Date(ja.em - 3 * 36e5).toISOString().slice(11, 16) + '). O próximo aumento é amanhã, depois da meia-noite.' }, 409);
        const cfg = (await L.get('aumento_cfg', { type: 'json' }).catch(() => null)) || {};
        if (!(cfg.ids || []).length) return json({ erro: 'Marque pelo menos uma campanha.' }, 400);
        const meta = await metaAds(7, null, null, true);
        if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta Ads não está ligado.' }, 400);
        await L.setJSON(FLAG, { em: Date.now(), quem: 'você' });
        const feitas = await aplicarAumento(meta.campanhas, cfg.ids.map(String), Number(cfg.teto) > 0 ? Number(cfg.teto) : null, Number(cfg.pct) > 0 ? Number(cfg.pct) : 10, 'você (+10% agora)');
        for (const f of feitas) await logRobo(Object.assign({}, f, { motivo: f.motivo.replace('aumento diário', 'você subiu agora') })).catch(() => {});
        return json({ ok: true, subiu: feitas.filter((f) => f.tipo === 'subiu').length, erros: feitas.filter((f) => f.tipo === 'erro').map((f) => f.camp + ': ' + f.motivo), feitas });
      }
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => /^\d{5,30}$/.test(x)).slice(0, 100);
      const teto = Number(b.teto) > 0 ? Math.round(Number(b.teto) * 100) / 100 : null;
      await L.setJSON('aumento_cfg', { ids, teto, pct: 10, em: Date.now() });
      return json({ ok: true, ids, teto });
    }
    const cfg = (await L.get('aumento_cfg', { type: 'json' }).catch(() => null)) || {};
    const [lista, meta] = await Promise.all([graphConta('GET', 'campaigns', { fields: 'name,effective_status,daily_budget,created_time', limit: 400 }), metaAds(7).catch(() => ({}))]);
    const orc = {}; (meta.campanhas || []).forEach((c) => { if (c.orcamentoDia) orc[String(c.id)] = c.orcamentoDia; });
    const campanhas = (lista.data || []).filter((x) => !/ARCHIVED|DELETED/.test(String(x.effective_status || '')))
      .map((x) => ({ id: String(x.id), nome: x.name, status: x.effective_status, criada: x.created_time, orc: Number(x.daily_budget) > 0 ? Number(x.daily_budget) / 100 : (orc[String(x.id)] || null) }))
      .sort((a, b) => ((cfg.ids || []).indexOf(b.id) >= 0) - ((cfg.ids || []).indexOf(a.id) >= 0) || (b.status === 'ACTIVE') - (a.status === 'ACTIVE') || String(b.criada || '').localeCompare(String(a.criada || '')));
    const hist = (await L.get('aumento_feito_' + new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10), { type: 'json' }).catch(() => null));
    return json({ ids: cfg.ids || [], teto: cfg.teto || null, campanhas, feitoHoje: hist ? hist.em : null });
  } catch (e) { return json({ erro: e.message }, 500); }
};
