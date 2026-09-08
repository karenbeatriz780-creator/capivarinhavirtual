import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, modoTeste } from './_efi.mjs';

const PACOTES = {
  completo:  { nome: 'Retrospectiva Completa', preco: 21, preco48: 9.99 },
  carta:     { nome: 'Carta Virtual',   preco: 6, preco48: 3.99 },
  convite:   { nome: 'Convite Criativo', preco: 14, preco48: 10 },
  musica:    { nome: 'Música Personalizada', preco: 9.99, preco48: 9.99 },
  extra:         { nome: 'Lembrancinhas',  preco: 4 },
  extra_tema:    { nome: 'QR temático',    preco: 2.99 },
  extra_carta:   { nome: 'Cartinha',       preco: 3.99 },
  extra_moldura: { nome: 'Moldura',        preco: 3.99 }
};
// Produtos que aceitam a música personalizada como adicional pago.
const PRODUTOS_COM_ADDON_MUSICA = ['completo', 'carta'];
const PRECO_ADDON_MUSICA = 7;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function criarTxid(id) {
  // A Efí aceita txid alfanumérico; 32 caracteres deixam o identificador estável e válido.
  return crypto.createHash('sha256').update(String(id) + ':' + Date.now() + ':' + crypto.randomUUID()).digest('hex').slice(0, 32);
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const presente = body && body.presente;
    if (!presente || !presente.id || !presente.produto || !PACOTES[presente.produto]) {
      return json({ erro: 'Dados do presente incompletos.' }, 400);
    }

    const chavePix = (process.env.EFI_PIX_KEY || '').trim();
    if (!chavePix) return json({ erro: 'Servidor sem EFI_PIX_KEY configurada.' }, 500);

    const pacote = PACOTES[presente.produto];
    const duracao = presente.duracao === 'h48' ? 'h48' : 'vitalicio';
    const temAddonMusica = !!presente.musicaOn && PRODUTOS_COM_ADDON_MUSICA.indexOf(presente.produto) !== -1;
    const precoBase = (duracao === 'h48' && pacote.preco48 != null) ? pacote.preco48 : pacote.preco;
    const precoFinal = precoBase + (temAddonMusica ? PRECO_ADDON_MUSICA : 0);
    const txid = criarTxid(presente.id);
    const criadoEm = Date.now();
    const salvo = Object.assign({}, presente, {
      pago: false,
      criadoEm,
      pagamento: { provedor: 'efi', txid, status: 'ATIVA', valor: precoFinal, duracao, addonMusica: temAddonMusica }
    });

    try {
      await getStore('presentes').setJSON(presente.id, salvo);
      await getStore('efi-txid').setJSON(txid, { giftId: presente.id, produto: presente.produto, valor: precoFinal, duracao, criadoEm });

      const token = await obterToken();
      const nomeCobranca = pacote.nome + (temAddonMusica ? ' + Música' : '');
      const cob = await efiRequest('/v2/cob/' + encodeURIComponent(txid), {
        method: 'PUT', token,
        body: {
          calendario: { expiracao: 7200 },
          valor: { original: Number(precoFinal).toFixed(2) },
          chave: chavePix,
          solicitacaoPagador: (nomeCobranca + ' - Capivarinha Love').slice(0, 140),
          infoAdicionais: [
            { nome: 'Pedido', valor: String(presente.id).slice(0, 50) },
            { nome: 'Produto', valor: String(presente.produto).slice(0, 50) },
            { nome: 'Música personalizada', valor: temAddonMusica ? 'Sim' : 'Não' }
          ]
        }
      });
      if (!cob.ok) {
        console.error('Efí criar cobrança:', cob.status, cob.raw && cob.raw.slice(0, 700));
        return json({ erro: 'Efí recusou a cobrança: ' + erroEfi(cob.data, cob.status) }, 502);
      }

      const locId = cob.data && cob.data.loc && cob.data.loc.id;
      if (locId == null) return json({ erro: 'Efí criou a cobrança, mas não retornou o identificador do QR Code.' }, 502);

      const qr = await efiRequest('/v2/loc/' + encodeURIComponent(locId) + '/qrcode', { token });
      if (!qr.ok) {
        console.error('Efí gerar QR:', qr.status, qr.raw && qr.raw.slice(0, 700));
        return json({ erro: 'Efí não conseguiu gerar o QR Code: ' + erroEfi(qr.data, qr.status) }, 502);
      }
      if (!qr.data || !qr.data.qrcode) return json({ erro: 'Efí não retornou o Pix Copia e Cola.' }, 502);

      return json({
        payload: qr.data.qrcode,
        qrImage: qr.data.imagemQrcode || null,
        linkVisualizacao: qr.data.linkVisualizacao || null,
        id: presente.id,
        txid,
        teste: modoTeste(),
        provedor: 'efi'
      });
    } catch (e) {
      console.error('Falha Efí:', e && e.stack || e);
      return json({ erro: 'Não consegui conectar à Efí: ' + (e && e.message ? e.message : 'erro inesperado') }, 502);
    }
  } catch (e) {
    console.error('criar-pagamento (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
