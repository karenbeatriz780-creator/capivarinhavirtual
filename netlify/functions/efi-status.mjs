// 26/11: mostra por que a Efí não está gerando o Pix (sem mostrar nenhuma chave/senha).
// Abrir: https://capivarinhalove.com.br/.netlify/functions/efi-status
import { getStore } from '@netlify/blobs';
import { obterToken, certificadoDisponivel } from './_efi.mjs';
export default async () => {
  const c = (await getStore('gastos').get('cfg_pixmanual', { type: 'json' }).catch(() => null)) || {};
  const out = {
    ambiente: (process.env.EFI_ENV || 'homologation (TESTE — não recebe Pix de verdade)').toLowerCase(),
    tem_client_id: !!(process.env.EFI_CLIENT_ID || '').trim(),
    tem_client_secret: !!(process.env.EFI_CLIENT_SECRET || '').trim(),
    tem_chave_pix: !!(process.env.EFI_PIX_KEY || '').trim(),
    tem_certificado: certificadoDisponivel(),
    ultimo_erro: c.efiErro || null,
    ultimo_erro_em: c.efiFalhouEm ? new Date(c.efiFalhouEm).toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : null
  };
  try { await obterToken(); out.login_na_efi = 'OK'; } catch (e) { out.login_na_efi = 'FALHOU: ' + String((e && e.message) || e).slice(0, 200); }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};
