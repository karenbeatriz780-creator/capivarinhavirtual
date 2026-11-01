/* =========================================================================
   LIVRO MÁGICO — Capivarinha Love
   Rotas:  #/livro            página de venda (capas trocando)
           #/livro/criar      passo a passo (história → criança → foto)
           #/livro/<id>       espera → prévia (capa + música) → Pix → livro completo
   Usa funções do index.html: el, esc, toast, Store, jget, jset, copiar, htmlPixLimpo,
   ligarPixLimpo, gaCompraUnica, QRCodeGen, MASCOTE, aoSair.
   ========================================================================= */
(function(){
var css = `
:root{ --lv-noite:#1E1433; --lv-noite2:#2C1D4A; --lv-ouro:#F4C35A; --lv-ouro2:#FFE6A6; --lv-rosa:#FF6FA1; --lv-creme:#FFF8EF; --lv-tinta:#2A1B3D; --lv-suave:#6E5C82; --lv-borda:#EFE3D3; }
.lv{min-height:100vh;background:var(--lv-creme);color:var(--lv-tinta);font-family:'Inter',system-ui,sans-serif;}
.lv *{box-sizing:border-box}
.lv-h{font-family:'Baloo 2','Inter',sans-serif;font-weight:800;line-height:1.05;letter-spacing:-.01em;text-wrap:balance}
.lv-eb{font-family:'Grand Hotel',cursive;color:#E39A2B;font-size:1.45rem;line-height:1}
.lv-wrap{max-width:30rem;margin:0 auto;padding:0 max(18px,env(safe-area-inset-left,0px)) 7rem max(18px,env(safe-area-inset-right,0px))}
.lv-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;border:0;border-radius:18px;padding:1.05rem 1.2rem;font:800 1.12rem 'Baloo 2','Inter',sans-serif;cursor:pointer;
  color:#2A1B3D;background:linear-gradient(180deg,#FFE29A,#F4C35A 55%,#E5A93A);box-shadow:0 10px 26px rgba(229,169,58,.4),inset 0 1px 0 rgba(255,255,255,.7)}
.lv-btn:disabled{opacity:.55;cursor:default}
.lv-btn.rosa{color:#fff;background:linear-gradient(180deg,#FF8DB8,#FF5C97 55%,#E23C7E);box-shadow:0 10px 26px rgba(226,60,126,.38),inset 0 1px 0 rgba(255,255,255,.45)}
.lv-btn.claro{background:#fff;color:var(--lv-tinta);border:2px solid var(--lv-borda);box-shadow:none}
.lv-btn:focus-visible,.lv-op:focus-visible,.lv-chip:focus-visible{outline:3px solid #8C6BD8;outline-offset:2px}
.lv-rodape.escondido{transform:translateY(120%)}
.lv-rodape{transition:transform .3s;position:fixed;left:0;right:0;bottom:0;padding:.8rem max(16px,env(safe-area-inset-left,0px)) calc(.8rem + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-right,0px));
  background:linear-gradient(180deg,rgba(255,248,239,0),var(--lv-creme) 30%);z-index:30}
.lv-rodape .lv-btn{max-width:30rem;margin:0 auto}

/* ---------- hero ---------- */
.lv-hero{position:relative;overflow:hidden;color:#fff;padding:calc(1.2rem + env(safe-area-inset-top,0px)) 0 2.6rem;
  background:radial-gradient(90% 60% at 50% 0%,#4B2E7A 0%,#2C1D4A 45%,#1E1433 100%)}
.lv-hero:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:46px;background:var(--lv-creme);border-radius:50% 50% 0 0/100% 100% 0 0}
.lv-estrelas{position:absolute;inset:0;pointer-events:none}
.lv-estrelas i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.7;animation:lvPisca 2.6s ease-in-out infinite}
@keyframes lvPisca{50%{opacity:.15;transform:scale(.6)}}
.lv-topo{display:flex;align-items:center;justify-content:center;gap:.45rem;font:700 .95rem 'Inter';opacity:.95;position:relative;z-index:2}
.lv-topo img{width:30px;height:30px;object-fit:contain}
.lv-palco{position:relative;height:clamp(300px,82vw,400px);margin:1.4rem auto .4rem;perspective:1400px;z-index:2}
.lv-palco .lv-livro3d{position:absolute;left:50%;top:0;width:clamp(210px,58vw,286px);transform:translateX(-50%) rotateY(-14deg) rotateX(2deg);opacity:0;transition:opacity .6s ease,transform .9s cubic-bezier(.2,.8,.2,1)}
.lv-palco .lv-livro3d.on{opacity:1;transform:translateX(-50%) rotateY(-8deg) rotateX(2deg)}
.lv-palco .lv-livro3d.sai{opacity:0;transform:translateX(-80%) rotateY(-40deg)}
.lv-brilho-chao{position:absolute;left:50%;bottom:0;width:70%;height:30px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(244,195,90,.55),transparent);filter:blur(6px)}
.lv-hero .lv-h{color:#fff;font-size:clamp(2rem,8.6vw,2.6rem);text-align:center;margin:.6rem 0 .5rem;position:relative;z-index:2}
.lv-hero .lv-h em{font-style:normal;color:var(--lv-ouro)}
.lv-hero p{text-align:center;color:#E6DBF5;font-size:1.02rem;line-height:1.55;margin:0 auto 1.3rem;max-width:26rem;position:relative;z-index:2}
.lv-selos{display:flex;flex-wrap:wrap;justify-content:center;gap:.45rem;margin:0 0 1.3rem;position:relative;z-index:2}
.lv-selos span{font:700 .82rem 'Inter';padding:.45rem .75rem;border-radius:99px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
.lv-hero .lv-btn{position:relative;z-index:2}

/* ---------- capa do livro (componente) ---------- */
.lv-livro3d{border-radius:5px 14px 14px 5px;box-shadow:-2px 0 0 #d9c49a,-5px 4px 0 #b99a5e,18px 26px 40px rgba(0,0,0,.45);position:relative}
.lv-capa{position:relative;aspect-ratio:3/4;width:100%;border-radius:4px 12px 12px 4px;overflow:hidden;background:#ddd}
.lv-capa img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lv-capa:before{content:"";position:absolute;left:0;top:0;bottom:0;width:7%;z-index:3;background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.12) 40%,rgba(0,0,0,0))}
.lv-capa-tit{position:absolute;left:6%;right:5%;top:5%;z-index:4;text-align:center;font-family:'Baloo 2',sans-serif;font-weight:800;line-height:.98;color:#fff;
  text-shadow:0 2px 0 rgba(60,20,40,.55),0 0 18px rgba(0,0,0,.35);-webkit-text-stroke:.6px rgba(70,25,40,.35)}
.lv-capa-tit b{display:block;font-size:1.32em;color:#FFE6A6}
.lv-capa-arte{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center}
.lv-capa-arte .sol{position:absolute;width:44%;aspect-ratio:1;border-radius:50%;top:30%;left:50%;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0))}
.lv-capa-arte .morro{position:absolute;left:-10%;right:-10%;bottom:-18%;height:52%;border-radius:50% 50% 0 0}
.lv-capa-arte .emo{position:relative;font-size:4.6em;margin-bottom:18%;filter:drop-shadow(0 8px 10px rgba(0,0,0,.25));animation:lvFlut 3s ease-in-out infinite}
.lv-capa-marca{position:absolute;right:5%;bottom:3.5%;z-index:4;font:700 .55em 'Inter';color:#fff;opacity:.85;text-shadow:0 1px 3px rgba(0,0,0,.5)}
@keyframes lvFlut{50%{transform:translateY(-6px)}}

/* ---------- seções ---------- */
.lv-sec{padding:1.6rem 0 .4rem}
.lv-sec h2{color:var(--lv-tinta);font-family:'Baloo 2',sans-serif;font-weight:800;font-size:1.7rem;line-height:1.08;margin:.3rem 0 .9rem;text-wrap:balance}
.lv-passos{display:grid;gap:.7rem}
.lv-passo{display:flex;gap:.85rem;align-items:flex-start;background:#fff;border:1px solid var(--lv-borda);border-radius:18px;padding:.95rem}
.lv-passo b{flex:none;width:2.2rem;height:2.2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#FFF0CC;font-size:1.15rem}
.lv-passo h4{margin:0 0 .15rem;font:800 1.02rem 'Baloo 2',sans-serif}
.lv-passo p{margin:0;font-size:.92rem;line-height:1.5;color:var(--lv-suave)}
.lv-galeria{display:flex;gap:.8rem;overflow-x:auto;padding:.3rem .2rem 1rem;scroll-snap-type:x mandatory;margin:0 -.2rem}
.lv-galeria>div{flex:none;width:9.5rem;scroll-snap-align:start}
.lv-galeria small{display:block;font:800 .88rem 'Baloo 2';margin-top:.5rem;line-height:1.15}
.lv-faq details{background:#fff;border:1px solid var(--lv-borda);border-radius:14px;padding:.85rem 1rem;margin-bottom:.55rem}
.lv-faq summary{font-weight:700;cursor:pointer}
.lv-faq p{color:var(--lv-suave);line-height:1.55;margin:.55rem 0 0;font-size:.93rem}
.lv-meus{display:flex;gap:.6rem;overflow-x:auto;padding-bottom:.4rem}
.lv-meus a{flex:none;display:flex;align-items:center;gap:.5rem;background:#fff;border:1px solid var(--lv-borda);border-radius:14px;padding:.55rem .8rem;color:inherit;text-decoration:none;font-weight:700;font-size:.9rem}

/* ---------- passo a passo ---------- */
.lv-barra{position:sticky;top:0;z-index:20;background:var(--lv-creme);padding:calc(.7rem + env(safe-area-inset-top,0px)) 0 .5rem}
.lv-barra .tr{height:6px;border-radius:9px;background:#F1E6D6;overflow:hidden}
.lv-barra .tr i{display:block;height:100%;background:linear-gradient(90deg,#F4C35A,#FF6FA1);border-radius:9px;transition:width .4s}
.lv-voltar{background:none;border:0;font:700 .95rem 'Inter';color:var(--lv-suave);padding:.7rem 0 .2rem;cursor:pointer}
.lv-tit{color:var(--lv-tinta);font-family:'Baloo 2',sans-serif;font-weight:800;font-size:1.75rem;line-height:1.08;margin:.25rem 0 .4rem;text-wrap:balance}
.lv-sub{color:var(--lv-suave);line-height:1.55;margin:0 0 1.2rem}
.lv-temas{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
.lv-op{background:#fff;border:2px solid var(--lv-borda);border-radius:20px;padding:.6rem;text-align:left;cursor:pointer;font:inherit;color:inherit;transition:transform .15s,border-color .15s}
.lv-op.on{border-color:#F4C35A;box-shadow:0 0 0 4px rgba(244,195,90,.25)}
.lv-op h4{margin:.55rem .15rem .2rem;font:800 1rem 'Baloo 2',sans-serif;line-height:1.1}
.lv-op p{margin:0 .15rem .2rem;color:var(--lv-suave);font-size:.8rem;line-height:1.4}
.lv-op .ok{display:none;font:800 .8rem 'Inter';color:#C98A12;margin:.3rem .15rem 0}
.lv-op.on .ok{display:block}
.lv-campo label{display:block;font-weight:700;margin:1rem 0 .45rem}
.lv-campo input[type=text],.lv-campo input[type=tel]{width:100%;font:700 1.25rem 'Baloo 2',sans-serif;text-align:center;padding:1rem;border-radius:16px;border:2px solid var(--lv-borda);background:#fff;color:var(--lv-tinta)}
.lv-campo input:focus{outline:none;border-color:#F4C35A}
.lv-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:.45rem}
.lv-chips.dois{grid-template-columns:1fr 1fr}
.lv-chips.tres{grid-template-columns:repeat(3,1fr)}
.lv-chip{border:2px solid var(--lv-borda);background:#fff;border-radius:14px;padding:.75rem .3rem;font:800 1rem 'Baloo 2',sans-serif;cursor:pointer;color:var(--lv-tinta)}
.lv-chip.on{background:linear-gradient(180deg,#FF8DB8,#E23C7E);color:#fff;border-color:transparent}
.lv-chip.larga{grid-column:span 2;font-size:.92rem}
.lv-foto{border:2.5px dashed #F4C35A;border-radius:22px;background:#FFF4DB;padding:1.5rem 1rem;text-align:center;cursor:pointer;display:block}
.lv-foto .ic{font-size:2.6rem}
.lv-foto b{display:block;font:800 1.1rem 'Baloo 2';margin:.3rem 0 .15rem}
.lv-foto small{color:var(--lv-suave)}
.lv-foto img{width:150px;height:150px;border-radius:50%;object-fit:cover;border:5px solid #fff;box-shadow:0 8px 22px rgba(0,0,0,.15)}
.lv-dica{display:flex;gap:.6rem;background:#FFF4DB;border-radius:14px;padding:.8rem .9rem;margin-top:.9rem;font-size:.9rem;line-height:1.45;color:#6A5232}
.lv-aceite{display:flex;gap:.6rem;align-items:flex-start;margin-top:1rem;font-size:.86rem;line-height:1.45;color:var(--lv-suave);cursor:pointer}
.lv-aceite input{width:20px;height:20px;flex:none;margin-top:.1rem;accent-color:#E23C7E}
.lv-erro{color:#C2185B;font-weight:700;font-size:.9rem;margin-top:.7rem;min-height:1.2em}

/* ---------- espera mágica ---------- */
.lv-espera{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:2rem max(20px,env(safe-area-inset-left,0px));
  background:radial-gradient(90% 70% at 50% 30%,#4B2E7A 0%,#2C1D4A 50%,#1E1433 100%);position:relative;overflow:hidden}
.lv-livrinho{position:relative;width:150px;height:110px;margin-bottom:1.6rem}
.lv-livrinho .esq,.lv-livrinho .dir{position:absolute;top:0;width:75px;height:110px;background:#FFF8EF;border-radius:6px}
.lv-livrinho .esq{left:0;transform:skewY(6deg);transform-origin:right}
.lv-livrinho .dir{right:0;transform:skewY(-6deg);transform-origin:left}
.lv-livrinho .folha{position:absolute;top:0;left:75px;width:75px;height:110px;background:#FFE6A6;border-radius:0 6px 6px 0;transform-origin:left center;animation:lvFolha 1.6s ease-in-out infinite}
@keyframes lvFolha{0%{transform:rotateY(0)}50%{transform:rotateY(-170deg)}100%{transform:rotateY(-180deg);opacity:0}}
.lv-voando{position:absolute;inset:0;pointer-events:none}
.lv-voando span{position:absolute;bottom:-40px;font-size:1.6rem;animation:lvSobe 7s linear infinite;opacity:0}
@keyframes lvSobe{0%{transform:translateY(0) rotate(-10deg);opacity:0}10%{opacity:1}100%{transform:translateY(-110vh) rotate(20deg);opacity:0}}
.lv-espera h2{color:#fff;font-family:'Baloo 2';font-weight:800;font-size:1.65rem;margin:.2rem 0 .3rem;position:relative}
.lv-espera p{color:#E6DBF5;margin:0 0 1.3rem;position:relative;min-height:1.5em}
.lv-check{list-style:none;padding:0;margin:0;display:grid;gap:.5rem;text-align:left;position:relative}
.lv-check li{display:flex;align-items:center;gap:.6rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.65rem .9rem;font-weight:600;min-width:16rem}
.lv-check li i{font-style:normal;width:1.4rem;text-align:center}
.lv-giro{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#F4C35A;border-radius:50%;animation:lvGiro .8s linear infinite}
@keyframes lvGiro{to{transform:rotate(360deg)}}

/* ---------- prévia ---------- */
.lv-prev{min-height:100vh;background:radial-gradient(90% 60% at 50% 0%,#4B2E7A 0%,#2C1D4A 45%,#1E1433 100%);color:#fff;padding:calc(1rem + env(safe-area-inset-top,0px)) 0 3rem}
.lv-prev .lv-h{color:#fff;text-align:center;font-size:1.65rem;margin:.6rem 0 .3rem}
.lv-prev .sub{text-align:center;color:#E6DBF5;margin:0 0 1rem;line-height:1.5}
.lv-zap{display:flex;align-items:center;justify-content:center;gap:.5rem;max-width:22rem;margin:1rem auto 0;padding:.9rem 1rem;border-radius:14px;background:#25D366;color:#fff!important;font-weight:800;text-decoration:none;font-size:1rem;box-shadow:0 4px 14px rgba(37,211,102,.35)}
.lv-zap-dica{max-width:22rem;margin:.4rem auto 0;text-align:center;font-size:.82rem;opacity:.8;line-height:1.35}
.lv-prev .lv-livro3d{width:min(78vw,300px);margin:1rem auto 1.6rem;transform:rotateY(-6deg)}
.lv-abrir{position:absolute;inset:0;z-index:6;display:flex;align-items:flex-end;justify-content:center;padding-bottom:9%;background:linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,0) 45%);border:0;cursor:pointer;width:100%}
.lv-abrir span{font:800 1.05rem 'Baloo 2';color:#2A1B3D;background:linear-gradient(180deg,#FFE29A,#F4C35A);padding:.7rem 1.3rem;border-radius:99px;box-shadow:0 8px 20px rgba(0,0,0,.35);animation:lvPulso 1.6s ease-in-out infinite}
@keyframes lvPulso{50%{transform:scale(1.06)}}
.lv-tocando{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:-.6rem 0 1.2rem;font-weight:700;color:var(--lv-ouro2)}
.lv-eq{display:inline-flex;gap:3px;align-items:flex-end;height:16px}
.lv-eq i{width:4px;height:100%;background:var(--lv-ouro);border-radius:2px;transform-origin:50% 100%;animation:lvEq .8s ease-in-out infinite}
.lv-eq i:nth-child(2){animation-delay:-.3s}.lv-eq i:nth-child(3){animation-delay:-.55s}
@keyframes lvEq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.lv-tranca{background:var(--lv-creme);color:var(--lv-tinta);border-radius:26px;padding:1.3rem 1.1rem 1.2rem;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.lv-tranca h3{font:800 1.45rem 'Baloo 2';margin:0 0 .2rem;line-height:1.1;text-align:center}
.lv-tranca .sub2{text-align:center;color:var(--lv-suave);margin:0 0 1rem;font-size:.93rem}
.lv-paginas-bloq{display:flex;gap:.45rem;justify-content:center;margin:0 0 1rem}
.lv-paginas-bloq div{width:3.4rem;aspect-ratio:3/4;border-radius:6px;background:linear-gradient(135deg,#E9DDF7,#F8E9D4);position:relative;overflow:hidden;filter:blur(.3px)}
.lv-paginas-bloq div:after{content:"🔒";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.lv-inclui{list-style:none;padding:0;margin:0 0 1rem;display:grid;gap:.45rem}
.lv-inclui li{display:flex;gap:.6rem;align-items:flex-start;font-size:.95rem;line-height:1.4}
.lv-inclui li b{color:#C98A12}
.lv-preco{text-align:center;margin:.2rem 0 .9rem}
.lv-preco s{color:#A99BB8;font-size:.95rem}
.lv-preco strong{display:block;font:800 2.5rem 'Baloo 2';color:#E23C7E;line-height:1}
.lv-preco small{color:var(--lv-suave)}
.lv-relogio{display:flex;align-items:center;justify-content:center;gap:.5rem;background:#FFF0D6;color:#8A5A10;border-radius:14px;padding:.6rem;font-weight:700;margin-bottom:.9rem}
.lv-relogio b{font:800 1.25rem 'Baloo 2';font-variant-numeric:tabular-nums}

/* ---------- leitor ---------- */
.lv-leitor{position:fixed;inset:0;z-index:40;background:radial-gradient(90% 70% at 50% 20%,#3A2560 0%,#22163A 55%,#160E26 100%);color:#fff;display:flex;flex-direction:column;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.lv-l-topo{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem}
.lv-l-topo .t{flex:1;min-width:0;font:800 1rem 'Baloo 2';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lv-l-bt{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:12px;padding:.55rem .75rem;font:700 .85rem 'Inter';cursor:pointer;white-space:nowrap}
.lv-l-bt.on{background:var(--lv-ouro);color:#2A1B3D}
.lv-l-palco{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;perspective:1600px;touch-action:pan-y}
.lv-l-vista{display:flex;filter:drop-shadow(0 22px 40px rgba(0,0,0,.45))}
.lv-l-vista.anima-prox{animation:lvProx .5s cubic-bezier(.2,.8,.2,1)}
.lv-l-vista.anima-ant{animation:lvAnt .5s cubic-bezier(.2,.8,.2,1)}
@keyframes lvProx{from{transform:rotateY(-24deg) translateX(40px);opacity:.2}to{transform:none;opacity:1}}
@keyframes lvAnt{from{transform:rotateY(24deg) translateX(-40px);opacity:.2}to{transform:none;opacity:1}}
.lv-pag{width:var(--pw);height:calc(var(--pw)*4/3);position:relative;overflow:hidden;background:#FFF8EF;color:#2A1B3D;font-size:calc(var(--pw)*.052)}
.lv-l-vista .lv-pag:first-child{border-radius:6px 2px 2px 6px}
.lv-l-vista .lv-pag:last-child{border-radius:2px 6px 6px 2px}
.lv-l-vista .lv-pag:only-child{border-radius:4px 10px 10px 4px}
.lv-l-vista.dupla .lv-pag:first-child:after{content:"";position:absolute;right:0;top:0;bottom:0;width:8%;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.14))}
.lv-l-vista.dupla .lv-pag:last-child:not(:only-child):after{content:"";position:absolute;left:0;top:0;bottom:0;width:8%;background:linear-gradient(270deg,rgba(0,0,0,0),rgba(0,0,0,.14))}
.lv-pag img.cheia{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lv-pag .fundo{position:absolute;inset:0}
.lv-pag .miolo{position:absolute;inset:9% 10%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.lv-pag .txt{font-family:'Baloo 2',sans-serif;font-weight:600;font-size:1em;line-height:1.5;text-align:left;width:100%}
.lv-pag .txt:first-letter{font-size:2.3em;font-weight:800;line-height:.8;float:left;margin:.08em .1em 0 0;color:var(--cor2)}
.lv-pag .num{position:absolute;bottom:4%;left:0;right:0;text-align:center;font:700 .62em 'Inter';opacity:.5}
.lv-pag .canto{position:absolute;font-size:1.6em;opacity:.85}
.lv-pag .grande{font-family:'Baloo 2';font-weight:800;font-size:2.2em;line-height:1;color:var(--cor2)}
.lv-pag .script{font-family:'Grand Hotel',cursive;font-size:2.6em;line-height:1;color:var(--cor2)}
.lv-pag .peq{font-size:.75em;opacity:.75;line-height:1.5}
.lv-pag .qr{width:48%;background:#fff;padding:3%;border-radius:8%}
.lv-pag .qr svg{width:100%;height:auto;display:block}
.lv-pag.carregando{display:flex;align-items:center;justify-content:center;background:#EFE6F6}
.lv-l-seta{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:1.4rem;cursor:pointer}
.lv-l-seta.ant{left:max(8px,env(safe-area-inset-left,0px))}.lv-l-seta.prox{right:max(8px,env(safe-area-inset-right,0px))}
.lv-l-baixo{display:flex;flex-wrap:wrap;gap:.45rem;justify-content:center;align-items:center;padding:.6rem .8rem .9rem}
.lv-l-cont{font:700 .82rem 'Inter';opacity:.75;min-width:4.5rem;text-align:center}
.lv-modal{position:fixed;inset:0;z-index:60;background:rgba(15,8,25,.7);display:flex;align-items:flex-end;justify-content:center;padding:1rem}
.lv-modal>div{background:var(--lv-creme);color:var(--lv-tinta);border-radius:24px;padding:1.3rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom,0px));width:100%;max-width:28rem;max-height:90vh;overflow:auto}
.lv-modal h3{font:800 1.35rem 'Baloo 2';margin:0 0 .3rem}
.lv-modal ol{padding-left:1.2rem;line-height:1.6;color:var(--lv-suave);font-size:.93rem}
.lv-modal .lv-btn{margin-top:.6rem}
.lv-prog{height:8px;border-radius:9px;background:#EFE3D3;overflow:hidden;margin:.8rem 0 .3rem}
.lv-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#F4C35A,#FF6FA1);transition:width .3s}

/* ---------- painel ---------- */
.lvp{display:grid;gap:.8rem}
.lvp-it{background:#fff;border:1px solid #eee;border-radius:14px;padding:.8rem;display:flex;gap:.8rem;align-items:center}
.lvp-it img,.lvp-it .sem{width:58px;height:78px;border-radius:6px;object-fit:cover;background:#f3eee8;display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex:none}
.lvp-it .tx{flex:1;min-width:0}
.lvp-it .tx b{display:block}
.lvp-st{font:700 .72rem 'Inter';padding:.2rem .5rem;border-radius:99px;background:#eee}
.lvp-st.pub{background:#DDF5E3;color:#1D7A3A}.lvp-st.ras{background:#FFF0CC;color:#8A5A10}
.lvp-ed label{display:block;font-weight:700;font-size:.85rem;margin:.7rem 0 .25rem}
.lvp-ed input,.lvp-ed textarea,.lvp-ed select{width:100%;font:500 .9rem 'Inter';padding:.55rem .65rem;border:1px solid #ddd;border-radius:10px;box-sizing:border-box}
.lvp-ed textarea{min-height:5.2rem;resize:vertical}
.lvp-cena{background:#faf7f2;border-radius:12px;padding:.6rem;margin-top:.6rem}
.lvp-bts{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.8rem}
.lvp-bts button{border:0;border-radius:10px;padding:.6rem .9rem;font:700 .85rem 'Inter';cursor:pointer;background:#2A1B3D;color:#fff}
.lvp-bts button.cl{background:#eee;color:#222}
.lvp-bts button.ouro{background:#F4C35A;color:#2A1B3D}
@media (prefers-reduced-motion:reduce){.lv *{animation:none!important;transition:none!important}}
`;
var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

/* ------------------------------------------------------------------ util */
var NOMES_EX={menino:['Miguel','Arthur','Davi','Gael','Theo','Bento'], menina:['Helena','Alice','Laura','Maitê','Cecília','Aurora']};
function flexTxt(t,nome,gen){ var menina=gen==='menina'; return String(t||'').replace(/\[([^\]|]*)\|([^\]]*)\]/g,function(m,a,b){ return menina?b:a; }).replace(/\{nome\}/g,nome||''); }
function lvGet(){ return jget('cl_livros',[]); }
function lvSalvar(o){ var l=lvGet().filter(function(x){ return x.id!==o.id; }); l.unshift(o); jset('cl_livros', l.slice(0,20)); }
function htmlZapLivro(d,t,esperando){
  if(!d||!t||d.pago) return '';
  var num=(typeof ZAP_API!=='undefined'&&ZAP_API)||'5511924826268';
  var txt='Oi! Quero receber a prévia do Livro Mágico de '+(d.nome||'')+' 📖 (código L.'+d.id+'.'+t+')';
  return '<a class="lv-zap" target="_blank" rel="noopener" href="https://wa.me/'+num+'?text='+encodeURIComponent(txt)+'">📲 '+(esperando?'Receber no WhatsApp quando ficar pronta':'Receber minha prévia no WhatsApp')+'</a>'+
    '<div class="lv-zap-dica">'+(esperando?'Não quer esperar? Toque, aperte <b>enviar</b> no WhatsApp e pode sair. A gente te manda a capa e a música assim que ficar pronta.':'Toque e depois é só apertar <b>enviar</b> no WhatsApp. A gente te manda o link na hora.')+'</div>';
}
function lvToken(id){ var x=lvGet().filter(function(o){ return o.id===id; })[0]; return x?x.t:''; }
function lvFmt(v){ return 'R$ '+Number(v).toFixed(2).replace('.',','); }
var _lvTemas=null;
function lvTemas(){
  if(_lvTemas) return Promise.resolve(_lvTemas);
  return fetch('/.netlify/functions/livro-temas').then(function(r){ return r.json(); }).then(function(d){ _lvTemas=(d&&d.temas)||[]; return _lvTemas; });
}
function lvTema(id){ return (_lvTemas||[]).filter(function(t){ return t.id===id; })[0]||null; }

