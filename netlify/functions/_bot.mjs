import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, enviarLista, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos, SITE } from './_zap.mjs';
import { lerIndice, idsDoTel } from './_indice.mjs';

// ROBÔ DE CRIAR MÚSICA PELO WHATSAPP — mesmas opções do site.
// Ordem: pra quem → (nome) → quem recebe é ela/ele → você é → ocasião → história → estilo → voz → cria.
// Respostas a quem chamou primeiro = grátis, sem modelo aprovado.

const PARA = [
  ['namorado', '💗 Namorada / Namorado'], ['esposa', '💍 Esposa / Marido'], ['mae', '👩 Mãe / Pai'],
  ['filho', '🧒 Filho / Filha'], ['irmao', '👫 Irmã / Irmão'], ['amigo', '🤝 Amiga / Amigo'],
  ['avo', '👵 Vó / Vô'], ['louvor', '🙏 Louvor a Deus'], ['familia', '👨‍👩‍👧 Família toda'],
  ['tio', '🧑 Tia / Tio'], ['sogro', '🏡 Sogra / Sogro'], ['padrinho', '🙏 Dinda / Padrinho'],
  ['comercial', '📣 Empresa (propaganda)'], ['outro', '✍️ Outra pessoa'], ['ninguem', '🎵 Não é pra ninguém']
];
const DUPLO = { namorado: ['Namorada', 'Namorado'], esposa: ['Esposa', 'Marido'], mae: ['Mãe', 'Pai'], filho: ['Filha', 'Filho'],
  irmao: ['Irmã', 'Irmão'], amigo: ['Amiga', 'Amigo'], avo: ['Vó', 'Vô'], tio: ['Tia', 'Tio'], sogro: ['Sogra', 'Sogro'], padrinho: ['Dinda', 'Padrinho'] };
const OCASIOES = ['🎂 Aniversário', '💎 Aniversário de casamento', '💝 Dia dos Namorados', '🌷 Dia das Mães', '👔 Dia dos Pais',
  '💌 Declaração de amor', '💍 Pedido de namoro', '💞 Aniversário de namoro', '🎓 Formatura', '👶 Chá revelação', '🎁 Surpresa',
  '🌟 Homenagem', '💒 Casamento', '🕊️ Batizado', '👵 Dia dos Avós', '😂 Só pra zoar', '📣 Propaganda da empresa', '💛 Só porque sim'];
const OCASIOES_LOUVOR = ['🙌 Adoração / momento com Deus', '🙏 Gratidão a Deus', '🏆 Testemunho de vitória', '⛪ Louvor pra igreja / culto',
  '🎂 Aniversário abençoado', '💒 Casamento cristão', '🕊️ Batismo', '📖 Homenagem a pastor(a)', '💧 Cura e restauração', '👨‍👩‍👧 Família abençoada'];
// [chave, título, descrição, grupo]
const GRUPOS = [['sertanejo', '🤠 Sertanejo'], ['pagode', '🪘 Pagode'], ['gospel', '🙏 Gospel / Louvor'], ['romantica', '💗 Romântica'],
  ['piseiro', '🎹 Piseiro'], ['forro', '🪗 Forró'], ['arrocha', '🌙 Arrocha / Sofrência'], ['melody', '💜 Melody / Brega'],
  ['rap', '🎧 Rap / Trap'], ['infantil', '🧸 Infantil']];
