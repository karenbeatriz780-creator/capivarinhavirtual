import { getStore } from '@netlify/blobs';

// ÍNDICE POR TELEFONE: um único arquivo { chave: { p:[pedidos], t:[músicas] } }.
// Com ele, "Meus presentes" lê só os pedidos daquele número, em vez de abrir
// todos os pedidos do site (que é o que deixava a busca lenta).
export function chaveTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length < 10) return '';
  return d.slice(0, 2) + d.slice(-8);
}
const loja = () => getStore('indices');

// dia no horário de Brasília (UTC-3), ex.: 2026-10-22
export function diaBR(ts) {
  const d = new Date((ts || Date.now()) - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
export async function lerDias() {
  try { return await loja().get('dias', { type: 'json' }); } catch (e) { return null; }
}
// ÍNDICE "UM ARQUIVINHO POR ITEM" (idx2): cada registro é uma chave própria.
// Antes tudo ia pra UM arquivo só; com muitas vendas ao mesmo tempo, uma
// gravação apagava a outra e pedidos sumiam do painel. Agora nada se perde.
const loja2 = () => getStore('idx2');
const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
async function listar(prefixo) {
  try { const r = await loja2().list({ prefix: prefixo }); return (r && r.blobs || []).map((b) => b.key); } catch (e) { return []; }
}
// registra no dia: p = pedido, t = música gerada, pg = pedido pago, l = letra escrita
export async function indexarDia(tipo, id, ts) {
  try { await loja2().set('d/' + diaBR(ts) + '/' + tipo + '/' + (id || rnd()), '1'); }
  catch (e) { console.error('indexarDia:', e && e.message); }
}
// ids do dia (só do índice novo)
export async function idsDoDia(dia, tipo) {
  const pre = 'd/' + dia + '/' + tipo + '/';
  return (await listar(pre)).map((k) => k.slice(pre.length));
}
// ids dos últimos N dias: índice antigo (montado de tempos em tempos) + índice novo
export async function idsDosDiasTudo(idxAntigo, n, tipo) {
  const out = idsDosDias(idxAntigo, n, tipo), visto = {};
  out.forEach((x) => { visto[x] = 1; });
  const dias = []; for (let i = 0; i < n; i++) dias.push(diaBR(Date.now() - i * 86400000));
  const listas = await Promise.all(dias.map((d) => idsDoDia(d, tipo)));
  listas.forEach((l) => l.forEach((x) => { if (!visto[x]) { visto[x] = 1; out.push(x); } }));
  return out;
}
// quantas músicas (t) e letras (l) no dia
export async function contagemDia(dia, idxAntigo) {
  const [t, l] = await Promise.all([idsDoDia(dia, 't'), idsDoDia(dia, 'l')]);
  const e = idxAntigo && idxAntigo.dias && idxAntigo.dias[dia];
  const tSet = {}; (e && e.t || []).concat(t).forEach((x) => { tSet[x] = 1; });
  return { m: Object.keys(tSet).length, l: Math.max(l.length, (e && e.l) || 0) };
}
// ids dos últimos N dias (inclui hoje) — só do índice antigo
export function idsDosDias(idx, n, tipo) {
  const out = [];
  if (!idx || !idx.dias) return out;
  for (let i = 0; i < n; i++) {
    const e = idx.dias[diaBR(Date.now() - i * 86400000)];
    if (e && e[tipo]) e[tipo].forEach((id) => { if (out.indexOf(id) === -1) out.push(id); });
  }
  return out;
}
// pedidos e músicas de um número: índice antigo + índice novo
export async function idsDoTel(tel, idxAntigo) {
  const k = chaveTel(tel), out = { p: [], t: [] };
  if (!k) return out;
  const e = idxAntigo && idxAntigo.mapa && idxAntigo.mapa[k];
  if (e) { out.p = (e.p || []).slice(); out.t = (e.t || []).slice(); }
  const pre = 't/' + k + '/';
  (await listar(pre)).forEach((key) => {
    const resto = key.slice(pre.length), i = resto.indexOf('/');
    const tipo = resto.slice(0, i), id = resto.slice(i + 1);
    if ((tipo === 'p' || tipo === 't') && out[tipo].indexOf(id) === -1) out[tipo].push(id);
  });
  return out;
}

export async function lerIndice() {
  try { return await loja().get('telefones', { type: 'json' }); } catch (e) { return null; }
}

// adiciona um pedido (p) ou música (t) ao número. Nunca derruba quem chamou.
export async function indexar(tel, tipo, id) {
  try {
    const k = chaveTel(tel); if (!k || !id) return;
    await loja2().set('t/' + k + '/' + tipo + '/' + id, '1');
  } catch (e) { console.error('indexar:', e && e.message); }
}

// monta o índice inteiro do zero (roda em segundo plano)
export async function montarIndice() {
  const mapa = {}, dias = {};
  function addDia(ts, tipo, id) {
    if (!ts) return; const d = diaBR(ts);
    const e = dias[d] || (dias[d] = { p: [], t: [], l: 0, pg: [] });
    const lista = e[tipo] || (e[tipo] = []);
    if (tipo === 'l') e.l++; else if (lista.indexOf(id) === -1) lista.push(id);
  }
  function add(tel, tipo, id) {
    const k = chaveTel(tel); if (!k) return;
    const e = mapa[k] || (mapa[k] = { p: [], t: [] });
    if (e[tipo].indexOf(id) === -1) e[tipo].push(id);
  }
  const receita = {};
  function addReceita(g) {
    if (!g || !g.pago || g.cancelado || g.cortesia || g.dobroDe) return;
    const ts = g.pagoEm || g.criadoEm; if (!ts) return;
    const d = diaBR(ts), e = receita[d] || (receita[d] = { r: 0, n: 0 });
    e.r = Math.round((e.r + (Number(g.pagamento && g.pagamento.valor) || 0)) * 100) / 100; e.n++;
  }
  const presentes = getStore('presentes');
  const { blobs } = await presentes.list();
  for (let i = 0; i < blobs.length; i += 40) {
    await Promise.all(blobs.slice(i, i + 40).map(async (b) => {
      const g = await presentes.get(b.key, { type: 'json' }).catch(() => null);
      addReceita(g);
      if (g && g.pago && !g.cancelado) addDia(g.pagoEm || g.criadoEm, 'pg', g.id || b.key);
      if (g) { add(g.musicaWhatsapp || g.whatsapp, 'p', g.id || b.key); addDia(g.criadoEm, 'p', g.id || b.key); if (g.pagoEm && diaBR(g.pagoEm) !== diaBR(g.criadoEm)) addDia(g.pagoEm, 'p', g.id || b.key); }
    }));
  }
  const musicas = getStore('musicas');
  const ml = await musicas.list();
  for (let i = 0; i < ml.blobs.length; i += 40) {
    await Promise.all(ml.blobs.slice(i, i + 40).map(async (b) => {
      const m = await musicas.get(b.key, { type: 'json' }).catch(() => null);
      if (m && m.origem !== 'painel') add(m.whatsapp, 't', b.key);
      if (m) addDia(m.criadoEm, 't', b.key);
    }));
  }
  // letras escritas por dia (só as que passaram pelo modo em segundo plano)
  try {
    const letras = getStore('letras');
    const ll = await letras.list();
    for (let i = 0; i < ll.blobs.length; i += 40) {
      await Promise.all(ll.blobs.slice(i, i + 40).map(async (b) => {
        const x = await letras.get(b.key, { type: 'json' }).catch(() => null);
        if (x && x.letra && x.em) addDia(x.em, 'l');
      }));
    }
  } catch (e) {}
  const diasAtual = (await lerDias()) || {};
  for (const d of Object.keys((diasAtual && diasAtual.dias) || {})) {
    const a = diasAtual.dias[d], e = dias[d] || (dias[d] = { p: [], t: [], l: 0 });
    (a.p || []).forEach((id) => { if (e.p.indexOf(id) === -1) e.p.push(id); });
    (a.t || []).forEach((id) => { if (e.t.indexOf(id) === -1) e.t.push(id); });
    e.l = Math.max(e.l || 0, a.l || 0);
  }
  await loja().setJSON('dias', { dias, montadoEm: Date.now(), temPg: true, v2: true });
  // faturamento de cada dia de todo o histórico (o painel usa pra mês, semana e total)
  await loja().setJSON('receita', { dias: receita, montadoEm: Date.now() });
  // junta com o que entrou enquanto montava
  const atual = (await lerIndice()) || {};
  for (const k of Object.keys((atual && atual.mapa) || {})) {
    const e = atual.mapa[k];
    (e.p || []).forEach((id) => { const x = mapa[k] || (mapa[k] = { p: [], t: [] }); if (x.p.indexOf(id) === -1) x.p.push(id); });
    (e.t || []).forEach((id) => { const x = mapa[k] || (mapa[k] = { p: [], t: [] }); if (x.t.indexOf(id) === -1) x.t.push(id); });
  }
  await loja().setJSON('telefones', { mapa, montadoEm: Date.now() });
  return Object.keys(mapa).length;
}