/* capa: imagem gerada (ou arte de reserva com as cores do tema) + título por cima */
function htmlCapa(o){
  var c=o.cores||['#FFE8B8','#F6B86B','#7BAE5A'];
  var arte = o.img
    ? '<img src="'+esc(o.img)+'" alt="Capa do livro">'
    : '<div class="lv-capa-arte" style="background:linear-gradient(180deg,'+c[0]+','+c[1]+')"><div class="sol"></div><div class="morro" style="background:'+c[2]+'"></div><div class="emo">'+(o.emoji||'📖')+'</div></div>';
  var tit=String(o.titulo||''), nome=String(o.nome||'');
  var resto = nome && tit.indexOf(nome)===0 ? tit.slice(nome.length).replace(/^[,\s]+/,'') : tit;
  var tituloHtml = nome && tit.indexOf(nome)===0 ? '<b>'+esc(nome)+'</b>'+esc(resto) : esc(tit);
  return '<div class="lv-capa" style="font-size:'+(o.fsCss||((o.fs||16)+'px'))+'">'+arte+
    '<div class="lv-capa-tit" style="font-size:'+(o.fsTit||1.35)+'em">'+tituloHtml+'</div>'+
    '<div class="lv-capa-marca">Capivarinha Love</div>'+(o.extra||'')+'</div>';
}

