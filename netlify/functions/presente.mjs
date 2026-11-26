// netlify/functions/presente.mjs
// Devolve o presente salvo no Blobs — é isso que faz o link abrir no celular
// de quem recebe, não só no aparelho de quem criou.
// Se o pedido ainda consta como não pago, pergunta direto pra Efí se o Pix
// já caiu (plano B caso o aviso automático/webhook da Efí não chegue).
import { getStore } from '@netlify/blobs';
import { indexarDia } from './_indice.mjs';
import { conferirPagamentoEfi, aplicarPagamento } from './_efi.mjs';
import { entregarPedidoPagoZap } from './_zap.mjs';
import { liberarManual } from './_comprovante.mjs';
import { ESPERA_JA_PAGUEI } from './_pixmanual.mjs';
import { venceEm, ehParaSempre } from './_vence.mjs';

const ultimaConsulta = new Map(); // evita consultar a Efí a cada segundo pro mesmo pedido
const SETE_DIAS = 7 * 24 * 3600 * 1000;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ erro: 'id ausente' }, 400);

  const store = getStore('presentes');
  let presente = await store.get(id, { type: 'json' });

  if (!presente) return json({ encontrado: false }, 404);

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
          // 26/11: Efí confirmou → WhatsApp NA HORA
          try { const t = entregarPedidoPagoZap(presente).catch(() => {}); if (context && context.waitUntil) context.waitUntil(t); else await t; } catch (e) {}
        }
      } catch (e) {
        console.error('presente: falha ao conferir Pix na Efí', id, e && e.message);
      }
    }
  }

  if (!presente.pago) return json({ encontrado: true, pago: false });

  // ⏳ prazo de 15 dias da música (24/11) — o site mostra o aviso e o "para sempre por R$ 5"
  if (!/-x-/.test(id)) { try { presente.venceEm = venceEm(presente); if (await ehParaSempre(presente)) presente.paraSempre = true; } catch (e) {} }
  return json({ encontrado: true, pago: true, presente: presente });
};
