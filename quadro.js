/* Quadro com QR Code \u2014 arte A4 (2480 \u00d7 3508, 300 dpi) pra imprimir. Sem marca nenhuma.
   desenharQuadro(canvas, dados, tema) \u2192 Promise
   dados: { foto (url/dataURL), titulo, sub, data, qr (matriz do QRCodeGen.build), frase } */
(function(){
  var TEMAS = {
    creme: { bg:'#F4EEE5', grao:'rgba(80,60,40,', tx:'#1F1A1C', tx2:'#7A6E70', barra:'rgba(31,26,28,.16)', fill:'#1F1A1C', play:'#1F1A1C', playIc:'#F4EEE5', acento:'#C2185B', qrBg:'#FFFFFF', qrFg:'#1F1A1C', sombra:'rgba(60,40,30,.28)' },
    noite: { bg:'#151114', grao:'rgba(255,255,255,', tx:'#FFFFFF', tx2:'rgba(255,255,255,.62)', barra:'rgba(255,255,255,.2)', fill:'#FFFFFF', play:'#FFFFFF', playIc:'#151114', acento:'#FF5C9E', qrBg:'#FFFFFF', qrFg:'#151114', sombra:'rgba(0,0,0,.6)' },
    rose:  { bg:'#F2DDDF', grao:'rgba(120,40,60,', tx:'#3B1E28', tx2:'#8E6670', barra:'rgba(59,30,40,.16)', fill:'#3B1E28', play:'#3B1E28', playIc:'#F2DDDF', acento:'#C2185B', qrBg:'#FFFFFF', qrFg:'#3B1E28', sombra:'rgba(90,30,50,.25)' }
  };
  var W = 2480, H = 3508, M = 180;
  function img(src){ return new Promise(function(ok, er){ var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function(){ ok(i); }; i.onerror = er; i.src = src; }); }
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function caber(c, txt, max, px, peso, fam){ var p = px; do { c.font = peso + ' ' + p + 'px ' + fam; if (c.measureText(txt).width <= max) break; p -= 4; } while (p > 40); return p; }
  function icone(c, tipo, cx, cy, s, cor){
    c.save(); c.translate(cx, cy); c.scale(s / 24, s / 24); c.translate(-12, -12);
    c.fillStyle = cor; c.strokeStyle = cor; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    var P = function(d){ return new Path2D(d); };
    if (tipo === 'prev') { c.fill(P('M6 5h2.2v14H6zM20 5v14L9.2 12z')); }
    else if (tipo === 'next') { c.fill(P('M15.8 5H18v14h-2.2zM4 5v14l10.8-7z')); }
    else if (tipo === 'shuf') { c.stroke(P('M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5')); }
    else if (tipo === 'rep') { c.stroke(P('M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3')); }
    else if (tipo === 'cor') { c.fill(P('M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z')); }
    c.restore();
  }
  var _fontes = null;
  function carregarFontes(){
    if (_fontes) return _fontes;
    var B = (window.QUADRO_BASE || '') + '/fontes/';
    var L = [['QLora', 'lora.woff', { weight: '400 700' }], ['QLora', 'lora-italic.woff', { style: 'italic', weight: '400 700' }], ['QInter', 'inter-500.woff', { weight: '500' }], ['QInter', 'inter-700.woff', { weight: '700' }]];
    _fontes = Promise.all(L.map(function(f){ try { var ff = new FontFace(f[0], 'url(' + B + f[1] + ')', f[2]); document.fonts.add(ff); return ff.load(); } catch (e) { return null; } })).catch(function(){});
    return _fontes;
  }
  window.QUADRO_TEMAS = Object.keys(TEMAS);
  window.desenharQuadro = function(cv, d, tema){
    var T = TEMAS[tema] || TEMAS.creme;
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var fontes = carregarFontes();
    return Promise.all([img(d.foto), fontes]).then(function(r){
      var foto = r[0];
      // fundo + textura de papel bem leve
      c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
      var s = 7; for (var i = 0; i < 26000; i++) { c.fillStyle = T.grao + (Math.random() * .05).toFixed(3) + ')'; c.fillRect(Math.random() * W, Math.random() * H, s * Math.random(), s * Math.random()); }
      // foto (recorte "cover")
      var fx = M, fy = M, fw = W - 2 * M, fh = 1660, rad = 34;
      c.save(); c.shadowColor = T.sombra; c.shadowBlur = 90; c.shadowOffsetY = 40; rr(c, fx, fy, fw, fh, rad); c.fillStyle = T.bg; c.fill(); c.restore();
      c.save(); rr(c, fx, fy, fw, fh, rad); c.clip();
      var esc = Math.max(fw / foto.width, fh / foto.height), iw = foto.width * esc, ih = foto.height * esc;
      var oy = (d.focoY != null ? d.focoY : .42);
      c.drawImage(foto, fx + (fw - iw) / 2, fy + Math.min(0, Math.max(fh - ih, fh / 2 - ih * oy)), iw, ih);
      c.restore();
      // t\u00edtulo + subt\u00edtulo + cora\u00e7\u00e3o
      var ty = fy + fh + 250, maxT = fw - 200;
      var pT = caber(c, d.titulo || 'Nossa m\u00fasica', maxT, 176, '600', 'QLora, Georgia, serif');
      c.fillStyle = T.tx; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.font = '600 ' + pT + 'px QLora, Georgia, serif'; c.fillText(d.titulo || 'Nossa m\u00fasica', fx, ty);
      c.fillStyle = T.tx2; c.font = '500 ' + caber(c, d.sub || '', maxT, 66, '500', 'QInter, Arial, sans-serif') + 'px QInter, Arial, sans-serif'; c.fillText(d.sub || '', fx + 4, ty + 105);
      icone(c, 'cor', fx + fw - 62, ty - 52, 118, T.acento);
      // barra de progresso
      var by = ty + 250, prog = .38;
      c.fillStyle = T.barra; rr(c, fx, by - 7, fw, 14, 7); c.fill();
      c.fillStyle = T.fill; rr(c, fx, by - 7, fw * prog, 14, 7); c.fill();
      c.beginPath(); c.arc(fx + fw * prog, by, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = T.tx2; c.font = '500 54px QInter, Arial, sans-serif'; c.fillText(d.t1 || '1:24', fx, by + 100);
      c.textAlign = 'right'; c.fillText(d.t2 || '-2:18', fx + fw, by + 100); c.textAlign = 'left';
      // controles
      var cy = by + 310, cx = W / 2;
      icone(c, 'shuf', fx + 40, cy, 96, T.tx2); icone(c, 'rep', fx + fw - 40, cy, 96, T.tx2);
      icone(c, 'prev', cx - 400, cy, 150, T.tx); icone(c, 'next', cx + 400, cy, 150, T.tx);
      c.fillStyle = T.play; c.beginPath(); c.arc(cx, cy, 150, 0, Math.PI * 2); c.fill();
      c.fillStyle = T.playIc; c.beginPath(); c.moveTo(cx - 44, cy - 72); c.lineTo(cx + 78, cy); c.lineTo(cx - 44, cy + 72); c.closePath(); c.fill();
      // QR + frase
      var qs = 470, qy = H - M - qs, qx = fx;
      c.save(); c.shadowColor = 'rgba(0,0,0,.12)'; c.shadowBlur = 40; c.shadowOffsetY = 12; c.fillStyle = T.qrBg; rr(c, qx, qy, qs, qs, 36); c.fill(); c.restore();
      if (d.qr) {
        var n = d.qr.size, pad = 34, cel = (qs - 2 * pad) / n;
        c.fillStyle = T.qrFg;
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (d.qr.matrix[y][x]) c.fillRect(Math.floor(qx + pad + x * cel), Math.floor(qy + pad + y * cel), Math.ceil(cel), Math.ceil(cel));
      }
      var tx = qx + qs + 90, cyq = qy + qs / 2;
      c.fillStyle = T.tx2; c.font = '700 46px QInter, Arial, sans-serif';
      var linhaTopo = d.data ? String(d.data).toUpperCase() : 'NOSSA M\u00daSICA';
      c.save(); if (c.letterSpacing !== undefined) c.letterSpacing = '8px'; c.fillText(linhaTopo, tx, cyq - 90); c.restore();
      c.fillStyle = T.tx; c.font = 'italic 500 92px QLora, Georgia, serif';
      var frase = d.frase || 'aponte a c\u00e2mera e ou\u00e7a\na nossa m\u00fasica \u2665';
      frase.split('\n').forEach(function(l, k){ c.fillText(l, tx, cyq + 20 + k * 110); });
    });
  };
})();
