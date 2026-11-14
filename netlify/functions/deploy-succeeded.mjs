// Roda sozinho quando um deploy termina (evento do Netlify).
// Usado pra fazer a LIMPEZA de 3 dias do robô na hora (14/11), sem esperar a próxima rodada. Depois da limpeza, não faz nada.
import { getStore } from '@netlify/blobs';
export default async () => {
  try {
    const feita = await getStore('gastos').get('limpeza3d_20261114', { type: 'json' }).catch(() => null);
    if (feita) return new Response('ok');
    const { rodarRobo } = await import('./meta-auto-agendado.mjs');
    const r = await rodarRobo(false);
    console.log('limpeza do robô no deploy:', JSON.stringify(r).slice(0, 500));
  } catch (e) { console.error('deploy-succeeded:', e && e.message); }
  return new Response('ok');
};
