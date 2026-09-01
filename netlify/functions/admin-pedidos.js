import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function autorizado(req) {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha) return false; // sem senha configurada no servidor, ninguém entra
  const enviada = req.headers.get('x-admin-key') || '';
  return enviada === senha;
}

export default async (req) => {
  try {
    if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    const store = getStore('presentes');
    const { blobs } = await store.list();

    const pedidos = [];
    for (const b of blobs) {
      const g = await store.get(b.key, { type: 'json' });
      if (!g) continue;
      pedidos.push({
        id: g.id,
        produto: g.produto,
        duracao: g.pagamento && g.pagamento.duracao || g.duracao || 'vitalicio',
        valor: g.pagamento ? g.pagamento.valor : 0,
        provedor: g.pagamento ? g.pagamento.provedor : null,
        pago: !!g.pago,
        criadoEm: g.criadoEm || null,
        meuNome: g.meuNome || '',
        parceiroNome: g.parceiroNome || ''
      });
    }

    pedidos.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    return json({ ok: true, pedidos });
  } catch (e) {
    console.error('admin-pedidos (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
