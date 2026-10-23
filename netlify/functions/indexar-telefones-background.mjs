import { getStore } from '@netlify/blobs';
import { montarIndice } from './_indice.mjs';
// Monta (ou remonta) o índice de telefones em segundo plano (até 15 min).
// Trava simples: se já tem uma montagem rodando há menos de 5 min, não começa outra.
export default async () => {
  const st = getStore('indices');
  try {
    const trava = await st.get('montando', { type: 'json' }).catch(() => null);
    if (trava && Date.now() - (trava.em || 0) < 5 * 60 * 1000) { console.log('índice já está sendo montado'); return; }
    await st.setJSON('montando', { em: Date.now() });
    const n = await montarIndice();
    console.log('índice de telefones montado:', n, 'números');
  } catch (e) { console.error('indexar-telefones:', e && e.stack || e); }
  try { await st.setJSON('montando', { em: 0 }); } catch (e) {}
};