/* --------------------------------------------------------------- roteador */
window.telaLivro=function(arg){
  document.title='Livro Mágico · Capivarinha Love';
  if(!arg) return telaLivroHome();
  if(arg==='criar') return telaLivroCriar();
  if(/^L[0-9a-f]{14}$/.test(arg)) return telaLivroPedido(arg);
  /* link do WhatsApp: #/livro/<pedido>.<token> → guarda o token neste aparelho e abre a prévia */
  var lk=/^(L[0-9a-f]{14})\.([0-9a-f]{24})$/i.exec(arg);
  if(lk){
    var ja=lvGet().filter(function(o){ return o.id===lk[1]; })[0];
    if(!ja) lvSalvar({id:lk[1],t:lk[2].toLowerCase(),nome:'',em:Date.now()});
    try{ history.replaceState(null,'','#/livro/'+lk[1]); }catch(e){}
    return telaLivroPedido(lk[1]);
  }
  location.hash='#/livro';
};

/* ------------------------------------------------------- página de venda */
function telaLivroHome(){
  var app=el('app');
  var estrelas=''; for(var i=0;i<26;i++) estrelas+='<i style="left:'+(Math.random()*100)+'%;top:'+(Math.random()*85)+'%;animation-delay:'+(Math.random()*2.6).toFixed(2)+'s"></i>';
  var meus=lvGet();
  app.innerHTML='<div class="lv">'+
    '<section class="lv-hero"><div class="lv-estrelas">'+estrelas+'</div>'+
      '<div class="lv-topo"><img src="'+MASCOTE+'" alt="">Capivarinha Love</div>'+
      '<div class="lv-palco" id="lvPalco"><div class="lv-brilho-chao"></div></div>'+
      '<div class="lv-wrap" style="padding-bottom:0">'+
        '<div class="lv-eb" style="text-align:center">✨ Livro Mágico</div>'+
        '<h1 class="lv-h">Seu filho como <em>protagonista</em> da própria aventura</h1>'+
        '<p>Um livro ilustrado só dele, com o rostinho dele nas páginas e uma música com o nome dele. Pra ler no celular e imprimir.</p>'+
        '<div class="lv-selos"><span>📸 Só 1 foto</span><span>🎵 Música com o nome</span><span>🖨️ PDF pra imprimir</span></div>'+
        '<button class="lv-btn" id="lvCriar">Criar o livro agora ✨</button>'+
      '</div></section>'+
    '<div class="lv-wrap">'+
      (meus.length?'<div class="lv-sec"><div class="lv-eb">seus livros</div><div class="lv-meus">'+meus.map(function(o){ return '<a href="#/livro/'+esc(o.id)+'">📖 '+esc(o.nome||'Livro')+'</a>'; }).join('')+'</div></div>':'')+
      '<div class="lv-sec"><div class="lv-eb">como funciona</div><h2>Pronto em poucos minutos</h2><div class="lv-passos">'+
        '<div class="lv-passo"><b>📚</b><div><h4>Escolha a aventura</h4><p>Fazenda, futebol, fundo do mar, espaço ou castelo encantado.</p></div></div>'+
        '<div class="lv-passo"><b>📸</b><div><h4>Conte quem é a criança</h4><p>Nome, idade e uma foto com o rostinho bem visível.</p></div></div>'+
        '<div class="lv-passo"><b>🎵</b><div><h4>Veja a capa e ouça a música</h4><p>A capa com o rosto dela e a música com o nome ficam prontas antes de você pagar.</p></div></div>'+
        '<div class="lv-passo"><b>🔓</b><div><h4>Desbloqueie o livro completo</h4><p>Leia virando as páginas, com a música tocando, e baixe o PDF em alta qualidade pra imprimir.</p></div></div>'+
      '</div></div>'+
      '<div class="lv-sec"><div class="lv-eb">as aventuras</div><h2>Escolha o mundo dele</h2><div class="lv-galeria" id="lvGal"></div></div>'+
      '<div class="lv-sec lv-faq"><div class="lv-eb">dúvidas</div><h2>Perguntas frequentes</h2>'+
        '<details><summary>Como a foto é usada?</summary><p>A foto serve só pra desenhar a criança no livro. Ela não aparece pra ninguém e é apagada automaticamente depois que o livro fica pronto.</p></details>'+
        '<details><summary>Dá pra imprimir?</summary><p>Sim! Você baixa o PDF em alta qualidade, com versão pra ler no celular e versão pronta pra imprimir em casa ou na gráfica, com o passo a passo.</p></details>'+
        '<details><summary>Quanto tempo demora?</summary><p>A capa e a música ficam prontas em uns 2 minutos. Depois do pagamento, o livro completo fica pronto em poucos minutos.</p></details>'+
        '<details><summary>Funciona pra bebê?</summary><p>Sim. Escolha "menos de 1 ano" e os meses: as ilustrações mostram o bebê de um jeito fofo e seguro.</p></details>'+
      '</div>'+
    '</div>'+
    '<div class="lv-rodape escondido" id="lvRod"><button class="lv-btn" id="lvCriar2">Criar o livro agora ✨</button></div>'+
  '</div>';
  el('lvCriar').onclick=el('lvCriar2').onclick=function(){ location.hash='#/livro/criar'; };
  try{ var ob=new IntersectionObserver(function(es){ var r=el('lvRod'); if(r) r.classList.toggle('escondido', es[0].isIntersecting); }); ob.observe(el('lvCriar')); aoSair(function(){ ob.disconnect(); }); }catch(e){ el('lvRod').classList.remove('escondido'); }
  lvTemas().then(function(ts){
    if(!el('lvPalco')) return;
    var palco=el('lvPalco'), gal=el('lvGal');
    var html='';
    ts.forEach(function(t,i){
      var gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][i%6];
      html+='<div class="lv-livro3d'+(i===0?' on':'')+'">'+htmlCapa({img:t.vitrine, cores:t.cores, emoji:t.emoji, titulo:flexTxt(t.titulo,nome,gen), nome:nome, fs:Math.min(16, palco.clientWidth/22)})+'</div>';
    });
    palco.insertAdjacentHTML('beforeend', html);
    gal.innerHTML=ts.map(function(t,i){
      var gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][(i+2)%6];
      return '<div><div class="lv-livro3d">'+htmlCapa({img:t.vitrine,cores:t.cores,emoji:t.emoji,titulo:flexTxt(t.titulo,nome,gen),nome:nome,fs:7.4})+'</div><small>'+esc(t.emoji+' '+t.nome)+'</small></div>';
    }).join('');
    var livros=palco.querySelectorAll('.lv-livro3d'), atual=0;
    if(livros.length<2) return;
    var iv=setInterval(function(){
      if(!el('lvPalco')){ clearInterval(iv); return; }
      var a=livros[atual]; a.classList.remove('on'); a.classList.add('sai');
      setTimeout(function(){ a.classList.remove('sai'); },700);
      atual=(atual+1)%livros.length; livros[atual].classList.add('on');
    },2000);
    aoSair(function(){ clearInterval(iv); });
  }).catch(function(){});
}

