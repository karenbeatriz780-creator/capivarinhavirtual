// Responde se a letra pedida em segundo plano já ficou pronta.
import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return json({ erro: 'id inválido' }, 400);
  const r = await getStore('letras').get(id, { type: 'json' });
  if (!r) return json({ pronto: false });
  if (r.erro) return json({ pronto: true, erro: r.erro });
  return json({ pronto: true, letra: r.letra });
};
