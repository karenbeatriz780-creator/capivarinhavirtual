import { getStore } from '@netlify/blobs';
import { lerIndice, idsDoTel } from './_indice.mjs';
import { enviarTexto, conversaAberta, registrar, SITE } from './_zap.mjs';

// RECUPERAÇÃO DE PIX PELO WHATSAPP (confere a cada 10 min)
// Quem recebeu a prévia no WhatsApp e não pagou recebe até 3 mensagens:
//   30 min · 1 h · 2 h depois da prévia. Para assim que pagar.
// Só pra quem conversou com o número nas últimas 24 h (grátis, sem modelo pago).
export const config = { schedule: '*/10 * * * *' };

const ETAPAS = [30 * 60 * 1000, 60 * 60 * 1000, 120 * 60 * 1000];
const DESISTE = 22 * 3600 * 1000; // a janela grátis fecha em 24 h

async function foiPago(m, taskId, numero) {
  if (m.pago) return true;
  const presentes = getStore('presentes');
  const ids = [m.presenteId, m.pedidoRecId].filter(Boolean);
  try {
    const ent = await idsDoTel(m.whatsapp || numero, await lerIndice());
    ent.p.slice(-20).forEach((x) => { if (ids.indexOf(x) === -1) ids.push(x); });
  } catch (e) {}
  const gs = await Promise.all(ids.map((id) => presentes.get(id, { type: 'json' }).catch(() => null)));
  return gs.some((g) => g && g.pago && !g.cancelado && (g.musicaPreviewId === taskId || (g.pagoEm || 0) > (m.criadoEm || 0)));
}

// frase que mexe com o coração, de acordo com pra quem é a música
function emocao(rel, nome) {
  const n = nome ? '*' + nome + '*' : 'essa pessoa';
  const F = {
    namorado: 'Imagina a cara de ' + n + ' ouvindo uma música só de vocês dois, com o nome e a história de vocês 🥹 Isso fica guardado pra sempre.',
    namorada: 'Imagina a cara de ' + n + ' ouvindo uma música só de vocês dois, com o nome e a história de vocês 🥹 Isso fica guardado pra sempre.',
    esposa: 'Depois de tudo que vocês já viveram juntos, ' + n + ' merece ouvir essa história cantada 💍 É o tipo de presente que faz chorar.',
    marido: 'Depois de tudo que vocês já viveram juntos, ' + n + ' merece ouvir essa história cantada 💍 É o tipo de presente que faz chorar.',
    mae: 'Mãe ama de um jeito que não cabe em palavras… mas cabe numa música 🥹 Imagina ' + n + ' ouvindo o próprio nome numa música feita por você.',
    pai: 'Pai quase nunca diz, mas sente tudo 🥹 Imagina ' + n + ' ouvindo uma música com a história de vocês. Ele vai guardar pra sempre.',
    filho: 'Um presente que ' + n + ' vai guardar pra vida toda 💗 Uma música que diz o tamanho do seu amor.',
    irmao: 'Irmão é pra vida toda 💗 Imagina ' + n + ' ouvindo essa música com as histórias de vocês.',
    amigo: 'Amizade assim merece trilha sonora 💗 ' + n + ' vai lembrar desse presente pra sempre.',
    avo: 'Imagina ' + n + ' ouvindo uma música com o nome e as memórias de vocês 🥹 É o tipo de presente que emociona a família inteira.',
    tio: n + ' vai se emocionar ouvindo uma música feita só pra ' + (nome ? 'ele(a)' : 'essa pessoa') + ' 💗',
    sogro: 'Um presente desses conquista ' + n + ' de vez 💗 Ninguém esquece uma música com o próprio nome.',
    padrinho: n + ' vai se emocionar com uma música feita só pra ' + (nome ? 'ele(a)' : 'essa pessoa') + ' 💗',
    familia: 'Imagina a família reunida ouvindo uma música com a história de vocês 🥹 Isso vira lembrança pra sempre.',
    louvor: 'Esse louvor é o seu testemunho 🙏 Deixa ele tocar completo, do começo ao fim, e glorificar o que Deus fez na sua vida.',
    comercial: 'Imagina seus clientes cantando o nome da sua marca 📣 Um jingle assim gruda na cabeça e vende.'
  };
  return F[rel] || ('Imagina a reação de ' + n + ' ouvindo uma música feita só pra ' + (nome ? 'ela(e)' : 'essa pessoa') + ' 💗');
}

