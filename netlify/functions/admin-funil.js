import { getStore } from '@netlify/blobs';

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

    const store = getStore('funil');
    const { blobs } = await store.list();

    // Busca tudo em paralelo em vez de um registro de cada vez — essa fila
    // serial é o que fazia o painel travar pra abrir conforme o número de
    // visitas registradas crescia.
    const registros = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    const visitas = registros.filter(Boolean);
    visitas.sort((a, b) => (b.ultimaVez || 0) - (a.ultimaVez || 0));

    return json({ ok: true, visitas });
  } catch (e) {
    console.error('admin-funil (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
