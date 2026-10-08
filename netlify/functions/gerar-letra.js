function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Mesmas descrições usadas em gerar-musica.mjs — aqui servem só de CONTEXTO
// pro modelo de texto entender o estilo. Quem decide o SOM é a Suno, não
// esta função: esta função só escreve a letra que a pessoa vai aprovar.
const GENERO_PT = {
  romantica:'balada romântica pop', sertanejo:'sertanejo universitário moderno',
  pop:'pop moderno', rock:'rock', mpb:'MPB', bossa:'bossa nova', gospel:'gospel de adoração',
  samba:'samba', pagode:'pagode', forro:'forró pé de serra', piseiro:'piseiro',
  funk:'funk carioca', trap:'trap', eletronica:'música eletrônica', reggae:'reggae',
  jazz:'jazz', blues:'blues', axe:'axé baiano', lofi:'lo-fi', infantil:'música infantil'
};
const CLIMA_PT = {
  alegre:'alegre e contagiante', emocionante:'emocionante, de arrepiar',
  romantica:'romântico e apaixonado', calma:'calmo e suave',
  nostalgica:'nostálgico, de saudade', festiva:'festivo, de celebração',
  energetica:'energético e vibrante', divertida:'divertido e bem-humorado',
  inspiradora:'inspirador, de superação', melancolica:'melancólico'
};
const NICHO_TEXTO = {
  namorada:'é para a namorada da pessoa — tom de romance', namorado:'é para o namorado da pessoa — tom de romance',
  esposa:'é para a esposa — amor maduro e de parceria de vida', marido:'é para o marido — amor maduro e de parceria de vida',
  mae:'é de um filho/filha para a mãe — gratidão e amor filial', pai:'é de um filho/filha para o pai — gratidão e amor filial',
  irma:'é entre irmãos — carinho e cumplicidade de família', irmao:'é entre irmãos — carinho e cumplicidade de família',
  amiga:'é para a melhor amiga — amizade', amigo:'é para o melhor amigo — amizade',
  filho:'é de um pai/mãe para o filho(a) — amor incondicional de pai/mãe'
};
const NICHO_EVITAR = {
  mae:'A letra é de filho para mãe: NUNCA use linguagem romântica ou de casal.',
  pai:'A letra é de filho para pai: NUNCA use linguagem romântica ou de casal.',
  irma:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  irmao:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  amiga:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  amigo:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  filho:'A letra é de pai/mãe para filho: NUNCA use linguagem romântica.'
};
const VOZ_PT = {
  masculina:'a música será cantada por uma voz masculina — se precisar de concordância de gênero no texto, use a masculina',
  feminina:'a música será cantada por uma voz feminina — se precisar de concordância de gênero no texto, use a feminina',
  dueto:'a música será um dueto, cantada em dupla — pode alternar vozes entre os versos'
};

const SYSTEM_PROMPT =
  'Você é um letrista brasileiro profissional, especializado em compor letras de música ' +
  'personalizadas e emocionantes para presentes (encomendas de clientes reais, não é ficção). ' +
  'Você escreve APENAS letras 100% originais, nunca reproduz nem parafraseia trechos de músicas ' +
  'já existentes de outros artistas. Sua resposta deve conter SOMENTE a letra final, pronta — ' +
  'sem explicações, sem comentários, sem aspas, sem markdown, sem títulos. Comece direto com a ' +
  'primeira marcação de estrutura.';

