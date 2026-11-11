// QUEM COMPRA — compras, custo por venda e funil por FAIXA DE IDADE e por SEXO (dados do Meta/Pixel)
// Serve pra restringir campanhas novas às idades que vendem barato.
import { getStore } from '@netlify/blobs';
import { graphConta, lerCfg } from './_meta.mjs';

const COMPRA = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
const VISITA = ['landing_page_view', 'omni_landing_page_view'];
const CHECK = ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout'];
const acao = (l, ts) => { if (!Array.isArray(l)) return 0; for (const t of ts) { const a = l.find((x) => x.action_type === t); if (a) return Number(a.value) || 0; } return 0; };
const imposto = () => (process.env.META_IMPOSTO !== undefined && process.env.META_IMPOSTO !== '' ? Number(process.env.META_IMPOSTO) : 12.15) / 100;
const r2 = (x) => Math.round(x * 100) / 100;
export const FAIXAS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

async function puxar(tr, quebra) {
  const out = []; let after = null;
  for (let i = 0; i < 5; i++) {
    const q = { level: 'account', time_range: tr, breakdowns: quebra, fields: 'spend,impressions,clicks,actions', limit: 200 };
    if (after) q.after = after;
    const d = await graphConta('GET', 'insights', q);
    (d.data || []).forEach((x) => out.push(x));
    after = d.paging && d.paging.cursors && d.paging.next ? d.paging.cursors.after : null;
    if (!after) break;
  }
  return out;
}
function linha(rot) { return { rot, gasto: 0, imp: 0, cliques: 0, visitas: 0, checkouts: 0, compras: 0 }; }
function soma(L, x, imp) {
  L.gasto += (Number(x.spend) || 0) * (1 + imp); L.imp += Number(x.impressions) || 0; L.cliques += Number(x.clicks) || 0;
  L.visitas += acao(x.actions, VISITA); L.checkouts += acao(x.actions, CHECK); L.compras += acao(x.actions, COMPRA);
}
function fechar(L, totC) {
  L.gasto = r2(L.gasto); L.cpa = L.compras ? r2(L.gasto / L.compras) : null;
  L.conv = L.cliques ? r2(L.compras / L.cliques * 100) : null; L.parte = totC ? Math.round(L.compras / totC * 100) : 0;
  return L;
}

export async function calcPublico(nDias, semCache) {
  nDias = nDias || 30;
  const S = getStore('gastos'), ck = 'publico_' + nDias;
  if (!semCache) { const c = await S.get(ck, { type: 'json' }).catch(() => null); if (c && Date.now() - c.em < 3 * 3600000) return c.dados; }
  const cfg = await lerCfg(), imp = imposto(), lim = Number(cfg.cpaLimite || 13);
  const ate = new Date(Date.now() - 3 * 3600000), de = new Date(ate.getTime() - (nDias - 1) * 86400000);
  const tr = { since: de.toISOString().slice(0, 10), until: ate.toISOString().slice(0, 10) };
  const [ag, gn] = await Promise.all([puxar(tr, 'age,gender'), puxar(tr, 'gender')]);
  const idade = {}; FAIXAS.forEach((f) => { idade[f] = linha(f); });
  const cruz = {}; // idade × sexo
  ag.forEach((x) => {
    const f = idade[x.age] ? x.age : null; if (!f) return;
    soma(idade[f], x, imp);
    const k = f + '|' + (x.gender || 'unknown'); cruz[k] = cruz[k] || linha(k); soma(cruz[k], x, imp);
  });
  const sexo = { female: linha('Mulheres'), male: linha('Homens'), unknown: linha('Não informado') };
  gn.forEach((x) => { const s = sexo[x.gender] || sexo.unknown; soma(s, x, imp); });
  const totC = FAIXAS.reduce((t, f) => t + idade[f].compras, 0), totG = FAIXAS.reduce((t, f) => t + idade[f].gasto, 0);
  const cpaConta = totC ? totG / totC : null;
  const lista = FAIXAS.map((f) => fechar(idade[f], totC));
  const sexos = Object.values(sexo).map((s) => fechar(s, totC)).filter((s) => s.gasto > 0 || s.compras > 0);
  // cor de cada faixa + sugestão de idade (faixas contínuas que vendem bem)
  lista.forEach((L) => {
    if (L.compras >= 3 && L.cpa <= (cpaConta || lim) * 1.1) L.cor = 'verde';
    else if ((L.compras === 0 && L.gasto >= 15) || (L.cpa && L.cpa > Math.min(lim, (cpaConta || lim) * 1.5))) L.cor = 'vermelho';
    else L.cor = 'amarelo';
  });
  const ok = lista.map((L) => L.cor !== 'vermelho' && L.compras > 0);
  let ini = ok.indexOf(true), fim = ok.lastIndexOf(true), sug = null;
  if (ini >= 0) {
    // corta as pontas fracas (amarelas com custo acima da média e pouca parte das vendas)
    const fraca = (L) => L.cor !== 'verde' && L.parte < 8;
    while (ini < fim && fraca(lista[ini])) ini++;
    while (fim > ini && fraca(lista[fim])) fim--;
    const min = parseInt(FAIXAS[ini], 10), max = FAIXAS[fim] === '65+' ? null : parseInt(FAIXAS[fim].split('-')[1], 10);
    const sel = lista.slice(ini, fim + 1), g = sel.reduce((t, L) => t + L.gasto, 0), c = sel.reduce((t, L) => t + L.compras, 0);
    sug = { min, max, txt: min + (max ? '–' + max : '+') + ' anos', cpa: c ? r2(g / c) : null, parte: totC ? Math.round(c / totC * 100) : 0 };
  }
  const melhorSexo = sexos.filter((s) => s.rot !== 'Não informado' && s.compras >= 5).sort((a, b) => a.cpa - b.cpa)[0] || null;
  const dados = { dias: nDias, de: tr.since, ate: tr.until, idade: lista, sexo: sexos, totalCompras: totC, gasto: r2(totG), cpaConta: cpaConta ? r2(cpaConta) : null,
    sugestao: sug, melhorSexo: melhorSexo ? melhorSexo.rot : null, poucosDados: totC < 50,
    cruz: Object.values(cruz).map((L) => fechar(L, totC)).filter((L) => L.compras > 0).sort((a, b) => b.compras - a.compras).slice(0, 8) };
  await S.setJSON(ck, { em: Date.now(), dados }).catch(() => {});
  return dados;
}

