// 🎤 27/11: "Cantada com a minha voz" — cria a voz do cliente na Kie (Suno Voice, grátis na Kie).
// Fluxo: 1) sobe a amostra cantada  2) Kie devolve a frase de verificação  3) sobe a frase cantada
//        4) cria a voz  5) quando ficar "success", o id da tarefa da frase É a voz (vozId) → vai pro gerar-musica.
// Ações (POST JSON): subir {b64, tipo} → {url} · frase {url, dur} → {taskId} · criar {taskId, url} → {ok}
// GET ?a=KEY → devolve o áudio (a Kie baixa daqui) · GET ?t=taskId → {estado, frase}
import { getStore } from '@netlify/blobs';
const KIE = 'https://api.kie.ai', chave = () => (process.env.KIE_API_KEY || '').trim();
const BASE = () => (process.env.URL || 'https://capivarinhalove.com.br');
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const st = () => getStore('vozes');
async function kie(path, body) {
  const r = await fetch(KIE + path, body ? { method: 'POST', headers: { Authorization: 'Bearer ' + chave(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { headers: { Authorization: 'Bearer ' + chave() } });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || (d.code && d.code !== 200)) throw new Error((d && (d.msg || d.message)) || ('Kie ' + r.status));
  return d.data || {};
}
export default async (req) => {
  try {
    const u = new URL(req.url);
    if (req.method === 'GET') {
      const a = u.searchParams.get('a');
      if (a) {
        if (!/^[a-z0-9]{10,40}$/.test(a)) return new Response('', { status: 404 });
        const buf = await st().get('a_' + a, { type: 'arrayBuffer' }).catch(() => null);
        if (!buf) return new Response('', { status: 404 });
        return new Response(buf, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(buf.byteLength), 'Cache-Control': 'private, max-age=86400' } });
      }
      if (u.searchParams.get('diag')) { // últimos avisos da Kie (pra entender o erro)
        const l = await st().list({ prefix: 'cb_' }).catch(() => ({ blobs: [] }));
        const ks = (l.blobs || []).map((x) => x.key).sort().slice(-6);
        const itens = await Promise.all(ks.map((k) => st().get(k, { type: 'json' }).catch(() => null)));
        return json({ avisos: itens });
      }
      const t = u.searchParams.get('t');
      if (!t || !/^[A-Za-z0-9_-]{6,80}$/.test(t)) return json({ erro: 'tarefa?' }, 400);
      const d = await kie('/api/v1/jobs/recordInfo?taskId=' + encodeURIComponent(t));
      let res = {}; try { res = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : (d.resultJson || {}); } catch (e) {}
      const frase = (res.data && (res.data.verify_phrase_text || res.data.verifyPhraseText)) || res.verify_phrase_text || null;
      return json({ estado: String(d.state || '').toLowerCase(), frase, erro: d.failMsg || null });
    }
    const b = await req.json().catch(() => ({}));
    // callback da Kie (ela exige uma URL que responda 200) — guarda o último resultado pra conferência
    if (u.searchParams.get('cb')) { try { await st().setJSON('cb_' + Date.now(), { b, em: Date.now() }); } catch (e) {} return json({ ok: true }); }
    if (!chave()) return json({ erro: 'Kie não configurada.' }, 503);
    if (b.acao === 'subir') {
      const bin = Buffer.from(String(b.b64 || ''), 'base64');
      if (bin.length < 8000 || bin.length > 6e6) return json({ erro: 'Áudio muito curto ou muito grande.' }, 400);
      const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      await st().set('a_' + k, bin);
      return json({ url: BASE() + '/.netlify/functions/voz?a=' + k });
    }
    if (b.acao === 'frase') {
      if (!/\/\.netlify\/functions\/voz\?a=/.test(String(b.url || ''))) return json({ erro: 'url?' }, 400);
      const dur = Math.max(5, Math.min(30, Math.floor(Number(b.dur) || 15)));
      const d = await kie('/api/v1/jobs/createTask', { model: 'ai-music-api/validation-phrase', callBackUrl: BASE() + '/.netlify/functions/voz?cb=1', input: { voice_url: b.url, vocal_start_s: 0, vocal_end_s: dur, language: b.idioma === 'en' ? 'en' : 'pt' } });
      return json({ taskId: d.taskId || d.task_id });
    }
    if (b.acao === 'criar') {
      if (!/\/\.netlify\/functions\/voz\?a=/.test(String(b.url || '')) || !/^[A-Za-z0-9_-]{6,80}$/.test(String(b.taskId || ''))) return json({ erro: 'dados?' }, 400);
      const d = await kie('/api/v1/jobs/createTask', { model: 'ai-music-api/create-voice', callBackUrl: BASE() + '/.netlify/functions/voz?cb=1', input: { task_id: b.taskId, verify_url: b.url, voice_name: 'Cliente Capivarinha', singer_skill_level: 'beginner' } });
      return json({ ok: true, criarId: d.taskId || d.task_id });
    }
    return json({ erro: 'ação?' }, 400);
  } catch (e) { return json({ erro: String((e && e.message) || e).slice(0, 200) }, 502); }
};
