// 🎶 Contador público: quantas músicas foram criadas hoje (cada pedido de música gera 2 versões).
import { idsDoDia } from './_indice.mjs';
export default async () => {
  const dia = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  let n = 0; try { n = (await idsDoDia(dia, 't')).length * 2; } catch (e) {}
  return new Response(JSON.stringify({ n }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'Netlify-CDN-Cache-Control': 'public, max-age=120' } });
};