const SUB = [
  ['sertanejo', 'Sertanejo moderno', 'vibe Zé Neto & Cristiano, Hugo & Guilherme', 'sertanejo'],
  ['sertanejosofrencia', 'Sofrência', 'vibe Henrique & Juliano, Marília Mendonça', 'sertanejo'],
  ['sertanejoagro', 'Agronejo animado', 'vibe Ana Castela, Luan Pereira', 'sertanejo'],
  ['sertanejoraiz', 'Sertanejo raiz', 'vibe Tião Carreiro, Chitãozinho & Xororó', 'sertanejo'],
  ['pagode', 'Pagode atual', 'vibe Menos é Mais, Ferrugem', 'pagode'],
  ['pagoderomantico', 'Pagode romântico', 'vibe Thiaguinho, Dilsinho', 'pagode'],
  ['pagode90', 'Pagode anos 90', 'vibe Raça Negra, Só Pra Contrariar', 'pagode'],
  ['pagodao', 'Pagodão baiano', 'vibe Harmonia do Samba, Parangolé', 'pagode'],
  ['infantil', 'Infantil animada', 'voz adulta, alegre · vibe Galinha Pintadinha', 'infantil'],
  ['infantileducativa', 'Educativa', 'cores, números · vibe Mundo Bita', 'infantil'],
  ['infantilpeq', 'Voz de criança pequena', 'cantada por criança de 3 a 5 anos', 'infantil'],
  ['infantilcrianca', 'Voz de criança', 'cantada por criança de 6 a 10 anos', 'infantil'],
  ['infantilninar', 'Canção de ninar', 'suave pra dormir', 'infantil'],
  ['gospel', 'Adoração ao vivo', 'vibe Isadora Pompeu, Fernandinho', 'gospel'],
  ['gospelvv', 'Voz e violão', 'gospel intimista e suave', 'gospel'],
  ['gospelcelebra', 'Louvor animado', 'celebração, pra cantar junto', 'gospel'],
  ['gospeltrad', 'Assembleia / Hino', 'tradicional, com teclado e coral', 'gospel'],
  ['catolica', 'Católica', 'música de igreja católica', 'gospel'],
  ['romantica', 'Piano e cordas', 'emocionante, de casamento', 'romantica'],
  ['romanticapop', 'Pop romântico', 'vibe Luan Santana, Tiago Iorc', 'romantica'],
  ['romanticavv', 'Voz e violão', 'vibe Anavitória, Vitor Kley', 'romantica'],
  ['romanticasoul', 'R&B / Soul', 'vibe Melim, Iza', 'romantica'],
  ['piseiro', 'Piseiro / Pisadinha', 'vibe Barões da Pisadinha', 'piseiro'],
  ['piseiroromantico', 'Piseiro apaixonado', 'vibe João Gomes, Tarcísio do Acordeon', 'piseiro'],
  ['piseiroparedao', 'Piseiro de paredão', 'vibe Zé Vaqueiro, Vitor Fernandes', 'piseiro'],
  ['forroromantico', 'Forró romântico', 'vibe Tarcísio do Acordeon, João Gomes', 'forro'],
  ['forroeletronico', 'Forró eletrônico', 'vibe Wesley Safadão, Xand Avião', 'forro'],
  ['forro', 'Forró pé de serra', 'vibe Luiz Gonzaga', 'forro'],
  ['xote', 'Xote / Baião', 'vibe Falamansa', 'forro'],
  ['arrocha', 'Arrocha', 'vibe Pablo', 'arrocha'],
  ['arrochaatual', 'Arrocha atual', 'vibe Nadson O Ferinha, Thiago Aquino', 'arrocha'],
  ['seresta', 'Seresta', 'vibe Silvanno Salles', 'arrocha'],
  ['melody', 'Melody atual', 'vibe Viviane Batidão', 'melody'],
  ['bregamarcante', 'Melody marcante / Brega', 'vibe Banda Calypso, Joelma', 'melody'],
  ['tecnobrega', 'Tecnobrega', 'vibe Gaby Amarantos', 'melody'],
  ['batidao', 'Batidão', 'grave de paredão', 'melody'],
  ['raproma', 'Rap romântico', 'vibe Projota, Filipe Ret', 'rap'],
  ['rapnacional', 'Rap nacional', 'vibe Racionais, Emicida', 'rap'],
  ['trap', 'Trap', 'vibe Matuê, Veigh', 'rap']
];
const AVULSOS = [['natal', '🎄 Natalina'], ['funk', '🔊 Funk atual'], ['funkantigo', '📻 Funk antigo'], ['rock', '🎸 Rock'],
  ['samba', '🥁 Samba'], ['sambaraiz', '🪇 Samba de raiz'], ['mpb', '☕ MPB'], ['pop', '✨ Pop'], ['eletronica', '🎛️ Eletrônica'],
  ['anos90', '💿 Anos 90'], ['jingle', '📣 Comercial / Chiclete'], ['bregafunk', '💃 Brega funk'], ['carimbo', '🥁 Carimbó'],
  ['bregaromantico', '💔 Brega romântico'], ['sambaenredo', '🎭 Samba-enredo'], ['choro', '🪈 Choro'], ['vanera', '🐎 Vanerão gaúcho'],
  ['frevo', '☂️ Frevo'], ['lambada', '🌺 Lambada'], ['boibumba', '🐂 Boi-bumbá'], ['axe', '🌞 Axé'], ['funkcria', '🧢 Funk de cria'],
  ['eletrofunk', '⚡ Eletrofunk'], ['jovemguarda', '🎙️ Jovem Guarda'], ['bossa', '🌊 Bossa Nova'], ['anos80', '📼 Anos 80'],
  ['anos70', '🪩 Anos 70'], ['anos60', '🕺 Anos 60'], ['reggae', '🌴 Reggae'], ['lofi', '🎧 Lo-Fi'], ['jazz', '🎷 Jazz'],
  ['blues', '🎺 Blues'], ['zoeira', '🤪 Modo trollagem'], ['outro', '✍️ Outro (eu escrevo)']];
