// LIVRO MÁGICO — andamento do livro (a tela do cliente pergunta a cada poucos segundos)
// GET ?id=<pedido>&t=<token>
import { getStore } from '@netlify/blobs';
import { json, avancarLivro, resumoPublico, baseSite } from './_livros.mjs';

export default async (req) => {
  try {
    const u = new URL(req.url);
    const id = (u.searchParams.get('id') || '').trim();
    const t = (u.searchParams.get('t') || '').trim();
    if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Livro não encontrado.' }, 404);
    let g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
    // depois de pago, o link do livro pode ser compartilhado (sem token);
    // antes de pagar, só quem criou (com o token) acompanha a prévia
    if (!g.pago && t !== g.livro.token) return json({ erro: 'Livro não encontrado.' }, 404);
    if (!(g.livro.status === 'pronto' && g.pago)) {
      try { g = (await avancarLivro(id, baseSite(req))) || g; } catch (e) { console.error('livro-status avancar', e && e.message); }
    }
    return json(resumoPublico(g));
  } catch (e) {
    console.error('livro-status:', e && e.stack || e);
    return json({ erro: 'Não consegui ver o livro agora.' }, 500);
  }
};
