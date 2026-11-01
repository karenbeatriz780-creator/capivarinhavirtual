// LIVRO MÁGICO — gera os 3 PDFs do livro no servidor (pra mandar no WhatsApp junto com o link):
//   pdf/<pedido>/ler.pdf      → pra ler no celular (uma página por vez)
//   pdf/<pedido>/folhas.pdf   → pra imprimir em folhas abertas (A4 deitado, 2 páginas por folha)
//   pdf/<pedido>/livreto.pdf  → pra imprimir frente e verso e dobrar (livreto)
// Desenha cada página igualzinho ao site (mesmo layout) com @napi-rs/canvas e monta com pdf-lib.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { getStore } from '@netlify/blobs';
import { loja, lerTemas, flex } from './_livros.mjs';
import { SITE } from './_zap.mjs';
import { POPPINS_BOLD, POPPINS_MEDIUM } from './_fontes.mjs';

// ---------- fontes: tenta as mesmas do site (Google Fonts); se não der, usa a Poppins que vem junto ----------
let FONTES = null;
async function baixarFonteGoogle(familia, peso) {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=' + encodeURIComponent(familia) + ':wght@' + peso + '&display=swap')).text();
    const url = (/url\((https:[^)]+\.ttf)\)/.exec(css) || [])[1];
    if (!url) return null;
    const r = await fetch(url); if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) { return null; }
}
async function carregarFontes() {
  if (FONTES) return FONTES;
  GlobalFonts.register(Buffer.from(POPPINS_BOLD, 'base64'), 'LvTitulo');
  GlobalFonts.register(Buffer.from(POPPINS_MEDIUM, 'base64'), 'LvTexto');
  GlobalFonts.register(Buffer.from(POPPINS_MEDIUM, 'base64'), 'LvMiudo');
  const [b8, b6, gh, inter] = await Promise.all([baixarFonteGoogle('Baloo 2', 800), baixarFonteGoogle('Baloo 2', 600), baixarFonteGoogle('Grand Hotel', 400), baixarFonteGoogle('Inter', 500)]);
  FONTES = {
    titulo: b8 && GlobalFonts.register(b8, 'LvBaloo8') ? 'LvBaloo8' : 'LvTitulo',
    texto: b6 && GlobalFonts.register(b6, 'LvBaloo6') ? 'LvBaloo6' : 'LvTexto',
    script: gh && GlobalFonts.register(gh, 'LvScript') ? 'LvScript' : 'LvTitulo',
    miudo: inter && GlobalFonts.register(inter, 'LvInter') ? 'LvInter' : 'LvMiudo'
  };
  return FONTES;
}

