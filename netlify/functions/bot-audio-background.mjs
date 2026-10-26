import { enviarTexto, registrar, VERSAO } from './_zap.mjs';
import { tratarBot } from './_bot.mjs';

// Em SEGUNDO PLANO: baixa o áudio que o cliente mandou no WhatsApp,
// transforma em texto e entrega pro robô como se fosse uma mensagem escrita.
export default async (req) => {
  let b = null;
  try { b = await req.json(); } catch (e) { return; }
  if (!b || b.chave !== (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() || !b.numero || !b.midia) return;
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  const chaveIA = (process.env.UNIFICALLY_API_KEY || '').trim();
  let texto = '';
  try {
    const info = await (await fetch('https://graph.facebook.com/' + VERSAO + '/' + b.midia, { headers: { Authorization: 'Bearer ' + token } })).json();
    if (!info || !info.url) throw new Error('sem url da mídia');
    const ra = await fetch(info.url, { headers: { Authorization: 'Bearer ' + token } });
    const buf = Buffer.from(await ra.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('áudio grande demais');
    const formato = /mpeg|mp3/.test(info.mime_type || '') ? 'mp3' : /wav/.test(info.mime_type || '') ? 'wav' : 'ogg';
    for (const modelo of ['google/gemini-3.8-flash', 'openai/gpt-5.4-mini']) {
      try {
        const r = await fetch('https://api.unifically.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + chaveIA, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelo, max_tokens: 1500,
            messages: [{ role: 'user', content: [
              { type: 'text', text: 'Transcreva fielmente este áudio em português do Brasil. Responda SOMENTE com o texto falado, sem comentários.' },
              { type: 'input_audio', input_audio: { data: buf.toString('base64'), format: formato } }
            ] }]
          })
        });
        const d = await r.json().catch(() => null);
        const t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (r.ok && t && String(t).trim().length > 3) { texto = String(t).trim(); console.log('áudio transcrito por ' + modelo); break; }
        console.log('transcrição falhou (' + modelo + '): ' + r.status + ' ' + JSON.stringify(d).slice(0, 300));
      } catch (e) { console.log('transcrição erro (' + modelo + '): ' + (e && e.message)); }
    }
  } catch (e) { console.error('bot-audio:', e && e.message); }

  if (!texto) {
    await registrar('falha', { para: b.numero, erro: 'Não consegui transformar o áudio da história em texto (pedi pra escrever)' });
    await enviarTexto(b.numero, '😕 Não consegui entender o áudio. Pode me mandar a história *escrita*, por favor?');
    return;
  }
  await enviarTexto(b.numero, '📝 Entendi assim:\n_"' + texto.slice(0, 700) + (texto.length > 700 ? '...' : '') + '"_');
  await tratarBot({ from: b.numero, type: 'text', text: { body: texto } });
};
