import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// ÁUDIO PERMANENTE: guarda uma cópia de cada música PAGA no nosso próprio
// armazenamento (Netlify Blobs). Os links do serviço de música podem expirar
// ou ser de "streaming" (que corta); com a cópia, o link do cliente funciona
// pra sempre: tocar, baixar e compartilhar.
//   v1/v2 = música principal · v3/v4 = 1ª letra extra (ofertaM1) · v5/v6 = ofertaM2
const MIN_BYTES = 400 * 1024; // abaixo disso é prévia/streaming cortado, não a música inteira

export function fonteDoPedido(g, v) {
  const m1 = g.ofertaM1 || {}, m2 = g.ofertaM2 || {};
  if (v === 5 || v === 6) return { taskId: m2.id || null, n: v === 6 ? 2 : 1, url: v === 6 ? m2.url2 : m2.url };
  if (v === 3 || v === 4) return { taskId: m1.id || null, n: v === 4 ? 2 : 1, url: v === 4 ? m1.url2 : m1.url };
  return { taskId: g.musicaPreviewId || null, n: v === 2 ? 2 : 1, url: v === 2 ? g.musicaPreviewUrl2 : g.musicaPreviewUrl };
}

function chave(f) {
  if (f.taskId) return 't_' + String(f.taskId).replace(/[^a-zA-Z0-9_-]/g, '') + '_' + f.n;
  return 'u_' + crypto.createHash('sha1').update(String(f.url || '')).digest('hex');
}

async function urlsNovas(taskId, n) {
  const out = { urls: [], pronta: false };
  try {
    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey || !taskId) return out;
    const r = await fetch('https://api.unifically.com/v1/tasks/' + encodeURIComponent(taskId), { headers: { Authorization: 'Bearer ' + apiKey } });
    const d = await r.json().catch(() => null);
    const c = (d && d.data) || d || {};
    out.pronta = /^(completed?|success|succeeded|done|finished)$/i.test(String(c.status || ''));
    const o = c.output || c.result || {};
    const lista = n === 2
      ? [c.audio_url2, o.audio_url2, Array.isArray(o.clips) && o.clips[1] && o.clips[1].audio_url, Array.isArray(o) && o[1] && o[1].audio_url]
      : [c.audio_url1, c.audio_url, o.audio_url1, o.audio_url, Array.isArray(o.clips) && o.clips[0] && o.clips[0].audio_url, Array.isArray(o) && o[0] && o[0].audio_url];
    lista.forEach((u) => { if (u && out.urls.indexOf(u) === -1) out.urls.push(u); });
  } catch (e) {}
  return out;
}

async function baixarInteira(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length >= MIN_BYTES ? buf : null;
  } catch (e) { return null; }
}

// Devolve o MP3 inteiro (Buffer) ou null. Usa a cópia guardada; se não tiver, baixa e guarda.
export async function pegarAudio(g, v) {
  const f = fonteDoPedido(g, v);
  if (!f.taskId && !f.url) return null;
  const loja = getStore('audios');
  const k = chave(f);
  try {
    const salvo = await loja.get(k, { type: 'arrayBuffer' });
    if (salvo && salvo.byteLength >= MIN_BYTES) return Buffer.from(salvo);
  } catch (e) {}
  // Música terminada no serviço → usa o link final dela e guarda a cópia.
  // Ainda terminando (streaming) → toca o que tiver, mas NÃO guarda (podia ser um pedaço).
  const novo = f.taskId ? await urlsNovas(f.taskId, f.n) : { urls: [], pronta: true };
  const tentativas = novo.pronta ? novo.urls.concat(f.url ? [f.url] : []) : (f.url ? [f.url] : []).concat(novo.urls);
  let buf = null;
  for (const u of tentativas) { buf = await baixarInteira(u); if (buf) break; }
  if (buf && novo.pronta) { try { await loja.set(k, buf); } catch (e) { console.error('audio: não guardou', k, e && e.message); } }
  return buf;
}

export async function jaGuardado(g, v) {
  const f = fonteDoPedido(g, v);
  if (!f.taskId && !f.url) return true;
  try { const m = await getStore('audios').getMetadata(chave(f)); return !!m; } catch (e) { return false; }
}

// quais versões existem nesse pedido
export function versoesDoPedido(g) {
  const vs = [];
  if (g.musicaPreviewUrl || g.musicaPreviewId) vs.push(1);
  if (g.musicaPreviewUrl2) vs.push(2);
  if (g.ofertaM1 && (g.ofertaM1.url || g.ofertaM1.id)) vs.push(3);
  if (g.ofertaM1 && g.ofertaM1.url2) vs.push(4);
  if (g.ofertaM2 && (g.ofertaM2.url || g.ofertaM2.id)) vs.push(5);
  if (g.ofertaM2 && g.ofertaM2.url2) vs.push(6);
  return vs;
}

// responde o MP3 com suporte a "Range" (o iPhone exige pra tocar e pular)
// manda em "streaming": o Netlify corta respostas normais acima de 6 MB
export function corpo(buf) {
  return new ReadableStream({ start(c) { for (let i = 0; i < buf.length; i += 262144) c.enqueue(new Uint8Array(buf.subarray(i, i + 262144))); c.close(); } });
}

export function responderAudio(req, buf, extra) {
  const total = buf.length;
  const headers = Object.assign({ 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' }, extra || {});
  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    let a = m[1] === '' ? 0 : parseInt(m[1], 10);
    let b = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
    if (m[1] === '' && m[2] !== '') { a = Math.max(0, total - parseInt(m[2], 10)); b = total - 1; }
    if (a >= total || a > b) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
    return new Response(corpo(buf.subarray(a, b + 1)), { status: 206, headers: Object.assign({}, headers, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + total, 'Content-Length': String(b - a + 1) }) });
  }
  return new Response(corpo(buf), { status: 200, headers: Object.assign({}, headers, { 'Content-Length': String(total) }) });
}