// ---------- desenho (cópia do desenharPaginaCanvas do site) ----------
function cobrir(ctx, img, x, y, w, h) { const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore(); }
function quebrar(ctx, txt, maxW) { const pal = String(txt).split(/\s+/), ls = []; let l = ''; pal.forEach((p) => { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > maxW && l) { ls.push(l); l = p; } else l = t; }); if (l) ls.push(l); return ls; }
function textoCentro(ctx, txt, cx, y, maxW, fonte, cor, lh) { ctx.font = fonte; ctx.fillStyle = cor; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; const ls = quebrar(ctx, txt, maxW); ls.forEach((l, i) => ctx.fillText(l, cx, y + i * lh)); return ls.length * lh; }
function fundoTexto(ctx, W, H, c) { const g = ctx.createRadialGradient(W / 2, 0, W * 0.05, W / 2, H * 0.2, H * 0.95); g.addColorStop(0, '#ffffff'); g.addColorStop(1, c[0]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function capaMini(ctx, imCapa, x, y, w) {
  if (!imCapa) return; const h = w * 4 / 3;
  ctx.save(); ctx.shadowColor = 'rgba(42,27,61,.3)'; ctx.shadowBlur = w * 0.08; ctx.shadowOffsetY = w * 0.03; ctx.fillStyle = '#fff'; ctx.fillRect(x - w * 0.035, y - w * 0.035, w * 1.07, h + w * 0.07); ctx.restore();
  cobrir(ctx, imCapa, x, y, w, h);
}
function desenharQR(ctx, texto, x, y, tam) {
  const q = QRCodeGen.build(texto, { ec: 'M' }), n = q.size, m = 1, cel = tam / (n + m * 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, tam, tam); ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.matrix[r][c]) ctx.fillRect(x + (c + m) * cel, y + (r + m) * cel, Math.ceil(cel), Math.ceil(cel));
}
function paginasDoLivro(tema) {
  const n = (tema.paginas || []).length, ps = [{ t: 'capa' }, { t: 'pertence' }, { t: 'rosto' }];
  for (let i = 0; i < n; i++) { ps.push({ t: 'texto', i }); if (!(tema.paginas[i] && tema.paginas[i].so)) ps.push({ t: 'img', i }); }
  ps.push({ t: 'fim' }); ps.push({ t: 'musica' });
  while ((ps.length + 1) % 4) ps.push({ t: 'branco' });
  ps.push({ t: 'contra' });
  return ps;
}
function desenharPagina(p, d, tema, imgs, num, W, H, F, linkLivro) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const c = tema.cores || ['#FFE8B8', '#F6B86B', '#7BAE5A'], u = W / 100, nome = d.nome;
  ctx.fillStyle = '#FFF8EF'; ctx.fillRect(0, 0, W, H);
  if (p.t === 'capa' || p.t === 'img') {
    const im = p.t === 'capa' ? imgs.capa : imgs.pags[p.i];
    if (im) cobrir(ctx, im, 0, 0, W, H);
    if (p.t === 'capa') {
      const tit = flex(tema.titulo, nome, d.genero), resto = tit.indexOf(nome) === 0 ? tit.slice(nome.length).replace(/^[,\s]+/, '') : tit;
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.32); g.addColorStop(0, 'rgba(30,15,40,.38)'); g.addColorStop(1, 'rgba(30,15,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.32);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
      let y = H * 0.05;
      const linha = (t, tam, cor) => { ctx.font = tam + 'px ' + F.titulo; quebrar(ctx, t, W * 0.86).forEach((l) => { ctx.lineWidth = tam * 0.16; ctx.strokeStyle = 'rgba(70,25,45,.75)'; ctx.strokeText(l, W / 2, y); ctx.fillStyle = cor; ctx.fillText(l, W / 2, y); y += tam * 1.0; }); };
      if (tit.indexOf(nome) === 0) { linha(nome, u * 12, '#FFE6A6'); linha(resto, u * 7, '#FFFFFF'); } else linha(tit, u * 8, '#FFFFFF');
    }
    return cv;
  }
  if (p.t === 'contra') {
    const gg = ctx.createLinearGradient(0, 0, W, H); gg.addColorStop(0, c[1]); gg.addColorStop(1, c[2]); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    capaMini(ctx, imgs.capa, W * 0.3, H * 0.24, W * 0.4);
    textoCentro(ctx, 'capivarinhalove.com.br', W / 2, H * 0.72, W * 0.8, (u * 3.6) + 'px ' + F.miudo, 'rgba(255,255,255,.95)', u * 4);
    return cv;
  }
  fundoTexto(ctx, W, H, c);
  if (p.t === 'texto') {
    const tx = flex(((tema.paginas || [])[p.i] || {}).texto || '', nome, d.genero);
    let tam = u * 5.6, lh = tam * 1.5; ctx.font = tam + 'px ' + F.texto;
    let ls = quebrar(ctx, tx, W * 0.78);
    while (ls.length * lh > H * 0.72 && tam > u * 3.6) { tam -= u * 0.2; lh = tam * 1.5; ctx.font = tam + 'px ' + F.texto; ls = quebrar(ctx, tx, W * 0.78); }
    const y0 = (H - ls.length * lh) / 2; ctx.fillStyle = '#2A1B3D'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, W * 0.11, y0 + i * lh));
  } else if (p.t === 'pertence') {
    capaMini(ctx, imgs.capa, W * 0.29, H * 0.1, W * 0.42);
    textoCentro(ctx, 'Este livro pertence a', W / 2, H * 0.56, W * 0.8, (u * 4.4) + 'px ' + F.texto, '#6E5C82', u * 5);
    textoCentro(ctx, nome, W / 2, H * 0.62, W * 0.86, (u * 11) + 'px ' + F.titulo, c[2], u * 12);
    textoCentro(ctx, 'com amor, ______________________', W / 2, H * 0.84, W * 0.86, (u * 3.6) + 'px ' + F.miudo, '#6E5C82', u * 4);
  } else if (p.t === 'rosto') {
    const hh = textoCentro(ctx, flex(tema.titulo, nome, d.genero), W / 2, H * 0.37, W * 0.8, (u * 9) + 'px ' + F.titulo, c[2], u * 9.5);
    textoCentro(ctx, 'Uma aventura mágica criada especialmente para ' + nome, W / 2, H * 0.44 + hh, W * 0.75, (u * 3.8) + 'px ' + F.miudo, '#6E5C82', u * 5);
  } else if (p.t === 'fim') {
    textoCentro(ctx, 'Fim', W / 2, H * 0.3, W * 0.8, (u * 24) + 'px ' + F.script, c[2], u * 24);
    textoCentro(ctx, nome + ', que venham muitas outras aventuras!', W / 2, H * 0.62, W * 0.75, (u * 5) + 'px ' + F.texto, '#2A1B3D', u * 6.5);
  } else if (p.t === 'musica') {
    textoCentro(ctx, 'A música de ' + nome, W / 2, H * 0.22, W * 0.8, (u * 7.5) + 'px ' + F.titulo, c[2], u * 8);
    const qs = W * 0.46; desenharQR(ctx, linkLivro, (W - qs) / 2, H * 0.4, qs);
    textoCentro(ctx, 'Aponte a câmera do celular pra ouvir a música e ler o livro com ela tocando.', W / 2, H * 0.8, W * 0.72, (u * 3.6) + 'px ' + F.miudo, '#6E5C82', u * 4.6);
  } else if (p.t === 'branco') {
    textoCentro(ctx, 'Espaço pra um desenho ou uma mensagem especial', W / 2, H * 0.47, W * 0.7, (u * 3.8) + 'px ' + F.miudo, '#9C8BAE', u * 5);
  }
  if (num && p.t !== 'pertence' && p.t !== 'rosto' && p.t !== 'branco') { ctx.font = (u * 2.6) + 'px ' + F.miudo; ctx.fillStyle = 'rgba(42,27,61,.45)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(num), W / 2, H * 0.965); }
  return cv;
}

