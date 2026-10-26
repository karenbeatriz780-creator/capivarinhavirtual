import { getStore } from '@netlify/blobs';

// Funções do WhatsApp usadas pelo webhook e pelo aviso automático.
export const VERSAO = 'v25.0';
export const SITE = 'https://capivarinhalove.com.br';
const H23 = 23 * 3600 * 1000; // janela grátis da Meta é 24 h — usamos 23 h por segurança

// Mesmo número escrito de jeitos diferentes (com/sem 55, com/sem o 9) → mesma chave: DDD + 8 últimos
export function chaveNum(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return '';
  return d.slice(0, 2) + d.slice(-8);
}

async function chamar(corpo) {
  const token = (process.env.WHATSAPP_TOKEN || '').trim();
  const phoneId = (process.env.WHATSAPP_PHONE_ID || '').trim();
  if (!token || !phoneId) { console.log('whatsapp: falta WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID'); return false; }
  try {
    const r = await fetch('https://graph.facebook.com/' + VERSAO + '/' + phoneId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ messaging_product: 'whatsapp', recipient_type: 'individual' }, corpo))
    });
    if (!r.ok) { console.error('whatsapp envio:', r.status, (await r.text()).slice(0, 400)); return false; }
    return true;
  } catch (e) { console.error('whatsapp envio (rede):', e && e.message); return false; }
}

export const enviarTexto = (para, texto) => chamar({ to: para, type: 'text', text: { preview_url: true, body: texto } });
export const enviarAudio = (para, link) => chamar({ to: para, type: 'audio', audio: { link } });

// Modelo aprovado na Meta (pago) — só pra quem NÃO chamou no WhatsApp.
// Nome do modelo no Netlify: WHATSAPP_MODELO_PREVIA. Texto com {{1}} = nome e {{2}} = link.
function enviarModelo(para, nome, link) {
  const modelo = (process.env.WHATSAPP_MODELO_PREVIA || '').trim();
  if (!modelo) return Promise.resolve(false);
  return chamar({
    to: para, type: 'template',
    template: {
      name: modelo, language: { code: (process.env.WHATSAPP_MODELO_IDIOMA || 'pt_BR').trim() },
      components: [{ type: 'body', parameters: [{ type: 'text', text: nome || 'você' }, { type: 'text', text: link }] }]
    }
  });
}

// Guarda que esse número mandou mensagem agora (abre a janela grátis de 24 h)
export async function marcarConversa(numeroZap) {
  const k = chaveNum(numeroZap); if (!k) return;
  await getStore('whatsapp').setJSON('ult_' + k, { numero: String(numeroZap), em: Date.now() }).catch(() => {});
}
async function conversaAberta(numero) {
  const k = chaveNum(numero); if (!k) return null;
  const u = await getStore('whatsapp').get('ult_' + k, { type: 'json' }).catch(() => null);
  return u && Date.now() - (u.em || 0) < H23 ? u.numero : null;
}

// Manda a música (link + áudio da prévia) UMA vez só.
// Volta: 'enviado' | 'ja' | 'esperando' | 'semjanela' | 'naoachei' | 'erro'
export async function entregarMusica(taskId, numeroPedido) {
  const loja = getStore('whatsapp');
  if (await loja.get('env_' + taskId, { type: 'json' }).catch(() => null)) return 'ja';
  const m = await getStore('musicas').get(taskId, { type: 'json' }).catch(() => null);
  if (!m) return 'naoachei';
  if (!m.url) return 'esperando';
  if (m.pago) return 'ja';
  const nome = String(m.nomes || '').trim().slice(0, 60);
  const link = SITE + '/#/ouvir/t.' + taskId;
  const opt = await loja.get('optin_' + taskId, { type: 'json' }).catch(() => null);
  let para = (opt && Date.now() - (opt.em || 0) < H23 && opt.numero) ||
    await conversaAberta(numeroPedido || m.whatsapp) ||
    (opt && await conversaAberta(opt.numero));
  let ok = false;
  if (para) {
    ok = await enviarTexto(para,
      '🎶 *Sua música ficou pronta!*' + (nome ? '\nFeita pra *' + nome + '* 💗' : '') + '\n\n' +
      '▶️ Ouça e finalize aqui:\n' + link + '\n\n' +
      'Depois do pagamento você recebe as músicas *completas*, sem corte, pra baixar e mandar pra quem você ama.\n\n' +
      'Guarde esta conversa: o link fica salvo aqui pra você voltar quando quiser. 💗');
    if (ok) await enviarAudio(para, SITE + '/.netlify/functions/previa-musica?taskId=' + encodeURIComponent(taskId) + '&v=1');
  } else {
    let d = String(numeroPedido || m.whatsapp || '').replace(/\D/g, '');
    if (d.length < 10) return 'semjanela';
    if (!d.startsWith('55') || d.length <= 11) d = '55' + d;
    ok = await enviarModelo(d, nome, link);
    if (!ok) return 'semjanela';
    para = d;
  }
  if (!ok) return 'erro';
  await loja.setJSON('env_' + taskId, { para, em: Date.now() }).catch(() => {});
  await loja.setJSON('bv_' + String(para).replace(/\D/g, ''), { em: Date.now() }).catch(() => {});
  return 'enviado';
}
