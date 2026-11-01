// LIVRO MÁGICO — começa um livro: guarda a foto, cria o pedido e dispara a CAPA + a MÚSICA (prévia).
// POST { tema, nome, idade, idadeMeses, genero, foto (dataURL jpg/png), whatsapp? }
import { getStore } from '@netlify/blobs';
import { json, loja, novoId, novoToken, acharTema, avancarLivro, baseSite, chaveApi, PRECO_LIVRO } from './_livros.mjs';
import { indexar, indexarDia } from './_indice.mjs';

// UMA prévia por pessoa (por aparelho). Depois de PAGAR, pode criar outra.
// Pela internet (IP) o limite é mais solto (3 por dia): operadora de celular coloca
// muita gente diferente no mesmo IP, e não dá pra bloquear cliente novo por isso.
// Pra liberar mais uma sem pagar: o suporte gera um código no painel (aba Livros).
const DIAS_TRAVA = 30;

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!chaveApi()) return json({ erro: 'O Livro Mágico ainda está sendo configurado. Volta em breve!' }, 503);
    let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Dados inválidos.' }, 400); }

    const tema = await acharTema(String(b.tema || ''));
    if (!tema || tema.status !== 'publicado') return json({ erro: 'Escolha uma história.' }, 400);
    const nome = String(b.nome || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (nome.length < 2) return json({ erro: 'Escreva o nome da criança.' }, 400);
    const genero = b.genero === 'menina' ? 'menina' : 'menino';
    const idade = Math.max(0, Math.min(10, parseInt(b.idade, 10) || 0));
    const idadeMeses = idade === 0 ? Math.max(0, Math.min(11, parseInt(b.idadeMeses, 10) || 0)) : null;

    const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(String(b.foto || ''));
    if (!m) return json({ erro: 'Envie uma foto da criança (JPG ou PNG).' }, 400);
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 8000) return json({ erro: 'A foto ficou muito pequena. Tente outra, com o rostinho bem visível.' }, 400);
    if (buf.length > 4.5 * 1024 * 1024) return json({ erro: 'A foto é muito grande. Tente outra.' }, 400);

    // 1 prévia por pessoa: confere o aparelho e a internet (IP)
    const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim().replace(/[^0-9a-f:.]/gi, '');
    const aparelho = String(b.aparelho || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const chaves = aparelho ? ['trava/ap/' + aparelho] : ['trava/ip/' + ip];
    const presentes0 = getStore('presentes');
    let jaTem = null, jaPagou = false;
    for (const k of chaves) {
      const tv = await loja().get(k, { type: 'json' }).catch(() => null);
      if (!tv || Date.now() - (tv.em || 0) > DIAS_TRAVA * 86400000) continue;
      const anterior = await presentes0.get(tv.id, { type: 'json' }).catch(() => null);
      if (anterior && anterior.pago) jaPagou = true;
      if (anterior && !anterior.pago && !anterior.cancelado) { jaTem = anterior; break; }
    }
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
    if (!jaTem && !usouCodigo && !jaPagou && porIp.n >= 3) {
      return json({ jaTem: true, erro: 'Muitas prévias criadas nesta internet hoje. Desbloqueie a sua ou fale com o suporte.' }, 409);
    }
    if (jaTem && !usouCodigo) {
      return json({ jaTem: true, nome: jaTem.livro && jaTem.livro.nome, erro: 'Você já criou a prévia do seu livro. Pra criar outra, desbloqueie a sua ou fale com o suporte.' }, 409);
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

    for (const k of chaves) await loja().setJSON(k, { id, em: Date.now() });
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