async function lerImagem(chave) {
  const r = await loja().get(chave, { type: 'arrayBuffer' }).catch(() => null);
  if (!r) return null;
  try { return await loadImage(Buffer.from(r)); } catch (e) { return null; }
}

// monta os 3 PDFs e guarda. Volta { ok, tamanhos } ou { erro }
export async function gerarPdfsLivro(id) {
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || !g.livro || !g.pago) return { erro: 'livro não encontrado ou não pago' };
  const L = g.livro;
  const temas = await lerTemas(), tema = temas.find((t) => t.id === L.tema);
  if (!tema) return { erro: 'história não encontrada' };
  const F = await carregarFontes();
  const imgs = { capa: await lerImagem('img/' + id + '/capa'), pags: [] };
  for (let i = 0; i < (L.paginas || []).length; i++) {
    const p = L.paginas[i] || {};
    imgs.pags[i] = p.so ? null : await lerImagem('img/' + id + '/p' + ((p.usa != null ? p.usa : i) + 1));
  }
  const d = { nome: L.nome, genero: L.genero };
  const ps = paginasDoLivro(tema), N = ps.length, link = (process.env.URL || SITE) + '/#/livro/' + id;
  const jpg = (cv, q) => cv.toBuffer('image/jpeg', q);

  // 1) pra ler: 150 × 200 mm (3:4), 1500 × 2000 px
  const ler = await PDFDocument.create();
  ler.setTitle('Livro Mágico de ' + L.nome);
  for (let i = 0; i < N; i++) {
    const im = await ler.embedJpg(jpg(desenharPagina(ps[i], d, tema, imgs, i + 1, 1500, 2000, F, link), 86));
    const pg = ler.addPage([150 * 2.8346, 200 * 2.8346]); pg.drawImage(im, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
  }
  // 2) e 3) pra imprimir: A4 deitado com 2 páginas A5 (300 dpi). Desenha cada página uma vez só.
  const a5 = [];
  for (let i = 0; i < N; i++) a5.push(jpg(desenharPagina(ps[i], d, tema, imgs, i + 1, 1754, 2480, F, link), 88));
  const A4W = 297 * 2.8346, A4H = 210 * 2.8346;
  async function montar(folhas, titulo) {
    const doc = await PDFDocument.create(); doc.setTitle(titulo);
    const cache = {};
    for (const f of folhas) {
      const pg = doc.addPage([A4W, A4H]);
      for (let lado = 0; lado < 2; lado++) {
        const idx = f[lado];
        if (!cache[idx]) cache[idx] = await doc.embedJpg(a5[idx]);
        pg.drawImage(cache[idx], { x: lado * A4W / 2, y: 0, width: A4W / 2, height: A4H });
      }
    }
    return doc.save();
  }
  const folhasAbertas = [[N - 1, 0]]; for (let a = 1; a < N - 1; a += 2) folhasAbertas.push([a, a + 1]);
  const folhasLivreto = []; for (let s = 0; s < N / 4; s++) { folhasLivreto.push([N - 1 - 2 * s, 2 * s]); folhasLivreto.push([2 * s + 1, N - 2 - 2 * s]); }
  const bLer = Buffer.from(await ler.save());
  const bFolhas = Buffer.from(await montar(folhasAbertas, 'Livro Mágico de ' + L.nome + ' (folhas abertas)'));
  const bLivreto = Buffer.from(await montar(folhasLivreto, 'Livro Mágico de ' + L.nome + ' (livreto)'));
  await loja().set('pdf/' + id + '/ler.pdf', bLer, { metadata: { tipo: 'application/pdf' } });
  await loja().set('pdf/' + id + '/folhas.pdf', bFolhas, { metadata: { tipo: 'application/pdf' } });
  await loja().set('pdf/' + id + '/livreto.pdf', bLivreto, { metadata: { tipo: 'application/pdf' } });
  const g2 = await presentes.get(id, { type: 'json' }).catch(() => null) || g;
  g2.livro.pdf = { em: Date.now(), ler: bLer.length, folhas: bFolhas.length, livreto: bLivreto.length, fontes: F.titulo };
  await presentes.setJSON(id, g2);
  return { ok: true, tamanhos: g2.livro.pdf };
}