/* ------------------------------------------------------- passo a passo */
var LV={passo:0, tema:null, nome:'', idade:null, meses:null, genero:null, foto:null, zap:'', aceite:false, codigo:''};
function lvAparelho(){ var a=''; try{ a=Store.get('cl_aparelho')||''; if(!a){ a=Math.random().toString(36).slice(2)+Date.now().toString(36); Store.set('cl_aparelho',a); } }catch(e){} return a; }
function telaLivroCriar(){
  /* 1 prévia por pessoa: se já tem uma (não paga), mostra ela em vez de criar outra */
  var meu=lvGet()[0];
  var conferir = meu && !LV.codigo
    ? fetch('/.netlify/functions/livro-status?id='+meu.id+'&t='+encodeURIComponent(meu.t),{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; })
    : Promise.resolve(null);
  Promise.all([lvTemas(), conferir]).then(function(x){
    var d=x[1];
    if(d && !d.pago){ telaJaTemPrevia(meu, d); return; }
    desenharPasso();
  }).catch(function(){ toast('Sem conexão. Tente de novo.'); });
}
function telaJaTemPrevia(meu, d){
  var tema=d?lvTema(d.tema):null, zap=(window.CONFIG&&CONFIG.whatsapp)||'5511924826268';
  var capa=(d&&tema)?'<div class="lv-livro3d" style="width:min(56vw,210px);margin:1rem auto 1.4rem">'+htmlCapa({img:d.capa,cores:tema.cores,emoji:tema.emoji,titulo:flexTxt(tema.titulo,d.nome,d.genero),nome:d.nome,fs:11})+'</div>':'';
  el('app').innerHTML='<div class="lv"><div class="lv-wrap" style="padding-top:calc(1.4rem + env(safe-area-inset-top,0px));text-align:center">'+
    '<div class="lv-eb">sua prévia</div><h1 class="lv-tit">Você já criou a prévia do seu livro 📖</h1>'+
    '<p class="lv-sub">Cada pessoa tem direito a uma prévia grátis'+(meu&&meu.nome?' (a de <b>'+esc(meu.nome)+'</b>)':'')+'. Depois de desbloquear, você pode criar quantos livros quiser.</p>'+capa+
    (meu?'<a class="lv-btn rosa" href="#/livro/'+esc(meu.id)+'">Ver minha prévia e desbloquear ✨</a>':'')+
    '<a class="lv-btn claro" style="margin-top:.7rem;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/'+esc(zap)+'?text='+encodeURIComponent('Oi! Quero criar outra prévia do Livro Mágico.')+'">💬 Falar com o suporte</a>'+
    '<div class="lv-campo" style="text-align:left;margin-top:1.4rem"><label for="lvCod">Tem um código do suporte?</label><input type="text" id="lvCod" placeholder="LIVRO-XXXXX" style="text-transform:uppercase"></div>'+
    '<button class="lv-btn claro" id="lvUsarCod" style="margin-top:.6rem">Usar código</button>'+
    '<div style="margin-top:1rem"><a href="#/livro" style="color:#6E5C82;font-weight:700">← voltar</a></div></div></div>';
  el('lvUsarCod').onclick=function(){
    var c=el('lvCod').value.trim().toUpperCase(); if(c.length<6){ toast('Digite o código que o suporte mandou.'); return; }
    LV.codigo=c; LV.passo=0; desenharPasso(); window.scrollTo(0,0);
  };
}
function desenharPasso(){
  var app=el('app'); var P=LV.passo, total=3;
  var corpo='', pode=false, btn='Continuar →';
  if(P===0){
    corpo='<div class="lv-eb">escolha a aventura</div><h1 class="lv-tit">Qual aventura vai viver?</h1>'+
      '<p class="lv-sub">O rostinho da criança entra nas ilustrações e o nome em toda a história.</p><div class="lv-temas">'+
      (_lvTemas||[]).map(function(t,i){
        var gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][(i+1)%6];
        return '<button type="button" class="lv-op'+(LV.tema===t.id?' on':'')+'" data-tema="'+esc(t.id)+'"><div class="lv-livro3d">'+
          htmlCapa({img:t.vitrine,cores:t.cores,emoji:t.emoji,titulo:flexTxt(t.titulo,nome,gen),nome:nome,fs:7.2})+'</div>'+
          '<h4>'+esc(t.emoji+' '+t.nome)+'</h4><p>'+esc(flexTxt(t.descricao,'',gen))+'</p><div class="ok">✓ Escolhida</div></button>';
      }).join('')+'</div>';
    pode=!!LV.tema;
  } else if(P===1){
    var meses='';
    if(LV.idade===0){
      meses='<div class="lv-campo"><label>Quantos meses?</label><div class="lv-chips tres">'+
        ['Recém-nascido','1 mês','2 meses','3 meses','4 meses','5 meses','6 meses','7 meses','8 meses','9 meses','10 meses','11 meses'].map(function(t,i){
          return '<button type="button" class="lv-chip'+(LV.meses===i?' on':'')+'" data-meses="'+i+'" style="font-size:.85rem">'+t+'</button>'; }).join('')+'</div></div>';
    }
    corpo='<div class="lv-eb">protagonista da história</div><h1 class="lv-tit">Quem é a criança?</h1>'+
      '<p class="lv-sub">O nome aparece em toda a história e na música.</p>'+
      '<div class="lv-campo"><label for="lvNome">Nome da criança</label><input type="text" id="lvNome" maxlength="30" autocomplete="off" placeholder="Ex.: Valentina" value="'+esc(LV.nome)+'"></div>'+
      '<div class="lv-campo"><label>Idade</label><div class="lv-chips">'+
        '<button type="button" class="lv-chip larga'+(LV.idade===0?' on':'')+'" data-idade="0">Menos de 1 ano</button>'+
        [1,2,3,4,5,6,7,8].map(function(n){ return '<button type="button" class="lv-chip'+(LV.idade===n?' on':'')+'" data-idade="'+n+'">'+n+'</button>'; }).join('')+
        '<button type="button" class="lv-chip'+(LV.idade===9?' on':'')+'" data-idade="9">9</button>'+
        '<button type="button" class="lv-chip'+(LV.idade===10?' on':'')+'" data-idade="10">10+</button>'+
      '</div></div>'+meses+
      '<div class="lv-campo"><label>É menino ou menina?</label><div class="lv-chips dois">'+
        '<button type="button" class="lv-chip'+(LV.genero==='menino'?' on':'')+'" data-gen="menino">👦 Menino</button>'+
        '<button type="button" class="lv-chip'+(LV.genero==='menina'?' on':'')+'" data-gen="menina">👧 Menina</button></div></div>';
    pode=LV.nome.trim().length>=2 && LV.idade!==null && (LV.idade!==0 || LV.meses!==null) && !!LV.genero;
  } else {
    var nm=esc(LV.nome.trim().split(' ')[0]);
    corpo='<div class="lv-eb">a foto</div><h1 class="lv-tit">Agora a foto de '+nm+' 📸</h1>'+
      '<p class="lv-sub">Uma foto com o rostinho bem visível, de frente e com boa luz.</p>'+
      '<label class="lv-foto" for="lvArq">'+(LV.foto?'<img src="'+LV.foto+'" alt="Foto escolhida"><b>Trocar foto</b>':'<div class="ic">📷</div><b>Toque para escolher a foto</b><small>JPG ou PNG</small>')+'</label>'+
      '<input type="file" id="lvArq" accept="image/*" hidden>'+
      '<div class="lv-dica">💡<div>Fotos só de <b>'+nm+'</b>, sem boné nem óculos escuros, dão os melhores resultados.</div></div>'+
      '<div class="lv-campo"><label for="lvZap">WhatsApp pra receber o livro <span style="font-weight:500;color:#8a7a96">(opcional)</span></label><input type="tel" id="lvZap" inputmode="tel" placeholder="(11) 91234-5678" value="'+esc(LV.zap)+'"></div>'+
      '<label class="lv-aceite"><input type="checkbox" id="lvAceite"'+(LV.aceite?' checked':'')+'><span>Sou responsável pela criança e autorizo usar a foto só para criar este livro. A foto é apagada automaticamente depois.</span></label>'+
      '<div class="lv-erro" id="lvErro"></div>';
    pode=!!LV.foto && LV.aceite;
    btn='Criar a capa e a música ✨';
  }
  app.innerHTML='<div class="lv"><div class="lv-wrap">'+
    '<div class="lv-barra"><div class="tr"><i style="width:'+(((P+1)/total)*100)+'%"></i></div>'+
    '<button class="lv-voltar" id="lvVolta">← voltar</button></div>'+corpo+'</div>'+
    '<div class="lv-rodape"><button class="lv-btn rosa" id="lvProx"'+(pode?'':' disabled')+'>'+btn+'</button></div></div>';
  el('lvVolta').onclick=function(){ if(LV.passo>0){ LV.passo--; desenharPasso(); window.scrollTo(0,0);} else location.hash='#/livro'; };
  function atual(){ desenharPasso(); }
  app.querySelectorAll('[data-tema]').forEach(function(b){ b.onclick=function(){ LV.tema=b.dataset.tema; atual(); setTimeout(function(){ LV.passo=1; desenharPasso(); window.scrollTo(0,0); },350); }; });
  app.querySelectorAll('[data-idade]').forEach(function(b){ b.onclick=function(){ LV.idade=+b.dataset.idade; if(LV.idade!==0) LV.meses=null; atual(); }; });
  app.querySelectorAll('[data-meses]').forEach(function(b){ b.onclick=function(){ LV.meses=+b.dataset.meses; atual(); }; });
  app.querySelectorAll('[data-gen]').forEach(function(b){ b.onclick=function(){ LV.genero=b.dataset.gen; atual(); }; });
  var n=el('lvNome'); if(n) n.oninput=function(){ LV.nome=n.value; var ok=LV.nome.trim().length>=2 && LV.idade!==null && (LV.idade!==0||LV.meses!==null) && !!LV.genero; el('lvProx').disabled=!ok; };
  var z=el('lvZap'); if(z) z.oninput=function(){ LV.zap=z.value; };
  var ac=el('lvAceite'); if(ac) ac.onchange=function(){ LV.aceite=ac.checked; el('lvProx').disabled=!(LV.foto&&LV.aceite); };
  var arq=el('lvArq'); if(arq) arq.onchange=function(){
    var f=arq.files&&arq.files[0]; if(!f) return;
    lerFoto(f).then(function(d){ LV.foto=d; desenharPasso(); }).catch(function(){ toast('Não consegui abrir essa foto. Tente outra.'); });
  };
  el('lvProx').onclick=function(){
    if(LV.passo<2){ LV.passo++; desenharPasso(); window.scrollTo(0,0); return; }
    enviarLivro();
  };
}
function lerFoto(f){
  return new Promise(function(ok,falha){
    var url=URL.createObjectURL(f), img=new Image();
    img.onload=function(){
      var M=1280, w=img.naturalWidth, h=img.naturalHeight, k=Math.min(1, M/Math.max(w,h));
      var c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg',.88));
    };
    img.onerror=function(){ URL.revokeObjectURL(url); falha(); };
    img.src=url;
  });
}
function enviarLivro(){
  var b=el('lvProx'); b.disabled=true; b.innerHTML='<span class="lv-giro"></span> Enviando…';
  fetch('/.netlify/functions/livro-previa',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({tema:LV.tema,nome:LV.nome.trim(),idade:LV.idade,idadeMeses:LV.meses,genero:LV.genero,foto:LV.foto,whatsapp:LV.zap,aparelho:lvAparelho(),codigo:LV.codigo})})
  .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
  .then(function(res){
    if(res.d && res.d.jaTem && !LV.codigo){ telaJaTemPrevia(lvGet()[0]||null, null); return; }
    if(!res.ok||!res.d.id){ el('lvErro').textContent=(res.d&&res.d.erro)||'Não consegui começar agora. Tente de novo.'; b.disabled=false; b.textContent='Tentar de novo'; return; }
    lvSalvar({id:res.d.id,t:res.d.token,nome:LV.nome.trim(),tema:LV.tema,em:Date.now()});
    try{ gaEvento('livro_previa',{tema:LV.tema}); fbEvento('Lead',{content_name:'livro'}); }catch(e){}
    LV={passo:0,tema:null,nome:'',idade:null,meses:null,genero:null,foto:null,zap:'',aceite:false,codigo:''};
    location.hash='#/livro/'+res.d.id;
  })
  .catch(function(){ el('lvErro').textContent='Sem conexão. Tente de novo.'; b.disabled=false; b.textContent='Tentar de novo'; });
}

