import { getStore } from '@netlify/blobs';
import { montarPrompt, montarPromptAjuste, limparResposta, SYSTEM_PROMPT, AJUSTE_SYSTEM_PROMPT } from './gerar-letra.js';
import { indexarDia } from './_indice.mjs';

// LETRA RÁPIDA: escreve a letra completa e já vai mandando o texto pro
// navegador enquanto escreve (a pessoa vê a letra aparecendo em 1–2 s).
// Usa um modelo rápido e bom de texto. Se tudo der errado, o site volta
// sozinho pro modo antigo (gerar-letra-background).
//   POST (mesmos campos de gerar-letra) → texto puro, em streaming.
const MODELOS = ['anthropic/claude-haiku-5-5', 'openai/gpt-5.4-mini', 'google/gemini-3.8-flash'];

function erro(msg, status) {
  return new Response(JSON.stringify({ erro: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
const str = (b, k, n) => String((b && b[k]) || '').trim().slice(0, n || 3000);

export default async (req) => {
  if (req.method !== 'POST') return erro('Método não permitido.', 405);
  let b; try { b = await req.json(); } catch { return erro('JSON inválido.', 400); }
  const id = /^[a-zA-Z0-9_-]{8,64}$/.test(String(b.id || '')) ? String(b.id) : null;
  const letraAtual = str(b, 'letraAtual'), instrucao = str(b, 'instrucao', 500);
  const modoAjuste = letraAtual.length > 20 && instrucao.length >= 3;
  const texto = str(b, 'texto', 2000);
  if (!modoAjuste && (!str(b, 'estilo') || texto.length < 50)) return erro('Dados incompletos.', 400);
  const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
  if (!apiKey) return erro('Servidor sem chave da IA.', 503);

  const prompt = modoAjuste
    ? montarPromptAjuste(letraAtual, instrucao, str(b, 'nomesLetra', 200))
    : montarPrompt({
        estilo: str(b, 'estilo', 40), estiloOutro: str(b, 'estiloOutro', 100), clima: str(b, 'clima', 40),
        relacao: str(b, 'relacao', 40), ocasiao: str(b, 'ocasiao', 80), nomesLetra: str(b, 'nomesLetra', 200),
        frase: str(b, 'frase', 300), voz: str(b, 'voz', 20), de: str(b, 'de', 20), paraGen: str(b, 'paraGen', 20),
        paraOutro: str(b, 'paraOutro', 120), texto
      });
  const system = (modoAjuste ? AJUSTE_SYSTEM_PROMPT : SYSTEM_PROMPT) +
    ' Escreva a música COMPLETA (todas as partes da estrutura pedida), nunca só um trecho.';

  // abre a conexão com o primeiro modelo que responder
  let up = null, modelo = null;
  for (const m of MODELOS) {
    try {
      const r = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, stream: true, max_tokens: 1800, temperature: modoAjuste ? 0.5 : 0.9,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
      });
      if (r.ok && r.body) { up = r; modelo = m; break; }
      console.log('letra-rapida: ' + m + ' recusou ' + r.status);
    } catch (e) { console.log('letra-rapida: ' + m + ' falhou ' + (e && e.message)); }
  }
  if (!up) return erro('IA indisponível agora.', 502);

  const enc = new TextEncoder(), dec = new TextDecoder();
  const t0 = Date.now();
  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = '', tudo = '', sse = (up.headers.get('content-type') || '').indexOf('event-stream') !== -1, cru = '';
      const reader = up.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const pedaco = dec.decode(value, { stream: true });
          if (!sse) { cru += pedaco; continue; }
          buf += pedaco;
          let i;
          while ((i = buf.indexOf('\n')) !== -1) {
            const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!linha.startsWith('data:')) continue;
            const dado = linha.slice(5).trim();
            if (dado === '[DONE]') continue;
            try {
              const j = JSON.parse(dado);
              const t = j.choices && j.choices[0] && ((j.choices[0].delta && j.choices[0].delta.content) || (j.choices[0].message && j.choices[0].message.content));
              if (t) { tudo += t; ctrl.enqueue(enc.encode(t)); }
            } catch (e) {}
          }
        }
        if (!sse && cru) { // provedor respondeu tudo de uma vez
          try { const j = JSON.parse(cru); tudo = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; } catch (e) {}
          if (tudo) ctrl.enqueue(enc.encode(tudo));
        }
      } catch (e) { console.log('letra-rapida stream:', e && e.message); }
      const letra = limparResposta(tudo);
      console.log('letra-rapida ' + modelo + ' em ' + (Date.now() - t0) + 'ms, ' + letra.length + ' caracteres');
      if (letra.split('\n').length >= 8) {
        try { if (id) await getStore('letras').setJSON(id, { pronto: true, letra, em: Date.now(), modelo }); } catch (e) {}
        await indexarDia('l');
      }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Modelo': modelo } });
};
