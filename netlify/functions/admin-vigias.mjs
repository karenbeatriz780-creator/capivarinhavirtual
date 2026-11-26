// 🛡️ Painel → aba Vigiar: liga/desliga o robô vigiando UMA campanha, com o limite que você escolher.
// GET  → lista dos vigias
// POST {id, nome, ligado, semCompra, cpaMax, gastoMax} → salva (valores em R$; 0/vazio = não usa aquele limite)
import { getStore } from '@netlify/blobs';
import { logRobo } from './_meta.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const L = () => getStore('gastos');
const num = (x) => { const n = Number(String(x == null ? '' : x).replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  // 26/11: sem senha (pedido do Gusthavo) — vigia só protege, não mexe em orçamento
  const vigias = (await L().get('vigias', { type: 'json' }).catch(() => null)) || {};
  if (req.method === 'GET') return json({ vigias });
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^\d{5,30}$/.test(id)) return json({ erro: 'Campanha inválida.' }, 400);
  const v = { nome: String(b.nome || '').slice(0, 120), ligado: !!b.ligado, semCompra: num(b.semCompra), cpaMax: num(b.cpaMax), gastoMax: num(b.gastoMax), em: Date.now() };
  if (v.ligado && !v.semCompra && !v.cpaMax && !v.gastoMax) return json({ erro: 'Coloque pelo menos um limite.' }, 400);
  const antes = vigias[id];
  vigias[id] = v;
  await L().setJSON('vigias', vigias);
  if (!antes || antes.ligado !== v.ligado) await logRobo({ tipo: 'vigia', camp: v.nome, id, motivo: v.ligado ? 'você ligou o 🛡️ vigia (limites: ' + [v.semCompra && 'R$ ' + v.semCompra + ' sem compra', v.cpaMax && 'custo/compra até R$ ' + v.cpaMax, v.gastoMax && 'gasto do dia até R$ ' + v.gastoMax].filter(Boolean).join(', ') + ')' : 'você desligou o 🛡️ vigia' }).catch(() => {});
  return json({ ok: true, vigias });
};
