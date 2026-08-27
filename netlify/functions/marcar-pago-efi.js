// Ferramenta administrativa: libera manualmente um pedido específico,
// para os casos em que o Pix realmente caiu mas o webhook da Efí não
// processou a confirmação (ex.: webhook ainda não configurado na época
// da compra). Protegida pelo mesmo EFI_SETUP_SECRET do diagnóstico —
// depois de configurar o webhook, isso deixa de ser necessário no dia a
// dia, mas fica disponível como um botão de emergência.
import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    const setup = (process.env.EFI_SETUP_SECRET || '').trim();
    const recebido = req.headers.get('x-setup-secret') || '';
    if (!setup || recebido !== setup) return json({ erro: 'Não autorizado.' }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ erro: 'JSON inválido.' }, 400); }
    const id = body && body.id;
    if (!id) return json({ erro: 'Faltou o id do pedido (o mesmo que aparece na URL #/p/ID no site).' }, 400);

    const store = getStore('presentes');
    const presente = await store.get(id, { type: 'json' });
    if (!presente) return json({ erro: 'Pedido não encontrado com esse id.' }, 404);

    if (presente.pago) {
      return json({ ok: true, id, jaEstavaPago: true, presente });
    }

    const agora = Date.now();
    presente.pago = true;
    presente.pagoEm = agora;
    presente.criadoEm = presente.criadoEm || agora;
    presente.pagamento = Object.assign({}, presente.pagamento || {}, {
      status: 'CONCLUIDA_MANUAL',
      pagoEm: agora,
      obs: 'Marcado manualmente via marcar-pago-efi (Pix confirmado fora do webhook).'
    });
    await store.setJSON(id, presente);
    return json({ ok: true, id, jaEstavaPago: false, presente });
  } catch (e) {
    console.error('marcar-pago-efi:', e && e.stack || e);
    return json({ ok: false, erro: (e && e.message) ? e.message : String(e) }, 500);
  }
};
