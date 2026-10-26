import { getStore } from '@netlify/blobs';
import { enviarTexto, marcarConversa, entregarMusica, entregarAudiosPagos, chaveNum, registrar, SITE } from './_zap.mjs';
import { tratarBot, boasVindas } from './_bot.mjs';

// WEBHOOK DO WHATSAPP (Meta Cloud API)
// URL de callback:  https://capivarinhalove.com.br/.netlify/functions/whatsapp-webhook
// Verificar token:  o mesmo texto salvo no Netlify como WHATSAPP_VERIFY_TOKEN
//
// GET  → a Meta confere o token uma vez (hub.challenge)
// POST → mensagens recebidas e status de entrega.
//        Responde AUTOMÁTICO com a mensagem de boas-vindas (1 vez a cada 12 h
//        por pessoa, pra não ficar repetindo numa conversa).
//        Resposta a quem chamou primeiro é conversa de serviço: não usa modelo.


const BOAS_VINDAS =
  '🎵 Olá! Seja bem-vindo(a) à *Capivarinha Love*! 💗\n\n' +
  'Como podemos ajudar?\n\n' +
  '🎶 *Já comprou sua música?*\nAcesse agora:\n' + SITE + '/#/meus\n\n' +
  'Basta informar o número do WhatsApp utilizado na compra.\n\n' +
  '🎤 *Quer criar uma música personalizada?*\nAcesse:\n' + SITE + '/#/criar/musica\n\n' +
  '💬 *Precisa de atendimento?*\nEnvie sua dúvida por aqui que nossa equipe responderá assim que possível.\n\n' +
  'A Capivarinha Love agradece seu contato! 💗';

async function processar(corpo) {
  try {
    const loja = getStore('whatsapp');
    const entradas = (corpo && corpo.entry) || [];
    for (const en of entradas) {
      for (const ch of en.changes || []) {
        const v = ch.value || {};
        for (const msg of v.messages || []) {
          const ir = msg.interactive && (msg.interactive.button_reply || msg.interactive.list_reply);
          const txt = (msg.text && msg.text.body) || (msg.button && msg.button.text) ||
            (ir && ('[' + ir.id + '] ' + ir.title)) || msg.type;
          console.log('WHATSAPP MSG de ' + msg.from + ': ' + String(txt).slice(0, 300));
          // a Meta às vezes entrega a MESMA mensagem 2 vezes → processa só uma
          if (await loja.get('msg_' + msg.id, { type: 'json' }).catch(() => null)) { console.log('repetida, ignorei: ' + msg.id); continue; }
          await loja.setJSON('msg_' + msg.id, { de: msg.from, em: Date.now(), msg });
          // guarda o texto pra aparecer no painel (conversas)
          await loja.setJSON('in_' + chaveNum(msg.from) + '_' + Date.now(), { de: String(msg.from), nome: (v.contacts && v.contacts[0] && v.contacts[0].profile && v.contacts[0].profile.name) || '', txt: String(ir ? '👆 ' + ir.title : txt).slice(0, 1000), em: Date.now() }).catch(() => {});
          // Cliente apertou "Receber minha música no WhatsApp" no site:
          // a mensagem vem com o código "t.<id>" → manda o link da música dele.
          try {
            await marcarConversa(msg.from);
            const cod = /\bt\.([A-Za-z0-9_-]{6,80})/.exec(String(txt || ''));
            if (cod) {
              const tid = cod[1];
            await registrar('pediu_site', { numero: String(msg.from), taskId: tid });
              await loja.setJSON('optin_' + tid, { numero: String(msg.from), em: Date.now() });
              const r = await entregarMusica(tid, msg.from);
              if (r === 'esperando') {
                await loja.setJSON('pend_' + tid, { taskId: tid, numero: String(msg.from), em: Date.now() });
                await enviarTexto(msg.from, '✅ Recebi! Sua música está sendo criada agora 🎶\n\nPode ficar tranquilo(a): assim que ficar pronta eu te mando aqui mesmo, em instantes. 💗');
              } else if (r === 'naoachei') {
                await enviarTexto(msg.from, 'Não achei essa música 😕\nCrie a sua aqui: ' + SITE + '/#/criar/musica');
              } else if (r === 'ja') {
                await enviarTexto(msg.from, '🎶 Sua música está aqui:\n' + SITE + '/#/ouvir/t.' + tid + '\n\nSe já pagou, ela também fica em: ' + SITE + '/#/meus');
              }
              await loja.setJSON('bv_' + String(msg.from).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
              continue;
            }
          } catch (e) { console.error('enviar música:', e && e.message); }
          // Pagou, recebeu o modelo e agora respondeu → manda os áudios completos (grátis)
          try {
            const pa = await loja.get('pagoaud_' + chaveNum(msg.from), { type: 'json' }).catch(() => null);
            if (pa && Date.now() - (pa.em || 0) < 7 * 24 * 3600 * 1000) {
              await loja.delete('pagoaud_' + chaveNum(msg.from)).catch(() => {});
              const g = await getStore('presentes').get(pa.id, { type: 'json' }).catch(() => null);
              if (g && g.pago && await entregarAudiosPagos(String(msg.from), g)) {
                await registrar('pago_audios', { para: String(msg.from), pedido: pa.id });
                await loja.setJSON('bv_' + String(msg.from).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
                continue;
              }
            }
          } catch (e) { console.error('áudios pagos:', e && e.message); }
          // Robô de criar música (passo a passo)
          try {
            if (await tratarBot(msg)) {
              await loja.setJSON('bv_' + String(msg.from).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
              continue;
            }
          } catch (e) { console.error('robô:', e && e.stack || e); }
          // pediu atendente: o robô fica quieto por 12 h
          try {
            const h = await loja.get('humano_' + chaveNum(msg.from), { type: 'json' }).catch(() => null);
            if (h && Date.now() - (h.em || 0) < 12 * 3600 * 1000) continue;
          } catch (e) {}
          // sem conversa em andamento: responde com o menu (no máximo 1 vez a cada 3 min)
          try {
            const chave = 'bv_' + String(msg.from).replace(/\D/g, '');
            const ult = await loja.get(chave, { type: 'json' }).catch(() => null);
            if (!ult || Date.now() - (ult.em || 0) > 3 * 60 * 1000) {
              await loja.setJSON(chave, { em: Date.now() });
              const ok = await boasVindas(msg.from);
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
}

export default async (req, context) => {
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
    // Responde 200 na hora pra Meta (senão ela reenvia a mensagem) e
    // continua o trabalho em segundo plano.
    const trabalho = processar(corpo);
    if (context && typeof context.waitUntil === 'function') context.waitUntil(trabalho);
    else await trabalho;
    // a Meta exige resposta 200 rápida, senão ela reenvia
    return new Response('ok', { status: 200 });
  }

  return new Response('método não permitido', { status: 405 });
};