/* --------------------------------------------- pedido: espera / prévia / livro */
function telaLivroPedido(id){
  var t=lvToken(id), app=el('app'), iv=null, msgIv=null, parado=false, ultimo=null, tela='';
  aoSair(function(){ parado=true; clearInterval(iv); clearInterval(msgIv); pararAudioLivro(); });
  app.innerHTML='<div class="lv-espera"><span class="lv-giro"></span></div>';
  function buscar(){
    return fetch('/.netlify/functions/livro-status?id='+id+'&t='+encodeURIComponent(t),{cache:'no-store'}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); });
  }
  function ciclo(){
    if(parado) return;
    buscar().then(function(res){
      if(parado) return;
      if(!res.ok){ app.innerHTML='<div class="lv-espera"><h2>Livro não encontrado</h2><p>Confira se o link está certinho.</p><a class="lv-btn" style="max-width:20rem" href="#/livro">Criar um livro</a></div>'; clearInterval(iv); return; }
      var d=res.d; ultimo=d;
      return lvTemas().then(function(){
        var tema=lvTema(d.tema)||{cores:['#FFE8B8','#F6B86B','#7BAE5A'],titulo:'{nome}',paginas:[]};
        if(d.pago && d.status==='pronto'){ clearInterval(iv); if(tela!=='livro'){ tela='livro'; abrirLeitor(d,tema,t); } return; }
        if(d.pago){ if(tela!=='gerando'){ tela='gerando'; desenharEspera(d,tema,true); } else atualizarEspera(d,true); return; }
        if(d.capa && d.musica){ clearInterval(iv); if(tela!=='previa'){ tela='previa'; desenharPrevia(d,tema,t); } return; }
        if(tela!=='espera'){ tela='espera'; desenharEspera(d,tema,false); } else atualizarEspera(d,false);
      });
    }).catch(function(){});
  }
  function desenharEspera(d,tema,pago){
    var voa=''; ['⭐','🦋','🎵','✨','💛','🌈','🎈', tema.emoji||'📖'].forEach(function(e,i){ voa+='<span style="left:'+(8+i*11.5)+'%;animation-delay:'+(i*.85)+'s">'+e+'</span>'; });
    var nome=esc(d.nome);
    app.innerHTML='<div class="lv-espera"><div class="lv-voando">'+voa+'</div>'+
      '<div class="lv-livrinho"><div class="esq"></div><div class="dir"></div><div class="folha"></div></div>'+
      '<h2>'+(pago?'Pagamento confirmado! 🎉':'Preparando a magia…')+'</h2><p id="lvMsg"></p>'+
      '<ul class="lv-check" id="lvCheck"></ul>'+
      '<p style="margin-top:1.2rem;font-size:.85rem;opacity:.75">'+(pago?'Pode deixar esta tela aberta. Se fechar, o livro continua sendo feito e fica salvo aqui.':'Leva uns 2 minutinhos. Pode deixar esta tela aberta.')+'</p>'+(pago?'':htmlZapLivro(d,t,true))+'</div>';
    var msgs = pago ? ['Ilustrando cada cena com '+nome+'…','Pintando os detalhes do cenário…','Caprichando nas cores…','Montando as páginas do livro…']
                    : ['Desenhando '+nome+' na capa…','Compondo a música de '+nome+'…','Escolhendo as cores da aventura…','Espalhando purpurina mágica…'];
    var k=0, m=el('lvMsg'); m.textContent=msgs[0];
    clearInterval(msgIv); msgIv=setInterval(function(){ var mm=el('lvMsg'); if(!mm) return; k=(k+1)%msgs.length; mm.textContent=msgs[k]; },3200);
    atualizarEspera(d,pago);
  }
  function atualizarEspera(d,pago){
    var c=el('lvCheck'); if(!c) return;
    function li(ok,txt){ return '<li><i>'+(ok?'✅':'<span class="lv-giro"></span>')+'</i>'+txt+'</li>'; }
    if(!pago) c.innerHTML=li(!!d.capa,'Capa com o rostinho de '+esc(d.nome))+li(!!d.musica,'Música com o nome '+esc(d.nome));
    else { var prontas=(d.paginas||[]).filter(Boolean).length, tot=(d.paginas||[]).length||5;
      c.innerHTML=li(prontas>=tot,'Ilustrações: '+prontas+' de '+tot)+li(true,'Textos da história')+li(true,'Música completa'); }
  }
  iv=setInterval(ciclo,4000); ciclo();
}

/* música (prévia de 70s antes de pagar; completa depois) */
var _lvAudio=null;
function tocarLivro(id,v){
  pararAudioLivro();
  _lvAudio=new Audio('/.netlify/functions/previa-musica?id='+encodeURIComponent(id)+'&v='+(v||1));
  _lvAudio.loop=true; _lvAudio.play().catch(function(){});
  return _lvAudio;
}
function pararAudioLivro(){ if(_lvAudio){ try{ _lvAudio.pause(); }catch(e){} _lvAudio=null; } }

function desenharPrevia(d,tema,t){
  var app=el('app'), titulo=flexTxt(tema.titulo,d.nome,d.genero);
  app.innerHTML='<div class="lv-prev"><div class="lv-wrap" style="padding-bottom:2rem">'+
    '<div class="lv-topo"><img src="'+MASCOTE+'" alt="">Livro Mágico</div>'+
    '<h1 class="lv-h">O livro de '+esc(d.nome)+' está pronto pra abrir ✨</h1>'+
    '<p class="sub">Toque na capa e escute a música de '+esc(d.nome)+'.</p>'+
    '<div class="lv-livro3d" id="lvCapaPrev">'+htmlCapa({img:d.capa,cores:tema.cores,emoji:tema.emoji,titulo:titulo,nome:d.nome,fs:Math.min(17,window.innerWidth/22),
      extra:'<button class="lv-abrir" id="lvAbrir" aria-label="Abrir o livro e tocar a música"><span>▶ Abrir o livro</span></button>'})+'</div>'+
    '<div id="lvDepois"></div>'+htmlZapLivro(d,t,false)+'</div></div>';
  el('lvAbrir').onclick=function(){
    tocarLivro(d.id,1);
    el('lvAbrir').remove();
    el('lvDepois').innerHTML='<div class="lv-tocando"><span class="lv-eq"><i></i><i></i><i></i></span> Tocando: a música de '+esc(d.nome)+' (prévia)</div>'+htmlDesbloquear(d,tema);
    ligarDesbloquear(d,tema,t);
    setTimeout(function(){ var x=el('lvDepois'); if(x) x.scrollIntoView({behavior:'smooth',block:'start'}); },250);
  };
}
function htmlDesbloquear(d,tema){
  var n=(tema.paginas||[]).length||5;
  return '<div class="lv-tranca">'+
    '<h3>🔓 Desbloqueie a história completa</h3>'+
    '<p class="sub2">As próximas páginas da aventura de '+esc(d.nome)+' estão esperando…</p>'+
    '<div class="lv-paginas-bloq"><div></div><div></div><div></div><div></div><div></div></div>'+
    '<ul class="lv-inclui">'+
      '<li>📖 <span><b>'+(n*2)+' páginas</b> de história, com <b>'+n+' ilustrações</b> com o rostinho de '+esc(d.nome)+'</span></li>'+
      '<li>🎵 <span><b>2 músicas completas</b> com o nome '+esc(d.nome)+', tocando enquanto lê</span></li>'+
      '<li>🖨️ <span><b>PDF em alta qualidade</b>: versão pra ler e versão pronta pra imprimir</span></li>'+
      '<li>💌 <span>Link pra mandar pros avós, padrinhos e toda a família</span></li>'+
    '</ul>'+
    '<div class="lv-preco"><strong>'+lvFmt(d.valor||37)+'</strong><small>pagamento único no Pix</small></div>'+
    '<div id="lvPix"></div>'+
    '<button class="lv-btn rosa" id="lvPagar">Desbloquear agora ✨</button></div>';
}
function ligarDesbloquear(d,tema,t){
  var bt=el('lvPagar'), relIv=null;
  aoSair(function(){ clearInterval(relIv); });
  bt.onclick=function(){
    bt.disabled=true; bt.innerHTML='<span class="lv-giro"></span> Gerando o Pix…';
    try{ fbEvento('InitiateCheckout',{value:d.valor||37,currency:'BRL',content_name:'livro'}); gaEvento('livro_checkout',{tema:d.tema}); }catch(e){}
    fetch('/.netlify/functions/livro-pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,t:t})})
      .then(function(r){ return r.json().then(function(x){ return {ok:r.ok,d:x}; }); })
      .then(function(res){
        if(res.d && res.d.pago){ location.reload(); return; }
        if(!res.ok||!res.d.payload){ toast((res.d&&res.d.erro)||'Não consegui gerar o Pix.'); bt.disabled=false; bt.textContent='Desbloquear agora ✨'; return; }
        bt.remove();
        var box=el('lvPix');
        box.innerHTML='<div class="lv-relogio">⏳ O Pix vale por <b id="lvRel">20:00</b></div>'+
          htmlPixLimpo(res.d.payload, res.d.valor, res.d.teste, {titulo:'Livro Mágico de '+d.nome, itens:['Livro completo com '+((tema.paginas||[]).length||5)+' ilustrações','2 músicas completas','PDF pra ler e pra imprimir']});
        var rod=box.querySelector('.pxc-rod'); if(rod) rod.textContent='O livro é liberado assim que o Pix for confirmado. A sua prévia continua salva se você fechar esta página.';
        var fim=res.d.expiraEm||(Date.now()+20*60000);
        relIv=setInterval(function(){
          var r=el('lvRel'); if(!r){ clearInterval(relIv); return; }
          var s=Math.max(0,Math.round((fim-Date.now())/1000));
          r.textContent=Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);
          if(s<=0){ clearInterval(relIv); r.parentNode.innerHTML='⌛ Este Pix expirou. <button class="lv-l-bt" style="background:#2A1B3D" id="lvNovoPix">Gerar outro Pix</button>';
            el('lvNovoPix').onclick=function(){ var dep=el('lvDepois'); dep.querySelector('.lv-tranca').outerHTML=htmlDesbloquear(d,tema); ligarDesbloquear(d,tema,t); }; }
        },1000);
        ligarPixLimpo(res.d.payload, d.id, function(x){
          try{ if(x && x.presente) gaCompraUnica(d.id, x.presente); }catch(e){}
          location.hash='#/livro/'+d.id;
        });
      })
      .catch(function(){ toast('Sem conexão.'); bt.disabled=false; bt.textContent='Desbloquear agora ✨'; });
  };
}

