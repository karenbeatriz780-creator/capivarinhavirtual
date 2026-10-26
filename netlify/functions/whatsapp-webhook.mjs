import { getStore } from '@netlify/blobs';

// WEBHOOK DO WHATSAPP (Meta Cloud API)
// URL de callback:  https://capivarinhalove.com.br/.netlify/functions/whatsapp-webhook
// Verificar token:  o mesmo texto salvo no Netlify como WHATSAPP_VERIFY_TOKEN
//
// GET  → a Meta confere o token uma vez (hub.challenge)
// POST → mensagens recebidas e status de entrega.
//        Responde AUTOMÁTICO com a mensagem de boas-vindas (1 vez a cada 12 h
//        por pessoa, pra não ficar repetindo numa conversa).
//        Resposta a quem chamou primeiro é conversa de serviço: não usa modelo.

const VERSAO = 'v25.0';
const SITE = 'https://capivarinhalove.com.br';

const BOAS_VINDAS =
  '🎵 Olá! Seja bem-vindo(a) à *Capivarinha Love*! 💗\n\n' +
  'Como podemos ajudar?\n\n' +
  '🎶 *Já comprou sua música?*\nAcesse agora:\n' + SITE + '/#/meus\n\n' +
  'Basta informar o número do WhatsApp utilizado na compra.\n\n' +
  '🎤 *Quer criar uma música personalizada?*\nAcesse:\n' + SITE + '/#/criar/musica\n\n' +
  '💬 *Precisa de atendimento?*\nEnvie sua dúvida por aqui que nossa equipe responderá assim que possível.\n\n' +
  'A Capivarinha Love agradece seu contato! 💗';

async function enviarTexto(para, texto) {
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  const phoneId = (process.env.WHATSAPP_PHONE_ID || '').trim();
  if (!token || !phoneId) { console.log('whatsapp: falta WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID'); return false; }
  try {
    const r = await fetch('https://graph.facebook.com/' + VERSAO + '/' + phoneId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'text', text: { preview_url: false, body: texto } })
    });
    if (!r.ok) { console.error('whatsapp envio:', r.status, (await r.text()).slice(0, 400)); return false; }
    return true;
  } catch (e) { console.error('whatsapp envio (rede):', e && e.message); return false; }
}

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
      const loja = getStore('whatsapp');
      const entradas = (corpo && corpo.entry) || [];
      for (const en of entradas) {
        for (const ch of en.changes || []) {
          const v = ch.value || {};
          for (const msg of v.messages || []) {
            const txt = (msg.text && msg.text.body) || (msg.button && msg.button.text) ||
              (msg.interactive && JSON.stringify(msg.interactive).slice(0, 200)) || msg.type;
            console.log('WHATSAPP MSG de ' + msg.from + ': ' + String(txt).slice(0, 300));
            await loja.setJSON('msg_' + msg.id, { de: msg.from, em: Date.now(), msg });
            // boas-vindas automática: no máximo 1 vez a cada 12 h por número
            try {
              const chave = 'bv_' + String(msg.from).replace(/\D/g, '');
              const ult = await loja.get(chave, { type: 'json' }).catch(() => null);
              if (!ult || Date.now() - (ult.em || 0) > 12 * 3600 * 1000) {
                await loja.setJSON(chave, { em: Date.now() });
                const ok = await enviarTexto(msg.from, BOAS_VINDAS);
                if (!ok) await loja.setJSON(chave, { em: 0 }).catch(() => {});
              }
            } catch (e) { console.error('boas-vindas:', e && e.message); }
          }
          for (const st of v.statuses || []) {
            console.log('WHATSAPP STATUS ' + st.status + ' para ' + st.recipient_id + (st.errors ? ' erro: ' + JSON.stringify(st.errors).slice(0, 300) : ''));
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