const ESTILOS_TOPO = GRUPOS.map(([k, t]) => ['g.' + k, t]).concat(AVULSOS.map(([k, t]) => ['s.' + k, t]));

const H2 = 2 * 3600 * 1000, H24 = 24 * 3600 * 1000;
const LIMITE_DIA = 3;
const loja = () => getStore('whatsapp');
const chaveConv = (n) => 'bot_' + chaveNum(n);
const salvar = async (n, c) => { c.em = Date.now(); await loja().setJSON(chaveConv(n), c); };
const limpar = async (n) => { await loja().delete(chaveConv(n)).catch(() => {}); };
const nomeSub = (k) => (SUB.find((x) => x[0] === k) || [])[1] || (AVULSOS.find((x) => x[0] === k) || [])[1] || k;

// lista com páginas: 9 opções + "Mais opções" (WhatsApp aceita no máximo 10)
function pagina(opcoes, pag, prefixo) {
  const ini = pag * 9;
  const resto = opcoes.length - ini;
  const fatia = resto <= 10 ? opcoes.slice(ini) : opcoes.slice(ini, ini + 9);
  const linhas = fatia.map(([v, t, d]) => [prefixo + ':' + v, t, d]);
  if (resto > 10) linhas.push([prefixo + ':+', '➕ Mais opções', 'ver o restante']);
  return linhas;
}

export async function boasVindas(para) {
  return enviarBotoes(para,
    '🎵 Olá! Seja bem-vindo(a) à *Capivarinha Love*! 💗\n\n' +
    'Criamos uma *música personalizada* com o nome e a história de quem você ama, pronta em poucos minutos.\n\n' +
    'O que você quer fazer?\n\n' +
    '🌐 _Prefere criar pelo site? ' + SITE + '/#/criar/musica_',
    [['ini:zap', '🎵 Criar uma música'], ['ini:minha', '🎶 Receber minha música'], ['ini:atend', '💬 Atendimento']]);
}

