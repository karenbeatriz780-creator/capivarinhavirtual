import { getStore } from '@netlify/blobs';
import { lerDias, idsDosDias } from './_indice.mjs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function autorizado(req) {
  // Painel aberto: quem tem o link vê sem senha.
  return true;
}

export default async (req) => {
  try {
    if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    const store = getStore('musicas');
    const nDias = Math.max(0, Math.min(60, parseInt(new URL(req.url).searchParams.get('dias'), 10) || 0));
    const idxDias = nDias ? await lerDias() : null;
    let blobs, parcial = false;
    if (nDias && idxDias && idxDias.dias) { blobs = idsDosDias(idxDias, nDias, 't').map((key) => ({ key })); parcial = true; }
    else blobs = (await store.list()).blobs;

    // Busca tudo em paralelo em vez de um registro de cada vez — essa fila
    // serial é o que fazia o painel travar pra abrir conforme o número de
    // músicas geradas crescia.
    const registros = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)));
    const musicas = registros.filter(Boolean);
    // mais recentes primeiro
    musicas.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    return json({ ok: true, musicas, parcial });
  } catch (e) {
    console.error('admin-musicas (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