function mensagem(etapa, m, link) {
  const nome = String(m.nomes || '').trim();
  const para = nome ? ' pra *' + nome + '*' : '';
  if (etapa === 0) return (
    '💗 Oi! A sua música' + para + ' ficou linda… e ainda está te esperando!\n\n' +
    emocao(m.relacao, nome) + '\n\n' +
    '🎧 O que você ouviu foi só a *prévia de 70 segundos*. A música completa tem *mais de 3 minutos*, e você recebe ela inteira, sem corte, logo depois do pagamento.\n\n' +
    '🎁 *4 músicas por R$ 9,99*: as 2 versões que você ouviu, completas, + mais 2 com outra letra e outro estilo.\n\n' +
    '👉 Finalize aqui no Pix:\n' + link);
  if (etapa === 1) return (
    '🎶 Ainda dá tempo de surpreender' + (nome ? ' *' + nome + '*' : '') + '!\n\n' +
    (m.relacao === 'louvor' ? 'Imagina esse louvor tocando completo no culto ou na sua casa 🙏' : m.relacao === 'comercial' ? 'Imagina o seu jingle tocando no seu Instagram e na sua loja 📣' :
      'Imagina o momento em que ' + (nome ? '*' + nome + '*' : 'essa pessoa') + ' der o play e ouvir o próprio nome na música 🥹 Esse é o tipo de presente que ninguém esquece.') + '\n\n' +
    'Pagou, recebeu: a música *completa* chega na hora, aqui no WhatsApp, pra você baixar e mandar.\n\n' +
    '🤔 Não gostou de alguma coisa? Sem problema: você pode *criar outra prévia* com outra letra ou outro estilo, é grátis ouvir:\n' + SITE + '/#/criar/musica\n\n' +
    '👉 Ou finalize a sua aqui:\n' + link);
  return (
    '⏳ *Último aviso* sobre a sua música' + para + '.\n\n' +
    'Ela já está prontinha, só falta você liberar. São *4 músicas por R$ 9,99*, menos que um lanche, pra um presente que fica pra sempre 💗\n\n' +
    '👉 Finalize aqui:\n' + link + '\n\n' +
    '⏳ Oferta válida só hoje.');
}

export default async () => {
  const loja = getStore('whatsapp'), musicas = getStore('musicas');
  let lista = [];
  try { lista = ((await loja.list({ prefix: 'rec_' })).blobs || []).slice(0, 80); } catch (e) { return; }
  const agora = Date.now();
  for (const b of lista) {
    try {
      const r = await loja.get(b.key, { type: 'json' }).catch(() => null);
      if (!r || !r.taskId) { await loja.delete(b.key); continue; }
      const etapa = r.n || 0;
      if (etapa >= ETAPAS.length || agora - (r.em || 0) > DESISTE) { await loja.delete(b.key); continue; }
      if (agora - (r.em || 0) < ETAPAS[etapa]) continue;                // ainda não é hora
      const m = await musicas.get(r.taskId, { type: 'json' }).catch(() => null);
      if (!m || !m.url || await foiPago(m, r.taskId, r.numero)) { await loja.delete(b.key); continue; }
      const para = await conversaAberta(r.numero);
      if (!para) { await loja.delete(b.key); continue; }              // janela grátis fechada: não manda nada
      if (etapa === 0) { m.ofertaRec = agora; await musicas.setJSON(r.taskId, m); } // libera "4 músicas por R$ 9,99" no link (1 dia)
      r.n = etapa + 1; r.ult = agora;
      if (r.n >= ETAPAS.length) await loja.delete(b.key); else await loja.setJSON(b.key, r);
      await loja.setJSON('recfeito_' + r.taskId, { em: agora, para, n: r.n });
      await enviarTexto(para, mensagem(etapa, m, SITE + '/#/ouvir/t.' + r.taskId));
      await registrar('recuperacao', { para, taskId: r.taskId, nome: String(m.nomes || ''), etapa: r.n });
    } catch (e) { console.error('recuperar-zap:', b.key, e && e.message); }
  }
};
