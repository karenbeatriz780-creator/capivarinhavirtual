import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, modoTeste } from './_efi.mjs';

const PACOTES = {
  completo:  { nome: 'Pacote Completo', preco: 25.99 },
  livro:     { nome: 'Livro Interativo', preco: 16 },
  relampago: { nome: 'Pacote 48 horas', preco: 16 },
  album:     { nome: 'Álbum de Fotos',  preco: 9 },
  jogo:      { nome: 'Jogo do Casal',   preco: 9 },
  carta:     { nome: 'Carta Virtual',   preco: 6 },
  extra:         { nome: 'Lembrancinhas',  preco: 4 },
  extra_tema:    { nome: 'QR temático',    preco: 2.99 },
  extra_carta:   { nome: 'Cartinha',       preco: 3.99 },
  extra_moldura: { nome: 'Moldura',        preco: 3.99 }
};

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
    if (!presente.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(presente.email)) {
      return json({ erro: 'E-mail inválido.' }, 400);
    }

    const chavePix = (process.env.EFI_PIX_KEY || '').trim();
    if (!chavePix) return json({ erro: 'Servidor sem EFI_PIX_KEY configurada.' }, 500);

    const pacote = PACOTES[presente.produto];
    const txid = criarTxid(presente.id);
    const criadoEm = Date.now();
    const salvo = Object.assign({}, presente, {
      pago: false,
      criadoEm,
      pagamento: { provedor: 'efi', txid, status: 'ATIVA', valor: pacote.preco }
    });

    try {
      await getStore('presentes').setJSON(presente.id, salvo);
      await getStore('efi-txid').setJSON(txid, { giftId: presente.id, produto: presente.produto, valor: pacote.preco, criadoEm });

      const token = await obterToken();
      const cob = await efiRequest('/v2/cob/' + encodeURIComponent(txid), {
        method: 'PUT', token,
        body: {
          calendario: { expiracao: 7200 },
          valor: { original: Number(pacote.preco).toFixed(2) },
          chave: chavePix,
          solicitacaoPagador: (pacote.nome + ' - Capivarinha Love').slice(0, 140),
          infoAdicionais: [
            { nome: 'Pedido', valor: String(presente.id).slice(0, 50) },
            { nome: 'Produto', valor: String(presente.produto).slice(0, 50) }
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
