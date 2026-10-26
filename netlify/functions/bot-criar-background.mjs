import { getStore } from '@netlify/blobs';
import { enviarTexto, chaveNum, SITE } from './_zap.mjs';

// Roda em SEGUNDO PLANO (até 15 min): escreve a letra e manda gerar a música
// que o cliente pediu pelo WhatsApp. Quando ficar pronta, o avisar-musica-agendado
// manda o link pra ele.
export default async (req) => {
  let b = null;
  try { b = await req.json(); } catch (e) { return; }
  if (!b || b.chave !== (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() || !b.numero || !b.d) return;
  const { numero, d } = b;
  const de = d.voz === 'feminina' ? 'mulher' : d.voz === 'masculina' ? 'homem' : 'neutro';
  const corpo = {
    estilo: d.estilo || 'romantica', estiloOutro: '', texto: d.historia || '',
    clima: d.relacao === 'louvor' ? 'emocionante' : (/^(namorad|espos|marido)/.test(d.relacao || '') ? 'romantica' : 'emocionante'),
    relacao: d.relacao || '', ocasiao: d.ocasiao || '', nomesLetra: d.nome || '', frase: '',
    voz: d.voz || 'masculina', de, paraGen: ({ namorada: 1, esposa: 1, mae: 1, amiga: 1 })[d.relacao] ? 'ela' : 'ele', paraOutro: ''
  };
  const post = async (fn, body) => {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, d: await r.json().catch(() => null) };
  };
  try {
    let letra = '';
    try { const r = await post('gerar-letra', corpo); if (r.ok && r.d && r.d.letra) letra = r.d.letra; } catch (e) {}
    const r2 = await post('gerar-musica', Object.assign({}, corpo, { letraAprovada: letra, whatsapp: String(numero) }));
    if (!r2.ok || !r2.d || !r2.d.taskId) throw new Error((r2.d && r2.d.erro) || 'sem taskId');
    const tid = r2.d.taskId;
    const loja = getStore('whatsapp');
    await loja.setJSON('optin_' + tid, { numero: String(numero), em: Date.now() });
    await loja.setJSON('pend_' + tid, { taskId: tid, numero: String(numero), em: Date.now() });
    console.log('BOT criou música ' + tid + ' para ' + numero);
  } catch (e) {
    console.error('bot-criar:', e && e.message);
    await getStore('whatsapp').delete('bot_' + chaveNum(numero)).catch(() => {});
    await enviarTexto(numero, '😕 Deu um probleminha pra criar sua música agora. Manda *"criar música"* pra tentar de novo, ou crie pelo site: ' + SITE + '/#/criar/musica');
  }
};
