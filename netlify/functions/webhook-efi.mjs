import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const HORAS_48 = 48;

function seguroIgual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const secret = (process.env.EFI_WEBHOOK_SECRET || '').trim();
  if (secret) {
    const url = new URL(req.url);
    if (!seguroIgual(url.searchParams.get('hmac'), secret)) {
      console.error('Webhook Efí rejeitado: HMAC inválido.');
      return new Response('nao autorizado', { status: 401 });
    }
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response('ok', { status: 200 }); }

  const pix = Array.isArray(body && body.pix) ? body.pix : [];
  if (!pix.length) return new Response('ok', { status: 200 });

  const mapStore = getStore('efi-txid');
  const giftStore = getStore('presentes');

  for (const evento of pix) {
    const txid = evento && evento.txid;
    if (!txid) continue;
    try {
      const mapa = await mapStore.get(txid, { type: 'json' });
      if (!mapa || !mapa.giftId) continue;

      const presente = await giftStore.get(mapa.giftId, { type: 'json' });
      if (!presente) continue;

      const agora = Date.now();
      presente.pago = true;
      presente.pagoEm = presente.pagoEm || agora;
      presente.criadoEm = presente.criadoEm || agora;
      presente.expiraEm = (presente.duracao === 'h48') ? presente.criadoEm + HORAS_48 * 3600 * 1000 : null;
      presente.pagamento = Object.assign({}, presente.pagamento || {}, {
        provedor: 'efi', txid, status: 'CONCLUIDA', e2eid: evento.endToEndId || null,
        valorRecebido: evento.valor || null, pagoEm: presente.pagoEm
      });
      await giftStore.setJSON(mapa.giftId, presente);
    } catch (e) {
      console.error('Erro ao processar Pix Efí', txid, e && e.stack || e);
      // Responde 2xx para eventos já processados/irrelevantes; falhas pontuais ficam registradas no log.
    }
  }

  return new Response('ok', { status: 200 });
};
