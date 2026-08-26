// Apenas para homologação: libera um pedido manualmente para testar todo o fluxo visual.
// Em produção esta função sempre recusa a chamada.
import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  if ((process.env.EFI_ENV || 'homologation').toLowerCase() === 'production') {
    return json({ erro: 'Simulação desativada em produção.' }, 403);
  }
  let body;
  try { body = await req.json(); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  const id = body && body.id;
  if (!id) return json({ erro: 'Faltou o id do pedido.' }, 400);

  const store = getStore('presentes');
  const presente = await store.get(id, { type: 'json' });
  if (!presente) return json({ erro: 'Pedido não encontrado.' }, 404);

  const agora = Date.now();
  presente.pago = true;
  presente.pagoEm = agora;
  presente.criadoEm = presente.criadoEm || agora;
  presente.expiraEm = presente.produto === 'relampago' ? presente.criadoEm + 48 * 3600 * 1000 : null;
  presente.pagamento = Object.assign({}, presente.pagamento || {}, { provedor: 'efi', status: 'SIMULADO', pagoEm: agora });
  await store.setJSON(id, presente);
  return json({ ok: true, id });
};
