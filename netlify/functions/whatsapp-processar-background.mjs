import { processar } from './whatsapp-webhook.mjs';
// Processa as mensagens do WhatsApp em SEGUNDO PLANO (até 15 min): IA, conferência de pedidos, envio de áudios.
// Quem chama é o whatsapp-webhook (responde 200 pra Meta na hora e manda o trabalho pra cá).
export default async (req) => {
  const chave = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  if (!chave || (req.headers.get('x-zap-interno') || '') !== chave) return new Response('não autorizado', { status: 401 });
  let corpo = null; try { corpo = await req.json(); } catch (e) {}
  await processar(corpo);
  return new Response('ok');
};
