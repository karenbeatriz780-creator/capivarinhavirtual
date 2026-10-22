import { montarIndice } from './_indice.mjs';
// Monta (ou remonta) o índice de telefones em segundo plano (até 15 min).
export default async () => {
  try { const n = await montarIndice(); console.log('índice de telefones montado:', n, 'números'); }
  catch (e) { console.error('indexar-telefones:', e && e.stack || e); }
};
