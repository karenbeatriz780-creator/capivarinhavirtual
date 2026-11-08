import { metaAds, recomendar, ultimasAcoes } from './_gastos.mjs';
import { aplicarAcao, logRobo, lerCfg, vendasSitePorCampanha } from './_meta.mjs';
import { cpa3dias } from './_resumo.mjs';
// Painel → botões das campanhas: pausar, ativar e subir orçamento (+20% no máximo).
// Precisa: senha de administrador (x-admin-key = ADMIN_SENHA) e token do Meta com ads_management.
// A estratégia é conferida AQUI no servidor: campanha travada não sobe orçamento.
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
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
    if (acao === 'subir') {
      const rec = recomendar(c, acoes[id]);
      if (!rec.podeSubir || !rec.novoOrcamento) return json({ erro: 'Bloqueado: ' + (rec.trava || rec.motivo || 'essa campanha não deve subir agora') }, 409);
      const cfg = await lerCfg(), site = await vendasSitePorCampanha(10), k3 = cpa3dias(c0, site[id], imp);
      if (!(k3.cpa && k3.cpa <= (cfg.cpaMax || 7))) return json({ erro: 'Bloqueado: custo por venda nos últimos 3 dias ' + (k3.cpa ? 'R$ ' + k3.cpa.toFixed(2).replace('.', ',') : 'sem vendas') + ' — só sobe com até R$ ' + (cfg.cpaMax || 7) + ' por venda' }, 409);
      await aplicarAcao(Object.assign({}, c0, { novoOrcamento: rec.novoOrcamento }), 'subir', 'você');
      await logRobo({ tipo: 'subiu', camp: c0.nome, id, motivo: 'você subiu de R$ ' + c0.orcamentoDia + ' para R$ ' + rec.novoOrcamento + '/dia pelo painel' });
    } else {
      await aplicarAcao(c0, acao, 'você');
      await logRobo({ tipo: acao === 'pausar' ? 'pausou' : 'ativou', camp: c0.nome, id, motivo: 'você ' + (acao === 'pausar' ? 'pausou' : 'ativou') + ' pelo painel' });
    }
    return json({ ok: true });
  } catch (e) { return json({ erro: e.message || 'Não consegui falar com o Meta.' }, 502); }
};
