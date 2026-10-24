import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, modoTeste } from './_efi.mjs';
import { statusOferta, registrarTentativa } from './_oferta.mjs';
import { statusIndicacao, registrarIndicado, registrarUso } from './_indicacao.mjs';
import { indexar, indexarDia } from './_indice.mjs';

const PACOTES = {
  completo:  { nome: 'Retrospectiva Completa', preco: 19, preco48: 9.99 },
  carta:     { nome: 'Carta Virtual',   preco: 7.99, preco48: 4.99 },
  convite:   { nome: 'Convite Criativo', preco: 14, preco48: 10 },
  musica:    { nome: 'Música Personalizada', preco: 9.99, preco48: 9.99 },
  extra:         { nome: 'Lembrancinhas',  preco: 4 },
  extra_tema:    { nome: 'QR temático',    preco: 2.99 },
  extra_carta:   { nome: 'Cartinha',       preco: 3.99 },
  extra_moldura: { nome: 'Moldura',        preco: 3.99 }
};
const PRECO_PACOTE6 = 19.99; // 6 músicas (3 letras × 2 versões) — tem que bater com o site
// Produtos que aceitam a música personalizada como adicional pago.
const PRODUTOS_COM_ADDON_MUSICA = ['completo', 'carta'];
const PRECO_ADDON_MUSICA = 10;
// Combo iniciado pela Música: ela mantém os R$9,99 e o presente entra
// com desconto, sempre vitalício. Tem que bater com precoTotal() no index.html.
const COMBO_DA_MUSICA = { carta: 7.99, completo: 24.99 };

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

    // Oferta de cliente (4 músicas por R$ 9,99): só vale com pedido de origem pago,
    // dentro de 48h e se ainda não foi usada. Sem oferta válida, a 2ª música é descartada.
    // PACOTE 6 MÚSICAS (3 letras × 2 versões) por R$ 19,99 — escolhido no próprio site
    const pacote6 = !!presente.pacote6 && presente.produto === 'musica' && !presente.ofertaDe && !presente.bonusDe &&
      presente.ofertaM1 && presente.ofertaM1.url && presente.ofertaM2 && presente.ofertaM2.url;
    if (!pacote6) { delete presente.pacote6; delete presente.ofertaM2; }
    if (!pacote6 && (presente.ofertaDe || presente.ofertaM1)) {
      if (presente.produto !== 'musica' || !presente.ofertaDe || !presente.ofertaM1) {
        delete presente.ofertaDe; delete presente.ofertaM1;
      } else {
        // p.<pedido> / t.<música> = promoção pessoal de quem já comprou ou desistiu
        const st = await statusOferta(String(presente.ofertaDe));
        if (!st.valida) {
          return json({ erro: st.motivo === 'usada' ? 'Essa oferta já foi usada.' : 'Essa oferta não está disponível.' }, 400);
        }
        if (!st.promo) await registrarTentativa(String(presente.ofertaDe), presente.id);
      }
    }

    // 4 MÚSICAS POR R$ 9,99 — as outras 2 (outra letra, outro estilo) já foram pagas
    // no pedido de origem. Só vale 1 vez, com o pedido de origem pago e marcado "quatro".
    if (presente.dobroDe) {
      const refD = String(presente.dobroDe);
      const lojaP = getStore('presentes');
      const origem = await lojaP.get(refD, { type: 'json' }).catch(() => null);
      if (presente.produto !== 'musica' || !origem || !origem.pago || origem.cancelado || !origem.quatro) {
        return json({ erro: 'Essas músicas não estão liberadas pra esse pedido.' }, 400);
      }
      if (origem.dobroUsado && origem.dobroUsado !== presente.id) {
        return json({ erro: 'Você já criou as suas outras 2 músicas.', jaUsado: origem.dobroUsado }, 400);
      }
      delete presente.ofertaDe; delete presente.ofertaM1; delete presente.ofertaM2; delete presente.pacote6; delete presente.refDe; delete presente.bonusDe;
      const agoraD = Date.now();
      const salvoD = Object.assign({}, presente, {
        pago: true, quatro: false, criadoEm: agoraD, pagoEm: agoraD, duracao: 'vitalicio', expiraEm: null,
        musicaWhatsapp: presente.musicaWhatsapp || origem.musicaWhatsapp || origem.whatsapp || '',
        meuNome: presente.meuNome || origem.meuNome || '', parceiroNome: presente.parceiroNome || origem.parceiroNome || '',
        musicaParaNome: presente.musicaParaNome || origem.musicaParaNome || '',
        pagamento: { provedor: 'incluso', status: 'CONCLUIDA', valor: 0, duracao: 'vitalicio', pagoEm: agoraD }
      });
      await lojaP.setJSON(presente.id, salvoD);
      origem.dobroUsado = presente.id; origem.dobroEm = agoraD;
      await lojaP.setJSON(refD, origem);
      await indexar(salvoD.musicaWhatsapp, 'p', presente.id);
      await indexarDia('p', presente.id);
      return json({ gratis: true, id: presente.id, presente: salvoD });
    }

    // INDIQUE E GANHE — pedido grátis (resgate de indicação): libera na hora, sem Pix.
    if (presente.bonusDe) {
      const refB = String(presente.bonusDe);
      const st = await statusIndicacao(refB);
      if (presente.produto !== 'musica' || st.disponiveis < 1) {
        return json({ erro: 'Você ainda não tem música grátis disponível.' }, 400);
      }
      delete presente.ofertaDe; delete presente.ofertaM1; delete presente.ofertaM2; delete presente.pacote6; delete presente.refDe;
      const agoraB = Date.now();
      const salvoB = Object.assign({}, presente, {
        pago: true, criadoEm: agoraB, pagoEm: agoraB, duracao: 'vitalicio', expiraEm: null,
        pagamento: { provedor: 'bonus', status: 'CONCLUIDA', valor: 0, duracao: 'vitalicio', pagoEm: agoraB }
      });
      await getStore('presentes').setJSON(presente.id, salvoB);
      await indexar(presente.musicaWhatsapp || presente.whatsapp, 'p', presente.id);
      await indexarDia('p', presente.id);
      await registrarUso(refB, presente.id);
      return json({ gratis: true, id: presente.id, presente: salvoB });
    }
    // Veio pelo link de indicação de outro cliente → conta pra ele quando pagar
    if (presente.refDe && String(presente.refDe) !== String(presente.id)) {
      try { await registrarIndicado(String(presente.refDe), presente.id); } catch (e) {}
    }

    // música + carta/retrospectiva: a música que a pessoa fez vai junto, sempre
    if (presente.comboDaMusica && presente.musicaPreviewUrl) { presente.musicaOn = true; presente.musicaPersonalizar = true; }
    const pacote = PACOTES[presente.produto];
    const duracao = presente.duracao === 'h48' ? 'h48' : 'vitalicio';
    const temAddonMusica = !!presente.musicaOn && PRODUTOS_COM_ADDON_MUSICA.indexOf(presente.produto) !== -1;
    const comboDaMusica = !!presente.comboDaMusica && COMBO_DA_MUSICA[presente.produto] != null;
    const precoBase = (duracao === 'h48' && pacote.preco48 != null) ? pacote.preco48 : pacote.preco;
    const precoFinal = pacote6 ? PRECO_PACOTE6 : comboDaMusica
      ? (PACOTES.musica.preco + COMBO_DA_MUSICA[presente.produto])
      : (precoBase + (temAddonMusica ? PRECO_ADDON_MUSICA : 0));
    const txid = criarTxid(presente.id);
    const criadoEm = Date.now();
    // pedido de música normal = 4 músicas: as 2 da prévia + 2 liberadas depois do Pix
    const quatro = presente.produto === 'musica' && !pacote6 && !presente.ofertaM1 && !presente.ofertaDe;
    const salvo = Object.assign({}, presente, {
      pago: false, quatro,
      criadoEm,
      pagamento: { provedor: 'efi', txid, status: 'ATIVA', valor: precoFinal, duracao, addonMusica: temAddonMusica }
    });

    try {
      await getStore('presentes').setJSON(presente.id, salvo);
      await indexar(presente.musicaWhatsapp || presente.whatsapp, 'p', presente.id);
      await indexarDia('p', presente.id);
      await getStore('efi-txid').setJSON(txid, { giftId: presente.id, produto: presente.produto, valor: precoFinal, duracao, criadoEm });
      // liga a música ao pedido (o link de prévia e o Meus presentes sabem que ela já tem pedido)
      try {
        const ms = getStore('musicas');
        for (const tid of [presente.musicaPreviewId, presente.ofertaM1 && presente.ofertaM1.id, presente.ofertaM2 && presente.ofertaM2.id]) {
          if (!tid) continue;
          const m = await ms.get(tid, { type: 'json' });
          if (m && m.presenteId !== presente.id) { m.presenteId = presente.id; await ms.setJSON(tid, m); }
        }
      } catch (e) {}

      const token = await obterToken();
      const nomeCobranca = (pacote6 ? '6 Músicas Personalizadas' : (presente.ofertaM1 || quatro) ? '4 Músicas Personalizadas' : pacote.nome) + (temAddonMusica ? ' + Música' : '');
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