// Procura as músicas de um número e manda pro cliente. Volta quantas achou.
async function mandarMusicasDoNumero(para, tel) {
  let ent = { p: [], t: [] };
  try { ent = await idsDoTel(tel, await lerIndice()); } catch (e) {}
  const presentes = getStore('presentes');
  const peds = (await Promise.all(ent.p.slice(-15).map((id) => presentes.get(id, { type: 'json' }).catch(() => null)))).filter(Boolean);
  const pagos = peds.filter((g) => g.pago && !g.cancelado && temMusica(g)).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0)).slice(0, 2);
  if (pagos.length) {
    for (const g of pagos) {
      const quando = new Date(g.pagoEm || g.criadoEm || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
      await enviarTexto(para, '🎶 Achei! Música' + (g.musicaParaNome ? ' pra *' + g.musicaParaNome + '*' : '') + ' (paga em ' + quando + '):\n' + linkPedido(g));
      await entregarAudiosPagos(para, g, false);
    }
    await registrar('reenviou', { para, tel: String(tel), pedidos: pagos.map((g) => g.id).join(',') });
    return pagos.length;
  }
  // não pagou ainda: manda a prévia mais recente
  const musicas = getStore('musicas');
  const ms = (await Promise.all(ent.t.slice(-10).map(async (t) => { const m = await musicas.get(t, { type: 'json' }).catch(() => null); return m && m.url ? Object.assign({ t }, m) : null; }))).filter(Boolean)
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  if (ms.length) {
    const m = ms[0];
    await enviarTexto(para, '🎵 Achei a sua prévia' + (m.nomes ? ' pra *' + m.nomes + '*' : '') + '! Ainda falta finalizar o pagamento pra liberar a música completa:\n' + SITE + '/#/ouvir/t.' + m.t);
    await registrar('reenviou', { para, tel: String(tel), previa: m.t });
    return 1;
  }
  return 0;
}

async function perguntar(de, c) {
  const d = c.d, e = c.etapa;
  if (e === 'para') return enviarLista(de, '🎵 Vamos criar sua música!\n\n*Pra quem é a música?*\n\n_(pra parar a qualquer momento, mande "cancelar")_', 'Escolher', pagina(PARA, c.pag || 0, 'para'));
  if (e === 'paraOutro') return enviarTexto(de, '✍️ Me conta *pra quem é* a música (ex: minha professora, meu chefe, meu cachorro...)');
  if (e === 'nome') {
    if (d.para === 'comercial') return enviarTexto(de, '📣 Qual o *nome da empresa ou marca*? Ele vai ser cantado no refrão.');
    if (d.para === 'louvor') return enviarBotoes(de, '🙏 Quer citar algum *nome* na música? (o seu, da sua família ou da sua igreja)\n\nEscreva o nome, ou toque em Pular.', [['nome:pular', 'Pular ▶️']]);
    if (d.para === 'familia') return enviarTexto(de, '👨‍👩‍👧 Qual o *nome da família* ou das pessoas? (ex: Família Silva, ou Ana, João e Pedro)');
    if (d.para === 'ninguem') return enviarBotoes(de, '🎵 Quer citar algum *nome* na música? Escreva, ou toque em Pular.', [['nome:pular', 'Pular ▶️']]);
    return enviarTexto(de, '💗 Qual o *nome de quem vai receber*?\n\nEscreva do jeitinho que deve aparecer na letra (nome ou apelido).');
  }
  if (e === 'pgen') {
    const du = DUPLO[d.para];
    return enviarBotoes(de, du ? 'É pra quem?' : (d.para === 'ninguem' ? 'A música fala de:' : 'Quem vai receber é:'),
      du ? [['pgen:ela', du[0]], ['pgen:ele', du[1]]] : [['pgen:ela', '👩 Mulher'], ['pgen:ele', '👨 Homem'], ['pgen:neutro', '🤝 Neutro']]);
  }
  if (e === 'de') return enviarBotoes(de, 'E *você* é? (assim a letra fala certinho: "grata" ou "grato")', [['de:mulher', '👩 Mulher'], ['de:homem', '👨 Homem'], ['de:neutro', '🤝 Neutro']]);
  if (e === 'ocasiao') {
    const lista = (d.para === 'louvor' ? OCASIOES_LOUVOR : OCASIOES).map((t, i) => [String(i), t]);
    return enviarLista(de, d.para === 'louvor' ? '🙏 Qual é o *propósito* desse louvor?' : '🎉 Qual é a *ocasião*?', 'Escolher', pagina(lista, c.pag || 0, 'oc'));
  }
  if (e === 'historia') return enviarTexto(de,
    (d.para === 'louvor'
      ? '🙏 Agora me conta: *o que Deus fez na sua vida?* Um testemunho, um momento difícil em que Ele te sustentou, pelo que você é grato...'
      : '✍️ Agora a parte mais importante: *conta a história!*\n\nComo se conheceram, apelidos, momentos marcantes, o que você sente...') +
    '\n\n📏 *Mínimo de 50 letras* (umas 2 ou 3 frases). Quanto mais detalhes, mais emocionante fica.\n🎤 Pode *escrever* ou mandar *áudio*.');
  if (e === 'estilo') {
    if (d.para === 'louvor') return enviarLista(de, '🎶 Qual estilo de louvor combina com você?', 'Ver estilos', SUB.filter((x) => x[3] === 'gospel').map(([k, t, ds]) => ['sub:' + k, t, ds]));
    return enviarLista(de, '🎶 Qual *estilo musical*?', 'Ver estilos', pagina(ESTILOS_TOPO, c.pag || 0, 'est'));
  }
  if (e === 'sub') return enviarLista(de, '🎶 Qual tipo de *' + (GRUPOS.find((g) => g[0] === d.grupo) || ['', ''])[1].replace(/^\S+\s/, '') + '*?', 'Escolher', SUB.filter((x) => x[3] === d.grupo).map(([k, t, ds]) => ['sub:' + k, t, ds]));
  if (e === 'estiloOutro') return enviarTexto(de, '✍️ Escreva o *estilo* que você quer (ex: "reggaeton", "valsa", "rock anos 2000")');
  if (e === 'voz') return enviarBotoes(de, '🎤 Qual *voz* vai cantar?', [['voz:masculina', '👨 Masculina'], ['voz:feminina', '👩 Feminina'], ['voz:dueto', '👫 Dueto']]);
}

