import { obterToken, efiRequest, erroEfi, modoTeste, certificadoDisponivel } from './_efi.mjs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const setup = (process.env.EFI_SETUP_SECRET || '').trim();
  const recebido = req.headers.get('x-setup-secret') || '';
  if (!setup || recebido !== setup) return json({ erro: 'Não autorizado.' }, 401);

  const chave = (process.env.EFI_PIX_KEY || '').trim();
  const vars = {
    EFI_CLIENT_ID: !!(process.env.EFI_CLIENT_ID || '').trim(),
    EFI_CLIENT_SECRET: !!(process.env.EFI_CLIENT_SECRET || '').trim(),
    EFI_PIX_KEY: !!chave,
    EFI_CERT_P12_BASE64: certificadoDisponivel(),
    EFI_ENV: (process.env.EFI_ENV || 'homologation').toLowerCase(),
    EFI_WEBHOOK_URL: !!(process.env.EFI_WEBHOOK_URL || '').trim(),
    EFI_WEBHOOK_SECRET: !!(process.env.EFI_WEBHOOK_SECRET || '').trim()
  };

  if (!vars.EFI_CLIENT_ID || !vars.EFI_CLIENT_SECRET || !vars.EFI_PIX_KEY || !vars.EFI_CERT_P12_BASE64) {
    return json({ ok: false, etapa: 'variaveis', vars, erro: 'Faltam variáveis obrigatórias da Efí.' }, 500);
  }

  try {
    const token = await obterToken();
    let webhook = { consultado: false };
    if (chave) {
      const r = await efiRequest('/v2/webhook/' + encodeURIComponent(chave), { token });
      webhook = r.ok
        ? { consultado: true, configurado: true, detalhe: r.data }
        : { consultado: true, configurado: false, status: r.status, detalhe: erroEfi(r.data,
