// Painel → aba CAMPANHAS → ⏰ Melhores horários
//   GET  ?dias=14[&novo=1]                         → custo por venda de cada hora + janelas boas + comparação com a sua sugestão
//   POST {acao:'programar', id, janelas, orcDia, dias} (senha de administrador) → cópia PROGRAMADA da campanha
import { calcHorarios, duplicarProgramada, horasDe } from './_horarios.mjs';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return json({ erro: 'Meta Ads não está ligado.' }, 400);
  if (req.method === 'GET') {
    const u = new URL(req.url), dias = Math.max(3, Math.min(30, parseInt(u.searchParams.get('dias'), 10) || 14));
    try { return json(await calcHorarios(dias, u.searchParams.get('novo') === '1')); }
    catch (e) { return json({ erro: 'Não consegui ler os horários no Meta: ' + (e.message || e) }, 502); }
  }
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (b.acao !== 'programar' || !/^\d{5,30}$/.test(id)) return json({ erro: 'Pedido inválido.' }, 400);
  const janelas = (Array.isArray(b.janelas) ? b.janelas : []).map((j) => [parseInt(j[0], 10), parseInt(j[1], 10)])
    .filter(([a, c]) => a >= 0 && a < 24 && c > a && c <= a + 24);
  const orcDia = Math.round(Number(b.orcDia) * 100) / 100, dias = parseInt(b.dias, 10) || 7;
  if (!janelas.length || horasDe(janelas).length < 3) return json({ erro: 'Escolha pelo menos 3 horas por dia.' }, 400);
  if (!(orcDia >= 6 && orcDia <= 500)) return json({ erro: 'Orçamento por dia entre R$ 6 e R$ 500.' }, 400);
  if (!(dias >= 3 && dias <= 30)) return json({ erro: 'Duração entre 3 e 30 dias.' }, 400);
  try { return json(await duplicarProgramada(id, janelas, orcDia, dias)); }
  catch (e) { return json({ erro: 'O Meta não deixou criar a programada: ' + (e.message || e) }, 502); }
};
