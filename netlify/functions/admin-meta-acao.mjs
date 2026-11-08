import { getStore } from '@netlify/blobs';
import { metaAds, recomendar, ultimasAcoes, registrarAcao, SUBIR_MAX } from './_gastos.mjs';
// Painel → botões das campanhas: pausar, ativar e subir orçamento (+20% no máximo).
// Precisa: senha de administrador (x-admin-key = ADMIN_SENHA) e token do Meta com ads_management.
// A estratégia é conferida AQUI no servidor: campanha travada não sobe orçamento.
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const VER = () => (process.env.META_API_VERSION || 'v24.0').trim();
async function postMeta(id, campos) {
  const tk = String(process.env.META_ADS_TOKEN || '').trim();
  const corpo = new URLSearchParams(Object.assign({ access_token: tk }, campos));
  const r = await fetch('https://graph.facebook.com/' + VER() + '/' + encodeURIComponent(id), { method: 'POST', body: corpo });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = d.error || {};
    const semPerm = e.code === 200 || e.code === 10 || /permission|ads_management/i.test(e.message || '');
    throw new Error(semPerm ? 'O token não tem permissão de gerenciar (gere um token novo com ads_read + ads_management).' : (e.error_user_msg || e.message || ('erro ' + r.status)));
  }
  return d;
}
export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || ''), acao = String(b.acao || '');
  if (!/^\d{5,30}$/.test(id) || ['pausar', 'ativar', 'subir'].indexOf(acao) < 0) return json({ erro: 'Pedido inválido.' }, 400);
  try {
    const imp = (process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;
    const meta = await metaAds(7, null, null, true);
    if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta Ads não está ligado.' }, 400);
    const c0 = (meta.campanhas || []).find((x) => String(x.id) === id);
    if (!c0) return json({ erro: 'Campanha não encontrada nos últimos 7 dias.' }, 404);
    const c = Object.assign({}, c0, { gasto: c0.gasto * (1 + imp),
      dias: Object.fromEntries(Object.entries(c0.dias || {}).map(([k, v]) => [k, Object.assign({}, v, { gasto: v.gasto * (1 + imp) })])) });
    const acoes = await ultimasAcoes();
    if (acao === 'pausar') { await postMeta(id, { status: 'PAUSED' }); await registrarAcao(id, 'pausar'); }
    else if (acao === 'ativar') { await postMeta(id, { status: 'ACTIVE' }); await registrarAcao(id, 'ativar'); }
    else {
      const rec = recomendar(c, acoes[id]);
      if (!rec.podeSubir) return json({ erro: 'Bloqueado: ' + (rec.trava || rec.motivo || 'essa campanha não deve subir agora') }, 409);
      const fator = 1 + SUBIR_MAX;
      if (c.orcamentoNaCampanha) {
        await postMeta(id, { daily_budget: String(Math.floor(c.orcamentoDia * fator * 100)) });
      } else {
        const cs = (c.conjuntos || []).filter((x) => x.orcamentoDia > 0);
        if (!cs.length) return json({ erro: 'Não achei orçamento diário nessa campanha.' }, 400);
        for (const x of cs) await postMeta(x.id, { daily_budget: String(Math.floor(x.orcamentoDia * fator * 100)) });
      }
      await registrarAcao(id, 'orcamento', { de: c.orcamentoDia, para: Math.floor(c.orcamentoDia * fator) });
    }
    // limpa o cache do Meta pra tela mostrar o novo estado
    try { await getStore('gastos').setJSON('meta_cache_zerado', { em: Date.now() }); } catch (e) {}
    return json({ ok: true });
  } catch (e) { return json({ erro: e.message || 'Não consegui falar com o Meta.' }, 502); }
};
