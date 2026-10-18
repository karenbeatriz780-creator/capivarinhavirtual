import { getStore } from '@netlify/blobs';

// WEBHOOK DO WHATSAPP (Meta Cloud API)
// URL de callback:  https://capivarinhalove.com.br/.netlify/functions/whatsapp-webhook
// Verificar token:  o mesmo texto salvo no Netlify como WHATSAPP_VERIFY_TOKEN
//
// GET  → a Meta confere o token uma vez (hub.challenge)
// POST → mensagens recebidas e status de entrega. Por enquanto só guarda e
//        registra no log; o robô vai ler daqui depois.

export default async (req) => {
  const u = new URL(req.url);

  if (req.method === 'GET') {
    const modo = u.searchParams.get('hub.mode');
    const token = u.searchParams.get('hub.verify_token');
    const desafio = u.searchParams.get('hub.challenge') || '';
    const certo = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
    if (modo === 'subscribe' && certo && token === certo) {
      return new Response(desafio, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('token inválido', { status: 403 });
  }

  if (req.method === 'POST') {
    let corpo = null;
    try { corpo = await req.json(); } catch (e) {}
    try {
      const entradas = (corpo && corpo.entry) || [];
      for (const en of entradas) {
        for (const ch of en.changes || []) {
          const v = ch.value || {};
          for (const msg of v.messages || []) {
            const txt = (msg.text && msg.text.body) || (msg.button && msg.button.text) ||
              (msg.interactive && JSON.stringify(msg.interactive).slice(0, 200)) || msg.type;
            console.log('WHATSAPP MSG de ' + msg.from + ': ' + String(txt).slice(0, 300));
            await getStore('whatsapp').setJSON('msg_' + msg.id, { de: msg.from, em: Date.now(), msg });
          }
          for (const st of v.statuses || []) {
            console.log('WHATSAPP STATUS ' + st.status + ' para ' + st.recipient_id);
          }
        }
      }
    } catch (e) {
      console.error('whatsapp-webhook:', e && e.message);
    }
    // a Meta exige resposta 200 rápida, senão ela reenvia
    return new Response('ok', { status: 200 });
  }

  return new Response('método não permitido', { status: 405 });
};
