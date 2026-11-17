// 📄 Lê o relatório para a Efí gerado por relatorio-efi-background (senha de administrador).
import { getStore } from '@netlify/blobs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const r = await getStore('gastos').get('relatorio_efi', { type: 'json' }).catch(() => null);
  return json(r || { status: 'nada' });
};