async function disparar(de, d, modo, extra) {
  await fetch(SITE + '/.netlify/functions/bot-criar-background', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ numero: de, d, modo, chave: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() }, extra || {}))
  }).catch((err) => console.error('bot: falha ao disparar ' + modo, err && err.message));
}
async function escreverLetra(de, c, modo, instrucao) {
  c.etapa = 'escrevendo'; await salvar(de, c);
  await enviarTexto(de, modo === 'ajuste' ? '✏️ Ajustando a letra... só um instante!' : '✍️ Escrevendo a letra' + (c.d.nome ? ' pra *' + c.d.nome + '*' : '') + '... leva uns 20 segundinhos!');
  await disparar(de, c.d, modo, { instrucao });
}

// próxima etapa depois de "atual"
function proxima(c) {
  const d = c.d, e = c.etapa;
  const ordem = ['para', 'paraOutro', 'nome', 'pgen', 'de', 'ocasiao', 'historia', 'estilo', 'sub', 'estiloOutro', 'voz', 'criar'];
  for (let i = ordem.indexOf(e) + 1; i < ordem.length; i++) {
    const x = ordem[i];
    if (x === 'paraOutro' && d.para !== 'outro') continue;
    if (x === 'pgen' && ['familia', 'louvor', 'comercial'].includes(d.para)) continue;
    if (x === 'de' && d.para === 'comercial') continue;
    if (x === 'sub' && !d.grupo) continue;
    if (x === 'estiloOutro' && d.estilo !== 'outro') continue;
    if (x === 'voz' && /^infantil(peq|crianca)$/.test(d.estilo)) { d.voz = 'feminina'; continue; }
    return x;
  }
  return 'criar';
}