// ---------- ONDE VENDE: Instagram × Facebook e cada posição (Feed, Reels, Stories…) ----------
const NOME_POS = {
  'whatsapp|status': 'Status do WhatsApp',
  'facebook|feed': 'Feed do Facebook', 'facebook|facebook_reels': 'Reels do Facebook', 'facebook|facebook_stories': 'Stories do Facebook', 'facebook|story': 'Stories do Facebook',
  'facebook|video_feeds': 'Vídeos do Facebook', 'facebook|marketplace': 'Marketplace', 'facebook|search': 'Busca do Facebook', 'facebook|instream_video': 'Vídeo in-stream (FB)',
  'facebook|facebook_reels_overlay': 'Reels do FB (sobreposição)', 'facebook|right_hand_column': 'Coluna direita (FB)', 'facebook|notification': 'Notificações (FB)',
  'instagram|feed': 'Feed do Instagram', 'instagram|stream': 'Feed do Instagram', 'instagram|instagram_reels': 'Reels do Instagram', 'instagram|reels': 'Reels do Instagram',
  'instagram|instagram_stories': 'Stories do Instagram', 'instagram|story': 'Stories do Instagram', 'instagram|instagram_explore': 'Explorar do Instagram',
  'instagram|instagram_explore_grid_home': 'Explorar (grade)', 'instagram|instagram_profile_feed': 'Perfil do Instagram', 'instagram|instagram_search': 'Busca do Instagram',
  'messenger|messenger_inbox': 'Messenger', 'messenger|messenger_stories': 'Stories do Messenger', 'audience_network|an_classic': 'Audience Network'
};
// chave usada no formulário do Novo anúncio
const CHAVE_POS = { 'facebook|feed': 'fb_feed', 'facebook|facebook_reels': 'fb_reels', 'facebook|facebook_stories': 'fb_story', 'facebook|story': 'fb_story',
  'instagram|feed': 'ig_feed', 'instagram|stream': 'ig_feed', 'instagram|instagram_reels': 'ig_reels', 'instagram|reels': 'ig_reels', 'instagram|instagram_stories': 'ig_story', 'instagram|story': 'ig_story', 'whatsapp|status': 'wa_status' };

