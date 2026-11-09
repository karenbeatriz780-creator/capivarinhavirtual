import { getStore } from '@netlify/blobs';
import { baixarPorTask, fonteDoPedido } from './_audio.mjs';
import { sunoFetch } from './_ia.mjs';

// Entrega só os primeiros 70 segundos do MP3 (a "prévia").
// A música completa só sai (redirecionando pro arquivo real) se o presente
// ligado a ela estiver PAGO. Quem não pagou nunca recebe o arquivo inteiro.
const PREVIA_SEG = 70;

function erro(msg, status) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function pularId3(buf) {
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  }
  return 0;
}

// Calcula quantos bytes valem ~70s. Lê o cabeçalho do primeiro frame (MPEG1 Layer III)
// e, se tiver cabeçalho Xing/Info (VBR), usa a duração real.
function bytesDaPrevia(buf) {
  const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const SR = [44100, 48000, 32000];
  const ini = pularId3(buf);
  let i = ini;
  while (i < Math.min(buf.length - 4, ini + 4096) && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  if (i >= buf.length - 4) return { ini, fim: Math.min(buf.length, PREVIA_SEG * 16000) };
  const h = buf.readUInt32BE(i);
  const versao = (h >> 19) & 3, br = BR[(h >> 12) & 15], sr = SR[(h >> 10) & 3];
  if (versao !== 3 || !br || !sr) return { ini, fim: Math.min(buf.length, ini + PREVIA_SEG * 16000) };
  let bps = br * 125;
  const mono = ((h >> 6) & 3) === 3;
  const x = i + 4 + (mono ? 17 : 32);
  const tag = buf.toString('latin1', x, x + 4);
  if ((tag === 'Xing' || tag === 'Info') && (buf[x + 7] & 1)) {
    const frames = buf.readUInt32BE(x + 8);
    const dur = frames * 1152 / sr;
    if (dur > 1) bps = (buf.length - ini) / dur;
  }
  let fim = Math.min(buf.length, Math.round(ini + PREVIA_SEG * bps));
  // alinha no próximo frame pra não cortar no meio
  let j = fim;
  while (j < Math.min(buf.length - 1, fim + 2000) && !(buf[j] === 0xff && (buf[j + 1] & 0xe0) === 0xe0)) j++;
  if (j < buf.length - 1) fim = j;
  return { ini, fim };
}

// ---- silêncio em MP3 (frames válidos com áudio zerado) ----
const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const SR1 = [44100, 48000, 32000];
function lerFrame(buf, i) {
  if (i + 4 > buf.length || buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;
  const h = buf.readUInt32BE(i);
  const versao = (h >> 19) & 3, camada = (h >> 17) & 3, br = BR1[(h >> 12) & 15], sr = SR1[(h >> 10) & 3];
  if (versao !== 3 || camada !== 1 || !br || !sr) return null; // só MPEG1 Layer III
  const pad = (h >> 9) & 1;
  return { h, br, sr, mono: ((h >> 6) & 3) === 3, tam: Math.floor(144000 * br / sr) + pad };
}
function completarComSilencio(buf, ini, so70) {
  // acha o 1º frame
  let i = ini;
  while (i < Math.min(buf.length - 4, ini + 8192) && !lerFrame(buf, i)) i++;
  const f0 = lerFrame(buf, i);
  if (!f0) return null;
  const x = i + 4 + (f0.mono ? 17 : 32);
  const tag = buf.toString('latin1', x, x + 4);
  let totalFrames = 0, ref = f0, inicioAudio = i, temXing = false;
  if ((tag === 'Xing' || tag === 'Info') && (buf[x + 7] & 1)) {
    temXing = true;
    totalFrames = buf.readUInt32BE(x + 8);
    inicioAudio = i + f0.tam;
    ref = lerFrame(buf, inicioAudio) || f0;
  }
  // conta os frames que já estão na prévia
  let n = 0, j = inicioAudio;
  while (j < so70.length) { const f = lerFrame(so70, j); if (!f) break; n++; j += f.tam; }
  if (!totalFrames) totalFrames = Math.round((buf.length - inicioAudio) / ref.tam);
  const faltam = Math.min(totalFrames - n, Math.ceil(8 * 60 * ref.sr / 1152)); // no máx. 8 min
  if (faltam <= 0) return null;
  // frame de silêncio: mesmo formato, sem CRC, sem padding, dados zerados.
  // Com cabeçalho Xing (duração gravada nele) dá pra usar 32 kbps → arquivo bem menor.
  const brIdx = temXing ? 1 : ((ref.h >> 12) & 15);
  const br = BR1[brIdx];
  const tam = Math.floor(144000 * br / ref.sr);
  const sil = Buffer.alloc(tam, 0);
  sil.writeUInt32BE(((((ref.h | 0x10000) & ~0x200) & ~0xf000) | (brIdx << 12)) >>> 0, 0);
  const corpo = Buffer.alloc(tam * faltam);
  for (let k = 0; k < faltam; k++) sil.copy(corpo, k * tam);
  const out = Buffer.concat([so70.subarray(0, j), corpo]);
  if (temXing) {
    // acerta o tamanho e o índice de busca (TOC) do cabeçalho Xing pro arquivo novo
    const flags = out[x + 7];
    let p = x + 8 + ((flags & 1) ? 4 : 0);
    if (flags & 2) { out.writeUInt32BE(out.length - i, p); p += 4; }
    if (flags & 4) {
      const aud = j - inicioAudio, tot = out.length - inicioAudio, dur = totalFrames, ate = n;
      for (let k = 0; k < 100; k++) {
        const fr = dur * k / 100; // frame alvo
        const pos = fr <= ate ? aud * (fr / Math.max(1, ate)) : aud + (fr - ate) * tam;
        out[p + k] = Math.min(255, Math.floor(256 * (inicioAudio - i + pos) / (out.length - i)));
      }
    }
  }
  return out;
}

async function urlReal(taskId, v) {
  try {
    const reg = await getStore('musicas').get(taskId, { type: 'json' });
    const u = reg && (v === 2 ? reg.url2 : reg.url);
    if (u) return u;
  } catch (e) {}
  // plano B: pergunta direto pro serviço de música
  try {
    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    const r = await sunoFetch('https://api.unifically.com/v1/tasks/' + encodeURIComponent(taskId), { headers: { Authorization: 'Bearer ' + apiKey } });
    const d = await r.json();
    const c = (d && d.data) || d || {};
    return (v === 2 ? c.audio_url2 : c.audio_url1 || c.audio_url) || null;
  } catch (e) { return null; }
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const taskId = (u.searchParams.get('taskId') || '').trim();
    const v = Math.min(6, Math.max(1, parseInt(u.searchParams.get('v'), 10) || 1));
    const g = (u.searchParams.get('g') || '').trim();
    const pedidoId = (u.searchParams.get('id') || '').trim();

    // Modo pedido (?id=): prévia de um pedido. Pago → música completa; não pago → só 70s.
    let real = null;
    if (pedidoId) {
      if (pedidoId.length > 100) return erro('Pedido inválido.', 400);
      const p = await getStore('presentes').get(pedidoId, { type: 'json' });
      if (!p) return erro('Pedido não encontrado.', 404);
      const m1 = p.ofertaM1 || {}, m2 = p.ofertaM2 || {};
      real = v === 6 ? m2.url2 : v === 5 ? m2.url : v === 4 ? m1.url2 : v === 3 ? m1.url : v === 2 ? p.musicaPreviewUrl2 : p.musicaPreviewUrl;
      if (!real) return erro('Música não encontrada.', 404);
      if (p.pago === true && !p.cancelado) {
        return new Response(null, { status: 302, headers: { Location: real, 'Cache-Control': 'no-store' } });
      }
    } else {
      if (!taskId || taskId.length > 100) return erro('Faltou o identificador.', 400);
      real = await urlReal(taskId, v === 2 ? 2 : 1);
      if (!real) return erro('Música não encontrada.', 404);
    }

    // Presente pago ligado a esta música? Aí libera a completa.
    if (g) {
      try {
        const p = await getStore('presentes').get(g, { type: 'json' });
        if (p && p.pago === true && !p.cancelado && p.musicaPreviewId === taskId) {
          return new Response(null, { status: 302, headers: { Location: real, 'Cache-Control': 'no-store' } });
        }
      } catch (e) {}
    }

    // a prévia de 70 s fica guardada: o celular pede o mesmo áudio várias vezes (pedaços)
    // e sem isso cada pedaço baixava e cortava a música inteira de novo (gasto na Netlify)
    const chaveCache = 'pv_' + (pedidoId ? 'p_' + pedidoId : 't_' + taskId) + '_' + v;
    const cache = getStore('previas');
    let corte = null;
    try { const c = await cache.getWithMetadata(chaveCache, { type: 'arrayBuffer' }); if (c && c.data && c.data.byteLength > 50 * 1024) corte = Buffer.from(c.data); } catch (e) {}
    if (!corte) {
    let buf = null;
    try { const up = await fetch(real); if (up.ok) buf = Buffer.from(await up.arrayBuffer()); } catch (e) {}
    if (!buf || buf.length < 50 * 1024) {
      // link do serviço expirou: tenta os links reserva da mesma faixa
      let tid = taskId, n = v === 2 ? 2 : 1;
      if (pedidoId) {
        const p2 = await getStore('presentes').get(pedidoId, { type: 'json' }).catch(() => null);
        if (p2) { const f = fonteDoPedido(p2, v); tid = f.taskId; n = f.n; }
      }
      buf = await baixarPorTask(tid, n, null);
    }
    if (!buf) return erro('Não consegui carregar a música.', 502);
    const { ini, fim } = bytesDaPrevia(buf);
    // Prévia = 70 s cantando + SILÊNCIO até o tamanho real da música.
    // Assim o player mostra a duração verdadeira (ex.: 3:42) e para de cantar no 1:10.
    // O arquivo continua sem o resto da música (quem não pagou nunca recebe ela inteira).
    const so70 = Buffer.from(buf.subarray(0, fim > ini ? fim : buf.length));
    corte = so70;
    try { corte = completarComSilencio(buf, ini, so70) || so70; } catch (e) { console.error('previa silêncio:', e && e.message); }
    try { await cache.set(chaveCache, corte, { metadata: { em: Date.now() } }); } catch (e) {}
    }
    const total = corte.length;

    const headers = {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=600',
      'Content-Disposition': 'inline; filename="previa.mp3"'
    };
    const range = req.headers.get('range');
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let a = m[1] === '' ? 0 : parseInt(m[1], 10);
      let b = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
      if (m[1] === '' && m[2] !== '') { a = Math.max(0, total - parseInt(m[2], 10)); b = total - 1; }
      if (a >= total || a > b) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
      return new Response(corte.subarray(a, b + 1), {
        status: 206,
        headers: Object.assign({}, headers, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + total, 'Content-Length': String(b - a + 1) })
      });
    }
    return new Response(corte, { status: 200, headers: Object.assign({}, headers, { 'Content-Length': String(total) }) });
  } catch (e) {
    console.error('previa-musica:', e && e.stack || e);
    return erro('Erro no servidor.', 500);
  }
};
