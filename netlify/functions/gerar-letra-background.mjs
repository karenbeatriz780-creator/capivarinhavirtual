// Escreve a letra EM SEGUNDO PLANO (o Netlify deixa rodar até 15 min, em vez
// dos 30s das funções normais). Assim o GPT-5.4 tem o tempo que precisar.
// O navegador manda um "id" e depois pergunta em gerar-letra-status se ficou pronta.
import { getStore } from '@netlify/blobs';
import gerarLetra from './gerar-letra.js';

export default async (req) => {
  let body = null;
  try { body = await req.json(); } catch {}
  const id = String((body && body.id) || '');
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return;
  const store = getStore('letras');
  try {
    const resp = await gerarLetra(new Request('https://interno/gerar-letra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-modo-longo': '1' },
      body: JSON.stringify(body)
    }));
    const d = await resp.json().catch(() => null);
    if (resp.ok && d && d.letra) await store.setJSON(id, { pronto: true, letra: d.letra, em: Date.now() });
    else await store.setJSON(id, { pronto: true, erro: (d && d.erro) || 'Não consegui escrever a letra agora. Tenta de novo em instantes.', em: Date.now() });
  } catch (e) {
    console.error('gerar-letra-background:', e && e.message);
    await store.setJSON(id, { pronto: true, erro: 'Não consegui escrever a letra agora. Tenta de novo em instantes.', em: Date.now() }).catch(() => {});
  }
};
