import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, modoTeste } from './_efi.mjs';
import { indexar, indexarDia, chaveTel, lerIndice, idsDoTel } from './_indice.mjs';

// RECUPERAÇÃO DE VENDA
// Link que você manda no WhatsApp pra quem quase comprou: #/ouvir/<id>
//   GET  ?id=<pedido>  ou ?t=<taskId da música>  → dados da prévia (pra tocar)
//   POST {id} ou {t}                             → gera um Pix novo pra fechar
// Quem só gerou a música (sem pedido) ganha um pedido na hora, com a música dele.

const PRECO_MUSICA = 9.99;
function previa(g, t, v) {
  const base = '/.netlify/functions/previa-musica?';
  return g.id ? base + 'id=' + encodeURIComponent(g.id) + '&v=' + v
              : base + 'taskId=' + encodeURIComponent(t) + '&v=' + v;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
function criarTxid(id) {
  return crypto.createHash('sha256').update(String(id) + ':' + Date.now() + ':' + crypto.randomUUID()).digest('hex').slice(0, 32);
}

// Acha (ou cria) o pedido ligado ao link
async function acharPedido(id, t, criarSeFaltar) {
  const presentes = getStore('presentes');
  if (id) {
    const g = await presentes.get(id, { type: 'json' });
    return g || null;
  }
  if (!t) return null;
  const musicas = getStore('musicas');
  const m = await musicas.get(t, { type: 'json' });
  if (!m || !m.url) return null;
  // pedido pago que usa essa música (direto, ou procurando pelo número do cliente)
  const usa = (g) => g && (g.musicaPreviewId === t || (g.ofertaM1 && g.ofertaM1.id === t) || (g.ofertaM2 && g.ofertaM2.id === t));
  const candidatos = [m.presenteId, m.pedidoRecId].filter(Boolean);
  try {
    const ent = chaveTel(m.whatsapp) ? await idsDoTel(m.whatsapp, await lerIndice()) : null;
    if (ent && ent.p) ent.p.slice(-30).forEach((x) => { if (candidatos.indexOf(x) === -1) candidatos.push(x); });
  } catch (e) {}
  const achados = (await Promise.all(candidatos.map((x) => presentes.get(x, { type: 'json' }).catch(() => null)))).filter((g) => usa(g) || (g && g.id === m.pedidoRecId));
  const pago = achados.find((g) => g.pago && !g.cancelado);
  if (pago) return pago;
  if (m.pedidoRecId) {
    const g = achados.find((x) => x.id === m.pedidoRecId);
    if (g) return g;
  }
  const base = {
    produto: 'musica', duracao: 'vitalicio', musicaOn: true,
    meuNome: '', parceiroNome: '',
    musicaParaNome: m.nomes || '',
    musicaPreviewUrl: m.url, musicaPreviewUrl2: m.url2 || null, musicaPreviewId: t,
    musicaLetra: m.letra || m.letraAprovada || null,
    musicaLetraTexto: m.letraAprovada || m.letra || null,
    musicaEstilo: m.estilo || '', musicaClima: m.clima || '', musicaPara: m.relacao || '',
    musicaOcasiao: m.ocasiao || '', musicaTexto: m.historia || '',
    musicaWhatsapp: m.whatsapp || '', recuperado: true
  };
  if (!criarSeFaltar) return Object.assign({ id: null, pago: false }, base);
  const novoId = 'r' + crypto.randomBytes(6).toString('hex');
  const g = Object.assign({ id: novoId, pago: false, criadoEm: Date.now() }, base);
  await presentes.setJSON(novoId, g);
  m.pedidoRecId = novoId;
  await musicas.setJSON(t, m);
  return g;
}

// Pedido de música simples = 4 músicas por R$ 9,99 (estas 2 + mais 2 liberadas depois do Pix)
function quatroOk(g) {
  return !!g && (g.produto || 'musica') === 'musica' && !g.ofertaM1 && !g.ofertaDe && !g.pacote6 && !g.dobroDe && !g.bonusDe;
}
// Dados da música (sem o MP3 completo) pra montar Carta/Retrospectiva a partir do link
async function dadosMusica(g, t) {
  const tid = t || g.musicaPreviewId || '';
  let m = null;
  if (tid) m = await getStore('musicas').get(tid, { type: 'json' }).catch(() => null);
  m = m || {};
  return {
    t: tid,
    musica: {
      relacao: g.musicaPara || m.relacao || '', nomes: g.musicaParaNome || m.nomes || '',
      ocasiao: g.musicaOcasiao || m.ocasiao || '', estilo: g.musicaEstilo || m.estilo || '',
      clima: g.musicaClima || m.clima || '', historia: g.musicaTexto || m.historia || '',
      letra: g.musicaLetraTexto || m.letraAprovada || m.letra || '', whatsapp: g.musicaWhatsapp || m.whatsapp || ''
    }
  };
}

// Oferta de recuperação do WhatsApp: "4 músicas por R$ 9,99" (vale 1 dia)
async function ofertaRec(t) {
  if (!t) return false;
  const m = await getStore('musicas').get(t, { type: 'json' }).catch(() => null);
  return !!(m && m.ofertaRec && Date.now() - m.ofertaRec < 24 * 3600 * 1000);
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    if (req.method === 'GET') {
      const id = u.searchParams.get('id') || '';
      const t = u.searchParams.get('t') || '';
      const g = await acharPedido(id, t, false);
      if (!g || !g.musicaPreviewUrl) return json({ encontrado: false });
      return json({
        encontrado: true,
        pago: !!g.pago,
        id: g.id,
        para: g.musicaParaNome || g.parceiroNome || '',
        // Nunca entrega o MP3 completo aqui: só a prévia de 70s, cortada no servidor.
        url: previa(g, t, 1),
        url2: g.musicaPreviewUrl2 ? previa(g, t, 2) : null,
        url3: g.ofertaM1 && g.ofertaM1.url ? previa(g, t, 3) : null,
        url4: g.ofertaM1 && g.ofertaM1.url2 ? previa(g, t, 4) : null,
        url5: g.ofertaM2 && g.ofertaM2.url ? previa(g, t, 5) : null,
        url6: g.ofertaM2 && g.ofertaM2.url2 ? previa(g, t, 6) : null,
        valor: (g.pagamento && g.pagamento.valor) || PRECO_MUSICA,
        oferta4: !g.pago && (quatroOk(g) || await ofertaRec(t)),
        ...(await dadosMusica(g, t))
      });
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const g = await acharPedido(String(body.id || ''), String(body.t || ''), true);
    if (!g) return json({ erro: 'Não achei esse pedido.' }, 404);
    if (g.pago) return json({ pago: true, id: g.id });

    const chavePix = (process.env.EFI_PIX_KEY || '').trim();
    if (!chavePix) return json({ erro: 'Servidor sem EFI_PIX_KEY configurada.' }, 500);

    const valor = Number((g.pagamento && g.pagamento.valor) || PRECO_MUSICA);
    const oferta4 = quatroOk(g) || await ofertaRec(String(body.t || ''));
    const txid = criarTxid(g.id);
    const token = await obterToken();
    const cob = await efiRequest('/v2/cob/' + encodeURIComponent(txid), {
      method: 'PUT', token,
      body: {
        calendario: { expiracao: 7200 },
        valor: { original: valor.toFixed(2) },
        chave: chavePix,
        solicitacaoPagador: (oferta4 ? '4 Músicas Personalizadas' : 'Música Personalizada') + ' - Capivarinha Love',
        infoAdicionais: [{ nome: 'Pedido', valor: String(g.id).slice(0, 50) }]
      }
    });
    if (!cob.ok) {
      console.error('recuperar-pix cob:', cob.status, cob.raw && cob.raw.slice(0, 500));
      return json({ erro: 'Efí recusou a cobrança: ' + erroEfi(cob.data, cob.status) }, 502);
    }
    const locId = cob.data && cob.data.loc && cob.data.loc.id;
    const qr = locId != null ? await efiRequest('/v2/loc/' + encodeURIComponent(locId) + '/qrcode', { token }) : null;
    if (!qr || !qr.ok || !qr.data || !qr.data.qrcode) return json({ erro: 'Não consegui gerar o Pix agora.' }, 502);

    const agora = Date.now();
    const atualizado = Object.assign({}, g, {
      criadoEm: agora,
      recuperadoEm: agora,
      // 4 músicas: estas 2 + mais 2 (liberadas depois do Pix)
      ...(oferta4 ? { quatro: true } : {}),
      pagamento: Object.assign({}, g.pagamento || {}, {
        provedor: 'efi', txid, status: 'ATIVA', valor,
        duracao: (g.pagamento && g.pagamento.duracao) || 'vitalicio',
        efiConferidoEm: 0
      })
    });
    await getStore('presentes').setJSON(g.id, atualizado);
    await indexar(atualizado.musicaWhatsapp, 'p', g.id);
    await indexarDia('p', g.id);
    await getStore('efi-txid').setJSON(txid, { giftId: g.id, produto: g.produto, valor, duracao: atualizado.pagamento.duracao, criadoEm: agora });

    return json({ payload: qr.data.qrcode, id: g.id, teste: modoTeste(), valor });
  } catch (e) {
    console.error('recuperar-pix (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
