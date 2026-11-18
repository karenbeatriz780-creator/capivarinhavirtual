// 🔻 Painel → "Onde desistem": quantas pessoas chegaram em cada etapa da música (hoje / ontem / 7 dias), por aparelho.
import { getStore } from '@netlify/blobs';
import { ETAPAS } from './funil-evento.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const u = new URL(req.url), per = u.searchParams.get('p') || 'hoje';
  const dia = (i) => new Date(Date.now() - 3 * 36e5 - i * 864e5).toISOString().slice(0, 10);
  const dias = per === 'ontem' ? [dia(1)] : per === '7d' ? [0, 1, 2, 3, 4, 5, 6].map(dia) : [dia(0)];
  const st = getStore('funil-musica');
  const cont = {}; ETAPAS.forEach((e) => { cont[e] = { total: 0, ios: 0, android: 0, outro: 0 }; });
  for (const d of dias) {
    const { blobs } = await st.list({ prefix: d + '/' });
    for (const x of blobs) { const [, e, so] = x.key.split('/'); if (cont[e]) { cont[e].total++; cont[e][so] = (cont[e][so] || 0) + 1; } }
  }
  return json({ periodo: per, dias, etapas: ETAPAS.map((e) => Object.assign({ e }, cont[e])) });
};
