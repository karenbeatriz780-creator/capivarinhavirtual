import { getStore } from '@netlify/blobs';

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

async function urlReal(taskId, v) {
  try {
    const reg = await getStore('musicas').get(taskId, { type: 'json' });
    const u = reg && (v === 2 ? reg.url2 : reg.url);
    if (u) return u;
  } catch (e) {}
  // plano B: pergunta direto pro serviço de música
  try {
    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    const r = await fetch('https://api.unifically.com/v1/tasks/' + encodeURIComponent(taskId), { headers: { Authorization: 'Bearer ' + apiKey } });
    const d = await r.json();
    const c = (d && d.data) || d || {};
    return (v === 2 ? c.audio_url2 : c.audio_url1 || c.audio_url) || null;
  } catch (e) { return null; }
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const taskId = (u.searchParams.get('taskId') || '').trim();
    const v = u.searchParams.get('v') === '2' ? 2 : 1;
    const g = (u.searchParams.get('g') || '').trim();
    const pedidoId = (u.searchParams.get('id') || '').trim();

    // Modo pedido (?id=): prévia de um pedido. Pago → música completa; não pago → só 70s.
    let real = null;
    if (pedidoId) {
      if (pedidoId.length > 100) return erro('Pedido inválido.', 400);
      const p = await getStore('presentes').get(pedidoId, { type: 'json' });
      if (!p) return erro('Pedido não encontrado.', 404);
      real = v === 2 ? p.musicaPreviewUrl2 : p.musicaPreviewUrl;
      if (!real) return erro('Música não encontrada.', 404);
      if (p.pago === true && !p.cancelado) {
        return new Response(null, { status: 302, headers: { Location: real, 'Cache-Control': 'no-store' } });
      }
    } else {
      if (!taskId || taskId.length > 100) return erro('Faltou o identificador.', 400);
      real = await urlReal(taskId, v);
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

    const up = await fetch(real);
    if (!up.ok) return erro('Não consegui carregar a música.', 502);
    const buf = Buffer.from(await up.arrayBuffer());
    const { ini, fim } = bytesDaPrevia(buf);
    const corte = Buffer.from(buf.subarray(0, fim > ini ? fim : buf.length));
    // O cabeçalho Xing/Info diz a duração da música INTEIRA — apaga, senão o
    // player mostra "2:43" e para em 1:10. Sem ele, a duração sai certa (≈1:10).
    for (const tag of ['Xing', 'Info']) {
      const k = corte.indexOf(tag, 0, 'latin1');
      if (k > -1 && k < 8192) corte.fill(0, k, k + 4);
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
