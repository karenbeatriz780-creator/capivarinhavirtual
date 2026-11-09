import { getStore } from '@netlify/blobs';
import { montarPrompt, montarPromptAjuste, limparResposta, SYSTEM_PROMPT, AJUSTE_SYSTEM_PROMPT } from './gerar-letra.js';
import { indexarDia } from './_indice.mjs';
import { iaFetch, RESERVA_OR, TEXTO_KIE, TEXTO_TOP } from './_ia.mjs';

// LETRA RÁPIDA (≈3–5 s): pede a letra a modelos rápidos AO MESMO TEMPO e usa a
// primeira que chegar completa. Responde direto (sem segundo plano, sem streaming).
// Também guarda a letra pelo id — se a pessoa sair da aba, o site recupera depois.
// Se nenhum responder a tempo, o site cai no modo antigo (gerar-letra-background).
// (nov/2026) a Unifically tirou o GPT-5.4 e o 5.4-mini — por isso a letra parou.
const MODELOS = [...TEXTO_TOP, ...TEXTO_KIE, 'google/gemini-3.8-flash', 'openai/gpt-6.1-terra', 'anthropic/claude-haiku-4-5', 'openai/gpt-6.1-sol', ...RESERVA_OR];
const LIMITE_MS = 10000;

function erro(msg, status) {
  return new Response(JSON.stringify({ erro: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
const str = (b, k, n) => String((b && b[k]) || '').trim().slice(0, n || 3000);

// Teste rápido: abre /.netlify/functions/letra-rapida?teste=1 no navegador
// e mostra se cada modelo da IA está respondendo (não mostra a chave).
async function testarModelos() {
  const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
  if (!apiKey) return { chave: 'FALTANDO' };
  const out = { chave: 'ok' };
  await Promise.all(MODELOS.map(async (m) => {
    const t = Date.now();
    try {
      const r = await iaFetch('ia', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 400, messages: [{ role: 'user', content: 'Responda só: ok' }] })
      });
      const d = await r.json().catch(() => null);
      const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      out[m] = r.ok && txt ? 'OK (' + (Date.now() - t) + 'ms)' : 'ERRO ' + r.status + ' ' + JSON.stringify(d && (d.error || d)).slice(0, 160);
    } catch (e) { out[m] = 'ERRO ' + (e && e.message); }
  }));
  return out;
}

export default async (req) => {
  if (req.method === 'GET' && new URL(req.url).searchParams.get('teste')) {
    return new Response(JSON.stringify(await testarModelos(), null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
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

  const t0 = Date.now();
  const ctrls = [];
  async function chamar(m) {
    const ctl = new AbortController(); ctrls.push(ctl);
    try {
      const r = await iaFetch('ia', {
        method: 'POST', signal: ctl.signal,
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 3000, temperature: modoAjuste ? 0.5 : 0.9,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
      });
      const d = await r.json().catch(() => null);
      const ch = d && d.choices && d.choices[0];
      const txt = ch && ch.message && ch.message.content;
      if (!r.ok || !txt || (ch.finish_reason === 'length')) { console.log('letra-rapida FALHA ' + m + ' ' + r.status + ' ' + JSON.stringify(d).slice(0, 200)); return null; }
      const letra = limparResposta(txt);
      if (letra.split('\n').filter((l) => l.trim()).length < 10) { console.log('letra-rapida curta ' + m); return null; }
      console.log('letra-rapida OK ' + m + ' em ' + (Date.now() - t0) + 'ms');
      return { letra, modelo: m };
    } catch (e) { return null; }
  }
  // primeiro que entregar uma letra boa ganha; os outros são cancelados
  const vencedor = await new Promise((resolve) => {
    let faltam = MODELOS.length;
    const tm = setTimeout(() => resolve(null), LIMITE_MS);
    MODELOS.forEach((m) => chamar(m).then((v) => { if (v) { clearTimeout(tm); resolve(v); } else if (--faltam === 0) { clearTimeout(tm); resolve(null); } }));
  });
  ctrls.forEach((c) => { try { c.abort(); } catch (e) {} });
  if (!vencedor) return erro('IA lenta agora.', 504);
  try { if (id) await getStore('letras').setJSON(id, { pronto: true, letra: vencedor.letra, em: Date.now(), modelo: vencedor.modelo }); } catch (e) {}
  try { await indexarDia('l'); } catch (e) {}
  return new Response(JSON.stringify({ ok: true, letra: vencedor.letra, ms: Date.now() - t0, modelo: vencedor.modelo }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