// Volta true se o robô cuidou da mensagem
export async function tratarBot(msg) {
  const de = String(msg.from);
  const ir = msg.interactive && (msg.interactive.button_reply || msg.interactive.list_reply);
  const id = (ir && ir.id) || '';
  const texto = String((msg.text && msg.text.body) || (ir && ir.title) || '').trim();
  const baixo = texto.toLowerCase();
  const [pref, val] = id ? [id.split(':')[0], id.slice(id.indexOf(':') + 1)] : ['', ''];

  let c = await loja().get(chaveConv(de), { type: 'json' }).catch(() => null);
  if (c && Date.now() - (c.em || 0) > H2) { await limpar(de); c = null; }

  if (/^(cancelar|parar|sair)$/.test(baixo)) {
    if (c) { await limpar(de); await registrar('cancelou', { numero: de, etapa: c.etapa }); await enviarTexto(de, 'Tudo bem, cancelei 😊 Quando quiser, é só mandar *"criar música"*.'); return true; }
    return false;
  }
  // menu inicial
  if (pref === 'ini') {
    if (val === 'site') { await enviarTexto(de, '🌐 Crie pelo site, é rapidinho:\n' + SITE + '/#/criar/musica\n\nQuando a prévia ficar pronta, toque em *"Receber no WhatsApp"* que eu te mando aqui. 💗'); return true; }
    if (val === 'atend') {
      await limpar(de);
      await loja().setJSON('humano_' + chaveNum(de), { em: Date.now(), numero: de });
      await registrar('atendimento', { numero: de });
      await enviarTexto(de, '💬 Pode mandar sua dúvida por aqui que a nossa equipe responde assim que possível. 💗');
      return true;
    }
  }
  const querMinha = (pref === 'ini' && val === 'minha') || (!c || c.etapa === 'criando') && /(minha|receber|cad[eê]|enviar?|mandar?).{0,25}m[uú]sica|j[aá] (comprei|paguei)|^paguei/.test(baixo);
  if (querMinha) {
    await enviarTexto(de, '🔎 Procurando suas músicas...');
    const n = await mandarMusicasDoNumero(de, de);
    if (n) { if (c && c.etapa !== 'criando') await limpar(de); return true; }
    c = { etapa: 'tel', d: { tentativas: 0 } }; await salvar(de, c);
    await enviarTexto(de, 'Não achei pedidos neste número 🤔\n\nQual o *número de WhatsApp que você usou no pedido*? (com DDD, ex: 91 98888-7777)');
    return true;
  }
  const querCriar = (pref === 'ini' && val === 'zap') || /\b(criar|cria|fazer|faz|quero|gerar)\b.*\bm[uú]sica\b|^criar$/.test(baixo);
  if (querCriar && (!c || c.etapa === 'criando')) {
    c = { etapa: 'para', d: {}, pag: 0 };
    await loja().delete('humano_' + chaveNum(de)).catch(() => {});
    await salvar(de, c); await perguntar(de, c);
    await registrar('conversa', { numero: de });
    return true;
  }
  if (!c) return false;
  if (pref === 'ini') return true; // botão antigo do menu: ignora

  const d = c.d, e = c.etapa;
  // botão/lista de uma pergunta ANTERIOR (toque repetido) → ignora em silêncio
  const esperado = { para: 'para', nome: 'nome', pgen: 'pgen', de: 'de', ocasiao: 'oc', historia: 'h', estilo: e === 'estilo' && d.para === 'louvor' ? 'sub' : 'est', sub: 'sub', voz: 'voz', letra: 'letra' }[e];
  if (id && pref !== esperado) return true;

  if (e === 'tel') {
    const dig = texto.replace(/\D/g, '');
    if (dig.length < 10) { await enviarTexto(de, 'Me manda o número com DDD, por favor (ex: 91 98888-7777) 😊'); return true; }
    await enviarTexto(de, '🔎 Procurando...');
    if (await mandarMusicasDoNumero(de, dig)) { await limpar(de); return true; }
    d.tentativas = (d.tentativas || 0) + 1; await salvar(de, c);
    if (d.tentativas >= 2) {
      await limpar(de);
      await enviarBotoes(de, 'Não encontrei nenhum pedido nesse número 😕 Pode ser que o pedido tenha sido feito com outro número.\n\nQuer falar com a nossa equipe?', [['ini:atend', '💬 Atendimento'], ['ini:zap', '🎵 Criar uma música']]);
    } else await enviarTexto(de, 'Não achei nada nesse número 🤔 Confere e me manda de novo (com DDD).');
    return true;
  }
  if (e === 'escrevendo') { await enviarTexto(de, '✍️ Ainda estou escrevendo a letra, só um instante!'); return true; }
  if (e === 'ajuste') {
    if (texto.length < 3 || id) { await enviarTexto(de, '✏️ Me diga *o que você quer mudar* na letra (ex: "cita a nossa viagem pra praia", "muda o refrão", "tira a palavra saudade").'); return true; }
    await escreverLetra(de, c, 'ajuste', texto.slice(0, 500)); return true;
  }
  if (e === 'letra' && !id && texto.length >= 3 && msg.type !== 'audio') { await escreverLetra(de, c, 'ajuste', texto.slice(0, 500)); return true; }
  if (e === 'letra') {
    if (val === 'ajustar') { c.etapa = 'ajuste'; await salvar(de, c); await enviarTexto(de, '✏️ O que você quer *mudar na letra*?\n\nEx: "cita a nossa viagem pra praia", "muda o refrão", "coloca o apelido Mozão".'); return true; }
    if (val === 'nova') {
      if ((d.nLetras || 0) >= 5) { await enviarTexto(de, 'Já escrevi 5 letras 😅 Escolha *Gerar a música* ou *Ajustar* a última.'); return true; }
      await escreverLetra(de, c, 'letra'); return true;
    }
    if (val !== 'ok') return true;
    // letra aprovada → grava a música (abaixo)
  } else
  if (e === 'criando') { await enviarTexto(de, '🎶 Sua música está sendo criada, já já chega aqui! Pra criar outra, mande *"criar música"*.'); return true; }

  // áudio: só vale na história
  if (msg.type === 'audio') {
    if (e === 'historia' && msg.audio && msg.audio.id) {
      await enviarTexto(de, '🎧 Ouvindo seu áudio... só um instante!');
      await fetch(SITE + '/.netlify/functions/bot-audio-background', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: de, midia: msg.audio.id, chave: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() })
      }).catch(() => {});
    } else await enviarTexto(de, 'Nessa parte me responde por *texto* ou tocando nos botões, por favor 😊');
    return true;
  }

  // "Mais opções" nas listas
  if (val === '+') { c.pag = (c.pag || 0) + 1; await salvar(de, c); await perguntar(de, c); return true; }

  let ok = false;
  if (e === 'para') {
    const p = PARA.find((x) => x[0] === val) || (texto && PARA.find((x) => x[1].toLowerCase().includes(baixo.slice(0, 5))));
    if (p) { d.para = p[0]; ok = true; }
  } else if (e === 'paraOutro') {
    if (texto.length >= 3) { d.paraOutro = texto.slice(0, 120); ok = true; }
  } else if (e === 'nome') {
    if (id === 'nome:pular') { d.nome = ''; ok = true; }
    else { const n = texto.replace(/[^\p{L}\p{N} &'.,-]/gu, '').trim().slice(0, 80); if (n.length >= 2) { d.nome = n; ok = true; } }
  } else if (e === 'pgen') {
    if (['ela', 'ele', 'neutro'].includes(val)) { d.paraGen = val; ok = true; }
  } else if (e === 'de') {
    if (['mulher', 'homem', 'neutro'].includes(val)) { d.de = val; ok = true; }
  } else if (e === 'ocasiao') {
    const lista = d.para === 'louvor' ? OCASIOES_LOUVOR : OCASIOES;
    const o = id ? lista[+val] : lista.find((t) => t.toLowerCase().includes(baixo.slice(0, 6)));
    if (o) { d.ocasiao = o.replace(/^\S+\s/, ''); ok = true; }
    else if (!id && texto.length >= 3) { d.ocasiao = texto.slice(0, 60); ok = true; }
  } else if (e === 'historia') {
    if (id === 'h:ok') ok = (d.historia || '').length >= 50;
    else if (texto) {
      d.historia = ((d.historia || '') + '\n' + texto).trim().slice(0, 1500);
      const n = d.historia.length;
      await salvar(de, c);
      if (n < 50) await enviarTexto(de, '📝 Ainda está curtinho: tem *' + n + '* de no mínimo *50 letras*. Manda mais um pouquinho! 🥰');
      else await enviarBotoes(de, (c.jaAnotou ? '➕ Adicionei!' : '✅ História anotada!') + '\n\nQuer contar mais algum detalhe? É só mandar. Se já está bom, toque em *Continuar*.', [['h:ok', 'Continuar ▶️']]);
      if (n >= 50 && !c.jaAnotou) { c.jaAnotou = true; await salvar(de, c); }
      return true;
    }
  } else if (e === 'estilo') {
    if (pref === 'sub') { d.estilo = val; ok = true; }
    else if (val.startsWith('g.')) { d.grupo = val.slice(2); ok = true; }
    else if (val.startsWith('s.')) { d.estilo = val.slice(2); ok = true; }
    else if (texto) {
      const g = GRUPOS.find((x) => x[1].toLowerCase().includes(baixo.slice(0, 5)));
      const s = AVULSOS.find((x) => x[1].toLowerCase().includes(baixo.slice(0, 5)));
      if (g) { d.grupo = g[0]; ok = true; } else if (s) { d.estilo = s[0]; ok = true; }
    }
  } else if (e === 'sub') {
    if (SUB.find((x) => x[0] === val)) { d.estilo = val; ok = true; }
  } else if (e === 'estiloOutro') {
    if (texto.length >= 3) { d.estiloOutro = texto.slice(0, 100); ok = true; }
  } else if (e === 'voz') {
    if (['masculina', 'feminina', 'dueto'].includes(val)) { d.voz = val; ok = true; }
  }

  if (e !== 'letra') {
    if (!ok) { await perguntar(de, c); return true; }
    c.etapa = proxima(c); c.pag = 0;
    if (c.etapa !== 'criar') { await salvar(de, c); await perguntar(de, c); return true; }
    // tudo respondido → escreve a letra pra pessoa aprovar
    await escreverLetra(de, c, 'letra');
    return true;
  }

  // ---- criar ----
  const lk = 'lim_' + chaveNum(de);
  const lim = (await loja().get(lk, { type: 'json' }).catch(() => null)) || { n: 0, desde: Date.now() };
  if (Date.now() - lim.desde > H24) { lim.n = 0; lim.desde = Date.now(); }
  if (lim.n >= LIMITE_DIA) {
    await limpar(de);
    await registrar('limite', { numero: de });
    await enviarTexto(de, 'Você já criou ' + LIMITE_DIA + ' músicas hoje pelo WhatsApp 😊 Pra criar mais, use o site: ' + SITE + '/#/criar/musica');
    return true;
  }
  lim.n++; await loja().setJSON(lk, lim);
  c.etapa = 'criando'; await salvar(de, c);
  await enviarTexto(de, '🎙️ Perfeito! Gravando a música' + (d.nome ? ' pra *' + d.nome + '*' : '') +
    ' em *' + (d.estilo === 'outro' ? d.estiloOutro : nomeSub(d.estilo).replace(/^[^\p{L}\p{N}]+\s/u, '')) + '*...\n\nLeva uns *2 minutinhos*. Assim que ficar pronta eu te mando o link aqui! 🎶');
  await disparar(de, d, 'musica');
  return true;
}