function montarPrompt(p) {
  var genDesc = GENERO_PT[p.estilo] || GENERO_PT.romantica;
  var climaDesc = CLIMA_PT[p.clima] || '';
  var relacaoDesc = NICHO_TEXTO[p.relacao] || 'é uma homenagem pessoal';
  var restricao = NICHO_EVITAR[p.relacao] || '';
  var vozDesc = VOZ_PT[p.voz] || '';

  var partes = [];
  partes.push('Escreva a letra de uma música em português do Brasil, sobre uma história real, com estas características:');
  partes.push('GÊNERO: ' + genDesc + '.');
  if (climaDesc) partes.push('CLIMA: ' + climaDesc + '.');
  partes.push('PARA QUEM: ' + relacaoDesc + '.');
  if (restricao) partes.push('RESTRIÇÃO IMPORTANTE: ' + restricao);
  if (p.ocasiao) partes.push('OCASIÃO: ' + p.ocasiao + '.');
  if (vozDesc) partes.push('VOZ: ' + vozDesc + '.');
  partes.push('');
  partes.push('HISTÓRIA REAL contada por quem está encomendando a música — use estes detalhes ' +
    'verdadeiros (nomes, lugares, datas, cenas específicas) porque são o que torna a letra ' +
    'pessoal e única. Não ignore nem resuma demais; aproveite o máximo de detalhes concretos ' +
    'que couberem naturalmente na letra:');
  partes.push('"""');
  partes.push(p.texto);
  partes.push('"""');
  if (p.frase) {
    partes.push('');
    partes.push('Inclua esta frase EXATAMENTE como está escrita, palavra por palavra, em algum ' +
      'verso ou no refrão (não mude nenhuma palavra dela): "' + p.frase + '"');
  }
  if (p.nomesLetra) {
    partes.push('');
    partes.push('Cite estes nomes na letra, naturalmente: ' + p.nomesLetra);
  }
  partes.push('');
  partes.push('ESTRUTURA: use estas marcações, cada uma em sua própria linha, exatamente com ' +
    'esta grafia — [Verso 1], [Refrão], [Verso 2], [Refrão], [Ponte], [Refrão Final] (a [Ponte] ' +
    'é opcional, pode remover se a música ficar melhor sem ela). Depois de cada marcação, escreva ' +
    'as linhas de letra correspondentes.');
  partes.push('TAMANHO: a letra completa (sem contar as marcações de estrutura) deve ter entre ' +
    '500 e 1400 caracteres — nem curta demais, nem longa demais.');
  partes.push('');
  partes.push('Responda SOMENTE com a letra formatada — nada antes, nada depois.');
  return partes.join('\n');
}

function limparResposta(txt) {
  var t = String(txt || '').trim();
  // tira cerca de código, se o modelo colocar uma por engano
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  return t.slice(0, 3000);
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const estilo = String((body && body.estilo) || '').trim();
    const texto = String((body && body.texto) || '').trim();
    const clima = String((body && body.clima) || '').trim();
    const relacao = String((body && body.relacao) || '').trim();
    const ocasiao = String((body && body.ocasiao) || '').trim();
    const nomesLetra = String((body && body.nomesLetra) || '').trim();
    const frase = String((body && body.frase) || '').trim();
    const voz = String((body && body.voz) || '').trim();

    if (!estilo) return json({ erro: 'Escolhe um estilo primeiro.' }, 400);
    if (texto.length < 50) return json({ erro: 'Conta um pouco mais da história (pelo menos 50 caracteres).' }, 400);

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) {
      return json({ erro: 'A geração de letra ainda está sendo configurada. Volta em breve!' }, 503);
    }

    // texto da história limitado por segurança (custo/tokens) — 2000 caracteres
    // já é bem mais espaço do que a Suno aceitava no modo antigo (500).
    const prompt = montarPrompt({
      estilo, clima, relacao, ocasiao, nomesLetra, frase, voz,
      texto: texto.slice(0, 2000)
    });

    console.log('PEDIDO DE LETRA >> genero=' + estilo + ' | clima=' + clima +
      ' | relacao=' + relacao + ' | ocasiao=' + ocasiao);

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-5.4',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.9,
          max_tokens: 900
        })
      });
    } catch (e) {
      console.error('Unifically chat (rede):', e && e.stack || e);
      return json({ erro: 'Não consegui falar com o servidor de letras agora.' }, 502);
    }

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      console.error('Unifically chat completions:', resp.status, JSON.stringify(data));
      return json({ erro: 'Não consegui escrever a letra agora. Tenta de novo em instantes.' }, 502);
    }

    const conteudo = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!conteudo || !conteudo.trim()) {
      console.error('Unifically chat sem conteúdo:', JSON.stringify(data));
      return json({ erro: 'O serviço de letra não respondeu com um texto. Tenta de novo.' }, 502);
    }

    const letra = limparResposta(conteudo);
    console.log('LETRA GERADA >> ' + letra.slice(0, 120) + (letra.length > 120 ? '...' : ''));

    return json({ ok: true, letra: letra });

  } catch (e) {
    console.error('gerar-letra (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
