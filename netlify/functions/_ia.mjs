// Ponte das IAs — KIE.AI É A PRINCIPAL (texto, música e imagem).
// Ordem: 1º Kie (KIE_API_KEY) → 2º Unifically (UNIFICALLY_API_KEY) → 3º OpenRouter (OPENROUTER_API_KEY, só texto).
// Cada reserva só entra quando a anterior falha (ou demora demais), pra não gastar à toa.
//
// TEXTO: nas listas de modelos, "kie:..." vai pra Kie, "or:..." pra OpenRouter, o resto pra Unifically.
const UNI = 'https://api.unifically.com/v1/chat/completions';
const OR = 'https://openrouter.ai/api/v1/chat/completions';
const KIEAPI = 'https://api.kie.ai';
const kieChave = () => (process.env.KIE_API_KEY || '').trim();

// texto principal na Kie (rápido e barato) e reservas na OpenRouter
export const TEXTO_KIE = ['kie:gemini-3-8-flash-openai'];
export const RESERVA_OR = ['or:google/gemini-3.6-flash', 'or:anthropic/claude-haiku-4.5'];

const ultFalha = [0, 0, 0], ultOk = [0, 0, 0]; // por nível: 0 Kie, 1 Unifically, 2 OpenRouter
const nivel = (m) => (m.startsWith('kie:') ? 0 : m.startsWith('or:') ? 2 : 1);

function falso(status, msg) {
  return new Response(JSON.stringify({ error: { message: msg } }), { status, headers: { 'Content-Type': 'application/json' } });
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// espera a vez do nível: entra na hora se o nível de cima falhou; desiste se ele já respondeu bem
async function aguardarVez(nv, signal) {
  if (nv === 0) return true;
  const t0 = Date.now(), espera = 4500 * nv;
  const acimaFalhou = () => Date.now() - ultFalha[nv - 1] < 60000; // o nível logo acima falhou
  const acimaOk = () => { for (let i = 0; i < nv; i++) if (ultOk[i] >= t0) return true; return false; };
  // nível 1 (Unifically) sem Kie configurada: entra direto
  if (nv === 1 && !kieChave()) return true;
  while (!acimaFalhou() && Date.now() - t0 < espera) {
    if (acimaOk()) return false;
    if (signal && signal.aborted) return false;
    await dormir(150);
  }
  return !acimaOk();
}

// Use igual ao fetch: iaFetch(qualquer, { method, headers, body, signal })
export async function iaFetch(_url, init) {
  let corpo = {};
  try { corpo = JSON.parse(init.body); } catch (e) {}
  const modelo = String(corpo.model || '');
  const nv = nivel(modelo);
  if (!(await aguardarVez(nv, init.signal))) return falso(499, 'reserva não usada');
  let r;
  try {
    if (nv === 0) {
      const ch = kieChave();
      if (!ch) return falso(503, 'sem KIE_API_KEY');
      const nome = modelo.slice(4);
      const c = { messages: corpo.messages, stream: false, reasoning_effort: 'low', include_thoughts: false };
      r = await fetch(KIEAPI + '/' + nome + '/v1/chat/completions', {
        method: 'POST', signal: init.signal,
        headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json' }, body: JSON.stringify(c)
      });
      // a Kie responde erro com HTTP 200 + { code, msg }: transforma em erro de verdade
      const d = await r.clone().json().catch(() => null);
      if (!d || !d.choices) {
        console.log('Kie texto FALHA ' + nome + ' ' + JSON.stringify(d).slice(0, 200));
        r = falso(502, (d && d.msg) || 'kie sem resposta');
      }
    } else if (nv === 2) {
      const ch = (process.env.OPENROUTER_API_KEY || '').trim();
      if (!ch) return falso(503, 'sem OPENROUTER_API_KEY');
      corpo.model = modelo.slice(3);
      console.log('IA reserva (OpenRouter): ' + corpo.model);
      r = await fetch(OR, Object.assign({}, init, {
        headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json',
          'HTTP-Referer': 'https://capivarinhalove.com.br', 'X-Title': 'Capivarinha Love' },
        body: JSON.stringify(corpo)
      }));
    } else {
      r = await fetch(UNI, init);
    }
  } catch (e) {
    ultFalha[nv] = Date.now();
    throw e;
  }
  if (r.ok) ultOk[nv] = Date.now(); else ultFalha[nv] = Date.now();
  return r;
}

// ---------------------------------------------------------------------------
// TAREFAS (música Suno e imagens do livro): Kie primeiro, Unifically de reserva.
// Use no lugar de fetch('https://api.unifically.com/v1/tasks...').
// Ids da Kie ganham prefixo: "kie_" (música) e "kieimg_" (imagem).
// ---------------------------------------------------------------------------
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
// modelos de imagem: nome na Unifically → nome na Kie
// (aprovado: Nano Banana 2 Lite em tudo, ~US$ 0,02 por imagem). Dá pra trocar sem mexer no
// código: variável KIE_MODELO_IMAGEM no Netlify (ex.: nano-banana-2-1).
const KIE_IMG = () => (process.env.KIE_MODELO_IMAGEM || 'nano-banana-2-lite').trim();
const IMG_KIE = { 'google/nano-banana-2.1': 1, 'google/nano-banana-2': 1 };

