// netlify/functions/presente.mjs
// Devolve o presente salvo no Blobs — é isso que faz o link abrir no celular
// de quem recebe, não só no aparelho de quem criou.
// Se o pedido ainda consta como não pago, pergunta direto pra Efí se o Pix
// já caiu (plano B caso o aviso automático/webhook da Efí não chegue).
import { getStore } from '@netlify/blobs';
import { indexarDia } from './_indice.mjs';
import { conferirPagamentoEfi, aplicarPagamento } from './_efi.mjs';
import { liberarManual } from './_comprovante.mjs';
import { ESPERA_JA_PAGUEI } from './_pixmanual.mjs';

const ultimaConsulta = new Map(); // evita consultar a Efí a cada segundo pro mesmo pedido
const SETE_DIAS = 7 * 24 * 3600 * 1000;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ erro: 'id ausente' }, 400);

  const store = getStore('presentes');
  let presente = await store.get(id, { type: 'json' });

  if (!presente) return json({ encontrado: false }, 404);

  // "Já paguei" (Pix manual): passou o tempo de espera desde o clique → libera o pedido
  if (!presente.pago && !presente.cancelado && presente.pagamento && presente.pagamento.provedor === 'manual' &&
      presente.pagamento.jaPagueiEm && Date.now() - presente.pagamento.jaPagueiEm >= ESPERA_JA_PAGUEI) {
    try { const lib = await liberarManual(id, 'ja-paguei'); if (lib) presente = lib; }
    catch (e) { console.error('presente: falha ao liberar já-paguei', id, e && e.message); }
  }

  if (!presente.pago) {
    const recente = !presente.criadoEm || (Date.now() - presente.criadoEm) < SETE_DIAS;
    const ult = ultimaConsulta.get(id) || 0;
    if (recente && !presente.cancelado && Date.now() - ult > 4000) {
      ultimaConsulta.set(id, Date.now());
      try {
        const info = await conferirPagamentoEfi(presente);
        if (info) {
          aplicarPagamento(presente, info, 'consulta-presente');
          await store.setJSON(id, presente);
      try { await indexarDia('pg', presente.id, presente.pagoEm); } catch (e) {}
        }
      } catch (e) {
        console.error('presente: falha ao conferir Pix na Efí', id, e && e.message);
      }
    }
  }

  if (!presente.pago) return json({ encontrado: true, pago: false });

  return json({ encontrado: true, pago: true, presente: presente });
};
