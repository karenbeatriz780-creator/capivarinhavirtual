// LIVRO MÁGICO — gera o Pix (20 minutos) pra desbloquear o livro completo.
// POST { id, t }  →  { payload, id, valor, expiraEm }
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, modoTeste } from './_efi.mjs';
import { indexar, indexarDia } from './_indice.mjs';
import { json, acharTema, lerTemas, PACOTES_LIVRO } from './_livros.mjs';

const EXPIRA_SEG = 20 * 60;

function criarTxid(id) {
  return crypto.createHash('sha256').update(String(id) + ':' + Date.now() + ':' + crypto.randomUUID()).digest('hex').slice(0, 32);
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    let b = {}; try { b = await req.json(); } catch (e) {}
    const id = String(b.id || '');
    const presentes = getStore('presentes');
    const g = await presentes.get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.livro || String(b.t || '') !== g.livro.token) return json({ erro: 'Livro não encontrado.' }, 404);
    if (g.pago) return json({ pago: true, id });
    if (!(g.livro.capa && g.livro.capa.ok)) return json({ erro: 'A capa ainda está ficando pronta. Espere só um pouquinho.' }, 409);

    const chavePix = (process.env.EFI_PIX_KEY || '').trim();
    if (!chavePix) return json({ erro: 'Servidor sem EFI_PIX_KEY configurada.' }, 500);

    // pacote escolhido: 'um' (R$ 37), 'dois' (R$ 49, + uma aventura à escolha) ou 'todos' (coleção completa)
    const tipo = PACOTES_LIVRO[b.pacote] ? b.pacote : 'um';
    let tema2 = null;
    if (tipo === 'dois') {
      const t2 = await acharTema(String(b.tema2 || ''));
      if (!t2 || t2.status !== 'publicado' || t2.id === g.livro.tema) return json({ erro: 'Escolha a segunda aventura.' }, 400);
      tema2 = t2.id;
    }
    // Pix ainda válido e do mesmo pacote? devolve o mesmo (não cria cobrança nova a cada clique)
    const pg = g.pagamento || {};
    const mesmo = (pg.pacote || 'um') === tipo && (pg.tema2 || null) === tema2;
    if (mesmo && pg.txid && pg.payload && pg.expiraEm && pg.expiraEm - Date.now() > 60 * 1000) {
      return json({ payload: pg.payload, id, valor: pg.valor, expiraEm: pg.expiraEm, teste: modoTeste() });
    }

    const tema = await acharTema(g.livro.tema);
    const valor = PACOTES_LIVRO[tipo].valor;
    const nTodos = tipo === 'todos' ? (await lerTemas()).filter((t) => t.status === 'publicado').length : 0;
    const txid = criarTxid(id);
    const token = await obterToken();
    const cob = await efiRequest('/v2/cob/' + encodeURIComponent(txid), {
      method: 'PUT', token,
      body: {
        calendario: { expiracao: EXPIRA_SEG },
        valor: { original: valor.toFixed(2) },
        chave: chavePix,
        solicitacaoPagador: ('Livro Mágico: ' + (tipo === 'todos' ? 'coleção completa (' + nTodos + ' livros)' : tipo === 'dois' ? '2 livros' : (tema ? tema.nome : 'história')) + ' - Capivarinha Love').slice(0, 140),
        infoAdicionais: [{ nome: 'Pedido', valor: id }, { nome: 'Produto', valor: 'livro' }]
      }
    });
    if (!cob.ok) {
      console.error('livro-pagamento cob:', cob.status, cob.raw && cob.raw.slice(0, 500));
      return json({ erro: 'Efí recusou a cobrança: ' + erroEfi(cob.data, cob.status) }, 502);
    }
    const locId = cob.data && cob.data.loc && cob.data.loc.id;
    const qr = locId != null ? await efiRequest('/v2/loc/' + encodeURIComponent(locId) + '/qrcode', { token }) : null;
    if (!qr || !qr.ok || !qr.data || !qr.data.qrcode) return json({ erro: 'Não consegui gerar o Pix agora.' }, 502);

    const agora = Date.now();
    const expiraEm = agora + EXPIRA_SEG * 1000;
    g.criadoEm = g.criadoEm || agora;
    g.pagamento = { provedor: 'efi', txid, status: 'ATIVA', valor, duracao: 'vitalicio', efiConferidoEm: 0, payload: qr.data.qrcode, expiraEm, pacote: tipo, tema2 };
    g.pacote = { tipo, tema2 };
    await presentes.setJSON(id, g);
    await getStore('efi-txid').setJSON(txid, { giftId: id, produto: 'livro', valor, duracao: 'vitalicio', criadoEm: agora });
    try { await indexarDia('p', id); if (g.whatsapp) await indexar(g.whatsapp, 'p', id); } catch (e) {}

    return json({ payload: qr.data.qrcode, id, valor, expiraEm, teste: modoTeste() });
  } catch (e) {
    console.error('livro-pagamento:', e && e.stack || e);
    return json({ erro: 'Erro inesperado ao gerar o Pix.' }, 500);
  }
};
