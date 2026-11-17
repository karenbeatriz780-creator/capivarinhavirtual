// Roda sozinho quando um deploy termina (evento do Netlify).
// Usado pra fazer a LIMPEZA de 3 dias do robô na hora (14/11), sem esperar a próxima rodada. Depois da limpeza, não faz nada.
import { getStore } from '@netlify/blobs';
export default async () => {
  // 15/11: QR Code corrigido → refaz uma vez os PDFs dos livros pagos nos últimos 10 dias
  try {
    const L = getStore('gastos');
    if (!(await L.get('qrfix_20261115', { type: 'json' }).catch(() => null))) {
      await L.setJSON('qrfix_20261115', { em: Date.now() });
      const { refazerLivros } = await import('./admin-qr-refazer.mjs');
      console.log('QR corrigido: livros refeitos', await refazerLivros(10));
    }
  } catch (e) { console.error('qrfix:', e && e.message); }
  // 17/11 20h: regras novas (ROAS 1,5 + aprendizagem) → roda o robô uma vez na hora do deploy
  try {
    const G = getStore('gastos');
    if (!(await G.get('roda_deploy_20261117b', { type: 'json' }).catch(() => null))) {
      await G.setJSON('roda_deploy_20261117b', { em: Date.now() });
      const { rodarRobo } = await import('./meta-auto-agendado.mjs');
      console.log('robô no deploy:', JSON.stringify(await rodarRobo(false)).slice(0, 500));
    }
  } catch (e) { console.error('roda_deploy:', e && e.message); }
  // 17/11: tira os Stories do Facebook das campanhas sem futuro (uma vez, em segundo plano)
  try {
    if (!(await getStore('gastos').get('semstoryfb_20261117', { type: 'json' }).catch(() => null))) {
      const base = process.env.URL || 'https://capivarinhalove.com.br';
      await fetch(base + '/.netlify/functions/posicoes-fracas-background', { method: 'POST', headers: { 'x-admin-key': (process.env.ADMIN_SENHA || '').trim() } });
    }
  } catch (e) { console.error('semstoryfb:', e && e.message); }
  try {
    const feita = await getStore('gastos').get('limpeza3d_20261114', { type: 'json' }).catch(() => null);
    if (feita) return new Response('ok');
    const { rodarRobo } = await import('./meta-auto-agendado.mjs');
    const r = await rodarRobo(false);
    console.log('limpeza do robô no deploy:', JSON.stringify(r).slice(0, 500));
  } catch (e) { console.error('deploy-succeeded:', e && e.message); }
  return new Response('ok');
};
