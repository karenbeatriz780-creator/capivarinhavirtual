// LIVRO MÁGICO — começa um livro: guarda a foto, cria o pedido e dispara a CAPA + a MÚSICA (prévia).
// POST { tema, nome, idade, idadeMeses, genero, foto (dataURL jpg/png), whatsapp? }
import { getStore } from '@netlify/blobs';
import { json, loja, novoId, novoToken, acharTema, avancarLivro, baseSite, chaveApi, PRECO_LIVRO } from './_livros.mjs';
import { indexar, indexarDia } from './_indice.mjs';

// ATÉ 2 prévias grátis por pessoa (por aparelho). Depois de PAGAR, libera de novo.
// Pela internet (IP) o limite é mais solto (5 por dia): operadora de celular coloca
// muita gente diferente no mesmo IP, e não dá pra bloquear cliente novo por isso.
// Pra liberar mais uma sem pagar: o suporte gera um código no painel (aba Livros).
// Você (com a senha de administrador salva no aparelho) cria quantas quiser, pra testar.
const DIAS_TRAVA = 30;
const MAX_PREVIAS = 2;
const MAX_IP_DIA = 5;

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!chaveApi()) return json({ erro: 'O Livro Mágico ainda está sendo configurado. Volta em breve!' }, 503);
    let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Dados inválidos.' }, 400); }

    // TROCAR A FOTO: a IA recusou a foto (acontece com foto escura, de longe, com filtro, sem camiseta…).
    // O cliente manda outra e a capa recomeça, sem gastar uma prévia nova.
    if (b.trocarFoto) {
      const id = String(b.trocarFoto), pres = getStore('presentes');
      const g = /^L[0-9a-f]{14}$/.test(id) ? await pres.get(id, { type: 'json' }).catch(() => null) : null;
      if (!g || !g.livro || String(b.t || '') !== g.livro.token) return json({ erro: 'Livro não encontrado.' }, 404);
      const mf = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(String(b.foto || ''));
      if (!mf) return json({ erro: 'Envie uma foto JPG ou PNG.' }, 400);
      const bf = Buffer.from(mf[2], 'base64');
      if (bf.length < 8000 || bf.length > 4.5 * 1024 * 1024) return json({ erro: 'Essa foto não serve. Tente outra.' }, 400);
      await loja().set('foto/' + id, bf, { metadata: { tipo: 'image/jpeg' } });
      const L = g.livro;
      L.capa = { trocouFoto: (L.capa && L.capa.trocouFoto || 0) + 1 };
      (L.paginas || []).forEach((p) => { if (p && !p.ok) { p.tent = 0; p.erro = false; p.task = null; p.msg = ''; p.recusas = 0; } });
      L.fotoApagada = false; if (L.status === 'problema') L.status = g.pago ? 'gerando' : 'criando';
      await pres.setJSON(id, g);
      try { await avancarLivro(id, baseSite(req)); } catch (e) {}
      return json({ ok: true });
    }
    const senhaAdm0 = (process.env.ADMIN_SENHA || '').trim();
    const ehAdm = !!senhaAdm0 && (req.headers.get('x-admin-key') || '') === senhaAdm0;
    const tema = await acharTema(String(b.tema || ''));
    if (!tema || (tema.status !== 'publicado' && !ehAdm)) return json({ erro: 'Escolha uma história.' }, 400);
    let nome = String(b.nome || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    // tudo maiúsculo ou tudo minúsculo → "Felipe" (fica mais bonito na capa e no livro)
    if (nome === nome.toUpperCase() || nome === nome.toLowerCase()) nome = nome.toLowerCase().replace(/(^|[\s-])(\S)/g, (m, a, l) => a + l.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (x) => x.toLowerCase());
    if (nome.length < 2) return json({ erro: 'Escreva o nome da criança.' }, 400);
    const genero = b.genero === 'menina' ? 'menina' : 'menino';
    const idade = Math.max(0, Math.min(10, parseInt(b.idade, 10) || 0));
    const idadeMeses = idade === 0 ? Math.max(0, Math.min(11, parseInt(b.idadeMeses, 10) || 0)) : null;

    const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(String(b.foto || ''));
    if (!m) return json({ erro: 'Envie uma foto da criança (JPG ou PNG).' }, 400);
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 8000) return json({ erro: 'A foto ficou muito pequena. Tente outra, com o rostinho bem visível.' }, 400);
    if (buf.length > 4.5 * 1024 * 1024) return json({ erro: 'A foto é muito grande. Tente outra.' }, 400);

    const senhaAdm = (process.env.ADMIN_SENHA || '').trim();
    const admin = !!senhaAdm && (req.headers.get('x-admin-key') || '') === senhaAdm;
    // até 2 prévias por pessoa: confere o aparelho e a internet (IP)
    const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim().replace(/[^0-9a-f:.]/gi, '');
    const aparelho = String(b.aparelho || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const chaves = aparelho ? ['trava/ap/' + aparelho] : ['trava/ip/' + ip];
    const presentes0 = getStore('presentes');
    let jaTem = null, jaPagou = false;
    const travas = {};
    for (const k of chaves) {
      const tv = await loja().get(k, { type: 'json' }).catch(() => null);
      // formato antigo: { id, em } → lista { ids:[{id,em}] }
      const lista = !tv ? [] : (Array.isArray(tv.ids) ? tv.ids : (tv.id ? [{ id: tv.id, em: tv.em }] : []))
        .filter((x) => x && x.id && Date.now() - (x.em || 0) <= DIAS_TRAVA * 86400000);
      travas[k] = lista;
      const anteriores = (await Promise.all(lista.map((x) => presentes0.get(x.id, { type: 'json' }).catch(() => null)))).filter(Boolean);
      if (anteriores.some((a) => a.pago)) jaPagou = true;
      const abertas = anteriores.filter((a) => !a.pago && !a.cancelado);
      if (abertas.length >= MAX_PREVIAS) { jaTem = abertas.sort((a, b2) => (b2.criadoEm || 0) - (a.criadoEm || 0))[0]; break; }
    }
    if (admin) jaTem = null;
    const codigo = String(b.codigo || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    let usouCodigo = false;
    if (jaTem && codigo) {
      const c = await loja().get('codigo/' + codigo, { type: 'json' }).catch(() => null);
      if (c && !c.usado) { usouCodigo = true; }
      else return json({ erro: 'Esse código não é válido ou já foi usado.', jaTem: true }, 403);
    }
    const dia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const chaveIp = 'ipdia/' + dia + '/' + ip;
    const porIp = (await loja().get(chaveIp, { type: 'json' }).catch(() => null)) || { n: 0 };
    if (!admin && !jaTem && !usouCodigo && !jaPagou && porIp.n >= MAX_IP_DIA) {
      return json({ jaTem: true, erro: 'Muitas prévias criadas nesta internet hoje. Desbloqueie a sua ou fale com o suporte.' }, 409);
    }
    if (jaTem && !usouCodigo) {
      return json({ jaTem: true, nome: jaTem.livro && jaTem.livro.nome, erro: 'Você já usou as 2 prévias grátis. Pra criar outra, desbloqueie um livro ou fale com o suporte.' }, 409);
    }

    const id = novoId();
    const token = novoToken();
    await loja().set('foto/' + id, buf, { metadata: { tipo: 'image/' + (m[1] === 'jpg' ? 'jpeg' : m[1]) } });

    const zap = String(b.whatsapp || '').replace(/\D/g, '').slice(0, 13);
    const g = {
      id, produto: 'livro', duracao: 'vitalicio', criadoEm: Date.now(), pago: false,
      meuNome: '', parceiroNome: nome, musicaParaNome: nome,
      musicaWhatsapp: zap, whatsapp: zap,
      livro: { tema: tema.id, nome, genero, idade, idadeMeses, token, status: 'criando', capa: {}, musica: {}, paginas: [] },
      pagamento: { valor: PRECO_LIVRO }
    };
    await getStore('presentes').setJSON(id, g);
    try { await indexarDia('p', id); if (zap) await indexar(zap, 'p', id); } catch (e) {}

    if (!admin) for (const k of chaves) await loja().setJSON(k, { ids: (travas[k] || []).concat([{ id, em: Date.now() }]).slice(-10) });
    await loja().setJSON(chaveIp, { n: porIp.n + 1 });
    if (usouCodigo) await loja().setJSON('codigo/' + codigo, { usado: true, em: Date.now(), livro: id });

    // já dispara capa + música
    const base = baseSite(req);
    try { await avancarLivro(id, base); } catch (e) { console.error('livro-previa avancar', e && e.message); }
    return json({ ok: true, id, token });
  } catch (e) {
    console.error('livro-previa:', e && e.stack || e);
    return json({ erro: 'Não consegui começar o livro agora. Tente de novo.' }, 500);
  }
};