/* --------------------------------------------------------------- leitor */
function paginasDoLivro(d,tema){
  var n=(tema.paginas||[]).length, ps=[{t:'capa'},{t:'pertence'},{t:'rosto'}];
  for(var i=0;i<n;i++){ ps.push({t:'texto',i:i}); ps.push({t:'img',i:i}); }
  ps.push({t:'fim'}); ps.push({t:'musica'});
  while((ps.length+1)%4) ps.push({t:'branco'});
  ps.push({t:'contra'});
  return ps;
}
function htmlPagina(p,d,tema,num){
  var c=tema.cores||['#FFE8B8','#F6B86B','#7BAE5A'], nome=esc(d.nome), est='--cor2:'+c[2]+';';
  var fundo='<div class="fundo" style="background:radial-gradient(120% 70% at 50% 0%,#fff 0%,'+c[0]+' 75%)"></div>';
  if(p.t==='capa') return '<div class="lv-pag" style="'+est+'">'+htmlCapa({img:d.capa,cores:c,emoji:tema.emoji,titulo:flexTxt(tema.titulo,d.nome,d.genero),nome:d.nome,fsCss:'calc(var(--pw) * 0.058)'})+'</div>';
  if(p.t==='img'){ var u=(d.paginas||[])[p.i]; return '<div class="lv-pag'+(u?'':' carregando')+'" style="'+est+'">'+(u?'<img class="cheia" src="'+esc(u)+'" alt="Ilustração '+(p.i+1)+'">':'<span class="lv-giro" style="border-top-color:'+c[2]+'"></span>')+'</div>'; }
  if(p.t==='texto'){ var tx=((tema.paginas||[])[p.i]||{}).texto||''; return '<div class="lv-pag" style="'+est+'">'+fundo+'<span class="canto" style="top:5%;left:6%">'+(tema.emoji||'✨')+'</span><span class="canto" style="bottom:6%;right:7%">✨</span>'+
    '<div class="miolo"><div class="txt">'+esc(flexTxt(tx,d.nome,d.genero))+'</div></div><div class="num">'+num+'</div></div>'; }
  if(p.t==='pertence') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><img src="'+MASCOTE+'" alt="" style="width:34%;margin-bottom:6%"><div class="peq">Este livro pertence a</div><div class="script" style="margin:.15em 0">'+nome+'</div><div class="peq" style="margin-top:12%">com amor, ______________________</div></div></div>';
  if(p.t==='rosto') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div style="font-size:2.4em">'+(tema.emoji||'📖')+'</div><div class="grande" style="margin:.3em 0">'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</div><div class="peq">Uma aventura mágica criada especialmente para '+nome+'</div><div class="peq" style="margin-top:14%">Capivarinha Love · Livro Mágico</div></div></div>';
  if(p.t==='fim') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div class="script">Fim</div><div style="font-size:2em;margin:.3em 0">💛</div><div class="txt" style="font-size:.95em">'+nome+', que venham muitas outras aventuras!</div></div><div class="num">'+num+'</div></div>';
  if(p.t==='musica'){ var svg=''; try{ svg=QRCodeGen.toSVG(location.origin+'/#/livro/'+d.id,{ec:'M',quiet:1}); }catch(e){}
    return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div style="font-size:2em">🎵</div><div class="grande" style="font-size:1.5em;margin:.3em 0">A música de '+nome+'</div><div class="qr">'+svg+'</div><div class="peq" style="margin-top:6%">Aponte a câmera do celular pra ouvir a música e ler o livro com ela tocando.</div></div><div class="num">'+num+'</div></div>'; }
  if(p.t==='branco') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div class="peq">Espaço pra um desenho ou uma mensagem especial ✏️</div></div></div>';
  return '<div class="lv-pag" style="'+est+'"><div class="fundo" style="background:linear-gradient(160deg,'+c[1]+','+c[2]+')"></div><div class="miolo" style="color:#fff"><img src="'+MASCOTE+'" alt="" style="width:30%"><div class="grande" style="color:#fff;font-size:1.4em;margin-top:.4em">Capivarinha Love</div><div class="peq" style="opacity:.9">capivarinhalove.com.br</div></div></div>';
}
function abrirLeitor(d,tema,t){
  var ps=paginasDoLivro(d,tema), app=el('app'), musV=1, tocando=false;
  app.innerHTML='<div class="lv-leitor" id="lvLeitor">'+
    '<div class="lv-l-topo"><button class="lv-l-bt" id="lvSair" aria-label="Voltar">←</button><div class="t">'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</div>'+
      '<button class="lv-l-bt" id="lvMus">🎵 Tocar</button></div>'+
    '<div class="lv-l-palco" id="lvPalcoL"><button class="lv-l-seta ant" id="lvAnt" aria-label="Página anterior">‹</button><div class="lv-l-vista" id="lvVista"></div><button class="lv-l-seta prox" id="lvProx2" aria-label="Próxima página">›</button></div>'+
    '<div class="lv-l-baixo">'+
      '<button class="lv-l-bt" id="lvM1">Música 1</button><button class="lv-l-bt" id="lvM2"'+(d.musica2?'':' hidden')+'>Música 2</button>'+
      '<span class="lv-l-cont" id="lvCont"></span>'+
      '<button class="lv-l-bt" id="lvPdf">⬇️ PDF</button><button class="lv-l-bt" id="lvComp">💌 Enviar</button>'+
    '</div></div>';
  document.body.style.overflow='hidden';
  aoSair(function(){ document.body.style.overflow=''; });
  var vista=el('lvVista'), palco=el('lvPalcoL'), pos=0;
  function dupla(){ return window.innerWidth>window.innerHeight && window.innerWidth>=700; }
  function vistas(){
    if(!dupla()) return ps.map(function(p,i){ return [i]; });
    var v=[[0]]; for(var i=1;i<ps.length-1;i+=2) v.push([i,i+1]); v.push([ps.length-1]); return v;
  }
  function desenhar(dir){
    var vs=vistas(); pos=Math.max(0,Math.min(pos,vs.length-1));
    var ids=vs[pos], H=palco.clientHeight-16, W=palco.clientWidth-(dupla()?110:30);
    var pw=Math.floor(Math.min(H*0.75, W/(dupla()?2:1)));
    vista.style.setProperty('--pw',pw+'px');
    vista.className='lv-l-vista'+(ids.length>1?' dupla':'')+(dir?(dir>0?' anima-prox':' anima-ant'):'');
    vista.innerHTML=ids.map(function(i){ return htmlPagina(ps[i],d,tema,i+1); }).join('');
    el('lvCont').textContent=(pos+1)+' / '+vs.length;
    el('lvAnt').style.visibility=pos>0?'visible':'hidden';
    el('lvProx2').style.visibility=pos<vs.length-1?'visible':'hidden';
  }
  function ir(dl){ var vs=vistas(); var n=Math.max(0,Math.min(pos+dl,vs.length-1)); if(n===pos) return; pos=n; desenhar(dl); if(!tocando && pos===1) alternarMusica(true); }
  el('lvAnt').onclick=function(){ ir(-1); }; el('lvProx2').onclick=function(){ ir(1); };
  vista.onclick=function(e){ var r=vista.getBoundingClientRect(); ir(e.clientX<r.left+r.width/2?-1:1); };
  var x0=null; palco.addEventListener('touchstart',function(e){ x0=e.touches[0].clientX; },{passive:true});
  palco.addEventListener('touchend',function(e){ if(x0==null) return; var dx=e.changedTouches[0].clientX-x0; if(Math.abs(dx)>40) ir(dx<0?1:-1); x0=null; },{passive:true});
  function tecla(e){ if(e.key==='ArrowRight') ir(1); if(e.key==='ArrowLeft') ir(-1); }
  document.addEventListener('keydown',tecla); aoSair(function(){ document.removeEventListener('keydown',tecla); });
  var rz=function(){ var antes=vistas().length; desenhar(0); }; window.addEventListener('resize',rz); aoSair(function(){ window.removeEventListener('resize',rz); });
  function marcar(){ el('lvMus').textContent=tocando?'⏸ Pausar':'🎵 Tocar'; el('lvM1').classList.toggle('on',musV===1); el('lvM2').classList.toggle('on',musV===2); }
  function alternarMusica(ligar){
    if(ligar===undefined) ligar=!tocando;
    if(ligar){ if(_lvAudio){ _lvAudio.play().catch(function(){}); } else tocarLivro(d.id,musV); tocando=true; }
    else { if(_lvAudio) _lvAudio.pause(); tocando=false; }
    marcar();
  }
  el('lvMus').onclick=function(){ alternarMusica(); };
  el('lvM1').onclick=function(){ musV=1; pararAudioLivro(); tocarLivro(d.id,1); tocando=true; marcar(); };
  el('lvM2').onclick=function(){ musV=2; pararAudioLivro(); tocarLivro(d.id,2); tocando=true; marcar(); };
  el('lvSair').onclick=function(){ pararAudioLivro(); location.hash='#/livro'; };
  el('lvComp').onclick=function(){
    var link=location.origin+'/#/livro/'+d.id, msg='Olha o livro mágico de '+d.nome+' 📖✨ '+link;
    if(navigator.share){ navigator.share({title:'Livro Mágico de '+d.nome, text:msg}).catch(function(){}); }
    else copiar(link,'Link do livro copiado!');
  };
  el('lvPdf').onclick=function(){ abrirModalPdf(d,tema,ps); };
  desenhar(0); marcar();
}

/* ------------------------------------------------------------------ PDF */
var _jspdf=null;
function carregarJsPDF(){
  if(window.jspdf) return Promise.resolve(window.jspdf);
  if(_jspdf) return _jspdf;
  _jspdf=new Promise(function(ok,falha){ var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload=function(){ ok(window.jspdf); }; s.onerror=function(){ _jspdf=null; falha(); }; document.head.appendChild(s); });
  return _jspdf;
}
function abrirModalPdf(d,tema,ps){
  var m=document.createElement('div'); m.className='lv-modal';
  m.innerHTML='<div><h3>📥 Baixar o livro em PDF</h3><p style="color:#6E5C82;margin:.2rem 0 .6rem;font-size:.92rem">Alta qualidade, pronto pra guardar ou imprimir.</p>'+
    '<button class="lv-btn" data-pdf="ler">📱 PDF pra ler (página por página)</button>'+
    '<button class="lv-btn claro" data-pdf="aberto">🖨️ Pra imprimir: folhas abertas (mais fácil)</button>'+
    '<button class="lv-btn claro" data-pdf="livreto">📖 Pra imprimir: livreto dobrável</button>'+
    '<div id="lvPdfProg" hidden><div class="lv-prog"><i id="lvPdfBar"></i></div><small id="lvPdfTxt">Preparando…</small></div>'+
    '<details style="margin-top:1rem"><summary style="font-weight:700;cursor:pointer">Como imprimir</summary><ol>'+
      '<li><b>Folhas abertas:</b> cada folha A4 deitada é uma página dupla do livro. Imprima só a frente, empilhe na ordem e grampeie do lado esquerdo.</li>'+
      '<li><b>Livreto dobrável:</b> imprima em <b>frente e verso</b>, escolhendo <b>"virar pela borda curta"</b>. Depois empilhe as folhas na ordem, dobre ao meio e grampeie na dobra. Vira um livrinho de verdade!</li>'+
      '<li>Use papel A4 <b>couchê ou fotográfico de 150 a 180 g</b> pra cores mais vivas. Qualquer gráfica rápida imprime.</li>'+
      '<li>Na impressora, marque <b>"tamanho real"</b> ou <b>"100%"</b> (não "ajustar à página").</li></ol></details>'+
    '<button class="lv-btn claro" id="lvPdfFechar" style="margin-top:.8rem">Fechar</button></div>';
  document.body.appendChild(m);
  function fechar(){ m.remove(); }
  el('lvPdfFechar').onclick=fechar; m.onclick=function(e){ if(e.target===m) fechar(); };
  m.querySelectorAll('[data-pdf]').forEach(function(b){ b.onclick=function(){
    m.querySelectorAll('[data-pdf]').forEach(function(x){ x.disabled=true; });
    el('lvPdfProg').hidden=false;
    gerarPdf(b.dataset.pdf,d,tema,ps,function(f,txt){ el('lvPdfBar').style.width=Math.round(f*100)+'%'; el('lvPdfTxt').textContent=txt; })
      .then(function(){ el('lvPdfTxt').textContent='Pronto! Confira seus downloads. ✅'; m.querySelectorAll('[data-pdf]').forEach(function(x){ x.disabled=false; }); })
      .catch(function(e){ console.error(e); el('lvPdfTxt').textContent='Não consegui montar o PDF. Tente de novo (de preferência no navegador, não dentro do Instagram).'; m.querySelectorAll('[data-pdf]').forEach(function(x){ x.disabled=false; }); });
  }; });
}
function carregarImg(src){ return new Promise(function(ok,falha){ var i=new Image(); i.onload=function(){ ok(i); }; i.onerror=falha; i.src=src; }); }
function cobrir(ctx,img,x,y,w,h){ var k=Math.max(w/img.naturalWidth,h/img.naturalHeight), iw=img.naturalWidth*k, ih=img.naturalHeight*k; ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih); ctx.restore(); }
function quebrar(ctx,txt,maxW){
  var pal=String(txt).split(/\s+/), linhas=[], l='';
  pal.forEach(function(p){ var t=l?l+' '+p:p; if(ctx.measureText(t).width>maxW && l){ linhas.push(l); l=p; } else l=t; });
  if(l) linhas.push(l); return linhas;
}
function textoCentro(ctx,txt,cx,y,maxW,fonte,cor,lh){
  ctx.font=fonte; ctx.fillStyle=cor; ctx.textAlign='center'; ctx.textBaseline='top';
  var ls=quebrar(ctx,txt,maxW); ls.forEach(function(l,i){ ctx.fillText(l,cx,y+i*lh); }); return ls.length*lh;
}
function fundoTexto(ctx,W,H,c){ var g=ctx.createRadialGradient(W/2,0,W*.05,W/2,H*.2,H*.95); g.addColorStop(0,'#ffffff'); g.addColorStop(1,c[0]); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
var _imgCache={};
function img(src){ if(!_imgCache[src]) _imgCache[src]=carregarImg(src); return _imgCache[src]; }
async function desenharPaginaCanvas(p,d,tema,num,W,H){
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
  var c=tema.cores||['#FFE8B8','#F6B86B','#7BAE5A'], u=W/100, nome=d.nome;
  ctx.fillStyle='#FFF8EF'; ctx.fillRect(0,0,W,H);
  if(p.t==='capa'||p.t==='img'){
    var src=p.t==='capa'?d.capa:(d.paginas||[])[p.i];
    if(src){ try{ cobrir(ctx,await img(src),0,0,W,H); }catch(e){} }
    if(p.t==='capa'){
      var tit=flexTxt(tema.titulo,nome,d.genero), resto=tit.indexOf(nome)===0?tit.slice(nome.length).replace(/^[,\s]+/,''):tit;
      var g=ctx.createLinearGradient(0,0,0,H*.32); g.addColorStop(0,'rgba(30,15,40,.38)'); g.addColorStop(1,'rgba(30,15,40,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*.32);
      ctx.textAlign='center'; ctx.textBaseline='top'; ctx.lineJoin='round';
      var y=H*.05;
      function linha(t,tam,cor){ ctx.font='800 '+tam+'px "Baloo 2"'; quebrar(ctx,t,W*.86).forEach(function(l){ ctx.lineWidth=tam*.16; ctx.strokeStyle='rgba(70,25,45,.75)'; ctx.strokeText(l,W/2,y); ctx.fillStyle=cor; ctx.fillText(l,W/2,y); y+=tam*1.0; }); }
      if(tit.indexOf(nome)===0){ linha(nome,u*12,'#FFE6A6'); linha(resto,u*7,'#FFFFFF'); } else linha(tit,u*8,'#FFFFFF');
      ctx.font='700 '+(u*2.6)+'px Inter'; ctx.fillStyle='rgba(255,255,255,.85)'; ctx.textAlign='right'; ctx.fillText('Capivarinha Love',W*.95,H*.955);
    }
    return cv;
  }
  if(p.t==='contra'){
    var gg=ctx.createLinearGradient(0,0,W,H); gg.addColorStop(0,c[1]); gg.addColorStop(1,c[2]); ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);
    try{ var m=await img(MASCOTE); ctx.drawImage(m,W*.35,H*.33,W*.3,W*.3*m.naturalHeight/m.naturalWidth); }catch(e){}
    textoCentro(ctx,'Capivarinha Love',W/2,H*.62,W*.8,'800 '+(u*7)+'px "Baloo 2"','#fff',u*8);
    textoCentro(ctx,'capivarinhalove.com.br',W/2,H*.7,W*.8,'600 '+(u*3.4)+'px Inter','rgba(255,255,255,.9)',u*4);
    return cv;
  }
  fundoTexto(ctx,W,H,c);
  if(p.t==='texto'){
    var tx=flexTxt(((tema.paginas||[])[p.i]||{}).texto||'',nome,d.genero);
    ctx.font=(u*8)+'px serif'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(tema.emoji||'✨',W*.06,H*.04);
    ctx.textAlign='right'; ctx.fillText('✨',W*.94,H*.88);
    var tam=u*5.6, lh=tam*1.5; ctx.font='600 '+tam+'px "Baloo 2"';
    var ls=quebrar(ctx,tx,W*.78); while(ls.length*lh>H*.72 && tam>u*3.6){ tam-=u*.2; lh=tam*1.5; ctx.font='600 '+tam+'px "Baloo 2"'; ls=quebrar(ctx,tx,W*.78); }
    var y0=(H-ls.length*lh)/2; ctx.fillStyle='#2A1B3D'; ctx.textAlign='left'; ctx.textBaseline='top';
    ls.forEach(function(l,i){ ctx.fillText(l,W*.11,y0+i*lh); });
  } else if(p.t==='pertence'){
    try{ var m2=await img(MASCOTE); var mw=W*.34; ctx.drawImage(m2,(W-mw)/2,H*.2,mw,mw*m2.naturalHeight/m2.naturalWidth); }catch(e){}
    textoCentro(ctx,'Este livro pertence a',W/2,H*.5,W*.8,'600 '+(u*4.4)+'px "Baloo 2"','#6E5C82',u*5);
    textoCentro(ctx,nome,W/2,H*.56,W*.86,(u*15)+'px "Grand Hotel"',c[2],u*15);
    textoCentro(ctx,'com amor, ______________________',W/2,H*.8,W*.86,'500 '+(u*3.6)+'px Inter','#6E5C82',u*4);
  } else if(p.t==='rosto'){
    ctx.font=(u*16)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(tema.emoji||'📖',W/2,H*.22);
    var hh=textoCentro(ctx,flexTxt(tema.titulo,nome,d.genero),W/2,H*.42,W*.8,'800 '+(u*9)+'px "Baloo 2"',c[2],u*9.5);
    textoCentro(ctx,'Uma aventura mágica criada especialmente para '+nome,W/2,H*.44+hh,W*.75,'500 '+(u*3.8)+'px Inter','#6E5C82',u*5);
    textoCentro(ctx,'Capivarinha Love · Livro Mágico',W/2,H*.86,W*.8,'600 '+(u*3.2)+'px Inter','#6E5C82',u*4);
  } else if(p.t==='fim'){
    textoCentro(ctx,'Fim',W/2,H*.3,W*.8,(u*24)+'px "Grand Hotel"',c[2],u*24);
    ctx.font=(u*12)+'px serif'; ctx.textAlign='center'; ctx.fillText('💛',W/2,H*.52);
    textoCentro(ctx,nome+', que venham muitas outras aventuras!',W/2,H*.68,W*.75,'600 '+(u*5)+'px "Baloo 2"','#2A1B3D',u*6.5);
  } else if(p.t==='musica'){
    textoCentro(ctx,'🎵',W/2,H*.12,W*.8,(u*12)+'px serif','#000',u*12);
    textoCentro(ctx,'A música de '+nome,W/2,H*.27,W*.8,'800 '+(u*7.5)+'px "Baloo 2"',c[2],u*8);
    try{ var svg=QRCodeGen.toSVG(location.origin+'/#/livro/'+d.id,{ec:'M',quiet:1}); var q=await carregarImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
      var qs=W*.46; ctx.fillStyle='#fff'; ctx.fillRect((W-qs)/2-u*2,H*.42-u*2,qs+u*4,qs+u*4); ctx.drawImage(q,(W-qs)/2,H*.42,qs,qs); }catch(e){}
    textoCentro(ctx,'Aponte a câmera do celular pra ouvir a música e ler o livro com ela tocando.',W/2,H*.8,W*.72,'500 '+(u*3.6)+'px Inter','#6E5C82',u*4.6);
  } else if(p.t==='branco'){
    textoCentro(ctx,'Espaço pra um desenho ou uma mensagem especial ✏️',W/2,H*.47,W*.7,'500 '+(u*3.8)+'px Inter','#9C8BAE',u*5);
  }
  if(num && p.t!=='pertence' && p.t!=='rosto' && p.t!=='branco'){ ctx.font='700 '+(u*2.6)+'px Inter'; ctx.fillStyle='rgba(42,27,61,.45)'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(String(num),W/2,H*.965); }
  return cv;
}
async function gerarPdf(modo,d,tema,ps,prog){
  var lib=await carregarJsPDF(); var jsPDF=lib.jsPDF;
  try{ await Promise.all(['600 40px "Baloo 2"','800 40px "Baloo 2"','40px "Grand Hotel"','600 20px Inter'].map(function(f){ return document.fonts.load(f); })); }catch(e){}
  var nome='Livro-Magico-'+String(d.nome).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-');
  var N=ps.length;
  if(modo==='ler'){
    var doc=new jsPDF({orientation:'p',unit:'mm',format:[150,200],compress:true});
    for(var i=0;i<N;i++){
      prog(i/N,'Montando a página '+(i+1)+' de '+N+'…');
      var cv=await desenharPaginaCanvas(ps[i],d,tema,i+1,1500,2000);
      if(i>0) doc.addPage([150,200],'p');
      doc.addImage(cv.toDataURL('image/jpeg',.9),'JPEG',0,0,150,200,undefined,'FAST');
    }
    prog(1,'Salvando…'); doc.save(nome+'.pdf'); return;
  }
  // A4 deitado = 2 páginas A5 (148,5 × 210 mm), 300 dpi
  var folhas=[];
  if(modo==='aberto'){ folhas.push([N-1,0]); for(var a=1;a<N-1;a+=2) folhas.push([a,a+1]); }
  else { for(var s=0;s<N/4;s++){ folhas.push([N-1-2*s, 2*s]); folhas.push([2*s+1, N-2-2*s]); } }
  var doc2=new jsPDF({orientation:'l',unit:'mm',format:'a4',compress:true}), feitas=0, total=folhas.length*2;
  for(var f=0;f<folhas.length;f++){
    if(f>0) doc2.addPage('a4','l');
    for(var lado=0;lado<2;lado++){
      var idx=folhas[f][lado]; prog(feitas/total,'Montando a página '+(feitas+1)+' de '+total+'…'); feitas++;
      var cv2=await desenharPaginaCanvas(ps[idx],d,tema,idx+1,1754,2480);
      doc2.addImage(cv2.toDataURL('image/jpeg',.92),'JPEG',lado*148.5,0,148.5,210,undefined,'FAST');
    }
  }
  prog(1,'Salvando…'); doc2.save(nome+(modo==='livreto'?'-livreto':'-folhas')+'.pdf');
}

window._lvTeste={desenharPaginaCanvas:function(){ return desenharPaginaCanvas.apply(null,arguments); }, paginasDoLivro:paginasDoLivro};
/* ------------------------------------------------------- painel: histórias */
var _lvp={temas:null, ed:null, ocupado:false};
window.pnlLivrosHtml=function(){ return '<div class="lvp" id="lvpCaixa"><div class="pnl-nota">Carregando as histórias…</div></div>'; };
window.pnlLivrosLigar=function(){
  if(_lvp.temas){ desenharLvp(); return; }
  fetch('/.netlify/functions/livro-temas?admin=1',{headers:{'x-admin-key':_pnlChave}}).then(function(r){ return r.json(); }).then(function(d){
    if(!d.temas){ lvpPedirSenha(!!_pnlChave); return; }
    _lvp.temas=d.temas; desenharLvp();
  }).catch(function(){ var c=el('lvpCaixa'); if(c) c.innerHTML='<div class="pnl-nota">Sem conexão.</div>'; });
};
function lvpPedirSenha(errou){
  var c=el('lvpCaixa'); if(!c) return;
  c.innerHTML='<div class="pnl-nota">🔒 Pra criar e aprovar as histórias, digite a <b>senha de administrador</b> (a mesma de cancelar ou marcar pedido como pago). Só precisa uma vez neste aparelho.'+
    (errou?'<br><b style="color:#ff8a8a">Senha incorreta, tenta de novo.</b>':'')+'</div>'+
    '<div style="display:flex;gap:.5rem;margin-top:.7rem"><input id="lvpSenha" type="password" autocomplete="current-password" placeholder="Senha" style="flex:1;min-width:0;padding:.75rem .9rem;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:inherit;font-size:1rem">'+
    '<button class="pnl-att" id="lvpEntrar">Entrar</button></div>';
  function ir(){ var k=(el('lvpSenha').value||'').trim(); if(!k) return; _pnlChave=k; try{ Store.set('cl_admin_key',k); }catch(e){} _lvp.temas=null; c.innerHTML='<div class="pnl-nota">Carregando as histórias…</div>'; window.pnlLivrosLigar(); }
  el('lvpEntrar').onclick=ir;
  el('lvpSenha').onkeydown=function(e){ if(e.key==='Enter') ir(); };
}
function lvpPost(corpo){ return fetch('/.netlify/functions/livro-temas',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':_pnlChave},body:JSON.stringify(corpo)}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); }); }
function desenharLvp(){
  var c=el('lvpCaixa'); if(!c) return;
  if(_lvp.ed!=null) return desenharEditor();
  c.innerHTML='<div class="pnl-nota">📚 <b>Livro Mágico</b>: crie e aprove as histórias. Só as <b>publicadas</b> aparecem no site. Link da página de venda: <b>'+esc(location.origin)+'/#/livro</b> <button class="pnl-link" id="lvpCop">Copiar</button></div>'+
    (_lvp.temas||[]).map(function(t,i){
      var img=t.vitrineEm?'<img src="/.netlify/functions/livro-img?k='+encodeURIComponent('img/tema/'+t.id)+'&v='+t.vitrineEm+'" alt="">':'<div class="sem">'+esc(t.emoji||'📖')+'</div>';
      return '<div class="lvp-it">'+img+'<div class="tx"><b>'+esc((t.emoji||'')+' '+t.nome)+'</b><small>'+esc(t.titulo)+'</small><br>'+
        '<span class="lvp-st '+(t.status==='publicado'?'pub':'ras')+'">'+(t.status==='publicado'?'Publicada':'Rascunho')+'</span></div>'+
        '<button class="pnl-link" data-lvped="'+i+'">Editar</button></div>';
    }).join('')+
    '<div class="lvp-it" style="display:block"><b>🎟️ Liberar mais uma prévia pra um cliente</b><p style="margin:.3rem 0 .2rem;font-size:.85rem;color:#666">Cada pessoa tem 1 prévia grátis. Se um cliente pedir outra no suporte, gere um código (vale 1 vez) e mande pra ele.</p>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpCod">Gerar código</button><span id="lvpCodOut" style="font:800 1.1rem Inter;align-self:center"></span></div></div>'+
    '<div class="lvp-it" style="display:block"><b>✨ Nova história com IA</b><div class="lvp-ed"><label for="lvpIdeia">Descreva a ideia</label>'+
      '<textarea id="lvpIdeia" placeholder="Ex.: uma aventura no mundo dos dinossauros, com um dinossauro bebê que vira melhor amigo"></textarea></div>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpIA">Escrever com IA</button><button class="cl" id="lvpBranco">Criar em branco</button><button class="cl" id="lvpRest">Restaurar as 5 originais</button></div></div>';
  el('lvpCop').onclick=function(){ copiar(location.origin+'/#/livro','Link copiado!'); };
  el('lvpCod').onclick=function(){
    var b=el('lvpCod'); b.disabled=true;
    lvpPost({acao:'codigo'}).then(function(r){ b.disabled=false; if(!r.ok){ toast(r.d.erro||'Erro'); return; }
      el('lvpCodOut').textContent=r.d.codigo; copiar('Seu código pra criar uma nova prévia do Livro Mágico: '+r.d.codigo+'\nÉ só abrir '+location.origin+'/#/livro/criar e digitar o código. 💛','Código copiado com a mensagem pro cliente!'); });
  };
  c.querySelectorAll('[data-lvped]').forEach(function(b){ b.onclick=function(){ _lvp.ed=+b.dataset.lvped; desenharLvp(); }; });
  el('lvpBranco').onclick=function(){ _lvp.temas.push({id:'nova-'+Date.now().toString(36),emoji:'📖',status:'rascunho',ordem:_lvp.temas.length+1,nome:'Nova história',titulo:'{nome} e …',descricao:'',cores:['#FFE8F0','#E86A9E','#6B4BC4'],roupa:'',capa:'',paginas:[{},{},{},{},{}],letra:'',estiloMusica:"children's song, cheerful, catchy chorus, portuguese vocals"}); _lvp.ed=_lvp.temas.length-1; desenharLvp(); };
  el('lvpRest').onclick=function(){
    var b=el('lvpRest'); if(b.dataset.ok!=='1'){ b.dataset.ok='1'; b.textContent='Toque de novo pra confirmar (apaga as mudanças)'; return; }
    lvpPost({acao:'restaurar'}).then(function(r){ if(r.ok){ _lvp.temas=r.d.temas; toast('As 5 histórias originais foram restauradas.'); desenharLvp(); } else toast(r.d.erro||'Erro'); });
  };
  el('lvpIA').onclick=function(){
    var ideia=el('lvpIdeia').value.trim(); if(ideia.length<5){ toast('Descreva a ideia.'); return; }
    var b=el('lvpIA'); b.disabled=true; b.textContent='Escrevendo… (até 1 min)';
    lvpPost({acao:'rascunho',ideia:ideia}).then(function(r){
      b.disabled=false; b.textContent='Escrever com IA';
      if(!r.ok){ toast(r.d.erro||'Não deu certo.'); return; }
      var t=r.d.tema; t.ordem=_lvp.temas.length+1; while(_lvp.temas.some(function(x){ return x.id===t.id; })) t.id+='-2';
      _lvp.temas.push(t); _lvp.ed=_lvp.temas.length-1; desenharLvp(); toast('Rascunho pronto! Revise e publique.');
    }).catch(function(){ b.disabled=false; b.textContent='Escrever com IA'; toast('Sem conexão.'); });
  };
}
function desenharEditor(){
  var c=el('lvpCaixa'), t=_lvp.temas[_lvp.ed]; if(!t){ _lvp.ed=null; return desenharLvp(); }
  while((t.paginas||[]).length<5) (t.paginas=t.paginas||[]).push({texto:'',cena:''});
  function campo(id,lab,val,area,dica){ return '<label for="'+id+'">'+lab+'</label>'+(area?'<textarea id="'+id+'">'+esc(val||'')+'</textarea>':'<input id="'+id+'" value="'+esc(val||'')+'">')+(dica?'<small style="color:#888">'+dica+'</small>':''); }
  var img=t.vitrineEm?'<img src="/.netlify/functions/livro-img?k='+encodeURIComponent('img/tema/'+t.id)+'&v='+t.vitrineEm+'" alt="" style="width:120px;border-radius:8px;display:block;margin:.4rem 0">':'';
  c.innerHTML='<div class="lvp-it" style="display:block"><div class="lvp-bts" style="margin-top:0"><button class="cl" id="lvpVolta">← Voltar à lista</button></div>'+
    '<div class="lvp-ed">'+
      campo('lvpNome','Nome do tema',t.nome)+campo('lvpTit','Título da capa',t.titulo,false,'Use {nome} pro nome da criança e [o|a] pra palavras de menino/menina.')+
      campo('lvpEmo','Emoji',t.emoji)+campo('lvpDesc','Descrição (aparece na escolha)',t.descricao,true)+
      campo('lvpCores','3 cores (claro, médio, escuro)',(t.cores||[]).join(', '))+
      campo('lvpRoupa','Roupa da criança nas ilustrações (inglês)',t.roupa,true)+
      campo('lvpCapa','Cena da capa (inglês)',t.capa,true)+
      t.paginas.map(function(p,i){ return '<div class="lvp-cena"><b>Cena '+(i+1)+'</b>'+campo('lvpTx'+i,'Texto da página (português)',p.texto,true)+campo('lvpCe'+i,'O que aparece na ilustração (inglês)',p.cena,true)+'</div>'; }).join('')+
      campo('lvpLetra','Letra da música',t.letra,true,'Comece com "Era uma vez… {nome}". Use {nome} no refrão.')+
      campo('lvpEst','Estilo da música',t.estiloMusica)+
      campo('lvpOrd','Ordem na página',t.ordem)+
      '<label>Capa de vitrine (exemplo da página inicial)</label>'+img+
      '<div class="lvp-bts"><button class="cl" data-vit="menino">Gerar com menino</button><button class="cl" data-vit="menina">Gerar com menina</button></div>'+
    '</div>'+
    '<div class="lvp-bts"><button id="lvpSalvar">💾 Salvar</button>'+
      (t.status==='publicado'?'<button class="cl" id="lvpPub">Tirar do site</button>':'<button class="ouro" id="lvpPub">✅ Aprovar e publicar</button>')+
      '<button class="cl" id="lvpDel">Excluir</button></div></div>';
  function ler(){
    t.nome=el('lvpNome').value; t.titulo=el('lvpTit').value; t.emoji=el('lvpEmo').value; t.descricao=el('lvpDesc').value;
    t.cores=el('lvpCores').value.split(',').map(function(x){ return x.trim(); }).filter(Boolean).slice(0,3);
    t.roupa=el('lvpRoupa').value; t.capa=el('lvpCapa').value; t.letra=el('lvpLetra').value; t.estiloMusica=el('lvpEst').value; t.ordem=+el('lvpOrd').value||99;
    t.paginas=t.paginas.map(function(p,i){ return {texto:el('lvpTx'+i).value, cena:el('lvpCe'+i).value}; });
    if(!t.id || /^nova-/.test(t.id)) t.id=(t.nome||'tema').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||t.id;
  }
  function salvar(msg){
    ler();
    return lvpPost({acao:'salvar',temas:_lvp.temas}).then(function(r){
      if(!r.ok){ toast(r.d.erro||'Não salvou.'); return false; }
      _lvp.temas=r.d.temas; _lvTemas=null; toast(msg||'Salvo!'); return true;
    });
  }
  el('lvpVolta').onclick=function(){ _lvp.ed=null; desenharLvp(); };
  el('lvpSalvar').onclick=function(){ salvar().then(function(ok){ if(ok) desenharEditor(); }); };
  el('lvpPub').onclick=function(){ var pub=t.status!=='publicado'; t.status=pub?'publicado':'rascunho'; salvar(pub?'Publicada! Já aparece no site. ✅':'Tirada do site.').then(function(ok){ if(!ok) t.status=pub?'rascunho':'publicado'; desenharEditor(); }); };
  el('lvpDel').onclick=function(){ var nm=t.nome; _lvp.temas.splice(_lvp.ed,1); _lvp.ed=null; lvpPost({acao:'salvar',temas:_lvp.temas}).then(function(r){ if(r.ok){ _lvp.temas=r.d.temas; toast('"'+nm+'" excluída.'); } else toast(r.d.erro||'Erro'); desenharLvp(); }); };
  c.querySelectorAll('[data-vit]').forEach(function(b){ b.onclick=function(){
    salvar('Salvo. Gerando a capa…').then(function(ok){
      if(!ok) return;
      var bts=c.querySelectorAll('[data-vit]'); bts.forEach(function(x){ x.disabled=true; }); b.textContent='Gerando… (1 a 2 min)';
      lvpPost({acao:'vitrine',id:t.id,genero:b.dataset.vit}).then(function(r){
        if(!r.ok){ toast(r.d.erro||'Não deu.'); desenharEditor(); return; }
        var tent=0, iv=setInterval(function(){
          tent++; if(tent>60 || !el('lvpCaixa')){ clearInterval(iv); return; }
          lvpPost({acao:'vitrine-status',id:t.id}).then(function(s){
            if(!s.ok){ clearInterval(iv); toast(s.d.erro||'Falhou.'); desenharEditor(); return; }
            if(s.d.pronto){ clearInterval(iv); if(s.d.tema){ _lvp.temas[_lvp.ed]=s.d.tema; } toast('Capa de vitrine pronta! 🎨'); desenharEditor(); }
          });
        },5000);
      });
    });
  }; });
}
})();
