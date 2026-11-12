import { getStore } from '@netlify/blobs';
import { enviarTexto, marcarConversa, entregarMusica, entregarAudiosPagos, chaveNum, registrar, SITE, entregarPedidoPagoZap } from './_zap.mjs';
import { tratarBot, boasVindas } from './_bot.mjs';
import { entregarPreviaLivro, reservar } from './_livros.mjs';
import { analisarComprovante } from './_comprovante.mjs';
import { idsDoTel, lerIndice } from './_indice.mjs';

// 🧾 cliente mandou FOTO/print no WhatsApp e tem pedido no Pix manual esperando → confere o comprovante
async function pedidoManualPendente(numero) {
  const ent = await idsDoTel(numero, await lerIndice()).catch(() => null);
  const ids = [...new Set(((ent && ent.p) || []))].slice(-80), pres = getStore('presentes');
  const gs = (await Promise.all(ids.map((id) => pres.get(id, { type: 'json' }).catch(() => null)))).filter(Boolean).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  for (const g of gs) {
    if (g && !g.pago && !g.cancelado && g.pagamento && g.pagamento.provedor === 'manual' && Date.now() - (g.pagamento.manualEm || g.criadoEm || 0) < 72 * 3600e3) return g;
  }
  return null;
}
async function baixarMidia(mediaId) {
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  const info = await (await fetch('https://graph.facebook.com/v25.0/' + mediaId, { headers: { Authorization: 'Bearer ' + token } })).json();
  if (!info || !info.url) throw new Error('mídia sem url');
  const r = await fetch(info.url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('download ' + r.status);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: info.mime_type || 'image/jpeg' };
}

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
          // LIVRO MÁGICO: tocou em "Receber minha prévia no WhatsApp" → código "L.<pedido>.<token>"
          try {
            const lcod = /\bL\.(L[0-9a-f]{14})\.([0-9a-f]{24})\b/i.exec(String(txt || ''));
            if (lcod) {
              await marcarConversa(msg.from);
              await registrar('pediu_site', { numero: String(msg.from), pedido: lcod[1], via: 'livro' });
              // grava o pedido ANTES: assim o motor do livro já manda sozinho quando ficar pronto
              await loja.setJSON('lvpend_' + lcod[1], { id: lcod[1], t: lcod[2].toLowerCase(), numero: String(msg.from), em: Date.now() });
              const r = await entregarPreviaLivro(lcod[1], lcod[2].toLowerCase(), msg.from, SITE);
              if (r !== 'esperando' && r !== 'erro') await loja.delete('lvpend_' + lcod[1]).catch(() => {});
              if (r === 'esperando' && await reservar('lvrec_' + lcod[1] + '_' + String(msg.from), 10 * 60 * 1000)) {
                await enviarTexto(msg.from, '✅ Recebi sua historinha! 📖✨\n\nEstou preparando a *capa* com o rostinho da criança, a *música* com o nome dela e a *primeira ilustração* da história. Assim que ficar pronto eu te mando aqui a prévia. 💛');
              } else if (r === 'naoachei') {
                await enviarTexto(msg.from, 'Não achei esse livro 😕\nCrie o seu aqui: ' + SITE + '/#/livro');
              }
              await loja.setJSON('bv_' + String(msg.from).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
              continue;
            }
          } catch (e) { console.error('prévia do livro:', e && e.message); }
          try {
            await marcarConversa(msg.from);
            const cod = /(?:\bt\.|ID do pedido:\s*)([A-Za-z0-9_-]{6,80})/i.exec(String(txt || ''));
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
          // 🧾 mandou FOTO ou PDF (comprovante) e tem Pix manual esperando → a IA (Kie) confere
          try {
            if (msg.type === 'image' || (msg.type === 'document' && msg.document)) {
              const g = await pedidoManualPendente(msg.from);
              if (g) {
                const mt = String((msg.document && msg.document.mime_type) || 'image/jpeg');
                if (msg.type === 'document' && !/^image\/|^application\/pdf/.test(mt)) { await enviarTexto(msg.from, '📸 Me manda o comprovante como *print (foto)* ou *PDF*, por favor.'); continue; }
                await enviarTexto(msg.from, '🧾 Recebi! Conferindo seu comprovante, um instante…');
                const md = await baixarMidia((msg.image || msg.document).id);
                const r = await analisarComprovante(g.id, md.buf, md.mime || mt, 'whatsapp');
                await loja.delete('printpend_' + chaveNum(msg.from)).catch(() => {});
                if (r.status === 'liberado') {
                  await enviarTexto(msg.from, '✅ *Pagamento confirmado!* Mandando suas músicas completas agora 🎶💗');
                  const g2 = await getStore('presentes').get(g.id, { type: 'json' }).catch(() => null);
                  if (g2) await entregarPedidoPagoZap(g2);
                } else if (r.status === 'conferir') {
                  await enviarTexto(msg.from, '⏳ Recebi! Seu comprovante foi pra conferência e a liberação sai em poucos minutos. Não precisa pagar de novo 💗');
                } else {
                  await enviarTexto(msg.from, '⚠️ Não consegui confirmar esse comprovante: ' + (r.motivos || []).join('; ') + '.\n\nConfira se é o Pix de *R$ ' + Number(g.pagamento.valor || 0).toFixed(2).replace('.', ',') + '* para *Gusthavo dos Santos de Jesus* e mande de novo.');
                }
                await loja.setJSON('bv_' + String(msg.from).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
                continue;
              }
            }
          } catch (e) { console.error('comprovante whatsapp:', e && e.message); }
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
          // a Meta aceitou e depois NÃO entregou → aparece em "Falhas" no painel (antes ficava escondido)
          if (st.status === 'failed') {
            const e0 = (st.errors && st.errors[0]) || {};
            const motivo = e0.code === 131042 ? 'WhatsApp BLOQUEADO: pagamento pendente na conta do WhatsApp Business (Meta → Cobrança e pagamentos)'
              : e0.code === 131047 ? 'Não entregou: passou de 24 h desde a última mensagem da pessoa'
              : 'O WhatsApp não entregou: ' + String(e0.title || e0.message || 'erro ' + (e0.code || '')).slice(0, 150);
            await registrar('falha', { para: String(st.recipient_id), erro: motivo, codigo: e0.code || null });
          }
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
