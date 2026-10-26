import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarBotoes, chaveNum, registrar, SITE } from './_zap.mjs';

// Roda em SEGUNDO PLANO (até 15 min).
// modo 'letra' / 'ajuste': escreve a letra e manda pro cliente aprovar.
// modo 'musica': grava a música com a letra aprovada. Quando ficar pronta, o avisar-musica-agendado
// manda o link pra ele.
export default async (req) => {
  let b = null;
  try { b = await req.json(); } catch (e) { return; }
  if (!b || b.chave !== (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() || !b.numero || !b.d) return;
  const { numero, d } = b;
  const rel = d.para || '';
  const corpo = {
    estilo: d.estilo || 'romantica', estiloOutro: d.estiloOutro || '', texto: d.historia || '',
    clima: rel === 'comercial' ? 'alegre' : (/^(namorado|esposa)$/.test(rel) ? 'romantica' : 'emocionante'),
    relacao: rel, ocasiao: d.ocasiao || '', nomesLetra: d.nome || '', frase: '',
    voz: d.voz || 'masculina', de: d.de || '',
    paraGen: rel === 'louvor' ? 'ele' : rel === 'familia' ? 'neutro' : (d.paraGen || ''),
    paraOutro: d.paraOutro || ''
  };
  const post = async (fn, body) => {
    const r = await fetch(SITE + '/.netlify/functions/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, d: await r.json().catch(() => null) };
  };
  const loja = getStore('whatsapp');
  const kc = 'bot_' + chaveNum(numero);
  const modo = b.modo || 'musica';

  // ---- escrever / ajustar a letra e mandar pro cliente aprovar ----
  if (modo === 'letra' || modo === 'ajuste') {
    let letra = '';
    try {
      const body = modo === 'ajuste' ? Object.assign({}, corpo, { letraAtual: d.letra || '', instrucao: b.instrucao || '' }) : corpo;
      const r = await post('gerar-letra', body);
      if (r.ok && r.d && r.d.letra) letra = String(r.d.letra).trim();
      else console.error('bot letra:', JSON.stringify(r.d).slice(0, 300));
    } catch (e) { console.error('bot letra:', e && e.message); }
    const c = await loja.get(kc, { type: 'json' }).catch(() => null);
    if (!c) return; // cliente cancelou enquanto escrevia
    if (!letra) {
      c.etapa = 'letra'; c.em = Date.now(); await loja.setJSON(kc, c);
      await registrar('falha', { para: String(numero), erro: 'Robô não conseguiu escrever a letra' });
      await enviarBotoes(numero, '😕 Não consegui escrever a letra agora. Vamos tentar de novo?', [['letra:nova', '🔄 Tentar de novo']]);
      return;
    }
    c.d.letra = letra; c.d.nLetras = (c.d.nLetras || 0) + 1; c.etapa = 'letra'; c.em = Date.now();
    await loja.setJSON(kc, c);
    await enviarTexto(numero, '📝 *' + (modo === 'ajuste' ? 'Letra ajustada' : 'Letra da sua música') + ':*\n\n' + letra.slice(0, 3800));
    await enviarBotoes(numero, 'Gostou da letra? 💗\n\n✅ *Gerar a música* com essa letra\n✏️ *Ajustar*: me diga o que mudar\n🔄 *Outra letra*: escrevo uma nova',
      [['letra:ok', '✅ Gerar a música'], ['letra:ajustar', '✏️ Ajustar'], ['letra:nova', '🔄 Outra letra']]);
    return;
  }

  // ---- gravar a música com a letra aprovada ----
  try {
    const letra = d.letra || '';
    const r2 = await post('gerar-musica', Object.assign({}, corpo, { letraAprovada: letra, whatsapp: String(numero) }));
    if (!r2.ok || !r2.d || !r2.d.taskId) throw new Error((r2.d && r2.d.erro) || 'sem taskId');
    const tid = r2.d.taskId;
    await loja.setJSON('optin_' + tid, { numero: String(numero), em: Date.now() });
    await loja.setJSON('pend_' + tid, { taskId: tid, numero: String(numero), em: Date.now() });
    console.log('BOT criou música ' + tid + ' para ' + numero);
    await registrar('criou', { numero: String(numero), taskId: tid, nome: d.nome || '', para: d.para || '', estilo: d.estilo === 'outro' ? d.estiloOutro : d.estilo, letra: !!letra });
  } catch (e) {
    console.error('bot-criar:', e && e.message);
    await registrar('falha', { para: String(numero), erro: 'Robô não conseguiu criar a música: ' + String(e && e.message).slice(0, 150) });
    await loja.delete(kc).catch(() => {});
    await enviarTexto(numero, '😕 Deu um probleminha pra criar sua música agora. Manda *"criar música"* pra tentar de novo, ou crie pelo site: ' + SITE + '/#/criar/musica');
  }
};
