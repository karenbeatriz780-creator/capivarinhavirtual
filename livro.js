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
.lv-eb{font-family:'Grand Hotel',cursive;color:#C27612;font-size:1.5rem;line-height:1}
.lv-hero .lv-eb{color:#FFD27A}
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
.lv-hero{position:relative;overflow:hidden;color:#fff;padding:calc(1.2rem + env(safe-area-inset-top,0px)) 0 3rem;
  background:radial-gradient(70% 45% at 50% 22%,rgba(255,210,122,.22) 0%,rgba(255,210,122,0) 70%),radial-gradient(100% 70% at 50% 0%,#5A3796 0%,#2E1A58 48%,#170C2F 100%)}
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
.lv-hero .lv-h{color:#fff;font-size:clamp(2.1rem,9vw,2.75rem);text-align:center;margin:.5rem 0 .6rem;position:relative;z-index:2;text-shadow:0 4px 18px rgba(0,0,0,.35)}
.lv-hero .lv-h em{font-style:normal;color:#FFD27A}
.lv-hero p{text-align:center;color:#F3ECFF;font-size:1.06rem;line-height:1.6;margin:0 auto 1.3rem;max-width:25rem;position:relative;z-index:2}
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
.lv-sec h2{color:#24163A;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:1.8rem;line-height:1.08;margin:.3rem 0 1rem;text-wrap:balance}
.lv-passos{display:grid;gap:.7rem}
.lv-passo{display:flex;gap:.85rem;align-items:flex-start;background:#fff;border:1px solid var(--lv-borda);border-radius:18px;padding:.95rem;box-shadow:0 6px 18px rgba(42,27,61,.06)}
.lv-passo b{flex:none;width:2.2rem;height:2.2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#FFF0CC;font-size:1.15rem}
.lv-passo h4{margin:0 0 .15rem;font:800 1.02rem 'Baloo 2',sans-serif}
.lv-passo p{margin:0;font-size:.93rem;line-height:1.5;color:#5B4B70}
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
.lv-temas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}
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
/* recortar o rostinho */
.lv-rec{position:relative;width:min(84vw,320px);aspect-ratio:1;margin:.6rem auto .4rem;border-radius:22px;overflow:hidden;background:#1E1433;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.lv-rec img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none;pointer-events:none;-webkit-user-drag:none}
.lv-rec .mira{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,transparent 0 44%,rgba(30,20,51,.55) 44.4%)}
.lv-rec .mira:after{content:"";position:absolute;left:6%;top:6%;right:6%;bottom:6%;border:3px dashed rgba(255,230,166,.95);border-radius:50%}
.lv-rec-zoom{display:flex;align-items:center;gap:.6rem;margin:.5rem auto 0;max-width:320px;font-size:1.1rem}
.lv-rec-zoom input{flex:1;accent-color:#E23C7E}
/* quem vai junto na história */
.lv-junto{margin-top:1.4rem;background:#fff;border:1.5px solid var(--lv-borda);border-radius:20px;padding:1rem}
.lv-junto h4{font:800 1.15rem 'Baloo 2';margin:0}
.lv-junto>p{margin:.2rem 0 .8rem;color:var(--lv-suave);font-size:.88rem;line-height:1.45}
.lv-jt{display:flex;align-items:center;gap:.75rem;padding:.55rem;border:1.5px solid var(--lv-borda);border-radius:16px;margin-bottom:.5rem;background:var(--lv-creme)}
.lv-jt img{width:54px;height:54px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.12);flex:none}
.lv-jt div{flex:1;min-width:0}
.lv-jt b{display:block;font:800 1.05rem 'Baloo 2';line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lv-jt small{color:var(--lv-suave)}
.lv-jt button{background:none;border:0;font-size:1.05rem;padding:.4rem;cursor:pointer;color:var(--lv-suave)}
.lv-add{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;border:2.5px dashed #F4C35A;background:#FFF4DB;border-radius:16px;padding:.9rem;font:800 1.02rem 'Baloo 2';color:var(--lv-tinta);cursor:pointer}
.lv-quem h5{font:800 .78rem 'Inter';letter-spacing:.06em;text-transform:uppercase;color:var(--lv-suave);margin:.9rem 0 .4rem}
.lv-quem .lv-chips{grid-template-columns:repeat(3,1fr)}
.lv-quem .lv-chip{font-size:.92rem;padding:.6rem .2rem}
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
.lv-vend{display:inline-block;font:800 .68rem 'Inter',sans-serif;color:#B4380A;background:#FFF1E0;border:1px solid #FFD8B0;padding:.18rem .5rem;border-radius:99px;margin:.45rem .15rem 0;line-height:1.3}
.lv-pacs{display:grid;gap:.55rem}
.lv-pac{display:flex;align-items:center;gap:.7rem;border:2px solid var(--lv-borda);background:#fff;border-radius:16px;padding:.75rem .85rem;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.lv-pac.on{border-color:#E23C7E;box-shadow:0 0 0 4px rgba(226,60,126,.14)}
.lv-pac input{accent-color:#E23C7E;width:18px;height:18px;flex:none;margin:0}
.lv-pac .tx{flex:1;min-width:0}
.lv-pac .tx b{display:block;font:800 1.05rem 'Baloo 2';line-height:1.15}
.lv-pac .tx b em{font:800 .66rem 'Inter';font-style:normal;text-transform:uppercase;letter-spacing:.03em;background:#FFE7F0;color:#C2185B;padding:.15rem .45rem;border-radius:99px;vertical-align:2px;margin-left:.2rem}
.lv-pac .tx small{color:#6E5C82;font-size:.82rem;line-height:1.3}
.lv-pac .vl{text-align:right;flex:none}
.lv-pac .vl s{display:block;color:#A99BB8;font-size:.78rem}
.lv-pac .vl b{font:800 1.2rem 'Baloo 2';color:#E23C7E}
.lv-t2{display:flex;gap:.55rem;overflow-x:auto;padding:.2rem .1rem .6rem}
.lv-t2b{flex:none;width:5.4rem;background:none;border:2px solid transparent;border-radius:12px;padding:.25rem;cursor:pointer;font:inherit;color:inherit}
.lv-t2b.on{border-color:#E23C7E;background:#FFF0F6}
.lv-t2b small{display:block;font:700 .7rem 'Inter';line-height:1.2;margin-top:.3rem}
.lv-t2{align-items:flex-start}
.lv-t2b .lv-livro3d{width:100%;box-shadow:-1px 0 0 #d9c49a,-3px 2px 0 #b99a5e,6px 8px 14px rgba(0,0,0,.25)}
.lv-t2b .lv-capa{width:100%;height:auto;aspect-ratio:3/4}
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
.lv-pag .canto{display:none}
.lv-pag .orn{display:flex;align-items:center;gap:.5em;width:42%;margin:.9em auto;color:var(--cor2)}
.lv-pag .orn:before,.lv-pag .orn:after{content:"";flex:1;height:1.5px;background:currentColor;opacity:.45}
.lv-pag .orn i{width:.42em;height:.42em;transform:rotate(45deg);background:currentColor;opacity:.75}
.lv-pag .moldura{width:46%;aspect-ratio:3/4;border-radius:3% 6% 6% 3%;overflow:hidden;box-shadow:0 .5em 1.4em rgba(42,27,61,.25),0 0 0 .3em #fff}
.lv-pag .moldura img{width:100%;height:100%;object-fit:cover;display:block}
.lv-pag .grande{font-family:'Baloo 2';font-weight:800;font-size:2.2em;line-height:1;color:var(--cor2)}
.lv-pag .script{font-family:'Grand Hotel',cursive;font-size:2.6em;line-height:1;color:var(--cor2)}
.lv-pag .nomeDono{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:2.3em;line-height:1.05;color:var(--cor2);margin:.15em 0;letter-spacing:.01em;text-wrap:balance}
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
.lvp-it,.lvp-it b,.lvp-it h4,.lvp-it label{color:#2A1B3D}
.lvp-it small{color:#7a6f86}
.lvp .pnl-link{color:#8A5A10;border-color:#E5C27A;background:#FFF6E0}
.lvp-ex .tx{color:#7a6f86}
.lvp-ex .tx b{color:#2A1B3D}
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
/* ---------- página nova ---------- */
.lv-foto3d{position:relative;aspect-ratio:3/4;width:100%;border-radius:16px;overflow:hidden;background:#2C1D4A;box-shadow:0 0 0 6px #fff,18px 26px 40px rgba(0,0,0,.45)}
.lv-foto3d img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lv-foto3d span{position:absolute;left:0;right:0;bottom:0;padding:1.6rem .8rem .7rem;font:800 .95rem 'Baloo 2';color:#fff;text-align:center;background:linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0))}
.lv-pontos{display:flex;justify-content:center;gap:.4rem;margin:.2rem 0 1rem;position:relative;z-index:2}
.lv-pontos i{width:7px;height:7px;border-radius:99px;background:rgba(255,255,255,.3);transition:all .3s}
.lv-pontos i.on{width:20px;background:var(--lv-ouro)}
.lv-musicas-faixa{display:flex;align-items:center;gap:.75rem;margin:0 auto 1.3rem;max-width:24rem;padding:.8rem 1rem;border-radius:18px;position:relative;z-index:2;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,210,122,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);text-align:left;backdrop-filter:blur(4px)}
.lv-musicas-faixa .ic{flex:none;width:2.6rem;height:2.6rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;background:linear-gradient(180deg,#FF8DB8,#E23C7E);box-shadow:0 6px 16px rgba(226,60,126,.45)}
.lv-musicas-faixa b{display:block;font:800 1.08rem 'Baloo 2';color:#FFD27A;line-height:1.1}
.lv-musicas-faixa small{color:#F3ECFF;font-size:.84rem;line-height:1.4}
.lv-meus-topo{display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;margin:.7rem 0 0;padding:.85rem;border-radius:16px;border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;font:800 1rem 'Baloo 2',sans-serif;cursor:pointer;position:relative;z-index:2}
.lv-link-ex{display:block;margin:.8rem auto 0;background:none;border:0;color:#FFE6A6;font:800 1rem 'Baloo 2';cursor:pointer;text-decoration:underline;text-underline-offset:4px;position:relative;z-index:2}
.lv-recebe{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
.lv-recebe>div{background:#fff;border:1px solid var(--lv-borda);border-radius:20px;padding:1rem .9rem;position:relative;overflow:hidden;box-shadow:0 6px 18px rgba(42,27,61,.06)}
.lv-recebe>div.mus{grid-column:span 2;background:linear-gradient(135deg,#FFF0F6,#FFF6E0);border-color:#FFD2E3}
.lv-recebe .ic{font-size:1.7rem;line-height:1}
.lv-recebe h4{margin:.45rem 0 .2rem;font:800 1.05rem 'Baloo 2';line-height:1.1}
.lv-recebe p{margin:0;color:#5B4B70;font-size:.88rem;line-height:1.5}
.lv-recebe .tag{position:absolute;top:.75rem;right:.75rem;font:800 .7rem 'Inter';padding:.25rem .55rem;border-radius:99px;background:#E23C7E;color:#fff}
.lv-aberto{position:relative;display:flex;justify-content:center;margin:.4rem auto 1rem;max-width:22rem;cursor:pointer;filter:drop-shadow(0 20px 30px rgba(42,27,61,.28))}
.lv-aberto>div{width:50%;aspect-ratio:3/4;overflow:hidden;background:#FFF8EF;position:relative}
.lv-aberto>div:first-child{border-radius:10px 2px 2px 10px}
.lv-aberto>div:last-child{border-radius:2px 10px 10px 2px}
.lv-aberto>div:first-child:after{content:"";position:absolute;right:0;top:0;bottom:0;width:14%;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.16))}
.lv-aberto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lv-aberto .tx{position:absolute;inset:12% 11%;font:600 .78rem/1.45 'Baloo 2';color:#2A1B3D;display:flex;align-items:center}
.lv-aberto .play{position:absolute;left:50%;bottom:-1.1rem;transform:translateX(-50%);z-index:3;white-space:nowrap;font:800 .95rem 'Baloo 2';color:#2A1B3D;background:linear-gradient(180deg,#FFE29A,#F4C35A);padding:.6rem 1.1rem;border-radius:99px;box-shadow:0 8px 20px rgba(0,0,0,.25)}
.lv-imp{display:grid;gap:.8rem}
.lv-imp>div{background:#fff;border:1px solid var(--lv-borda);border-radius:20px;padding:1rem}
.lv-imp h4{margin:0 0 .15rem;font:800 1.1rem 'Baloo 2'}
.lv-imp .sub3{color:var(--lv-suave);font-size:.86rem;margin:0 0 .7rem}
.lv-imp ol{margin:.6rem 0 0;padding-left:1.15rem;color:var(--lv-tinta);font-size:.9rem;line-height:1.55}
.lv-folha{display:flex;align-items:center;justify-content:center;gap:.7rem;padding:.7rem;background:#FAF5EE;border-radius:14px}
.lv-folha .a4{width:7.2rem;aspect-ratio:1.414/1;background:#fff;border:1.5px solid #E2D6C5;border-radius:4px;display:flex;padding:5px;gap:4px;box-shadow:0 4px 10px rgba(0,0,0,.06)}
.lv-folha .a4 i{flex:1;border-radius:2px;background:linear-gradient(160deg,#FFE29A,#FF8DB8)}
.lv-folha .a4 i+i{background:linear-gradient(160deg,#E9DDF7,#BFE3FF)}
.lv-folha .seta{font-size:1.2rem;color:#C98A12}
.lv-folha .dobra{width:3.6rem;aspect-ratio:1/1.414;background:linear-gradient(90deg,#FF8DB8 0 48%,#E2D6C5 48% 52%,#FFE29A 52%);border-radius:3px 6px 6px 3px;box-shadow:0 4px 10px rgba(0,0,0,.1)}
.lv-meus-bt{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;margin:1.2rem 0 0;padding:.95rem;border-radius:18px;border:2px dashed #D9C8EE;background:#fff;color:var(--lv-tinta);font:800 1.05rem 'Baloo 2';cursor:pointer}
.lv-ml{display:grid;gap:.7rem;margin-top:1rem}
.lv-ml a{display:flex;gap:.85rem;align-items:center;background:#fff;border:1px solid var(--lv-borda);border-radius:18px;padding:.7rem;color:inherit;text-decoration:none}
.lv-ml .cv{width:3.6rem;aspect-ratio:3/4;border-radius:4px 8px 8px 4px;overflow:hidden;flex:none;background:linear-gradient(160deg,#FFE29A,#FF8DB8);display:flex;align-items:center;justify-content:center;font-size:1.5rem}
.lv-ml .cv img{width:100%;height:100%;object-fit:cover}
.lv-ml b{display:block;font:800 1.05rem 'Baloo 2';line-height:1.1}
.lv-ml small{color:var(--lv-suave)}
.lv-ml .st{margin-left:auto;font:800 .75rem 'Inter';padding:.3rem .6rem;border-radius:99px;background:#DDF5E3;color:#1D7A3A;white-space:nowrap}
.lv-ml .st.pv{background:#FFE7F0;color:#C2185B}
.lv-vazio{text-align:center;background:#fff;border:1px solid var(--lv-borda);border-radius:20px;padding:1.4rem 1rem;margin-top:1rem}
.lv-vazio .ic{font-size:2.4rem}
.lv-folha-tema .lv-livro3d{width:min(46vw,170px);margin:.2rem auto 1rem}
.lv-folha-tema h3{text-align:center}
.lv-folha-tema .desc{text-align:center;color:var(--lv-suave);font-size:.92rem;margin:0 0 .9rem;line-height:1.45}
.lv-amostra{margin:0 0 1.4rem}
.lv-am-tit{font:800 1.15rem 'Baloo 2';text-align:center;margin:0 0 .8rem}
.lv-am-pags{display:grid;gap:.9rem}
.lv-am-pags .lv-pdfv-sp{max-width:min(100%,46rem)}
.lv-am-pags .lv-pdfv-sp.so{max-width:min(64%,20rem)}
.lv-am-fim{margin-top:1rem;background:rgba(255,255,255,.1);border:1px dashed rgba(255,210,122,.6);border-radius:16px;padding:.9rem 1rem;font-size:.92rem;line-height:1.45;text-align:center}
.lv-am-fim b:first-child{display:block;font:800 1.1rem 'Baloo 2';color:#FFD27A;margin-bottom:.2rem}
.lv-pdfv{position:fixed;inset:0;z-index:45;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(90% 50% at 50% 0%,#3A2560 0%,#22163A 60%,#160E26 100%);color:#fff}
.lv-pdfv-topo{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:.6rem;padding:calc(.6rem + env(safe-area-inset-top,0px)) .8rem .6rem;background:rgba(22,14,38,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.lv-pdfv-topo .t{flex:1;min-width:0;font:800 1rem 'Baloo 2';line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lv-pdfv-topo .t small{display:block;font:700 .68rem 'Inter';letter-spacing:.06em;text-transform:uppercase;color:var(--lv-ouro)}
.lv-pdfv-pags{max-width:62rem;margin:0 auto;padding:1rem max(12px,env(safe-area-inset-left,0px)) 7rem;display:grid;gap:1.1rem}
.lv-pdfv-sp{display:flex;justify-content:center;width:100%;max-width:calc((100vh - 10rem) * 1.5);margin:0 auto;filter:drop-shadow(0 14px 26px rgba(0,0,0,.45))}
.lv-pdfv-sp .lv-pdfv-pg{width:50%}
.lv-pdfv-sp .lv-pdfv-pg:first-child{border-radius:6px 0 0 6px}
.lv-pdfv-sp .lv-pdfv-pg:last-child{border-radius:0 6px 6px 0;position:relative}
.lv-pdfv-sp:not(.so) .lv-pdfv-pg:first-child{position:relative}
.lv-pdfv-sp:not(.so) .lv-pdfv-pg:first-child:after{content:"";position:absolute;right:0;top:0;bottom:0;width:10%;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.16))}
.lv-pdfv-sp:not(.so) .lv-pdfv-pg:last-child:after{content:"";position:absolute;left:0;top:0;bottom:0;width:10%;background:linear-gradient(270deg,rgba(0,0,0,0),rgba(0,0,0,.14))}
.lv-pdfv-sp.so .lv-pdfv-pg{border-radius:4px 10px 10px 4px}
.lv-pdfv-pg{aspect-ratio:3/4;overflow:hidden;background:#EFE6F6;display:flex;align-items:center;justify-content:center}
.lv-pdfv-pg img{width:100%;height:100%;display:block}
.lv-pdfv-rod{position:fixed;left:0;right:0;bottom:0;padding:.8rem max(16px,env(safe-area-inset-left,0px)) calc(.8rem + env(safe-area-inset-bottom,0px));background:linear-gradient(180deg,rgba(22,14,38,0),#160E26 40%)}
.lv-pdfv-rod .lv-btn{max-width:30rem;margin:0 auto}
.lv-demo-tag{position:absolute;top:calc(3.7rem + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:6;font:800 .72rem 'Inter';letter-spacing:.04em;text-transform:uppercase;padding:.3rem .7rem;border-radius:99px;background:rgba(244,195,90,.92);color:#2A1B3D}
.lvp-ex{display:flex;gap:.6rem;align-items:center;border-top:1px solid #f0ece6;padding:.55rem 0}
.lvp-ex img{width:46px;height:62px;border-radius:5px;object-fit:cover;flex:none;background:#eee}
.lvp-ex .tx{flex:1;min-width:0;font-size:.85rem}
.lvp-ex .tx b{display:block}
.lvp-ex button{border:0;border-radius:8px;padding:.4rem .55rem;font:700 .8rem 'Inter';cursor:pointer;background:#eee;color:#222}
.lvp-ex.off{opacity:.5}
#lvAdm button{background:#2A1B3D!important;color:#fff!important;border:0!important;border-radius:10px;padding:.45rem .7rem!important;font:700 .8rem Inter,sans-serif;cursor:pointer}
#lvAdm button:disabled{opacity:.5}
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
/* pacote: guarda os outros livros neste aparelho e mostra os links */
function mostrarPacote(d){
  var box=el('lvPacLista'), ls=(d&&d.pacote&&d.pacote.livros)||[]; if(!box||!ls.length) return;
  ls.forEach(function(x){ if(!lvToken(x.id)) lvSalvar({id:x.id,t:x.t,nome:d.nome,tema:x.tema,em:Date.now()}); });
  box.innerHTML='<div style="margin-top:1.2rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:.8rem 1rem;text-align:left;max-width:22rem;margin-left:auto;margin-right:auto">'+
    '<b>📚 '+(ls.length+1)+' livros no seu pacote</b><div style="font-size:.85rem;opacity:.85;margin:.2rem 0 .5rem">Os outros também estão sendo ilustrados. Ficam salvos em "Meus livros".</div>'+
    ls.map(function(x){ var tm=lvTema(x.tema)||{}; return '<a href="#/livro/'+esc(x.id)+'" style="display:block;color:#FFD27A;font-weight:700;margin:.25rem 0">'+esc((tm.emoji||'📖')+' '+(tm.nome||'Livro'))+' →</a>'; }).join('')+'</div>';
}
function htmlZapPago(d,t){
  if(!d||!t||!d.pago) return '';
  var num=(typeof ZAP_API!=='undefined'&&ZAP_API)||'5511924826268';
  var txt='Oi! Quero receber meu Livro Mágico de '+(d.nome||'')+' no WhatsApp 📖 (código L.'+d.id+'.'+t+')';
  return '<a class="lv-zap" target="_blank" rel="noopener" href="https://wa.me/'+num+'?text='+encodeURIComponent(txt)+'">📲 Receber tudo no WhatsApp</a>'+
    '<div class="lv-zap-dica">Toque, aperte <b>enviar</b> no WhatsApp e pode fechar: não precisa ficar esperando. A gente te manda o link do livro e os PDFs pra imprimir assim que ficar pronto.</div>';
}
function lvToken(id){ var x=lvGet().filter(function(o){ return o.id===id; })[0]; return x?x.t:''; }
function nIlusTema(t){ return ((t&&t.paginas)||[]).filter(function(p){ return !p.so; }).length||5; }
function nPagsTema(t){ var ps=(t&&t.paginas)||[]; return ps.length+ps.filter(function(p){ return !p.so; }).length||10; }
/* selo de vendidos (vendas do site + vendas de fora que você coloca no painel) */
function seloVendas(t,i){
  var n=(t&&t.vendidos)||0; if(n<1) return '';
  return '<span class="lv-vend">'+(i===0?'⭐ Mais vendido · ':'🔥 ')+n.toLocaleString('pt-BR')+' vendido'+(n===1?'':'s')+'</span>';
}
function lvFmt(v){ return 'R$ '+Number(v).toFixed(2).replace('.',','); }
var _lvTemas=null, _lvEx=[];
function lvTemas(){
  if(_lvTemas) return Promise.resolve(_lvTemas);
  return fetch('/.netlify/functions/livro-temas').then(function(r){ return r.json(); }).then(function(d){ _lvTemas=(d&&d.temas)||[]; _lvEx=(d&&d.exemplos)||[]; return _lvTemas; });
}
/* PÁGINA INICIAL: livros prontos pra vitrine (primeiro os exemplos reais do painel, depois as histórias) */
window.lvItensHome=function(){
  return lvTemas().then(function(ts){
    var mais=(ts[0]&&ts[0].vendidos>0)?ts[0].id:null, itens=[], usados={};
    /* "Crie sua própria história" sempre em primeiro */
    ts.forEach(function(t,i){ if(t.propria){ usados[t.id]=1; itens.push({capa:capaTema(t,i,6.4), titulo:'Crie sua própria história', sub:'Você conta, a gente escreve', ex:null, propria:true, selo:t.id===mais?'⭐ Mais vendido':'✨ Crie a sua'}); } });
    _lvEx.filter(function(x){ return x.tipo==='livro' && x.paginas && x.paginas.length; }).slice(0,8).forEach(function(ex){
      var t=lvTema(ex.tema)||{};
      usados[ex.tema]=1;
      itens.push({capa:htmlCapa({img:ex.capa,cores:t.cores,emoji:t.emoji,titulo:ex.titulo,nome:ex.nome,fs:6.4}), titulo:t.nome||ex.titulo, sub:'Exemplo: feito pra '+ex.nome, ex:ex.id, selo:ex.tema===mais?'⭐ Mais vendido':''});
    });
    ts.forEach(function(t,i){
      if(usados[t.id] || itens.length>=10) return;
      itens.push({capa:capaTema(t,i,6.4), titulo:t.nome, sub:t.propria?'Você conta, a gente escreve':'', ex:null, selo:t.id===mais?'⭐ Mais vendido':''});
    });
    return itens;
  });
};
window.lvAbrirExemplo=function(id){
  var ex=_lvEx.filter(function(x){ return x.id===id; })[0];
  if(ex) abrirExemplo(ex, function(){ location.hash='#/livro/criar'; }); else location.hash='#/livro';
};
/* livro de exemplo (pago, escolhido no painel): prefere o do mesmo tema */
function lvExLivro(tema){ var ls=_lvEx.filter(function(x){ return x.tipo==='livro' && x.paginas && x.paginas.length; }); return ls.filter(function(x){ return x.tema===tema; })[0]||ls[0]||null; }
function lvExDoTema(id){ return _lvEx.filter(function(x){ return x.tipo==='livro' && x.tema===id; })[0]||null; }
function capaTema(t,i,fs){
  if(t&&t.propria) return htmlCapa({img:t.vitrine,cores:t.cores,emoji:t.emoji,titulo:t.titulo||'Crie sua própria história',nome:'',fs:fs});
  var ex=lvExDoTema(t.id);
  if(ex) return htmlCapa({img:ex.capa,cores:t.cores,emoji:t.emoji,titulo:ex.titulo,nome:ex.nome,fs:fs});
  var gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][(i+1)%6];
  return htmlCapa({img:t.vitrine,cores:t.cores,emoji:t.emoji,titulo:flexTxt(t.titulo,nome,gen),nome:nome,fs:fs});
}
function abrirExemplo(ex, aoCriar){
  if(!ex) return;
  var base=lvTema(ex.tema)||{cores:['#FFE8B8','#F6B86B','#7BAE5A'],emoji:'📖'};
  var n=Math.min(ex.paginas.length, (ex.textos||[]).length||ex.paginas.length);
  var tema=Object.assign({}, base, {titulo:ex.titulo, paginas:ex.paginas.slice(0,n).map(function(u,i){ return u==='so'?{texto:(ex.textos||[])[i]||'',so:true}:{texto:(ex.textos||[])[i]||''}; })});
  var d={id:ex.pedido, nome:ex.nome, genero:ex.genero, tema:ex.tema, capa:ex.capa, paginas:ex.paginas.slice(0,n), musica:true, musica2:true, pago:true};
  try{ gaEvento('livro_exemplo',{tema:ex.tema}); }catch(e){}
  abrirPdfExemplo(d, tema, aoCriar);
}
/* exemplo do livro do jeito do PDF: uma página embaixo da outra, rolando */
function abrirPdfExemplo(d, tema, aoCriar){
  var ps=paginasDoLivro(d,tema).filter(function(p){ return p.t!=='branco'; });
  /* capa sozinha, depois de 2 em 2 (texto à esquerda, ilustração à direita), contracapa sozinha */
  var linhas=[[0]]; for(var k=1;k<ps.length-1;k+=2) linhas.push(k+1<ps.length-1?[k,k+1]:[k]); linhas.push([ps.length-1]);
  var box=document.createElement('div'); box.className='lv-pdfv';
  box.innerHTML='<div class="lv-pdfv-topo"><button class="lv-l-bt" id="lvPvX" aria-label="Fechar">←</button><div class="t"><small>Livro de exemplo</small>'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</div><button class="lv-l-bt" id="lvPvMus">🎵 Tocar</button></div>'+
    '<div class="lv-pdfv-pags">'+linhas.map(function(l){ return '<div class="lv-pdfv-sp'+(l.length===1?' so':'')+'">'+l.map(function(i){ return '<div class="lv-pdfv-pg" data-i="'+i+'"><span class="lv-giro"></span></div>'; }).join('')+'</div>'; }).join('')+'</div>'+
    '<div class="lv-pdfv-rod"><button class="lv-btn rosa" id="lvPvCriar">✨ Criar o livro do meu filho</button></div>';
  document.body.appendChild(box); document.body.style.overflow='hidden';
  var vivo=true, tocando=false;
  function fechar(){ vivo=false; pararAudioLivro(); document.body.style.overflow=''; if(box.parentNode) box.remove(); }
  aoSair(fechar);
  function marcar(){ el('lvPvMus').textContent=tocando?'⏸ Pausar':'🎵 Tocar'; }
  el('lvPvMus').onclick=function(){ if(tocando){ pararAudioLivro(); tocando=false; } else { tocarLivro(d.id,1); tocando=true; } marcar(); };
  el('lvPvX').onclick=fechar;
  el('lvPvCriar').onclick=function(){ fechar(); if(aoCriar) aoCriar(); };
  tocarLivro(d.id,1); tocando=true; marcar();
  var fontes=Promise.all(['600 40px "Baloo 2"','800 40px "Baloo 2"','40px "Grand Hotel"','600 20px Inter'].map(function(f){ return document.fonts.load(f).catch(function(){}); })).catch(function(){});
  fontes.then(async function(){
    for(var i=0;i<ps.length && vivo;i++){
      try{
        var cv=await desenharPaginaCanvas(ps[i],d,tema,i+1,900,1200);
        var slot=box.querySelector('[data-i="'+i+'"]'); if(!slot) return;
        var im=new Image(); im.alt='Página '+(i+1); im.src=cv.toDataURL('image/jpeg',.88); slot.innerHTML=''; slot.appendChild(im);
      }catch(e){ console.error(e); }
    }
  });
}
function lvTema(id){ return (_lvTemas||[]).filter(function(t){ return t.id===id; })[0]||null; }
/* história de um pedido: a escrita pela IA (Crie sua própria história) ou a do catálogo */
function temaDoPedido(d){ return (d&&d.temaProprio)||lvTema(d&&d.tema); }

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
    (o.extra||'')+'</div>';
}

/* --------------------------------------------------------------- roteador */
window.telaLivro=function(arg){
  document.title='Livro Mágico · Capivarinha Love';
  if(!arg) return telaLivroHome();
  if(arg==='criar') return telaLivroCriar();
  if(arg==='meus') return telaLivroMeus();
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
  app.innerHTML='<div class="lv">'+
    '<section class="lv-hero"><div class="lv-estrelas">'+estrelas+'</div>'+
      '<div class="lv-topo"><img src="'+MASCOTE+'" alt="">Capivarinha Love</div>'+
      '<div class="lv-palco" id="lvPalco"><div class="lv-brilho-chao"></div></div>'+
      '<div class="lv-pontos" id="lvPontos"></div>'+
      '<div class="lv-wrap" style="padding-bottom:0">'+
        '<div class="lv-eb" style="text-align:center">✨ Livro Mágico</div>'+
        '<h1 class="lv-h">Seu filho como <em>protagonista</em> da própria aventura</h1>'+
        '<p>Um livro ilustrado feito só pra ele: o <b style="color:#fff">rostinho</b> desenhado em cada aventura e o <b style="color:#fff">nome</b> em toda a história.</p>'+
        '<div class="lv-musicas-faixa"><span class="ic">🎵</span><div><b>+ 2 músicas com o nome dele</b><small>Tocam enquanto vocês leem juntos. Ele vai pedir de novo toda noite.</small></div></div>'+
        '<button class="lv-btn" id="lvCriar">Criar meu livro agora ✨</button>'+
        '<button class="lv-meus-topo" id="lvMeusTopo">📚 Meus livros</button>'+
        '<button class="lv-link-ex" id="lvVerEx" hidden>👀 Folhear um livro de exemplo</button>'+
      '</div></section>'+
    '<div class="lv-wrap">'+
      '<div class="lv-sec"><div class="lv-eb">o que vem no livro</div><h2>Um presente pra guardar pra sempre</h2><div class="lv-recebe">'+
        '<div><div class="ic">📖</div><h4>História ilustrada</h4><p>O rostinho da criança desenhado em cada cena da aventura.</p></div>'+
        '<div><div class="ic">✨</div><h4>O nome em tudo</h4><p>Na capa, em cada página e na dedicatória.</p></div>'+
        '<div class="mus"><span class="tag">2 músicas</span><div class="ic">🎵🎵</div><h4>2 músicas personalizadas com o nome</h4><p>Duas versões da música da história, cantando o nome da criança. Tocam enquanto vocês viram as páginas.</p></div>'+
        '<div><div class="ic">🖨️</div><h4>PDF pra imprimir</h4><p>Alta qualidade, em casa ou na gráfica.</p></div>'+
        '<div><div class="ic">💌</div><h4>Link pra família</h4><p>Pros avós e padrinhos lerem e ouvirem também.</p></div>'+
      '</div></div>'+
      '<div class="lv-sec" id="lvSecEx" hidden><div class="lv-eb">por dentro do livro</div><h2>Veja como fica de verdade</h2><div id="lvAberto"></div></div>'+
      '<div class="lv-sec"><div class="lv-eb">como funciona</div><h2>Pronto em poucos minutos, sem complicação</h2><div class="lv-passos">'+
        '<div class="lv-passo"><b>📚</b><div><h4>Escolha a aventura</h4><p>Fazenda, futebol, fundo do mar, espaço ou castelo encantado.</p></div></div>'+
        '<div class="lv-passo"><b>📸</b><div><h4>Conte quem é a criança</h4><p>Nome, idade e uma foto com o rostinho bem visível.</p></div></div>'+
        '<div class="lv-passo"><b>🎵</b><div><h4>Veja a capa e ouça a música</h4><p>A capa com o rosto dela e a música com o nome ficam prontas antes de você pagar.</p></div></div>'+
        '<div class="lv-passo"><b>🔓</b><div><h4>Desbloqueie o livro completo</h4><p>Todas as ilustrações, as 2 músicas completas e o PDF pra imprimir.</p></div></div>'+
      '</div></div>'+
      '<div class="lv-sec"><div class="lv-eb">as aventuras</div><h2>Qual aventura combina com ele?</h2><div class="lv-galeria" id="lvGal"></div></div>'+
      '<div class="lv-sec"><div class="lv-eb">como imprimir</div><h2>Do celular pro papel</h2><div class="lv-imp">'+
        '<div><h4>🖨️ Folhas abertas (mais fácil)</h4><p class="sub3">Cada folha A4 deitada vira uma página dupla do livro.</p>'+
          '<div class="lv-folha"><div class="a4"><i></i><i></i></div><span class="seta">→</span><div class="a4"><i></i><i></i></div></div>'+
          '<ol><li>No livro, toque em <b>⬇️ PDF</b> e escolha <b>"Folhas abertas"</b>.</li><li>Imprima <b>só a frente</b>, em A4 deitado.</li><li>Empilhe na ordem e grampeie do lado esquerdo.</li></ol></div>'+
        '<div><h4>📖 Livreto dobrável (fica um livrinho de verdade)</h4><p class="sub3">As folhas dobradas ao meio formam o livro.</p>'+
          '<div class="lv-folha"><div class="a4"><i></i><i></i></div><span class="seta">→ dobra →</span><div class="dobra"></div></div>'+
          '<ol><li>Escolha <b>"Livreto dobrável"</b> no PDF.</li><li>Imprima em <b>frente e verso</b>, marcando <b>"virar pela borda curta"</b>.</li><li>Empilhe as folhas, dobre ao meio e grampeie na dobra.</li></ol></div>'+
        '<div><h4>💡 Pra ficar lindo</h4><ol style="margin-top:.2rem"><li>Papel A4 <b>couchê ou fotográfico de 150 a 180 g</b>.</li><li>Na impressora, marque <b>"tamanho real"</b> ou <b>"100%"</b>.</li><li>Qualquer gráfica rápida imprime: é só levar o PDF.</li></ol></div>'+
      '</div></div>'+
      '<div class="lv-sec lv-faq"><div class="lv-eb">dúvidas</div><h2>Perguntas frequentes</h2>'+
        '<details><summary>Como a foto é usada?</summary><p>A foto serve só pra desenhar a criança no livro. Ela não aparece pra ninguém e é apagada automaticamente depois que o livro fica pronto.</p></details>'+
        '<details><summary>Quais são as 2 músicas?</summary><p>São duas versões da música da história, cantando o nome da criança. Você ouve uma prévia antes de pagar e as duas completas depois.</p></details>'+
        '<details><summary>Quanto tempo demora?</summary><p>A capa e a música ficam prontas em uns 2 minutos. Depois do pagamento, o livro completo fica pronto em poucos minutos.</p></details>'+
        '<details><summary>Funciona pra bebê?</summary><p>Sim. Escolha "menos de 1 ano" e os meses: as ilustrações mostram o bebê de um jeito fofo e seguro.</p></details>'+
      '</div>'+
      '<button class="lv-meus-bt" id="lvMeus">📚 Meus livros</button>'+
    '</div>'+
    '<div class="lv-rodape escondido" id="lvRod"><button class="lv-btn" id="lvCriar2">Criar meu livro agora ✨</button></div>'+
  '</div>';
  el('lvCriar').onclick=el('lvCriar2').onclick=function(){ location.hash='#/livro/criar'; };
  el('lvMeus').onclick=el('lvMeusTopo').onclick=function(){ location.hash='#/livro/meus'; };
  try{ var ob=new IntersectionObserver(function(es){ var r=el('lvRod'); if(r) r.classList.toggle('escondido', es[0].isIntersecting); }); ob.observe(el('lvCriar')); aoSair(function(){ ob.disconnect(); }); }catch(e){ el('lvRod').classList.remove('escondido'); }
  lvTemas().then(function(ts){
    if(!el('lvPalco')) return;
    var palco=el('lvPalco'), gal=el('lvGal'), fs=Math.min(16, palco.clientWidth/22);
    /* o que gira no topo: os exemplos escolhidos no painel; sem exemplo, as capas de vitrine dos temas */
    var itens=_lvEx.length ? _lvEx.map(function(x){
        if(x.tipo==='foto') return '<div class="lv-livro3d lv-foto-item" style="box-shadow:none"><div class="lv-foto3d"><img src="'+esc(x.capa)+'" alt="">'+(x.legenda?'<span>'+esc(x.legenda)+'</span>':'')+'</div></div>';
        var t=lvTema(x.tema)||{};
        return '<div class="lv-livro3d">'+htmlCapa({img:x.capa,cores:t.cores,emoji:t.emoji,titulo:x.titulo,nome:x.nome,fs:fs})+'</div>';
      }) : ts.map(function(t,i){
        return '<div class="lv-livro3d">'+capaTema(t,i,fs)+'</div>';
      });
    palco.insertAdjacentHTML('beforeend', itens.join(''));
    gal.innerHTML=ts.map(function(t,i){
      return '<div><div class="lv-livro3d">'+capaTema(t,i,7.4)+'</div><small>'+esc(t.emoji+' '+t.nome)+'</small>'+seloVendas(t,i)+'</div>';
    }).join('');
    /* livro de exemplo: botão no topo + livro aberto no meio da página */
    var ex=lvExLivro();
    if(ex){
      el('lvVerEx').hidden=false; el('lvVerEx').onclick=function(){ abrirExemplo(ex, function(){ location.hash='#/livro/criar'; }); };
      var i1=Math.max(0,ex.paginas.findIndex(function(u){ return u&&u!=='so'; })), tx=(ex.textos||[])[i1]||'';
      el('lvAberto').innerHTML='<div class="lv-aberto" id="lvAbertoBt" role="button" tabindex="0" aria-label="Folhear o livro de exemplo"><div><div class="tx">'+esc(tx)+'</div></div><div><img src="'+esc(ex.paginas[i1])+'" alt="Ilustração do livro de exemplo"></div><span class="play">📖 Folhear o livro de '+esc(ex.nome)+'</span></div>'+
        '<p style="text-align:center;color:var(--lv-suave);font-size:.88rem;margin:1.6rem 0 0">Um livro de verdade, feito aqui. Toque pra virar as páginas e ouvir a música.</p>';
      el('lvSecEx').hidden=false;
      el('lvAbertoBt').onclick=function(){ abrirExemplo(ex, function(){ location.hash='#/livro/criar'; }); };
    }
    var livros=palco.querySelectorAll('.lv-livro3d'), atual=0, pts=el('lvPontos');
    if(!livros.length) return;
    livros[0].classList.add('on');
    if(livros.length<2) return;
    pts.innerHTML=Array.prototype.map.call(livros,function(x,i){ return '<i'+(i===0?' class="on"':'')+'></i>'; }).join('');
    var iv=setInterval(function(){
      if(!el('lvPalco')){ clearInterval(iv); return; }
      var a=livros[atual]; a.classList.remove('on'); a.classList.add('sai');
      setTimeout(function(){ a.classList.remove('sai'); },700);
      atual=(atual+1)%livros.length; livros[atual].classList.add('on');
      var ps=pts.querySelectorAll('i'); ps.forEach(function(x,i){ x.classList.toggle('on', i===atual); });
    },2500);
    aoSair(function(){ clearInterval(iv); });
  }).catch(function(){});
}

/* ------------------------------------------------------- meus livros */
function telaLivroMeus(){
  var app=el('app'), locais=lvGet();
  function cartao(o){
    var t=lvTema(o.tema)||{}, cv=o.capa?'<img src="'+esc(o.capa)+'" alt="">':(t.emoji||'📖');
    return '<a href="#/livro/'+esc(o.id)+'" data-lvid="'+esc(o.id)+'" data-lvt="'+esc(o.t||'')+'"><div class="cv">'+cv+'</div><div><b>'+esc(o.nome?'Livro de '+o.nome:'Meu livro')+'</b><small>'+esc((t.emoji?t.emoji+' ':'')+(t.nome||'Livro Mágico'))+'</small></div>'+
      (o.pago!=null?'<span class="st'+(o.pago?'':' pv')+'">'+(o.pago?'✓ Desbloqueado':'Prévia')+'</span>':'')+'</a>';
  }
  app.innerHTML='<div class="lv"><div class="lv-wrap" style="padding-top:calc(1.2rem + env(safe-area-inset-top,0px))">'+
    '<button class="lv-voltar" id="lvMVolta">← voltar</button>'+
    '<div class="lv-eb">sua estante</div><h1 class="lv-tit">Meus livros 📚</h1>'+
    '<p class="lv-sub">Digite o WhatsApp que você usou ao criar o livro.</p>'+
    '<div class="lv-campo"><input type="tel" id="lvMTel" inputmode="tel" placeholder="(11) 91234-5678" autocomplete="tel"></div>'+
    '<button class="lv-btn" id="lvMBusca" style="margin-top:.7rem">Buscar meus livros</button>'+
    '<div id="lvMRes"></div>'+
    (locais.length?'<div class="lv-sec"><div class="lv-eb">criados neste celular</div><div class="lv-ml">'+locais.map(cartao).join('')+'</div></div>':'')+
  '</div></div>';
  el('lvMVolta').onclick=function(){ location.hash='#/livro'; };
  function ligar(box){ box.querySelectorAll('[data-lvid]').forEach(function(a){ a.onclick=function(){ if(a.dataset.lvt && !lvToken(a.dataset.lvid)) lvSalvar({id:a.dataset.lvid,t:a.dataset.lvt,nome:'',em:Date.now()}); }; }); }
  function buscar(){
    var tel=(el('lvMTel').value||'').replace(/\D/g,'');
    if(tel.length<10){ toast('Digite o WhatsApp com DDD.'); return; }
    var b=el('lvMBusca'); b.disabled=true; b.innerHTML='<span class="lv-giro"></span> Procurando…';
    Promise.all([lvTemas(), fetch('/.netlify/functions/livro-meus?tel='+encodeURIComponent(tel),{cache:'no-store'}).then(function(r){ return r.json(); })])
      .then(function(x){
        var d=x[1]; b.disabled=false; b.textContent='Buscar meus livros';
        var box=el('lvMRes');
        if(!d || !d.livros){ toast((d&&d.erro)||'Não consegui buscar agora.'); return; }
        if(!d.livros.length){
          box.innerHTML='<div class="lv-vazio"><div class="ic">📭</div><h3 style="font:800 1.2rem \'Baloo 2\';margin:.3rem 0">Você ainda não criou nenhum livro</h3><p style="color:var(--lv-suave);margin:0 0 1rem;font-size:.92rem">Não achamos nenhum livro com esse número. Confira o número ou crie o primeiro agora.</p><a class="lv-btn rosa" href="#/livro/criar" style="text-decoration:none">Criar meu livro ✨</a></div>';
          return;
        }
        box.innerHTML='<div class="lv-ml">'+d.livros.map(cartao).join('')+'</div>'; ligar(box);
      }).catch(function(){ var b2=el('lvMBusca'); if(b2){ b2.disabled=false; b2.textContent='Buscar meus livros'; } toast('Sem conexão.'); });
  }
  el('lvMBusca').onclick=buscar;
  el('lvMTel').onkeydown=function(e){ if(e.key==='Enter') buscar(); };
  lvTemas().then(function(){ var box=document.querySelector('.lv-sec .lv-ml'); if(box && locais.length){ box.innerHTML=locais.map(cartao).join(''); } }).catch(function(){});
}

/* ------------------------------------------------------- passo a passo */
var LV={passo:0, tema:null, nome:'', idade:null, meses:null, genero:null, foto:null, extras:[], historia:'', tituloLivro:'', zap:'', aceite:false, codigo:''};
/* QUEM VAI JUNTO na história (até 3): família, amigo ou bichinho, cada um com foto e nome */
var LV_MAX_EXTRAS=3;
var LV_QUEM=[
  {g:'Família', itens:[['mae','👩','Mãe'],['pai','👨','Pai'],['irmao','👦','Irmão'],['irma','👧','Irmã'],['avo_f','👵','Vovó'],['avo_m','👴','Vovô'],['tio','🧔','Tio'],['tia','👩‍🦱','Tia'],['primo','🧒','Primo'],['prima','👧','Prima']]},
  {g:'Amigos', itens:[['amigo','🧒','Amigo'],['amiga','👧','Amiga'],['pessoa','💛','Outra pessoa']]},
  {g:'Bichinho de estimação', itens:[['cachorro','🐶','Cachorro'],['gato','🐱','Gato'],['coelho','🐰','Coelho'],['passaro','🐦','Passarinho'],['pet','🐾','Outro bichinho']]}
];
function lvQuem(tipo){ for(var i=0;i<LV_QUEM.length;i++) for(var j=0;j<LV_QUEM[i].itens.length;j++) if(LV_QUEM[i].itens[j][0]===tipo) return LV_QUEM[i].itens[j]; return null; }
var LV_APELIDO={mae:'Mamãe',pai:'Papai',avo_f:'Vovó',avo_m:'Vovô',tio:'Titio',tia:'Titia'};
function lvEhPet(tipo){ return ['cachorro','gato','coelho','passaro','pet'].indexOf(tipo)>=0; }
/* texto da página com quem foi junto (1ª página e última) */
function txComExtras(tx,i,tema,d){
  var f=d&&d.txExtra; if(!f||!tx) return tx;
  var n=((tema&&tema.paginas)||[]).length;
  if(i===0) return tx+' '+f.ini;
  if(i===n-1) return f.fim+' '+tx;
  return tx;
}
/* RECORTAR: a pessoa arrasta e dá zoom pra deixar o rostinho dentro do círculo */
function abrirRecorte(src, titulo){
  return new Promise(function(ok){
    var m=document.createElement('div'); m.className='lv-modal';
    m.innerHTML='<div style="text-align:center"><h3>'+esc(titulo||'Ajuste o rostinho')+'</h3>'+
      '<p style="margin:0;color:var(--lv-suave);font-size:.9rem">Arraste a foto e use o zoom pra deixar o <b>rosto dentro do círculo</b>.</p>'+
      '<div class="lv-rec" id="lvRec"><img id="lvRecImg" alt=""><div class="mira"></div></div>'+
      '<div class="lv-rec-zoom"><span>🔍</span><input type="range" id="lvRecZ" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span>➕</span></div>'+
      '<button class="lv-btn rosa" id="lvRecOk">✓ Usar esta foto</button>'+
      '<button class="lv-voltar" id="lvRecX" style="display:block;margin:.3rem auto 0">Escolher outra foto</button></div>';
    document.body.appendChild(m);
    var box=el('lvRec'), img=el('lvRecImg'), zr=el('lvRecZ');
    var S=0, base=1, z=1, x=0, y=0, iw=0, ih=0, ptrs={}, ini=null;
    function limitar(){ var k=base*z, w=iw*k, h=ih*k; x=Math.min(0,Math.max(S-w,x)); y=Math.min(0,Math.max(S-h,y)); }
    function aplicar(){ limitar(); img.style.transform='translate('+x+'px,'+y+'px) scale('+(base*z)+')'; }
    function zoomEm(nz,cx,cy){ nz=Math.max(1,Math.min(4,nz)); var k0=base*z, k1=base*nz; x=cx-(cx-x)*k1/k0; y=cy-(cy-y)*k1/k0; z=nz; zr.value=z; aplicar(); }
    img.onload=function(){
      S=box.clientWidth; iw=img.naturalWidth; ih=img.naturalHeight; base=S/Math.min(iw,ih);
      img.style.width=iw+'px'; img.style.height=ih+'px';
      x=(S-iw*base)/2; y=(S-ih*base)/2; aplicar();
    };
    img.src=src;
    zr.oninput=function(){ zoomEm(+zr.value,S/2,S/2); };
    box.onpointerdown=function(e){ box.setPointerCapture(e.pointerId); ptrs[e.pointerId]={x:e.clientX,y:e.clientY}; ini=null; };
    box.onpointermove=function(e){
      var p=ptrs[e.pointerId]; if(!p) return;
      var ids=Object.keys(ptrs);
      if(ids.length===1){ x+=e.clientX-p.x; y+=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; aplicar(); return; }
      p.x=e.clientX; p.y=e.clientY;
      var a=ptrs[ids[0]], b=ptrs[ids[1]], dist=Math.hypot(a.x-b.x,a.y-b.y), r=box.getBoundingClientRect();
      if(!ini){ ini={d:dist,z:z}; return; }
      zoomEm(ini.z*dist/ini.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);
    };
    box.onpointerup=box.onpointercancel=function(e){ delete ptrs[e.pointerId]; ini=null; };
    box.onwheel=function(e){ e.preventDefault(); var r=box.getBoundingClientRect(); zoomEm(z*(e.deltaY<0?1.08:0.93),e.clientX-r.left,e.clientY-r.top); };
    function fechar(v){ m.remove(); ok(v); }
    aoSair(function(){ if(m.parentNode) fechar(null); });
    el('lvRecX').onclick=function(){ fechar(null); };
    el('lvRecOk').onclick=function(){
      if(!S||!iw){ fechar(null); return; }
      var k=base*z, sx=-x/k, sy=-y/k, lado=S/k, OUT=Math.min(1024,Math.max(512,Math.round(lado)));
      var c=document.createElement('canvas'); c.width=OUT; c.height=OUT;
      var cx=c.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,OUT,OUT);
      cx.drawImage(img,sx,sy,lado,lado,0,0,OUT,OUT);
      fechar(c.toDataURL('image/jpeg',.92));
    };
  });
}
/* escolheu um arquivo → abre o recorte → devolve a foto recortada (ou null) */
function escolherERecortar(f, titulo){
  return lerFoto(f, 2000).then(function(d){ return abrirRecorte(d, titulo); });
}
/* janela: quem é + nome + foto (adicionar ou editar alguém que vai junto) */
function abrirQuemVaiJunto(idx){
  var ed=idx!=null?LV.extras[idx]:null, cur={tipo:ed?ed.tipo:null, nome:ed?ed.nome:'', foto:ed?ed.foto:null};
  var m=document.createElement('div'); m.className='lv-modal';
  document.body.appendChild(m);
  function fechar(){ m.remove(); }
  aoSair(fechar);
  m.onclick=function(e){ if(e.target===m) fechar(); };
  function pode(){ return !!(cur.tipo && cur.nome.trim().length>=2 && cur.foto); }
  function desenhar(){
    var q=cur.tipo?lvQuem(cur.tipo):null, pet=cur.tipo&&lvEhPet(cur.tipo);
    m.innerHTML='<div class="lv-quem"><h3>'+(ed?'Editar':'Quem mais vai na história?')+'</h3>'+
      '<p style="margin:0;color:var(--lv-suave);font-size:.9rem">Pode ser alguém da família, um amigo ou o bichinho de estimação.</p>'+
      '<h5>1. Quem é?</h5>'+
      LV_QUEM.map(function(gr){ return '<div style="font-size:.8rem;font-weight:700;color:var(--lv-suave);margin:.5rem 0 .3rem">'+esc(gr.g)+'</div><div class="lv-chips">'+
        gr.itens.map(function(it){ return '<button type="button" class="lv-chip'+(cur.tipo===it[0]?' on':'')+'" data-q="'+it[0]+'">'+it[1]+' '+esc(it[2])+'</button>'; }).join('')+'</div>'; }).join('')+
      '<h5>2. '+(pet?'Nome do bichinho':'Nome')+'</h5>'+
      '<div class="lv-campo" style="margin:0"><input type="text" id="lvJNome" maxlength="24" autocomplete="off" placeholder="'+esc(pet?'Ex.: Thor':LV_APELIDO[cur.tipo]?'Ex.: '+LV_APELIDO[cur.tipo]+' ou o nome':'Ex.: João')+'" value="'+esc(cur.nome)+'"></div>'+
      (pet?'':'<div style="font-size:.82rem;color:var(--lv-suave);margin-top:.35rem;line-height:1.4">💡 Escreva como a criança chama: pode ser o nome ou <b>Papai</b>, <b>Mamãe</b>, <b>Vovó</b>…</div>')+
      '<h5>3. Foto '+(pet?'do bichinho':'com o rosto bem visível')+'</h5>'+
      '<label class="lv-foto" for="lvJArq" style="padding:1rem">'+(cur.foto?'<img src="'+cur.foto+'" alt="Foto escolhida" style="width:110px;height:110px"><b>Trocar foto</b>':'<div class="ic">📷</div><b>Escolher a foto</b><small>Depois você recorta o rostinho</small>')+'</label>'+
      '<input type="file" id="lvJArq" accept="image/*" hidden>'+
      '<button class="lv-btn rosa" id="lvJOk"'+(pode()?'':' disabled')+'>'+(ed?'Salvar':'✓ Adicionar na história')+'</button>'+
      (ed?'<button class="lv-btn claro" id="lvJDel">🗑️ Tirar da história</button>':'')+
      '<button class="lv-voltar" id="lvJX" style="display:block;margin:.3rem auto 0">Cancelar</button></div>';
    m.querySelectorAll('[data-q]').forEach(function(b){ b.onclick=function(){ cur.tipo=b.dataset.q; cur.nome=(el('lvJNome')||{}).value||cur.nome; desenhar(); }; });
    var n=el('lvJNome'); n.oninput=function(){ cur.nome=n.value; el('lvJOk').disabled=!pode(); };
    var a=el('lvJArq'); a.onchange=function(){
      var f=a.files&&a.files[0]; if(!f) return; cur.nome=n.value;
      var nm=cur.nome.trim()||(pet?'o bichinho':'essa pessoa');
      escolherERecortar(f,'Ajuste o rosto de '+nm).then(function(d){ if(d){ cur.foto=d; } desenhar(); })
        .catch(function(){ toast('Não consegui abrir essa foto. Tente outra.'); });
    };
    el('lvJOk').onclick=function(){
      if(!pode()) return;
      var it={tipo:cur.tipo, nome:cur.nome.trim().replace(/\s+/g,' '), foto:cur.foto};
      if(ed) LV.extras[idx]=it; else LV.extras.push(it);
      fechar(); desenharPasso();
    };
    var del=el('lvJDel'); if(del) del.onclick=function(){ LV.extras.splice(idx,1); fechar(); desenharPasso(); };
    el('lvJX').onclick=fechar;
  }
  desenhar();
}
function htmlQuemVaiJunto(){
  var nm=esc(LV.nome.trim().split(' ')[0]||'a criança');
  return '<div class="lv-junto"><h4>👨‍👩‍👧 Quem mais vai na história?</h4>'+
    '<p>Opcional: coloque até '+LV_MAX_EXTRAS+' pessoas ou bichinhos pra viver a aventura junto com '+nm+'. Eles aparecem nas ilustrações e na história.</p>'+
    LV.extras.map(function(x,i){ var q=lvQuem(x.tipo)||['','💛','']; return '<div class="lv-jt"><img src="'+x.foto+'" alt=""><div><b>'+esc(x.nome)+'</b><small>'+q[1]+' '+esc(q[2])+'</small></div>'+
      '<button type="button" data-jed="'+i+'" aria-label="Editar">✏️</button><button type="button" data-jdel="'+i+'" aria-label="Tirar">✕</button></div>'; }).join('')+
    (LV.extras.length<LV_MAX_EXTRAS?'<button type="button" class="lv-add" id="lvJAdd">➕ '+(LV.extras.length?'Adicionar mais alguém':'Adicionar pessoa ou bichinho')+'</button>':'')+
    '</div>';
}
/* CRIE SUA PRÓPRIA HISTÓRIA: a família conta como quer (digitando ou falando) */
var LV_IDEIAS=[
  ['🦁','Safári','Queria uma aventura num safári, com leão, girafa e elefante, onde {n} ajuda um filhote de leão a encontrar a mamãe.'],
  ['🚀','Espaço','Uma viagem de foguete pelo espaço, visitando planetas coloridos e fazendo amizade com um extraterrestre bem fofinho.'],
  ['🏖️','Praia em família','Um dia de praia com a família: castelo de areia, conchinhas, golfinhos ao longe e um pôr do sol lindo no final.'],
  ['🎂','Aniversário','Um aniversário mágico, com bolo gigante, balões que levam {n} a voar e todos os amigos cantando parabéns.'],
  ['🐶','Com o meu pet','Uma aventura com o nosso bichinho de estimação, procurando um tesouro escondido no parque.'],
  ['🙏','Com Deus','Uma história sobre o amor de Deus, gratidão e cuidar das pessoas, com um anjinho que acompanha {n}.']
];
function htmlPassoHistoria(){
  var nm=esc(LV.nome.trim().split(' ')[0]||'a criança'), voz=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  return '<div class="lv-eb">sua história</div><h1 class="lv-tit">Como você quer a história de '+nm+'? ✍️</h1>'+
    '<p class="lv-sub">Conte com detalhes: onde acontece, quem aparece, um momento marcante, o que '+nm+' ama (bichinhos, lugares, brincadeiras). <b>A história e a capa são feitas a partir do que você escrever</b>, com 12 páginas e 5 ilustrações e uma lição no final.</p>'+
    '<div class="lv-campo" style="margin:0 0 .9rem"><label for="lvTitLivro" style="margin-top:0">Nome do livro <span style="font-weight:500;color:#8a7a96">(opcional)</span></label>'+
      '<input type="text" id="lvTitLivro" maxlength="50" autocomplete="off" placeholder="Ex.: '+nm+' e o Sítio da Vovó" value="'+esc(LV.tituloLivro)+'" style="font-size:1.05rem">'+
      '<div style="font-size:.8rem;color:var(--lv-suave);margin-top:.3rem">É o título que vai na capa. Se deixar em branco, a gente cria um.</div></div>'+
    '<label for="lvHist" style="display:block;font-weight:700;margin:0 0 .45rem">Conte a história</label>'+
    '<div class="lv-campo" style="margin:0"><textarea id="lvHist" maxlength="2000" rows="7" placeholder="Ex.: Queria que '+nm+' fosse com o papai e a mamãe numa fazenda, alimentando os bichinhos. Ela ama cavalos e o nosso cachorro Thor. No final, todos fazem um piquenique e ela aprende a cuidar dos animais." style="width:100%;font:500 1rem/1.5 Inter,sans-serif;padding:.9rem 1rem;border-radius:16px;border:2px solid var(--lv-borda);background:#fff;color:var(--lv-tinta);resize:vertical">'+esc(LV.historia)+'</textarea></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;margin-top:.45rem">'+
      (voz?'<button type="button" class="lv-chip" id="lvFalar" style="padding:.6rem .9rem;font-size:.95rem">🎤 Falar em vez de digitar</button>':'<small style="color:var(--lv-suave)">🎤 Prefere falar? Toque no microfone do teclado.</small>')+
      '<small id="lvHistN" style="color:var(--lv-suave);white-space:nowrap">'+LV.historia.trim().length+'/2000</small></div>'+
    '<div id="lvFalaSt" style="font-size:.85rem;color:#E23C7E;font-weight:700;min-height:1.2em;margin-top:.3rem"></div>'+
    '<div style="font-weight:700;margin:.9rem 0 .45rem">Sem ideia? Toque numa pra começar:</div>'+
    '<div class="lv-chips tres">'+LV_IDEIAS.map(function(x,i){ return '<button type="button" class="lv-chip" data-ideia="'+i+'" style="font-size:.88rem;padding:.6rem .2rem">'+x[0]+' '+esc(x[1])+'</button>'; }).join('')+'</div>'+
    '<div class="lv-dica">💡<div>No próximo passo você coloca a foto de '+nm+' e, se quiser, de <b>até 3 pessoas ou bichinhos</b> (papai, mamãe, irmãos, avós, pet…) pra aparecerem nas ilustrações.</div></div>';
}
function ligarPassoHistoria(){
  var ta=el('lvHist'), n=el('lvHistN'), nm=LV.nome.trim().split(' ')[0]||'a criança', tl=el('lvTitLivro');
  if(tl) tl.oninput=function(){ LV.tituloLivro=tl.value; };
  function mudou(){ LV.historia=ta.value; n.textContent=ta.value.trim().length+'/2000'; el('lvProx').disabled=ta.value.trim().length<30; }
  ta.oninput=mudou;
  document.querySelectorAll('[data-ideia]').forEach(function(b){ b.onclick=function(){
    var t=LV_IDEIAS[+b.dataset.ideia][2].replace(/\{n\}/g,nm);
    ta.value=(ta.value.trim()?ta.value.trim()+' ':'')+t; mudou(); ta.focus();
  }; });
  var bf=el('lvFalar'); if(!bf) return;
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition, rec=null, ouvindo=false, base='';
  function parar(){ ouvindo=false; try{ rec&&rec.stop(); }catch(e){} bf.textContent='🎤 Falar em vez de digitar'; el('lvFalaSt').textContent=''; }
  aoSair(parar);
  bf.onclick=function(){
    if(ouvindo){ parar(); return; }
    try{ rec=new SR(); }catch(e){ toast('Seu celular não deixou usar o microfone aqui. Use o microfone do teclado.'); return; }
    rec.lang='pt-BR'; rec.continuous=true; rec.interimResults=true;
    base=ta.value.trim()?ta.value.trim()+' ':'';
    rec.onresult=function(e){ var fin='', tmp=''; for(var i=0;i<e.results.length;i++){ var r=e.results[i]; if(r.isFinal) fin+=r[0].transcript+' '; else tmp+=r[0].transcript; }
      ta.value=(base+fin+tmp).slice(0,2000); mudou(); };
    rec.onerror=function(e){ if(e&&e.error==='not-allowed') toast('Permita o microfone pra falar a história.'); parar(); };
    rec.onend=function(){ if(ouvindo){ base=ta.value.trim()?ta.value.trim()+' ':''; try{ rec.start(); }catch(e){ parar(); } } };
    try{ rec.start(); ouvindo=true; bf.textContent='⏹️ Parar'; el('lvFalaSt').textContent='🔴 Ouvindo… pode falar à vontade.'; }catch(e){ parar(); }
  };
}
function lvAparelho(){ var a=''; try{ a=Store.get('cl_aparelho')||''; if(!a){ a=Math.random().toString(36).slice(2)+Date.now().toString(36); Store.set('cl_aparelho',a); } }catch(e){} return a; }
function telaLivroCriar(){
  /* até 2 prévias grátis por pessoa: se já tem 2 (não pagas), mostra a mais recente em vez de criar outra.
     Vale pra todo mundo (inclusive você): o site funciona igual pra qualquer cliente. */
  var meus=lvGet().slice(0,2), meu=meus[0];
  var conferir = meus.length>=2 && !LV.codigo
    ? Promise.all(meus.map(function(o){ return fetch('/.netlify/functions/livro-status?id='+o.id+'&t='+encodeURIComponent(o.t),{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }))
    : Promise.resolve([]);
  Promise.all([lvTemas(), conferir]).then(function(x){
    var ds=x[1]||[];
    if(ds.length>=2 && ds.every(function(d){ return d && !d.pago; })){ telaJaTemPrevia(meu, ds[0]); return; }
    desenharPasso();
  }).catch(function(){ toast('Sem conexão. Tente de novo.'); });
}
function telaJaTemPrevia(meu, d){
  var tema=d?temaDoPedido(d):null, zap=(window.CONFIG&&CONFIG.whatsapp)||'5511924826268';
  var capa=(d&&tema)?'<div class="lv-livro3d" style="width:min(56vw,210px);margin:1rem auto 1.4rem">'+htmlCapa({img:d.capa,cores:tema.cores,emoji:tema.emoji,titulo:flexTxt(tema.titulo,d.nome,d.genero),nome:d.nome,fs:11})+'</div>':'';
  el('app').innerHTML='<div class="lv"><div class="lv-wrap" style="padding-top:calc(1.4rem + env(safe-area-inset-top,0px));text-align:center">'+
    '<div class="lv-eb">suas prévias</div><h1 class="lv-tit">Você já criou suas 2 prévias grátis 📖</h1>'+
    '<p class="lv-sub">Cada pessoa tem direito a 2 prévias grátis. Depois de desbloquear um livro, você pode criar quantos quiser.</p>'+capa+
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
  var app=el('app'); var P=LV.passo, prop=LV.tema==='propria', total=prop?4:3;
  var etapa=P===0?'tema':P===1?'crianca':(prop&&P===2)?'historia':'foto';
  var corpo='', pode=false, btn='Continuar →';
  if(etapa==='tema'){
    corpo='<div class="lv-eb">escolha a aventura</div><h1 class="lv-tit">Qual aventura vai viver?</h1>'+
      '<p class="lv-sub">O rostinho da criança entra nas ilustrações e o nome em toda a história.</p><div class="lv-temas">'+
      (_lvTemas||[]).map(function(t,i){
        var gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][(i+1)%6];
        return '<button type="button" class="lv-op'+(LV.tema===t.id?' on':'')+'" data-tema="'+esc(t.id)+'"><div class="lv-livro3d">'+
          capaTema(t,i,7.2)+'</div>'+
          seloVendas(t,i)+'<h4>'+esc(t.emoji+' '+t.nome)+'</h4><p>'+esc(flexTxt(t.descricao,'',gen))+'</p><div class="ok">✓ Escolhida</div></button>';
      }).join('')+'</div>';
    pode=!!LV.tema;
  } else if(etapa==='crianca'){
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
  } else if(etapa==='historia'){
    corpo=htmlPassoHistoria();
    pode=LV.historia.trim().length>=30;
    btn='Agora as fotos →';
  } else {
    var nm=esc(LV.nome.trim().split(' ')[0]);
    corpo='<div class="lv-eb">'+(prop?'as fotos':'a foto')+'</div><h1 class="lv-tit">Agora a foto de '+nm+' 📸</h1>'+
      '<p class="lv-sub">Uma foto com o rostinho bem visível, de frente e com boa luz.</p>'+
      '<label class="lv-foto" for="lvArq">'+(LV.foto?'<img src="'+LV.foto+'" alt="Foto escolhida"><b>Trocar foto</b>':'<div class="ic">📷</div><b>Toque para escolher a foto</b><small>JPG ou PNG</small>')+'</label>'+
      '<input type="file" id="lvArq" accept="image/*" hidden>'+
      '<div class="lv-dica" style="background:#FFF0F3;color:#7A2440;border:1.5px solid #FFC2D1">⚠️<div><b>Atenção na foto:</b> a criança precisa estar <b>de roupa</b>. Foto <b>sem camisa, de fralda, de biquíni ou roupa de banho</b> é recusada pela inteligência artificial.</div></div>'+
      '<div class="lv-dica">💡<div>Use uma foto só de <b>'+nm+'</b>, <b>de frente e com boa luz</b> (sem filtro, sem boné e sem óculos escuros). Depois de escolher, você <b>recorta o rostinho</b>. Quanto mais nítido o rosto na foto, <b>mais idêntico</b> ele fica no livro.</div></div>'+
      htmlQuemVaiJunto()+
      '<div class="lv-campo"><label for="lvZap">WhatsApp pra receber o livro <span style="font-weight:500;color:#8a7a96">(opcional)</span></label><input type="tel" id="lvZap" inputmode="tel" placeholder="(11) 91234-5678" value="'+esc(LV.zap)+'"></div>'+
      '<label class="lv-aceite"><input type="checkbox" id="lvAceite"'+(LV.aceite?' checked':'')+'><span>Sou responsável pela criança e autorizo usar '+(LV.extras.length?'as fotos':'a foto')+' só para criar este livro'+(LV.extras.length?' (e tenho a autorização de quem aparece nelas)':'')+'. '+(LV.extras.length?'As fotos são apagadas':'A foto é apagada')+' automaticamente depois.</span></label>'+
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
  app.querySelectorAll('[data-tema]').forEach(function(b){ b.onclick=function(){ folhaTema(b.dataset.tema); }; });
  app.querySelectorAll('[data-idade]').forEach(function(b){ b.onclick=function(){ LV.idade=+b.dataset.idade; if(LV.idade!==0) LV.meses=null; atual(); }; });
  app.querySelectorAll('[data-meses]').forEach(function(b){ b.onclick=function(){ LV.meses=+b.dataset.meses; atual(); }; });
  app.querySelectorAll('[data-gen]').forEach(function(b){ b.onclick=function(){ LV.genero=b.dataset.gen; atual(); }; });
  var n=el('lvNome'); if(n) n.oninput=function(){ LV.nome=n.value; var ok=LV.nome.trim().length>=2 && LV.idade!==null && (LV.idade!==0||LV.meses!==null) && !!LV.genero; el('lvProx').disabled=!ok; };
  var z=el('lvZap'); if(z) z.oninput=function(){ LV.zap=z.value; };
  var ac=el('lvAceite'); if(ac) ac.onchange=function(){ LV.aceite=ac.checked; el('lvProx').disabled=!(LV.foto&&LV.aceite); };
  var arq=el('lvArq'); if(arq) arq.onchange=function(){
    var f=arq.files&&arq.files[0]; if(!f) return;
    escolherERecortar(f,'Ajuste o rostinho de '+(LV.nome.trim().split(' ')[0]||'da criança')).then(function(d){ if(d) LV.foto=d; arq.value=''; desenharPasso(); }).catch(function(){ toast('Não consegui abrir essa foto. Tente outra.'); });
  };
  var jadd=el('lvJAdd'); if(jadd) jadd.onclick=function(){ abrirQuemVaiJunto(null); };
  app.querySelectorAll('[data-jed]').forEach(function(b){ b.onclick=function(){ abrirQuemVaiJunto(+b.dataset.jed); }; });
  app.querySelectorAll('[data-jdel]').forEach(function(b){ b.onclick=function(){ LV.extras.splice(+b.dataset.jdel,1); desenharPasso(); }; });
  if(etapa==='historia') ligarPassoHistoria();
  el('lvProx').onclick=function(){
    if(LV.passo<total-1){ LV.passo++; desenharPasso(); window.scrollTo(0,0); return; }
    enviarLivro();
  };
}
/* tocou numa aventura: mostra o que vem no livro antes de seguir */
function folhaTema(id){
  var t=lvTema(id); if(!t) return;
  var i=(_lvTemas||[]).indexOf(t), gen=t.vitrineGenero||(i%2?'menina':'menino'), nome=NOMES_EX[gen][(i+1)%6];
  var ex=lvExDoTema(id), n=nIlusTema(t), np=nPagsTema(t);
  var m=document.createElement('div'); m.className='lv-modal';
  m.innerHTML='<div class="lv-folha-tema"><div class="lv-livro3d">'+capaTema(t,i,9)+'</div>'+
    '<div style="text-align:center">'+seloVendas(t,i)+'</div><h3>'+esc(t.emoji+' '+t.nome)+'</h3><p class="desc">'+esc(flexTxt(t.descricao,'',gen))+'</p>'+
    '<ul class="lv-inclui">'+
      (t.propria?'<li>✍️ <span><b>Você conta como quer</b> (digitando ou falando) e a gente escreve a história com o nome da criança</span></li>':'')+
      '<li>📖 <span><b>Uma história de '+np+' páginas</b> com o <b>rostinho da criança</b> em '+n+' ilustrações</span></li>'+
      '<li>🎵 <span><b>2 músicas personalizadas</b> cantando o nome da criança</span></li>'+
      '<li>👨‍👩‍👧 <span>Se quiser, coloque <b>até 3 pessoas ou bichinhos</b> junto na história (mãe, pai, irmão, avós, pet…)</span></li>'+
      '<li>👀 <span>Você vê a <b>capa</b> e ouve a <b>música</b> antes de pagar</span></li>'+
      '<li>🖨️ <span><b>PDF</b> pra ler no celular e pra imprimir</span></li>'+
    '</ul>'+
    '<button class="lv-btn rosa" id="lvFtOk">'+(t.propria?'Criar minha história →':'Escolher essa aventura →')+'</button>'+
    (ex?'<button class="lv-btn claro" id="lvFtEx" style="margin-top:.6rem">👀 Folhear um livro de exemplo</button>':'')+
    '<button class="lv-voltar" id="lvFtX" style="display:block;margin:.4rem auto 0">Ver outras aventuras</button></div>';
  document.body.appendChild(m);
  function fechar(){ m.remove(); }
  aoSair(fechar);
  m.onclick=function(e){ if(e.target===m) fechar(); };
  el('lvFtX').onclick=fechar;
  el('lvFtOk').onclick=function(){ fechar(); LV.tema=id; LV.passo=1; desenharPasso(); window.scrollTo(0,0); };
  if(ex) el('lvFtEx').onclick=function(){ fechar(); abrirExemplo(ex, function(){ LV.tema=id; LV.passo=1; desenharPasso(); window.scrollTo(0,0); }); };
}
function lerFoto(f,max){
  return new Promise(function(ok,falha){
    var url=URL.createObjectURL(f), img=new Image();
    img.onload=function(){
      var M=max||1280, w=img.naturalWidth, h=img.naturalHeight, k=Math.min(1, M/Math.max(w,h));
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
    body:JSON.stringify({tema:LV.tema,nome:LV.nome.trim(),idade:LV.idade,idadeMeses:LV.meses,genero:LV.genero,foto:LV.foto,extras:LV.extras.map(function(x){ return {tipo:x.tipo,nome:x.nome,foto:x.foto}; }),historia:LV.tema==='propria'?LV.historia:'',tituloLivro:LV.tema==='propria'?LV.tituloLivro:'',whatsapp:LV.zap,aparelho:lvAparelho(),codigo:LV.codigo})})
  .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
  .then(function(res){
    if(res.d && res.d.jaTem && !LV.codigo){ telaJaTemPrevia(lvGet()[0]||null, null); return; }
    if(!res.ok||!res.d.id){ el('lvErro').textContent=(res.d&&res.d.erro)||'Não consegui começar agora. Tente de novo.'; b.disabled=false; b.textContent='Tentar de novo'; return; }
    lvSalvar({id:res.d.id,t:res.d.token,nome:LV.nome.trim(),tema:LV.tema,em:Date.now()});
    try{ gaEvento('livro_previa',{tema:LV.tema}); fbEvento('Lead',{content_name:'livro'}); }catch(e){}
    LV={passo:0,tema:null,nome:'',idade:null,meses:null,genero:null,foto:null,extras:[],historia:'',tituloLivro:'',zap:'',aceite:false,codigo:''};
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
        var tema=temaDoPedido(d)||{cores:['#FFE8B8','#F6B86B','#7BAE5A'],titulo:'{nome}',paginas:[],emoji:'✨'};
        if(d.pago && d.status==='pronto'){ clearInterval(iv); if(tela!=='livro'){ tela='livro'; abrirLeitor(d,tema,t); } return; }
        if(d.pago){ if(tela!=='gerando'){ tela='gerando'; desenharEspera(d,tema,true); } else atualizarEspera(d,true); return; }
        if(d.capa){ if(tela!=='previa'){ tela='previa'; desenharPrevia(d,tema,t); } else lvAmostraAtualizar(d,tema);
          if(d.musica) lvMusicaPronta();
          if(d.musica && (d.amostra==null || (d.paginas||[])[d.amostra] || d.amostraErro)) clearInterval(iv);
          return; }
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
      '<p style="margin-top:1.2rem;font-size:.85rem;opacity:.75">'+(pago?'Pode deixar esta tela aberta. Se fechar, o livro continua sendo feito e fica salvo aqui.':'Leva uns 2 minutinhos. Pode deixar esta tela aberta.')+'</p>'+(pago?htmlZapPago(d,t):htmlZapLivro(d,t,true))+'<div id="lvPacLista"></div></div>';
    var msgs = pago ? ['Ilustrando cada cena com '+nome+'…','Pintando os detalhes do cenário…','Caprichando nas cores…','Montando as páginas do livro…']
                    : ['Desenhando '+nome+' na capa…','Compondo a música de '+nome+'…','Escolhendo as cores da aventura…','Espalhando purpurina mágica…'];
    var k=0, m=el('lvMsg'); m.textContent=msgs[0];
    clearInterval(msgIv); msgIv=setInterval(function(){ var mm=el('lvMsg'); if(!mm) return; k=(k+1)%msgs.length; mm.textContent=msgs[k]; },3200);
    atualizarEspera(d,pago);
  }
  function atualizarEspera(d,pago){
    var c=el('lvCheck'); if(!c) return;
    mostrarPacote(d);
    function li(ok,txt){ return '<li><i>'+(ok?'✅':'<span class="lv-giro"></span>')+'</i>'+txt+'</li>'; }
    if(!pago) c.innerHTML=(d.tema==='propria'?li(!d.escrevendo,'Escrevendo a história de '+esc(d.nome)):'')+li(!!d.capa,'Capa com o rostinho de '+esc(d.nome))+li(!!d.musica,'Música com o nome '+esc(d.nome));
    else { var prontas=(d.paginas||[]).filter(function(u){ return u&&u!=='so'; }).length, tot=d.nIlus||(d.paginas||[]).filter(function(u){ return u!=='so'; }).length||5;
      prontas=Math.min(prontas,tot);
      c.innerHTML=li(prontas>=tot,'Ilustrações: '+prontas+' de '+tot)+li(true,'Textos da história')+li(true,'Música completa'); }
    if(d.fotoRecusada){
      if(!el('lvTroca')){ c.insertAdjacentHTML('afterend','<div id="lvTroca" style="margin-top:1rem;background:#fff;color:#2A1B3D;border-radius:18px;padding:1rem;text-align:left;max-width:22rem;position:relative">'+
        '<b style="font:800 1.1rem \'Baloo 2\'">📸 Essa foto não funcionou</b><p style="margin:.3rem 0 .7rem;font-size:.9rem;color:#6E5C82;line-height:1.45">A inteligência artificial não aceitou essa foto. Envie outra: <b>de frente, com boa luz, de roupa e sem filtro</b>. Não gasta outra prévia.</p>'+
        '<label class="lv-btn rosa" style="cursor:pointer">Escolher outra foto<input type="file" id="lvTrocaArq" accept="image/*" hidden></label><div id="lvTrocaMsg" style="font-size:.85rem;margin-top:.5rem"></div></div>');
        el('lvTrocaArq').onchange=function(){ var f=this.files&&this.files[0]; if(!f) return; var msg=el('lvTrocaMsg'); msg.textContent='Enviando…';
          lerFoto(f).then(function(foto){ return fetch('/.netlify/functions/livro-previa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trocarFoto:d.id,t:lvToken(d.id),foto:foto})}).then(function(r){ return r.json(); }); })
            .then(function(x){ if(x&&x.ok){ var b=el('lvTroca'); if(b) b.remove(); toast('Foto nova recebida! Estamos desenhando de novo.'); } else msg.textContent=(x&&x.erro)||'Não deu certo. Tente outra foto.'; })
            .catch(function(){ msg.textContent='Sem conexão. Tente de novo.'; }); };
      }
    } else if(d.status==='problema'||d.capaErro){ c.insertAdjacentHTML('beforeend','<li style="background:rgba(255,180,120,.14)"><i>⏳</i>Uma imagem está dando mais trabalho. Já estamos refazendo, pode deixar a tela aberta ou voltar depois.</li>'); }
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

function lvMusicaPronta(){ var b=el('lvAbrir'); if(b && b.disabled){ b.disabled=false; b.querySelector('span').textContent='▶ Abrir o livro'; } }
function desenharPrevia(d,tema,t){
  _lvAmD=d;
  var app=el('app'), titulo=flexTxt(tema.titulo,d.nome,d.genero);
  app.innerHTML='<div class="lv-prev"><div class="lv-wrap" style="padding-bottom:2rem">'+
    '<div class="lv-topo"><img src="'+MASCOTE+'" alt="">Livro Mágico</div>'+
    '<h1 class="lv-h">O livro de '+esc(d.nome)+' está pronto pra abrir ✨</h1>'+
    '<p class="sub">Toque na capa: leia o começo da história e escute a prévia da música de '+esc(d.nome)+'.</p>'+
    '<div class="lv-livro3d" id="lvCapaPrev">'+htmlCapa({img:d.capa,cores:tema.cores,emoji:tema.emoji,titulo:titulo,nome:d.nome,fs:Math.min(17,window.innerWidth/22),
      extra:'<button class="lv-abrir" id="lvAbrir" aria-label="Abrir o livro e tocar a música"'+(d.musica?'':' disabled')+'><span>'+(d.musica?'▶ Abrir o livro':'<i class="lv-giro" style="width:14px;height:14px;vertical-align:-2px;border-top-color:#2A1B3D"></i> Afinando a música…')+'</span></button>'})+'</div>'+
    '<div id="lvDepois"></div>'+htmlZapLivro(d,t,false)+'</div></div>';
  el('lvAbrir').onclick=function(){
    tocarLivro(d.id,1);
    el('lvAbrir').remove();
    el('lvDepois').innerHTML='<div class="lv-tocando"><span class="lv-eq"><i></i><i></i><i></i></span> Tocando: a música de '+esc(d.nome)+' (prévia de 70 segundos)</div>'+
      htmlAmostra(_lvAmD||d,tema)+htmlDesbloquear(d,tema);
    ligarDesbloquear(d,tema,t); desenharAmostra(_lvAmD,tema);
    setTimeout(function(){ var x=el('lvDepois'); if(x) x.scrollIntoView({behavior:'smooth',block:'start'}); },250);
  };
}
var LV_PACOTES={um:37,dois:49,todos:129};
/* AMOSTRA GRÁTIS na prévia: capa, "pertence a", título, o começo da história e a 1ª ilustração (não é a capa) */
var _lvAmD=null;
function lvPagsAmostra(d,tema){
  var ps=paginasDoLivro(d,tema), fim=-1;
  for(var i=0;i<ps.length;i++){ if(d.amostra!=null && ps[i].t==='img' && ps[i].i===d.amostra){ fim=i; break; } }
  if(fim<0){ for(var j=0;j<ps.length;j++){ if(ps[j].t==='texto'){ fim=j; break; } } }
  return ps.slice(0,fim+1);
}
function htmlAmostra(d,tema){
  _lvAmD=d;
  var ps=lvPagsAmostra(d,tema), linhas=[[0]];
  for(var k=1;k<ps.length;k+=2) linhas.push(k+1<ps.length?[k,k+1]:[k]);
  return '<div class="lv-amostra"><div class="lv-am-tit">📖 O começo da história de '+esc(d.nome)+'</div>'+
    '<div class="lv-am-pags">'+linhas.map(function(l){ return '<div class="lv-pdfv-sp'+(l.length===1?' so':'')+'">'+l.map(function(i){ return '<div class="lv-pdfv-pg" data-am="'+i+'"><span class="lv-giro"></span></div>'; }).join('')+'</div>'; }).join('')+'</div>'+
    '<div class="lv-am-fim"><b>🔒 A história continua…</b>Esta é só uma amostra: você viu <b>1 ilustração</b>. Depois do pagamento libera o livro completo de '+esc(d.nome)+', com a história inteira ilustrada e as 2 músicas completas.</div></div>';
}
function desenharAmostra(d,tema,soImg){
  var ps=lvPagsAmostra(d,tema);
  Promise.all(['600 40px "Baloo 2"','800 40px "Baloo 2"','40px "Grand Hotel"','600 20px Inter'].map(function(f){ return document.fonts.load(f).catch(function(){}); })).then(async function(){
    for(var i=0;i<ps.length;i++){
      if(soImg && ps[i].t!=='img') continue;
      var slot=document.querySelector('[data-am="'+i+'"]'); if(!slot) return;
      if(ps[i].t==='img' && !(d.paginas||[])[ps[i].i]){
        slot.innerHTML=d.amostraErro?'<small style="color:#6E5C82;padding:1rem;text-align:center">A ilustração vem no livro completo ✨</small>':'<div style="text-align:center;color:#6E5C82"><span class="lv-giro" style="border-top-color:#8A5A10"></span><small style="display:block;margin-top:.5rem;font-weight:700">Pintando a 1ª ilustração…</small></div>';
        continue;
      }
      try{ var cv=await desenharPaginaCanvas(ps[i],d,tema,i+1,900,1200); var im=new Image(); im.alt='Página '+(i+1); im.src=cv.toDataURL('image/jpeg',.88); slot.innerHTML=''; slot.appendChild(im); }catch(e){ console.error(e); }
    }
  });
}
function lvAmostraAtualizar(d,tema){
  var antes=_lvAmD; _lvAmD=d;
  if(!document.querySelector('.lv-amostra')) return;
  var ja=antes&&antes.amostra!=null&&(antes.paginas||[])[antes.amostra];
  if(!ja && d.amostra!=null && ((d.paginas||[])[d.amostra] || d.amostraErro)) desenharAmostra(d,tema,true);
}
function htmlDesbloquear(d,tema){
  var n=nIlusTema(tema), np=nPagsTema(tema), outros=(_lvTemas||[]).filter(function(x){ return x.id!==d.tema && !x.propria; }), total=outros.length+1;
  var capaMini=d.capa?'<img src="'+esc(d.capa)+'" alt="" style="width:64px;aspect-ratio:3/4;object-fit:cover;border-radius:4px 8px 8px 4px;box-shadow:0 6px 14px rgba(0,0,0,.18);flex:none">':'';
  function op(k,tit,sub,preco,de,tag){ return '<label class="lv-pac'+(k==='um'?' on':'')+'" data-pac="'+k+'"><input type="radio" name="lvPac" value="'+k+'"'+(k==='um'?' checked':'')+'>'+
    '<span class="tx"><b>'+tit+(tag?' <em>'+tag+'</em>':'')+'</b><small>'+sub+'</small></span><span class="vl">'+(de?'<s>'+lvFmt(de)+'</s>':'')+'<b>'+lvFmt(preco)+'</b></span></label>'; }
  return '<div class="lv-tranca">'+
    '<h3>🔓 Desbloqueie a história completa</h3>'+
    '<div style="display:flex;gap:.8rem;align-items:center;margin:.2rem 0 1rem">'+capaMini+'<div style="font-size:.93rem;color:#5B4B70;line-height:1.45"><b style="color:#2A1B3D">'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</b><br>'+np+' páginas, '+n+' ilustrações com o rostinho de '+esc(d.nome)+' e 2 músicas completas.</div></div>'+
    '<div style="font-size:.84rem;color:#6E5C82;background:#F6F0FF;border-radius:12px;padding:.55rem .7rem;margin:-.3rem 0 1rem;line-height:1.4">🎵 Você ouviu <b>70 segundos</b>. Cada música completa tem <b>mais de 2 minutos</b>, e são <b>2 músicas</b> com o nome de '+esc(d.nome)+'. Depois do pagamento libera o livro completo, as músicas e os PDFs.</div>'+
    '<div class="lv-pacs">'+
      op('um','1 livro','Esta aventura completa',LV_PACOTES.um)+
      (outros.length?op('dois','2 livros','Esta + mais 1 aventura à sua escolha',LV_PACOTES.dois,LV_PACOTES.um*2,'mais escolhido'):'')+
      (outros.length>1?op('todos','Coleção completa','Todas as '+total+' aventuras com '+esc(d.nome),LV_PACOTES.todos,LV_PACOTES.um*total,'melhor preço'):'')+
    '</div>'+
    '<div id="lvTema2" hidden><div style="font-weight:800;margin:.8rem 0 .4rem">Qual será a segunda aventura?</div><div class="lv-t2">'+
      outros.map(function(t){ var ex=lvExDoTema(t.id); return '<button type="button" class="lv-t2b" data-t2="'+esc(t.id)+'"><div class="lv-livro3d">'+htmlCapa({img:t.vitrine||(ex&&ex.capa)||null,cores:t.cores,emoji:t.emoji,titulo:flexTxt(t.titulo,d.nome,d.genero),nome:d.nome,fs:5.2})+'</div><small>'+esc(t.nome)+'</small></button>'; }).join('')+
    '</div></div>'+
    '<ul class="lv-inclui" style="margin-top:1rem">'+
      '<li>📖 <span>Cada livro com as ilustrações e o <b>nome</b> de '+esc(d.nome)+'</span></li>'+
      '<li>🎵 <span><b>2 músicas completas</b> em cada livro, pra ouvir e <b>baixar</b></span></li>'+
      '<li>📱 <span><b>Versão digital</b> pra ler no celular, com as músicas tocando</span></li>'+
      '<li>🖨️ <span><b>PDF em alta qualidade</b> pra imprimir</span></li>'+
      '<li>💌 <span>Tudo chega também no seu <b>WhatsApp</b></span></li>'+
    '</ul>'+
    '<div id="lvPix"></div>'+
    '<button class="lv-btn rosa" id="lvPagar">Desbloquear por '+lvFmt(LV_PACOTES.um)+' ✨</button></div>';
}
function ligarDesbloquear(d,tema,t){
  var bt=el('lvPagar'), relIv=null, pac='um', tema2=null;
  aoSair(function(){ clearInterval(relIv); });
  function rotulo(){ bt.textContent=pac==='dois'&&!tema2?'Escolha a segunda aventura ☝️':'Desbloquear por '+lvFmt(LV_PACOTES[pac])+' ✨'; bt.disabled=pac==='dois'&&!tema2; }
  document.querySelectorAll('[data-pac]').forEach(function(lb){ lb.onclick=function(){
    pac=lb.dataset.pac; document.querySelectorAll('[data-pac]').forEach(function(x){ x.classList.toggle('on',x===lb); x.querySelector('input').checked=x===lb; });
    el('lvTema2').hidden=pac!=='dois'; rotulo();
    try{ gaEvento('livro_pacote',{pacote:pac}); }catch(e){}
  }; });
  document.querySelectorAll('[data-t2]').forEach(function(b){ b.onclick=function(){ tema2=b.dataset.t2; document.querySelectorAll('[data-t2]').forEach(function(x){ x.classList.toggle('on',x===b); }); rotulo(); }; });
  bt.onclick=function(){
    if(pac==='dois'&&!tema2){ toast('Escolha a segunda aventura.'); return; }
    var valor=LV_PACOTES[pac];
    bt.disabled=true; bt.innerHTML='<span class="lv-giro"></span> Gerando o Pix…';
    try{ fbEvento('InitiateCheckout',{value:valor,currency:'BRL',content_name:'livro'}); gaEvento('livro_checkout',{tema:d.tema,pacote:pac}); }catch(e){}
    fetch('/.netlify/functions/livro-pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,t:t,pacote:pac,tema2:tema2})})
      .then(function(r){ return r.json().then(function(x){ return {ok:r.ok,d:x}; }); })
      .then(function(res){
        if(res.d && res.d.pago){ location.reload(); return; }
        if(!res.ok||!res.d.payload){ toast((res.d&&res.d.erro)||'Não consegui gerar o Pix.'); bt.disabled=false; rotulo(); return; }
        bt.remove(); document.querySelectorAll('[data-pac],[data-t2]').forEach(function(x){ x.style.pointerEvents='none'; });
        var box=el('lvPix');
        box.innerHTML='<div class="lv-relogio">⏳ O Pix vale por <b id="lvRel">20:00</b></div>'+
          htmlPixLimpo(res.d.payload, res.d.valor, res.d.teste, {titulo:'Livro Mágico de '+d.nome+(pac==='dois'?' (2 livros)':pac==='todos'?' (coleção completa)':''), itens:[pac==='um'?'Livro completo com '+nIlusTema(tema)+' ilustrações':pac==='dois'?'2 livros completos':'Todas as aventuras','2 músicas completas em cada livro','PDF pra ler e pra imprimir']});
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
      .catch(function(){ toast('Sem conexão.'); bt.disabled=false; rotulo(); });
  };
}

/* --------------------------------------------------------------- leitor */
function paginasDoLivro(d,tema){
  var n=(tema.paginas||[]).length, ps=[{t:'capa'},{t:'pertence'},{t:'rosto'}];
  for(var i=0;i<n;i++){ ps.push({t:'texto',i:i}); if(!(tema.paginas[i]&&tema.paginas[i].so)) ps.push({t:'img',i:i}); }
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
  var capaMini=d.capa?'<div class="moldura"><img src="'+esc(d.capa)+'" alt=""></div>':'';
  var orn='';
  if(p.t==='texto'){ var tx=((tema.paginas||[])[p.i]||{}).texto||''; return '<div class="lv-pag" style="'+est+'">'+fundo+
    '<div class="miolo"><div class="txt">'+esc(txComExtras(flexTxt(tx,d.nome,d.genero),p.i,tema,d))+'</div>'+orn+'</div><div class="num">'+num+'</div></div>'; }
  if(p.t==='pertence') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo">'+capaMini+'<div class="peq" style="margin-top:9%">Este livro pertence a</div><div class="nomeDono">'+nome+'</div><div class="peq" style="margin-top:12%">com amor, ______________________</div></div></div>';
  if(p.t==='rosto') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo">'+orn+'<div class="grande" style="margin:.3em 0">'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</div>'+orn+'<div class="peq">Uma aventura mágica criada especialmente para '+nome+'</div></div></div>';
  if(p.t==='fim') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div class="script">Fim</div>'+orn+'<div class="txt" style="font-size:.95em;text-align:center">'+nome+', que venham muitas outras aventuras!</div></div><div class="num">'+num+'</div></div>';
  if(p.t==='musica'){ var svg=''; try{ svg=QRCodeGen.toSVG(location.origin+'/#/livro/'+d.id,{ec:'M',quiet:1}); }catch(e){}
    return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div class="grande" style="font-size:1.5em;margin:.3em 0">A música de '+nome+'</div>'+orn+'<div class="qr">'+svg+'</div><div class="peq" style="margin-top:6%">Aponte a câmera do celular pra ouvir a música e ler o livro com ela tocando.</div></div><div class="num">'+num+'</div></div>'; }
  if(p.t==='branco') return '<div class="lv-pag" style="'+est+'">'+fundo+'<div class="miolo"><div class="peq">Espaço pra um desenho ou uma mensagem especial</div></div></div>';
  return '<div class="lv-pag" style="'+est+'"><div class="fundo" style="background:linear-gradient(160deg,'+c[1]+','+c[2]+')"></div><div class="miolo" style="color:#fff">'+capaMini.replace('class="moldura"','class="moldura" style="width:40%"')+'<div class="peq" style="opacity:.95;margin-top:10%;font-weight:700;letter-spacing:.03em">capivarinhalove.com.br</div></div></div>';
}
function abrirLeitor(d,tema,t,opts){
  opts=opts||{};
  var ps=paginasDoLivro(d,tema), musV=1, tocando=false, limpar=[];
  var app=opts.demo ? document.body.appendChild(document.createElement('div')) : el('app');
  function aoFechar(f){ limpar.push(f); aoSair(f); }
  function fecharDemo(){ pararAudioLivro(); limpar.forEach(function(f){ try{ f(); }catch(e){} }); limpar=[]; if(app.parentNode) app.remove(); }
  if(opts.demo) aoSair(function(){ if(app.parentNode) app.remove(); });
  app.innerHTML='<div class="lv-leitor" id="lvLeitor">'+(opts.demo?'<span class="lv-demo-tag">Livro de exemplo</span>':'')+
    '<div class="lv-l-topo"><button class="lv-l-bt" id="lvSair" aria-label="Voltar">←</button><div class="t">'+esc(flexTxt(tema.titulo,d.nome,d.genero))+'</div>'+
      '<button class="lv-l-bt" id="lvMus">🎵 Tocar</button></div>'+
    '<div class="lv-l-palco" id="lvPalcoL"><button class="lv-l-seta ant" id="lvAnt" aria-label="Página anterior">‹</button><div class="lv-l-vista" id="lvVista"></div><button class="lv-l-seta prox" id="lvProx2" aria-label="Próxima página">›</button></div>'+
    '<div class="lv-l-baixo">'+
      '<button class="lv-l-bt" id="lvM1">Música 1</button><button class="lv-l-bt" id="lvM2"'+(d.musica2?'':' hidden')+'>Música 2</button>'+
      '<span class="lv-l-cont" id="lvCont"></span>'+
      (opts.demo?'<button class="lv-l-bt on" id="lvCriarDemo">✨ Criar o meu</button>':'<button class="lv-l-bt" id="lvPdf">⬇️ Baixar</button><button class="lv-l-bt" id="lvComp">💌 Enviar</button>')+
    '</div></div>';
  document.body.style.overflow='hidden';
  aoFechar(function(){ document.body.style.overflow=''; });
  var vista=el('lvVista'), palco=el('lvPalcoL'), pos=0;
  function dupla(){ return true; }
  function vistas(){
    if(!dupla()) return ps.map(function(p,i){ return [i]; });
    var v=[[0]]; for(var i=1;i<ps.length-1;i+=2) v.push([i,i+1]); v.push([ps.length-1]); return v;
  }
  function desenhar(dir){
    var vs=vistas(); pos=Math.max(0,Math.min(pos,vs.length-1));
    var ids=vs[pos], H=palco.clientHeight-16, W=palco.clientWidth-(window.innerWidth>=700?110:12);
    var pw=Math.floor(Math.min(H*0.75, W/(dupla()?2:1)));
    vista.style.setProperty('--pw',pw+'px');
    vista.className='lv-l-vista'+(ids.length>1?' dupla':'')+(dir?(dir>0?' anima-prox':' anima-ant'):'');
    vista.innerHTML=ids.map(function(i){ return htmlPagina(ps[i],d,tema,i+1); }).join('');
    vista.querySelectorAll('.lv-pag .txt').forEach(function(tx){ var m=tx.parentNode, f=1; while(m.scrollHeight>m.clientHeight+1 && f>0.55){ f-=0.05; tx.style.fontSize=f+'em'; } });
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
  document.addEventListener('keydown',tecla); aoFechar(function(){ document.removeEventListener('keydown',tecla); });
  var rz=function(){ desenhar(0); }; window.addEventListener('resize',rz); aoFechar(function(){ window.removeEventListener('resize',rz); });
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
  if(opts.demo){
    el('lvSair').onclick=fecharDemo;
    el('lvCriarDemo').onclick=function(){ fecharDemo(); if(opts.aoCriar) opts.aoCriar(); };
    desenhar(0); marcar(); return;
  }
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
  var dl=function(v){ return (typeof linkBaixarMusica==='function'?linkBaixarMusica(d.id,v):'/.netlify/functions/baixar-musica?id='+encodeURIComponent(d.id)+'&v='+v); };
  m.innerHTML='<div><h3>📥 Guardar o livro</h3><p style="color:#6E5C82;margin:.2rem 0 .8rem;font-size:.92rem">Escolha como você quer o livro de '+esc(d.nome)+'.</p>'+
    '<div style="background:#F3ECFF;border-radius:14px;padding:.75rem .85rem;margin-bottom:.7rem"><b>🌐 Versão digital (com as músicas)</b><div style="font-size:.86rem;color:#5B4B70;margin:.2rem 0 .5rem">É este livro aqui: abre no celular, vira as páginas e toca as músicas. Guarde o link e mande pra família.</div>'+
      '<button class="lv-btn claro" id="lvCopLink" style="margin:0;padding:.7rem">🔗 Copiar o link do livro</button></div>'+
    '<div style="display:flex;gap:.5rem;margin-bottom:.7rem"><a class="lv-btn claro" style="margin:0;padding:.7rem;text-decoration:none;font-size:.95rem" href="'+esc(dl(1))+'" download>🎵 Baixar música 1</a>'+
      (d.musica2?'<a class="lv-btn claro" style="margin:0;padding:.7rem;text-decoration:none;font-size:.95rem" href="'+esc(dl(2))+'" download>🎵 Baixar música 2</a>':'')+'</div>'+
    '<div style="font-weight:800;margin:.4rem 0 .3rem">📄 PDF em alta qualidade</div>'+
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
  el('lvCopLink').onclick=function(){ copiar(location.origin+'/#/livro/'+d.id,'Link do livro copiado!'); };
  var t0=lvToken(d.id); if(t0){ var z=document.createElement('div'); z.innerHTML=htmlZapPago(d,t0); m.firstChild.insertBefore(z, el('lvPdfFechar')); }
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
/* enfeite fino (linha + losango) no lugar dos emojis */
function ornamento(ctx,cx,y,w,cor){ return; }
function ornamentoAntigo(ctx,cx,y,w,cor){
  ctx.save(); ctx.strokeStyle=cor; ctx.fillStyle=cor; ctx.globalAlpha=.55; ctx.lineWidth=Math.max(1.5,w*.006);
  var r=w*.035; ctx.beginPath(); ctx.moveTo(cx-w/2,y); ctx.lineTo(cx-r*2,y); ctx.moveTo(cx+r*2,y); ctx.lineTo(cx+w/2,y); ctx.stroke();
  ctx.globalAlpha=.8; ctx.beginPath(); ctx.moveTo(cx,y-r); ctx.lineTo(cx+r,y); ctx.lineTo(cx,y+r); ctx.lineTo(cx-r,y); ctx.closePath(); ctx.fill(); ctx.restore();
}
/* capa do livro em miniatura, com moldura branca e sombra (página 2 e contracapa) */
async function capaMiniCanvas(ctx,d,x,y,w){
  if(!d.capa) return; var h=w*4/3;
  try{ var im=await img(d.capa);
    ctx.save(); ctx.shadowColor='rgba(42,27,61,.3)'; ctx.shadowBlur=w*.08; ctx.shadowOffsetY=w*.03; ctx.fillStyle='#fff'; ctx.fillRect(x-w*.035,y-w*.035,w*1.07,h+w*.07); ctx.restore();
    cobrir(ctx,im,x,y,w,h);
  }catch(e){}
}
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
    }
    return cv;
  }
  if(p.t==='contra'){
    var gg=ctx.createLinearGradient(0,0,W,H); gg.addColorStop(0,c[1]); gg.addColorStop(1,c[2]); ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);
    await capaMiniCanvas(ctx,d,W*.3,H*.24,W*.4);
    textoCentro(ctx,'capivarinhalove.com.br',W/2,H*.72,W*.8,'700 '+(u*3.6)+'px Inter','rgba(255,255,255,.95)',u*4);
    return cv;
  }
  fundoTexto(ctx,W,H,c);
  if(p.t==='texto'){
    var tx=txComExtras(flexTxt(((tema.paginas||[])[p.i]||{}).texto||'',nome,d.genero),p.i,tema,d);
    var tam=u*5.6, lh=tam*1.5; ctx.font='600 '+tam+'px "Baloo 2"';
    var ls=quebrar(ctx,tx,W*.78); while(ls.length*lh>H*.72 && tam>u*3.6){ tam-=u*.2; lh=tam*1.5; ctx.font='600 '+tam+'px "Baloo 2"'; ls=quebrar(ctx,tx,W*.78); }
    var y0=(H-ls.length*lh)/2; ctx.fillStyle='#2A1B3D'; ctx.textAlign='left'; ctx.textBaseline='top';
    ls.forEach(function(l,i){ ctx.fillText(l,W*.11,y0+i*lh); });
    ornamento(ctx,W/2,y0+ls.length*lh+lh*.6,W*.42,c[2]);
  } else if(p.t==='pertence'){
    await capaMiniCanvas(ctx,d,W*.29,H*.1,W*.42);
    textoCentro(ctx,'Este livro pertence a',W/2,H*.56,W*.8,'600 '+(u*4.4)+'px "Baloo 2"','#6E5C82',u*5);
    textoCentro(ctx,nome,W/2,H*.62,W*.86,'800 '+(u*11)+'px "Baloo 2"',c[2],u*12);
    textoCentro(ctx,'com amor, ______________________',W/2,H*.84,W*.86,'500 '+(u*3.6)+'px Inter','#6E5C82',u*4);
  } else if(p.t==='rosto'){
    ornamento(ctx,W/2,H*.33,W*.42,c[2]);
    var hh=textoCentro(ctx,flexTxt(tema.titulo,nome,d.genero),W/2,H*.37,W*.8,'800 '+(u*9)+'px "Baloo 2"',c[2],u*9.5);
    ornamento(ctx,W/2,H*.39+hh,W*.42,c[2]);
    textoCentro(ctx,'Uma aventura mágica criada especialmente para '+nome,W/2,H*.44+hh,W*.75,'500 '+(u*3.8)+'px Inter','#6E5C82',u*5);
  } else if(p.t==='fim'){
    textoCentro(ctx,'Fim',W/2,H*.3,W*.8,(u*24)+'px "Grand Hotel"',c[2],u*24);
    ornamento(ctx,W/2,H*.56,W*.42,c[2]);
    textoCentro(ctx,nome+', que venham muitas outras aventuras!',W/2,H*.68,W*.75,'600 '+(u*5)+'px "Baloo 2"','#2A1B3D',u*6.5);
  } else if(p.t==='musica'){
    textoCentro(ctx,'A música de '+nome,W/2,H*.22,W*.8,'800 '+(u*7.5)+'px "Baloo 2"',c[2],u*8);
    try{ var svg=QRCodeGen.toSVG(location.origin+'/#/livro/'+d.id,{ec:'M',quiet:1}); var q=await carregarImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
      var qs=W*.46; ctx.fillStyle='#fff'; ctx.fillRect((W-qs)/2-u*2,H*.42-u*2,qs+u*4,qs+u*4); ctx.drawImage(q,(W-qs)/2,H*.42,qs,qs); }catch(e){}
    textoCentro(ctx,'Aponte a câmera do celular pra ouvir a música e ler o livro com ela tocando.',W/2,H*.8,W*.72,'500 '+(u*3.6)+'px Inter','#6E5C82',u*4.6);
  } else if(p.t==='branco'){
    textoCentro(ctx,'Espaço pra um desenho ou uma mensagem especial',W/2,H*.47,W*.7,'500 '+(u*3.8)+'px Inter','#9C8BAE',u*5);
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
var _lvp={temas:null, ed:null, ocupado:false, exemplos:[]};
window._lvpExemplos=function(l){ _lvp.exemplos=l||[]; _lvTemas=null; };
window.pnlLivrosHtml=function(){ return '<div class="lvp" id="lvpCaixa"><div class="pnl-nota">Carregando as histórias…</div></div>'; };
window.pnlLivrosLigar=function(){
  if(_lvp.temas){ desenharLvp(); return; }
  fetch('/.netlify/functions/livro-temas?admin=1',{headers:{'x-admin-key':_pnlChave}}).then(function(r){ return r.json(); }).then(function(d){
    if(!d.temas){ lvpPedirSenha(!!_pnlChave); return; }
    _lvp.temas=d.temas; _lvp.propria=d.propria||null; _lvp.exemplos=d.exemplos||[]; _lvp.vendasSite=d.vendasSite||{}; desenharLvp();
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
    '<div class="lvp-it" style="display:block" id="lvpRel"></div>'+
    '<div class="lvp-it" style="display:block" id="lvpProp">'+htmlPropriaPnl()+'</div>'+
    (_lvp.temas||[]).map(function(t,i){
      var img=t.vitrineEm?'<img src="/.netlify/functions/livro-img?k='+encodeURIComponent('img/tema/'+t.id)+'&v='+t.vitrineEm+'" alt="">':'<div class="sem">'+esc(t.emoji||'📖')+'</div>';
      return '<div class="lvp-it">'+img+'<div class="tx"><b>'+esc((t.emoji||'')+' '+t.nome)+'</b><small>'+esc(t.titulo)+'</small><br>'+
        '<span class="lvp-st '+(t.status==='publicado'?'pub':'ras')+'">'+(t.status==='publicado'?'Publicada':'Rascunho')+'</span>'+
        ' <span class="lvp-st" style="background:#FFF1E0;color:#B4380A">🔥 '+((((_lvp.vendasSite||{})[t.id])||0)+(t.vendasFora||0)).toLocaleString('pt-BR')+' vendidos</span></div>'+
        '<button class="pnl-link" data-lvped="'+i+'">Editar</button></div>';
    }).join('')+
    '<div class="lvp-it" style="display:block" id="lvpVit">'+htmlVitrinePnl()+'</div>'+
    '<div class="lvp-it" style="display:block"><b>🎟️ Liberar mais uma prévia pra um cliente</b><p style="margin:.3rem 0 .2rem;font-size:.85rem;color:#666">Cada pessoa tem 1 prévia grátis. Se um cliente pedir outra no suporte, gere um código (vale 1 vez) e mande pra ele.</p>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpCod">Gerar código</button><span id="lvpCodOut" style="font:800 1.1rem Inter;align-self:center"></span></div></div>'+
    '<div class="lvp-it" style="display:block"><b>✨ Nova história com IA</b><div class="lvp-ed"><label for="lvpIdeia">Descreva a ideia</label>'+
      '<textarea id="lvpIdeia" placeholder="Ex.: uma aventura no mundo dos dinossauros, com um dinossauro bebê que vira melhor amigo"></textarea></div>'+
      '<div style="font-size:.82rem;color:#666;margin:.5rem 0 .35rem">💡 Ideias prontas: toque numa, depois em <b>Escrever com IA</b>, revise e publique.</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:.35rem">'+LVP_IDEIAS.map(function(x,i){ return '<button type="button" class="cl" data-lvpideia="'+i+'" style="font-size:.8rem;padding:.4rem .65rem;border-radius:999px">'+esc(x[0])+'</button>'; }).join('')+'</div>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpIA">Escrever com IA</button><button class="cl" id="lvpBranco">Criar em branco</button><button class="cl" id="lvpRest">Restaurar as 5 originais</button></div></div>'+
    '<div class="lvp-it" style="display:block"><b>📚 Histórias novas prontas</b><p style="margin:.3rem 0 .2rem;font-size:.85rem;color:#666">Davi e Golias com Jesus, Um Dia com Jesus, Fazenda, Craque, Mundo das Cores, Dinossauros, Ateliê dos Sonhos, Natal Mágico, Astronauta da Galáxia e ABC Encantado. Cada uma com 5 ilustrações e páginas extras só de texto. <b>Não apaga as suas.</b> Fazenda, Craque e Galáxia são atualizadas; as outras entram como rascunho pra você revisar e publicar.</p>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpImp">Adicionar as histórias novas</button></div></div>'+
    '<div class="lvp-it" style="display:block"><b>📚 20 histórias novas, completas</b><p style="margin:.3rem 0 .2rem;font-size:.85rem;color:#666">Arca de Noé, Daniel, Rainha Ester, Jonas, Bebê Moisés, Bom Samaritano, Criação, Pães e Peixinhos, Capa das Estrelas, Pequeno Herói, Bombeiro, Veterinário, Dentinhos, Amazônia, Planeta Limpinho, Laboratório, Sentimentos, Cofrinho, Bailarina e Pirata do Bem. Cada uma com <b>12 páginas e 5 ilustrações</b>, texto e música prontos. Entram como <b>rascunho</b>: gere a capa, crie um livro de exemplo e publique. <b>Não apaga as suas.</b></p>'+
      '<div class="lvp-bts"><button class="ouro" id="lvpImp20">Adicionar as 20 histórias</button></div></div>';
  el('lvpCop').onclick=function(){ copiar(location.origin+'/#/livro','Link copiado!'); };
  ligarPropriaPnl();
  ligarVitrinePnl(); ligarRelatorioLivros();
  el('lvpCod').onclick=function(){
    var b=el('lvpCod'); b.disabled=true;
    lvpPost({acao:'codigo'}).then(function(r){ b.disabled=false; if(!r.ok){ toast(r.d.erro||'Erro'); return; }
      el('lvpCodOut').textContent=r.d.codigo; copiar('Seu código pra criar uma nova prévia do Livro Mágico: '+r.d.codigo+'\nÉ só abrir '+location.origin+'/#/livro/criar e digitar o código. 💛','Código copiado com a mensagem pro cliente!'); });
  };
  c.querySelectorAll('[data-lvped]').forEach(function(b){ b.onclick=function(){ _lvp.ed=+b.dataset.lvped; desenharLvp(); }; });
  el('lvpBranco').onclick=function(){ _lvp.temas.push({id:'nova-'+Date.now().toString(36),emoji:'📖',status:'rascunho',ordem:_lvp.temas.length+1,nome:'Nova história',titulo:'{nome} e …',descricao:'',cores:['#FFE8F0','#E86A9E','#6B4BC4'],roupa:'',capa:'',paginas:[{},{},{},{},{}],letra:'',estiloMusica:"children's song, cheerful, catchy chorus, portuguese vocals"}); _lvp.ed=_lvp.temas.length-1; desenharLvp(); };
  el('lvpImp20').onclick=function(){
    var b=el('lvpImp20'); b.disabled=true; b.textContent='Adicionando…';
    lvpPost({acao:'importar20'}).then(function(r){
      if(!r.ok){ b.disabled=false; b.textContent='Adicionar as 20 histórias'; toast(r.d.erro||'Não deu.'); return; }
      _lvp.temas=r.d.temas; _lvTemas=null; desenharLvp();
      toast((r.d.novas||0)+' histórias novas'+(r.d.atualizadas?' e '+r.d.atualizadas+' atualizadas':'')+'. Estão em rascunho. 📚');
    }).catch(function(){ b.disabled=false; b.textContent='Adicionar as 20 histórias'; toast('Sem conexão.'); });
  };
  el('lvpImp').onclick=function(){
    var b=el('lvpImp'); b.disabled=true; b.textContent='Adicionando…';
    lvpPost({acao:'importar'}).then(function(r){ b.disabled=false; b.textContent='Adicionar as histórias novas';
      if(!r.ok){ toast(r.d.erro||'Erro'); return; }
      _lvp.temas=r.d.temas; _lvTemas=null; toast(r.d.novas+' histórias novas e '+r.d.atualizadas+' atualizadas! Revise, crie um exemplo e publique.'); desenharLvp(); });
  };
  el('lvpRest').onclick=function(){
    var b=el('lvpRest'); if(b.dataset.ok!=='1'){ b.dataset.ok='1'; b.textContent='Toque de novo pra confirmar (apaga as mudanças)'; return; }
    lvpPost({acao:'restaurar'}).then(function(r){ if(r.ok){ _lvp.temas=r.d.temas; toast('As 5 histórias originais foram restauradas.'); desenharLvp(); } else toast(r.d.erro||'Erro'); });
  };
  c.querySelectorAll('[data-lvpideia]').forEach(function(b){ b.onclick=function(){ var t=el('lvpIdeia'); t.value=LVP_IDEIAS[+b.dataset.lvpideia][1]; t.focus(); t.scrollIntoView({block:'center'}); }; });
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
/* vitrine: o que gira no topo da página + o livro de exemplo que a pessoa folheia */
function htmlVitrinePnl(){
  var ex=_lvp.exemplos||[];
  return '<b>🖼️ Vitrine da página (o que gira no topo)</b>'+
    '<p style="margin:.3rem 0 .5rem;font-size:.85rem;color:#666"><b>📲 WhatsApp:</b> marque <b>2 livros</b> pra irem como exemplo junto com a prévia que o cliente recebe no WhatsApp (sem marcar, vai um de menino e um de menina). Troca a cada 2,5 segundos, nesta ordem. Um <b>livro pago</b> vira também o <b>livro de exemplo</b> que o cliente folheia. Sem nada aqui, a página mostra as capas de vitrine das histórias.</p>'+
    (ex.length?ex.map(function(x,i){
      var desc=x.tipo==='livro'?'📖 Livro de '+esc(x.nome||'')+' · '+((x.paginas||[]).length)+' ilustrações':'📷 Foto'+(x.legenda?': '+esc(x.legenda):'');
      return '<div class="lvp-ex'+(x.mostrar===false?' off':'')+'"><img src="'+esc(x.capa)+'" alt=""><div class="tx"><b>'+desc+'</b>'+(x.mostrar===false?'escondido':'aparecendo no site')+'</div>'+
        '<button data-exm="'+i+'" data-d="-1" aria-label="Subir">↑</button><button data-exm="'+i+'" data-d="1" aria-label="Descer">↓</button>'+
        '<button data-exv="'+i+'">'+(x.mostrar===false?'Mostrar':'Esconder')+'</button><button data-exx="'+i+'">Tirar</button>'+
        (x.tipo==='livro'&&x.pedido?'<button data-expdf="'+esc(x.pedido)+'">⬇️ PDFs e músicas</button>':'')+
        (x.tipo==='livro'?'<button data-exz="'+i+'" style="'+(x.zap?'background:#25D366;color:#fff':'')+'">'+(x.zap?'✅ No WhatsApp':'📲 WhatsApp')+'</button>':'')+'</div>'+
        (x.tipo==='livro'&&x.pedido?'<div id="lvpPdf_'+esc(x.pedido)+'" style="font-size:.82rem;padding:0 0 .5rem 56px"></div>':'');
    }).join(''):'<div style="font-size:.85rem;color:#999;padding:.3rem 0">Nenhum exemplo ainda.</div>')+
    '<div class="lvp-ed"><label for="lvpExId">Usar um livro pago como exemplo</label>'+
      '<div style="display:flex;gap:.4rem"><input id="lvpExId" placeholder="Código do livro (começa com L)"><button class="pnl-link" id="lvpExAdd">Adicionar</button></div>'+
      '<small style="color:#888">Mais fácil: na lista de pedidos, abra o livro pago e toque em <b>⭐ Usar como exemplo</b>.</small></div>'+
    '<div class="lvp-bts"><label class="pnl-link" style="cursor:pointer;margin:0">📷 Enviar uma foto (ex.: livro impresso)<input type="file" id="lvpExFoto" accept="image/*" hidden></label></div>'+
    htmlVendasPnl();
}
/* 20 ideias de histórias (bíblicas e educativas) pra escrever com IA no painel */
var LVP_IDEIAS=[
  ['🌈 Arca de Noé','História bíblica: a criança ajuda Noé a levar os bichinhos de dois em dois para a arca, enfrenta a grande chuva dentro da arca cuidando dos animais e no final vê o arco-íris da promessa de Deus. Lição: confiar em Deus e obedecer.'],
  ['🦁 Daniel e os leões','História bíblica: a criança fica ao lado de Daniel, que continuou orando mesmo proibido, e vê Deus fechar a boca dos leões, que ficam mansinhos como gatinhos. Lição: coragem e fé. Sem violência, tudo fofo.'],
  ['👑 Rainha Ester','História bíblica: a criança ajuda a jovem Ester a ter coragem de falar com o rei para salvar o seu povo, com um palácio lindo, joias e jardins. Lição: coragem para fazer o que é certo.'],
  ['🐋 Jonas e o peixe','História bíblica: a criança acompanha Jonas que fugiu de barco, vê o grande peixe (fofo, não assustador), e depois ajuda Jonas a ir até Nínive levar a mensagem de Deus. Lição: obedecer e dar segunda chance.'],
  ['🧺 Bebê Moisés','História bíblica: a criança ajuda Miriã a cuidar do cestinho com o bebê Moisés no rio, entre juncos e patinhos, até a princesa encontrar o bebê e cuidar dele. Lição: cuidar da família.'],
  ['❤️ Bom Samaritano','História bíblica com Jesus: a criança vê um viajante machucado na estrada, outras pessoas passam direto, e ela com Jesus e um bom samaritano ajudam com carinho. Lição: amar o próximo.'],
  ['🌍 Criação do mundo','História bíblica: a criança viaja pelos 7 dias da criação: a luz, o céu, o mar, as plantas, o sol e as estrelas, os bichinhos e por último as pessoas, e descobre que é obra especial de Deus. Lição: gratidão.'],
  ['🍞 Pães e peixinhos','História bíblica: a criança divide o seu lanche de 5 pães e 2 peixinhos com Jesus, que alimenta uma multidão enorme num campo verde. Lição: partilhar.'],
  ['🦸 Guardiã das Estrelas','Super-heroína original (não usar personagens famosos): a criança ganha uma capa mágica que brilha e salva a cidade usando gentileza, inteligência e coragem, ajudando pessoas e bichinhos. Lição: o maior poder é fazer o bem.'],
  ['🦸‍♂️ Pequeno Herói','Super-herói original (não usar personagens famosos): com capa e escudo, a criança ajuda os vizinhos, salva um gatinho e vence o Vilão da Bagunça arrumando a cidade com os amigos. Lição: heróis ajudam os outros.'],
  ['🚒 Bombeiro por um dia','A criança passa um dia no quartel dos bombeiros, aprende a se prevenir de incêndios, anda no caminhão vermelho e ajuda a resgatar um gatinho na árvore. Lição: segurança e prevenção.'],
  ['🩺 Veterinária(o)','A criança vira doutor(a) dos bichinhos numa clínica colorida e cuida de um cachorrinho com a patinha dodói, um passarinho e um coelho. Lição: cuidar dos animais com carinho.'],
  ['🦷 Exército dos dentinhos','A criança encolhe e entra numa boca gigante e limpinha para ajudar os dentinhos a vencer os bichinhos da cárie com escova e pasta mágicas. Lição: escovar os dentes todo dia.'],
  ['🌳 Guardião da Amazônia','A criança conhece a onça-pintada, a arara, o boto-cor-de-rosa e o bicho-preguiça e ajuda a proteger a floresta amazônica. Lição: cuidar da natureza.'],
  ['♻️ Planeta limpinho','A criança e um robozinho amigo limpam a praia e o parque e aprendem a separar o lixo nas lixeiras coloridas da reciclagem. Lição: reciclar e cuidar do planeta.'],
  ['🔬 Laboratório mágico','A criança vira cientista num laboratório mágico e faz experiências: vulcão de bicarbonato, arco-íris com prisma e ímãs que dançam. Lição: curiosidade e aprender.'],
  ['😊 Ilha dos sentimentos','A criança visita a ilha da alegria, da tristeza, da raiva e da calma e aprende com cada uma a entender e lidar com o que sente. Lição: entender as emoções.'],
  ['💰 Cofrinho encantado','O cofrinho da criança ganha vida e ensina a guardar moedinhas aos pouquinhos para realizar um sonho, e no final ela compra um presente para alguém que ama. Lição: paciência e poupar.'],
  ['🩰 Bailarina das estrelas','A criança se prepara para a grande apresentação de balé, sente medo antes de entrar no palco, respira fundo e brilha como uma estrela. Lição: persistência e coragem.'],
  ['🏴‍☠️ Pirata do bem','A criança vira um pirata do bem, navega por ilhas coloridas, decifra um mapa com os amigos e descobre que o maior tesouro é a amizade. Lição: amizade e trabalho em equipe.']
];
/* PAINEL: "Crie sua própria história" (publicar, capa da vitrine feita com IA, vendas de fora, posição) */
function htmlPropriaPnl(){
  var p=_lvp.propria; if(!p) return '<b>✨ Crie sua própria história</b><p style="font-size:.85rem;color:#666">Carregando…</p>';
  var site=((_lvp.vendasSite||{}).propria)||0, pub=p.status==='publicado';
  var img=p.vitrineEm?'<img src="/.netlify/functions/livro-img?k='+encodeURIComponent('img/tema/propria')+'&v='+p.vitrineEm+'" alt="" style="width:96px;aspect-ratio:3/4;object-fit:cover;border-radius:10px;flex:none">':'<div style="width:96px;aspect-ratio:3/4;border-radius:10px;background:#FFF1D6;display:flex;align-items:center;justify-content:center;font-size:2rem;flex:none">✨</div>';
  return '<div style="display:flex;gap:.8rem;align-items:flex-start">'+img+'<div style="flex:1;min-width:0"><b>✨ Crie sua própria história</b><br>'+
      '<span class="lvp-st '+(pub?'pub':'ras')+'">'+(pub?'Publicada':'Escondida')+'</span> <span class="lvp-st" style="background:#FFF1E0;color:#B4380A">🔥 '+(site+(p.vendasFora||0)).toLocaleString('pt-BR')+' vendidos</span>'+
      '<p style="margin:.4rem 0 0;font-size:.82rem;color:#666">O cliente conta a história (digitando ou falando) e a IA escreve 12 páginas com 5 ilustrações, seguindo o que ele contou. Na vitrine aparece com o título <b>Crie sua própria história</b>.</p></div></div>'+
    '<div class="lvp-ed">'+
      '<label for="lvpPrDesc">Descrição na vitrine</label><textarea id="lvpPrDesc" style="min-height:4.5rem">'+esc(p.descricao||'')+'</textarea>'+
      '<label for="lvpPrCapa">O que aparece na capa da vitrine (pode ser em português)</label><textarea id="lvpPrCapa" style="min-height:4.5rem">'+esc(p.capa||'')+'</textarea>'+
      '<div style="display:flex;gap:.6rem"><div style="flex:1"><label for="lvpPrVend">Vendas fora do site</label><input id="lvpPrVend" type="number" min="0" inputmode="numeric" value="'+(p.vendasFora||0)+'"></div>'+
      '<div style="flex:1"><label for="lvpPrOrd">Posição (empate)</label><input id="lvpPrOrd" type="number" min="0" inputmode="numeric" value="'+(p.ordem||1)+'"></div></div>'+
      '<small style="color:#888">Vendas do site: '+site+' (contam sozinhas). As mais vendidas aparecem primeiro. Coloque só vendas que aconteceram de verdade.</small></div>'+
    '<div class="lvp-bts"><button class="ouro" id="lvpPrSalvar">Salvar</button><button class="cl" id="lvpPrPub">'+(pub?'Tirar do site':'Publicar no site')+'</button></div>'+
    '<div class="lvp-bts"><button class="cl" data-prvit="menina">🎨 Criar capa com IA (menina)</button><button class="cl" data-prvit="menino">🎨 Criar capa com IA (menino)</button></div>'+
    '<div id="lvpPrMsg" style="font-size:.85rem;color:#666;margin-top:.3rem"></div>';
}
function ligarPropriaPnl(){
  var box=el('lvpProp'); if(!box) return;
  if(!_lvp.propria) return;
  function redesenhar(){ box.innerHTML=htmlPropriaPnl(); ligarPropriaPnl(); }
  function dados(extra){ return Object.assign({descricao:el('lvpPrDesc').value, capa:el('lvpPrCapa').value, vendasFora:+el('lvpPrVend').value||0, ordem:+el('lvpPrOrd').value||1}, extra||{}); }
  function salvar(extra,msg){ return lvpPost({acao:'propria-salvar',propria:dados(extra)}).then(function(r){ if(!r.ok){ toast(r.d.erro||'Não salvou.'); return false; } _lvp.propria=r.d.propria; _lvTemas=null; if(msg) toast(msg); return true; }); }
  el('lvpPrSalvar').onclick=function(){ salvar(null,'Salvo! ✅').then(function(ok){ if(ok) redesenhar(); }); };
  el('lvpPrPub').onclick=function(){ var pub=_lvp.propria.status!=='publicado'; salvar({status:pub?'publicado':'rascunho'},pub?'Publicada! Já aparece no site. ✅':'Tirada do site.').then(function(ok){ if(ok) redesenhar(); }); };
  box.querySelectorAll('[data-prvit]').forEach(function(b){ b.onclick=function(){
    salvar(null).then(function(ok){
      if(!ok) return;
      box.querySelectorAll('[data-prvit]').forEach(function(x){ x.disabled=true; }); b.textContent='Gerando… (1 a 2 min)'; el('lvpPrMsg').textContent='Criando a capa com IA. Pode continuar usando o painel.';
      lvpPost({acao:'vitrine',id:'propria',genero:b.dataset.prvit}).then(function(r){
        if(!r.ok){ toast(r.d.erro||'Não deu.'); redesenhar(); return; }
        var tent=0, iv=setInterval(function(){
          tent++; if(tent>60||!el('lvpProp')){ clearInterval(iv); return; }
          lvpPost({acao:'vitrine-status',id:'propria'}).then(function(s){
            if(!s.ok){ clearInterval(iv); toast(s.d.erro||'Falhou.'); redesenhar(); return; }
            if(s.d.pronto){ clearInterval(iv); if(s.d.propria) _lvp.propria=s.d.propria; _lvTemas=null; toast('Capa pronta! 🎨'); redesenhar(); }
          });
        },5000);
      });
    });
  }; });
}
/* quantas vendas você fez fora do site (WhatsApp, avulso), por história → aparece "🔥 X vendidos" e os mais vendidos vão primeiro */
function htmlVendasPnl(){
  var ts=_lvp.temas||[]; if(!ts.length) return '';
  return '<div style="margin-top:1.2rem;border-top:1px solid #eee;padding-top:1rem"><b>🔥 Quantas vendas você fez</b>'+
    '<p style="margin:.3rem 0 .6rem;font-size:.85rem;color:#666">Coloque as vendas feitas <b>fora do site</b> (WhatsApp, avulso). As do site já contam sozinhas. No site aparece "🔥 X vendidos" e as mais vendidas ficam primeiro. Coloque só vendas que aconteceram de verdade.</p>'+
    ts.map(function(t,i){ var site=((_lvp.vendasSite||{})[t.id])||0;
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid #f3f3f3"><span style="flex:1;min-width:0;font-size:.9rem"><b>'+esc((t.emoji||'📖')+' '+(t.nome||''))+'</b><br><small style="color:#888">site: '+site+' · total: <b data-vtot="'+i+'">'+(site+(t.vendasFora||0))+'</b></small></span>'+
        '<input type="number" min="0" inputmode="numeric" data-vf="'+i+'" value="'+(t.vendasFora||0)+'" style="width:6.5rem;padding:.5rem;border:1px solid #ddd;border-radius:10px;font-size:1rem;text-align:center"></div>'; }).join('')+
    '<div class="lvp-bts"><button id="lvpVendSalvar">Salvar vendas</button></div></div>';
}
function ligarVitrinePnl(){
  var box=el('lvpVit'); if(!box) return;
  function salvar(lista, msg){
    return lvpPost({acao:'exemplos-salvar', exemplos:lista.map(function(x){ return {id:x.id, mostrar:x.mostrar!==false, zap:!!x.zap}; })}).then(function(r){
      if(!r.ok){ toast(r.d.erro||'Não salvou.'); return; }
      _lvp.exemplos=r.d.exemplos; _lvTemas=null; box.innerHTML=htmlVitrinePnl(); ligarVitrinePnl(); if(msg) toast(msg);
    });
  }
  box.querySelectorAll('[data-exm]').forEach(function(b){ b.onclick=function(){
    var l=_lvp.exemplos.slice(), i=+b.dataset.exm, j=i+(+b.dataset.d); if(j<0||j>=l.length) return;
    var x=l[i]; l[i]=l[j]; l[j]=x; salvar(l);
  }; });
  box.querySelectorAll('[data-exv]').forEach(function(b){ b.onclick=function(){
    var l=_lvp.exemplos.slice(), x=l[+b.dataset.exv]; x.mostrar=x.mostrar===false; salvar(l, x.mostrar?'Aparecendo no site.':'Escondido do site.');
  }; });
  box.querySelectorAll('[data-exz]').forEach(function(b){ b.onclick=function(){
    var l=_lvp.exemplos.slice(), x=l[+b.dataset.exz];
    if(!x.zap && l.filter(function(y){ return y.zap; }).length>=2){ toast('Já tem 2 marcados. Desmarque um antes.'); return; }
    x.zap=!x.zap; salvar(l, x.zap?'Vai junto com a prévia no WhatsApp.':'Tirado do WhatsApp.');
  }; });
  box.querySelectorAll('[data-expdf]').forEach(function(b){ b.onclick=function(){
    var id=b.dataset.expdf, out=el('lvpPdf_'+id); b.disabled=true; out.textContent='Preparando os PDFs em alta qualidade…';
    var tent=0;
    (function pedir(){
      lvpPost({acao:'pdf-links',id:id}).then(function(r){
        if(!r.ok){ b.disabled=false; out.textContent=r.d.erro||'Não deu.'; return; }
        if(r.d.links){ b.disabled=false; var L=r.d.links;
          var lk=function(u,t){ return '<a href="'+esc(u)+'" target="_blank" rel="noopener" style="color:#8A5A10;font-weight:800">'+t+'</a>'; };
          out.innerHTML=lk(L.ler,'📱 PDF pra ler')+' · '+lk(L.folhas,'🖨️ Folhas abertas')+' · '+lk(L.livreto,'📖 Livreto')+
            (L.musica1?'<br>'+lk(L.musica1,'🎵 Baixar música 1'):'')+(L.musica2?' · '+lk(L.musica2,'🎵 Baixar música 2'):'');
          return; }
        tent++; if(tent>12){ b.disabled=false; out.textContent='Está demorando. Toque de novo daqui a pouco.'; return; }
        out.textContent='Gerando os PDFs (leva uns 30 segundos)…'; setTimeout(pedir,8000);
      }).catch(function(){ b.disabled=false; out.textContent='Sem conexão.'; });
    })();
  }; });
  box.querySelectorAll('[data-exx]').forEach(function(b){ b.onclick=function(){
    if(b.dataset.ok!=='1'){ b.dataset.ok='1'; b.textContent='Confirmar'; return; }
    var l=_lvp.exemplos.slice(); l.splice(+b.dataset.exx,1); salvar(l,'Tirado da vitrine.');
  }; });
  box.querySelectorAll('[data-vf]').forEach(function(inp){ inp.oninput=function(){ var i=+inp.dataset.vf, t=_lvp.temas[i], tot=box.querySelector('[data-vtot="'+i+'"]'); if(tot) tot.textContent=(((_lvp.vendasSite||{})[t.id])||0)+Math.max(0,parseInt(inp.value,10)||0); }; });
  var bv=el('lvpVendSalvar'); if(bv) bv.onclick=function(){
    box.querySelectorAll('[data-vf]').forEach(function(inp){ var t=_lvp.temas[+inp.dataset.vf]; if(t) t.vendasFora=Math.max(0,parseInt(inp.value,10)||0); });
    bv.disabled=true; bv.textContent='Salvando…';
    lvpPost({acao:'salvar',temas:_lvp.temas}).then(function(r){ bv.disabled=false; bv.textContent='Salvar vendas'; if(!r.ok){ toast(r.d.erro||'Não salvou.'); return; } _lvp.temas=r.d.temas; _lvTemas=null; toast('Vendas salvas! Já aparece no site. 🔥'); }).catch(function(){ bv.disabled=false; bv.textContent='Salvar vendas'; toast('Sem conexão.'); });
  };
  el('lvpExAdd').onclick=function(){
    var id=(el('lvpExId').value||'').trim(); if(!/^L[0-9a-f]{14}$/.test(id)){ toast('Cole o código do livro (começa com L).'); return; }
    var b=el('lvpExAdd'); b.disabled=true; b.textContent='Copiando…';
    lvpPost({acao:'exemplo-add',id:id}).then(function(r){ b.disabled=false; b.textContent='Adicionar'; if(!r.ok){ toast(r.d.erro||'Não deu.'); return; }
      _lvp.exemplos=r.d.exemplos; _lvTemas=null; box.innerHTML=htmlVitrinePnl(); ligarVitrinePnl(); toast('Pronto! Já aparece na página.'); });
  };
  el('lvpExFoto').onchange=function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var leg=(prompt('Legenda da foto (opcional). Ex.: "O livro da Helena impresso"')||'').trim();
    toast('Enviando a foto…');
    lerFoto(f).then(function(foto){ return lvpPost({acao:'exemplo-foto', foto:foto, legenda:leg}); }).then(function(r){
      if(!r.ok){ toast(r.d.erro||'Não deu.'); return; }
      _lvp.exemplos=r.d.exemplos; _lvTemas=null; box.innerHTML=htmlVitrinePnl(); ligarVitrinePnl(); toast('Foto adicionada na vitrine! 📷');
    }).catch(function(){ toast('Não consegui abrir essa foto.'); });
  };
}
/* RELATÓRIO SÓ DO LIVRO: prévias, quem pagou, entregues, com problema e quanto tempo levou */
_lvp.relDias=_lvp.relDias||30;
function lvTempo(ms){ if(ms==null||ms<0) return '—'; var s=Math.round(ms/1000); if(s<90) return s+' s'; var m=Math.round(s/60); if(m<90) return m+' min'; return (m/60).toFixed(1).replace('.',',')+' h'; }
function lvMedia(l){ l=l.filter(function(x){ return x!=null&&x>=0; }); if(!l.length) return null; l.sort(function(a,b){ return a-b; }); return l[Math.floor(l.length/2)]; }
function ligarRelatorioLivros(){
  var box=el('lvpRel'); if(!box) return;
  box.innerHTML='<b>📊 Relatório do Livro Mágico</b><div style="font-size:.85rem;color:#888;margin-top:.3rem">Carregando…</div>';
  lvpPost({acao:'relatorio',dias:_lvp.relDias}).then(function(r){
    if(!r.ok){ box.innerHTML='<b>📊 Relatório do Livro Mágico</b><div style="color:#B4380A">'+esc(r.d.erro||'Não carregou.')+'</div>'; return; }
    var d=r.d, ls=d.livros||[], vendas=ls.filter(function(l){ return l.tipo==='venda'; });
    var prontos=ls.filter(function(l){ return l.status==='pronto'; }), problemas=ls.filter(function(l){ return l.status!=='pronto' && (l.status==='problema' || Date.now()-(l.pagoEm||0)>15*60000); });
    var fazendo=ls.filter(function(l){ return l.status!=='pronto' && problemas.indexOf(l)<0; });
    var fat=vendas.reduce(function(a,l){ return a+(+l.valor||0); },0), conv=d.previas?Math.round(vendas.length/d.previas*1000)/10:0;
    var tLivro=lvMedia(prontos.map(function(l){ return l.prontoEm&&l.pagoEm?l.prontoEm-l.pagoEm:null; })), tPrev=lvMedia(d.temposPrevia||[]);
    function kpi(n,t,cor){ return '<div style="flex:1 1 7.5rem;background:'+(cor||'#F6F2FB')+';border-radius:12px;padding:.55rem .65rem"><div style="font:800 1.25rem Inter,sans-serif">'+n+'</div><div style="font-size:.75rem;color:#555">'+t+'</div></div>'; }
    var dias=Object.keys(d.porDia||{}).sort(), mx=1; dias.forEach(function(k){ mx=Math.max(mx,d.porDia[k].previas,d.porDia[k].pagos); });
    var graf='<div style="display:flex;align-items:flex-end;gap:4px;height:110px;margin:.8rem 0 .2rem;padding-bottom:1.1rem;position:relative">'+dias.map(function(k){ var x=d.porDia[k];
      return '<div style="flex:1;display:flex;align-items:flex-end;gap:1px;height:100%;position:relative" title="'+k.slice(8)+'/'+k.slice(5,7)+': '+x.previas+' prévias, '+x.pagos+' pagos">'+
        '<div style="flex:1;background:#C9B6F2;border-radius:3px 3px 0 0;height:'+(x.previas/mx*100)+'%"></div><div style="flex:1;background:#2FA36B;border-radius:3px 3px 0 0;height:'+(x.pagos/mx*100)+'%"></div>'+
        '<span style="position:absolute;bottom:-1.1rem;left:0;right:0;text-align:center;font-size:.6rem;color:#999">'+k.slice(8)+'</span></div>'; }).join('')+'</div>'+
      '<div style="font-size:.75rem;color:#666"><span style="display:inline-block;width:.7rem;height:.7rem;background:#C9B6F2;border-radius:2px;vertical-align:-1px"></span> prévias &nbsp; <span style="display:inline-block;width:.7rem;height:.7rem;background:#2FA36B;border-radius:2px;vertical-align:-1px"></span> pagos (últimos 14 dias)</div>';
    function linha(l,prob){
      var tp=l.prontoEm&&l.pagoEm?lvTempo(l.prontoEm-l.pagoEm):(l.pagoEm?'há '+lvTempo(Date.now()-l.pagoEm):'—');
      return '<div style="border-top:1px solid #f0f0f0;padding:.5rem 0;font-size:.85rem">'+
        '<div style="display:flex;gap:.5rem;align-items:baseline"><b style="flex:1;min-width:0">'+esc(l.nome||'')+' · '+esc(l.tema||'')+'</b><span>'+(l.tipo==='venda'?'R$ '+(+l.valor).toFixed(2).replace('.',','):l.tipo==='pacote'?'do pacote':'teste')+'</span></div>'+
        '<div style="color:#666">Pago '+(l.pagoEm?new Date(l.pagoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—')+
          ' · ilustrações '+l.ilus+'/'+l.ilusTotal+' · '+(l.status==='pronto'?'pronto em <b>'+tp+'</b>':'<b>'+tp+'</b>')+
          ' · WhatsApp '+(l.entregueEm?'✅ entregue':'⏳ não entregue')+(l.whatsapp?' ('+esc(l.whatsapp)+')':'')+'</div>'+
        (prob&&l.motivo?'<div style="color:#B4380A">Motivo: '+esc(l.motivo)+'</div>':'')+
        (l.status!=='pronto'?'<div style="margin-top:.3rem;display:flex;gap:.4rem;flex-wrap:wrap"><button class="pnl-link" data-reltent="'+esc(l.id)+'">🔍 Ver tentativas</button><a class="pnl-link" href="#/livro/'+esc(l.id)+'" target="_blank" rel="noopener">Abrir o livro</a></div>':'')+'</div>';
    }
    box.innerHTML='<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap"><b style="flex:1">📊 Relatório do Livro Mágico</b>'+
        '<select id="lvpRelDias" style="padding:.35rem;border-radius:8px;border:1px solid #ddd">'+[7,30,90].map(function(n){ return '<option value="'+n+'"'+(n===_lvp.relDias?' selected':'')+'>'+n+' dias</option>'; }).join('')+'</select><button class="pnl-link" id="lvpRelAt">↻</button></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.6rem">'+
        kpi(d.previas,'prévias criadas')+kpi(vendas.length,'livros pagos','#E7F7EE')+kpi(conv.toString().replace('.',',')+'%','das prévias viraram venda')+kpi('R$ '+fat.toFixed(2).replace('.',','),'faturado no livro','#E7F7EE')+
        kpi(prontos.length,'prontos (entregues no site)')+kpi(ls.filter(function(l){ return l.entregueEm; }).length,'entregues no WhatsApp')+kpi(fazendo.length,'sendo feitos agora')+kpi(problemas.length,'com problema / atrasados',problemas.length?'#FFE9E2':'')+
        kpi(lvTempo(tPrev),'tempo da prévia (mediana)')+kpi(lvTempo(tLivro),'pago → livro pronto (mediana)')+'</div>'+graf+
      (problemas.length?'<div style="margin-top:1rem"><b style="color:#B4380A">⚠️ Com problema ou atrasados ('+problemas.length+')</b>'+problemas.map(function(l){ return linha(l,true); }).join('')+'</div>':'')+
      (fazendo.length?'<div style="margin-top:1rem"><b>⏳ Sendo feitos agora ('+fazendo.length+')</b>'+fazendo.map(function(l){ return linha(l,false); }).join('')+'</div>':'')+
      '<details style="margin-top:1rem"><summary style="cursor:pointer;font-weight:700">✅ Prontos ('+prontos.length+')</summary>'+(prontos.map(function(l){ return linha(l,false); }).join('')||'<div style="font-size:.85rem;color:#999">Nenhum ainda.</div>')+'</details>';
    el('lvpRelDias').onchange=function(){ _lvp.relDias=+this.value; ligarRelatorioLivros(); };
    el('lvpRelAt').onclick=ligarRelatorioLivros;
    box.querySelectorAll('[data-reltent]').forEach(function(b){ b.onclick=function(){ lvTentativas(b.dataset.reltent); }; });
  }).catch(function(){ box.innerHTML='<b>📊 Relatório do Livro Mágico</b><div style="color:#B4380A">Sem conexão.</div>'; });
}
/* PAINEL DAS TENTATIVAS (só você vê): cada tentativa com horário e erro, a foto, trocar foto e refazer */
var lvTentEnviando=false;
function lvTentativas(id){
  var velho=el('lvTentM'); if(velho) velho.remove();
  var m=document.createElement('div'); m.id='lvTentM';
  m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);overflow:auto;padding:12px';
  m.innerHTML='<div style="background:#fff;color:#2A1B3D;border-radius:16px;max-width:44rem;margin:0 auto;padding:14px;font:500 .9rem Inter,system-ui,sans-serif">'+
    '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:1.05rem">🔍 Tentativas do livro</b><button type="button" id="lvTentX" class="pnl-link">Fechar</button></div><div id="lvTentC" style="margin-top:10px">Carregando…</div></div>';
  document.body.appendChild(m);
  var iv=null, ocupado=false;
  function fechar(){ clearInterval(iv); m.remove(); }
  el('lvTentX').onclick=fechar;
  function hora(t){ return t?new Date(t).toLocaleTimeString('pt-BR'):'—'; }
  function ha(t){ if(!t) return ''; var s=Math.max(0,Math.round((Date.now()-t)/1000)); return s<120?s+' s':Math.round(s/60)+' min'; }
  var EV={pediu:'🟡 pediu ao Google',falhou:'🔴 falhou',erro:'🔴 erro ao pedir',ok:'🟢 ficou pronta',recomecou:'🔄 recomeçou'};
  function bloco(nome,x){
    if(!x) return '';
    var st=x.ok?'<b style="color:#1E8A4C">✅ pronta</b>':(x.rodando?'<b style="color:#B7791F">🟢 gerando agora</b>':'<b style="color:#2563EB">⏳ vai tentar de novo</b>');
    var h=(x.hist||[]).slice().reverse().map(function(e){ return '<div style="display:flex;gap:8px;padding:3px 0;border-top:1px solid #eee"><span style="color:#888;min-width:5rem">'+hora(e.em)+'</span><span style="min-width:2.2rem;color:#888">'+(e.n?e.n+'ª':'')+'</span><span style="flex:1">'+(EV[e.ev]||e.ev)+(e.msg?'<br><small style="color:#B4380A">'+esc(e.msg)+'</small>':'')+'</span></div>'; }).join('');
    return '<details'+(x.ok?'':' open')+' style="background:#F6F2FB;border-radius:12px;padding:8px 10px;margin-top:8px"><summary style="cursor:pointer"><b>'+nome+'</b> · '+st+' · '+x.tent+' tentativa'+(x.tent===1?'':'s')+(x.recusas?' · '+x.recusas+' recusas do Google':'')+(x.em&&!x.ok?' · última há '+ha(x.em):'')+'</summary>'+
      (!x.ok&&x.msg?'<div style="color:#B4380A;margin:4px 0">Último erro: '+esc(x.msg)+'</div>':'')+
      (h||'<div style="color:#888;padding:4px 0">Histórico com horário começa a aparecer nas próximas tentativas.</div>')+'</details>';
  }
  function carregar(){
    if(ocupado) return;
    lvpPost({acao:'livro-diag',id:id}).then(function(r){
      var c=el('lvTentC'); if(!c) return;
      if(!r.ok){ c.textContent=r.d.erro||'Não carregou.'; return; }
      var g=r.d.diag, ps=g.paginas||[], todas=[g.capa].concat(ps), rodando=todas.some(function(x){ return x&&!x.ok&&x.rodando; }), falta=todas.some(function(x){ return x&&!x.ok; });
      var foto=g.temFoto&&g.token?'/.netlify/functions/livro-img?k='+encodeURIComponent('foto/'+id)+'&t='+g.token:'';
      c.innerHTML='<div style="display:flex;gap:10px;align-items:flex-start;background:#FFF8EC;border-radius:12px;padding:8px 10px">'+
          (foto?'<img src="'+foto+'" alt="Foto enviada" style="width:84px;height:84px;object-fit:cover;border-radius:10px;flex:none">':'<div style="width:84px;height:84px;border-radius:10px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:.75rem;text-align:center;flex:none">sem foto</div>')+
          '<div style="flex:1"><b>'+esc(g.nome||'')+'</b> · '+esc(g.status||'')+' · '+(g.pago?'pago':'prévia')+'<br>'+
          (falta?(g.motor?'⚙️ <b style="color:#1E8A4C">Sistema tentando sozinho agora</b> (confere a cada 2 s)':'⚙️ Sistema volta a conferir em até 3 min')+'<br><small style="color:#888">Esta tela atualiza sozinha a cada 3 s.</small>':'✅ Todas as imagens prontas. Vai sozinho no WhatsApp.')+
          '</div></div>'+
        (falta?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'+
          '<button type="button" class="pnl-link" id="lvTentR"'+(rodando?' disabled style="opacity:.5"':'')+'>🔄 Refazer agora</button>'+
          (g.token?'<label class="pnl-link" style="cursor:pointer;margin:0">📷 Trocar a foto e refazer<input type="file" id="lvTentF" accept="image/*" hidden></label>':'')+'</div>'+
          '<div style="font-size:.8rem;color:#888;margin-top:4px">'+(rodando?'Refazer fica bloqueado só enquanto uma imagem está sendo gerada (uns segundos).':'Refazer: tenta de novo com a mesma foto. Trocar a foto: as imagens que já saíram ficam; só refaz as que faltam.')+' Quando terminar, vai sozinho no WhatsApp do cliente.</div>':'')+
        bloco('Capa',g.capa)+ps.map(function(x,i){ return bloco('Ilustração '+(i+1),x); }).join('');
      var rb=el('lvTentR');
      if(rb) rb.onclick=function(){ rb.disabled=true; ocupado=true;
        lvpPost({acao:'livro-refazer',id:id}).then(function(x){ ocupado=false; toast(x.ok?'Recomeçou! Acompanhe aqui.':(x.d.erro||'Não deu.')); carregar(); }).catch(function(){ ocupado=false; toast('Sem conexão.'); rb.disabled=false; });
      };
      var lb=el('lvTentF'); if(lb&&lb.parentNode) lb.parentNode.onclick=function(){ ocupado=true; setTimeout(function(){ if(!lvTentEnviando) ocupado=false; },90000); };
      var fi=el('lvTentF');
      if(fi) fi.onchange=function(){ var f=this.files&&this.files[0]; if(!f){ ocupado=false; return; } ocupado=true; lvTentEnviando=true; toast('Enviando a foto…');
        lerFoto(f).then(function(ft){ return fetch('/.netlify/functions/livro-previa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trocarFoto:id,t:g.token,foto:ft})}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); }); })
          .then(function(x){ ocupado=false; lvTentEnviando=false; toast(x.ok?'Foto trocada! Já está refazendo o que falta.':(x.d.erro||'Não deu.')); carregar(); })
          .catch(function(){ ocupado=false; lvTentEnviando=false; toast('Não consegui enviar essa foto.'); });
      };
    }).catch(function(){ var c=el('lvTentC'); if(c) c.textContent='Sem conexão.'; });
  }
  carregar(); iv=setInterval(function(){ if(!el('lvTentM')){ clearInterval(iv); return; } carregar(); },3000);
}
/* cria um livro de exemplo direto do painel: prévia (sem trava) → liberado sem pagar → entra sozinho na vitrine */
_lvp.fazendo=_lvp.fazendo||[];
function desenharFilaEx(){
  var f=el('lvpExFila'); if(!f) return;
  f.innerHTML=_lvp.fazendo.map(function(x){ return '<div style="font-size:.85rem;margin:.2rem 0">'+(x.pronto?'✅':'⏳')+' <b>'+esc(x.nome)+'</b>: '+esc(x.txt||'começando…')+' · <a href="#/livro/'+esc(x.id)+'" target="_blank" style="color:#8A5A10;font-weight:700">abrir</a></div>'; }).join('');
}
function ligarExemploEditor(t, salvar){
  desenharFilaEx();
  var bt=el('lvpExCriar'); if(!bt) return;
  bt.onclick=function(){
    var nome=(el('lvpExNome').value||'').trim(), f=el('lvpExFotoC').files&&el('lvpExFotoC').files[0];
    if(nome.length<2){ toast('Escreva o nome da criança.'); return; }
    if(!f){ toast('Escolha a foto da criança.'); return; }
    bt.disabled=true; bt.textContent='Salvando a história…';
    salvar('Salvo.').then(function(ok){
      if(!ok){ bt.disabled=false; bt.textContent='✨ Criar livro de exemplo'; return; }
      bt.textContent='Enviando a foto…';
      return lerFoto(f).then(function(foto){
        return fetch('/.netlify/functions/livro-previa',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':_pnlChave},
          body:JSON.stringify({tema:t.id,nome:nome,idade:+el('lvpExIdade').value,genero:el('lvpExGen').value,foto:foto,aparelho:'admin'})}).then(function(r){ return r.json(); });
      }).then(function(d){
        if(!d||!d.id){ throw new Error((d&&d.erro)||'Não consegui começar.'); }
        lvSalvar({id:d.id,t:d.token,nome:nome,tema:t.id,em:Date.now()});
        return lvpPost({acao:'livro-liberar',id:d.id,exemplo:true}).then(function(r){ if(!r.ok) throw new Error(r.d.erro||'Não consegui liberar.'); return d; });
      }).then(function(d){
        var item={id:d.id,t:d.token,nome:nome,txt:'fazendo a capa e as ilustrações'}; _lvp.fazendo.unshift(item); desenharFilaEx();
        toast('Começou! Em uns 3 a 5 minutos entra sozinho na vitrine. Pode sair desta tela.');
        bt.disabled=false; bt.textContent='✨ Criar livro de exemplo'; el('lvpExNome').value=''; el('lvpExFotoC').value='';
        acompanharEx(item);
      }).catch(function(e){ bt.disabled=false; bt.textContent='✨ Criar livro de exemplo'; toast(e.message||'Sem conexão.'); });
    });
  };
}
function acompanharEx(item){
  var n=0, iv=setInterval(function(){
    n++; if(n>90){ clearInterval(iv); return; }
    fetch('/.netlify/functions/livro-status?id='+item.id+'&t='+encodeURIComponent(item.t),{cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
      if(!d||!d.id) return;
      var ok=(d.paginas||[]).filter(Boolean).length, tot=(d.paginas||[]).length;
      item.txt=d.status==='pronto'?'pronto e já na vitrine ⭐':(d.status==='problema'?'uma imagem não saiu: abra e veja o motivo':(d.capa?'capa pronta · ilustrações '+ok+'/'+(tot||'…'):'fazendo a capa…'));
      if(d.status==='pronto'){ item.pronto=true; clearInterval(iv); _lvTemas=null; fetch('/.netlify/functions/livro-temas?admin=1',{headers:{'x-admin-key':_pnlChave}}).then(function(r){ return r.json(); }).then(function(x){ if(x&&x.exemplos) _lvp.exemplos=x.exemplos; }).catch(function(){}); }
      desenharFilaEx();
    }).catch(function(){});
  },10000);
}
function desenharEditor(){
  var c=el('lvpCaixa'), t=_lvp.temas[_lvp.ed]; if(!t){ _lvp.ed=null; return desenharLvp(); }
  while((t.paginas||[]).length<3) (t.paginas=t.paginas||[]).push({texto:'',cena:''});
  function campo(id,lab,val,area,dica){ return '<label for="'+id+'">'+lab+'</label>'+(area?'<textarea id="'+id+'">'+esc(val||'')+'</textarea>':'<input id="'+id+'" value="'+esc(val||'')+'">')+(dica?'<small style="color:#888">'+dica+'</small>':''); }
  var img=t.vitrineEm?'<img src="/.netlify/functions/livro-img?k='+encodeURIComponent('img/tema/'+t.id)+'&v='+t.vitrineEm+'" alt="" style="width:120px;border-radius:8px;display:block;margin:.4rem 0">':'';
  c.innerHTML='<div class="lvp-it" style="display:block"><div class="lvp-bts" style="margin-top:0"><button class="cl" id="lvpVolta">← Voltar à lista</button></div>'+
    '<div class="lvp-ed">'+
      campo('lvpNome','Nome do tema',t.nome)+campo('lvpTit','Título da capa',t.titulo,false,'Use {nome} pro nome da criança e [o|a] pra palavras de menino/menina.')+
      campo('lvpEmo','Emoji',t.emoji)+campo('lvpDesc','Descrição (aparece na escolha)',t.descricao,true)+
      campo('lvpCores','3 cores (claro, médio, escuro)',(t.cores||[]).join(', '))+
      campo('lvpRoupa','Roupa da criança nas ilustrações (inglês)',t.roupa,true)+
      campo('lvpCapa','Cena da capa (inglês)',t.capa,true)+
      '<p style="font-size:.82rem;color:#7a6f86;margin:.8rem 0 0">Cada página tem um texto e pode ter uma ilustração. Pra deixar a história mais comprida <b>sem gastar mais</b>, adicione páginas <b>📝 só texto</b> (grátis). Ilustrações novas: no máximo 5. Dica: no livro aberto, a página da esquerda é texto e a da direita é a ilustração; páginas só de texto ficam lado a lado, então use de 2 em 2.</p>'+
      t.paginas.map(function(p,i){
        var rep=(p.usa===0||p.usa)?+p.usa:-1;
        var ops='<option value="-1">🎨 Ilustração nova (gerada pela IA)</option><option value="so"'+(p.so?' selected':'')+'>📝 Só texto (sem ilustração, grátis)</option>'+t.paginas.map(function(q,j){ return (j===i||(q.usa===0||q.usa)||q.so)?'':'<option value="'+j+'"'+(rep===j&&!p.so?' selected':'')+'>🔁 Repetir a ilustração da página '+(j+1)+'</option>'; }).join('');
        return '<div class="lvp-cena"><div style="display:flex;justify-content:space-between;align-items:center"><b>Página '+(i+1)+'</b>'+(t.paginas.length>3?'<button class="pnl-link" data-lvprm="'+i+'" style="padding:.25rem .6rem">Remover</button>':'')+'</div>'+
          campo('lvpTx'+i,'Texto da página (português)',p.texto,true)+
          '<label for="lvpUs'+i+'">Ilustração</label><select id="lvpUs'+i+'" data-lvpus="'+i+'">'+ops+'</select>'+
          '<div id="lvpCeBox'+i+'"'+(rep>=0||p.so?' hidden':'')+'>'+campo('lvpCe'+i,'O que aparece na ilustração (inglês ou português)',p.cena,true)+'</div></div>';
      }).join('')+
      (t.paginas.length<16?'<div class="lvp-bts"><button class="cl" id="lvpAddPg">+ Adicionar página</button></div>':'')+
      campo('lvpLetra','Letra da música',t.letra,true,'Comece com "Era uma vez… {nome}". Use {nome} no refrão.')+
      campo('lvpEst','Estilo da música',t.estiloMusica)+
      campo('lvpOrd','Ordem na página (desempate)',t.ordem)+
      '<label for="lvpVend">Vendas feitas fora do site (WhatsApp, avulso)</label><input id="lvpVend" type="number" min="0" inputmode="numeric" value="'+(t.vendasFora||0)+'">'+
      '<small style="color:#888">Vendas pelo site (contadas sozinhas): <b>'+(((_lvp.vendasSite||{})[t.id])||0)+'</b>. O total aparece no site como "🔥 X vendidos" e os mais vendidos ficam primeiro. Coloque só vendas que aconteceram de verdade.</small>'+
      '<div class="lvp-cena" style="background:#FFF6E0;margin-top:1rem"><b>📖 Livros de exemplo desta história</b>'+
        '<p style="font-size:.82rem;color:#7a6f86;margin:.3rem 0 .5rem">Crie aqui um livro completo de exemplo, <b>sem pagar</b>. Quando ficar pronto (uns 3 a 5 minutos), ele entra <b>sozinho na vitrine</b> e vira o "Folhear" desta história. Pode criar vários (menino e menina, por exemplo).</p>'+
        (function(){ var ex=(_lvp.exemplos||[]).filter(function(x){ return x.tipo==='livro'&&x.tema===t.id; });
          return ex.length?'<div style="font-size:.85rem;margin-bottom:.4rem">Já na vitrine: '+ex.map(function(x){ return '<b>'+esc(x.nome)+'</b>'; }).join(', ')+'</div>':''; })()+
        '<div id="lvpExFila"></div>'+
        '<label for="lvpExNome">Nome da criança</label><input id="lvpExNome" maxlength="30" placeholder="Ex.: Davi">'+
        '<div style="display:flex;gap:.5rem"><div style="flex:1"><label for="lvpExGen">Menino ou menina</label><select id="lvpExGen"><option value="menino">Menino</option><option value="menina">Menina</option></select></div>'+
        '<div style="flex:1"><label for="lvpExIdade">Idade</label><select id="lvpExIdade">'+[1,2,3,4,5,6,7,8,9,10].map(function(n){ return '<option'+(n===5?' selected':'')+'>'+n+'</option>'; }).join('')+'</select></div></div>'+
        '<label for="lvpExFotoC">Foto da criança</label><input type="file" id="lvpExFotoC" accept="image/*">'+
        '<div class="lvp-bts"><button class="ouro" id="lvpExCriar">✨ Criar livro de exemplo</button></div></div>'+
      '<label>Capa de vitrine (exemplo da página inicial)</label>'+img+
      '<div class="lvp-bts"><button class="cl" data-vit="menino">Gerar com menino</button><button class="cl" data-vit="menina">Gerar com menina</button></div>'+
    '</div>'+
    '<div class="lvp-bts"><button id="lvpSalvar">💾 Salvar</button>'+
      (t.status==='publicado'?'<button class="cl" id="lvpPub">Tirar do site</button>':'<button class="ouro" id="lvpPub">✅ Aprovar e publicar</button>')+
      '<button class="cl" id="lvpDel">Excluir</button></div></div>';
  function ler(){
    t.nome=el('lvpNome').value; t.titulo=el('lvpTit').value; t.emoji=el('lvpEmo').value; t.descricao=el('lvpDesc').value;
    t.cores=el('lvpCores').value.split(',').map(function(x){ return x.trim(); }).filter(Boolean).slice(0,3);
    t.roupa=el('lvpRoupa').value; t.capa=el('lvpCapa').value; t.letra=el('lvpLetra').value; t.estiloMusica=el('lvpEst').value; t.ordem=+el('lvpOrd').value||99; t.vendasFora=Math.max(0,parseInt(el('lvpVend').value,10)||0);
    t.paginas=t.paginas.map(function(p,i){ var v=el('lvpUs'+i).value, o={texto:el('lvpTx'+i).value, cena:el('lvpCe'+i).value}; if(v==='so'){ o.so=true; o.cena=''; } else if(+v>=0) o.usa=+v; return o; });
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
  ligarExemploEditor(t, salvar);
  c.querySelectorAll('[data-lvpus]').forEach(function(sel){ sel.onchange=function(){ var b=el('lvpCeBox'+sel.dataset.lvpus); if(b) b.hidden=sel.value==='so'||+sel.value>=0; }; });
  var add=el('lvpAddPg'); if(add) add.onclick=function(){ ler(); t.paginas.push({texto:'',cena:'',so:true}); desenharEditor(); var x=el('lvpTx'+(t.paginas.length-1)); if(x){ x.scrollIntoView({block:'center'}); x.focus(); } };
  c.querySelectorAll('[data-lvprm]').forEach(function(b){ b.onclick=function(){ ler(); var k=+b.dataset.lvprm; t.paginas.splice(k,1);
    t.paginas.forEach(function(p){ if(p.usa===0||p.usa){ if(+p.usa===k) delete p.usa; else if(+p.usa>k) p.usa=+p.usa-1; } }); desenharEditor(); }; });
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
