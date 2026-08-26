import { obterToken, efiRequest, erroEfi } from './_efi.mjs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const setup = (process.env.EFI_SETUP_SECRET || '').trim();
  if (!setup || req.headers.get('x-setup-secret') !== setup) return json({ erro: 'Não autorizado.' }, 401);

  const chave = (process.env.EFI_PIX_KEY || '').trim();
  const hmac = (process.env.EFI_WEBHOOK_SECRET || '').trim();
  const base = (process.env.EFI_WEBHOOK_URL || '').trim();
  if (!chave || !base) return json({ erro: 'Configure EFI_PIX_KEY e EFI_WEBHOOK_URL.' }, 500);

  const sep = base.includes('?') ? '&' : '?';
  const webhookUrl = base + sep + (hmac ? 'hmac=' + encodeURIComponent(hmac) + '&' : '') + 'ignorar=';
  try {
    const token = await obterToken();
    const res = await efiRequest('/v2/webhook/' + encodeURIComponent(chave), {
      method: 'PUT', token,
      headers: { 'x-skip-mtls-checking': 'true' },
      body: { webhookUrl }
    });
    if (!res.ok) return json({ erro: 'Efí recusou o webhook: ' + erroEfi(res.data, res.status), detalhe: res.data }, 502);
    return json({ ok: true, webhookUrl, detalhe: res.data });
  } catch (e) {
    return json({ erro: e.message || 'Falha ao configurar webhook.' }, 502);
  }
};
