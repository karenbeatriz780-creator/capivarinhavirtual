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
// registra no dia: p = pedido, t = música gerada (inclui painel), l = +1 letra
export async function indexarDia(tipo, id, ts) {
  try {
    const dia = diaBR(ts);
    const idx = (await lerDias()) || { dias: {}, montadoEm: 0 };
    idx.dias = idx.dias || {};
    const e = idx.dias[dia] || (idx.dias[dia] = { p: [], t: [], l: 0 });
    if (tipo === 'l') e.l = (e.l || 0) + 1;
    else { const lista = e[tipo] || (e[tipo] = []); if (lista.indexOf(id) !== -1) return; lista.push(id); }
    await loja().setJSON('dias', idx);
  } catch (e) { console.error('indexarDia:', e && e.message); }
}
// ids dos últimos N dias (inclui hoje)
export function idsDosDias(idx, n, tipo) {
  const out = [];
  if (!idx || !idx.dias) return out;
  for (let i = 0; i < n; i++) {
    const e = idx.dias[diaBR(Date.now() - i * 86400000)];
    if (e && e[tipo]) e[tipo].forEach((id) => { if (out.indexOf(id) === -1) out.push(id); });
  }
  return out;
}

export async function lerIndice() {
  try { return await loja().get('telefones', { type: 'json' }); } catch (e) { return null; }
}

// adiciona um pedido (p) ou música (t) ao número. Nunca derruba quem chamou.
export async function indexar(tel, tipo, id) {
  try {
    const k = chaveTel(tel); if (!k || !id) return;
    const idx = (await lerIndice()) || { mapa: {}, montadoEm: 0 };
    idx.mapa = idx.mapa || {};
    const e = idx.mapa[k] || (idx.mapa[k] = { p: [], t: [] });
    const lista = e[tipo] || (e[tipo] = []);
    if (lista.indexOf(id) !== -1) return;
    lista.push(id);
    await loja().setJSON('telefones', idx);
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
  await loja().setJSON('dias', { dias, montadoEm: Date.now(), temPg: true });
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
