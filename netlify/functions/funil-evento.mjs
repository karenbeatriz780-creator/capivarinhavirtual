// 🔻 Funil da música (17/11): marca que um visitante chegou numa etapa hoje.
// Grava só uma CHAVE vazia por (dia, etapa, aparelho, visitante) — contar é só listar as chaves (rápido, sem corrida).
import { getStore } from '@netlify/blobs';
const ETAPAS = ['entrou', 'musicaPara', 'musicaNome', 'musicaOcasiao', 'musicaGenero', 'musicaClima', 'musicaHistoria', 'musicaLetra', 'musicaFinal', 'escolha', 'pagamento', 'pagou'];
export { ETAPAS };
export default async (req) => {
  if (req.method !== 'POST') return new Response('', { status: 405 });
  let b = {}; try { b = await req.json(); } catch (e) {}
  const v = String(b.v || ''), e = String(b.e || ''), so = ['ios', 'android', 'outro'].indexOf(b.so) >= 0 ? b.so : 'outro';
  if (!/^[a-z0-9]{6,32}$/i.test(v) || ETAPAS.indexOf(e) < 0) return new Response('', { status: 400 });
  const dia = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  await getStore('funil-musica').set(dia + '/' + e + '/' + so + '/' + v, '1').catch(() => {});
  return new Response('', { status: 204 });
};
