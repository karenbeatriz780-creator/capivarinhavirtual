import { metaAds, avaliarSubir, ultimasAcoes } from './_gastos.mjs';
import { aplicarAcao, logRobo, lerCfg, vendasSitePorCampanha } from './_meta.mjs';
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
  // vários de uma vez (painel → 🏆 Placar → "Desligar todas as negativas")
  if (acao === 'pausarVarios' || acao === 'ativarVarios') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x, i, l) => /^\d{5,30}$/.test(x) && l.indexOf(x) === i).slice(0, 60);
    if (!ids.length) return json({ erro: 'Nenhuma campanha.' }, 400);
    const meta = await metaAds(7, null, null, true);
    if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta Ads não está ligado.' }, 400);
    const ac = acao === 'pausarVarios' ? 'pausar' : 'ativar', feitas = [], erros = [];
    for (const cid of ids) {
      const c0 = (meta.campanhas || []).find((x) => String(x.id) === cid);
      if (!c0) { erros.push(cid + ': não encontrada'); continue; }
      try { await aplicarAcao(c0, ac, 'você'); feitas.push(c0.nome);
        await logRobo({ tipo: ac === 'pausar' ? 'pausou' : 'ativou', camp: c0.nome, id: cid, motivo: 'você ' + (ac === 'pausar' ? 'desligou' : 'ligou') + ' pelo placar do painel' }); }
      catch (e) { erros.push(c0.nome + ': ' + (e.message || 'erro')); }
    }
    return json({ ok: !erros.length, feitas, erros });
  }
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
      const cfg = await lerCfg(), site = await vendasSitePorCampanha(10);
      const av = avaliarSubir(c0, (site[id] || {}).porDia, acoes[id], cfg.cpaMax || 7);
      if (av.trava) return json({ erro: 'Bloqueado: ' + av.trava }, 409);
      if (!av.agora) return json({ erro: 'Bloqueado: nos últimos 3 dias ' + (av.vendas ? av.vendas + ' vendas a R$ ' + av.cpa.toFixed(2).replace('.', ',') : 'sem vendas') + ' — só sobe com 5+ vendas a até R$ ' + (cfg.cpaMax || 7) + ' por venda' }, 409);
      const rec = { novoOrcamento: av.novo };
      await aplicarAcao(Object.assign({}, c0, { novoOrcamento: rec.novoOrcamento }), 'subir', 'você');
      await logRobo({ tipo: 'subiu', camp: c0.nome, id, motivo: 'você subiu de R$ ' + c0.orcamentoDia + ' para R$ ' + rec.novoOrcamento + '/dia pelo painel' });
    } else {
      await aplicarAcao(c0, acao, 'você');
      await logRobo({ tipo: acao === 'pausar' ? 'pausou' : 'ativou', camp: c0.nome, id, motivo: 'você ' + (acao === 'pausar' ? 'pausou' : 'ativou') + ' pelo painel' });
    }
    return json({ ok: true });
  } catch (e) { return json({ erro: e.message || 'Não consegui falar com o Meta.' }, 502); }
};
