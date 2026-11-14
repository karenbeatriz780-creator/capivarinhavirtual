// 🔎 Painel → campanha → "Detalhes e posicionamentos"
// GET  ?camp=ID&dias=7      → onde a campanha está ligada (por conjunto) + resultado de cada posicionamento
// POST {camp, chave}        → tira um posicionamento (ex.: 'whatsapp|status') de TODOS os conjuntos da campanha
// Não mexe em orçamento, público nem anúncio — só nos posicionamentos. O Meta pode reiniciar o aprendizado.
import { graph, logRobo } from './_meta.mjs';
import { calcPosicoes } from './_publico.mjs';
import { TICKET } from './_gastos.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
// todas as posições de cada plataforma (usadas quando a campanha está em "posicionamento automático")
const TODAS = {
  facebook: ['feed', 'profile_feed', 'marketplace', 'video_feeds', 'story', 'facebook_reels', 'search'],
  instagram: ['stream', 'profile_feed', 'story', 'explore', 'explore_home', 'reels', 'ig_search'],
  messenger: ['messenger_home', 'story'],
  audience_network: ['classic', 'rewarded_video'],
  whatsapp: ['status'],
  threads: ['threads_stream']
};
const NOME_PF = { facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp', threads: 'Threads' };
const NOME = {
  'facebook|feed': 'Feed do Facebook', 'facebook|profile_feed': 'Perfil do Facebook', 'facebook|marketplace': 'Marketplace', 'facebook|video_feeds': 'Vídeos do Facebook', 'facebook|right_hand_column': 'Coluna da direita (FB)',
  'facebook|story': 'Stories do Facebook', 'facebook|facebook_reels': 'Reels do Facebook', 'facebook|facebook_reels_overlay': 'Anúncio sobre Reels (FB)', 'facebook|search': 'Busca do Facebook', 'facebook|instream_video': 'Vídeo in-stream (FB)', 'facebook|notification': 'Notificações (FB)',
  'instagram|stream': 'Feed do Instagram', 'instagram|profile_feed': 'Perfil do Instagram', 'instagram|story': 'Stories do Instagram', 'instagram|explore': 'Explorar (IG)', 'instagram|explore_home': 'Início do Explorar (IG)', 'instagram|reels': 'Reels do Instagram', 'instagram|profile_reels': 'Reels no perfil (IG)', 'instagram|ig_search': 'Busca do Instagram',
  'messenger|messenger_home': 'Messenger', 'messenger|story': 'Stories do Messenger', 'messenger|sponsored_messages': 'Mensagens patrocinadas',
  'audience_network|classic': 'Audience Network', 'audience_network|rewarded_video': 'Vídeos premiados (AN)', 'whatsapp|status': 'Status do WhatsApp', 'threads|threads_stream': 'Threads'
};
// equivalência entre o nome do relatório (insights) e o da configuração (targeting)
const DO_RELATORIO = { 'facebook|facebook_stories': 'facebook|story', 'instagram|feed': 'instagram|stream', 'instagram|instagram_reels': 'instagram|reels', 'instagram|instagram_stories': 'instagram|story', 'instagram|instagram_explore': 'instagram|explore', 'instagram|instagram_explore_grid_home': 'instagram|explore_home', 'instagram|instagram_profile_feed': 'instagram|profile_feed', 'instagram|instagram_search': 'instagram|ig_search', 'facebook|facebook_profile_feed': 'facebook|profile_feed', 'facebook|instream_video': 'facebook|instream_video', 'audience_network|an_classic': 'audience_network|classic', 'messenger|messenger_inbox': 'messenger|messenger_home', 'messenger|messenger_stories': 'messenger|story', 'whatsapp|status': 'whatsapp|status' };

function posicoesDe(t) { // → { auto: bool, lista: ['pf|pos', ...] }
  t = t || {};
  if (!Array.isArray(t.publisher_platforms) || !t.publisher_platforms.length) return { auto: true, lista: [] };
  const lista = [];
  t.publisher_platforms.forEach((pf) => { const ps = Array.isArray(t[pf + '_positions']) && t[pf + '_positions'].length ? t[pf + '_positions'] : (TODAS[pf] || []); ps.forEach((p) => lista.push(pf + '|' + p)); });
  return { auto: false, lista };
}
function tirar(t, chave) {
  const n = JSON.parse(JSON.stringify(t || {}));
  const [pfX, psX] = chave.split('|');
  let pfs = Array.isArray(n.publisher_platforms) && n.publisher_platforms.length ? n.publisher_platforms.slice() : ['facebook', 'instagram', 'messenger', 'audience_network'].concat(n.whatsapp_positions ? ['whatsapp'] : []);
  const aviso = [];
  const tiraUm = (pf, ps) => {
    if (pfs.indexOf(pf) < 0) return;
    let lst = Array.isArray(n[pf + '_positions']) && n[pf + '_positions'].length ? n[pf + '_positions'].slice() : (TODAS[pf] || []).slice();
    lst = lst.filter((x) => x !== ps);
    if (!lst.length || !ps) { pfs = pfs.filter((x) => x !== pf); delete n[pf + '_positions']; }
    else n[pf + '_positions'] = lst;
  };
  tiraUm(pfX, psX);
  // regra do Meta: Status do WhatsApp só roda junto com Stories do Instagram
  if (chave === 'instagram|story' && pfs.indexOf('whatsapp') >= 0) { tiraUm('whatsapp', 'status'); aviso.push('O Status do WhatsApp também saiu (o Meta só deixa junto com os Stories do Instagram).'); }
  if (!pfs.length) throw new Error('Não dá pra tirar o último posicionamento da campanha.');
  n.publisher_platforms = pfs;
  pfs.forEach((pf) => { if (!n[pf + '_positions']) n[pf + '_positions'] = (TODAS[pf] || []).slice(); });
  return { t: n, aviso };
}

export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const u = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const camp = u.searchParams.get('camp') || '', dias = Math.max(1, Math.min(30, parseInt(u.searchParams.get('dias'), 10) || 7));
      if (!/^\d{5,30}$/.test(camp)) return json({ erro: 'Campanha inválida.' }, 400);
      const sets = (await graph('GET', camp + '/adsets', { fields: 'id,name,status,effective_status,targeting', limit: 50 })).data || [];
      const conjuntos = sets.map((s) => { const p = posicoesDe(s.targeting); return { id: s.id, nome: s.name, status: s.effective_status || s.status, auto: p.auto, posicoes: p.lista.map((k) => ({ k, nome: NOME[k] || k, plat: NOME_PF[k.split('|')[0]] || k.split('|')[0] })) }; });
      const res = await calcPosicoes(dias, camp, true, TICKET()).catch((e) => ({ erro: e.message }));
      const resultados = (res.posicoes || []).map((L) => Object.assign({}, L, { chaveCfg: DO_RELATORIO[L.k] || L.k }));
      return json({ camp, dias, conjuntos, resultados, erroRes: res.erro || null });
    }
    let b = {}; try { b = await req.json(); } catch (e) {}
    const camp = String(b.camp || ''), chave = String(b.chave || '');
    if (!/^\d{5,30}$/.test(camp) || !/^[a-z_]+\|[a-z_]+$/.test(chave)) return json({ erro: 'Pedido inválido.' }, 400);
    const sets = (await graph('GET', camp + '/adsets', { fields: 'id,name,targeting', limit: 50 })).data || [];
    const feitos = [], erros = [], avisos = [];
    for (const s of sets) {
      const atual = posicoesDe(s.targeting);
      if (!atual.auto && atual.lista.indexOf(chave) < 0) continue; // esse conjunto já não usa
      try {
        const r = tirar(s.targeting, chave);
        try { await graph('POST', s.id, { targeting: r.t }); }
        catch (e1) { // o Meta recusou alguma posição da lista completa → tenta com as principais (sem a que você tirou)
          const t2 = JSON.parse(JSON.stringify(r.t)), BASE = { facebook: ['feed', 'story', 'facebook_reels'], instagram: ['stream', 'story', 'reels', 'explore'], whatsapp: ['status'] };
          t2.publisher_platforms = t2.publisher_platforms.filter((pf) => BASE[pf]);
          ['messenger', 'audience_network', 'threads'].forEach((pf) => { delete t2[pf + '_positions']; });
          t2.publisher_platforms.forEach((pf) => { t2[pf + '_positions'] = (t2[pf + '_positions'] || BASE[pf]).filter((x) => BASE[pf].indexOf(x) >= 0 && pf + '|' + x !== chave); if (!t2[pf + '_positions'].length) { t2.publisher_platforms = t2.publisher_platforms.filter((y) => y !== pf); delete t2[pf + '_positions']; } });
          if (!t2.publisher_platforms.length) throw e1;
          await graph('POST', s.id, { targeting: t2 });
          r.aviso.push('O Meta não aceitou todos os posicionamentos automáticos, então ficaram os principais (Feed, Stories, Reels e Explorar).');
        }
        feitos.push(s.name); r.aviso.forEach((a) => { if (avisos.indexOf(a) < 0) avisos.push(a); });
      } catch (e) { erros.push(s.name + ': ' + e.message); }
    }
    if (feitos.length) await logRobo({ tipo: 'posicao', camp: String(b.nome || camp), id: camp, motivo: 'você tirou o posicionamento "' + (NOME[chave] || chave) + '" (' + feitos.length + ' conjunto(s))' }).catch(() => {});
    if (!feitos.length && !erros.length) return json({ ok: true, nada: true });
    return json({ ok: !erros.length, feitos, erros, avisos }, erros.length && !feitos.length ? 409 : 200);
  } catch (e) { return json({ erro: e.message }, 500); }
};
