// LIVRO MÁGICO — histórias (temas)
// GET                         → histórias publicadas (pra página do livro)
// GET  ?admin=1 (x-admin-key) → todas, com tudo (painel)
// POST (x-admin-key) { acao: 'salvar', temas:[...] }
//                    { acao: 'rascunho', ideia }        → a IA escreve uma história nova (rascunho)
//                    { acao: 'vitrine', id }            → gera a capa de vitrine (exemplo da página inicial)
//                    { acao: 'vitrine-status', id }
//                    { acao: 'exemplo-add', id }        → usa um livro PAGO como exemplo na página (copia capa + ilustrações)
//                    { acao: 'exemplo-foto', foto }     → foto sua (ex.: livro impresso) pra girar na página
//                    { acao: 'exemplos-salvar', exemplos:[{id,mostrar}] } → ordem / mostrar / tirar
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { json, loja, lerTemas, TEMAS_PADRAO, criarImagem, verTarefa, guardarImagem, promptImagem, chaveApi, flex, refazerImagens, avancarLivro, usaDe, diagLivro } from './_livros.mjs';

// ---------- exemplos (vitrine da página) ----------
async function lerExemplos() { try { return (await loja().get('exemplos', { type: 'json' })) || []; } catch (e) { return []; } }
function urlEx(id, nome, v) { return '/.netlify/functions/livro-img?k=' + encodeURIComponent('ex/' + id + '/' + nome) + '&v=' + (v || 1); }
function exPublico(x) {
  const o = { id: x.id, tipo: x.tipo, mostrar: x.mostrar !== false, capa: urlEx(x.id, 'capa', x.em), legenda: x.legenda || '' };
  if (x.tipo === 'livro') {
    Object.assign(o, { nome: x.nome, genero: x.genero, tema: x.tema, titulo: x.titulo, textos: x.textos || [], pedido: x.pedido,
      paginas: Array.from({ length: x.n || 0 }, (_, i) => urlEx(x.id, 'p' + (((x.mapa && x.mapa[i] != null) ? x.mapa[i] : i) + 1), x.em)) });
  }
  return o;
}
async function copiarBlob(de, para) {
  const r = await loja().getWithMetadata(de, { type: 'arrayBuffer' }).catch(() => null);
  if (!r || !r.data) return false;
  await loja().set(para, r.data, { metadata: r.metadata || {} });
  return true;
}

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
  const brutas = (Array.isArray(t.paginas) ? t.paginas : []).slice(0, 16).map((p) => ({
    texto: String((p && p.texto) || '').slice(0, 900), cena: String((p && p.cena) || '').slice(0, 900), usa: usaDe(p)
  }));
  // tira páginas vazias, mas mantém as referências de "repete a ilustração da cena N" certas
  const novoIndice = []; const paginas = [];
  brutas.forEach((p, i) => { if (p.texto && (p.cena || p.usa != null)) { novoIndice[i] = paginas.length; paginas.push(p); } });
  paginas.forEach((p) => {
    if (p.usa == null) { delete p.usa; return; }
    const alvo = novoIndice[p.usa];
    if (alvo == null || alvo === paginas.indexOf(p) || paginas[alvo].usa != null) { delete p.usa; if (!p.cena) p.cena = paginas[0] ? paginas[0].cena : ''; } else p.usa = alvo;
  });
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
        return json({ temas, exemplos: (await lerExemplos()).map(exPublico) });
      }
      const pubs = temas.filter((t) => t.status === 'publicado').sort((a, b) => (a.ordem || 99) - (b.ordem || 99)).map(publico);
      const exemplos = (await lerExemplos()).filter((x) => x.mostrar !== false).map(exPublico);
      return new Response(JSON.stringify({ temas: pubs, exemplos }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!admin) return json({ erro: 'Senha incorreta.' }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}

    if (b.acao === 'salvar') {
      // avisa direitinho o que falta, em vez de sumir com a história
      for (const t of (Array.isArray(b.temas) ? b.temas : [])) {
        const nm = '"' + String(t.nome || t.id || 'sem nome') + '"';
        const pags = Array.isArray(t.paginas) ? t.paginas : [];
        for (let i = 0; i < pags.length; i++) {
          const tx = String((pags[i] && pags[i].texto) || '').trim(), ce = String((pags[i] && pags[i].cena) || '').trim();
          const repete = usaDe(pags[i]) != null;
          if (tx && !ce && !repete) return json({ erro: 'Na história ' + nm + ', a página ' + (i + 1) + ' está sem o campo "O que aparece na ilustração". Preencha (pode ser em português) ou escolha repetir a ilustração de outra página.' }, 400);
          if (!tx && (ce || repete)) return json({ erro: 'Na história ' + nm + ', a página ' + (i + 1) + ' está sem o texto.' }, 400);
        }
        const novas = pags.filter((p) => p && String(p.texto || '').trim() && String(p.cena || '').trim() && usaDe(p) == null).length;
        if (novas < 3) return json({ erro: 'A história ' + nm + ' precisa de pelo menos 3 páginas com ilustração nova.' }, 400);
        if (novas > 10) return json({ erro: 'A história ' + nm + ' tem ' + novas + ' ilustrações novas. O máximo é 10 (as outras podem repetir uma ilustração).' }, 400);
        if (!String(t.titulo || '').trim()) return json({ erro: 'A história ' + nm + ' está sem o título da capa.' }, 400);
      }
      const lista = (Array.isArray(b.temas) ? b.temas : []).map(limparTema).filter(Boolean);
      if (!lista.length) return json({ erro: 'Nenhuma história válida (cada uma precisa de pelo menos 3 cenas com texto e ilustração).' }, 400);
      const ids = {}; for (const t of lista) { if (ids[t.id]) return json({ erro: 'Duas histórias com o mesmo id: ' + t.id }, 400); ids[t.id] = 1; }
      await loja().setJSON('temas', lista);
      return json({ ok: true, temas: lista });
    }
    if (b.acao === 'livro-liberar') {
      // você libera um livro seu sem pagar (pra testar ou pra usar de exemplo). Não conta como venda.
      const id = String(b.id || '').trim();
      if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Código do livro inválido.' }, 400);
      const pres = getStore('presentes'), g = await pres.get(id, { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      if (!g.pago) { g.pago = true; g.cortesia = true; g.pagoEm = Date.now(); g.pagamento = Object.assign({}, g.pagamento, { valor: 0, provedor: 'admin' }); await pres.setJSON(id, g); }
      try { await avancarLivro(id, process.env.URL || new URL(req.url).origin); } catch (e) {}
      return json({ ok: true });
    }
    if (b.acao === 'livro-diag') {
      const g = await getStore('presentes').get(String(b.id || ''), { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      return json({ ok: true, diag: diagLivro(g) });
    }
    if (b.acao === 'livro-refazer') {
      const id = String(b.id || '').trim();
      if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Código do livro inválido.' }, 400);
      const r = await refazerImagens(id);
      if (r.erro) return json({ erro: r.erro }, 400);
      try { await avancarLivro(id, process.env.URL || new URL(req.url).origin); } catch (e) {}
      return json({ ok: true });
    }
    if (b.acao === 'exemplo-add') {
      const id = String(b.id || '').trim();
      if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Código do livro inválido (começa com L).' }, 400);
      const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      if (!g.pago) return json({ erro: 'Só dá pra usar como exemplo um livro pago (com todas as ilustrações).' }, 400);
      const L = g.livro, pags = L.paginas || [];
      if (!(L.capa && L.capa.ok) || !pags.length || pags.some((p) => !p || (p.usa == null && !p.ok))) return json({ erro: 'Esse livro ainda não terminou de ficar pronto. Tente daqui a pouco.' }, 400);
      if (!(await copiarBlob('img/' + id + '/capa', 'ex/' + id + '/capa'))) return json({ erro: 'Não achei a capa desse livro.' }, 404);
      for (let i = 1; i <= pags.length; i++) if (pags[i - 1].usa == null) await copiarBlob('img/' + id + '/p' + i, 'ex/' + id + '/p' + i);
      const temas = await lerTemas(), t = temas.find((x) => x.id === L.tema) || {};
      const ex = {
        id, tipo: 'livro', pedido: id, nome: L.nome, genero: L.genero, tema: L.tema, n: pags.length, em: Date.now(), mostrar: true,
        mapa: pags.map((p, i) => (p.usa != null ? p.usa : i)),
        titulo: flex(t.titulo || '{nome}', L.nome, L.genero), textos: (t.paginas || []).map((p) => flex(p.texto || '', L.nome, L.genero))
      };
      const lista = (await lerExemplos()).filter((x) => x.id !== id); lista.unshift(ex);
      await loja().setJSON('exemplos', lista);
      return json({ ok: true, exemplos: lista.map(exPublico) });
    }
    if (b.acao === 'exemplo-foto') {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(b.foto || ''));
      if (!m) return json({ erro: 'Mande uma foto JPG ou PNG.' }, 400);
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length < 3000 || buf.length > 4500000) return json({ erro: 'Foto muito pequena ou muito grande.' }, 400);
      const id = 'F' + crypto.randomBytes(5).toString('hex');
      await loja().set('ex/' + id + '/capa', buf, { metadata: { tipo: m[1] } });
      const lista = await lerExemplos(); lista.unshift({ id, tipo: 'foto', legenda: String(b.legenda || '').slice(0, 80), em: Date.now(), mostrar: true });
      await loja().setJSON('exemplos', lista);
      return json({ ok: true, exemplos: lista.map(exPublico) });
    }
    if (b.acao === 'exemplos-salvar') {
      const atual = await lerExemplos(), porId = {}; atual.forEach((x) => { porId[x.id] = x; });
      const nova = [];
      (Array.isArray(b.exemplos) ? b.exemplos : []).forEach((e) => { const x = porId[e && e.id]; if (x && nova.indexOf(x) === -1) { x.mostrar = e.mostrar !== false; nova.push(x); } });
      // os que saíram da lista: apaga as imagens
      for (const x of atual) {
        if (nova.indexOf(x) !== -1) continue;
        const nomes = ['capa'].concat(Array.from({ length: x.n || 0 }, (_, i) => 'p' + (i + 1)));
        for (const n of nomes) await loja().delete('ex/' + x.id + '/' + n).catch(() => {});
      }
      await loja().setJSON('exemplos', nova);
      return json({ ok: true, exemplos: nova.map(exPublico) });
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
