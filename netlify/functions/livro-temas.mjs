// LIVRO MÁGICO — histórias (temas)
// GET                         → histórias publicadas (pra página do livro)
// GET  ?admin=1 (x-admin-key) → todas, com tudo (painel)
// POST (x-admin-key) { acao: 'salvar', temas:[...] }
//                    { acao: 'rascunho', ideia }        → a IA escreve uma história nova (rascunho)
//                    { acao: 'vitrine', id }            → gera a capa de vitrine (exemplo da página inicial)
//                    { acao: 'vitrine-status', id }
import { json, loja, lerTemas, TEMAS_PADRAO, criarImagem, verTarefa, guardarImagem, promptImagem, chaveApi } from './_livros.mjs';

const MODELOS_TEXTO = ['openai/gpt-5.4-mini', 'google/gemini-3.8-flash', 'anthropic/claude-haiku-4-5'];

function publico(t) {
  return {
    id: t.id, emoji: t.emoji, nome: t.nome, titulo: t.titulo, descricao: t.descricao, cores: t.cores, ordem: t.ordem || 99,
    vitrine: t.vitrineEm ? '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/tema/' + t.id) + '&v=' + t.vitrineEm : null,
    vitrineGenero: t.vitrineGenero || 'menino',
    paginas: (t.paginas || []).map((p) => ({ texto: p.texto }))
  };
}
function limparTema(t) {
  const id = String(t.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  if (!id) return null;
  const paginas = (Array.isArray(t.paginas) ? t.paginas : []).slice(0, 10).map((p) => ({
    texto: String(p.texto || '').slice(0, 900), cena: String(p.cena || '').slice(0, 900)
  })).filter((p) => p.texto && p.cena);
  if (paginas.length < 3) return null;
  return {
    id, emoji: String(t.emoji || '📖').slice(0, 4), status: t.status === 'publicado' ? 'publicado' : 'rascunho',
    ordem: Number(t.ordem) || 99, nome: String(t.nome || '').slice(0, 60), titulo: String(t.titulo || '').slice(0, 80),
    descricao: String(t.descricao || '').slice(0, 300),
    cores: Array.isArray(t.cores) && t.cores.length === 3 ? t.cores.map((c) => String(c).slice(0, 9)) : ['#FFE8F0', '#E86A9E', '#6B4BC4'],
    roupa: String(t.roupa || '').slice(0, 300), capa: String(t.capa || '').slice(0, 900), paginas,
    letra: String(t.letra || '').slice(0, 2500), estiloMusica: String(t.estiloMusica || "children's song, cheerful, catchy chorus, portuguese vocals").slice(0, 300),
    vitrineEm: t.vitrineEm || null, vitrineGenero: t.vitrineGenero === 'menina' ? 'menina' : 'menino'
  };
}

async function rascunhoIA(ideia) {
  const sistema = 'Você escreve livros infantis personalizados em português do Brasil, encantadores, com muitos detalhes visuais. ' +
    'Responda SOMENTE com um JSON válido, sem comentários.';
  const pedido = 'Crie uma história nova para o "Livro Mágico" a partir desta ideia: "' + String(ideia).slice(0, 600) + '".\n' +
    'Regras: a criança protagonista se chama {nome}. Use [o|a] para palavras que mudam entre menino e menina (ex.: pequen[o|a], [ele|ela], [dele|dela]). ' +
    'Exatamente 5 cenas. Cada "texto" tem de 40 a 60 palavras, linguagem de livro infantil, com começo, meio e fim e uma lição bonita no final. ' +
    'Cada "cena" é uma descrição em INGLÊS do que aparece na ilustração, começando com um verbo de ação (ex.: "riding a pony through..."), cheia de detalhes de cenário, bichinhos e cores. ' +
    '"capa" é a cena da capa em inglês. "roupa" é a roupa da criança em inglês (sempre a mesma). "letra" é a letra de uma música infantil curta em português com [Intro] "Era uma vez… {nome} ..." , [Verse], [Chorus] repetindo {nome}, e [Outro]. ' +
    'Formato: {"id":"slug-curto","emoji":"🎈","nome":"Nome do tema","titulo":"{nome} e ...","descricao":"1 frase de venda","cores":["#hex claro","#hex médio","#hex escuro"],"roupa":"...","capa":"...","paginas":[{"texto":"...","cena":"..."}],"letra":"...","estiloMusica":"children\'s song, ..., portuguese vocals"}';
  for (const m of MODELOS_TEXTO) {
    try {
      const r = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + chaveApi(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 3500, temperature: 0.8, messages: [{ role: 'system', content: sistema }, { role: 'user', content: pedido }] })
      });
      const d = await r.json().catch(() => null);
      const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!txt) continue;
      const ini = txt.indexOf('{'), fim = txt.lastIndexOf('}');
      const obj = JSON.parse(txt.slice(ini, fim + 1));
      obj.status = 'rascunho';
      const t = limparTema(obj);
      if (t) return t;
    } catch (e) { console.error('rascunho IA', m, e && e.message); }
  }
  return null;
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const senha = (process.env.ADMIN_SENHA || '').trim();
    const admin = !!senha && (req.headers.get('x-admin-key') || '') === senha;

    if (req.method === 'GET') {
      const temas = await lerTemas();
      if (u.searchParams.get('admin') === '1') {
        if (!admin) return json({ erro: 'Senha incorreta.' }, 401);
        return json({ temas });
      }
      const pubs = temas.filter((t) => t.status === 'publicado').sort((a, b) => (a.ordem || 99) - (b.ordem || 99)).map(publico);
      return new Response(JSON.stringify({ temas: pubs }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!admin) return json({ erro: 'Senha incorreta.' }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}

    if (b.acao === 'salvar') {
      const lista = (Array.isArray(b.temas) ? b.temas : []).map(limparTema).filter(Boolean);
      if (!lista.length) return json({ erro: 'Nenhuma história válida (cada uma precisa de pelo menos 3 cenas com texto e ilustração).' }, 400);
      const ids = {}; for (const t of lista) { if (ids[t.id]) return json({ erro: 'Duas histórias com o mesmo id: ' + t.id }, 400); ids[t.id] = 1; }
      await loja().setJSON('temas', lista);
      return json({ ok: true, temas: lista });
    }
    if (b.acao === 'restaurar') {
      await loja().setJSON('temas', TEMAS_PADRAO);
      return json({ ok: true, temas: TEMAS_PADRAO });
    }
    if (b.acao === 'codigo') {
      // código de uso único pra liberar mais uma prévia (o suporte manda pro cliente)
      const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let cod = 'LIVRO-'; for (let i = 0; i < 5; i++) cod += letras[Math.floor(Math.random() * letras.length)];
      await loja().setJSON('codigo/' + cod, { usado: false, em: Date.now() });
      return json({ ok: true, codigo: cod });
    }
    if (b.acao === 'rascunho') {
      if (String(b.ideia || '').trim().length < 5) return json({ erro: 'Descreva a ideia da história.' }, 400);
      const t = await rascunhoIA(b.ideia);
      if (!t) return json({ erro: 'A IA não conseguiu escrever agora. Tente de novo.' }, 502);
      return json({ ok: true, tema: t });
    }
    if (b.acao === 'vitrine' || b.acao === 'vitrine-status') {
      const temas = await lerTemas();
      const t = temas.find((x) => x.id === b.id);
      if (!t) return json({ erro: 'História não encontrada.' }, 404);
      const chaveTask = 'vit/' + t.id;
      if (b.acao === 'vitrine') {
        const genero = b.genero === 'menina' ? 'menina' : 'menino';
        const prompt = promptImagem(t, { idade: 4, genero }, t.capa, true, true);
        const task = await criarImagem(prompt, [], '3:4', '2K');
        await loja().setJSON(chaveTask, { task, genero, em: Date.now() });
        return json({ ok: true, rodando: true });
      }
      const info = await loja().get(chaveTask, { type: 'json' }).catch(() => null);
      if (!info || !info.task) return json({ ok: true, pronto: !!t.vitrineEm });
      const st = await verTarefa(info.task, 'imagem');
      if (st.estado === 'falhou') { await loja().delete(chaveTask); return json({ erro: 'A geração da capa falhou. Tente de novo.' }, 502); }
      if (st.estado !== 'pronto') return json({ ok: true, rodando: true });
      await guardarImagem(st.urls[0], 'img/tema/' + t.id);
      t.vitrineEm = Date.now(); t.vitrineGenero = info.genero;
      await loja().setJSON('temas', temas);
      await loja().delete(chaveTask);
      return json({ ok: true, pronto: true, tema: t });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error('livro-temas:', e && e.stack || e);
    return json({ erro: 'Erro inesperado.' }, 500);
  }
};
