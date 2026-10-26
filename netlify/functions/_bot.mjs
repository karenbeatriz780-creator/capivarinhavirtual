import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, enviarLista, chaveNum, SITE } from './_zap.mjs';

// ROBÔ DE CRIAR MÚSICA PELO WHATSAPP
// Conversa passo a passo: nome → pra quem → ocasião → história → estilo → voz → cria.
// Tudo resposta a quem chamou primeiro (grátis, não precisa de modelo aprovado).

const RELACOES = [
  ['r_namorada', 'Namorada', 'namorada'], ['r_namorado', 'Namorado', 'namorado'],
  ['r_esposa', 'Esposa', 'esposa'], ['r_marido', 'Marido', 'marido'],
  ['r_mae', 'Mãe', 'mae'], ['r_pai', 'Pai', 'pai'],
  ['r_filho', 'Filho(a)', 'filho'], ['r_amigo', 'Amigo(a)', 'amigo'],
  ['r_louvor', 'Louvor a Deus 🙏', 'louvor'], ['r_outro', 'Outra pessoa', '']
];
const OCASIOES = [
  ['o_aniv', 'Aniversário'], ['o_decl', 'Declaração de amor'], ['o_anivnam', 'Aniversário de namoro'],
  ['o_anivcas', 'Aniversário de casamento'], ['o_pedido', 'Pedido de namoro'], ['o_surpresa', 'Surpresa'],
  ['o_homenagem', 'Homenagem'], ['o_formatura', 'Formatura'], ['o_outro', 'Outra ocasião']
];
const ESTILOS = [
  ['e_sertanejo', 'Sertanejo', 'sertanejo'], ['e_pagode', 'Pagode romântico', 'pagoderomantico'],
  ['e_gospel', 'Gospel / Louvor', 'gospel'], ['e_romantica', 'Romântica', 'romantica'],
  ['e_piseiro', 'Piseiro', 'piseiroromantico'], ['e_forro', 'Forró', 'forroromantico'],
  ['e_arrocha', 'Arrocha', 'arrochaatual'], ['e_melody', 'Melody', 'melody'],
  ['e_rap', 'Rap romântico', 'raproma'], ['e_infantil', 'Infantil', 'infantil']
];
const ELA = { namorada: 1, esposa: 1, mae: 1 };
const H2 = 2 * 3600 * 1000, H24 = 24 * 3600 * 1000;
const LIMITE_DIA = 3; // máximo de músicas por número por dia

const loja = () => getStore('whatsapp');
const chaveConv = (n) => 'bot_' + chaveNum(n);

export async function boasVindas(para) {
  return enviarBotoes(para,
    '🎵 Olá! Seja bem-vindo(a) à *Capivarinha Love*! 💗\n\n' +
    'Aqui você cria uma *música personalizada* com o nome e a história de quem você ama, pronta em poucos minutos.\n\n' +
    'Como posso te ajudar?',
    [['criar', '🎵 Criar minha música'], ['comprei', '🎶 Já comprei'], ['atendente', '💬 Atendimento']]);
}

async function salvar(numero, conv) { conv.em = Date.now(); await loja().setJSON(chaveConv(numero), conv); }
async function limpar(numero) { await loja().delete(chaveConv(numero)).catch(() => {}); }

