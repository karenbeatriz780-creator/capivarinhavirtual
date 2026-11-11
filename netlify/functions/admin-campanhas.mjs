// Painel → aba CAMPANHAS: desempenho de cada campanha (hoje / ontem / 7 dias),
// classificação (nova · boa · observar · ruim · pausada), projeção de 7 dias e DUPLICAR.
//   GET  ?per=hoje|ontem|7d|30d
//   POST {acao:'duplicar', id} | {acao:'replicar', id, posicoes, idadeMin, idadeMax, genero, interesses, orcDia}   (senha de administrador)
// Valores de gasto: o do app do Meta (sem imposto) e o real (com imposto). Lucro = faturamento − anúncio com imposto.
import { metaAds, ultimasAcoes, TICKET, avaliarSubir } from './_gastos.mjs';
import { lerCfg, graph, logRobo, vendasSitePorCampanha } from './_meta.mjs';
import { diaBR, imposto, cpa3dias } from './_resumo.mjs';
import { duplicarCampanha, montarRep } from './_horarios.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

export default async (req) => {
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return json({ erro: 'Meta Ads não está ligado.' }, 400);
  if (req.method === 'POST') {
    const senha = (process.env.ADMIN_SENHA || '').trim();
    if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}
    const id = String(b.id || '');
    if ((b.acao !== 'duplicar' && b.acao !== 'replicar') || !/^\d{5,30}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
    try {
      const r = await duplicarCampanha(id, null, b.acao === 'replicar' ? montarRep(b) : null);
      return json({ ok: true, nova: r.nova, nome: r.nome });
    } catch (e) { return json({ erro: 'O Meta não deixou ' + (b.acao === 'replicar' ? 'replicar' : 'duplicar') + ': ' + e.message }, 502); }
  }

  const per = ['hoje', 'ontem', '7d', '30d'].indexOf(new URL(req.url).searchParams.get('per')) >= 0 ? new URL(req.url).searchParams.get('per') : 'hoje';
  const [meta, site, cfg, acoes, meta30, site30] = await Promise.all([metaAds(7, null, null, false), vendasSitePorCampanha(10), lerCfg(), ultimasAcoes(),
    per === '30d' ? metaAds(30, null, null, false) : null, per === '30d' ? vendasSitePorCampanha(32) : null]);
  if (!meta.configurado || meta.erro) return json({ erro: meta.erro || 'Meta não ligado' }, 502);
  const imp = imposto(), tk = TICKET(), cpaMax = cfg.cpaMax || 7, empate = tk / (1 + imp);
  const hoje = diaBR(), ontem = diaBR(Date.now() - 864e5), agora = Date.now();
  const dias = per === 'hoje' ? [hoje] : per === 'ontem' ? [ontem] : null;

  const lista = (meta.campanhas || []).map((c) => {
    const s = site[c.id] || { vendas: 0, porDia: {} };
    let g = 0, v = 0;
    if (dias) dias.forEach((k) => { const d = (c.dias || {})[k] || {}; g += d.gasto || 0; v += Math.max(d.compras || 0, s.porDia[k] || 0); });
    else if (per === '30d') { const c3 = ((meta30 && meta30.campanhas) || []).find((y) => y.id === c.id) || {}, s3 = (site30 || {})[c.id] || { porDia: {} };
      g = c3.gasto || 0; v = Math.max(c3.compras || 0, Object.keys(c3.dias || {}).reduce((t, k) => t + (s3.porDia[k] || 0), 0)); }
    else { g = c.gasto || 0; v = Math.max(c.compras || 0, Object.keys(c.dias || {}).reduce((t, k) => t + (s.porDia[k] || 0), 0)); }
    const g7 = c.gasto || 0, v7 = Math.max(c.compras || 0, Object.keys(c.dias || {}).reduce((t, k) => t + (s.porDia[k] || 0), 0));
    const k3 = cpa3dias(c, s, 0), cpa7 = v7 ? g7 / v7 : null;
    const idadeH = c.criada ? (agora - new Date(c.criada).getTime()) / 3600000 : 999;
    const ativa = c.status === 'ACTIVE';
    // classificação
    let cat, txt, dica;
    const base = k3.vendas >= 3 ? k3.cpa : cpa7;
    if (!ativa) { cat = 'pausada'; txt = '⏸ Pausada'; dica = v7 && cpa7 <= cpaMax ? 'Vendia bem (' + 'R$ ' + cpa7.toFixed(2).replace('.', ',') + '/venda). Pode valer duplicar.' : 'Fora do ar.'; }
    else if ((idadeH < 72 || c.aprendendo) && !(v7 === 0 && g7 >= (cfg.novaSemVenda || 13))) { cat = 'nova'; txt = '🆕 Nova · não mexer'; dica = 'Em aprendizado do Meta. Deixe rodar' + (idadeH < 72 ? ' (' + Math.max(1, Math.round(72 - idadeH)) + ' h pra completar 3 dias)' : '') + '.'; }
    else if (v7 >= 3 && base && base <= cpaMax) { cat = 'boa'; txt = '🟢 Boa · lucro'; dica = 'Vendendo barato. Duplique ou suba +20%.'; }
    else if (base && base <= empate) { cat = 'observar'; txt = '🟡 Observar'; dica = 'Lucro pequeno. Deixe rodar e acompanhe.'; }
    else if (!v7 && g7 < (cfg.novaSemVenda || 13)) { cat = 'observar'; txt = '🟡 Observar'; dica = 'Ainda gastou pouco pra saber.'; }
    else { cat = 'ruim'; txt = '🔴 Ruim · prejuízo'; dica = 'Venda saindo cara. O robô desliga se continuar.'; }
    // projeção de 7 dias com o orçamento atual e o custo por venda recente
    let proj = null;
    if (c.orcamentoDia && base) {
      const pr = (orc) => { const vd = orc / base, fat = vd * tk * 7, custo = orc * (1 + imp) * 7; return { vendas: Math.round(vd * 7), fat: r2(fat), lucro: r2(fat - custo) }; };
      proj = { atual: pr(c.orcamentoDia), mais20: pr(Math.floor(c.orcamentoDia * 1.2)) };
    }
    // dia a dia (7 dias, com hoje) e média por dia (só dias que rodaram, sem contar hoje)
    const diasLista = [];
    for (let i = 0; i < 7; i++) {
      const k = diaBR(agora - i * 864e5), d = (c.dias || {})[k] || {}, gd = d.gasto || 0, vd = Math.max(d.compras || 0, s.porDia[k] || 0);
      if (i === 0 || gd > 0 || vd > 0) diasLista.push({ dia: k, hoje: i === 0, gasto: r2(gd), vendas: vd, cpa: vd ? r2(gd / vd) : null, lucro: r2(vd * tk - gd * (1 + imp)) });
    }
    const passados = diasLista.filter((d) => !d.hoje && d.gasto > 0);
    const media = passados.length ? { dias: passados.length, gasto: r2(passados.reduce((t, d) => t + d.gasto, 0) / passados.length),
      vendas: Math.round(passados.reduce((t, d) => t + d.vendas, 0) / passados.length * 10) / 10,
      cpa: (() => { const g = passados.reduce((t, d) => t + d.gasto, 0), v = passados.reduce((t, d) => t + d.vendas, 0); return v ? r2(g / v) : null; })(),
      lucro: r2(passados.reduce((t, d) => t + d.lucro, 0) / passados.length) } : null;
    // SUBIR: mesma regra do botão e do aviso do robô (avaliarSubir)
    let subir = null;
    if (ativa && c.orcamentoDia) {
      const av = avaliarSubir(c, s.porDia, acoes[c.id], cpaMax, agora);
      const brl2 = (x) => 'R$ ' + x.toFixed(2).replace('.', ',');
      if (av.agora) subir = { agora: true, novo: av.novo, porque: av.vendas + ' vendas a ' + brl2(av.cpa) + ' nos últimos 3 dias' };
      else if (av.trava && (av.bom || (cat === 'nova' || cat === 'boa') && v7 >= 3 && cpa7 && cpa7 <= cpaMax))
        subir = { agora: false, novo: av.novo, quando: av.quando, porque: av.trava };
    }
    return { id: c.id, nome: c.nome, diasLista, media, subir, status: c.status, ativa, criada: c.criada, idadeH: Math.round(idadeH), orcamentoDia: c.orcamentoDia, orcamentoTotal: c.orcamentoTotal || null, programada: /^⏰ PROG/.test(c.nome || ''),
      aprendendo: !!c.aprendendo, cat, txt, dica,
      per: { gasto: r2(g), gastoImp: r2(g * (1 + imp)), vendas: v, cpa: v ? r2(g / v) : null, fat: r2(v * tk), lucro: r2(v * tk - g * (1 + imp)) },
      d7: { gasto: r2(g7), vendas: v7, cpa: cpa7 ? r2(cpa7) : null }, d3: { cpa: k3.cpa ? r2(k3.cpa) : null, vendas: k3.vendas },
      proj, ultimaAcao: acoes[c.id] || null };
  }).filter((x) => x.ativa || x.per.gasto > 0 || x.d7.gasto > 0);

  const ordem = { boa: 0, nova: 1, observar: 2, ruim: 3, pausada: 4 };
  lista.sort((a, b) => (ordem[a.cat] - ordem[b.cat]) || (b.per.gasto - a.per.gasto));
  const at = lista.filter((x) => x.ativa);
  const resumo = { gasto: 0, gastoImp: 0, vendas: 0, fat: 0, lucro: 0 };
  lista.forEach((x) => { resumo.gasto += x.per.gasto; resumo.gastoImp += x.per.gastoImp; resumo.vendas += x.per.vendas; resumo.fat += x.per.fat; resumo.lucro += x.per.lucro; });
  // 🏆 PLACAR do período: todas que gastaram/venderam (ativas ou desligadas)
  let base = lista.map((x) => ({ id: x.id, nome: x.nome, ativa: x.ativa, gasto: x.per.gasto, gastoImp: x.per.gastoImp, vendas: x.per.vendas, cpa: x.per.cpa, fat: x.per.fat, lucro: x.per.lucro }));
  if (per === '30d' && meta30 && meta30.campanhas) {
    const ja = {}; base.forEach((x) => { ja[x.id] = 1; });
    meta30.campanhas.filter((c) => !ja[c.id]).forEach((c) => { const s3 = (site30 || {})[c.id] || { porDia: {} }, g = c.gasto || 0;
      const v = Math.max(c.compras || 0, Object.keys(c.dias || {}).reduce((t, k) => t + (s3.porDia[k] || 0), 0));
      if (g > 0 || v > 0) base.push({ id: c.id, nome: c.nome, ativa: c.status === 'ACTIVE', fora: true, gasto: r2(g), gastoImp: r2(g * (1 + imp)), vendas: v, cpa: v ? r2(g / v) : null, fat: r2(v * tk), lucro: r2(v * tk - g * (1 + imp)) }); });
    base.filter((x) => x.fora).forEach((x) => { resumo.gasto += x.gasto; resumo.gastoImp += x.gastoImp; resumo.vendas += x.vendas; resumo.fat += x.fat; resumo.lucro += x.lucro; });
  }
  const boas = base.filter((x) => x.lucro > 0.004).sort((a, b) => b.lucro - a.lucro), ruins = base.filter((x) => x.lucro < -0.004).sort((a, b) => a.lucro - b.lucro);
  const placar = { boas, ruins, zeradas: base.length - boas.length - ruins.length,
    somaBoas: r2(boas.reduce((t, x) => t + x.lucro, 0)), somaRuins: r2(ruins.reduce((t, x) => t + x.lucro, 0)) };
  placar.saldo = r2(placar.somaBoas + placar.somaRuins);
  Object.keys(resumo).forEach((k) => { resumo[k] = r2(resumo[k]); });
  resumo.cpa = resumo.vendas ? r2(resumo.gasto / resumo.vendas) : null;
  resumo.ativas = at.length; resumo.orcDia = r2(at.reduce((t, x) => t + (x.orcamentoDia || 0), 0));
  const cont = {}; lista.forEach((x) => { cont[x.cat] = (cont[x.cat] || 0) + 1; });
  // projeção da conta (só ativas com custo por venda conhecido)
  const pj = at.filter((x) => x.proj).reduce((t, x) => ({ vendas: t.vendas + x.proj.atual.vendas, fat: t.fat + x.proj.atual.fat, lucro: t.lucro + x.proj.atual.lucro }), { vendas: 0, fat: 0, lucro: 0 });
  const alertas = [];
  lista.filter((x) => x.cat === 'ruim' && x.ativa).slice(0, 3).forEach((x) => alertas.push('🔴 "' + x.nome + '" está no prejuízo. O robô desliga sozinho se continuar.'));
  const podeSubir = lista.filter((x) => x.subir && x.subir.agora).map((x) => ({ id: x.id, nome: x.nome, orc: x.orcamentoDia, novo: x.subir.novo, porque: x.subir.porque }));
  const logoSobe = lista.filter((x) => x.subir && !x.subir.agora).map((x) => ({ id: x.id, nome: x.nome, quando: x.subir.quando, porque: x.subir.porque }));
  const duplicar = lista.filter((x) => x.cat === 'boa').slice(0, 3).map((x) => ({ id: x.id, nome: x.nome, cpa: x.d3.cpa || x.d7.cpa }));
  return json({ podeSubir, logoSobe, duplicar, per, resumo, placar, cont, projConta: { vendas: pj.vendas, fat: r2(pj.fat), lucro: r2(pj.lucro) }, alertas, campanhas: lista, imposto: imp * 100, ticket: tk });
};