async function criarMusicaKie(input) {
  const ch = kieChave();
  if (!ch) return null;
  const custom = !!input.custom;
  const corpo = {
    customMode: custom, instrumental: false, model: 'V5',
    callBackUrl: 'https://capivarinhalove.com.br/',
    prompt: custom ? String(input.prompt || '').slice(0, 5000) : String(input.gpt_description_prompt || input.prompt || '').slice(0, 500)
  };
  if (custom) { corpo.style = String(input.tags || '').slice(0, 1000); corpo.title = String(input.title || 'Nossa música').slice(0, 80); }
  try {
    const r = await fetch(KIEAPI + '/api/v1/generate', {
      method: 'POST', headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    });
    const d = await r.json().catch(() => null);
    const id = d && d.data && (d.data.taskId || d.data.task_id);
    if (!r.ok || !id || (d.code && d.code !== 200)) { console.log('Kie música FALHA ' + r.status + ' ' + JSON.stringify(d).slice(0, 300)); return null; }
    console.log('MÚSICA PELA KIE >> ' + id);
    return 'kie_' + id;
  } catch (e) { console.log('Kie música FALHA ' + (e && e.message)); return null; }
}
async function verMusicaKie(id) {
  const ch = kieChave();
  if (!ch) return jsonResp({ data: { status: 'failed', message: 'sem KIE_API_KEY' } }, 500);
  const r = await fetch(KIEAPI + '/api/v1/generate/record-info?taskId=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + ch } });
  const d = await r.json().catch(() => null);
  const x = (d && d.data) || {};
  const st = String(x.status || '').toUpperCase();
  const faixas = ((x.response && (x.response.sunoData || x.response.suno_data)) || []);
  const au = (f) => f && (f.audio_url || f.audioUrl || f.source_audio_url || f.sourceAudioUrl);
  const c = { status: 'processing', task_id: 'kie_' + id };
  if (/FAIL|ERROR/.test(st)) { c.status = 'failed'; c.message = x.errorMessage || st; }
  else if (st === 'SUCCESS' && au(faixas[0])) {
    c.status = 'completed';
    c.audio_url1 = au(faixas[0]); c.audio_url2 = au(faixas[1]) || null;
    c.lyric = faixas[0].prompt || null;
    c.image_url = faixas[0].image_url || faixas[0].imageUrl || null;
    c.clips = faixas.map((f) => ({ id: f.id, audio_url: au(f), image_url: f.image_url || f.imageUrl, duration: f.duration }));
  }
  return jsonResp({ data: c }, 200);
}
async function criarImagemKie(modelo, input) {
  const ch = kieChave(), nome = KIE_IMG();
  if (!ch || !IMG_KIE[modelo]) return null;
  const lite = /lite/i.test(nome);
  const inp = { prompt: String(input.prompt || '').slice(0, 20000), aspect_ratio: input.aspect_ratio || '3:4' };
  if (!lite) { inp.resolution = input.resolution || '2K'; inp.output_format = 'png'; }
  // o Lite recebe as fotos em "image_urls"; os outros em "image_input"
  if (input.image_urls && input.image_urls.length) inp[lite ? 'image_urls' : 'image_input'] = input.image_urls.slice(0, 10);
  try {
    const r = await fetch(KIEAPI + '/api/v1/jobs/createTask', {
      method: 'POST', headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: nome, input: inp })
    });
    const d = await r.json().catch(() => null);
    const id = d && d.data && (d.data.taskId || d.data.task_id);
    if (!r.ok || !id || (d.code && d.code !== 200)) { console.log('Kie imagem FALHA ' + r.status + ' ' + JSON.stringify(d).slice(0, 300)); return null; }
    return 'kieimg_' + id;
  } catch (e) { console.log('Kie imagem FALHA ' + (e && e.message)); return null; }
}
async function verImagemKie(id) {
  const ch = kieChave();
  if (!ch) return jsonResp({ data: { status: 'failed', message: 'sem KIE_API_KEY' } }, 500);
  const r = await fetch(KIEAPI + '/api/v1/jobs/recordInfo?taskId=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + ch } });
  const d = await r.json().catch(() => null);
  const x = (d && d.data) || {};
  const st = String(x.state || '').toLowerCase();
  const c = { status: 'processing', task_id: 'kieimg_' + id };
  if (st === 'fail') { c.status = 'failed'; c.message = x.failMsg || 'falhou'; }
  else if (st === 'success') {
    let res = {}; try { res = typeof x.resultJson === 'string' ? JSON.parse(x.resultJson) : (x.resultJson || {}); } catch (e) {}
    c.status = 'completed'; c.output = { images: res.resultUrls || [] };
  }
  return jsonResp({ data: c }, 200);
}

export async function sunoFetch(url, init) {
  init = init || {};
  const m = String(url).match(/\/v1\/tasks\/([^/?#]+)/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (id.startsWith('kieimg_')) return verImagemKie(id.slice(7));
    if (id.startsWith('kie_')) return verMusicaKie(id.slice(4));
    return fetch(url, init);
  }
  // criação de tarefa: 1º Kie
  let corpo = {}; try { corpo = JSON.parse(init.body || '{}'); } catch (e) {}
  let kid = null;
  if (corpo.model === 'suno-ai/music') kid = await criarMusicaKie(corpo.input || {});
  else if (IMG_KIE[corpo.model]) kid = await criarImagemKie(corpo.model, corpo.input || {});
  if (kid) return jsonResp({ data: { task_id: kid } }, 200);
  // 2º Unifically (reserva)
  if (kieChave() && (corpo.model === 'suno-ai/music' || IMG_KIE[corpo.model])) console.log('Kie falhou — usando Unifically (' + corpo.model + ')');
  try { return await fetch(url, init); } catch (e) { return jsonResp({ error: 'rede' }, 502); }
}