async function perguntar(para, etapa, conv) {
  if (etapa === 'nome') return enviarTexto(para, '🎵 Vamos criar sua música!\n\nPra começar: *qual o nome de quem vai receber* a música? 💗\n\n_(se quiser parar, é só mandar "cancelar")_');
  if (etapa === 'relacao') return enviarLista(para, 'Que lindo! E quem é *' + conv.d.nome + '* pra você?', 'Escolher', RELACOES.map(([id, t]) => [id, t]));
  if (etapa === 'ocasiao') return enviarLista(para, 'Qual é a *ocasião*? 🎉', 'Escolher', OCASIOES.map(([id, t]) => [id, t]));
  if (etapa === 'historia') return enviarTexto(para,
    (conv.d.relacao === 'louvor'
      ? '🙏 Agora me conta: *o que Deus fez na sua vida?* Um testemunho, um momento difícil que Ele te sustentou, pelo que você é grato...'
      : '✍️ Agora a parte mais importante: *me conta a história de vocês!*\n\nComo se conheceram, apelidos, momentos marcantes, o que você sente...') +
    '\n\nQuanto mais detalhes, mais emocionante fica a música. Pode escrever à vontade (ou mandar em várias mensagens e depois "pronto").');
  if (etapa === 'estilo') return enviarLista(para, '🎶 Qual *estilo musical*?', 'Ver estilos', ESTILOS.map(([id, t]) => [id, t]));
  if (etapa === 'voz') return enviarBotoes(para, '🎤 Qual voz vai cantar?', [['v_masculina', 'Voz masculina'], ['v_feminina', 'Voz feminina'], ['v_dueto', 'Dueto']]);
}

