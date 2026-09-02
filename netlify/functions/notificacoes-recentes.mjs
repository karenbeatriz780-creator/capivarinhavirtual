import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

const NOME_PRODUTO = {
  completo: 'Retrospectiva Completa',
  carta: 'Carta Virtual',
  convite: 'Convite Criativo'
};

function primeiroNome(nome) {
  const s = String(nome || '').trim();
  if (!s) return null;
  return s.split(/\s+/)[0];
}

export default async (req) => {
  try {
    if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);

    const store = getStore('presentes');
    const { blobs } = await store.list();

    const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentes = [];
    for (const b of blobs) {
      const g = await store.get(b.key, { type: 'json' });
      if (!g || !g.pago || !g.criadoEm || g.criadoEm < seteDias) continue;
      const nome = primeiroNome(g.meuNome);
      if (!nome) continue; // sem nome real, não mostra nada inventado
      recentes.push({
        nome,
        produto: NOME_PRODUTO[g.produto] || g.produto,
        criadoEm: g.criadoEm
      });
    }
    recentes.sort((a, b) => b.criadoEm - a.criadoEm);

    return json({ ok: true, notificacoes: recentes.slice(0, 12) });
  } catch (e) {
    console.error('notificacoes-recentes (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
