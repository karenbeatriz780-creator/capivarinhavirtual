// 🌙 Painel → aba "Meia-noite": quais campanhas o robô LIGA à meia-noite.
// GET  → todas as campanhas (só nome e situação) + as que você desmarcou
// POST {fora:[ids]} → salva as desmarcadas (campanha nova entra marcada)
import { getStore } from '@netlify/blobs';
import { graphConta } from './_meta.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  const L = getStore('gastos');
  try {
    if (req.method === 'GET') {
      const cfg = (await L.get('meianoite_cfg', { type: 'json' }).catch(() => null)) || {};
      const d = await graphConta('GET', 'campaigns', { fields: 'name,effective_status,created_time', limit: 400 });
      const campanhas = (d.data || []).filter((x) => !/ARCHIVED|DELETED/.test(String(x.effective_status || '')))
        .map((x) => ({ id: String(x.id), nome: x.name, status: x.effective_status, criada: x.created_time }))
        .sort((a, b) => String(b.criada || '').localeCompare(String(a.criada || '')));
      return json({ campanhas, fora: cfg.fora || [] });
    }
    let b = {}; try { b = await req.json(); } catch (e) {}
    const fora = (Array.isArray(b.fora) ? b.fora : []).map(String).filter((x) => /^\d{5,30}$/.test(x)).slice(0, 500);
    await L.setJSON('meianoite_cfg', { fora, em: Date.now() });
    return json({ ok: true, fora });
  } catch (e) { return json({ erro: e.message }, 500); }
};