const QRCodeGen = (function(){
  var TOTAL_CW = [26,44,70,100,134,172,196,242,292,346];
  var ECC_PB = [
    [7,10,13,17],[10,16,22,28],[15,26,18,22],[20,18,26,16],[26,24,18,22],
    [18,16,24,28],[20,18,18,26],[24,22,22,26],[30,22,20,24],[18,26,24,28]
  ];
  var NBLK = [
    [1,1,1,1],[1,1,1,1],[1,1,2,2],[1,2,2,4],[1,2,4,4],
    [2,4,4,4],[2,4,6,5],[2,4,6,6],[2,5,8,8],[4,5,8,8]
  ];
  var ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  var ECIDX = {L:0,M:1,Q:2,H:3};
  var ECBITS = {L:1,M:0,Q:3,H:2};

  var EXP = new Array(512), LOG = new Array(256);
  (function(){ var x=1,i; for(i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; }
    for(i=255;i<512;i++) EXP[i]=EXP[i-255]; })();
  function gmul(a,b){ if(a===0||b===0) return 0; return EXP[LOG[a]+LOG[b]]; }

  function genPoly(n){
    var poly=[1], i, j;
    for(i=0;i<n;i++){
      var next = new Array(poly.length+1); for(j=0;j<next.length;j++) next[j]=0;
      for(j=0;j<poly.length;j++){ next[j] ^= poly[j]; next[j+1] ^= gmul(poly[j], EXP[i]); }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, ecLen){
    var gen = genPoly(ecLen), res = new Array(ecLen), i, j;
    for(i=0;i<ecLen;i++) res[i]=0;
    for(i=0;i<data.length;i++){
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      for(j=0;j<ecLen;j++) res[j] ^= gmul(gen[j+1], factor);
    }
    return res;
  }

  function utf8Bytes(str){
    var out=[], i, c;
    for(i=0;i<str.length;i++){
      c = str.charCodeAt(i);
      if(c<0x80) out.push(c);
      else if(c<0x800){ out.push(0xC0|(c>>6), 0x80|(c&63)); }
      else if(c<0xD800 || c>=0xE000){ out.push(0xE0|(c>>12), 0x80|((c>>6)&63), 0x80|(c&63)); }
      else { i++; var cp = 0x10000 + (((c&0x3FF)<<10) | (str.charCodeAt(i)&0x3FF));
        out.push(0xF0|(cp>>18), 0x80|((cp>>12)&63), 0x80|((cp>>6)&63), 0x80|(cp&63)); }
    }
    return out;
  }

  function dataCapacity(ver, ec){
    var e = ECIDX[ec];
    return TOTAL_CW[ver-1] - ECC_PB[ver-1][e]*NBLK[ver-1][e];
  }

  function build(text, ecLevel){
    var ec = ecLevel || 'M';
    var bytes = utf8Bytes(text);
    var ver = 0, v;
    for(v=1; v<=10; v++){
      var ccBits = (v<10)?8:16;
      var need = 4 + ccBits + bytes.length*8;
      if(dataCapacity(v, ec)*8 >= need){ ver = v; break; }
    }
    if(!ver){
      if(ec!=='L') return build(text,'L');
      throw new Error('Conteudo grande demais para QR');
    }

    // --- bit stream
    var bits = [];
    function put(val, len){ for(var i=len-1;i>=0;i--) bits.push((val>>>i)&1); }
    put(4,4);
    put(bytes.length, ver<10?8:16);
    for(var i=0;i<bytes.length;i++) put(bytes[i],8);
    var capBits = dataCapacity(ver, ec)*8;
    var term = Math.min(4, capBits - bits.length);
    for(i=0;i<term;i++) bits.push(0);
    while(bits.length % 8) bits.push(0);
    var dataCw = [];
    for(i=0;i<bits.length;i+=8){
      var b=0; for(var k=0;k<8;k++) b=(b<<1)|bits[i+k];
      dataCw.push(b);
    }
    var padBytes=[0xEC,0x11], p=0;
    while(dataCw.length < dataCapacity(ver, ec)){ dataCw.push(padBytes[p++%2]); }

    // --- blocks
    var e = ECIDX[ec], nb = NBLK[ver-1][e], ecLen = ECC_PB[ver-1][e];
    var totalData = dataCapacity(ver, ec);
    var shortLen = Math.floor(totalData/nb), numLong = totalData % nb;
    var dblocks=[], eblocks=[], off=0;
    for(i=0;i<nb;i++){
      var len = shortLen + (i >= nb-numLong ? 1 : 0);
      var blk = dataCw.slice(off, off+len); off += len;
      dblocks.push(blk);
      eblocks.push(rsEncode(blk, ecLen));
    }
    var finalCw=[], maxLen = shortLen+ (numLong?1:0);
    for(i=0;i<maxLen;i++) for(var b2=0;b2<nb;b2++) if(i<dblocks[b2].length) finalCw.push(dblocks[b2][i]);
    for(i=0;i<ecLen;i++) for(b2=0;b2<nb;b2++) finalCw.push(eblocks[b2][i]);

    // --- matrix
    var size = ver*4 + 17;
    var m = [], res = [];
    for(i=0;i<size;i++){ m.push(new Array(size).fill(0)); res.push(new Array(size).fill(0)); }
    function setF(r,c,val){ if(r<0||c<0||r>=size||c>=size) return; m[r][c]=val; res[r][c]=1; }

    function finder(r,c){
      for(var dr=-1;dr<=7;dr++) for(var dc=-1;dc<=7;dc++){
        var rr=r+dr, cc=c+dc;
        if(rr<0||cc<0||rr>=size||cc>=size) continue;
        var on = (dr>=0&&dr<=6&&(dc===0||dc===6)) || (dc>=0&&dc<=6&&(dr===0||dr===6)) ||
                 (dr>=2&&dr<=4&&dc>=2&&dc<=4);
        setF(rr,cc,on?1:0);
      }
    }
    finder(0,0); finder(0,size-7); finder(size-7,0);

    var ap = ALIGN[ver-1];
    for(i=0;i<ap.length;i++) for(var j=0;j<ap.length;j++){
      var ar=ap[i], ac=ap[j];
      if((ar<=8&&ac<=8)||(ar<=8&&ac>=size-9)||(ar>=size-9&&ac<=8)) continue;
      for(var dr2=-2;dr2<=2;dr2++) for(var dc2=-2;dc2<=2;dc2++){
        var on2 = Math.max(Math.abs(dr2),Math.abs(dc2))!==1;
        setF(ar+dr2, ac+dc2, on2?1:0);
      }
    }
    for(i=8;i<size-8;i++){ setF(6,i,(i%2===0)?1:0); setF(i,6,(i%2===0)?1:0); }
    setF(size-8,8,1); // dark module

    // reserve format areas
    for(i=0;i<9;i++){ if(!res[8][i]) setF(8,i,0); if(!res[i][8]) setF(i,8,0); }
    for(i=0;i<8;i++){ if(!res[8][size-1-i]) setF(8,size-1-i,0); if(!res[size-1-i][8]) setF(size-1-i,8,0); }

    if(ver>=7){
      var rem2 = ver<<12, ii;
      for(ii=0;ii<6;ii++){ if(rem2 & (1<<(17-ii))) rem2 ^= (0x1F25 << (5-ii)); }
      var vinfo = ((ver<<12) | (rem2 & 0xFFF));
      for(i=0;i<18;i++){
        var vbit = (vinfo>>i)&1;
        setF(Math.floor(i/3), size-11+(i%3), vbit);
        setF(size-11+(i%3), Math.floor(i/3), vbit);
      }
    }

    // --- place data
    var dir=-1, row=size-1, col=size-1, idx=0, bitI=0;
    while(col>0){
      if(col===6) col--;
      while(true){
        for(var q=0;q<2;q++){
          var cc2 = col-q;
          if(!res[row][cc2]){
            var dark = 0;
            if(idx < finalCw.length){ dark = (finalCw[idx] >>> (7-bitI)) & 1; }
            m[row][cc2] = dark;
            bitI++; if(bitI===8){ bitI=0; idx++; }
          }
        }
        row += dir;
        if(row<0||row>=size){ row -= dir; dir = -dir; break; }
      }
      col -= 2;
    }

    // --- masks
    function maskFn(k,r,c){
      switch(k){
        case 0: return (r+c)%2===0;
        case 1: return r%2===0;
        case 2: return c%3===0;
        case 3: return (r+c)%3===0;
        case 4: return (Math.floor(r/2)+Math.floor(c/3))%2===0;
        case 5: return (r*c)%2 + (r*c)%3 === 0;
        case 6: return ((r*c)%2 + (r*c)%3)%2===0;
        case 7: return ((r+c)%2 + (r*c)%3)%2===0;
      }
    }
    function fmtBits(ecl, mask){
      var d2 = (ECBITS[ecl]<<3)|mask, rem3 = d2<<10, i2;
      for(i2=0;i2<5;i2++){ if(rem3 & (1<<(14-i2))) rem3 ^= (0x537 << (4-i2)); }
      return ((d2<<10)|(rem3 & 0x3FF)) ^ 0x5412;
    }
    function applyFormat(mat, ecl, mask){
      var f = fmtBits(ecl, mask), i3;
      for(i3=0;i3<15;i3++){
        var bit = (f>>i3)&1;
        if(i3<6)        mat[8][i3] = bit;
        else if(i3===6) mat[8][7] = bit;
        else if(i3===7) mat[8][8] = bit;
        else if(i3===8) mat[7][8] = bit;
        else            mat[14-i3][8] = bit;
        if(i3<7) mat[size-1-i3][8] = bit;
        else     mat[8][size-15+i3] = bit;
      }
      mat[size-8][8] = 1;
    }
    function penalty(mat){
      var s=0, i4,j4,k4;
      for(i4=0;i4<size;i4++){
        for(var dirn=0;dirn<2;dirn++){
          var run=1, prev=dirn?mat[0][i4]:mat[i4][0];
          for(j4=1;j4<size;j4++){
            var cur = dirn?mat[j4][i4]:mat[i4][j4];
            if(cur===prev) run++;
            else { if(run>=5) s += 3 + (run-5); run=1; prev=cur; }
          }
          if(run>=5) s += 3 + (run-5);
        }
      }
      for(i4=0;i4<size-1;i4++) for(j4=0;j4<size-1;j4++){
        var v0=mat[i4][j4];
        if(v0===mat[i4][j4+1] && v0===mat[i4+1][j4] && v0===mat[i4+1][j4+1]) s+=3;
      }
      var pat=[1,0,1,1,1,0,1,0,0,0,0];
      var pat2=[0,0,0,0,1,0,1,1,1,0,1];
      for(i4=0;i4<size;i4++) for(j4=0;j4<=size-11;j4++){
        var ok1=true, ok2=true;
        for(k4=0;k4<11;k4++){ if(mat[i4][j4+k4]!==pat[k4]) ok1=false; if(mat[i4][j4+k4]!==pat2[k4]) ok2=false; }
        if(ok1) s+=40; if(ok2) s+=40;
        ok1=true; ok2=true;
        for(k4=0;k4<11;k4++){ if(mat[j4+k4][i4]!==pat[k4]) ok1=false; if(mat[j4+k4][i4]!==pat2[k4]) ok2=false; }
        if(ok1) s+=40; if(ok2) s+=40;
      }
      var dark=0;
      for(i4=0;i4<size;i4++) for(j4=0;j4<size;j4++) if(mat[i4][j4]) dark++;
      var pct = dark*100/(size*size);
      s += Math.floor(Math.abs(pct-50)/5)*10;
      return s;
    }

    var best=null, bestScore=Infinity, bestMask=0;
    for(var mk=0; mk<8; mk++){
      var cand=[];
      for(i=0;i<size;i++) cand.push(m[i].slice());
      for(i=0;i<size;i++) for(j=0;j<size;j++){
        if(!res[i][j] && maskFn(mk,i,j)) cand[i][j] ^= 1;
      }
      applyFormat(cand, ec, mk);
      var sc = penalty(cand);
      if(sc<bestScore){ bestScore=sc; best=cand; bestMask=mk; }
    }
    return {matrix:best, size:size, version:ver, ec:ec, mask:bestMask};
  }

  function toSVG(text, opts){
    opts = opts || {};
    var q = build(text, opts.ec||'M');
    var quiet = opts.quiet===undefined?2:opts.quiet;
    var n = q.size + quiet*2;
    var dark = opts.dark||'#161113', light = opts.light||'#ffffff';
    var path = '';
    for(var r=0;r<q.size;r++){
      var c=0;
      while(c<q.size){
        if(q.matrix[r][c]){
          var st=c; while(c<q.size && q.matrix[r][c]) c++;
          path += 'M'+(st+quiet)+' '+(r+quiet)+'h'+(c-st)+'v1h'+(-(c-st))+'z';
        } else c++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+n+' '+n+'" shape-rendering="crispEdges">'+
      '<rect width="'+n+'" height="'+n+'" fill="'+light+'"/><path d="'+path+'" fill="'+dark+'"/></svg>';
  }
  return {build:build, toSVG:toSVG};
})();