export async function calcPosicoes(nDias, camp, semCache, ticket) {
  nDias = nDias || 30; camp = /^\d{5,30}$/.test(String(camp || '')) ? String(camp) : '';
  const S = getStore('gastos'), ck = 'posicoes_' + nDias + '_' + (camp || 'conta');
  if (!semCache) { const c = await S.get(ck, { type: 'json' }).catch(() => null); if (c && Date.now() - c.em < 3 * 3600000) return c.dados; }
  const imp = imposto(), tk = Number(ticket) || 9.99;
  const ate = new Date(Date.now() - 3 * 3600000), de = new Date(ate.getTime() - (nDias - 1) * 86400000);
  const tr = { since: de.toISOString().slice(0, 10), until: ate.toISOString().slice(0, 10) };
  let linhas;
  if (camp) {
    const { graph } = await import('./_meta.mjs');
    const d = await graph('GET', camp + '/insights', { time_range: tr, breakdowns: 'publisher_platform,platform_position', fields: 'spend,impressions,clicks,actions', limit: 200 });
    linhas = d.data || [];
  } else linhas = await puxar(tr, 'publisher_platform,platform_position');
  const pos = {}, plat = {};
  linhas.forEach((x) => {
    const pf = x.publisher_platform || '?', pp = x.platform_position || '?', k = pf + '|' + pp;
    pos[k] = pos[k] || Object.assign(linha(NOME_POS[k] || (pf + ' · ' + pp)), { k, plat: pf, chave: CHAVE_POS[k] || null });
    soma(pos[k], x, imp);
    plat[pf] = plat[pf] || Object.assign(linha({ instagram: 'Instagram', facebook: 'Facebook', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp' }[pf] || pf), { k: pf });
    soma(plat[pf], x, imp);
  });
  const totC = Object.values(pos).reduce((t, L) => t + L.compras, 0), totG = Object.values(pos).reduce((t, L) => t + L.gasto, 0);
  const cpaConta = totC ? totG / totC : null;
  const fin = (L) => { fechar(L, totC); L.lucro = r2(L.compras * tk - L.gasto);
    L.cor = L.compras >= 3 && L.cpa <= (cpaConta || 13) * 1.1 ? 'verde' : ((L.compras === 0 && L.gasto >= 10) || (L.cpa && L.cpa > (cpaConta || 13) * 1.5) ? 'vermelho' : 'amarelo'); return L; };
  const posicoes = Object.values(pos).map(fin).filter((L) => L.gasto > 0.5 || L.compras > 0).sort((a, b) => b.lucro - a.lucro);
  const plataformas = Object.values(plat).map(fin).sort((a, b) => b.lucro - a.lucro);
  const melhores = posicoes.filter((L) => L.chave && L.cor !== 'vermelho' && L.compras > 0 && L.lucro > 0).map((L) => L.chave).filter((k, i, a) => a.indexOf(k) === i);
  const dados = { dias: nDias, camp: camp || null, de: tr.since, ate: tr.until, ticket: tk, totalCompras: totC, gasto: r2(totG), cpaConta: cpaConta ? r2(cpaConta) : null,
    plataformas, posicoes, melhores, poucosDados: totC < 50 };
  await S.setJSON(ck, { em: Date.now(), dados }).catch(() => {});
  return dados;
}

// ---------- INTERESSES (detalhamento): busca e pacotes prontos ----------
export const PACOTES_INT = {
  relacionamento: ['Namoro', 'Relacionamento', 'Casamento', 'Recém-casados', 'Noivado', 'Relacionamento à distância', 'Dia dos Namorados', 'Aniversário de casamento', 'Música romântica', 'Amor']
};
export async function buscarInteresses(q) {
  const d = await graphConta('GET', 'targetingsearch', { q: String(q || '').slice(0, 60), limit: 12 });
  return (d.data || []).filter((x) => x && x.id && x.name)
    .map((x) => ({ id: String(x.id), nome: x.name, tipo: x.type || 'interests', caminho: Array.isArray(x.path) ? x.path.join(' › ') : '', tamanho: x.audience_size_lower_bound || x.audience_size || null }));
}
export async function pacoteInteresses(nome) {
  const termos = PACOTES_INT[nome] || [];
  const res = await Promise.all(termos.map((t) => buscarInteresses(t).catch(() => [])));
  const vistos = {}, out = [];
  res.forEach((lst, i) => {
    // pega o 1º resultado relevante de cada termo (+ o 2º se for evento de vida/comportamento)
    lst.slice(0, 3).forEach((x, j) => { if (vistos[x.id]) return; if (j === 0 || x.tipo !== 'interests') { vistos[x.id] = 1; out.push(Object.assign({ termo: termos[i] }, x)); } });
  });
  return out.slice(0, 14);
}
