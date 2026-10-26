import { getStore } from '@netlify/blobs';
import { enviarTexto, chaveNum, registrar } from './_zap.mjs';

// Painel → aba 🤖 WhatsApp: o que o robô fez, falhas, conversas e responder clientes.
// GET: lê (aberto como o resto do painel). POST: responder / pausar robô (pede a senha).

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const D = 24 * 3600 * 1000;
const tsDe = (k) => +((k.match(/_(\d{13})(_|$)/) || [])[1] || 0);

async function listar(loja, prefixo) {
  try { return ((await loja.list({ prefix: prefixo })).blobs || []).map((b) => b.key); } catch (e) { return []; }
}

export default async (req) => {
  const loja = getStore('whatsapp');
  if (req.method === 'POST') {
    const senha = (process.env.ADMIN_SENHA || '').trim();
    if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha incorreta.' }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}
    const para = String(b.para || '').replace(/\D/g, '');
    if (para.length < 10) return json({ erro: 'Número inválido.' }, 400);
    if (b.acao === 'liberar') { await loja.delete('humano_' + chaveNum(para)).catch(() => {}); return json({ ok: true }); }
    const texto = String(b.texto || '').trim().slice(0, 3000);
    if (!texto) return json({ erro: 'Escreva a mensagem.' }, 400);
    const ok = await enviarTexto(para, texto);
    if (!ok) return json({ erro: 'A Meta não deixou enviar. Se a pessoa não mandou mensagem nas últimas 24 h, só dá pra responder depois que ela mandar de novo.' }, 400);
    // você respondeu → robô fica quieto com essa pessoa por 12 h
    await loja.setJSON('humano_' + chaveNum(para), { em: Date.now(), numero: para });
    await registrar('respondeu', { para });
    return json({ ok: true });
  }

  const agora = Date.now();
  const [evK, inK, outK, humK] = await Promise.all([listar(loja, 'ev_'), listar(loja, 'in_'), listar(loja, 'out_'), listar(loja, 'humano_')]);

  // limpeza: apaga registros com mais de 15 dias (até 150 por vez)
  const velhos = evK.concat(inK, outK).filter((k) => tsDe(k) && agora - tsDe(k) > 15 * D).slice(0, 150);
  await Promise.all(velhos.map((k) => loja.delete(k).catch(() => {})));

  const ler = (ks) => Promise.all(ks.map((k) => loja.get(k, { type: 'json' }).catch(() => null)));
  const evRec = evK.filter((k) => agora - tsDe(k) < 7 * D).sort((a, b) => tsDe(b) - tsDe(a)).slice(0, 200);
  const eventos = (await ler(evRec)).filter(Boolean);

  // conversas das últimas 48 h (até 30 pessoas, 12 mensagens cada)
  const porPessoa = {};
  inK.concat(outK).forEach((k) => {
    const ts = tsDe(k); if (!ts || agora - ts > 2 * D) return;
    const ch = k.split('_')[1];
    (porPessoa[ch] = porPessoa[ch] || []).push(k);
  });
  const pessoas = Object.keys(porPessoa).sort((a, b) => Math.max(...porPessoa[b].map(tsDe)) - Math.max(...porPessoa[a].map(tsDe))).slice(0, 30);
  const humanos = {};
  (await ler(humK)).forEach((h, i) => { if (h && agora - (h.em || 0) < 12 * 3600 * 1000) humanos[humK[i].slice(7)] = h; });
  const conversas = await Promise.all(pessoas.map(async (ch) => {
    const ks = porPessoa[ch].sort((a, b) => tsDe(a) - tsDe(b)).slice(-12);
    const msgs = (await ler(ks)).map((m, i) => m && { de: ks[i].startsWith('in_') ? 'cliente' : 'nós', txt: m.txt, em: m.em, nome: m.nome, numero: m.de || m.para }).filter(Boolean);
    const cli = msgs.filter((m) => m.de === 'cliente');
    return {
      chave: ch, numero: (cli[cli.length - 1] || msgs[msgs.length - 1] || {}).numero || '',
      nome: (cli.find((m) => m.nome) || {}).nome || '',
      atendimento: !!humanos[ch], ultima: msgs.length ? msgs[msgs.length - 1].em : 0,
      janelaAberta: cli.length ? agora - cli[cli.length - 1].em < 23.5 * 3600 * 1000 : false,
      msgs
    };
  }));
  return json({ eventos, conversas, agora });
};
