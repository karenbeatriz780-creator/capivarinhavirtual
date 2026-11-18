// LIVRO MÁGICO — gera o Pix pra desbloquear o livro completo.
// 16/11: Pix MANUAL na chave do Nubank (igual à música) + opção de cartão/Apple Pay/Google Pay (Stripe) na mesma tela. Não usa mais a Efí.
// POST { id, t }  →  { payload, id, valor, expiraEm }
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { modoTeste } from './_efi.mjs';
import { lerCfgPix, brcode, refPedido, marcarPendente } from './_pixmanual.mjs';
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

    // pacote escolhido: 'um' (R$ 37), 'dois' (R$ 49, + uma aventura à escolha) ou 'todos' (coleção completa)
    const tipo = PACOTES_LIVRO[b.pacote] ? b.pacote : 'um';
    let tema2 = null;
    if (tipo === 'dois') {
      const t2 = await acharTema(String(b.tema2 || ''));
      if (!t2 || t2.propria || t2.status !== 'publicado' || t2.id === g.livro.tema) return json({ erro: 'Escolha a segunda aventura.' }, 400);
      tema2 = t2.id;
    }
    // mesmo pacote e o Pix já foi gerado? devolve o mesmo
    const pg = g.pagamento || {};
    const mesmo = (pg.pacote || 'um') === tipo && (pg.tema2 || null) === tema2;
    if (mesmo && pg.provedor === 'manual' && pg.payload) return json({ payload: pg.payload, id, valor: pg.valor, manual: true, provedor: 'manual', teste: false });

    const valor = PACOTES_LIVRO[tipo].valor;
    const ref = refPedido(id), payload = (await lerCfgPix().catch(() => null), brcode(valor, ref)), agora = Date.now();
    g.criadoEm = g.criadoEm || agora;
    g.pagamento = { provedor: 'manual', txid: ref, status: 'AGUARDANDO', valor, duracao: 'vitalicio', manualEm: agora, payload, pacote: tipo, tema2 };
    g.pacote = { tipo, tema2 };
    await presentes.setJSON(id, g);
    await marcarPendente(id);
    try { await indexarDia('p', id); if (g.whatsapp) await indexar(g.whatsapp, 'p', id); } catch (e) {}
    return json({ payload, id, valor, manual: true, provedor: 'manual', teste: false });
  } catch (e) {
    console.error('livro-pagamento:', e && e.stack || e);
    return json({ erro: 'Erro inesperado ao gerar o Pix.' }, 500);
  }
};