// Volta true se o robô cuidou da mensagem
export async function tratarBot(msg) {
  const de = String(msg.from);
  const id = (msg.interactive && ((msg.interactive.button_reply && msg.interactive.button_reply.id) || (msg.interactive.list_reply && msg.interactive.list_reply.id))) ||
    (msg.button && msg.button.payload) || '';
  const texto = String((msg.text && msg.text.body) || (msg.interactive && ((msg.interactive.button_reply || msg.interactive.list_reply || {}).title)) || '').trim();
  const baixo = texto.toLowerCase();

  let conv = await loja().get(chaveConv(de), { type: 'json' }).catch(() => null);
  if (conv && Date.now() - (conv.em || 0) > H2) { await limpar(de); conv = null; }

  if (/^(cancelar|parar|sair)$/.test(baixo)) {
    if (conv) { await limpar(de); await enviarTexto(de, 'Tudo bem, cancelei 😊 Quando quiser criar, é só mandar *"criar música"*.'); return true; }
    return false;
  }
  if (id === 'comprei') {
    await enviarTexto(de, '🎶 Suas músicas ficam salvas aqui:\n' + SITE + '/#/meus\n\nÉ só informar o número de WhatsApp usado na compra. 💗');
    return true;
  }
  if (id === 'atendente') {
    await limpar(de);
    await loja().setJSON('humano_' + chaveNum(de), { em: Date.now() });
    await enviarTexto(de, '💬 Pode mandar sua dúvida por aqui que a nossa equipe responde assim que possível. 💗');
    return true;
  }
  const querCriar = id === 'criar' || /\b(criar|cria|fazer|faz|quero|gerar)\b.*\bm[uú]sica\b|^criar$|^m[uú]sica$/.test(baixo);
  if (querCriar && (!conv || conv.etapa === 'criando')) {
    conv = { etapa: 'nome', d: {} };
    await loja().delete('humano_' + chaveNum(de)).catch(() => {});
    await salvar(de, conv);
    await perguntar(de, 'nome', conv);
    return true;
  }
  if (!conv) return false;

  const e = conv.etapa;
  if (e === 'nome') {
    const nome = texto.replace(/[^\p{L}\p{N} &'.-]/gu, '').trim().slice(0, 60);
    if (nome.length < 2) { await enviarTexto(de, 'Me manda só o *nome* de quem vai receber 😊'); return true; }
    conv.d.nome = nome; conv.etapa = 'relacao';
  } else if (e === 'relacao') {
    const r = RELACOES.find((x) => x[0] === id) || RELACOES.find((x) => x[1].toLowerCase().startsWith(baixo.slice(0, 4)));
    if (!r) { await perguntar(de, 'relacao', conv); return true; }
    let rel = r[2];
    if (rel === 'amigo' && /a$/i.test(conv.d.nome.split(' ')[0])) rel = 'amiga';
    conv.d.relacao = rel; conv.d.relTit = r[1];
    conv.etapa = rel === 'louvor' ? 'historia' : 'ocasiao';
    if (rel === 'louvor') { conv.d.ocasiao = 'Homenagem'; conv.d.estilo = ''; }
  } else if (e === 'ocasiao') {
    const o = OCASIOES.find((x) => x[0] === id);
    conv.d.ocasiao = o ? (o[0] === 'o_outro' ? '' : o[1]) : texto.slice(0, 60);
    conv.etapa = 'historia';
  } else if (e === 'historia') {
    const pronto = /^(pronto|ok|só isso|so isso|acabei|terminei|é isso|e isso)$/.test(baixo);
    if (!pronto && texto) conv.d.historia = ((conv.d.historia || '') + '\n' + texto).trim().slice(0, 1500);
    const h = conv.d.historia || '';
    if (h.length < 50) {
      await salvar(de, conv);
      await enviarTexto(de, h ? 'Conta mais um pouquinho 🥰 (precisa de pelo menos umas 2 frases pra música ficar especial)' : 'Me conta a história em texto, por favor 😊');
      return true;
    }
    if (!pronto && h.length < 250 && !conv.d.pediuMais) {
      conv.d.pediuMais = true; await salvar(de, conv);
      await enviarBotoes(de, 'Anotei! 📝 Quer contar mais alguma coisa? Pode mandar mais mensagens, ou toque em continuar.', [['h_ok', 'Continuar ▶️']]);
      return true;
    }
    conv.etapa = conv.d.relacao === 'louvor' ? 'voz' : 'estilo';
    if (conv.d.relacao === 'louvor') conv.d.estilo = 'gospel';
  } else if (e === 'estilo') {
    const s = ESTILOS.find((x) => x[0] === id) || ESTILOS.find((x) => x[1].toLowerCase().startsWith(baixo.slice(0, 5)));
    if (!s) { await perguntar(de, 'estilo', conv); return true; }
    conv.d.estilo = s[2]; conv.d.estiloTit = s[1]; conv.etapa = 'voz';
  } else if (e === 'voz') {
    const v = id === 'v_feminina' || /femin|mulher/.test(baixo) ? 'feminina' : id === 'v_dueto' || /duet/.test(baixo) ? 'dueto' : id === 'v_masculina' || /mascul|homem/.test(baixo) ? 'masculina' : '';
    if (!v) { await perguntar(de, 'voz', conv); return true; }
    conv.d.voz = v;
    // limite por número
    const lk = 'lim_' + chaveNum(de);
    const lim = (await loja().get(lk, { type: 'json' }).catch(() => null)) || { n: 0, desde: Date.now() };
    if (Date.now() - lim.desde > H24) { lim.n = 0; lim.desde = Date.now(); }
    if (lim.n >= LIMITE_DIA) {
      await limpar(de);
      await enviarTexto(de, 'Você já criou ' + LIMITE_DIA + ' músicas hoje 😊 Pra criar mais, use o site: ' + SITE + '/#/criar/musica');
      return true;
    }
    lim.n++; await loja().setJSON(lk, lim);
    conv.etapa = 'criando'; await salvar(de, conv);
    await enviarTexto(de, '✨ Perfeito! Estou escrevendo a letra e gravando a música pra *' + conv.d.nome + '*...\n\nLeva uns *2 minutinhos*. Assim que ficar pronta eu te mando o link aqui mesmo! 🎶');
    // a criação demora: roda em segundo plano
    await fetch(SITE + '/.netlify/functions/bot-criar-background', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: de, d: conv.d, chave: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() })
    }).catch((err) => console.error('bot: falha ao disparar criação', err && err.message));
    return true;
  } else if (e === 'criando') {
    await enviarTexto(de, '🎶 Sua música ainda está sendo criada, já já chega aqui! Pra criar outra, mande *"criar música"*.');
    return true;
  }
  await salvar(de, conv);
  await perguntar(de, conv.etapa, conv);
  return true;
}
